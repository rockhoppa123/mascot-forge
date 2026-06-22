# Phase 6: one command that runs every pipeline check, fail-fast, with a per-check summary.
# Thin sequential wrapper over the checks that already exist — NO test framework, NO new deps.
# Touches no locked artifact: it only invokes the existing P1-P4 checks + the node self-check.
# See docs/phase-6-polish-demo-implementation-plan.md.

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# ponytail: ordered list of (label, scriptblock); add a row here if a new phase check ever lands.
$checks = @(
  @{ Name = "P1 flat-svg";    Run = { & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "tools/check-flat-svg.ps1") } },
  @{ Name = "P2 segmented";   Run = { & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "tools/check-segmented.ps1") } },
  @{ Name = "P3 slice";       Run = { & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "tools/check-buildable-slice.ps1") } },
  @{
    Name = "P3 land-rover-emit"
    Run  = {
      $tmpOut = Join-Path $env:TEMP ("mf-lr-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
      New-Item -ItemType Directory -Path $tmpOut -Force | Out-Null
      $lrBase = Join-Path $repoRoot "spikes/03-second-asset"
      "land-rover-flat.svg","land-rover-segmented.svg","land-rover-segmented-review.html" | ForEach-Object {
        Copy-Item (Join-Path $lrBase "generated/$_") $tmpOut
      }
      & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "tools/emit-svg-css.ps1") `
        -SvgPath (Join-Path $lrBase "generated/land-rover-manual-part.svg") `
        -RigPath (Join-Path $lrBase "land-rover-rigged.json") `
        -OutDir  $tmpOut `
        -AssetName "land-rover"
      Remove-Item $tmpOut -Recurse -Force -ErrorAction SilentlyContinue
    }
  },
  @{ Name = "P4 orchestrator";Run = { & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "tools/check-orchestrator.ps1") } },
  @{ Name = "P4 determinism"; Run = { & node (Join-Path $repoRoot "runtime/mascot-state.test.mjs") } },
  @{
    Name = "P5 rig-editor"   # browser rig editor: all pure-logic node self-checks (model -> exporter golden)
    Run  = {
      foreach ($t in "model", "loader", "pivot", "presets", "validator", "exporter", "select", "vectorize", "segment") {
        & node (Join-Path $repoRoot "tools/rig-editor/$t.test.mjs")
        if ($LASTEXITCODE -ne 0) { break }  # leaves the failing exit code for the summary
      }
    }
  }
)

$results = @()
$failed = $false
foreach ($c in $checks) {
  Write-Host ("--- {0} ---" -f $c.Name) -ForegroundColor Cyan
  & $c.Run
  $ok = ($LASTEXITCODE -eq 0)
  $results += [pscustomobject]@{ Name = $c.Name; Ok = $ok }
  if (-not $ok) { $failed = $true; break }  # fail-fast on first non-zero exit
}

Write-Host ""
Write-Host "==== check-all summary ===="
foreach ($r in $results) {
  Write-Host ("  {0} {1}" -f $(if ($r.Ok) { [char]0x2705 } else { [char]0x274C }), $r.Name)
}
if ($failed) {
  Write-Host "RESULT: FAIL" -ForegroundColor Red
  exit 1
}
Write-Host "RESULT: PASS (all pipeline checks green)" -ForegroundColor Green
exit 0
