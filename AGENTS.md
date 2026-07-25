# mascot-forge guide

## Start here

- Read `README.md` for the pipeline, supported output targets, and quickstart.
- Read `CONTEXT.md` for project vocabulary and `docs/README.md` for document
  routing.
- Read `DESIGN.md` before changing the rig editor, demos, emitted UI, or the
  public showcase.

## Boundaries

- Preserve the SVG+CSS default and React+GSAP opt-in output targets. Do not add
  a new animation dependency unless an approved output target requires it.
- The product is an assisted, human-in-the-loop rigging pipeline; do not turn
  it into an autonomous anatomy or hosted-generation service without a scoped
  decision.
- Preserve generated and asset outputs unless the requested slice explicitly
  regenerates them.

## Verification

Run the narrowest relevant local check. The full pipeline gate is:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\check-all.ps1
```
