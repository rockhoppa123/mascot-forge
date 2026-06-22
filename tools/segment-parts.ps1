# LEGACY / batch-only (ADR-0011 + ease-and-quality plan P3). The CANONICAL segmenter is now the browser
# module tools/rig-editor/segment.js (cross-platform, node-tested, what the editor + product use). This
# PowerShell port is kept only for the `mf forge` terminal/batch path; do not add features here —
# change segment.js and mirror if needed.
param(
  [string]$FlatPath = "docs/buildable-slice/generated/devbrain-flat.svg",
  [string]$Out = "docs/buildable-slice/generated/devbrain-segmented.svg",
  [string]$Html = "docs/buildable-slice/generated/devbrain-segmented-review.html",
  # Optional per-asset taxonomy; default "" runs the existing DevBrain heuristic unchanged.
  [string]$Spec = "",
  # Locked ground-truth, read-only — used only to print a recovery + pivot-delta report.
  [string]$RiggedPath = "docs/buildable-slice/devbrain-rigged.json",
  # Scale guard (v1.2 / W4a). The CCL union below is O(n^2) over n flat rects. n=89 (DevBrain)
  # is instant; n=3540 (Land Rover, 256^2) takes ~49 s; a native-resolution source (1024^2 →
  # tens of thousands of rects) would grind for minutes. Above this cap we fail fast with an
  # actionable message instead of hanging. 8000 sits above Land Rover and below a blow-up.
  [int]$MaxRects = 8000
)

# Phase 2 (Assisted Semantic Segmentation) — PROPOSE named parts from flat.svg for a human
# to confirm (ADR-0002: assisted, not full-auto). Method per research-log Q2 / proposal §3:
# colour-threshold (already done by Phase 1's palette) -> connected-component labeling over
# the flat.svg <rect> geometry -> name candidate parts by geometry -> default pivot at the
# joint where a part meets its parent. NO ML/SAM/VLM (deterministic only).
#
# Reads the generated flat.svg READ-ONLY. Does NOT touch the Manual Part SVG, rigged.json
# (only read for the report), the emitters, or any golden.
#
# ponytail: naming rules are tuned to the single DevBrain mascot (the only v1 input). They
# generalise the day a second mascot exists; until then a heuristic per part is cheaper and
# more honest than a classifier. Friction is reported, not hidden.

$ErrorActionPreference = "Stop"

function Fail { param([string]$Message) throw "Segmenter failed: $Message" }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
function Resolve-RepoPath { param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path $repoRoot $Path)
}

$resolvedFlat = Resolve-RepoPath $FlatPath
if (-not (Test-Path -LiteralPath $resolvedFlat -PathType Leaf)) { Fail "flat.svg not found (read-only input): $resolvedFlat" }
$resolvedOutSvg = Resolve-RepoPath $Out
$resolvedOutHtml = Resolve-RepoPath $Html
$resolvedRigged = Resolve-RepoPath $RiggedPath

# Load per-asset spec if provided; otherwise existing heuristic runs unchanged (ADR-0010).
$hintToId = @{}
$specVocab = $null
if ($Spec -ne "") {
  $resolvedSpec = Resolve-RepoPath $Spec
  if (-not (Test-Path -LiteralPath $resolvedSpec -PathType Leaf)) { Fail "-Spec file not found: $resolvedSpec" }
  $specData = Get-Content -Raw -LiteralPath $resolvedSpec | ConvertFrom-Json
  foreach ($p in $specData.parts) { $hintToId[$p.hint] = $p.id }
  $specVocab = @($specData.parts | ForEach-Object { $_.id })
}
function Get-PartId { param([string]$Hint, [string]$Default)
  if ($hintToId.ContainsKey($Hint)) { return $hintToId[$Hint] } else { return $Default }
}

$flatRaw = Get-Content -Raw -LiteralPath $resolvedFlat
try { [xml]$flat = $flatRaw } catch { Fail "Could not parse flat.svg as XML. $($_.Exception.Message)" }

# Canvas size: spec wins; fall back to flat.svg root attr (W3a — ADR-0010).
if ($specVocab -ne $null) {
  $vbSize = [int]$specData.viewBoxSize
} elseif ($flat.svg.viewBox) {
  $vbSize = [int](($flat.svg.viewBox -split ' ')[2])
} elseif ($flat.svg.width) {
  $vbSize = [int]$flat.svg.width
} else {
  Fail "flat.svg has no viewBox or width attribute — cannot determine canvas size"
}

