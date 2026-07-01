import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildTodayBriefing } from "../../src/lib/briefing.js";
import { queryString, requireMethod, sendJson, withApiHandler } from "../../src/lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await withApiHandler(req, res, async () => {
    requireMethod(req, ["GET"]);

    const briefing = await buildTodayBriefing(queryString(req.query.date));
    sendJson(res, 200, briefing);
  });
}
