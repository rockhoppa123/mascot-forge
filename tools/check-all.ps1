# check-all.ps1 — thin shim. The gate itself is now Node and cross-platform:
#
#     node tools/gate/check-all.mjs
#
# That is the canonical entry point and the one CI runs. This wrapper stays because `mf.ps1 check`,
# CONTRIBUTING and a good deal of muscle memory all invoke it, and because its exact "RESULT: PASS"
# line is asserted by docs. It adds nothing but a forward, and it must keep forwarding the exit code
# so a red gate stays red for every caller.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& node (Join-Path $repoRoot "tools/gate/check-all.mjs")
exit $LASTEXITCODE
