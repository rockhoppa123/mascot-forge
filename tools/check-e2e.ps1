# check-e2e.ps1 — run the browser e2e suite (Playwright). Kept separate from check-all.ps1 so the node
# gate stays dependency-free; this is the discoverable one-liner for the browser product-path tests.
# Usage: pwsh -NoProfile -File tools/check-e2e.ps1   (add a filter: ... tools/check-e2e.ps1 drop-rig)
$ErrorActionPreference = "Stop"
$tests = Join-Path $PSScriptRoot "..\tests"
Push-Location $tests
try {
  if (-not (Test-Path "node_modules")) { npm install }
  npx playwright test @args
} finally { Pop-Location }
