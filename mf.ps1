#!/usr/bin/env pwsh
# mascot-forge CLI — a dependency-free PowerShell dispatcher over the existing pipeline scripts (v1.2).
# NOT a Node CLI and NOT an asset registry: it just wires the verbs an operator runs per asset, so a
# new asset is `forge` -> review -> `emit` -> `check` instead of four remembered raw invocations.
#
#   pwsh ./mf.ps1 forge <asset>   P1 vectorize -> P2 segment, then STOP for the ADR-0002 human review.
#   pwsh ./mf.ps1 emit  <asset>   P3 emit (SVG+CSS + React+GSAP) from the confirmed rig.
#   pwsh ./mf.ps1 check           regression gate (alias for tools/check-all.ps1).
#
# DevBrain uses the committed buildable-slice paths (reproduces goldens byte-for-byte); any other
# asset defaults under assets/<asset>/ and can be overridden with the path params below. See
# docs/v1.2-implementation-plan.md.
param(
  [Parameter(Position = 0)][string]$Verb = "",
  [Parameter(Position = 1)][string]$Asset = "devbrain",
  [int]$MaxRects = 8000,
  [int]$Colors = 0,            # 0 = use vectorize-pixel.ps1's own default (6)
  # Optional path overrides; empty = convention (see Get-AssetPaths).
  [string]$SourcePath = "",
  [string]$FlatPath = "",
  [string]$SegPath = "",
  [string]$ReviewHtml = "",
  [string]$ManualSvg = "",
  [string]$RigPath = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$pwshHead = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File")

function Invoke-Tool {
  param([string]$Script, [string[]]$ToolArgs)
  & pwsh @pwshHead (Join-Path $repoRoot $Script) @ToolArgs
  if ($LASTEXITCODE -ne 0) { throw "$Script exited $LASTEXITCODE" }
}

function Pick { param([string]$Override, [string]$Default) if ($Override -ne "") { $Override } else { $Default } }

function Get-AssetPaths {
  param([string]$a)
  if ($a -eq "devbrain") {
    return @{
      Source = "assets/devbrain/poses/default.png"
      Flat   = "docs/buildable-slice/generated/devbrain-flat.svg"
      Seg    = "docs/buildable-slice/generated/devbrain-segmented.svg"
      Review = "docs/buildable-slice/generated/devbrain-segmented-review.html"
      Manual = "docs/buildable-slice/devbrain-manual-part.svg"
      Rig    = "docs/buildable-slice/devbrain-rigged.json"
      Out    = "docs/buildable-slice/generated"
    }
  }
  $base = "assets/$a"
  return @{
    Source = "$base/source.png"; Flat = "$base/$a-flat.svg"; Seg = "$base/$a-segmented.svg"
    Review = "$base/$a-segmented-review.html"; Manual = "$base/$a-manual-part.svg"
    Rig = "$base/$a-rigged.json"; Out = "$base/generated"
  }
}

function Show-Usage {
  Write-Host "mascot-forge CLI (v1.2)"
  Write-Host "usage: pwsh ./mf.ps1 <verb> [asset]"
  Write-Host "  forge <asset>   P1 vectorize + P2 segment, then stop for human review"
  Write-Host "  emit  <asset>   P3 emit SVG+CSS and React+GSAP from the confirmed rig"
  Write-Host "  check           run the full regression gate (tools/check-all.ps1)"
}

switch ($Verb) {
  "forge" {
    $p = Get-AssetPaths $Asset
    $src = Pick $SourcePath $p.Source
    $flat = Pick $FlatPath $p.Flat
    $seg = Pick $SegPath $p.Seg
    $review = Pick $ReviewHtml $p.Review

    Write-Host "--- P1 vectorize ($Asset) ---" -ForegroundColor Cyan
    $vecArgs = @("-SourcePath", $src, "-OutPath", $flat)
    if ($Colors -gt 0) { $vecArgs += @("-Colors", $Colors) }
    Invoke-Tool "tools/vectorize-pixel.ps1" $vecArgs

    Write-Host "--- P2 segment ($Asset) ---" -ForegroundColor Cyan
    $segArgs = @("-FlatPath", $flat, "-Out", $seg, "-Html", $review, "-MaxRects", $MaxRects)
    $rig = Pick $RigPath $p.Rig
    if (Test-Path -LiteralPath (Join-Path $repoRoot $rig)) { $segArgs += @("-RiggedPath", $rig) }
    $spec = "assets/$Asset/parts-spec.json"
    if (Test-Path -LiteralPath (Join-Path $repoRoot $spec)) { $segArgs += @("-Spec", $spec) }
    Invoke-Tool "tools/segment-parts.ps1" $segArgs

    Write-Host ""
    Write-Host "Review then emit:" -ForegroundColor Yellow
    Write-Host "  1. open $review and confirm the proposed parts/pivots (ADR-0002)"
    Write-Host "  2. author/adjust the rig at $rig"
    Write-Host "  3. run: pwsh ./mf.ps1 emit $Asset"
  }

  "emit" {
    $p = Get-AssetPaths $Asset
    $manual = Pick $ManualSvg $p.Manual
    $rig = Pick $RigPath $p.Rig
    $out = Pick $OutDir $p.Out

    Write-Host "--- P3 emit SVG+CSS ($Asset) ---" -ForegroundColor Cyan
    Invoke-Tool "tools/emit-svg-css.ps1" @("-SvgPath", $manual, "-RigPath", $rig, "-OutDir", $out, "-AssetName", $Asset)

    Write-Host "--- P3 emit React+GSAP ($Asset) ---" -ForegroundColor Cyan
    # Call node directly (the npm `emit` script is just `node --experimental-strip-types src/emit.ts`).
    # This skips npm's PowerShell shim (which mangles `& npm` args) and needs no cwd change — emit.ts
    # resolves all paths from its own file location. DevBrain with default paths uses emit.ts's own
    # defaults (byte-identical); other assets pass absolute RIG_PATH/SVG_PATH via env.
    $useDefaults = ($Asset -eq "devbrain" -and $RigPath -eq "" -and $ManualSvg -eq "")
    if (-not $useDefaults) {
      $env:RIG_PATH = (Resolve-Path -LiteralPath (Join-Path $repoRoot $rig)).Path
      $env:SVG_PATH = (Resolve-Path -LiteralPath (Join-Path $repoRoot $manual)).Path
    }
    try {
      & node --experimental-strip-types (Join-Path $repoRoot "tools/emit-react-gsap/src/emit.ts")
      if ($LASTEXITCODE -ne 0) { throw "React+GSAP emit exited $LASTEXITCODE (is Node 22+ available and tools/emit-react-gsap/node_modules installed?)" }
    } finally {
      if (-not $useDefaults) { Remove-Item Env:RIG_PATH, Env:SVG_PATH -ErrorAction SilentlyContinue }
    }
  }

  "check" {
    Invoke-Tool "tools/check-all.ps1" @()
    exit $LASTEXITCODE
  }

  default {
    Show-Usage
    exit 1
  }
}
