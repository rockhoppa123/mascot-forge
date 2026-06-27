# serve.ps1 — static HTTP server from the repo root so the rig editor (ES modules) and emitted demos
# load over http (file:// blocks ES modules + fetch). Port defaults to 4178 (matches the editor's in-page
# hint and the MCP's returned `open` URLs); override with -Port. Ctrl+C to stop.
param([int]$Port = 4178)
$root = Split-Path $PSScriptRoot -Parent
Write-Host "serving $root at http://localhost:$Port/  (Ctrl+C to stop)"
python -m http.server $Port --directory $root