# --- Read every <rect> (x,y,w,h,colour) from flat.svg ------------------------------------
$rectNodes = @($flat.SelectNodes("//*[local-name()='rect']"))
if ($rectNodes.Count -eq 0) { Fail "flat.svg contains no <rect> geometry." }

$rects = New-Object System.Collections.Generic.List[object]
$id = 0
foreach ($r in $rectNodes) {
  $x = [int]$r.GetAttribute("x"); $y = [int]$r.GetAttribute("y")
  $w = [int]$r.GetAttribute("width"); $h = [int]$r.GetAttribute("height")
  $rects.Add([PSCustomObject]@{
    Id = $id; X = $x; Y = $y; W = $w; H = $h; Color = $r.GetAttribute("fill")
    MinX = $x; MinY = $y; MaxX = $x + $w; MaxY = $y + $h; Area = $w * $h
    CX = $x + $w / 2.0; CY = $y + $h / 2.0
  }) | Out-Null
  $id++
}
$n = $rects.Count

# Scale guard (v1.2 / W4a) — refuse to silently grind on an over-large flat.svg. Fires before
# the O(n^2) union below, so the failure is instant, not after minutes.
if ($n -gt $MaxRects) {
  Fail ("flat.svg has $n rects (> -MaxRects $MaxRects). The segmenter's CCL union is O(n^2) and " +
    "would take minutes at this size. Downscale the source with nearest-neighbor before vectorizing " +
    "(see spikes/03-second-asset/prep-source.ps1 and ADR-0009), or raise -MaxRects deliberately.")
}

# --- Connected-component labeling: union same-colour rects that touch (8-adjacency) -------
# ponytail: O(n^2) pairwise union; guarded by -MaxRects. Replace with a grid/sweep (W4b) only if a
# non-downscalable asset genuinely needs >8000 rects and profiling confirms this is the bottleneck.
$parent = 0..($n - 1)
function Find-Root { param([int]$i) while ($parent[$i] -ne $i) { $parent[$i] = $parent[$parent[$i]]; $i = $parent[$i] }; return $i }
function Union-Set { param([int]$a, [int]$b) $ra = Find-Root $a; $rb = Find-Root $b; if ($ra -ne $rb) { $parent[$ra] = $rb } }

