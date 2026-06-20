param(
  [string]$FlatPath = "docs/buildable-slice/generated/devbrain-flat.svg"
)

# Structural checks for the Phase 1 generated flat.svg (PNG -> colour-clustered geometry).
# Independent of check-buildable-slice.ps1; it does NOT touch the Manual Part SVG, rigged.json,
# the emitters, or any golden. See ADR-0009 for why flat.svg is quantized colour clusters.

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  throw "flat.svg check failed: $Message"
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { Fail $Message }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([System.IO.Path]::IsPathRooted($FlatPath)) { $resolved = $FlatPath } else { $resolved = Join-Path $repoRoot $FlatPath }
Assert-True (Test-Path -LiteralPath $resolved -PathType Leaf) "Missing flat.svg: $resolved"

try {
  [xml]$svg = Get-Content -Raw -LiteralPath $resolved
} catch {
  Fail "Could not parse flat.svg as XML. $($_.Exception.Message)"
}
$root = $svg.DocumentElement

# --- Root contract -----------------------------------------------------------------------
Assert-True ($root.LocalName -eq "svg") "Root element must be <svg>."
Assert-True ($root.GetAttribute("viewBox") -eq "0 0 192 192") "flat.svg must use viewBox='0 0 192 192'."
Assert-True ($root.GetAttribute("width") -eq "192") "flat.svg width must equal source px (192)."
Assert-True ($root.GetAttribute("height") -eq "192") "flat.svg height must equal source px (192)."
Assert-True ($root.GetAttribute("data-render-method") -eq "quantized-color-rle") "flat.svg must record data-render-method='quantized-color-rle'."

$bounds = $root.GetAttribute("data-source-bounds")
Assert-True ($bounds -match "^\d+,\d+,\d+,\d+$") "flat.svg must carry data-source-bounds 'minX,minY,maxX,maxY'."
$b = $bounds -split ","
$minX = [int]$b[0]; $minY = [int]$b[1]; $maxX = [int]$b[2]; $maxY = [int]$b[3]
Assert-True ($minX -lt $maxX -and $minY -lt $maxY) "data-source-bounds must describe a non-empty box."

# --- No curves: pixel-exact rect geometry only ------------------------------------------
Assert-True ($svg.SelectNodes("//*[local-name()='path']").Count -eq 0) "flat.svg must contain zero <path> (no curve-fitting)."
Assert-True ($svg.SelectNodes("//*[local-name()='circle' or local-name()='ellipse' or local-name()='polygon' or local-name()='polyline']").Count -eq 0) "flat.svg must contain only <rect> geometry."

# --- Colour clusters: one <g data-color> per colour, rects nested + matching fill --------
$groups = @($svg.SelectNodes("//*[local-name()='g']"))
Assert-True ($groups.Count -ge 1) "flat.svg must include at least one <g data-color> colour cluster."

$seenColors = @{}
$rectTotal = 0
$gMinX = [int]::MaxValue; $gMinY = [int]::MaxValue; $gMaxX = -1; $gMaxY = -1
foreach ($g in $groups) {
  $color = $g.GetAttribute("data-color")
  Assert-True ($color -match "^#[0-9a-f]{6}$") "Each <g> must carry data-color='#rrggbb' (lowercase). Got '$color'."
  Assert-True (-not $seenColors.ContainsKey($color)) "Duplicate colour group '$color' — there must be exactly one <g> per colour."
  $seenColors[$color] = $true

  $rects = @($g.SelectNodes("./*[local-name()='rect']"))
  Assert-True ($rects.Count -ge 1) "Colour group '$color' must contain at least one <rect>."
  foreach ($rect in $rects) {
    Assert-True ($rect.GetAttribute("fill") -eq $color) "A <rect> in group '$color' has a mismatched fill '$($rect.GetAttribute("fill"))'."
    $x = [int]$rect.GetAttribute("x"); $y = [int]$rect.GetAttribute("y")
    $w = [int]$rect.GetAttribute("width"); $h = [int]$rect.GetAttribute("height")
    Assert-True ($w -ge 1 -and $h -ge 1) "Every <rect> must have positive width/height."
    # No geometry over the fully-transparent margin: rects stay inside the visible bounds box.
    Assert-True ($x -ge $minX -and $y -ge $minY -and ($x + $w) -le ($maxX + 1) -and ($y + $h) -le ($maxY + 1)) "A <rect> at ($x,$y,$w,$h) falls outside data-source-bounds [$bounds] — geometry must not cover transparent pixels."
    if ($x -lt $gMinX) { $gMinX = $x }
    if ($y -lt $gMinY) { $gMinY = $y }
    if (($x + $w) -gt $gMaxX) { $gMaxX = $x + $w }
    if (($y + $h) -gt $gMaxY) { $gMaxY = $y + $h }
    $rectTotal++
  }
}

# Coverage reaches the recorded visible bounds (geometry isn't a shrunken subset).
Assert-True ($gMinX -eq $minX -and $gMinY -eq $minY) "Geometry top-left must reach the visible bounds origin ($minX,$minY)."
Assert-True (($gMaxX - 1) -eq $maxX -and ($gMaxY - 1) -eq $maxY) "Geometry must extend to the visible bounds extent ($maxX,$maxY)."

# --- Greedy meshing actually worked: rect count well below 1-per-opaque-pixel ------------
# The source has ~7.1k opaque pixels; a working RLE+greedy-mesh must be a small fraction.
Assert-True ($rectTotal -ge 1) "flat.svg must contain at least one <rect>."
Assert-True ($rectTotal -lt 2000) "flat.svg rect count ($rectTotal) is too high — greedy meshing is not collapsing runs."

Write-Host "flat.svg structural checks passed."
Write-Host ("  colours : {0}" -f $seenColors.Count)
Write-Host ("  rects   : {0}" -f $rectTotal)
Write-Host ("  bounds  : {0}" -f $bounds)
