// emit.js — turn a rigged.json into animation CSS, a self-contained animated SVG, and a standalone
// demo page. Pure ESM, node-tested. The SAME CSS generator drives the editor's live preview and the
// in-browser export, so they can't drift; the rules mirror tools/emit-svg-css.ps1 (the canonical
// emitter stays the reference — equivalence, not byte-identity). `scope` lets the editor target
// `#stage` and the standalone export target `#mascot`.

export function emitCss(rig, { scope = "#mascot" } = {}) {
  const L = [];
  L.push(`${scope} .part { transform-box: fill-box; transition: transform 160ms ease, opacity 120ms ease; }`);
  for (const p of rig.parts) L.push(`${scope} #${p.id} { transform-origin: ${p.origin}; }`);

  const recipes = [];
  for (const s of rig.states) for (const rec of (rig.animations[s] || [])) recipes.push([s, rec]);

  for (const [s, rec] of recipes)
    L.push(`${scope}[data-state="${s}"] #${rec.part} { animation: ${rec.name} ${rec.durationMs}ms ${rec.timing} ${rec.iteration}; }`);

  for (const [, rec] of recipes) {
    const kf = rec.keyframes.map((k) => `  ${k.offset} { transform: ${k.transform}; }`).join("\n");
    L.push(`@keyframes ${rec.name} {\n${kf}\n}`);
  }

  // reduced motion — honor the OS setting and an explicit force-reduced-motion class
  const reduced = recipes.filter(([, r]) => r.reduced && r.reduced.transform);
  L.push(
    `@media (prefers-reduced-motion: reduce) {\n  ${scope} .part { animation: none !important; transition: none !important; }` +
      reduced.map(([s, r]) => `\n  ${scope}[data-state="${s}"] #${r.part} { transform: ${r.reduced.transform}; }`).join("") +
      `\n}`
  );
  L.push(`${scope}.force-reduced-motion .part { animation: none !important; transition: none !important; }`);
  for (const [s, r] of reduced)
    L.push(`${scope}.force-reduced-motion[data-state="${s}"] #${r.part} { transform: ${r.reduced.transform}; }`);

  return L.join("\n");
}

// A self-contained animated SVG: the manual-part.svg with the CSS inlined as a <style> and the external
// stylesheet reference stripped. Opens and animates (idle) anywhere, no terminal, no separate files.
export function emitAnimatedSvg(rig, manualSvg) {
  const css = emitCss(rig, { scope: "#mascot" });
  const svg = manualSvg.replace(/<\?xml-stylesheet[^?]*\?>\s*/g, ""); // drop external css ref → self-contained
  return svg.replace(/(<svg\b[^>]*>)/, (m) => `${m}\n  <style>\n${css}\n  </style>`);
}

// A standalone demo page: the animated SVG inlined with state-toggle buttons. One file, no dependencies.
// sourceDataUri (optional) shows the original image beside the mascot so the rig can be compared to it.
export function emitDemoHtml(rig, animatedSvg, assetName = "mascot", sourceDataUri = null) {
  const buttons = rig.states.map((s) => `<button data-s="${s}">${s}</button>`).join("");
  const source = sourceDataUri
    ? `<div id="source"><p>original</p><img alt="source image" src="${sourceDataUri}"></div>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${assetName} — animated mascot</title>
<style>
  body { font:14px system-ui,sans-serif; margin:0; display:flex; min-height:100vh; }
  #stage { flex:1; display:grid; place-items:center; background:#eef3f8; }
  #stage svg { width:min(70vw,460px); height:auto; }
  #panel { width:220px; padding:16px; background:#fff; border-left:1px solid #d6dce8; }
  #panel button { display:block; width:100%; margin:6px 0; padding:8px; cursor:pointer; }
  #source { margin-top:20px; }
  #source img { width:100%; image-rendering:auto; border:1px solid #d6dce8; background:#eef3f8; }
  #source p, #panel p { margin:6px 0; color:#5a6678; }
</style></head>
<body>
  <div id="stage">${animatedSvg}</div>
  <div id="panel"><h3>${assetName}</h3><p>preview state:</p>${buttons}${source}</div>
  <script>
    var svg = document.querySelector('#stage svg');
    document.querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { svg.setAttribute('data-state', b.dataset.s); }; });
  </script>
</body></html>
`;
}

