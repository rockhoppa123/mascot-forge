param(
  [string]$SegmentedPath = "docs/buildable-slice/generated/devbrain-segmented.svg",
  [string]$FlatPath = "docs/buildable-slice/generated/devbrain-flat.svg"
)

# Structural checks for the Phase 2 proposed-segmentation artifact (devbrain-segmented.svg).
# Independent of check-flat-svg.ps1 / check-buildable-slice.ps1; it does NOT touch the Manual
# Part SVG, rigged.json, the emitters, or any golden. See ADR-0002 (assisted, not full-auto).

$ErrorActionPreference = "Stop"

function Fail { param([string]$Message) throw "segmented.svg check failed: $Message" }
function Assert-True { param([bool]$Condition, [string]$Message) if (-not $Condition) { Fail $Message } }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
function Resolve-RepoPath { param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path } else { return (Join-Path $repoRoot $Path) }
}
$resolved = Resolve-RepoPath $SegmentedPath
$resolvedFlat = Resolve-RepoPath $FlatPath
Assert-True (Test-Path -LiteralPath $resolved -PathType Leaf) "Missing segmented.svg: $resolved"
Assert-True (Test-Path -LiteralPath $resolvedFlat -PathType Leaf) "Missing flat.svg (coverage baseline): $resolvedFlat"

try { [xml]$svg = Get-Content -Raw -LiteralPath $resolved } catch { Fail "Could not parse segmented.svg as XML. $($_.Exception.Message)" }
$root = $svg.DocumentElement

# --- Root contract: same canvas as flat.svg, declared CCL method -------------------------
Assert-True ($root.LocalName -eq "svg") "Root element must be <svg>."
Assert-True ($root.GetAttribute("viewBox") -eq "0 0 192 192") "segmented.svg must reuse viewBox='0 0 192 192'."
Assert-True ($root.GetAttribute("data-render-method") -eq "ccl-color-threshold") "segmented.svg must record data-render-method='ccl-color-threshold' (deterministic, no ML)."

# --- Part groups: ids from the accepted vocabulary, unique, each with a valid pivot -------
$vocab = @("part-body", "part-leg-left", "part-leg-right", "part-antenna", "part-eyes", "part-moustache")
$partGroups = @($svg.SelectNodes("//*[local-name()='g'][@data-part]"))
Assert-True ($partGroups.Count -ge 1) "segmented.svg must contain at least one <g data-part>."

$seen = @{}
$order = @()
foreach ($g in $partGroups) {
  $part = $g.GetAttribute("data-part")
  Assert-True ($vocab -contains $part) "Unknown part id '$part' — must be one of the accepted vocabulary."
  Assert-True (-not $seen.ContainsKey($part)) "Duplicate part group '$part' — each part appears once."
  $seen[$part] = $true
  $order += $part

  $pivot = $g.GetAttribute("data-pivot")
  Assert-True ($pivot -match "^-?\d+(\.\d+)?,-?\d+(\.\d+)?$") "Part '$part' must carry data-pivot='x,y'. Got '$pivot'."
  $pv = $pivot -split ","
  $px = [double]$pv[0]; $py = [double]$pv[1]
  Assert-True ($px -ge 0 -and $px -le 192 -and $py -ge 0 -and $py -le 192) "Part '$part' pivot ($pivot) falls outside the 192x192 canvas."

  $rects = @($g.SelectNodes("./*[local-name()='rect']"))
  Assert-True ($rects.Count -ge 1) "Part '$part' must contain at least one <rect>."
}

# --- Deterministic, stable ordering = vocabulary order (no hash-dependent shuffling) ------
$expected = @($vocab | Where-Object { $seen.ContainsKey($_) })
Assert-True (($order -join "|") -eq ($expected -join "|")) "Part groups must appear in fixed vocabulary order. Got '$($order -join ", ")'."

# --- Body must be recovered (the one part that always separates) -------------------------
Assert-True ($seen.ContainsKey("part-body")) "segmented.svg must recover part-body."

# --- Coverage: every flat.svg rect lands in exactly one part (no geometry lost or added) --
[xml]$flat = Get-Content -Raw -LiteralPath $resolvedFlat
$flatRects = @($flat.SelectNodes("//*[local-name()='rect']")).Count
$partRects = @($svg.SelectNodes("//*[local-name()='g'][@data-part]/*[local-name()='rect']")).Count
Assert-True ($partRects -eq $flatRects) "Part rects ($partRects) must equal flat.svg rects ($flatRects) — segmentation must regroup all geometry, losing/inventing none."

Write-Host "segmented.svg structural checks passed."
Write-Host ("  parts   : {0} ({1})" -f $seen.Count, ($order -join ", "))
Write-Host ("  rects   : {0} (== flat.svg)" -f $partRects)
