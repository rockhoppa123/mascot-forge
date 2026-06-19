param(
  [string]$CorePath = "runtime/mascot-state.js",
  [string]$TestPath = "runtime/mascot-state.test.mjs",
  [string]$DemoPath = "docs/buildable-slice/orchestrator-demo.html",
  [string]$HookPath = "tools/emit-react-gsap/src/useMascotState.ts",
  [string]$RigPath  = "docs/buildable-slice/devbrain-rigged.json"
)

# Structural checks for the Phase 4 State Orchestrator. Independent of the existing checks; it
# does NOT touch rigged.json, the Manual Part SVG, the emitters, the goldens, or any golden demo.
# See docs/phase-4-orchestrator-implementation-plan.md.

$ErrorActionPreference = "Stop"

function Fail { param([string]$Message) throw "orchestrator check failed: $Message" }
function Assert-True { param([bool]$Condition, [string]$Message) if (-not $Condition) { Fail $Message } }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
function Resolve-RepoPath { param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path } else { return (Join-Path $repoRoot $Path) }
}

$core = Resolve-RepoPath $CorePath
$test = Resolve-RepoPath $TestPath
$demo = Resolve-RepoPath $DemoPath
$hook = Resolve-RepoPath $HookPath
$rig  = Resolve-RepoPath $RigPath

foreach ($p in @($core, $test, $demo, $hook, $rig)) {
  Assert-True (Test-Path -LiteralPath $p -PathType Leaf) "Missing required file: $p"
}

# --- Core: the documented runtime API surface is present ------------------------------------
$coreText = Get-Content -Raw -LiteralPath $core
foreach ($symbol in @("export function createMascot", "setState", "bind", "getState", "destroy",
                       "export function pollJson", "export function fromEvents")) {
  Assert-True ($coreText.Contains($symbol)) "Core must expose '$symbol'."
}
Assert-True ($coreText.Contains("dataset.state")) "Core must drive the existing data-state surface (root.dataset.state)."

# --- States come from rigged.json (no separate states manifest) -----------------------------
$rigData = Get-Content -Raw -LiteralPath $rig | ConvertFrom-Json
$states = @($rigData.states)
Assert-True ($states.Count -ge 1) "rigged.json must declare states."

# --- Demo: wires the core + the locked generated SVG, states match rigged.json --------------
$demoText = Get-Content -Raw -LiteralPath $demo
Assert-True ($demoText.Contains("../../runtime/mascot-state.js")) "Demo must import the orchestrator core."
Assert-True ($demoText.Contains("createMascot")) "Demo must create a mascot from the core."
Assert-True ($demoText.Contains("devbrain-svg-css.generated.svg")) "Demo must reuse the generated SVG Output Target."
Assert-True ($demoText.Contains(".bind(")) "Demo must bind a source (reacts to live data)."
$demoStatesLiteral = "[" + (($states | ForEach-Object { '"' + $_ + '"' }) -join ", ") + "]"
Assert-True ($demoText.Contains($demoStatesLiteral)) "Demo STATES must match rigged.json states exactly: $demoStatesLiteral."

# --- React hook: wraps the same core --------------------------------------------------------
$hookText = Get-Content -Raw -LiteralPath $hook
Assert-True ($hookText.Contains("useMascotState")) "Hook must export useMascotState."
Assert-True ($hookText.Contains("runtime/mascot-state.js")) "Hook must wrap the same orchestrator core."

# --- No regressions of the YAGNI guard: no npm at the repo root ------------------------------
Assert-True (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json") -PathType Leaf)) "Root package.json must not be created by Phase 4."

# --- Scan changed Phase 4 files for leftover markers ----------------------------------------
foreach ($p in @($core, $test, $demo, $hook)) {
  $body = Get-Content -Raw -LiteralPath $p
  foreach ($marker in @("TODO", "TBD", "FIXME")) {
    Assert-True (-not $body.Contains($marker)) "$([System.IO.Path]::GetFileName($p)) contains a leftover '$marker' marker."
  }
}

# --- Deterministic core self-check (node:assert, zero npm) -----------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
Assert-True ($null -ne $node) "node is required to run the orchestrator self-check (node runtime/mascot-state.test.mjs)."
$output = & node $test 2>$null
Assert-True ($LASTEXITCODE -eq 0) "node self-check failed (exit $LASTEXITCODE)."
Assert-True (($output -join "`n").Contains("all assertions passed")) "node self-check did not report success."

Write-Host "orchestrator structural checks passed."
Write-Host ("  states : {0}" -f ($states -join ", "))
Write-Host ("  files  : core, test, demo, hook all present; self-check green")
