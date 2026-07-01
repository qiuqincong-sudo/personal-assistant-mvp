import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AssistantItemInput, ItemQuery } from "../../src/types.js";
import { FeishuClient } from "../../src/lib/feishu.js";
import { filterItems } from "../../src/lib/filters.js";
import { filterValidAssistantItems, shouldIncludeEmptyItems } from "../../src/lib/itemCleaning.js";
import { parseJsonBody, queryString, requireMethod, sendJson, withApiHandler } from "../../src/lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await withApiHandler(req, res, async () => {
    requireMethod(req, ["GET", "POST"]);
    const feishu = new FeishuClient();

    if (req.method === "POST") {
      const body = await parseJsonBody<AssistantItemInput>(req);
      if (!body.title?.trim()) {
        sendJson(res, 400, { error: "title is required" });
        return;
      }

      const item = await feishu.createItem(body);
      sendJson(res, 201, { item });
      return;
    }

    const query: ItemQuery = {
      status: queryString(req.query.status),
      category: queryString(req.query.category),
      type: queryString(req.query.type),
      from: queryString(req.query.from),
      to: queryString(req.query.to),
      priority: queryString(req.query.priority),
      keyword: queryString(req.query.keyword)
    };

    const rawItems = await feishu.listItems();
    const sourceItems = shouldIncludeEmptyItems(req.query.include_empty) ? rawItems : filterValidAssistantItems(rawItems);
    const items = filterItems(sourceItems, query);
    sendJson(res, 200, { items, count: items.length });
  });
}
