import { DATE_FIELD_KEYS, FEISHU_FIELD_MAP, type ItemFieldKey } from "../fieldMapping.js";
import type { AssistantItem, AssistantItemInput, AssistantItemPatch } from "../types.js";
import { pickColor } from "./colors.js";
import { toLocalIso, toTimestamp } from "./dateTime.js";

export interface FeishuRecord {
  record_id: string;
  fields: Record<string, unknown>;
  created_time?: number | string;
  last_modified_time?: number | string;
}

const FIELD_KEYS = Object.keys(FEISHU_FIELD_MAP) as ItemFieldKey[];

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function normalizeText(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join("");
    return joined || undefined;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return normalizeText(obj.text ?? obj.name ?? obj.value ?? obj.en_name ?? obj.link);
  }

  return undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "1", "是", "yes", "y"].includes(value.toLowerCase());
  return Boolean(value);
}

function normalizeDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" || typeof value === "string") return toLocalIso(value);
  return undefined;
}

function normalizeField(key: ItemFieldKey, value: unknown): unknown {
  if (key === "sync_calendar") return normalizeBoolean(value);
  if (DATE_FIELD_KEYS.includes(key)) return normalizeDate(value);
  return normalizeText(value);
}

export function feishuRecordToItem(record: FeishuRecord): AssistantItem {
  const fields = record.fields || {};
  const item: Record<string, unknown> = {
    id: record.record_id
  };

  for (const key of FIELD_KEYS) {
    item[key] = normalizeField(key, fields[FEISHU_FIELD_MAP[key]]);
  }

  item.title = item.title || "(未命名事项)";
  item.color = pickColor(item as unknown as AssistantItemInput);
  item.created_time = normalizeDate(record.created_time);
  item.updated_time = normalizeDate(record.last_modified_time);

  return item as unknown as AssistantItem;
}

export function itemInputToFeishuFields(input: AssistantItemInput | AssistantItemPatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const source = input as Record<string, unknown>;

  for (const key of FIELD_KEYS) {
    if (!hasOwn(source, key)) continue;

    const value = source[key];
    const fieldName = FEISHU_FIELD_MAP[key];

    if (value === null || value === undefined || value === "") {
      fields[fieldName] = null;
      continue;
    }

    if (DATE_FIELD_KEYS.includes(key)) {
      fields[fieldName] = toTimestamp(value as string | number);
      continue;
    }

    if (key === "sync_calendar") {
      fields[fieldName] = Boolean(value);
      continue;
    }

    fields[fieldName] = value;
  }

  return fields;
}

export function applyCreateDefaults(input: AssistantItemInput): AssistantItemInput {
  return {
    category: "其他",
    type: "待确认",
    priority: "P2",
    status: "未开始",
    receive_date: new Date().toISOString(),
    sync_calendar: false,
    ...input
  };
}
