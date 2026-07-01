import type { AssistantItem } from "../types.js";

const PLACEHOLDER_TITLE = "(未命名事项)";

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && trimmed !== PLACEHOLDER_TITLE;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

export function hasValidTitle(item: AssistantItem): boolean {
  const title = normalizedText(item.title);
  return title !== "" && title !== PLACEHOLDER_TITLE;
}

export function hasAnyEffectiveField(item: AssistantItem): boolean {
  const values = [
    item.title,
    item.category,
    item.type,
    item.priority,
    item.status,
    item.receive_date,
    item.start_time,
    item.end_time,
    item.due_time,
    item.location,
    item.counterpart,
    item.department,
    item.deliverable,
    item.next_action,
    item.estimated_duration,
    item.reminder_method,
    item.sync_calendar,
    item.calendar_event_id,
    item.notes,
    item.raw_input
  ];

  return values.some(hasMeaningfulValue);
}

export function isValidAssistantItem(item: AssistantItem): boolean {
  return hasValidTitle(item) && hasAnyEffectiveField(item);
}

export function filterValidAssistantItems(items: AssistantItem[]): AssistantItem[] {
  return items.filter(isValidAssistantItem);
}

export function shouldIncludeEmptyItems(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "true" || rawValue === "1" || rawValue === "yes";
}
