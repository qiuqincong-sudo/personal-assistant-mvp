import { getAppConfig } from "../config.js";
import type { AssistantItem, BriefingResponse, NeedsInfoItem, TimelineEntry } from "../types.js";
import { pickColor, withColor } from "./colors.js";
import { addDaysToDateString, isBetween, localDayRange, todayDateString, toTimestamp } from "./dateTime.js";
import { FeishuClient } from "./feishu.js";
import { isClosed } from "./filters.js";
import { filterValidAssistantItems } from "./itemCleaning.js";

function itemTimelineEntry(item: AssistantItem): TimelineEntry {
  return {
    source: "task_pool",
    item_id: item.id,
    title: item.title,
    start_time: item.start_time || item.due_time || undefined,
    end_time: item.end_time || undefined,
    category: item.category,
    priority: item.priority,
    location: item.location,
    color: pickColor(item)
  };
}

function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.sort((a, b) => {
    const left = toTimestamp(a.start_time) ?? Number.MAX_SAFE_INTEGER;
    const right = toTimestamp(b.start_time) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.title.localeCompare(b.title, "zh-CN");
  });
}

function isP0OrP1(item: AssistantItem): boolean {
  return item.priority === "P0" || item.priority === "P1";
}

function hasCalendarCandidateTime(item: AssistantItem): boolean {
  return Boolean(item.start_time || item.due_time);
}

function getMissingFields(item: AssistantItem): string[] {
  const missing: string[] = [];

  if (!item.start_time && !item.due_time) {
    missing.push("时间");
  }

  if ((item.type === "日程" || item.category === "会议活动") && !item.location) {
    missing.push("地点");
  }

  if ((item.type === "任务" || item.type === "长期项目" || item.type === "提醒") && !item.due_time) {
    missing.push("截止时间");
  }

  if (
    (item.type === "提醒" ||
      item.priority === "P0" ||
      item.priority === "P1" ||
      item.category === "消费账单" ||
      item.category === "健康" ||
      item.category === "宠物") &&
    !item.reminder_method
  ) {
    missing.push("提醒方式");
  }

  return missing;
}

function buildNeedsInfoItem(item: AssistantItem): NeedsInfoItem | undefined {
  const missingFields = getMissingFields(item);
  if (missingFields.length === 0) return undefined;

  return {
    ...item,
    missing_fields: missingFields
  };
}

export async function buildTodayBriefing(dateOverride?: string): Promise<BriefingResponse> {
  const config = getAppConfig();
  const date = dateOverride || todayDateString(config.timezone);
  const todayRange = localDayRange(date);
  const dueSoonEnd = `${addDaysToDateString(date, config.briefingDueSoonDays)}T00:00:00${config.timezoneOffset}`;

  const feishu = new FeishuClient();
  const allItems = filterValidAssistantItems(await feishu.listItems()).map((item) => withColor(item, todayRange));
  const activeItems = allItems.filter((item) => !isClosed(item));
  const todayItems = activeItems.filter((item) => isBetween(item.start_time, todayRange.start, todayRange.end));
  const needsInfoItems = activeItems
    .map(buildNeedsInfoItem)
    .filter((item): item is NeedsInfoItem => Boolean(item));

  return {
    date,
    today_timeline: sortTimeline(todayItems.map(itemTimelineEntry)),
    p0_p1_items: activeItems.filter(isP0OrP1),
    due_soon_items: activeItems.filter((item) => item.due_time && isBetween(item.due_time, todayRange.start, dueSoonEnd)),
    pending_confirmation_items: activeItems.filter((item) => item.status === "待确认"),
    waiting_feedback_items: activeItems.filter((item) => item.status === "等待反馈"),
    unsynced_calendar_items: activeItems.filter((item) => {
      return hasCalendarCandidateTime(item) && item.sync_calendar !== true && !item.calendar_event_id;
    }),
    needs_info_items: needsInfoItems
  };
}
