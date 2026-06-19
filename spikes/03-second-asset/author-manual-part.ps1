param(
  [string]$FlatPath = "spikes/03-second-asset/generated/land-rover-flat.svg",
  [string]$OutSvg   = "spikes/03-second-asset/generated/land-rover-manual-part.svg"
)
# ponytail: the ADR-0002 human-confirm step, executed as a region map instead of clicking 2661
# rects. I (the human in the loop) define a bounding box per part in 256-space from the rendered
# asset; each flat <rect> is assigned to the FIRST matching region by its centre, else to body.
# Reuses the LOCKED DevBrain part-id vocabulary as generic slots (both emitters hardcode these ids:
# the React PART_IDS namespacing list + the segmenter vocab), remapped to Land Rover anatomy:
#   part-body=cabin/hood   part-leg-left=front wheel   part-leg-right=rear wheel
#   part-antenna=flag      part-eyes=headlight eyes     part-moustache=front grille
# Pivots/origins are computed from each assembled part's real bbox so pivot==origin to the
# 0.5%-bbox tolerance the React emitter asserts (emit.ts assertPivotAgreesWithOrigin).
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
function Resolve-P { param($p) if ([System.IO.Path]::IsPathRooted($p)) { return $p } return (Join-Path $repoRoot $p) }
$flat = Resolve-P $FlatPath; $out = Resolve-P $OutSvg

# Region boxes (x0,y0,x1,y1) in 256-space; checked in this order, first centre-hit wins.
$regions = @(
  @{ part = "part-antenna";   bone = "antenna";   box = @(28, 36, 98, 108);  origin = "base" },   # flag on pole
  @{ part = "part-eyes";      bone = "body";      box = @(96, 130, 170, 170); origin = "center" }, # headlight eyes
  @{ part = "part-moustache"; bone = "moustache"; box = @(104, 150, 152, 196); origin = "center" },# grille
  @{ part = "part-leg-left";  bone = "leg_left";  box = @(92, 176, 172, 236); origin = "center" },  # front wheel
  @{ part = "part-leg-right"; bone = "leg_right"; box = @(176, 176, 242, 236); origin = "center" }  # rear wheel
)
# body is the implicit fallback for every rect not claimed above.

[xml]$doc = Get-Content -Raw -LiteralPath $flat
$rectNodes = @($doc.SelectNodes("//*[local-name()='rect']"))
$vw = [int]$doc.DocumentElement.GetAttribute("width")
$vh = [int]$doc.DocumentElement.GetAttribute("height")

$bucket = @{}
foreach ($key in (@("part-body") + ($regions | ForEach-Object { $_.part }))) {
  $bucket[$key] = New-Object System.Collections.Generic.List[object]
}
foreach ($r in $rectNodes) {
  $x = [double]$r.GetAttribute("x"); $y = [double]$r.GetAttribute("y")
  $w = [double]$r.GetAttribute("width"); $h = [double]$r.GetAttribute("height")
  $cx = $x + $w / 2.0; $cy = $y + $h / 2.0
  $assigned = "part-body"
  foreach ($reg in $regions) {
    $b = $reg.box
    if ($cx -ge $b[0] -and $cx -le $b[2] -and $cy -ge $b[1] -and $cy -le $b[3]) { $assigned = $reg.part; break }
  }
  $bucket[$assigned].Add([PSCustomObject]@{ X = $x; Y = $y; W = $w; H = $h; Fill = $r.GetAttribute("fill") }) | Out-Null
}

function Get-Origin { param($mode, $rects)
  $minX = ($rects | Measure-Object X -Minimum).Minimum
  $minY = ($rects | Measure-Object Y -Minimum).Minimum
  $maxX = ($rects | ForEach-Object { $_.X + $_.W } | Measure-Object -Maximum).Maximum
  $maxY = ($rects | ForEach-Object { $_.Y + $_.H } | Measure-Object -Maximum).Maximum
  $bw = $maxX - $minX; $bh = $maxY - $minY
  if ($mode -eq "base") { $px = ($minX + $maxX) / 2.0; $py = [double]$maxY }
  else { $px = ($minX + $maxX) / 2.0; $py = ($minY + $maxY) / 2.0 }
  $ox = [Math]::Round((($px - $minX) / $bw) * 100, 2)
  $oy = [Math]::Round((($py - $minY) / $bh) * 100, 2)
  return [PSCustomObject]@{ PivotX = [Math]::Round($px, 2); PivotY = [Math]::Round($py, 2); OriginX = $ox; OriginY = $oy }
}

# Emit order = document order DevBrain uses: legs, body, eyes(+rest). Order only affects React
# bbox slicing (each id sliced to the next id), so each part group must be contiguous — it is.
$emitOrder = @(
  @{ part = "part-leg-left";  bone = "leg_left";  mode = "center" },
  @{ part = "part-leg-right"; bone = "leg_right"; mode = "center" },
  @{ part = "part-body";      bone = "body";      mode = "center" },
  @{ part = "part-antenna";   bone = "antenna";   mode = "base" },
  @{ part = "part-moustache"; bone = "moustache"; mode = "center" },
  @{ part = "part-eyes";      bone = "body";      mode = "center" }
)

$nl = "`n"; $sb = New-Object System.Text.StringBuilder
[void]$sb.Append('<?xml version="1.0" encoding="UTF-8"?>' + $nl)
[void]$sb.Append('<?xml-stylesheet type="text/css" href="land-rover-svg-css.css"?>' + $nl)
[void]$sb.Append('<svg id="mascot" data-state="idle" data-render-method="source-pixel-rle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + $vw + ' ' + $vh + '" role="img" aria-labelledby="title desc">' + $nl)
[void]$sb.Append('  <title id="title">Land Rover Series III Manual Part SVG (Spike 03 second-asset validation)</title>' + $nl)
[void]$sb.Append('  <desc id="desc">Second-asset rig: DevBrain part-id slots remapped to Land Rover anatomy (cabin/wheels/flag/eyes/grille).</desc>' + $nl)
[void]$sb.Append('  <g id="rig-root">' + $nl)

$report = @()
foreach ($e in $emitOrder) {
  $rects = $bucket[$e.part]
  if ($rects.Count -eq 0) { throw "Part $($e.part) got 0 rects — widen its region box." }
  $o = Get-Origin $e.mode $rects
  $report += [PSCustomObject]@{ Part = $e.part; Bone = $e.bone; Rects = $rects.Count; Origin = "$($o.OriginX)% $($o.OriginY)%"; PivotX = $o.PivotX; PivotY = $o.PivotY }
  [void]$sb.Append('    <g id="' + $e.part + '" class="part" data-bone="' + $e.bone + '" data-origin="' + $o.OriginX + '% ' + $o.OriginY + '%" data-pivot-x="' + $o.PivotX + '" data-pivot-y="' + $o.PivotY + '">' + $nl)
  foreach ($r in ($rects | Sort-Object Y, X)) {
    [void]$sb.Append('      <rect x="' + $r.X + '" y="' + $r.Y + '" width="' + $r.W + '" height="' + $r.H + '" fill="' + $r.Fill + '"/>' + $nl)
  }
  [void]$sb.Append('    </g>' + $nl)
}
[void]$sb.Append('  </g>' + $nl + '</svg>' + $nl)
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($out, $sb.ToString(), $utf8)
Write-Host "Wrote $out  (viewBox 0 0 $vw $vh)"
$report | Format-Table -AutoSize | Out-String | Write-Host
Write-Host "Paste-ready parts pivots/origins above into land-rover-rigged.json."
