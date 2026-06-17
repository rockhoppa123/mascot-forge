param(
  [string]$SvgPath = "docs/buildable-slice/devbrain-manual-part.svg",
  [string]$RigPath = "docs/buildable-slice/devbrain-rigged.json",
  [string]$OutDir = "docs/buildable-slice/generated"
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  throw "SVG+CSS emitter failed: $Message"
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    Fail $Message
  }
}

function Resolve-RepoPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return (Join-Path $repoRoot $Path)
}

function Resolve-ExistingFile {
  param(
    [string]$Path,
    [string]$Label
  )

  $candidate = Resolve-RepoPath $Path
  Assert-True (Test-Path -LiteralPath $candidate -PathType Leaf) "$Label not found: $candidate"
  return (Resolve-Path -LiteralPath $candidate).Path
}

function Assert-Sequence {
  param(
    [object[]]$Actual,
    [object[]]$Expected,
    [string]$Message
  )

  Assert-True (($Actual -join ",") -eq ($Expected -join ",")) $Message
}

function Assert-Set {
  param(
    [object[]]$Actual,
    [object[]]$Expected,
    [string]$Message
  )

  $actualSet = (($Actual | Sort-Object) -join ",")
  $expectedSet = (($Expected | Sort-Object) -join ",")
  Assert-True ($actualSet -eq $expectedSet) $Message
}

function Read-Rig {
  param([string]$Path)

  try {
    return (Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json)
  } catch {
    Fail "Could not parse JSON at $Path. $($_.Exception.Message)"
  }
}

function Read-Svg {
  param([string]$Path)

  try {
    [xml]$document = Get-Content -Raw -LiteralPath $Path
    return $document
  } catch {
    Fail "Could not parse SVG XML at $Path. $($_.Exception.Message)"
  }
}

