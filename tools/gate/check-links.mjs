// check-links.mjs — every relative link in every tracked Markdown file must resolve to a real file.
// Pure Node, zero dependencies, no build step, like the rest of the gate.
//
// This exists because 22 broken links shipped: a whole directory of plan documents referenced
// ../../assets/… as ../assets/…, and the research prompts pointed at sibling plans without the plans/
// segment. Nothing checked, so nothing complained. Recurring failure mode 1 (claims outrun the code)
// applied to prose: a link is a claim that a file is over there.
//
// The file list comes from `git ls-files` rather than a walk with an ignore list, for two reasons: it
// is exactly the set a stranger cloning the public repo gets, and an ignore list is a second
// hand-maintained list that would drift from .gitignore (recurring failure mode 3).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));

const ls = spawnSync("git", ["-C", repoRoot, "ls-files", "*.md"], { encoding: "utf8" });
if (ls.status !== 0) {
  console.error("check-links: `git ls-files` failed — this check needs a git checkout.");
  console.error(ls.stderr || "");
  process.exit(1);
}
const files = ls.stdout.split("\n").map((s) => s.trim()).filter(Boolean);

// [text](target) — inline links only. Reference-style definitions and bare autolinks are not used in
// this repo's docs; if that changes, this regex is the place to widen. The link text allows ONE level
// of nested brackets, because a badge is `[![alt](image)](target)` — with a flat `[^\]]*` the outer
// target is invisible, which is exactly how a deliberately-broken README badge slipped past the first
// mutation test of this checker.
const LINK_RE = /\[(?:[^[\]]|\[[^\]]*\])*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
// Skipped: external schemes, in-page anchors, and mailto:. A protocol-relative //host link counts as
// external too — the point of this check is the local filesystem.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

// A link inside CODE is quoted, not followed: these docs discuss broken links on purpose (the hero GIF
// that never existed is written out verbatim in the plan that removed it). Fenced blocks are skipped
// whole; inline code spans are blanked in place so the line numbers stay honest.
const FENCE_RE = /^\s*(```|~~~)/;
const stripCodeSpans = (line) => line.replace(/(`+)[^`]*?\1/g, (m) => " ".repeat(m.length));

const broken = [];
let checked = 0;

for (const rel of files) {
  const abs = join(repoRoot, rel);
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  let inFence = false;
  lines.forEach((raw_line, i) => {
    if (FENCE_RE.test(raw_line)) { inFence = !inFence; return; }
    if (inFence) return;
    const line = stripCodeSpans(raw_line);
    LINK_RE.lastIndex = 0;
    let m;
    while ((m = LINK_RE.exec(line)) !== null) {
      const raw = m[1];
      if (EXTERNAL.test(raw)) continue;
      // strip the fragment/query, then percent-decode (`%20` in a real filename is common enough)
      const target = decodeURIComponent(raw.replace(/[#?].*$/, ""));
      if (!target) continue;                       // a bare "#anchor" link
      checked++;
      const onDisk = target.startsWith("/")
        ? join(repoRoot, target.slice(1))          // root-relative, as GitHub renders it
        : resolve(dirname(abs), target);
      if (!existsSync(onDisk)) broken.push({ file: rel, line: i + 1, target: raw });
    }
  });
}

if (broken.length) {
  console.log(`check-links: ${broken.length} broken relative link(s) in ${files.length} Markdown files:`);
  for (const b of broken) console.log(`  ${b.file}:${b.line} -> ${b.target}`);
  process.exit(1);
}
console.log(`check-links: ${checked} relative links across ${files.length} Markdown files all resolve.`);
