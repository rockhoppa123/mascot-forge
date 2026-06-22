# LEGACY / batch-only (ADR-0011 + ease-and-quality plan P3). The CANONICAL vectorizer is now the
# browser module tools/rig-editor/vectorize.js (cross-platform, node-tested, what the editor + product
# use). This PowerShell port is Windows-only (System.Drawing) and is kept solely for the `mf forge`
# terminal/batch path; do not add features here — change vectorize.js and mirror if needed.
param(
  [string]$SourcePath = "C:\Users\student1\Dev\DevBrain\public\mascot\default.png",
  [string]$OutPath = "docs/buildable-slice/generated/devbrain-flat.svg",
  # Quantization target. The Clean Mascot Source is an anti-aliased raster (~2.4k distinct
  # RGB values), not flat pixel art, so v1 colour-clusters it down to a small fixed palette
  # via deterministic median-cut (largest-gap split) before RLE + greedy meshing. The default
  # of 6 captures the mascot's meaningful layers (orange body, dark eyes/legs, green antenna
  # tip, belly highlight) in 6 clean colour clusters. See ADR-0009.
  [int]$Colors = 6,
  # Pixels with alpha below this emit no geometry (preserve the transparent pose). The
  # documented source is alpha 0 (fully transparent) or near-opaque; default keeps every
  # alpha>0 pixel as the contract requires.
  [int]$AlphaThreshold = 1
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  throw "Pixel vectorizer failed: $Message"
}

function Resolve-RepoPath {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path $repoRoot $Path)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedSource = Resolve-RepoPath $SourcePath
if (-not (Test-Path -LiteralPath $resolvedSource -PathType Leaf)) {
  Fail "Clean Mascot Source PNG not found (read-only input): $resolvedSource"
}
$resolvedOut = Resolve-RepoPath $OutPath
$resolvedOutDir = Split-Path -Parent $resolvedOut
if (-not (Test-Path -LiteralPath $resolvedOutDir -PathType Container)) {
  New-Item -ItemType Directory -Path $resolvedOutDir | Out-Null
}
if ($Colors -lt 1) { Fail "Colors must be >= 1." }

# --- Decode the Clean Mascot Source READ-ONLY into an ARGB grid -------------------------
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap($resolvedSource)
try {
  $W = $bmp.Width
  $H = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
  $locked = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $locked.Stride
  $bytes = New-Object byte[] ($stride * $H)
  [System.Runtime.InteropServices.Marshal]::Copy($locked.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($locked)
} finally {
  $bmp.Dispose()
}

# rgbGrid[y*W+x] = packed 0xRRGGBB int for opaque pixels, or -1 for transparent.
$rgbGrid = New-Object int[] ($W * $H)
$histogram = @{}        # packed rgb int -> opaque pixel count
$opaque = 0
$minX = $W; $minY = $H; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $H; $y++) {
  $rowBase = $y * $stride
  $gridBase = $y * $W
  for ($x = 0; $x -lt $W; $x++) {
    $i = $rowBase + $x * 4
    $a = $bytes[$i + 3]
    if ($a -lt $AlphaThreshold) {
      $rgbGrid[$gridBase + $x] = -1
      continue
    }
    $packed = ([int]$bytes[$i + 2] -shl 16) -bor ([int]$bytes[$i + 1] -shl 8) -bor [int]$bytes[$i]
    $rgbGrid[$gridBase + $x] = $packed
    if ($histogram.ContainsKey($packed)) { $histogram[$packed]++ } else { $histogram[$packed] = 1 }
    $opaque++
    if ($x -lt $minX) { $minX = $x }
    if ($x -gt $maxX) { $maxX = $x }
    if ($y -lt $minY) { $minY = $y }
    if ($y -gt $maxY) { $maxY = $y }
  }
}
if ($opaque -eq 0) { Fail "Source has no opaque pixels above the alpha threshold." }

# --- Deterministic median-cut quantization --------------------------------------------
# Unique colours sorted ascending so every step is order-independent.
$uniqueColors = @($histogram.Keys | Sort-Object)

function New-Box {
  param([int[]]$ColorList)
  $count = 0
  $rMin = 255; $gMin = 255; $bMin = 255
  $rMax = 0; $gMax = 0; $bMax = 0
  foreach ($c in $ColorList) {
    $r = ($c -shr 16) -band 0xFF
    $g = ($c -shr 8) -band 0xFF
    $b = $c -band 0xFF
    if ($r -lt $rMin) { $rMin = $r }
    if ($r -gt $rMax) { $rMax = $r }
    if ($g -lt $gMin) { $gMin = $g }
    if ($g -gt $gMax) { $gMax = $g }
    if ($b -lt $bMin) { $bMin = $b }
    if ($b -gt $bMax) { $bMax = $b }
    $count += $histogram[$c]
  }
  [PSCustomObject]@{
    Colors = $ColorList
    Count  = $count
    RRange = $rMax - $rMin
    GRange = $gMax - $gMin
    BRange = $bMax - $bMin
  }
}