function Test-Adjacent { param($a, $b)
  # 8-connected: expand a by 1px and test overlap with b (pixel boxes, MaxX/MaxY exclusive).
  return (($a.MinX - 1) -lt $b.MaxX) -and ($b.MinX -lt ($a.MaxX + 1)) -and `
         (($a.MinY - 1) -lt $b.MaxY) -and ($b.MinY -lt ($a.MaxY + 1))
}

for ($i = 0; $i -lt $n; $i++) {
  for ($j = $i + 1; $j -lt $n; $j++) {
    if ($rects[$i].Color -eq $rects[$j].Color -and (Test-Adjacent $rects[$i] $rects[$j])) { Union-Set $i $j }
  }
}

# --- Collapse rects into blobs (one per component) ---------------------------------------
$blobMap = @{}
foreach ($r in $rects) {
  $root = Find-Root $r.Id
  if (-not $blobMap.ContainsKey($root)) {
    $blobMap[$root] = [PSCustomObject]@{
      Rects = (New-Object System.Collections.Generic.List[object])
      MinX = [int]::MaxValue; MinY = [int]::MaxValue; MaxX = -1; MaxY = -1
      Area = 0; SumCX = 0.0; SumCY = 0.0; Part = $null
    }
  }
  $bl = $blobMap[$root]
  $bl.Rects.Add($r) | Out-Null
  if ($r.MinX -lt $bl.MinX) { $bl.MinX = $r.MinX }
  if ($r.MinY -lt $bl.MinY) { $bl.MinY = $r.MinY }
  if ($r.MaxX -gt $bl.MaxX) { $bl.MaxX = $r.MaxX }
  if ($r.MaxY -gt $bl.MaxY) { $bl.MaxY = $r.MaxY }
  $bl.Area += $r.Area
  $bl.SumCX += $r.CX * $r.Area
  $bl.SumCY += $r.CY * $r.Area
}
# Stable ordering: by (MinY, MinX) so component identity never depends on hash order.
$blobs = @($blobMap.Values | ForEach-Object {
  $_ | Add-Member -NotePropertyName CenX -NotePropertyValue ($_.SumCX / $_.Area) -PassThru |
       Add-Member -NotePropertyName CenY -NotePropertyValue ($_.SumCY / $_.Area) -PassThru
} | Sort-Object MinY, MinX)

# --- Name parts by geometry (deterministic rules, applied in fixed order) -----------------
# 1. body  = largest-area blob (the orange mass).
# 2. legs  = blobs protruding BELOW the body (split left/right by centre x).
# 3. antenna = blobs protruding ABOVE the body top (green tip + dark stalk).
# 4. eyes  = the two largest remaining island blobs sitting inside the upper body.
# 5. moustache = (expected) unrecovered: same colour as body, spatially fused. Reported.
# 6. leftover slivers absorbed into the nearest adjacent named part.
$body = $blobs | Sort-Object @{ E = { $_.Area }; Descending = $true }, MinY, MinX | Select-Object -First 1
$body.Part = Get-PartId "largest-blob" "part-body"

$rest = @($blobs | Where-Object { $_ -ne $body })

$legBlobs = @($rest | Where-Object { $_.MaxY -gt $body.MaxY } | Sort-Object CenX)
if ($legBlobs.Count -ge 1) { $legBlobs[0].Part = Get-PartId "below-body-left" "part-leg-left" }
if ($legBlobs.Count -ge 2) { $legBlobs[-1].Part = Get-PartId "below-body-right" "part-leg-right" }

$antennaBlobs = @($rest | Where-Object { $_.Part -eq $null -and $_.MinY -lt $body.MinY })
foreach ($a in $antennaBlobs) { $a.Part = Get-PartId "above-body" "part-antenna" }

$bodyMidY = ($body.MinY + $body.MaxY) / 2.0
$eyeCandidates = @($rest | Where-Object {
  $_.Part -eq $null -and $_.CenY -lt $bodyMidY -and
  $_.MinX -ge $body.MinX -and $_.MaxX -le $body.MaxX -and $_.MinY -ge $body.MinY -and $_.MaxY -le $body.MaxY
} | Sort-Object @{ E = { $_.Area }; Descending = $true }, MinY, MinX)
$eyeBlobs = @($eyeCandidates | Select-Object -First 2)
foreach ($e in $eyeBlobs) { $e.Part = Get-PartId "colour-island-upper" "part-eyes" }

# Absorb leftover slivers (anti-alias edges) into the nearest named blob, preferring an
# adjacent one. Keeps 100% of flat geometry inside a named part (no orphan rects).
$named = @($blobs | Where-Object { $_.Part -ne $null })
$leftover = @($blobs | Where-Object { $_.Part -eq $null })
foreach ($lo in $leftover) {
  $adj = @($named | Where-Object {
    $bn = $_
    @($lo.Rects | Where-Object { $r = $_; @($bn.Rects | Where-Object { Test-Adjacent $r $_ }).Count -gt 0 }).Count -gt 0
  })
  $pool = if ($adj.Count -gt 0) { $adj } else { $named }
  $pick = $pool | Sort-Object @{ E = { [Math]::Sqrt(($_.CenX - $lo.CenX) * ($_.CenX - $lo.CenX) + ($_.CenY - $lo.CenY) * ($_.CenY - $lo.CenY)) } }, MinY, MinX | Select-Object -First 1
  $lo.Part = $pick.Part
  foreach ($r in $lo.Rects) { $pick.Rects.Add($r) | Out-Null }
  if ($lo.MinX -lt $pick.MinX) { $pick.MinX = $lo.MinX }
  if ($lo.MinY -lt $pick.MinY) { $pick.MinY = $lo.MinY }
  if ($lo.MaxX -gt $pick.MaxX) { $pick.MaxX = $lo.MaxX }
  if ($lo.MaxY -gt $pick.MaxY) { $pick.MaxY = $lo.MaxY }
}

# --- Merge blobs sharing a part id into final parts, then compute the proposed pivot ------
function Format-Num { param([double]$v)
  $r = [Math]::Round($v, 2)
  if ($r -eq [Math]::Floor($r)) { return [string][int]$r }
  return ([string]$r)
}

# Pivot heuristic = the joint where the part meets its parent (proposal §3):
#  - leg  protrudes down  -> top edge centre (the hip line).
#  - antenna protrudes up -> base centre (lowest row, where it meets the head).
#  - island/body          -> bounding-box centre.
function Get-Pivot { param($part, $rectsList)
  $minX = ($rectsList | Measure-Object MinX -Minimum).Minimum
  $minY = ($rectsList | Measure-Object MinY -Minimum).Minimum
  $maxX = ($rectsList | Measure-Object MaxX -Maximum).Maximum
  $maxY = ($rectsList | Measure-Object MaxY -Maximum).Maximum
  switch -Wildcard ($part) {
    "part-leg-*" {
      $topRow = @($rectsList | Where-Object { $_.MinY -eq $minY })
      $tMin = ($topRow | Measure-Object MinX -Minimum).Minimum
      $tMax = ($topRow | Measure-Object MaxX -Maximum).Maximum
      return @{ X = ($minX + $maxX) / 2.0; Y = [double]$minY }  # bbox centre-x at the hip line
    }
    "part-antenna" {
      $botRow = @($rectsList | Where-Object { $_.MaxY -eq $maxY })
      $bMin = ($botRow | Measure-Object MinX -Minimum).Minimum
      $bMax = ($botRow | Measure-Object MaxX -Maximum).Maximum
      return @{ X = ($bMin + $bMax) / 2.0; Y = [double]$maxY }
    }
    default { return @{ X = ($minX + $maxX) / 2.0; Y = ($minY + $maxY) / 2.0 } }
  }
}

# Fixed output order = accepted part vocabulary; moustache last (may be absent).
$tint = @{
  "part-body" = "#c9ced1"; "part-leg-left" = "#ff7f0e"; "part-leg-right" = "#1f77b4"
  "part-antenna" = "#2ca02c"; "part-eyes" = "#d62728"; "part-moustache" = "#9467bd"
}
if ($specVocab -ne $null) {
  $vocab = $specVocab
  $extraColors = @("#e377c2","#7f7f7f","#bcbd22","#17becf","#aec7e8","#ffbb78")
  $ec = 0
  foreach ($vid in $vocab) { if (-not $tint.ContainsKey($vid)) { $tint[$vid] = $extraColors[$ec % $extraColors.Count]; $ec++ } }
} else {
  $vocab = @("part-body", "part-leg-left", "part-leg-right", "part-antenna", "part-eyes", "part-moustache")
}

$parts = New-Object System.Collections.Generic.List[object]
foreach ($partId in $vocab) {
  $pieceRects = New-Object System.Collections.Generic.List[object]
  foreach ($bl in $named) { if ($bl.Part -eq $partId) { foreach ($r in $bl.Rects) { $pieceRects.Add($r) | Out-Null } } }
  if ($pieceRects.Count -eq 0) { continue }
  $piv = Get-Pivot $partId $pieceRects
  $parts.Add([PSCustomObject]@{
    Id = $partId; Rects = $pieceRects; PivotX = $piv.X; PivotY = $piv.Y
    PivotStr = (Format-Num $piv.X) + "," + (Format-Num $piv.Y)
  }) | Out-Null
}

# --- Emit devbrain-segmented.svg (tinted proposal + data-part + data-pivot) ---------------
$nl = "`n"
$svg = New-Object System.Text.StringBuilder
[void]$svg.Append('<?xml version="1.0" encoding="UTF-8"?>' + $nl)
[void]$svg.Append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + $vbSize + ' ' + $vbSize + '" width="' + $vbSize + '" height="' + $vbSize + '"' +
  ' data-render-method="ccl-color-threshold" data-source="' + $FlatPath + '"' +
  ' data-parts="' + $parts.Count + '">' + $nl)