function Test-ObjectProperty {
  param(
    [object]$Object,
    [string]$Name
  )

  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-JsStringArray {
  param([string[]]$Items)

  $quoted = @($Items | ForEach-Object { '"' + ($_ -replace '\\', '\\' -replace '"', '\"') + '"' })
  return "[$($quoted -join ', ')]"
}

function Add-Line {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Line = ""
  )

  $Lines.Add($Line) | Out-Null
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedSvgPath = Resolve-ExistingFile $SvgPath "Manual Part SVG"
$resolvedRigPath = Resolve-ExistingFile $RigPath "rigged.json"
$resolvedOutDir = Resolve-RepoPath $OutDir

$expectedStates = @("idle", "active", "alert")
$expectedGeneratedFiles = @(
  "devbrain-svg-css.generated.svg",
  "devbrain-svg-css.generated.css",
  "devbrain-svg-css.generated-demo.html"
)

$svg = Read-Svg $resolvedSvgPath
$rig = Read-Rig $resolvedRigPath
$svgRoot = $svg.DocumentElement

Assert-True ($svgRoot.GetAttribute("id") -eq "mascot") "Manual Part SVG root must use id='mascot'."
Assert-True ($null -ne $svg.SelectSingleNode("//*[@id='rig-root']")) "Manual Part SVG must include #rig-root."

$states = @($rig.states)
Assert-Sequence $states $expectedStates "states must be exactly: $($expectedStates -join ', ')."
Assert-True (-not ($states -contains "impact")) "impact must stay outside states."
Assert-True (Test-ObjectProperty $rig "accents") "accents must exist."
Assert-True (Test-ObjectProperty $rig.accents "impact") "accents.impact must exist."

$boneNames = @($rig.bones | ForEach-Object { $_.name })
Assert-True ($boneNames.Count -gt 0) "bones must not be empty."
Assert-Set $boneNames ($boneNames | Select-Object -Unique) "bone names must be unique."

$seenBones = @{}
foreach ($bone in @($rig.bones)) {
  Assert-True ([string]::IsNullOrWhiteSpace($bone.name) -eq $false) "bone name must not be empty."

  if ($bone.parent) {
    Assert-True $seenBones.ContainsKey($bone.parent) "Parent bone '$($bone.parent)' must appear before child bone '$($bone.name)'."
  }

  $seenBones[$bone.name] = $true
}

$partIds = @($rig.parts | ForEach-Object { $_.id })
Assert-True ($partIds.Count -gt 0) "parts must not be empty."
Assert-Set $partIds ($partIds | Select-Object -Unique) "part ids must be unique."

foreach ($part in @($rig.parts)) {
  Assert-True ([string]::IsNullOrWhiteSpace($part.id) -eq $false) "part id must not be empty."
  Assert-True ($boneNames -contains $part.bone) "Part '$($part.id)' references missing bone '$($part.bone)'."
  Assert-True ([string]::IsNullOrWhiteSpace($part.origin) -eq $false) "Part '$($part.id)' must include origin."
  Assert-True ($null -ne $svg.SelectSingleNode("//*[@id='$($part.id)']")) "Part '$($part.id)' references a missing SVG id."
}

Assert-True (Test-ObjectProperty $rig "animations") "animations must exist."
$animationKeys = @($rig.animations.PSObject.Properties.Name)
Assert-Sequence $animationKeys $expectedStates "animations keys must be exactly: $($expectedStates -join ', ')."

$keyframeNames = @{}
$recipes = @()
foreach ($state in $animationKeys) {
  Assert-True ($expectedStates -contains $state) "Animation key '$state' is not allowed."

  foreach ($recipe in @($rig.animations.$state)) {
    foreach ($requiredProperty in @("part", "name", "durationMs", "timing", "iteration", "keyframes")) {
      Assert-True (Test-ObjectProperty $recipe $requiredProperty) "Animation recipe in '$state' is missing required property '$requiredProperty'."
      Assert-True ($null -ne $recipe.$requiredProperty) "Animation recipe in '$state' has null '$requiredProperty'."
    }

    Assert-True ($partIds -contains $recipe.part) "Animation recipe '$($recipe.name)' references unknown part '$($recipe.part)'."
    Assert-True ([string]::IsNullOrWhiteSpace($recipe.name) -eq $false) "Animation recipe in '$state' must include name."
    Assert-True (-not $keyframeNames.ContainsKey($recipe.name)) "Animation keyframe name '$($recipe.name)' must be unique."
    $keyframeNames[$recipe.name] = $true
    [int]$recipe.durationMs | Out-Null
    Assert-True ([string]::IsNullOrWhiteSpace($recipe.timing) -eq $false) "Animation recipe '$($recipe.name)' must include timing."
    Assert-True ([string]::IsNullOrWhiteSpace($recipe.iteration) -eq $false) "Animation recipe '$($recipe.name)' must include iteration."
    Assert-True (@($recipe.keyframes).Count -gt 0) "Animation recipe '$($recipe.name)' must include keyframes."

    foreach ($keyframe in @($recipe.keyframes)) {
      Assert-True ([string]::IsNullOrWhiteSpace($keyframe.offset) -eq $false) "Animation recipe '$($recipe.name)' has a keyframe without offset."
      Assert-True ([string]::IsNullOrWhiteSpace($keyframe.transform) -eq $false) "Animation recipe '$($recipe.name)' has a keyframe without transform."
    }

    $recipes += [PSCustomObject]@{
      State = $state
      Recipe = $recipe
    }
  }
}

if (Test-Path -LiteralPath $resolvedOutDir -PathType Container) {
  $existingGeneratedFiles = @(Get-ChildItem -LiteralPath $resolvedOutDir -File | Select-Object -ExpandProperty Name)
  foreach ($fileName in $existingGeneratedFiles) {
    Assert-True ($expectedGeneratedFiles -contains $fileName) "Output directory contains unexpected file '$fileName'."
  }
}

$cssLines = [System.Collections.Generic.List[string]]::new()
Add-Line $cssLines "svg#mascot {"
Add-Line $cssLines "  overflow: visible;"
Add-Line $cssLines "  color-scheme: light;"
Add-Line $cssLines "  shape-rendering: crispEdges;"
Add-Line $cssLines "}"
Add-Line $cssLines
Add-Line $cssLines ".part {"
Add-Line $cssLines "  transform-box: fill-box;"
Add-Line $cssLines "  transition: transform 160ms ease, opacity 120ms ease;"
Add-Line $cssLines "}"
Add-Line $cssLines

foreach ($part in @($rig.parts)) {
  Add-Line $cssLines "#$($part.id) {"
  Add-Line $cssLines "  transform-origin: $($part.origin);"
  Add-Line $cssLines "}"
  Add-Line $cssLines
}

foreach ($entry in $recipes) {
  $state = $entry.State
  $recipe = $entry.Recipe
  Add-Line $cssLines "#mascot[data-state=`"$state`"] #$($recipe.part) {"
  Add-Line $cssLines "  animation: $($recipe.name) $($recipe.durationMs)ms $($recipe.timing) $($recipe.iteration);"
  Add-Line $cssLines "}"
  Add-Line $cssLines
}

foreach ($entry in $recipes) {
  $recipe = $entry.Recipe
  Add-Line $cssLines "@keyframes $($recipe.name) {"
  foreach ($keyframe in @($recipe.keyframes)) {
    Add-Line $cssLines "  $($keyframe.offset) { transform: $($keyframe.transform); }"
  }
  Add-Line $cssLines "}"
  Add-Line $cssLines
}

Add-Line $cssLines "@media (prefers-reduced-motion: reduce) {"
Add-Line $cssLines "  #mascot .part {"
Add-Line $cssLines "    animation: none !important;"
Add-Line $cssLines "    transition: none !important;"
Add-Line $cssLines "  }"
Add-Line $cssLines
foreach ($entry in $recipes) {
  $state = $entry.State
  $recipe = $entry.Recipe
  if ((Test-ObjectProperty $recipe "reduced") -and (Test-ObjectProperty $recipe.reduced "transform")) {
    Add-Line $cssLines "  #mascot[data-state=`"$state`"] #$($recipe.part) {"
    Add-Line $cssLines "    transform: $($recipe.reduced.transform);"
    Add-Line $cssLines "  }"
    Add-Line $cssLines
  }
}
Add-Line $cssLines "}"
Add-Line $cssLines
Add-Line $cssLines "#mascot.force-reduced-motion .part {"
Add-Line $cssLines "  animation: none !important;"
Add-Line $cssLines "  transition: none !important;"
Add-Line $cssLines "}"
Add-Line $cssLines
foreach ($entry in $recipes) {
  $state = $entry.State
  $recipe = $entry.Recipe
  if ((Test-ObjectProperty $recipe "reduced") -and (Test-ObjectProperty $recipe.reduced "transform")) {
    Add-Line $cssLines "#mascot.force-reduced-motion[data-state=`"$state`"] #$($recipe.part) {"
    Add-Line $cssLines "  transform: $($recipe.reduced.transform);"
    Add-Line $cssLines "}"
    Add-Line $cssLines
  }
}

$stateArrayLiteral = Get-JsStringArray $states
$buttonHtml = @($states | ForEach-Object { "        <button type=`"button`" data-set-state=`"$_`">$_</button>" }) -join "`r`n"