$boxes = New-Object System.Collections.Generic.List[object]
$boxes.Add((New-Box $uniqueColors)) | Out-Null

while ($boxes.Count -lt $Colors) {
  # Pick the splittable box with the largest single-channel range; first wins ties (stable).
  $targetIndex = -1
  $bestRange = -1
  for ($bi = 0; $bi -lt $boxes.Count; $bi++) {
    $box = $boxes[$bi]
    if ($box.Colors.Count -lt 2) { continue }
    $range = [Math]::Max($box.RRange, [Math]::Max($box.GRange, $box.BRange))
    if ($range -gt $bestRange) { $bestRange = $range; $targetIndex = $bi }
  }
  if ($targetIndex -lt 0) { break }   # nothing left to split

  $box = $boxes[$targetIndex]
  # Longest axis decides the sort key; r > g > b on ties for determinism.
  if ($box.RRange -ge $box.GRange -and $box.RRange -ge $box.BRange) { $axis = 16 }
  elseif ($box.GRange -ge $box.BRange) { $axis = 8 }
  else { $axis = 0 }

  $sorted = @($box.Colors | Sort-Object @{ Expression = { ($_ -shr $axis) -band 0xFF } }, @{ Expression = { $_ } })
  # Split at the largest gap along the longest axis. Unlike a population-median split, this
  # isolates distinct accent clusters (e.g. the small green antenna tip) instead of letting
  # the dominant colour mass swallow rare-but-salient hues. First-largest gap wins ties.
  $splitAt = 1
  $bestGap = -1
  for ($k = 1; $k -lt $sorted.Count; $k++) {
    $gap = (($sorted[$k] -shr $axis) -band 0xFF) - (($sorted[$k - 1] -shr $axis) -band 0xFF)
    if ($gap -gt $bestGap) { $bestGap = $gap; $splitAt = $k }
  }

  $left = $sorted[0..($splitAt - 1)]
  $right = $sorted[$splitAt..($sorted.Count - 1)]
  $boxes[$targetIndex] = New-Box $left
  $boxes.Insert($targetIndex + 1, (New-Box $right)) | Out-Null
}

# Palette entry = pixel-count-weighted average of its box, rounded deterministically.
$palette = New-Object int[] $boxes.Count
for ($bi = 0; $bi -lt $boxes.Count; $bi++) {
  $box = $boxes[$bi]
  [double]$sr = 0; [double]$sg = 0; [double]$sb = 0; [double]$sc = 0
  foreach ($c in $box.Colors) {
    $wt = $histogram[$c]
    $sr += (($c -shr 16) -band 0xFF) * $wt
    $sg += (($c -shr 8) -band 0xFF) * $wt
    $sb += ($c -band 0xFF) * $wt
    $sc += $wt
  }
  $pr = [int][Math]::Round($sr / $sc, [MidpointRounding]::AwayFromZero)
  $pg = [int][Math]::Round($sg / $sc, [MidpointRounding]::AwayFromZero)
  $pb = [int][Math]::Round($sb / $sc, [MidpointRounding]::AwayFromZero)
  $palette[$bi] = ($pr -shl 16) -bor ($pg -shl 8) -bor $pb
}

# --- Map every source colour to its nearest palette entry (cached per unique colour) ----
$nearestCache = @{}
function Get-NearestHex {
  param([int]$Packed)
  if ($nearestCache.ContainsKey($Packed)) { return $nearestCache[$Packed] }
  $r = ($Packed -shr 16) -band 0xFF
  $g = ($Packed -shr 8) -band 0xFF
  $b = $Packed -band 0xFF
  $bestIdx = 0
  $bestDist = [int]::MaxValue
  for ($pi = 0; $pi -lt $palette.Count; $pi++) {
    $p = $palette[$pi]
    $dr = $r - (($p -shr 16) -band 0xFF)
    $dg = $g - (($p -shr 8) -band 0xFF)
    $db = $b - ($p -band 0xFF)
    $dist = $dr * $dr + $dg * $dg + $db * $db
    if ($dist -lt $bestDist) { $bestDist = $dist; $bestIdx = $pi }
  }
  $p = $palette[$bestIdx]
  $hex = '#{0:x2}{1:x2}{2:x2}' -f (($p -shr 16) -band 0xFF), (($p -shr 8) -band 0xFF), ($p -band 0xFF)
  $nearestCache[$Packed] = $hex
  return $hex
}

