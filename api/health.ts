import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, requireMethod, sendJson } from "../src/lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (handleOptions(req, res)) return;
    requireMethod(req, ["GET"]);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    sendJson(res, 500, { error: message });
  }
}