$demoHtml = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DevBrain SVG+CSS Generated Buildable Slice</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      background: #eef3f8;
      color: #16212f;
    }

    body {
      margin: 0;
    }

    main {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) minmax(220px, 320px);
      gap: 18px;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
      align-items: center;
    }

    .stage,
    .panel {
      background: #ffffff;
      border: 1px solid #d6dce8;
      border-radius: 8px;
      box-shadow: 0 14px 32px rgb(22 33 47 / 10%);
    }

    .stage {
      display: grid;
      place-items: center;
      min-height: 420px;
      overflow: hidden;
    }

    .mascot-object {
      width: min(72vw, 520px);
      max-height: 76vh;
      aspect-ratio: 1;
    }

    .panel {
      padding: 16px;
    }

    h1 {
      margin: 0 0 14px;
      font-size: 20px;
      line-height: 1.2;
    }

    .state-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    button {
      min-width: 74px;
      min-height: 36px;
      padding: 7px 10px;
      border: 1px solid #9aa8bd;
      border-radius: 6px;
      background: #ffffff;
      color: #16212f;
      cursor: pointer;
      font: inherit;
    }

    button[aria-pressed="true"] {
      background: #18324f;
      color: #ffffff;
      border-color: #18324f;
    }

    .status {
      min-height: 20px;
      margin: 0;
      color: #4d5b6d;
      font-size: 14px;
    }

    @media (max-width: 760px) {
      main {
        grid-template-columns: 1fr;
        padding: 14px;
      }

      .stage {
        min-height: 320px;
      }

      .mascot-object {
        width: min(86vw, 420px);
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="stage" aria-label="Generated DevBrain mascot SVG stage">
      <object id="mascot-object" class="mascot-object" type="image/svg+xml" data="devbrain-svg-css.generated.svg" aria-label="DevBrain mascot"></object>
    </section>

    <aside class="panel">
      <h1>DevBrain SVG+CSS</h1>
      <div class="state-controls" aria-label="Animation State">
$buttonHtml
      </div>
      <p id="status" class="status" aria-live="polite"></p>
    </aside>
  </main>

  <script>
    const mascotObject = document.getElementById("mascot-object");
    const statusText = document.getElementById("status");
    const params = new URLSearchParams(window.location.search);
    const allowedStates = new Set($stateArrayLiteral);
    const requestedState = params.get("state");
    const forceReduce = params.get("reduce") === "1";
    let selectedState = allowedStates.has(requestedState) ? requestedState : "idle";

    if (forceReduce) {
      document.documentElement.classList.add("force-reduced-motion");
    }

    function svgDataFor(state) {
      const suffix = forceReduce ? "&reduce=1" : "";
      return "devbrain-svg-css.generated.svg?state=" + encodeURIComponent(state) + suffix;
    }

    function updateButtons() {
      document.querySelectorAll("[data-set-state]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.setState === selectedState));
      });
    }

    function applyState(nextState) {
      if (!allowedStates.has(nextState)) {
        return;
      }

      selectedState = nextState;
      mascotObject.data = svgDataFor(selectedState);
      statusText.textContent = selectedState + (forceReduce ? " / reduced" : "");
      updateButtons();
    }

    document.querySelectorAll("[data-set-state]").forEach((button) => {
      button.addEventListener("click", () => applyState(button.dataset.setState));
    });

    mascotObject.addEventListener("load", () => {
      statusText.textContent = selectedState + (forceReduce ? " / reduced" : "");
    });
    applyState(selectedState);
  </script>
</body>
</html>
"@

$generatedSvgPath = Join-Path $resolvedOutDir "devbrain-svg-css.generated.svg"
$generatedCssPath = Join-Path $resolvedOutDir "devbrain-svg-css.generated.css"
$generatedDemoPath = Join-Path $resolvedOutDir "devbrain-svg-css.generated-demo.html"

$stylesheetPi = $null
foreach ($node in @($svg.ChildNodes)) {
  if ($node.NodeType -eq [System.Xml.XmlNodeType]::ProcessingInstruction -and $node.Target -eq "xml-stylesheet") {
    $stylesheetPi = $node
    break
  }
}

if ($null -eq $stylesheetPi) {
  $stylesheetPi = $svg.CreateProcessingInstruction("xml-stylesheet", 'type="text/css" href="devbrain-svg-css.generated.css"')
  $null = $svg.InsertBefore($stylesheetPi, $svg.DocumentElement)
} else {
  $stylesheetPi.Data = 'type="text/css" href="devbrain-svg-css.generated.css"'
}

$svg.DocumentElement.SetAttribute("data-state", "idle")

$svgScript = @"
    (function () {
      var allowedStates = new Set($stateArrayLiteral);
      var params = new URLSearchParams(window.location.search);
      var requestedState = params.get("state");

      if (allowedStates.has(requestedState)) {
        document.documentElement.dataset.state = requestedState;
      }

      if (params.get("reduce") === "1") {
        document.documentElement.classList.add("force-reduced-motion");
      }
    }());
"@

$scriptNode = $null
$scriptNodes = $svg.GetElementsByTagName("script")
if ($scriptNodes.Count -gt 0) {
  $scriptNode = $scriptNodes.Item(0)
} else {
  $scriptNode = $svg.CreateElement("script", $svg.DocumentElement.NamespaceURI)
  $null = $svg.DocumentElement.AppendChild($scriptNode)
}

$scriptNode.RemoveAll()
$null = $scriptNode.AppendChild($svg.CreateCDataSection("`r`n$svgScript"))

if (-not (Test-Path -LiteralPath $resolvedOutDir -PathType Container)) {
  New-Item -ItemType Directory -Path $resolvedOutDir | Out-Null
}

$cssText = ($cssLines -join "`r`n").TrimEnd() + "`r`n"
Set-Content -LiteralPath $generatedCssPath -Value $cssText -Encoding utf8
Set-Content -LiteralPath $generatedDemoPath -Value $demoHtml -Encoding utf8

$settings = [System.Xml.XmlWriterSettings]::new()
$settings.Encoding = [System.Text.UTF8Encoding]::new($false)
$settings.Indent = $true
$writer = [System.Xml.XmlWriter]::Create($generatedSvgPath, $settings)
try {
  $svg.Save($writer)
} finally {
  $writer.Close()
}

Write-Host "Emitted SVG+CSS demo files to $resolvedOutDir"