// A product-grade, fully self-contained showcase page (Phase 1b): the animated SVG inlined beside the
// original image, per-state buttons, a Play/Pause that auto-cycles the states on a timer (simulating a
// live feed), and a Download-SVG button (a data-URL anchor of the inlined SVG). No fetch, no external
// CSS — opens correctly on file://. prefers-reduced-motion: the inlined SVG CSS already disables the
// animations; here we also skip auto-starting the cycle when the user asked for reduced motion.
export function emitShowcaseHtml(rig, animatedSvg, assetName = "mascot", sourceDataUri = null) {
  const inlineSvg = animatedSvg.replace(/^\s*<\?xml[^?]*\?>\s*/, ""); // strip XML prolog → embeds cleanly
  const svgB64 = Buffer.from(animatedSvg).toString("base64");
  const buttons = rig.states.map((s) => `<button data-s="${s}">${s}</button>`).join("");
  const source = sourceDataUri
    ? `<div id="source"><p>original input</p><img alt="source image" src="${sourceDataUri}"></div>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${assetName} — mascot showcase</title>
<style>
  :root { color-scheme: light; }
  body { font:14px system-ui,sans-serif; margin:0; color:#1d2533; background:#eef3f8; display:flex; min-height:100vh; }
  #stage { flex:1; display:grid; place-items:center; padding:24px; }
  #stage svg { width:min(60vw,420px); height:auto; filter:drop-shadow(0 6px 18px rgba(20,40,80,.15)); }
  #panel { width:260px; padding:20px; background:#fff; border-left:1px solid #d6dce8; display:flex; flex-direction:column; gap:14px; }
  #panel h3 { margin:0; font-size:16px; }
  #panel p { margin:0; color:#5a6678; }
  .btns { display:flex; flex-wrap:wrap; gap:6px; }
  .btns button { flex:1 0 auto; padding:8px 10px; cursor:pointer; border:1px solid #c3ccde; border-radius:6px; background:#f6f8fc; }
  .btns button.active { background:#1d6fe0; color:#fff; border-color:#1d6fe0; }
  #play { padding:9px; cursor:pointer; border:0; border-radius:6px; background:#16324f; color:#fff; font-weight:600; }
  #dl { padding:9px; text-align:center; text-decoration:none; border:1px solid #1d6fe0; border-radius:6px; color:#1d6fe0; }
  #source img { width:100%; image-rendering:auto; border:1px solid #d6dce8; border-radius:6px; background:#eef3f8; }
  @media (prefers-reduced-motion: reduce) { #play { opacity:.6; } }
</style></head>
<body>
  <div id="stage">${inlineSvg}</div>
  <div id="panel">
    <h3>${assetName}</h3>
    <p>state</p>
    <div class="btns">${buttons}</div>
    <button id="play" aria-pressed="false">▶ Play feed</button>
    <a id="dl" download="${assetName}.svg" href="data:image/svg+xml;base64,${svgB64}">⬇ Download SVG</a>
    ${source}
  </div>
  <script>
    var svg = document.querySelector('#stage svg');
    var states = ${JSON.stringify(rig.states)};
    var btns = Array.prototype.slice.call(document.querySelectorAll('[data-s]'));
    function show(s) {
      svg.setAttribute('data-state', s);
      btns.forEach(function (b) { b.classList.toggle('active', b.dataset.s === s); });
    }
    btns.forEach(function (b) { b.onclick = function () { stop(); show(b.dataset.s); }; });
    show(states[0]);
    var timer = null, i = 0;
    var play = document.getElementById('play');
    function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = '▶ Play feed'; play.setAttribute('aria-pressed', 'false'); } }
    function start() {
      timer = setInterval(function () { i = (i + 1) % states.length; show(states[i]); }, 1400);
      play.textContent = '⏸ Pause'; play.setAttribute('aria-pressed', 'true');
    }
    play.onclick = function () { timer ? stop() : start(); };
    if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) start();
  </script>
</body></html>
`;
}
