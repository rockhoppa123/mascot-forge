// Self-check for the Phase 4 orchestrator core. No framework — just node:assert.
// Run: `node runtime/mascot-state.test.mjs`. Feeds a scripted timestamped signal timeline and
// asserts the resulting state timeline (priority interrupt + downgrade hysteresis), then proves
// the same sequence yields an identical timeline (determinism).
import assert from "node:assert/strict";
import { createMascot } from "./mascot-state.js";

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

console.log("mascot-state.test.mjs: all assertions passed.");
