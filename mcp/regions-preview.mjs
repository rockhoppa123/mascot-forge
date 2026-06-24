// regions-preview.mjs — the analyze-first artifact: the source image with the agent's proposed part
// boxes drawn over it, so the human can judge the proposal at the checkpoint. Pure, dependency-free.
const ROLE_COLOUR = { core: "#2563eb", limb: "#16a34a", accent: "#d97706", passive: "#6b7280" };

export function emitRegionsPreview(sourceDataUri, viewBox, parts) {
  const [, , vbw = 1, vbh = 1] = String(viewBox).split(/\s+/).map(Number);
  const boxes = parts.map((p) => {
    const c = ROLE_COLOUR[p.role] || ROLE_COLOUR.passive, b = p.bbox;
    return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${c}" stroke-width="1.5"/>` +
      `<text x="${b.x + 1}" y="${b.y - 1}" font-size="4" fill="${c}">${p.id}</text>`;
  }).join("\n    ");
  return `<!doctype html><html><head><meta charset="utf-8"><title>proposed regions</title>
<style>body{margin:0;background:#eef3f8;display:grid;place-items:center;min-height:100vh}
.wrap{position:relative;width:min(80vw,520px);aspect-ratio:${vbw}/${vbh}}
.wrap img,.wrap svg{position:absolute;inset:0;width:100%;height:100%}</style></head>
<body><div class="wrap"><img alt="source" src="${sourceDataUri}">
  <svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
    ${boxes}
  </svg></div></body></html>
`;
}
