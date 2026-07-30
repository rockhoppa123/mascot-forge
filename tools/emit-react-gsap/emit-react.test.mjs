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

// The input SVG's own line-ending convention must not leak into the output. manualSvg is embedded
// VERBATIM into mascotMarkup.ts via JSON.stringify (line 168), so a `\r\n` in the source becomes the
// literal two-character escape sequence in the generated TEXT, not a real control byte — norm()'s
// byte-level `\r\n` replace above never sees it, because JSON.stringify already turned it into text.
// This is exactly how gate-linux broke silently for weeks: the four committed goldens were generated
// from a Windows checkout (`core.autocrlf=true` converts the checked-out working copy to CRLF even
// though the git BLOB itself is LF), baking `\r\n` escapes into the committed .ts files; a plain
// Linux checkout (no conversion) reads the same LF blob as LF, so the freshly generated output has
// plain `\n` and mismatches the stale golden. Every local/CI run before this one used the SAME
// checked-out manualSvg to both generate and compare, so nothing ever caught it.
{
  // manualSvg's own line endings depend on how THIS test's working tree was checked out (CRLF on
  // Windows, LF on Linux) — normalize to a clean LF baseline first so the CRLF variant built from it
  // has exactly one \r per line, not a doubled \r\r\n on whichever platform runs this.
  const lfSvg = manualSvg.replace(/\r\n/g, "\n");
  const crlfSvg = lfSvg.replace(/\n/g, "\r\n");
  const fromCrlf = emitReactGsap({ riggedJson, manualSvg: crlfSvg });
  const fromLf = emitReactGsap({ riggedJson, manualSvg: lfSvg });
  for (const name of ["Mascot.tsx", "mascotRig.ts", "mascotMarkup.ts", "README.md"]) {
    assert.equal(fromCrlf[name], fromLf[name],
      `${name}: output must be identical whether the input SVG uses CRLF or LF line endings`);
  }
}

// Structural purity: the core has NO imports, no `process`/env access, no `require`, no dynamic
// `import()`. This is what actually guarantees it can't touch the filesystem, read env, or pull a
// dependency — the determinism check below can't see any of that. Also pins the project's "no new
// dependency in the core" constraint as a test.
// (Template literals hold *generated file content*, e.g. an embedded `import ... from "react"`
// line for the emitted Mascot.tsx — strip those first so the scan only sees the core's own code.
// Comments are stripped too, so an incidental substring like "in-process" in prose can't false-positive.)
const coreSrc = readFileSync(join(here, "emit-react.mjs"), "utf8");
const coreCodeOnly = coreSrc
  .replace(/`(?:\\.|[^`\\])*`/gs, "") // strip template literals (generated file content)
  .replace(/\/\/.*$/gm, "") // strip line comments
  .replace(/\/\*[\s\S]*?\*\//g, ""); // strip block comments
assert.ok(!/^\s*import\s/m.test(coreCodeOnly), "the core imports nothing — no fs, no env, no deps");
assert.ok(!/\bprocess\b/.test(coreCodeOnly), "the core does not touch process/env");
assert.ok(!/\brequire\s*\(/.test(coreCodeOnly), "the core has no require()");
assert.ok(!/\bimport\s*\(/.test(coreCodeOnly), "the core has no dynamic import()");

// callable twice with identical output
const again = emitReactGsap({ riggedJson, manualSvg });
assert.deepEqual(again, files, "the core is deterministic");

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
