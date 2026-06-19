# Land Rover Series III — Clean Mascot Source (Spike 03 second asset)

`land-rover.png` — the read-only Clean Mascot Source for the Second-Asset Validation spike
(`spikes/03-second-asset/`). A genuinely different character from DevBrain: a cartoon
military Land Rover (green body, UK flag on a pole, headlight "eyes", front grille, wheels).

**Provenance (do not regenerate):** Andrew supplied `Series III Land Rover Mascot.jpg`
(1024×1024 JPEG with a baked-in checkerboard "transparency" pattern — JPEG has no alpha).
Step-0 source prep (`spikes/03-second-asset/prep-source.ps1`, Andrew-approved) keyed the
checkerboard + white die-cut border to transparency via an edge-connected background flood
fill, and downscaled 1024→256 (nearest-neighbor, to keep flat colour blocks and avoid quantization
banding) so the pixel-RLE vectorizer / O(n²) segmenter stay tractable
(DevBrain's source was 192×192). No art was generated or redrawn — only background removal +
resize. Read-only, like DevBrain's source.
