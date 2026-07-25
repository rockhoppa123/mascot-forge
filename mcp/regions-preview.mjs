// regions-preview.mjs — the analyze-first artifact: the source image with the agent's proposed part
// boxes drawn over it, plus a key that gives each part a distinct colour and says what it will do once
// emitted. Lets the human judge the proposal at the checkpoint. Pure, dependency-free.

// Distinct hue per part (cycled) so every box is separable — even before roles are assigned, and even
// when two parts share a role (the two-green-limbs problem with role-only colouring).
const PALETTE = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#ca8a04"];
// Plain-English motion per role, for the key — what this part will do in the emitted mascot.
const ROLE_DOES = {
  core: "breathes on idle",
  limb: "walks / rotates on active",
  accent: "reacts — blink / shake (idle + alert)",
  passive: "stays still",
};

export function emitRegionsPreview(sourceDataUri, viewBox, parts) {
  const [, , vbw = 1, vbh = 1] = String(viewBox).split(/\s+/).map(Number);
  const colourOf = (i) => PALETTE[i % PALETTE.length];
  const boxes = parts.map((p, i) => {
    const c = colourOf(i), b = p.bbox;
    return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${c}" stroke-width="1.5"/>` +
      `<text x="${b.x + 1}" y="${Math.max(b.y - 1, 4)}" font-size="4" fill="${c}">${p.id}</text>`;
  }).join("\n    ");
  const legend = parts.map((p, i) =>
    `<li><span class="sw" style="background:${colourOf(i)}"></span>` +
    `<span class="txt"><b>${p.id}</b> <span class="role">${p.role}</span>` +
    `<span class="does">${ROLE_DOES[p.role] || ROLE_DOES.passive}</span></span></li>`
  ).join("\n      ");
  return `<!doctype html><html><head><meta charset="utf-8"><title>proposed regions</title>
<style>
  body{margin:0;background:#eef3f8;min-height:100vh;display:flex;align-items:center;justify-content:center;
       gap:24px;flex-wrap:wrap;padding:24px;box-sizing:border-box;font:14px system-ui,sans-serif;color:#1d2533}
  .wrap{position:relative;width:min(70vw,460px);aspect-ratio:${vbw}/${vbh}}
  .wrap img,.wrap svg{position:absolute;inset:0;width:100%;height:100%}
  .key{background:#fff;border:1px solid #d6dce8;border-radius:8px;padding:14px 16px;min-width:220px;max-width:300px}
  .key h2{margin:0 0 10px;font-size:14px}
  .key ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
  .key li{display:flex;align-items:flex-start;gap:8px}
  .key .sw{width:14px;height:14px;border-radius:3px;margin-top:2px;flex:0 0 auto}
  .key b{font-weight:600}
  .key .role{color:#5a6678;font-size:12px;margin-left:4px}
  .key .does{display:block;color:#5a6678;font-size:12px;margin-top:2px}
</style></head>
<body>
  <div class="wrap"><img alt="source" src="${sourceDataUri}">
    <svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
    ${boxes}
    </svg>
  </div>
  <aside class="key">
    <h2>Proposed parts</h2>
    <ul>
      ${legend}
    </ul>
  </aside>
</body></html>
`;
}
