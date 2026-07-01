import type { AssistantItem, ItemQuery } from "../types.js";
import { isBetween, rangesOverlap } from "./dateTime.js";

const CLOSED_STATUSES = new Set(["已完成", "已取消"]);

function splitValues(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesText(itemValue: string | undefined, accepted: string[]): boolean {
  if (accepted.length === 0) return true;
  return Boolean(itemValue && accepted.includes(itemValue));
}

function isUnfinished(item: AssistantItem): boolean {
  return !item.status || !CLOSED_STATUSES.has(item.status);
}

function itemHasKeyword(item: AssistantItem, keyword: string): boolean {
  const haystack = [
    item.title,
    item.category,
    item.type,
    item.priority,
    item.status,
    item.location,
    item.counterpart,
    item.department,
    item.deliverable,
    item.next_action,
    item.reminder_method,
    item.notes,
    item.raw_input
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(keyword.toLowerCase());
}

function itemInRange(item: AssistantItem, from?: string, to?: string): boolean {
  if (!from && !to) return true;

  const start = from || "1970-01-01T00:00:00+00:00";
  const end = to || "2999-12-31T23:59:59+00:00";

  return (
    rangesOverlap(item.start_time, item.end_time, start, end) ||
    isBetween(item.due_time, start, end) ||
    isBetween(item.receive_date, start, end)
  );
}

export function isClosed(item: AssistantItem): boolean {
  return Boolean(item.status && CLOSED_STATUSES.has(item.status));
}

export function filterItems(items: AssistantItem[], query: ItemQuery): AssistantItem[] {
  const statuses = splitValues(query.status);
  const categories = splitValues(query.category);
  const types = splitValues(query.type);
  const priorities = splitValues(query.priority);

  return items.filter((item) => {
    if (query.status === "未完成" && !isUnfinished(item)) return false;
    if (query.status !== "未完成" && !matchesText(item.status, statuses)) return false;
    if (!matchesText(item.category, categories)) return false;
    if (!matchesText(item.type, types)) return false;
    if (!matchesText(item.priority, priorities)) return false;
    if (!itemInRange(item, query.from, query.to)) return false;
    if (query.keyword && !itemHasKeyword(item, query.keyword)) return false;
    return true;
  });
}