foreach ($p in $parts) {
  [void]$svg.Append('  <g data-part="' + $p.Id + '" data-pivot="' + $p.PivotStr + '" fill="' + $tint[$p.Id] + '">' + $nl)
  $ordered = @($p.Rects | Sort-Object Y, X)
  foreach ($r in $ordered) {
    [void]$svg.Append('    <rect x="' + $r.X + '" y="' + $r.Y + '" width="' + $r.W + '" height="' + $r.H + '" fill="' + $tint[$p.Id] + '"/>' + $nl)
  }
  [void]$svg.Append('  </g>' + $nl)
}
# Decorative pivot markers (data-role, ignored by the structural check).
[void]$svg.Append('  <g data-role="pivot-markers" fill="none" stroke="#111" stroke-width="0.6">' + $nl)
foreach ($p in $parts) {
  [void]$svg.Append('    <circle cx="' + (Format-Num $p.PivotX) + '" cy="' + (Format-Num $p.PivotY) + '" r="2.5"/>' + $nl)
}
[void]$svg.Append('  </g>' + $nl)
[void]$svg.Append('</svg>' + $nl)
$segSvg = $svg.ToString()

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resolvedOutSvg, $segSvg, $utf8NoBom)

# --- Emit a minimal, dependency-free confirm UI (ADR-0002) -------------------------------
# Self-contained HTML: original flat.svg beside the tinted proposal, a part/pivot checklist
# the human ticks to confirm, and the friction note. No npm, no server — opens via file://.
function Strip-XmlDecl { param([string]$s) return ($s -replace '<\?xml[^>]*\?>\s*', '') }
$flatInline = Strip-XmlDecl $flatRaw
$segInline = Strip-XmlDecl $segSvg

