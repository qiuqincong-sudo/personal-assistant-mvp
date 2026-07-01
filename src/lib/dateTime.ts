import { getAppConfig } from "../config.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function offsetToMinutes(offset: string): number {
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!match) {
    throw new Error(`Invalid APP_TIMEZONE_OFFSET: ${offset}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function toTimestamp(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value;

  const config = getAppConfig();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00${config.timezoneOffset}`
    : value;
  const ms = Date.parse(normalized);

  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid date/time value: ${value}`);
  }

  return ms;
}

export function toLocalIso(value: string | number | null | undefined): string | undefined {
  const ms = toTimestamp(value);
  if (ms === undefined) return undefined;

  const offset = getAppConfig().timezoneOffset;
  const local = new Date(ms + offsetToMinutes(offset) * MINUTE_MS);

  return [
    local.getUTCFullYear(),
    "-",
    pad(local.getUTCMonth() + 1),
    "-",
    pad(local.getUTCDate()),
    "T",
    pad(local.getUTCHours()),
    ":",
    pad(local.getUTCMinutes()),
    ":",
    pad(local.getUTCSeconds()),
    offset
  ].join("");
}

export function addMinutes(value: string, minutes: number): string {
  const ms = toTimestamp(value);
  if (ms === undefined) {
    throw new Error("Cannot add minutes to an empty date/time value");
  }

  return toLocalIso(ms + minutes * MINUTE_MS) as string;
}

export function todayDateString(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format today's date");
  }

  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

export function localDayRange(date: string): { start: string; end: string } {
  const offset = getAppConfig().timezoneOffset;
  return {
    start: `${date}T00:00:00${offset}`,
    end: `${addDaysToDateString(date, 1)}T00:00:00${offset}`
  };
}

export function isBetween(value: string | null | undefined, start: string, end: string): boolean {
  const ms = toTimestamp(value);
  const startMs = toTimestamp(start);
  const endMs = toTimestamp(end);

  if (ms === undefined || startMs === undefined || endMs === undefined) return false;
  return ms >= startMs && ms < endMs;
}

export function rangesOverlap(
  itemStart: string | null | undefined,
  itemEnd: string | null | undefined,
  rangeStart: string,
  rangeEnd: string
): boolean {
  if (!itemStart) return false;

  const startMs = toTimestamp(itemStart);
  const endMs = toTimestamp(itemEnd) ?? startMs;
  const rangeStartMs = toTimestamp(rangeStart);
  const rangeEndMs = toTimestamp(rangeEnd);

  if (
    startMs === undefined ||
    endMs === undefined ||
    rangeStartMs === undefined ||
    rangeEndMs === undefined
  ) {
    return false;
  }

  return startMs < rangeEndMs && endMs >= rangeStartMs;
}
