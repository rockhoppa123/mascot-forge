// server.mjs — mascot-forge MCP server (stdio). Thin wiring of the M1 tools (tools.mjs) to the official
// SDK. Logging goes to stderr only (stdout is the MCP protocol stream). Run: `node mcp/server.mjs`,
// or wire it into an agent host via .mcp.json (see README). buildServer() is exported so a smoke test
// can construct it without opening the stdio transport.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFromImage, assignRegion, setPart, forgeStatus, forgeEmit, forgePropose, applyTweaks, editorHandoff, startFromLayeredSvg } from "./tools.mjs";

const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: String((e && e.message) || e) }] });

export function buildServer() {
  const server = new McpServer(
    { name: "mascot-forge", version: "0.1.0" },
    {
      instructions:
        "Rig a flat-art image into an owned, animated mascot. Loop: 1) forge_start_from_image; " +
        "2) for each part you SEE in the image, call assign_region with a box in 0..1 fractions of the " +
        "viewBox and a role (core=body that breathes, limb=arm/leg that rotates, accent=small mover like " +
        "eyes/tongue, passive=still); read back `moved` and adjust the box if needed; 3) forge_emit. " +
        "Roles alone produce animation (a default preset per role is applied). " +
        "Always report the input grade in plain language first. If the user hasn't specified the " +
        "parts/roles/presets, prefer the GUIDED path: call forge_propose, show the proposed parts, and " +
        "confirm with the user before forge_emit (the `rig_mascot` prompt scripts this). Only one-shot " +
        "straight to forge_emit when the user has handed you an explicit spec.",
    }
  );

  server.registerTool(
    "forge_start_from_image",
    {
      // creates a NEW session per call, so not idempotent
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      description:
        "Start a rig session from a PNG (base64 preferred; or a project-relative path). Vectorises + " +
        "proposes coarse parts. Returns { session, viewBox, parts:[{id,role,rectCount,bbox}] }. The auto " +
        "parts are a hint — re-segment with assign_region by what you SEE. Returns inputGrade " +
        "{grade,reason,recommendation} — tell the user the grade BEFORE rigging; on 'silhouette', " +
        "suggest a layered/multi-colour source. Optionally pass `states` to declare app-signal states up " +
        "front (e.g. [\"idle\",\"active\",\"alert\",\"loading\",\"success\",\"error\"] — order is runtime priority, " +
        "error last = highest); signal states reuse " +
        "alert/active motion and must be declared here — a rig's vocabulary is fixed at start. Defaults to " +
        "[\"idle\",\"active\",\"alert\"].",
      inputSchema: {
        base64: z.string().optional(),
        path: z.string().optional(),
        colors: z.number().int().min(1).max(32).optional(),
        maxDim: z.number().int().min(16).max(1024).optional(),
        states: z.array(z.string()).optional(),
      },
    },
    async (a) => { try { return ok(startFromImage(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "forge_start_from_layered_svg",
    {
      // creates a NEW session per call, so not idempotent
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      description:
        "Alt entry: start a session from a LAYERED vector SVG (Figma/Inkscape/Illustrator export) where " +
        "each top-level <g> is a part named by its layer. No segmentation — parts are already named; go " +
        "straight to set_part + forge_emit. v1 supports rect + path layers only (circle/ellipse/polygon/ " +
        "polyline/line are rejected; use the browser rig editor for those, since it measures geometry " +
        "with getBBox instead of parsing shapes). Returns { session, viewBox, parts }.",
      inputSchema: { svg: z.string().optional(), path: z.string().optional() },
    },
    async (a) => { try { return ok(startFromLayeredSvg(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "assign_region",
    {
      // reassigns parts within the session; repeating is a no-op
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      description:
        "Move every shape inside a normalized box (x,y,w,h each 0..1 of the viewBox) into partId, " +
        "optionally setting its role. Use this to carve the parts you see (a hand, the tongue, …). " +
        "Returns { moved, parts } so you can confirm and adjust the box.",
      inputSchema: {
        session: z.string(),
        box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
        partId: z.string(),
        role: z.enum(["core", "limb", "accent", "passive"]).optional(),
      },
    },
    async (a) => { try { return ok(assignRegion(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "set_part",
    {
      // sets absolute values; repeating is a no-op
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      description:
        "Set a part's motion metadata in one call: role (core=body that breathes, limb=arm/leg that " +
        "rotates, accent=small mover like eyes/tongue, passive=still), bone, pivot (x,y each 0..1 of the " +
        "viewBox — omit for a role-aware default: limb hinges at its top-edge joint, others at bbox " +
        "centre), and presets per state ({ idle?, active?, alert?, loading?, error?, success? }). Signal " +
        "states (loading/error/success) reuse active/alert motion and only apply if the rig declared them " +
        "at start. Changing role clears any preset no " +
        "longer valid for it; an invalid preset for the role/state is rejected. Optional kind is a subject " +
        "hint (wheel/flag/limb/eye/mouth/body/accent) that unlocks subject-aware default motion (a wheel " +
        "spins, a flag waves). Returns { part, rigStatus }.",
      inputSchema: {
        session: z.string(),
        partId: z.string(),
        role: z.enum(["core", "limb", "accent", "passive"]).optional(),
        kind: z.enum(["wheel", "flag", "limb", "eye", "mouth", "body", "accent"]).optional(),
        bone: z.string().optional(),
        pivot: z.object({ x: z.number(), y: z.number() }).optional(),
        presets: z.object({ idle: z.string().nullable().optional(), active: z.string().nullable().optional(), alert: z.string().nullable().optional(), loading: z.string().nullable().optional(), error: z.string().nullable().optional(), success: z.string().nullable().optional() }).optional(),
      },
    },
    async (a) => { try { return ok(setPart(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "forge_status",
    {
      // pure read of session state
      annotations: { readOnlyHint: true, openWorldHint: false },
      description:
        "Inspect rig progress: { parts:[{id,role,rectCount,bbox}], rigStatus:{idle,active,alert," +
        "animated,total}, ungroupedRects }. Use it between set_part calls to confirm every state has " +
        "coverage before forge_emit.",
      inputSchema: { session: z.string() },
    },
    async (a) => { try { return ok(forgeStatus(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "forge_emit",
    {
      // WRITES and can overwrite files in outDir
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Validate the rig and emit a self-contained animated mascot (SVG that animates on its own + a " +
        "demo HTML). Roles are enough. Writes to outDir (project-relative) if given, else returns sizes. " +
        "Returns { ok, validation, ..., open } — `open` is a ready demo URL (run tools/serve.ps1, default " +
        "port 4178, then open it). If ok is false, fix the parts/roles and retry. " +
        "Pass `target` to choose the Output Target: \"svg-css\" (default, dependency-free, portable), " +
        "\"react-gsap\" (opt-in React+TS component driven by GSAP timelines — use when the mascot lives " +
        "in a React app needing mid-tween interrupts), or \"both\". React+GSAP needs rect-based geometry; " +
        "a path-based rig returns a clear error naming the ceiling.",
      inputSchema: {
        session: z.string(),
        assetName: z.string().optional(),
        outDir: z.string().optional(),
        target: z.enum(["svg-css", "react-gsap", "both"]).optional(),
      },
    },
    async (a) => { try { return ok(forgeEmit(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "forge_propose",
    {
      // writes regions-preview.html when outDir is given, despite the name — and can overwrite an
      // existing file of that name, which is the same reason forge_emit is marked destructive
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Analyze-first report: assemble the current proposed parts + write a regions-overlay preview " +
        "(original image with the proposed part boxes drawn over it) the human can eyeball before emit. " +
        "Returns { parts, rigStatus, preview, advisory, plan }. `plan` is the per-part motion plan: each " +
        "part's recommended preset (mirror-aware — two limbs alternate walk/walk-mirror) plus the " +
        "alternative `options` per declared state — present it so the user can confirm or swap a motion. " +
        "`advisory` flags a single-colour silhouette that can't be auto-separated — provide a layered/" +
        "multi-colour source for full rigging. Returns `advisory` when the rig cannot animate yet (no " +
        "roles assigned) — read it out and act on it before forge_emit.",
      inputSchema: { session: z.string(), outDir: z.string().optional() },
    },
    async (a) => { try { return ok(forgePropose(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "forge_apply_tweaks",
    {
      // renameTo is not repeatable — the second call cannot find the old id
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      description:
        "Inline checkpoint fixes without leaving chat: rename parts and/or change roles. edits is an " +
        "array of { partId, renameTo?, setRole? }. Returns { parts, rigStatus }.",
      inputSchema: {
        session: z.string(),
        edits: z.array(z.object({
          partId: z.string(),
          renameTo: z.string().optional(),
          setRole: z.enum(["core", "limb", "accent", "passive"]).optional(),
        })),
      },
    },
    async (a) => { try { return ok(applyTweaks(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "forge_open_editor",
    {
      // writes rig-handoff.svg, and can overwrite an existing one
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Deep-fix handoff: emit the current rig as a layered SVG the browser rig editor can load, for " +
        "manual fixing, then come back and forge_emit. The handoff is a self-describing SVG (roles/pivots/" +
        "presets/states as data-* attrs) so the editor loads it ANIMATED. Writes to outDir (project-relative) " +
        "if given. Returns { svg, written, editor, open } — `open` is the editor URL with ?rig= that auto-loads " +
        "the handoff (run tools/serve.ps1, default port 4178, then open it).",
      inputSchema: { session: z.string(), outDir: z.string().optional() },
    },
    async (a) => { try { return ok(editorHandoff(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "forge_review",
    {
      // reads status and asks the human; mutates nothing
      annotations: { readOnlyHint: true, openWorldHint: false },
      description:
        "Checkpoint: ask the HUMAN to approve / redo / open the editor for the proposed rig, via MCP " +
        "elicitation. Returns { elicitation:true, action } once the human chooses. If the client can't " +
        "elicit, returns { elicitation:false, parts, rigStatus } so you can relay the question in chat.",
      inputSchema: { session: z.string() },
    },
    async ({ session }) => {
      try {
        const status = forgeStatus({ session });
        const caps = server.server.getClientCapabilities && server.server.getClientCapabilities();
        if (!caps || !caps.elicitation) return ok({ elicitation: false, ...status });
        let res;
        try {
          res = await server.server.elicitInput({
            mode: "form",
            message: `Proposed rig: ${status.parts.length} parts, states ${JSON.stringify(status.rigStatus)}. Approve, redo, or open the editor?`,
            requestedSchema: { type: "object", properties: { action: { type: "string", enum: ["approve", "redo", "editor"] } }, required: ["action"] },
          });
        } catch (e) {
          return ok({ elicitation: false, reason: e.message, ...status }); // client lacks form elicitation
        }
        const action = res.action === "accept" ? (res.content && res.content.action) || "approve" : res.action;
        return ok({ elicitation: true, action, decision: res.action });
      } catch (e) { return fail(e); }
    }
  );

  // Guided-rig prompt: surfaces as a slash command in the host. Scripts the checkpointed flow so the
  // user gets walked through it (grade → propose → confirm → emit) instead of having to hand a full spec.
  server.registerPrompt(
    "rig_mascot",
    {
      title: "Rig a mascot (guided)",
      description:
        "Walk me through rigging a flat-art image into an animated mascot: grade it, propose the parts with " +
        "a visual overlay, confirm with me, then emit. Use this instead of handing over a full spec.",
      argsSchema: { image: z.string().optional() },
    },
    rigMascotPrompt
  );

  return server;
}

// The guided-rigging script (exported so server.test can assert its steps). Scripts: pick a reactivity
// TIER (Simple/Standard/Signals) -> grade (silhouette/borderline => whole-body Simple, no fake limbs) ->
// propose + PRESENT THE MOTION PLAN with per-part options -> checkpoint (continue / change) -> apply +
// emit. The MCP is request/response, so this prompt is what makes Claude present the plan and wait — the
// options come from forge_propose's `plan` field.
export function rigMascotPrompt({ image } = {}) {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            "Rig a flat-art image into an animated mascot — GUIDED, with checkpoints. Do not one-shot it.\n" +
            (image ? `Image: ${image}\n` : "I'll provide the image (attached, or I'll give a path).\n") +
            "0. FIRST ask me how reactive this mascot should be — pick a TIER:\n" +
            "   • Simple — one looping animation, no app states, no JS (states: [\"idle\"]).\n" +
            "   • Standard — reacts idle/active/alert to my data (states: [\"idle\",\"active\",\"alert\"]).\n" +
            "   • Signals — Standard plus the loading/error/success app-signal states (the universal dashboard signals).\n" +
            "   Pass the matching `states` to forge_start_from_image. The vocabulary is fixed at start.\n" +
            "1. forge_start_from_image. Tell me the input grade in plain words FIRST (e.g. \"borderline — " +
            "gradient source, edges may look rough\"). If it grades 'silhouette' (or borderline), do NOT carve " +
            "limbs — rig it as ONE whole-body part on the Simple tier (a gentle breathe/sway) and tell me a " +
            "layered or multi-colour source is needed for separable parts.\n" +
            "2. forge_propose. Show me the regions overlay AND present the returned `plan` as a readable " +
            "table: each part, its role, the RECOMMENDED motion per state, and the alternative `options` " +
            "I could pick instead. Call out mirrored legs explicitly (e.g. \"legs: walk / walk-mirror — " +
            "mirrored so they don't move in lockstep\").\n" +
            "3. CHECKPOINT — do NOT emit until I approve. Offer me: (a) CONTINUE with the plan as shown; " +
            "(b) CHANGE a part's motion to one of its listed options; (c) CHANGE the parts — re-carve with " +
            "assign_region or rename/role with forge_apply_tweaks, then re-run forge_propose to refresh the " +
            "plan + overlay; (d) if I skipped signal states and now want them, note they must be declared " +
            "at start and offer to restart forge_start_from_image with them.\n" +
            "4. After I approve: apply the chosen presets with set_part (per state), run forge_status to " +
            "confirm coverage, then forge_emit. Give me the output file paths, and note that forge_open_editor " +
            "opens the browser editor for a LIVE motion preview (the overlay shows parts, not motion).",
        },
      },
    ],
  };
}

// Start the stdio server only when run directly (not when imported by a test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  console.error("mascot-forge MCP server ready (stdio)");
}
