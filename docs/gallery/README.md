# Input Gallery & Signal Binding

Two things decide whether mascot-forge gives you a crisp, data-reactive mascot:
**the input art** (does it rig cleanly?) and **the binding** (which app signals drive which states?).
This page covers both.

---

## 1. What rigs well — the input grade

`forge_start_from_image` returns an `inputGrade` *before* you commit to rigging:

```json
{ "grade": "good" | "borderline" | "silhouette", "reason": "...", "recommendation": "..." }
```

The grade is a deterministic heuristic over the vectorised art
([`tools/rig-editor/grade.js`](../../tools/rig-editor/grade.js)): how many distinct opaque fills there
are, and how much of the art the single largest region covers.

| Grade | When | What it means |
|---|---|---|
| **good** | ≥4 distinct fills, no single region >80% of the art | Rigs cleanly — colour-distinct parts separate into a head, limbs, eyes, etc. |
| **borderline** | 3 fills, or a moderately dominant region | Riggable, but parts may be coarse. A more colour-distinct source rigs better. |
| **silhouette** | ≤2 fills, or one region >80% of the art | Worst case — parts can't be auto-separated; it will animate as one body. |

### Good input — colour-distinct, layered

A logo or character with **separately-coloured parts** (a red body, white eyes, a dark wheel, a
yellow flag). Each colour becomes a peelable region you can assign a role/kind to. The
land-rover (`assets/land-rover/`) and devbrain (`docs/buildable-slice/`) rigs are good inputs:
distinct body / window / wheel colours → real parts → per-part motion.

### Silhouette — the worst case

A **flat single-colour shape** (e.g. a black cat icon). There is one fill, so there is one part:
the whole body. You get breathing, but nothing can wave, blink, or spin, because there is nothing
to separate. `Cat.png` is the canonical example — the grade flags it up front so you can swap to a
layered source instead of finding out after you've rigged.

> **Rule of thumb:** if you can't point at 3–4 *different colours* that map to *different moving
> parts*, the art is a silhouette. Export from Figma/Illustrator with the parts on separate
> layers/colours, or pick a more detailed source.

---

## 2. Binding app signals to states

States are **open**: the default vocabulary is `["idle", "active", "alert"]`, but a rig can declare
any states it wants (`["idle", "active", "error"]`). The runtime
([`runtime/mascot-state.js`](../../runtime/mascot-state.js)) binds **arbitrary** states to a data
source — you supply the vocabulary and a function that maps your app's signals to state names.

`states[0]` is the **resting** state. Higher index = higher priority; an upgrade interrupts
immediately, a downgrade waits out a dwell window (so a one-frame blip doesn't flap the mascot).

### Example: a CI mascot (`ci_failed → error → shake`)

The mascot was rigged with an accent part whose `error` state uses the `shake` preset (a generic
mover bound to a custom state). Now wire the live signal to the `error` state:

```js
import { createMascot, pollJson } from "../../runtime/mascot-state.js";

// 1. The rig declared these states (rigged.json.states). states[0] = resting.
const mascot = createMascot({
  root: document.querySelector("#mascot"), // the inlined SVG; CSS keys on #mascot[data-state="…"]
  states: ["idle", "active", "error"],
});

// 2. Map your app's signal shape to an asserted state (or null = nothing asserted → resting).
const mapBuild = (status) => {
  if (status.failing) return "error";   // → triggers the flag's shake
  if (status.running) return "active";  // → walk / spin
  return null;                           // → falls back to idle under hysteresis
};

// 3. Bind a source. pollJson hits an endpoint on an interval; fromEvents wraps an EventSource.
const stop = mascot.bind(pollJson("/api/ci/status", mapBuild, 5000));

// later: stop();  // unbinds the source
// manual override (demos, tests): mascot.setState("error");
```

`bind` accepts any `source = (emit) => unsubscribe`. Built-ins:
[`pollJson(url, mapFn, intervalMs)`](../../runtime/mascot-state.js) and
[`fromEvents(target, mapFn, eventName)`](../../runtime/mascot-state.js) for an `EventSource` /
`postMessage` / custom `EventTarget`. For a fully offline preview, the emitted showcase HTML auto-
cycles the states on a timer (the **▶ Play feed** button) — no binding required.

### Matching motion to the state

Tag parts with a `kind` so the right motion is the default
([subject-aware presets](../../tools/rig-editor/presets.js)):

| kind | default motion |
|---|---|
| `wheel` | `spin` — continuous 360° |
| `flag` | `wave` |
| `mouth` | `talk` |

Generic movers (`bounce`, `shake`, `nod`, `float`, `jump`, `wobble`) are available to any limb or
accent part and bind to whatever state you like (`error → shake`, `success → bounce`).
