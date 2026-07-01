import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AssistantItemPatch } from "../../src/types.js";
import { FeishuClient } from "../../src/lib/feishu.js";
import { getPathParam, parseJsonBody, requireMethod, sendJson, withApiHandler } from "../../src/lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await withApiHandler(req, res, async () => {
    requireMethod(req, ["PATCH"]);

    const id = getPathParam(req.query.id, "id");
    const body = await parseJsonBody<AssistantItemPatch>(req);
    const item = await new FeishuClient().updateItem(id, body);

    sendJson(res, 200, { item });
  });
}
