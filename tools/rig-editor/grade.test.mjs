// grade.test.mjs — test gradeInput heuristic. Run: `node tools/rig-editor/grade.test.mjs`.
import assert from "node:assert/strict";
import { createModel } from "./model.js";
import { gradeInput } from "./grade.js";

const mk = (rects) => createModel({ viewBox: "0 0 100 100", rects: rects.map((r, i) => ({ id: `r${i}`, ...r })) });

// monochrome (1 fill) -> silhouette
assert.equal(gradeInput(mk([{ x: 0, y: 0, w: 100, h: 100, fill: "#333" }])).grade, "silhouette");
// one element dominates (>0.8 area) even with 3 fills -> silhouette
assert.equal(gradeInput(mk([
  { x: 0, y: 0, w: 100, h: 95, fill: "#111" }, { x: 0, y: 95, w: 3, h: 5, fill: "#222" }, { x: 5, y: 95, w: 3, h: 5, fill: "#333" },
])).grade, "silhouette");
// 4+ balanced fills -> good
assert.equal(gradeInput(mk([
  { x: 0, y: 0, w: 25, h: 50, fill: "#a11" }, { x: 25, y: 0, w: 25, h: 50, fill: "#1a1" },
  { x: 50, y: 0, w: 25, h: 50, fill: "#11a" }, { x: 75, y: 0, w: 25, h: 50, fill: "#aa1" },
])).grade, "good");
// every verdict carries reason + recommendation strings
const g = gradeInput(mk([{ x: 0, y: 0, w: 10, h: 10, fill: "#000" }]));
assert.ok(g.reason && g.recommendation, "grade carries reason + recommendation");
console.log("grade.test.mjs: all assertions passed.");
