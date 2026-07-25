// Golden test for the React+GSAP Output Target core. The committed generated/ files ARE the
// contract: the extracted pure core must reproduce them byte-for-byte from the same rig inputs.
// Run: `node tools/emit-react-gsap/emit-react.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { emitReactGsap } from "./emit-react.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const slice = join(here, "..", "..", "docs", "buildable-slice");
const norm = (s) => s.replace(/\r\n/g, "\n"); // working tree is CRLF; emitted output is LF

const riggedJson = JSON.parse(readFileSync(join(slice, "devbrain-rigged.json"), "utf8"));
const manualSvg = readFileSync(join(slice, "devbrain-manual-part.svg"), "utf8");

const files = emitReactGsap({ riggedJson, manualSvg });

// every generated artifact is reproduced exactly
for (const name of ["Mascot.tsx", "mascotRig.ts", "mascotMarkup.ts", "README.md"]) {
  const golden = readFileSync(join(here, "generated", name), "utf8");
  assert.equal(norm(files[name]), norm(golden), `${name} must match the committed golden byte-for-byte`);
}
assert.deepEqual(Object.keys(files).sort(), ["Mascot.tsx", "README.md", "mascotMarkup.ts", "mascotRig.ts"],
  "the core emits exactly the four generated artifacts");

// the core is pure: no filesystem writes, callable twice with identical output
const again = emitReactGsap({ riggedJson, manualSvg });
assert.deepEqual(again, files, "the core is deterministic and side-effect free");

// schema guard: a non-v2 rig is rejected with an actionable message
assert.throws(() => emitReactGsap({ riggedJson: { ...riggedJson, version: 1 }, manualSvg }),
  /version 2/, "a non-v2 rig is rejected");

// geometry ceiling (ADR-0011): a part with no <rect> geometry cannot be bounded
assert.throws(
  () => emitReactGsap({
    riggedJson: { ...riggedJson, parts: [{ id: "part-ghost", origin: "50% 50%", pivot: { x: 1, y: 1 } }] },
    manualSvg: '<svg viewBox="0 0 10 10"><g id="part-ghost"><path d="M0 0h4v4z" fill="#a"/></g></svg>',
  }),
  /no <rect> geometry/,
  "a path-only part fails with the documented geometry ceiling"
);

console.log("emit-react.test.mjs: golden + purity + guards green.");
