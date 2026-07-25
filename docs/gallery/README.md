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
| **borderline** | 3 fills, or ≥4 fills with one region >80% of the art | Riggable, but parts may be coarse. A more colour-distinct source rigs better. |
| **borderline** (fragmented) | ≥50 rects and mean rect height <2px | Colour-separable but anti-aliased/gradient source — smooth shading defeats the vectoriser's vertical rect-merge, so the art comes back as a stack of ~1px strips. Edges look rough and thin features may shatter into slivers; use flat hard-edged pixel art or a layered SVG for a clean rig. |
| **silhouette** | ≤2 distinct fills | Worst case — parts can't be auto-separated; it will animate as one body. |

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

### App-signal states: `loading` / `error` / `success`

`loading`, `error`, and `success` are the universal dashboard signals. They are **opt-in** states a
rig declares **at start** — a rig's vocabulary is fixed at creation. They reuse existing motion via
`STATE_FAMILY` ([`presets.js`](../../tools/rig-editor/presets.js)): `loading → active`,
`success → active`, `error → alert`. So `set_part`'s preset list for a signal state is the same one
the matching base state offers (a wheel can `spin` while `loading`; an accent can `shake` on `error`).

**Author the rig** — declare the vocabulary at start, then give parts a preset per signal state:

```js
// 1. declare all six states up front (immutable for this rig). states[0] = idle = resting.
forge_start_from_image({ base64, states: ["idle", "active", "alert", "loading", "success", "error"] })

// 2. assign roles, then a preset per signal state (each reuses active/alert motion).
set_part({ session, partId: "part-wheel", role: "limb",  presets: { loading: "spin" } })   // loading→active
set_part({ session, partId: "part-eyes",  role: "accent", presets: { error: "shake" } })    // error→alert
set_part({ session, partId: "part-body",  role: "limb",  presets: { success: "bounce" } })  // success→active
// forge_emit → a self-contained SVG whose CSS keys on [data-state="loading"|"error"|"success"]
```

**Bind real signals** — map your deploy/CI events onto those states:

```js
import { createMascot, fromEvents } from "../../runtime/mascot-state.js";

// vocabulary order = PRIORITY (error outranks success outranks loading); states[0] = resting.
const mascot = createMascot({
  root: document.querySelector("#mascot"),
  states: ["idle", "active", "alert", "loading", "success", "error"],
});

const mapSignal = (e) => ({
  deploy_started: "loading",   // → the wheel spins
  ci_failed:      "error",     // → the eyes shake (higher priority — interrupts immediately)
  deploy_ok:      "success",   // → the body bounces
}[e.data.type] ?? null);        // null → nothing asserted → falls back to idle under hysteresis

const stop = mascot.bind(fromEvents(deployBus, mapSignal)); // deployBus: any EventTarget / EventSource
// later: stop();  // unbinds
```

A preset set for a state the rig never declared is rejected at `set_part` time — the rig can only
animate states in its declared vocabulary, so the binding and the authoring stay in lock-step.

---

## 3. Motion presets

Every preset lives in
[`tools/rig-editor/presets.js`](../../tools/rig-editor/presets.js) under the
`PRESETS[role][state][name]` tree. The editor's preset pickers and the
`forge_propose` overlay key are generated from the same `presetsFor` helper, so
this table is the human-readable mirror of that single source of truth.

### core

| State | Preset | What it does |
|---|---|---|
| idle | `breathe` | subtle scale pulse — the universal resting motion |
| idle | `sway` | gentle idle lean |
| active | `lean` | body tilts while active |

### limb

| State | Preset | What it does |
|---|---|---|
| active | `walk` | alternating leg swing (14°/−18°) |
| active | `walk-mirror` | mirror of `walk` for the opposite leg |
| active | `wag` | fast wide tail/flag swing (±22°) |
| active | `spin` | continuous 360° rotation (wheels) |
| active | `bounce` | vertical hop (−12 px) |
| active | `shake` | horizontal rattle (±4 px) |
| active | `nod` | slow rotational dip (10°) |
| active | `float` | slow gentle drift (−6 px) |
| active | `jump` | sharp upward leap (−20 px) |
| active | `wobble` | quick alternating tilt (±6°) |

### accent

| State | Preset | What it does |
|---|---|---|
| idle | `twitch` | quick rotational ear/antenna flick |
| idle | `blink` | vertical scale crush — eye blink |
| idle | `glance` | eyes dart |
| active | `talk` | fast vertical scale — mouth open/close |
| active | `bounce` | vertical hop (−12 px) |
| active | `float` | slow gentle drift (−6 px) |
| active | `jump` | sharp upward leap (−20 px) |
| alert | `wave` | slow wide sway (±6°) — flag/ribbon |
| alert | `shake` | horizontal rattle (±4 px) |
| alert | `nod` | slow rotational dip (10°) |
| alert | `wobble` | quick alternating tilt (±6°) |
| alert | `pulse` | rhythmic scale swell (→1.16×) |
| alert | `recoil` | sharp horizontal flinch (−5 px) |
| alert | `jolt` | upward startle on alert |

### passive

No presets. Passive parts are inert — they inherit the parent's transform but
carry no animation of their own.
