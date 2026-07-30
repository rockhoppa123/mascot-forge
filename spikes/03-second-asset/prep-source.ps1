param(
  [string]$SourceJpg = "",   # required - pass the source photo; no default (it used to be a personal Downloads path)
  [string]$OutPng    = "assets/land-rover/land-rover.png",
  [int]$Size         = 256,   # downscale target; native 1024 is too big for the pixel-RLE vectorizer (DevBrain was 192)
  [int]$SatTol       = 30,    # background is near-grey: max-min channel <= SatTol
  [int]$BrightTol    = 150    # background is bright (checker greys + white sticker border): avg >= BrightTol
)
# ponytail: one-off Step-0 source prep, NOT engine code. Andrew approved keying the checkerboard
# background to transparency (the source is a JPEG with the transparency pattern baked in as opaque
# pixels). Also downscales 1024->256 so the O(W*H) vectorizer / O(n^2) segmenter stay tractable.
# Edge-connected flood fill (4-neighbour, local colour-gradient) removes the background + white
# die-cut border while preserving interior whites (windscreen, flag, headlight eyes).
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
function Resolve-RepoPath { param([string]$p) if ([System.IO.Path]::IsPathRooted($p)) { return $p } return (Join-Path $repoRoot $p) }
$src = $SourceJpg
if (-not $src) { throw "Pass -SourceJpg <path to the source photo>. This spike prepares ONE asset and that file is not in the repo." }
if (-not (Test-Path -LiteralPath $src)) { throw "Source not found: $src" }
$out = Resolve-RepoPath $OutPng
$outDir = Split-Path -Parent $out
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

Add-Type -AssemblyName System.Drawing
$orig = New-Object System.Drawing.Bitmap($src)
$nativeW = $orig.Width; $nativeH = $orig.Height
# High-quality downscale into a 32bpp ARGB canvas.
$bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
# ponytail: NearestNeighbor (not bicubic) on downscale. Bicubic blends flat cartoon greens into
# smooth gradients, which the median-cut quantizer then splits into horizontal colour bands
# ("hatching") in the flat.svg. NN keeps flat colour blocks so vertical runs merge and no banding.
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($orig, 0, 0, $Size, $Size)
$g.Dispose(); $orig.Dispose()

$W = $Size; $H = $Size
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$locked = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $locked.Stride
$bytes = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($locked.Scan0, $bytes, 0, $bytes.Length)

# BFS flood fill from every border pixel; expand to 4-neighbours whose colour is within $Tol of
# the current pixel (max channel diff). Walks the smooth background, stops at the sharp silhouette.
$visited = New-Object bool[] ($W * $H)
$queue = New-Object System.Collections.Generic.Queue[int]
$lastY = $H - 1
$lastX = $W - 1
for ($x = 0; $x -lt $W; $x++) {
  $p = $x;            if (-not $visited[$p]) { $visited[$p] = $true; $queue.Enqueue($p) }
  $p = $lastY * $W + $x; if (-not $visited[$p]) { $visited[$p] = $true; $queue.Enqueue($p) }
}
for ($y = 0; $y -lt $H; $y++) {
  $p = $y * $W;        if (-not $visited[$p]) { $visited[$p] = $true; $queue.Enqueue($p) }
  $p = $y * $W + $lastX; if (-not $visited[$p]) { $visited[$p] = $true; $queue.Enqueue($p) }
}
# A pixel is background if it is near-grey (low saturation) AND bright (checker/white border).
function Test-Bg { param([int]$off)
  $b = $bytes[$off]; $g2 = $bytes[$off + 1]; $r = $bytes[$off + 2]
  $mx = [Math]::Max($r, [Math]::Max($g2, $b))
  $mn = [Math]::Min($r, [Math]::Min($g2, $b))
  $avg = ($r + $g2 + $b) / 3
  return (($mx - $mn) -le $SatTol -and $avg -ge $BrightTol)
}
$cleared = 0
while ($queue.Count -gt 0) {
  $p = $queue.Dequeue()
  $x = $p % $W; $y = [int][Math]::Floor($p / $W)
  $i = $y * $stride + $x * 4
  $bytes[$i + 3] = 0   # clear alpha -> transparent
  $cleared++
  foreach ($d in @(@(1, 0), @(-1, 0), @(0, 1), @(0, -1))) {
    $nx = $x + $d[0]; $ny = $y + $d[1]
    if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $W -or $ny -ge $H) { continue }
    $np = $ny * $W + $nx
    if ($visited[$np]) { continue }
    $ni = $ny * $stride + $nx * 4
    if (Test-Bg $ni) { $visited[$np] = $true; $queue.Enqueue($np) }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $locked.Scan0, $bytes.Length)
$bmp.UnlockBits($locked)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$opaque = ($W * $H) - $cleared
Write-Host ("Native source   : {0}x{1}" -f $nativeW, $nativeH)
Write-Host ("Downscaled to   : {0}x{1}" -f $W, $H)
Write-Host ("Background cleared (transparent): {0} px" -f $cleared)
Write-Host ("Opaque (mascot) : {0} px" -f $opaque)
Write-Host ("Wrote {0}" -f $out)
