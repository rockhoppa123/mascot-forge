// Both emitter targets inject the SAME shared mascot.svg so the comparison is fair.
// But that means the same element ids (#mascot, #part-*, #title, #desc) and the same
// `.part` class would appear twice in one document. Duplicate ids are invalid HTML and
// the SVG+CSS stylesheet selectors (`#mascot[data-state] #part-*`, `.part { transition }`)
// would otherwise bleed onto the GSAP tree and fight GSAP's per-frame inline transforms.
//
// Fix: give the GSAP copy a private namespace. Ids gain a prefix, the `.part` class is
// renamed to `.gsap-part`, and the external-stylesheet processing instruction is stripped
// (GSAP drives everything; no CSS animation should touch this tree).

const PART_IDS = [
  "mascot",
  "rig-root",
  "title",
  "desc",
  "part-body",
  "part-eyes",
  "part-moustache",
  "part-antenna",
  "part-leg-left",
  "part-leg-right",
];

/** Strip the `<?xml ... ?>` and `<?xml-stylesheet ... ?>` processing instructions. */
function stripProcessingInstructions(svg: string): string {
  return svg.replace(/<\?xml[\s\S]*?\?>\s*/g, "");
}

/** Raw shared SVG, ready to inline into the SVG+CSS target (ids intact, PI removed). */
export function prepCssSvg(raw: string): string {
  return stripProcessingInstructions(raw);
}

/**
 * Raw shared SVG namespaced for the GSAP target. Returns the markup plus the prefix so the
 * component can build scoped selectors (`#${prefix}part-leg-left`, …).
 */
export function prepGsapSvg(raw: string, prefix = "gsap-"): { markup: string; prefix: string } {
  let out = stripProcessingInstructions(raw);

  // Prefix every known id, plus matching `href="#id"` / `aria-labelledby` references.
  for (const id of PART_IDS) {
    out = out.replaceAll(`id="${id}"`, `id="${prefix}${id}"`);
    out = out.replaceAll(`href="#${id}"`, `href="#${prefix}${id}"`);
  }
  // aria-labelledby lists ids space-separated ("title desc").
  out = out.replace(/aria-labelledby="([^"]*)"/g, (_m, refs: string) => {
    const next = refs
      .split(/\s+/)
      .map((r) => (PART_IDS.includes(r) ? `${prefix}${r}` : r))
      .join(" ");
    return `aria-labelledby="${next}"`;
  });
  // Keep `.part` styling (transform-box: fill-box) off the CSS target's selector reach.
  out = out.replaceAll('class="part"', 'class="gsap-part"');

  return { markup: out, prefix };
}
