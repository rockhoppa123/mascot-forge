// Self-check for the rig-editor in-memory model. No framework — node:assert, mirror
// runtime/mascot-state.test.mjs. Run: `node tools/rig-editor/model.test.mjs`.
import assert from "node:assert/strict";
import { createModel, ROLES, BACKGROUND_PART } from "./model.js";

function sample() {
  return createModel({
    viewBox: "0 0 100 100",
    rects: [
      { id: "r0", x: 0, y: 0, w: 10, h: 10, fill: "#000", part: "part-a" },
      { id: "r1", x: 10, y: 0, w: 10, h: 10, fill: "#111", part: "part-a" },
      { id: "r2", x: 0, y: 10, w: 10, h: 10, fill: "#222", part: "part-b" },
    ],
    parts: { "part-a": { role: "core" }, "part-b": { role: "limb" } },
  });
}

// membership
{
  const m = sample();
  assert.equal(m.partOf("r0"), "part-a");
  assert.deepEqual(m.rectsOf("part-a").map((r) => r.id), ["r0", "r1"]);
}

// assign a subset to a new part-id = split (D5: rect granularity); auto-creates the part
{
  const m = sample();
  m.assign(["r1"], "part-c");
  assert.equal(m.partOf("r1"), "part-c");
  assert.deepEqual(m.rectsOf("part-a").map((r) => r.id), ["r0"]);
  assert.ok(m.parts()["part-c"], "assigning to an unknown part id creates it");
  assert.equal(m.parts()["part-c"].role, "passive", "a new part defaults to the passive role");
}

// rename carries rect membership + metadata
{
  const m = sample();
  m.setRole("part-a", "accent");
  m.rename("part-a", "part-head");
  assert.equal(m.partOf("r0"), "part-head");
  assert.equal(m.parts()["part-head"].role, "accent");
  assert.ok(!m.parts()["part-a"], "old id is gone after rename");
}

// remove sends rects to the background group (D6: geometry is never dropped)
{
  const m = sample();
  m.remove("part-b");
  assert.equal(m.partOf("r2"), BACKGROUND_PART);
  assert.equal(m.parts()[BACKGROUND_PART].role, "passive");
  assert.ok(!m.parts()["part-b"]);
}

// role + pivot setters
{
  const m = sample();
  m.setRole("part-a", "accent");
  assert.equal(m.parts()["part-a"].role, "accent");
  assert.throws(() => m.setRole("part-a", "bogus"), /role/, "unknown role rejected");
  m.setPivot("part-a", { x: 5, y: 5 }, "50% 50%");
  assert.deepEqual(m.parts()["part-a"].pivot, { x: 5, y: 5 });
  assert.equal(m.parts()["part-a"].origin, "50% 50%");
}

// D6 invariant: after any op every rect still belongs to exactly one part
{
  const m = sample();
  m.assign(["r1"], "part-c");
  m.remove("part-b");
  assert.ok(m.everyRectGrouped(), "every rect lands in exactly one group");
  assert.deepEqual(m.ungroupedRects(), []);
  const counts = m.rects().filter((r) => !r.part || r.part === "");
  assert.equal(counts.length, 0);
}

// preset selections per state (exporter turns these into recipes)
{
  const m = sample();
  assert.deepEqual(m.states(), ["idle", "active", "alert"]);
  m.setPreset("idle", "part-a", "breathe");
  assert.equal(m.preset("idle", "part-a"), "breathe");
  m.setPreset("idle", "part-a", null);
  assert.equal(m.preset("idle", "part-a"), undefined, "null clears a selection");
}

// snapshot / restore (P4 undo): a snapshot taken before a mutation restores the exact prior state,
// in place (same model reference). Covers rect membership, part metadata, and preset selections.
{
  const m = sample();
  m.setPreset("idle", "part-a", "breathe");
  const snap = m.snapshot();

  // mutate everything: move a rect, change a role, remove a part, drop the preset
  m.assign(["r0"], "part-b");
  m.setRole("part-a", "limb");
  m.remove("part-b");
  m.setPreset("idle", "part-a", null);
  assert.notDeepEqual(m.rects().map((r) => r.part), ["part-a", "part-a", "part-b"], "state changed before restore");

  m.restore(snap);
  assert.deepEqual(m.rects().map((r) => r.part), ["part-a", "part-a", "part-b"], "rect membership restored");
  assert.equal(m.parts()["part-a"].role, "core", "role restored");
  assert.ok(m.parts()["part-b"], "removed part is back");
  assert.equal(m.preset("idle", "part-a"), "breathe", "preset selection restored");
}

// restore is a deep copy: mutating the model after restore must not corrupt the snapshot (and vice versa)
{
  const m = sample();
  const snap = m.snapshot();
  m.restore(snap);
  m.assign(["r0"], "part-z");
  assert.deepEqual(snap.rects.find((r) => r.id === "r0").part, "part-a", "snapshot is independent of post-restore edits");
}

assert.ok(ROLES.includes("passive") && ROLES.length === 4, "four roles");

// part kind metadata (Phase 2a)
{
  const m = sample();
  assert.equal(m.parts()["part-a"].kind, null, "kind defaults to null");
  m.setKind("part-a", "wheel");
  assert.equal(m.parts()["part-a"].kind, "wheel", "setKind stores the kind");
  assert.throws(() => m.setKind("part-a", "bogus"), /kind/, "unknown kind rejected");
}

console.log("model.test.mjs: all assertions passed.");
