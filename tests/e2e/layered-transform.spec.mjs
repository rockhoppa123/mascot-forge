import { test, expect } from "@playwright/test";

const URL = "/tools/rig-editor/index.html"; // ponytail: local name shadows global URL, as in the sibling specs

const TRANSFORMED = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
  '  <g id="Head"><g transform="translate(10,10)"><rect x="0" y="0" width="20" height="20" fill="#c00"/></g></g>',
  '</svg>',
].join("\n");

// A transform the ingest cannot resolve must fail LOUDLY and by name. getBBox reports the element's
// own user space and `markup` is re-parented on export, so a silently-dropped transform puts the art
// in the wrong place with no error at all — the exact failure class the layered path exists to avoid.
test("a transformed layer is refused, naming the layer", async ({ page }) => {
  await page.goto(URL);
  const msg = await page.evaluate((svg) => {
    window.__rigEditor.loadLayeredSvg(svg, "transformed");
    return document.getElementById("status").textContent;
  }, TRANSFORMED);
  expect(msg).toContain("Head");        // the authored layer name, not the sanitized part id
  expect(msg).toContain("transform");
  expect(msg).toContain("Flatten");     // an action, not just a complaint

  // the aborted load must not leave the offscreen measuring wrapper attached
  const leaked = await page.evaluate(() => [...document.body.children].filter((n) => n.tagName === "DIV" && n.style.left === "-9999px").length);
  expect(leaked).toBe(0);
});

// the untransformed nested case is the one that must now WORK — same shape a Figma export produces
test("a nested but untransformed layer loads as one part", async ({ page }) => {
  await page.goto(URL);
  const parts = await page.evaluate(() => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
      '  <g id="Arm"><defs><clipPath id="c0"><rect x="0" y="0" width="99" height="99"/></clipPath></defs>',
      '    <g id="hand"><rect x="1" y="1" width="9" height="9" fill="#0b0"/></g>',
      '    <rect x="20" y="20" width="30" height="30" fill="#00b"/></g>',
      '</svg>',
    ].join("\n");
    window.__rigEditor.loadLayeredSvg(svg, "nested");
    const m = window.__rigEditor.model;
    return { parts: Object.keys(m.parts()), elements: m.rects().length };
  });
  expect(parts.parts).toEqual(["part-arm"]);
  // 2, not 3: the <clipPath>'s rect defines a clip, it is not art
  expect(parts.elements).toBe(2);
});

// THE POINT OF THE WHOLE STAGE: the two ingest paths must agree. `parseLayered` is pure ESM served
// over HTTP, so both can be run against ONE fixture inside ONE page — a real cross-check, not two
// separate suites asserting numbers that happen to match today and silently drift tomorrow. The
// root-level <defs><g>…</g></defs> below is the exact shape this test should have caught pre-review:
// a <g> that sits OUTSIDE every top-level layer, inside a root-level non-rendered subtree. The browser
// never sees it (it is not a child of <svg> once <defs> is skipped); the node path used to pick it up
// anyway because its NON_RENDERED strip ran per-layer, after topLevelGroups had already chosen layers
// from the unstripped document. Now stripped once at the document level before layer selection, so it
// must not appear as a phantom "part-rootclip" nor change the element count on either side.
test("node and browser ingest paths agree on the same nested fixture", async ({ page }) => {
  await page.goto(URL);
  const { node, browser } = await page.evaluate(async () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
      '  <defs><clipPath id="root-clip"><g id="rootclip"><rect x="0" y="0" width="9" height="9" fill="#111"/></g></clipPath></defs>',
      '  <g id="Arm"><defs><clipPath id="c0"><rect x="0" y="0" width="99" height="99"/></clipPath></defs>',
      '    <g id="hand"><rect x="1" y="1" width="9" height="9" fill="#0b0"/></g>',
      '    <rect x="20" y="20" width="30" height="30" fill="#00b"/></g>',
      '  <g id="Leg"><path d="M50 50 L60 50 L60 70 Z" fill="#c00"/></g>',
      '</svg>',
    ].join("\n");
    const { parseLayered } = await import("/tools/rig-editor/layer-ingest.js");
    const p = parseLayered(svg);
    window.__rigEditor.loadLayeredSvg(svg, "agree");
    const m = window.__rigEditor.model;
    return {
      node: { parts: [...new Set(p.elements.map((e) => e.part))], elements: p.elements.length },
      browser: { parts: Object.keys(m.parts()), elements: m.rects().length },
    };
  });
  expect(node.parts).toEqual(["part-arm", "part-leg"]);   // no phantom "part-rootclip" from the root-level <defs>
  expect(browser.parts).toEqual(node.parts);       // same parts, same order
  expect(node.elements).toBe(3);                   // 2 in Arm (clip rect excluded) + 1 path in Leg (root-level clip rect excluded too)
  expect(browser.elements).toBe(node.elements);
});

// Both paths must also REFUSE the same input. The browser reports via status(); node throws.
test("both paths refuse the same transformed fixture", async ({ page }) => {
  await page.goto(URL);
  const { threw, message, status } = await page.evaluate(async (svg) => {
    const { parseLayered } = await import("/tools/rig-editor/layer-ingest.js");
    let threw = false, message = "";
    try { parseLayered(svg); } catch (e) { threw = true; message = e.message; }
    window.__rigEditor.loadLayeredSvg(svg, "transformed");
    return { threw, message, status: document.getElementById("status").textContent };
  }, TRANSFORMED);
  expect(threw).toBe(true);
  expect(status).toBe(message);   // ONE wording, from transformErrorMessage — the paths cannot drift
});
