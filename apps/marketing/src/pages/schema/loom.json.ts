import type { APIRoute } from "astro";

import { buildLoomProjectFileJsonSchema } from "@loom/shared/loomProjectFile";

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(buildLoomProjectFileJsonSchema(), null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