# quantGrid[y*W+x] = hex string for opaque pixels, or $null for transparent.
$quantGrid = [string[]]::new($W * $H)
for ($idx = 0; $idx -lt $rgbGrid.Length; $idx++) {
  $packed = $rgbGrid[$idx]
  if ($packed -lt 0) { $quantGrid[$idx] = $null; continue }
  $quantGrid[$idx] = Get-NearestHex $packed
}

# --- RLE per row + greedy vertical merge of equal (x, width, colour) runs --------------
# rectsByColor[hex] = list of "x y w h" rect tuples.
$rectsByColor = @{}
$openRects = @{}   # key "x|w|hex" -> [PSCustomObject]{ X; W; Hex; StartY }
$totalRects = 0

function Close-Rect {
  param($Rect, [int]$EndYExclusive)
  $rh = $EndYExclusive - $Rect.StartY
  $tuple = "$($Rect.X) $($Rect.StartY) $($Rect.W) $rh"
  if (-not $rectsByColor.ContainsKey($Rect.Hex)) {
    $rectsByColor[$Rect.Hex] = New-Object System.Collections.Generic.List[string]
  }
  $rectsByColor[$Rect.Hex].Add($tuple) | Out-Null
}

for ($y = 0; $y -lt $H; $y++) {
  $gridBase = $y * $W
  $rowKeys = @{}
  $x = 0
  while ($x -lt $W) {
    $hex = $quantGrid[$gridBase + $x]
    if ([string]::IsNullOrEmpty($hex)) { $x++; continue }
    $x2 = $x + 1
    while ($x2 -lt $W -and $quantGrid[$gridBase + $x2] -eq $hex) { $x2++ }
    $runW = $x2 - $x
    $key = "$x|$runW|$hex"
    $rowKeys[$key] = $true
    if (-not $openRects.ContainsKey($key)) {
      $openRects[$key] = [PSCustomObject]@{ X = $x; W = $runW; Hex = $hex; StartY = $y }
      $totalRects++
    }
    $x = $x2
  }
  # Close any rect whose run did not continue on this row.
  foreach ($key in @($openRects.Keys)) {
    if (-not $rowKeys.ContainsKey($key)) {
      Close-Rect $openRects[$key] $y
      $openRects.Remove($key)
    }
  }
}
# Rects still open ran through the final row.
foreach ($key in @($openRects.Keys)) {
  Close-Rect $openRects[$key] $H
}

# --- Emit flat.svg deterministically ---------------------------------------------------
# Group order = colour hex ascending; rect order within a group = (y, x) ascending.
$svgOut = New-Object System.Text.StringBuilder
$nl = "`n"
[void]$svgOut.Append('<?xml version="1.0" encoding="UTF-8"?>' + $nl)
[void]$svgOut.Append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + $W + ' ' + $H + '"' +
  ' width="' + $W + '" height="' + $H + '"' +
  ' data-render-method="quantized-color-rle"' +
  ' data-source-bounds="' + $minX + ',' + $minY + ',' + $maxX + ',' + $maxY + '"' +
  ' data-palette-size="' + $rectsByColor.Count + '">' + $nl)

$sortedColors = @($rectsByColor.Keys | Sort-Object)
foreach ($hex in $sortedColors) {
  [void]$svgOut.Append('  <g data-color="' + $hex + '">' + $nl)
  $rects = $rectsByColor[$hex]
  $ordered = @($rects | Sort-Object @{ Expression = { [int]($_ -split ' ')[1] } }, @{ Expression = { [int]($_ -split ' ')[0] } })
  foreach ($tuple in $ordered) {
    $parts = $tuple -split ' '
    [void]$svgOut.Append('    <rect x="' + $parts[0] + '" y="' + $parts[1] + '" width="' + $parts[2] + '" height="' + $parts[3] + '" fill="' + $hex + '"/>' + $nl)
  }
  [void]$svgOut.Append('  </g>' + $nl)
}
[void]$svgOut.Append('</svg>' + $nl)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resolvedOut, $svgOut.ToString(), $utf8NoBom)

$reduction = 1 - ($totalRects / $opaque)
Write-Host "Wrote $resolvedOut"
Write-Host ("Source            : {0} ({1}x{2})" -f $resolvedSource, $W, $H)
Write-Host ("Opaque pixels     : {0}" -f $opaque)
Write-Host ("Distinct src RGB  : {0}" -f $uniqueColors.Count)
Write-Host ("Palette size      : {0} (requested {1})" -f $rectsByColor.Count, $Colors)
Write-Host ("Rects emitted     : {0}" -f $totalRects)
Write-Host ("Reduction vs px   : {0:P1}" -f $reduction)
Write-Host ("Opaque bounds     : {0},{1},{2},{3}" -f $minX, $minY, $maxX, $maxY)
foreach ($hex in $sortedColors) {
  Write-Host ("  {0}  rects={1}" -f $hex, $rectsByColor[$hex].Count)
}
