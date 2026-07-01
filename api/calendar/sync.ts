import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGoogleConfig } from "../../src/config.js";
import { FeishuClient } from "../../src/lib/feishu.js";
import { GoogleCalendarClient } from "../../src/lib/googleCalendar.js";
import { parseJsonBody, requireMethod, sendJson, withApiHandler } from "../../src/lib/http.js";

interface SyncRequest {
  item_id?: string;
  id?: string;
}

function getMissingGoogleEnv(): string[] {
  return ["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_CALENDAR_ID"].filter((name) => !process.env[name]);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await withApiHandler(req, res, async () => {
    requireMethod(req, ["POST"]);

    const missingGoogleEnv = getMissingGoogleEnv();
    if (missingGoogleEnv.length > 0) {
      sendJson(res, 503, {
        error: "Google Calendar is not configured",
        missing_env: missingGoogleEnv
      });
      return;
    }

    const body = await parseJsonBody<SyncRequest>(req);
    const itemId = body.item_id || body.id;
    if (!itemId) {
      sendJson(res, 400, { error: "item_id is required" });
      return;
    }

    const feishu = new FeishuClient();
    const google = new GoogleCalendarClient(getGoogleConfig());
    const item = await feishu.getItem(itemId);
    const event = await google.upsertEventFromItem(item);
    const updatedItem = await feishu.updateItem(itemId, {
      calendar_event_id: event.id,
      sync_calendar: true
    });

    sendJson(res, 200, { item: updatedItem, calendar_event: event });
  });
}
