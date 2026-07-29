// Self-check for the Phase 4 orchestrator core. No framework — just node:assert.
// Run: `node runtime/mascot-state.test.mjs`. Feeds a scripted timestamped signal timeline and
// asserts the resulting state timeline (priority interrupt + downgrade hysteresis), then proves
// the same sequence yields an identical timeline (determinism).
import assert from "node:assert/strict";
import { createMascot, pollJson, fromEvents } from "./mascot-state.js";

const states = ["idle", "active", "alert"];

// A manual source lets the test inject signals with explicit timestamps -> no wall clock.
function harness() {
  const root = { dataset: {} };
  const timeline = [];
  let push;
  const source = (emit) => {
    push = emit;
    return () => {};
  };
  const m = createMascot({
    root,
    states,
    rules: { minDwellMs: 600, onState: (s) => timeline.push(s) },
  });
  m.bind(source);
  return { m, root, timeline, signal: (asserted, ts) => push(asserted, ts) };
}

// Scripted signal timeline -> expected state timeline. onState fires once at construction (idle)
// and again on every change, so the recorded timeline begins with "idle".
function run() {
  const h = harness();
  h.signal("idle", 0); //      resting asserted -> no change
  h.signal("active", 100); //  upgrade immediate -> active
  h.signal("alert", 200); //   upgrade immediate -> alert
  h.signal("active", 300); //  alert cleared, but dwell 100ms < 600ms -> hold alert
  h.signal("active", 900); //  700ms >= 600ms -> downgrade alert -> active
  h.signal("idle", 1000); //   active cleared, but dwell 100ms < 600ms -> hold active
  h.signal(null, 1600); //     700ms >= 600ms -> downgrade active -> idle
  return { state: h.m.getState(), root: h.root.dataset.state, timeline: h.timeline };
}

const a = run();
assert.deepEqual(a.timeline, ["idle", "active", "alert", "active", "idle"]);
assert.equal(a.state, "idle");
assert.equal(a.root, "idle", "core writes the resolved state onto root.dataset.state");

// Determinism: identical sequence -> identical timeline.
const b = run();
assert.deepEqual(b.timeline, a.timeline, "same signal sequence must yield the same state timeline");

// Priority: alert interrupts active immediately, with no dwell on the upgrade.
{
  const h = harness();
  h.signal("active", 0);
  h.signal("alert", 10);
  assert.equal(h.m.getState(), "alert", "higher-priority signal upgrades immediately");
}

// Manual setState overrides immediately, regardless of dwell.
{
  const h = harness();
  h.signal("alert", 0);
  h.m.setState("idle");
  assert.equal(h.m.getState(), "idle", "setState is an immediate operator override");
}

// Multiple simultaneously-asserted signals: the highest priority wins.
{
  const h = harness();
  h.signal(["idle", "active", "alert"], 0);
  assert.equal(h.m.getState(), "alert", "highest-priority asserted state wins");
}

// M3: a 500 with a JSON body must assert nothing (not map the error payload to a state). pollJson
// checks res.ok. A macrotask flush lets the immediate tick() resolve before we assert.
{
  const calls = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ failing: true }) });
  const source = pollJson("/x", (d) => (d.failing ? "alert" : null), 100000);
  const stop = source((asserted) => calls.push(asserted));
  await new Promise((r) => setTimeout(r, 0)); // let the immediate tick settle
  stop();
  globalThis.fetch = savedFetch;
  assert.deepEqual(calls, [null], "a non-ok response asserts nothing (does not map the error body)");
}

// race guard: an earlier tick's slow response resolving AFTER a later tick's fast one must not
// overwrite the fresher result (a stale 'alert' landing late shouldn't re-trigger after it cleared).
//
// TIMING BUDGETS — change all three together, keeping their RATIOS. pollJson keeps polling, so the
// observation window must contain EXACTLY two ticks: wait must exceed the interval (so tick 2 happens)
// and the slow reply (so its drop is observed), but stay under 2x the interval (or tick 3 lands and
// `calls` grows past ["v2"]). The original 20/30/35 left ~15ms of slack and failed ~30% of runs under
// load — measured, not theorised. These are the same numbers scaled 4x: interval 80, slow reply 1.5x
// the interval, wait 1.75x. Widening only the wait makes it WORSE, not better: it admits a third tick.
{
  const calls = [];
  const savedFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => {
    const call = ++n;
    await new Promise((r) => setTimeout(r, call === 1 ? 120 : 0)); // tick 1 is slow, tick 2 is instant
    return { ok: true, json: async () => ({ v: call }) };
  };
  const source = pollJson("/x", (d) => `v${d.v}`, 80); // tick 2 fires ~80ms after tick 1 starts
  const stop = source((asserted) => calls.push(asserted));
  await new Promise((r) => setTimeout(r, 140)); // tick 2 settles (~80ms), then tick 1's stale reply (~120ms)
  stop();
  globalThis.fetch = savedFetch;
  assert.deepEqual(calls, ["v2"], `the newer tick wins; the slower stale reply is dropped (got ${JSON.stringify(calls)})`);
}

// fromEvents: a throwing mapFn asserts nothing (same degrade-gracefully contract as pollJson),
// instead of becoming an uncaught exception that kills the page.
{
  const calls = [];
  const target = new EventTarget();
  const source = fromEvents(target, () => { throw new Error("boom"); });
  const stop = source((asserted) => calls.push(asserted));
  target.dispatchEvent(new Event("message"));
  stop();
  assert.deepEqual(calls, [null], "a throwing mapFn asserts nothing instead of throwing uncaught");
}

console.log("mascot-state.test.mjs: all assertions passed.");
