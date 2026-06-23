// server.mjs — mascot-forge MCP server (stdio). Thin wiring of the M1 tools (tools.mjs) to the official
// SDK. Logging goes to stderr only (stdout is the MCP protocol stream). Run: `node mcp/server.mjs`,
// or wire it into an agent host via .mcp.json (see README). buildServer() is exported so a smoke test
// can construct it without opening the stdio transport.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFromImage, assignRegion, forgeEmit } from "./tools.mjs";

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
        "Roles alone produce animation (a default preset per role is applied).",
    }
  );

  server.registerTool(
    "forge_start_from_image",
    {
      description:
        "Start a rig session from a PNG (base64 preferred; or a project-relative path). Vectorises + " +
        "proposes coarse parts. Returns { session, viewBox, parts:[{id,role,rectCount,bbox}] }. The auto " +
        "parts are a hint — re-segment with assign_region by what you SEE.",
      inputSchema: {
        base64: z.string().optional(),
        path: z.string().optional(),
        colors: z.number().int().min(1).max(32).optional(),
        maxDim: z.number().int().min(16).max(1024).optional(),
      },
    },
    async (a) => { try { return ok(startFromImage(a)); } catch (e) { return fail(e); } }
  );

  server.registerTool(
    "assign_region",
    {
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
    "forge_emit",
    {
      description:
        "Validate the rig and emit a self-contained animated mascot (SVG that animates on its own + a " +
        "demo HTML). Roles are enough. Writes to outDir (project-relative) if given, else returns sizes. " +
        "Returns { ok, validation, ... } — if ok is false, fix the parts/roles and retry.",
      inputSchema: {
        session: z.string(),
        assetName: z.string().optional(),
        outDir: z.string().optional(),
      },
    },
    async (a) => { try { return ok(forgeEmit(a)); } catch (e) { return fail(e); } }
  );

  return server;
}

// Start the stdio server only when run directly (not when imported by a test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  console.error("mascot-forge MCP server ready (stdio)");
}
