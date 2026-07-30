// capture-hero-gifs.mjs — regenerate docs/hero-mascot.gif and docs/hero-mcp-live.gif from the live
// demo pages. Not part of the gate: needs Playwright (tests/node_modules) and ffmpeg on PATH, neither
// of which the zero-dependency runtime/gate may depend on. A manual/owner step, same status as the
// screenshots CONTRIBUTING.md used to ask a human to capture by hand — this just automates that.
//
// Usage (repo root, server already running):
//   python -m http.server 4178
//   node tools/capture-hero-gifs.mjs
import { chromium } from "../tests/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";
import { rmSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.MF_SERVE_PORT || "4178";
const BASE = `http://127.0.0.1:${PORT}`;

// { out, stagePath, svgFetch (page-relative), size, scaleFlag, maxColors, dither }
const TARGETS = [
  {
    out: "docs/hero-mascot.gif",
    stage: `<div id="stage"></div><script>
      Promise.all([
        fetch("${BASE}/docs/buildable-slice/generated/devbrain-svg-css.generated.svg").then(r=>r.text()),
        fetch("${BASE}/docs/buildable-slice/generated/devbrain-svg-css.generated.css").then(r=>r.text()),
      ]).then(([svg, css]) => {
        const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
        document.getElementById("stage").innerHTML = svg.slice(svg.indexOf("<svg"));
      });
    </script>`,
    stageCss: "#stage{width:380px;height:380px;display:grid;place-items:center}#stage svg{width:320px;height:320px}",
    scaleFlag: "neighbor", // pixel art: keep hard edges
    scaleTo: 280, fps: 10, maxColors: 32, dither: "none",
  },
  {
    out: "docs/hero-mcp-live.gif",
    stage: `<div id="stage"></div><script>
      fetch("${BASE}/docs/buildable-slice/layered-robot/robot-mascot.svg").then(r=>r.text())
        .then((svg) => { document.getElementById("stage").innerHTML = svg.slice(svg.indexOf("<svg")); });
    </script>`,
    stageCss: "#stage{width:420px;height:420px;display:grid;place-items:center}#stage svg{width:360px;height:auto}",
    scaleFlag: "lanczos", // clean vector geometry: smooth scaling
    scaleTo: 320, fps: 12, maxColors: 32, dither: "none",
  },
];

// The stage page must be served over the SAME origin as the fetch()'d SVG/CSS — the static server
// sends no CORS headers, so a fetch from an opaque `about:blank`/`data:` origin is silently blocked.
const tmp = "out/hero-capture-tmp";
mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch();

for (const t of TARGETS) {
  const stageName = t.out.replace(/\W/g, "-") + ".html";
  writeFileSync(join(tmp, stageName), `<!doctype html><html><head><style>html,body{margin:0;background:transparent}${t.stageCss}</style></head><body>${t.stage}</body></html>`);
  const videoDir = join(tmp, "video-" + t.out.replace(/\W/g, "-"));
  mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 420, height: 420 }, recordVideo: { dir: videoDir, size: { width: 420, height: 420 } } });
  const page = await context.newPage();
  await page.goto(`${BASE}/${tmp}/${stageName}`);
  await page.waitForSelector("#stage svg", { timeout: 15000 });
  for (const s of ["idle", "active", "alert", "idle"]) {
    await page.evaluate((state) => document.querySelector("#stage svg").setAttribute("data-state", state), s);
    await page.waitForTimeout(1400);
  }
  await context.close();
  const [video] = readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
  const webm = join(videoDir, video);
  execFileSync("ffmpeg", ["-y", "-loglevel", "warning", "-i", webm,
    "-vf", `fps=${t.fps},scale=${t.scaleTo}:-1:flags=${t.scaleFlag},split[s0][s1];[s0]palettegen=reserve_transparent=1:max_colors=${t.maxColors}[p];[s1][p]paletteuse=dither=${t.dither}`,
    t.out]);
  console.log(`wrote ${t.out}`);
}

await browser.close();
rmSync(tmp, { recursive: true, force: true });
