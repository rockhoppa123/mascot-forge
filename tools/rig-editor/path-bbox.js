// path-bbox.js — bounding box of an SVG path `d` string. Pure, dependency-free ESM.
// Walks the command list keeping a current point, so RELATIVE commands (m/l/c/q/s/t/a/h/v) and the
// single-value h/v are measured correctly — Figma, Illustrator and Inkscape all emit relative data by
// default. The box is a superset of the true curve: bezier control points are included as-is (cheap,
// slightly conservative, and what full-containment marquee selection wants).
// ponytail: arcs are bounded by expanding the chord by the radii rather than solving the ellipse
// extremes — strictly conservative, tight for the ≤180° case. Upgrade to endpoint→centre
// parameterisation with real extreme angles if an arc-heavy export ever needs a tighter box.
const TOKEN_RE = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)/g;
const PARAM_COUNT = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const TAU = Math.PI * 2;

// Points that bound an elliptical arc exactly: both endpoints, plus whichever axis extremes of the
// full ellipse the sweep actually crosses. Endpoint -> centre parameterisation per the SVG spec
// (F.6.5/F.6.6). Adobe and Inkscape emit arcs heavily (161 in one 240x240 export measured on
// 2026-07-30), so a padded chord box was too loose to place parts or derive pivots from.
function arcPoints(x1, y1, rxIn, ryIn, phiDeg, fA, fS, x2, y2) {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[x2, y2]];   // degenerates to a line
  const phi = ((phiDeg || 0) % 360) * Math.PI / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
  const x1p = cosP * dx2 + sinP * dy2, y1p = -sinP * dx2 + cosP * dy2;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }      // spec: scale up radii that cannot span
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const num = rx * rx * ry * ry - den;
  let co = Math.sqrt(Math.max(0, num / den));
  if (!!fA === !!fS) co = -co;
  const cxp = co * (rx * y1p / ry), cyp = co * (-ry * x1p / rx);
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  const t1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  const t2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
  let dt = t2 - t1;
  if (!fS && dt > 0) dt -= TAU; else if (fS && dt < 0) dt += TAU;
  const at = (t) => [cx + rx * cosP * Math.cos(t) - ry * sinP * Math.sin(t),
                     cy + rx * sinP * Math.cos(t) + ry * cosP * Math.sin(t)];
  const inSweep = (t) => {
    let d = (t - t1) % TAU; if (d < 0) d += TAU;
    return dt >= 0 ? d <= dt + 1e-9 : d - TAU >= dt - 1e-9;
  };
  const pts = [at(t1), at(t1 + dt)];
  // dx/dt = 0 and dy/dt = 0 give the ellipse's own extremes; include only those inside the sweep
  for (const base of [Math.atan2(-ry * sinP, rx * cosP), Math.atan2(ry * cosP, rx * sinP)]) {
    for (const t of [base, base + Math.PI]) if (inSweep(t)) pts.push(at(t));
  }
  return pts;
}

export function pathBBox(d) {
  const tokens = [];
  for (const m of String(d == null ? "" : d).matchAll(TOKEN_RE)) {
    tokens.push(m[1] !== undefined ? { cmd: m[1] } : { num: Number(m[2]) });
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };

  let cx = 0, cy = 0;      // current point
  let sx = 0, sy = 0;      // start of the current subpath (where Z returns to)
  let started = false;     // has a moveto established a current point yet?
  let cmd = null;

  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].cmd) { cmd = tokens[i].cmd; i++; }
    else if (cmd === null) { i++; continue; }        // stray leading numbers: skip
    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    const need = PARAM_COUNT[upper];

    if (need === 0) {                                // Z / z
      if (started) { cx = sx; cy = sy; add(cx, cy); }
      // an implicit repeat of Z is meaningless; fall through to the next command letter
      continue;
    }

    // read one parameter set; implicit repeats reuse the same command letter
    const p = [];
    while (p.length < need && i < tokens.length && tokens[i].num !== undefined) {
      p.push(tokens[i].num); i++;
    }
    if (p.length < need) break;                      // truncated path data: stop, keep what we have

    switch (upper) {
      case "M": {
        cx = rel && started ? cx + p[0] : p[0];
        cy = rel && started ? cy + p[1] : p[1];
        sx = cx; sy = cy; started = true;
        add(cx, cy);
        cmd = rel ? "l" : "L";                       // per spec, further pairs after a moveto are linetos
        break;
      }
      case "L": case "T": {
        cx = rel ? cx + p[0] : p[0];
        cy = rel ? cy + p[1] : p[1];
        add(cx, cy);
        break;
      }
      case "H": { cx = rel ? cx + p[0] : p[0]; add(cx, cy); break; }
      case "V": { cy = rel ? cy + p[0] : p[0]; add(cx, cy); break; }
      case "C": {
        const x1 = rel ? cx + p[0] : p[0], y1 = rel ? cy + p[1] : p[1];
        const x2 = rel ? cx + p[2] : p[2], y2 = rel ? cy + p[3] : p[3];
        const x = rel ? cx + p[4] : p[4], y = rel ? cy + p[5] : p[5];
        add(x1, y1); add(x2, y2); add(x, y);
        cx = x; cy = y;
        break;
      }
      case "S": case "Q": {
        const x1 = rel ? cx + p[0] : p[0], y1 = rel ? cy + p[1] : p[1];
        const x = rel ? cx + p[2] : p[2], y = rel ? cy + p[3] : p[3];
        add(x1, y1); add(x, y);
        cx = x; cy = y;
        break;
      }
      case "A": {
        // Radii, rotation and the two flags are NOT coordinates — reading them as such is what put
        // Adobe exports hundreds of units off canvas. Arcs are measured exactly (see arcPoints).
        const x = rel ? cx + p[5] : p[5], y = rel ? cy + p[6] : p[6];
        for (const [ax, ay] of arcPoints(cx, cy, p[0], p[1], p[2], p[3], p[4], x, y)) add(ax, ay);
        cx = x; cy = y;
        break;
      }
    }
  }

  if (minX === Infinity) throw new Error("pathBBox: no coordinates in path data.");
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
