$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  throw "Buildable Slice check failed: $Message"
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

function Read-XmlFile {
  param([string]$Path)

  try {
    [xml](Get-Content -Raw -LiteralPath $Path)
  } catch {
    Fail "Could not parse XML at $Path. $($_.Exception.Message)"
  }
}

function Read-JsonFile {
  param([string]$Path)

  try {
    Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    Fail "Could not parse JSON at $Path. $($_.Exception.Message)"
  }
}

function Assert-File {
  param([string]$Path)

  Assert-True (Test-Path -LiteralPath $Path -PathType Leaf) "Missing required file: $Path"
}

function Assert-Directory {
  param([string]$Path)

  Assert-True (Test-Path -LiteralPath $Path -PathType Container) "Missing required directory: $Path"
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

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sliceRoot = Join-Path $repoRoot "docs\buildable-slice"
$readmePath = Join-Path $sliceRoot "README.md"
$svgPath = Join-Path $sliceRoot "devbrain-manual-part.svg"
$rigPath = Join-Path $sliceRoot "devbrain-rigged.json"
$cssPath = Join-Path $sliceRoot "devbrain-svg-css.css"
$demoPath = Join-Path $sliceRoot "devbrain-svg-css-demo.html"
$goldensPath = Join-Path $sliceRoot "goldens"
$generatedPath = Join-Path $sliceRoot "generated"
$generatedSvgPath = Join-Path $generatedPath "devbrain-svg-css.generated.svg"
$generatedCssPath = Join-Path $generatedPath "devbrain-svg-css.generated.css"
$generatedDemoPath = Join-Path $generatedPath "devbrain-svg-css.generated-demo.html"
$emitterPath = Join-Path $repoRoot "tools\emit-svg-css.ps1"

$requiredFiles = @(
  $readmePath,
  $svgPath,
  $rigPath,
  $cssPath,
  $demoPath,
  $emitterPath
)

foreach ($path in $requiredFiles) {
  Assert-File $path
}
Assert-Directory $goldensPath
Assert-Directory $generatedPath
Assert-File $generatedSvgPath
Assert-File $generatedCssPath
Assert-File $generatedDemoPath

$generatedFileNames = @(Get-ChildItem -LiteralPath $generatedPath -File | Select-Object -ExpandProperty Name)
$expectedGeneratedFileNames = @(
  "devbrain-svg-css.generated.svg",
  "devbrain-svg-css.generated.css",
  "devbrain-svg-css.generated-demo.html",
  "devbrain-flat.svg",
  "devbrain-segmented.svg",
  "devbrain-segmented-review.html"
)
Assert-Set $generatedFileNames $expectedGeneratedFileNames "generated/ must contain only the generated SVG+CSS demo files, the Phase 1 flat.svg, and the Phase 2 segmentation artifacts."

Assert-True (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json") -PathType Leaf)) "Root package.json must not be created for this pass."

$expectedStates = @("idle", "active", "alert")
$expectedPartIds = @(
  "part-body",
  "part-leg-left",
  "part-leg-right",
  "part-antenna",
  "part-eyes",
  "part-moustache"
)

$svg = Read-XmlFile $svgPath
$svgRoot = $svg.DocumentElement
Assert-True ($svgRoot.GetAttribute("id") -eq "mascot") "Manual Part SVG root must use id='mascot'."
Assert-True ($svgRoot.GetAttribute("viewBox") -eq "0 0 192 192") "Manual Part SVG must use viewBox='0 0 192 192'."
Assert-True ($svgRoot.GetAttribute("data-state") -eq "idle") "Manual Part SVG must default to data-state='idle'."
Assert-True ($svgRoot.GetAttribute("data-render-method") -eq "source-pixel-rle") "Manual Part SVG must use source-pixel RLE geometry, not a freehand approximation."
Assert-True ($svgRoot.GetAttribute("data-source-bounds") -eq "21,77,170,177") "Manual Part SVG must record the approved Clean Mascot Source visible bounds."
Assert-True ($null -ne $svg.SelectSingleNode("//*[@id='rig-root']")) "Manual Part SVG must include #rig-root."
Assert-True ($svg.SelectNodes("//*[local-name()='path']").Count -eq 0) "Manual Part SVG source-pixel fixture must not contain freehand path geometry."
Assert-True ($svg.SelectNodes("//*[local-name()='rect']").Count -gt 100) "Manual Part SVG source-pixel fixture must include enough pixel-run rects to preserve likeness."
$moustacheRectCount = $svg.SelectSingleNode("//*[@id='part-moustache']").SelectNodes(".//*[local-name()='rect']").Count
$bodyRectCount = $svg.SelectSingleNode("//*[@id='part-body']").SelectNodes(".//*[local-name()='rect']").Count
Assert-True ($moustacheRectCount -lt 1200) "part-moustache must be a narrow recoil accent, not the whole lower body."
Assert-True ($bodyRectCount -gt $moustacheRectCount) "part-body must retain the main orange silhouette when alert recoil moves part-moustache."
Assert-True ($bodyRectCount -gt 5500) "part-body must include the full orange base silhouette beneath the recoil accent."

foreach ($id in $expectedPartIds) {
  $node = $svg.SelectSingleNode("//*[@id='$id']")
  Assert-True ($null -ne $node) "Manual Part SVG missing semantic part id: $id"
  Assert-True ($node.GetAttribute("class") -match "(^| )part( |$)") "$id must include class='part'."
  Assert-True ($node.HasAttribute("data-origin")) "$id must include data-origin metadata."
  Assert-True ($node.HasAttribute("data-pivot-x")) "$id must include data-pivot-x metadata."
  Assert-True ($node.HasAttribute("data-pivot-y")) "$id must include data-pivot-y metadata."
}

Assert-True ($null -eq $svg.SelectSingleNode("//*[@id='impact']")) "Manual Part SVG must not expose impact as a semantic state or part id."

$rig = Read-JsonFile $rigPath
Assert-True ($rig.version -eq 2) "rigged.json version must be 2 (schema-lock: canonical pivots + structured channels + explicit yoyo/iteration)."
Assert-True ($rig.source.kind -eq "clean-mascot-source") "rigged.json source.kind must be clean-mascot-source."
Assert-True ($rig.source.path -eq "C:\Users\student1\Dev\DevBrain\public\mascot\default.png") "rigged.json source.path must record the approved Clean Mascot Source."
Assert-True ($rig.source.metadata.width -eq 192) "Clean Mascot Source width must be recorded as 192."
Assert-True ($rig.source.metadata.height -eq 192) "Clean Mascot Source height must be recorded as 192."
Assert-True ($rig.source.metadata.pixelFormat -eq "Format32bppArgb") "Clean Mascot Source pixel format must be Format32bppArgb."
Assert-True ([bool]$rig.source.metadata.hasAlpha) "Clean Mascot Source alpha metadata must be true."

$states = @($rig.states)
Assert-Sequence $states $expectedStates "rigged.json states must be exactly: $($expectedStates -join ', ')."
Assert-True (-not ($states -contains "impact")) "impact must stay outside rigged.json states."
Assert-True ($null -ne $rig.accents) "rigged.json must include accents."
Assert-True ($rig.accents.PSObject.Properties.Name -contains "impact") "impact must be represented under accents."

$boneNames = @($rig.bones | ForEach-Object { $_.name })
Assert-True ($boneNames.Count -gt 0) "rigged.json must include bones."
Assert-True (($boneNames | Select-Object -Unique).Count -eq $boneNames.Count) "Bone names must be unique."

$seenBones = @{}
foreach ($bone in @($rig.bones)) {
  if ($bone.parent) {
    Assert-True $seenBones.ContainsKey($bone.parent) "Parent bone '$($bone.parent)' must appear before child bone '$($bone.name)'."
  }
  $seenBones[$bone.name] = $true
}

$partIds = @($rig.parts | ForEach-Object { $_.id })
Assert-Set $partIds $expectedPartIds "rigged.json parts must match the semantic SVG part IDs."

foreach ($part in @($rig.parts)) {
  Assert-True ($expectedPartIds -contains $part.id) "Unexpected rigged.json part id: $($part.id)"
  Assert-True ($boneNames -contains $part.bone) "Part '$($part.id)' references missing bone '$($part.bone)'."
  Assert-True ([string]::IsNullOrWhiteSpace($part.origin) -eq $false) "Part '$($part.id)' must include a CSS origin string."
  Assert-True ($null -ne $part.pivot) "Part '$($part.id)' must include numeric pivot metadata."
  [double]$part.pivot.x | Out-Null
  [double]$part.pivot.y | Out-Null

  $svgPart = $svg.SelectSingleNode("//*[@id='$($part.id)']")
  Assert-True ($svgPart.GetAttribute("data-origin") -eq $part.origin) "SVG data-origin for '$($part.id)' must match rigged.json."
  Assert-True ([double]$svgPart.GetAttribute("data-pivot-x") -eq [double]$part.pivot.x) "SVG data-pivot-x for '$($part.id)' must match rigged.json."
  Assert-True ([double]$svgPart.GetAttribute("data-pivot-y") -eq [double]$part.pivot.y) "SVG data-pivot-y for '$($part.id)' must match rigged.json."
}

$animationStates = @($rig.animations.PSObject.Properties.Name)
Assert-Sequence $animationStates $expectedStates "rigged.json animations keys must be exactly: $($expectedStates -join ', ')."

$allRecipes = @()
$keyframeNames = @{}
foreach ($state in $expectedStates) {
  foreach ($recipe in @($rig.animations.$state)) {
    $allRecipes += [PSCustomObject]@{
      State = $state
      Recipe = $recipe
    }

    foreach ($requiredProperty in @("part", "name", "durationMs", "timing", "iteration", "keyframes")) {
      Assert-True ($recipe.PSObject.Properties.Name -contains $requiredProperty) "Animation recipe in '$state' is missing required property '$requiredProperty'."
      Assert-True ($null -ne $recipe.$requiredProperty) "Animation recipe '$($recipe.name)' in '$state' has null '$requiredProperty'."
    }

    Assert-True ($partIds -contains $recipe.part) "Animation recipe '$($recipe.name)' references unknown part '$($recipe.part)'."
    Assert-True (-not $keyframeNames.ContainsKey($recipe.name)) "Animation keyframe name '$($recipe.name)' must be unique."
    $keyframeNames[$recipe.name] = $true
    [int]$recipe.durationMs | Out-Null
    Assert-True ([string]::IsNullOrWhiteSpace($recipe.timing) -eq $false) "Animation recipe '$($recipe.name)' must include timing."
    Assert-True ([string]::IsNullOrWhiteSpace($recipe.iteration) -eq $false) "Animation recipe '$($recipe.name)' must include iteration."
    Assert-True (@($recipe.keyframes).Count -gt 0) "Animation recipe '$($recipe.name)' must include at least one keyframe."

    foreach ($keyframe in @($recipe.keyframes)) {
      Assert-True ([string]::IsNullOrWhiteSpace($keyframe.offset) -eq $false) "Animation recipe '$($recipe.name)' has a keyframe without offset."
      Assert-True ([string]::IsNullOrWhiteSpace($keyframe.transform) -eq $false) "Animation recipe '$($recipe.name)' has a keyframe without transform."
    }
  }
}

Assert-True (@($allRecipes).Count -eq 6) "rigged.json must include the six minimal SVG+CSS motion recipes."

# --- Schema v2: structured channels + explicit loop semantics (emitter-neutral contract) ---
$channelKeys = @("rotate", "scaleX", "scaleY", "x", "y")
foreach ($entry in $allRecipes) {
  $recipe = $entry.Recipe
  foreach ($v2Property in @("ease", "repeat", "yoyo", "channels", "reducedChannel")) {
    Assert-True ($recipe.PSObject.Properties.Name -contains $v2Property) "v2 recipe '$($recipe.name)' is missing required property '$v2Property'."
  }
  Assert-True ([string]::IsNullOrWhiteSpace($recipe.ease) -eq $false) "v2 recipe '$($recipe.name)' must include a GSAP ease."
  Assert-True ($recipe.yoyo -is [bool]) "v2 recipe '$($recipe.name)' yoyo must be a boolean."
  [int]$recipe.repeat | Out-Null
  $channels = @($recipe.channels)
  Assert-True ($channels.Count -ge 2) "v2 recipe '$($recipe.name)' must include at least two channel keyframes."
  $previousOffset = -1
  foreach ($channel in $channels) {
    [double]$channel.offset | Out-Null
    Assert-True ([double]$channel.offset -ge $previousOffset) "v2 recipe '$($recipe.name)' channel offsets must be non-decreasing."
    $previousOffset = [double]$channel.offset
    foreach ($key in $channelKeys) {
      Assert-True ($channel.PSObject.Properties.Name -contains $key) "v2 recipe '$($recipe.name)' channel keyframe missing '$key'."
    }
  }
  Assert-True ([double]$channels[0].offset -eq 0) "v2 recipe '$($recipe.name)' first channel offset must be 0."
  Assert-True ([double]$channels[-1].offset -eq 1) "v2 recipe '$($recipe.name)' last channel offset must be 1."
}

# Pivot is canonical and must resolve back to the accepted CSS origin (no drift between targets).
Assert-True ($null -ne $rig.parts[0].pivot.x) "Parts must carry canonical absolute pivots for the React+GSAP target."

# reactGsap accents are an optional, Output-Target-specific block. If present, validate lightly:
# the SVG+CSS emitter ignores it, so it must not smuggle new states or unknown parts.
if ($rig.PSObject.Properties.Name -contains "reactGsap") {
  $accentStates = @($rig.reactGsap.accents.PSObject.Properties.Name)
  foreach ($state in $accentStates) {
    Assert-True ($expectedStates -contains $state) "reactGsap accent state '$state' is not an allowed Animation State."
    foreach ($accent in @($rig.reactGsap.accents.$state)) {
      Assert-True ($partIds -contains $accent.part) "reactGsap accent '$($accent.name)' references unknown part '$($accent.part)'."
      Assert-True (@($accent.channels).Count -ge 2) "reactGsap accent '$($accent.name)' must include channel keyframes."
    }
  }
}

$css = Get-Content -Raw -LiteralPath $cssPath
Assert-True ($css -match "transform-box:\s*fill-box") "CSS must use transform-box: fill-box."
Assert-True ($css -match "@media\s*\(prefers-reduced-motion:\s*reduce\)") "CSS must include a prefers-reduced-motion reduce branch."
Assert-True ($css -match "\.force-reduced-motion") "CSS must include a forced reduced-motion selector."

foreach ($state in $expectedStates) {
  Assert-True ($css -match "data-state=`"$state`"") "CSS must include data-state selector for '$state'."
}
Assert-True ($css -notmatch "data-state=`"impact`"") "CSS must not include impact as a data-state selector."

foreach ($part in @($rig.parts)) {
  Assert-True ($css.Contains("#$($part.id)")) "CSS must include selector for #$($part.id)."
  Assert-True ($css.Contains("transform-origin: $($part.origin)")) "CSS transform-origin for '$($part.id)' must match rigged.json origin '$($part.origin)'."
}

$demo = Get-Content -Raw -LiteralPath $demoPath
Assert-True ($demo.Contains("devbrain-manual-part.svg")) "Demo must load the Manual Part SVG fixture."
Assert-True ($demo.Contains("devbrain-svg-css.css")) "Demo must reference the SVG+CSS stylesheet."
Assert-True ($demo.Contains("new URLSearchParams(window.location.search)")) "Demo must read query params."
Assert-True ($demo.Contains("reduce") -and $demo.Contains("force-reduced-motion")) "Demo must support ?reduce=1 forced reduced motion."
foreach ($state in $expectedStates) {
  Assert-True ($demo.Contains("data-set-state=`"$state`"")) "Demo must expose a state switcher button for '$state'."
}
Assert-True (-not $demo.Contains("data-set-state=`"impact`"")) "Demo must not expose impact as a state switcher button."

$generatedSvg = Read-XmlFile $generatedSvgPath
$generatedSvgRoot = $generatedSvg.DocumentElement
Assert-True ($generatedSvgRoot.GetAttribute("id") -eq "mascot") "Generated SVG root must use id='mascot'."
Assert-True ($generatedSvgRoot.GetAttribute("viewBox") -eq $svgRoot.GetAttribute("viewBox")) "Generated SVG must preserve the Manual Part SVG viewBox."
Assert-True ($generatedSvgRoot.GetAttribute("data-state") -eq "idle") "Generated SVG must default to data-state='idle'."
Assert-True ($generatedSvgRoot.GetAttribute("data-render-method") -eq $svgRoot.GetAttribute("data-render-method")) "Generated SVG must preserve the Manual Part SVG render method."
Assert-True ($generatedSvgRoot.GetAttribute("data-source-bounds") -eq $svgRoot.GetAttribute("data-source-bounds")) "Generated SVG must preserve the Manual Part SVG source bounds."
Assert-True ($generatedSvg.SelectNodes("//*[local-name()='path']").Count -eq 0) "Generated SVG must not contain stale freehand path geometry."
Assert-True ($generatedSvg.SelectNodes("//*[local-name()='rect']").Count -eq $svg.SelectNodes("//*[local-name()='rect']").Count) "Generated SVG must preserve the Manual Part SVG pixel-run rect count."
Assert-True ($generatedSvg.OuterXml.Contains("devbrain-svg-css.generated.css")) "Generated SVG must link to the generated CSS file."
Assert-True ($null -ne $generatedSvg.SelectSingleNode("//*[@id='rig-root']")) "Generated SVG must preserve #rig-root."

foreach ($id in $expectedPartIds) {
  $node = $generatedSvg.SelectSingleNode("//*[@id='$id']")
  Assert-True ($null -ne $node) "Generated SVG missing semantic part id: $id"
  Assert-True ($node.GetAttribute("class") -match "(^| )part( |$)") "Generated SVG $id must include class='part'."
}

Assert-True ($null -eq $generatedSvg.SelectSingleNode("//*[@id='impact']")) "Generated SVG must not expose impact as a semantic state or part id."

$generatedCss = Get-Content -Raw -LiteralPath $generatedCssPath
Assert-True ($generatedCss -match "transform-box:\s*fill-box") "Generated CSS must use transform-box: fill-box."
Assert-True ($generatedCss -match "@media\s*\(prefers-reduced-motion:\s*reduce\)") "Generated CSS must include a prefers-reduced-motion reduce branch."
Assert-True ($generatedCss -match "\.force-reduced-motion") "Generated CSS must include forced reduced-motion selectors."
Assert-True ($generatedCss -notmatch "data-state=`"impact`"") "Generated CSS must not include impact as a data-state selector."

foreach ($part in @($rig.parts)) {
  Assert-True ($generatedCss.Contains("#$($part.id)")) "Generated CSS must include selector for #$($part.id)."
  Assert-True ($generatedCss.Contains("transform-origin: $($part.origin)")) "Generated CSS transform-origin for '$($part.id)' must match rigged.json."
}

foreach ($state in $expectedStates) {
  Assert-True ($generatedCss -match "data-state=`"$state`"") "Generated CSS must include data-state selector for '$state'."
}

foreach ($entry in $allRecipes) {
  $state = $entry.State
  $recipe = $entry.Recipe
  $animationDeclaration = "animation: $($recipe.name) $($recipe.durationMs)ms $($recipe.timing) $($recipe.iteration);"
  Assert-True ($generatedCss.Contains("#mascot[data-state=`"$state`"] #$($recipe.part)")) "Generated CSS missing selector for '$state' recipe '$($recipe.name)'."
  Assert-True ($generatedCss.Contains($animationDeclaration)) "Generated CSS animation declaration for '$($recipe.name)' must come from rigged.json."
  Assert-True ($generatedCss.Contains("@keyframes $($recipe.name)")) "Generated CSS missing @keyframes for '$($recipe.name)'."

  foreach ($keyframe in @($recipe.keyframes)) {
    $keyframeLine = "$($keyframe.offset) { transform: $($keyframe.transform); }"
    Assert-True ($generatedCss.Contains($keyframeLine)) "Generated CSS missing keyframe '$keyframeLine' for '$($recipe.name)'."
  }

  if ($recipe.PSObject.Properties.Name -contains "reduced") {
    if ($recipe.reduced.PSObject.Properties.Name -contains "transform") {
      Assert-True ($generatedCss.Contains("transform: $($recipe.reduced.transform);")) "Generated CSS missing reduced transform for '$($recipe.name)'."
    }
  }
}

$generatedDemo = Get-Content -Raw -LiteralPath $generatedDemoPath
Assert-True ($generatedDemo.Contains("devbrain-svg-css.generated.svg")) "Generated demo must load the generated SVG file."
Assert-True ($generatedDemo.Contains("new URLSearchParams(window.location.search)")) "Generated demo must read query params."
Assert-True ($generatedDemo.Contains("reduce") -and $generatedDemo.Contains("force-reduced-motion")) "Generated demo must support ?reduce=1 forced reduced motion."
Assert-True ($generatedDemo.Contains('return "devbrain-svg-css.generated.svg?state=" + encodeURIComponent(state) + suffix;')) "Generated demo must route selected states into the generated SVG query string."
Assert-True ($generatedDemo.Contains('statusText.textContent = selectedState + (forceReduce ? " / reduced" : "");')) "Generated demo must render status text without broken template interpolation."
$generatedDemoStates = @([regex]::Matches($generatedDemo, 'data-set-state="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
Assert-Sequence $generatedDemoStates $states "Generated demo state controls must come from rigged.json states."
Assert-True (-not $generatedDemo.Contains("data-set-state=`"impact`"")) "Generated demo must not expose impact as a state switcher button."

Write-Host "Buildable Slice structural checks passed."
