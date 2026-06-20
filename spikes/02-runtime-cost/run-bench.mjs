// ponytail: THROWAWAY measurement runner, NOT a deliverable. It exists only because an agent
// cannot click the DevTools CPU-throttle dropdown by hand. Zero dependency: Node 22 built-in
// WebSocket + fetch drive Chrome over the DevTools Protocol — the programmatic form of the exact
// manual steps the plan describes (set throttle -> paste bench.js -> read JSON). bench.js stays
// the pasteable, browser-built-ins sampler. Run:  node spikes/02-runtime-cost/run-bench.mjs
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 9333;
const WINDOW_MS = 8000;       // dwell per cell (plan: ~10s; 8s keeps 54 runs under ~8 min)
const REPS = 3;               // run each cell >=3x, report median of medians
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ROOT = "http://localhost:4178";
const SVG_URL = (s) => `${ROOT}/docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html?state=${s}`;
const REACT_URL = `${ROOT}/tools/emit-react-gsap/dist/index.html`;
const BENCH_SRC = readFileSync(new URL("./bench.js", import.meta.url), "utf8");
const STATES = ["idle", "active", "alert"];
const THROTTLES = [{ name: "none", rate: 1 }, { name: "4x", rate: 4 }, { name: "6x", rate: 6 }];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// ---- minimal CDP client over one page-target WebSocket ----
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiters = new Map(); this.events = new Map();
    ws.addEventListener("message", (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.waiters.has(d.id)) { const w = this.waiters.get(d.id); this.waiters.delete(d.id);
        d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); }
      else if (d.method && this.events.has(d.method)) { this.events.get(d.method)(d.params); this.events.delete(d.method); }
    });
  }
  send(method, params = {}) { const id = ++this.id;
    return new Promise((res, rej) => { this.waiters.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  once(method) { return new Promise((res) => this.events.set(method, res)); }
  async eval(expr, awaitPromise = false) {
    const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  }
}

async function connect() {
  const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res) => (ws.onopen = res));
  const cdp = new CDP(ws);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Performance.enable");
  return cdp;
}

async function loadCell(cdp, target, state) {
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: target === "svg-css" ? SVG_URL(state) : REACT_URL });
  await loaded;
  await sleep(400);
  if (target === "react-gsap") {
    // Quiesce the demo's mock 150ms telemetry feed (no source edit) so both instances hold a
    // steady state, then drive the manual instance to the target state.
    await cdp.eval(`for(let i=1;i<100000;i++)clearInterval(i);
      (function(){var b=[...document.querySelectorAll('[data-set-state]')].find(x=>x.dataset.setState===${JSON.stringify(state)});if(b)b.click();})();'ok'`);
  }
  await sleep(1500); // let CSS keyframes / GSAP timelines settle into steady state
}

async function runCell(cdp, target, state, thr) {
  await loadCell(cdp, target, state);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: thr.rate });
  await cdp.eval(BENCH_SRC); // (re)define window.__bench in the fresh context
  const r = await cdp.eval(
    `window.__bench(${JSON.stringify({ target, state, throttle: thr.name, ms: WINDOW_MS })})`, true);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return r;
}

// Performance-panel equivalent: cumulative scripting/layout/style/task durations across the
// bench window at 4x. CDP Performance.getMetrics is the programmatic form of the DevTools
// Performance panel — used because a headless agent cannot screenshot a flame chart.
async function perfTrace(cdp, target, state, thr) {
  await loadCell(cdp, target, state);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: thr.rate });
  const pick = (m) => Object.fromEntries(m.map((x) => [x.name, x.value]));
  const before = pick((await cdp.send("Performance.getMetrics")).metrics);
  await sleep(WINDOW_MS);
  const after = pick((await cdp.send("Performance.getMetrics")).metrics);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const d = (k) => +(((after[k] || 0) - (before[k] || 0)) * 1000).toFixed(1); // s -> ms
  return { target, state, throttle: thr.name, scriptMs: d("ScriptDuration"), layoutMs: d("LayoutDuration"),
    recalcStyleMs: d("RecalcStyleDuration"), taskMs: d("TaskDuration") };
}

async function main() {
  const profile = `${process.env.TEMP || "/tmp"}/mf-bench-profile`;
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, "--window-size=900,620", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  await sleep(2500);
  const cdp = await connect();
  const cells = [];
  for (const target of ["svg-css", "react-gsap"]) {
    for (const state of STATES) {
      for (const thr of THROTTLES) {
        const reps = [];
        for (let i = 0; i < REPS; i++) reps.push(await runCell(cdp, target, state, thr));
        const cell = { target, state, throttle: thr.name,
          p50: median(reps.map((r) => r.p50)), p95: median(reps.map((r) => r.p95)),
          longTasks: median(reps.map((r) => r.longTasks)), longTaskMs: median(reps.map((r) => r.longTaskMs)),
          heapMB: median(reps.map((r) => r.heapMB)), reps: REPS };
        cells.push(cell);
        console.log(JSON.stringify(cell));
      }
    }
  }
  const traces = [];
  for (const target of ["svg-css", "react-gsap"])
    traces.push(await perfTrace(cdp, target, "active", { name: "4x", rate: 4 }));
  traces.forEach((t) => console.log("TRACE " + JSON.stringify(t)));
  writeFileSync(new URL("./results.json", import.meta.url),
    JSON.stringify({ generated: new Date().toISOString(), windowMs: WINDOW_MS, reps: REPS, cells, traces }, null, 2));
  chrome.kill();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