$rows = New-Object System.Text.StringBuilder
foreach ($p in $parts) {
  [void]$rows.Append('      <li><label><input type="checkbox" class="confirm" checked> <b style="color:' + $tint[$p.Id] + '">' +
    $p.Id + '</b> &mdash; proposed pivot <code>' + $p.PivotStr + '</code></label></li>' + $nl)
}
$missing = @($vocab | Where-Object { $vid = $_; -not ($parts | Where-Object { $_.Id -eq $vid }) })
$missingNote = if ($missing.Count -gt 0) {
  '<p class="warn">Not colour-separable (CCL cannot split &mdash; same colour / fused with a neighbour): <b>' +
  ($missing -join ', ') + '</b>. Add by hand or fall back to SAM (ADR-0002).</p>'
} else { '' }

$html = @"
<!doctype html>
<meta charset="utf-8">
<title>DevBrain &mdash; Phase 2 segmentation review</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { font-size: 18px; }
  .panels { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
  .panel { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .panel h2 { font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
  .panel svg { width: 256px; height: 256px; background: #fafafa; border-radius: 4px; }
  ul { list-style: none; padding: 0; }
  li { padding: 2px 0; }
  code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; }
  .warn { background: #fff6e5; border-left: 3px solid #e0a106; padding: 8px 12px; border-radius: 4px; }
  #status { font-weight: 600; }
</style>
<h1>DevBrain mascot &mdash; proposed parts (confirm before Phase 3)</h1>
<p>Deterministic colour-threshold + connected-component proposal. Review the grouping, tick the parts that look right, adjust pivots by hand in <code>devbrain-rigged.json</code>. The tool proposes; you confirm (ADR-0002).</p>
<div class="panels">
  <div class="panel"><h2>Clean source (flat.svg)</h2>$flatInline</div>
  <div class="panel"><h2>Proposed parts</h2>$segInline</div>
  <div class="panel" style="min-width:280px">
    <h2>Confirm parts</h2>
    <ul>
$($rows.ToString())    </ul>
    $missingNote
    <p id="status"></p>
  </div>
</div>
<script>
  const boxes = [...document.querySelectorAll('.confirm')];
  const status = document.getElementById('status');
  function update() {
    const ok = boxes.filter(b => b.checked).length;
    status.textContent = ok + ' / ' + boxes.length + ' parts confirmed';
  }
  boxes.forEach(b => b.addEventListener('change', update));
  update();
</script>
"@
[System.IO.File]::WriteAllText($resolvedOutHtml, $html, $utf8NoBom)

# --- Report: recovery + pivot deltas vs the locked ground truth (read-only) ---------------
Write-Host "Wrote $resolvedOutSvg"
Write-Host "Wrote $resolvedOutHtml"
Write-Host ""
Write-Host "Proposed parts (deterministic CCL):"
foreach ($p in $parts) { Write-Host ("  {0,-16} pivot=({1})  rects={2}" -f $p.Id, $p.PivotStr, $p.Rects.Count) }

if (Test-Path -LiteralPath $resolvedRigged -PathType Leaf) {
  $rigged = Get-Content -Raw -LiteralPath $resolvedRigged | ConvertFrom-Json
  $truth = @{}
  foreach ($tp in $rigged.parts) { $truth[$tp.id] = $tp.pivot }
  Write-Host ""
  Write-Host "Recovery vs locked ground truth (devbrain-rigged.json):"
  $recovered = 0
  foreach ($vid in $vocab) {
    $got = $parts | Where-Object { $_.Id -eq $vid } | Select-Object -First 1
    $gt = $truth[$vid]
    if ($got -and $gt) {
      $recovered++
      $dx = [Math]::Round($got.PivotX - $gt.x, 2); $dy = [Math]::Round($got.PivotY - $gt.y, 2)
      $dist = [Math]::Round([Math]::Sqrt($dx * $dx + $dy * $dy), 2)
      Write-Host ("  [OK]   {0,-16} proposed=({1})  truth=({2},{3})  dpivot=({4},{5}) |{6}px|" -f $vid, $got.PivotStr, (Format-Num $gt.x), (Format-Num $gt.y), $dx, $dy, $dist)
    } elseif ($gt) {
      Write-Host ("  [MISS] {0,-16} not recovered by colour+CCL (truth pivot ({1},{2}))" -f $vid, (Format-Num $gt.x), (Format-Num $gt.y))
    }
  }
  Write-Host ""
  Write-Host ("Recovered {0} / {1} accepted parts." -f $recovered, $truth.Count)
}
