import crypto from "node:crypto";
import { getAppConfig, getGoogleConfig, type GoogleConfig } from "../config.js";
import type { AssistantItem } from "../types.js";
import { addMinutes } from "./dateTime.js";
import { GOOGLE_COLOR_ID_BY_NAME, pickColor } from "./colors.js";
import { HttpError } from "./http.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

interface GoogleEventsListResponse {
  items?: GoogleCalendarEvent[];
}

let cachedGoogleToken: { token: string; expiresAt: number } | undefined;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseDurationMinutes(value: AssistantItem["estimated_duration"]): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "string") return undefined;

  const hours = /(\d+(?:\.\d+)?)\s*(小时|hour|hours|h)\b/i.exec(value);
  if (hours) return Math.round(Number(hours[1]) * 60);

  const minutes = /(\d+(?:\.\d+)?)\s*(分钟|minute|minutes|min|m)\b/i.exec(value);
  if (minutes) return Math.round(Number(minutes[1]));

  const plainNumber = /^\d+(?:\.\d+)?$/.exec(value.trim());
  if (plainNumber) return Math.round(Number(value));

  return undefined;
}

function buildDescription(item: AssistantItem): string {
  const rows = [
    ["来源", "个人助理系统 / 飞书多维表"],
    ["事项ID", item.id],
    ["分类", item.category],
    ["类型", item.type],
    ["优先级", item.priority],
    ["状态", item.status],
    ["下一步动作", item.next_action],
    ["交付物", item.deliverable],
    ["对接人", item.counterpart],
    ["对接部门", item.department],
    ["备注", item.notes],
    ["原始输入", item.raw_input]
  ];

  return rows
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function buildEventFromItem(item: AssistantItem): Omit<GoogleCalendarEvent, "id"> {
  const config = getAppConfig();
  const startTime = item.start_time || item.due_time;
  if (!startTime) {
    throw new HttpError(400, "Item must have start_time or due_time before syncing to Google Calendar");
  }

  const duration = parseDurationMinutes(item.estimated_duration);
  const fallbackDuration = item.start_time ? config.defaultEventDurationMinutes : 30;
  const endTime = item.end_time || addMinutes(startTime, duration || fallbackDuration);
  const color = pickColor(item);

  return {
    summary: item.priority ? `[${item.priority}] ${item.title}` : item.title,
    description: buildDescription(item),
    location: item.location || undefined,
    colorId: GOOGLE_COLOR_ID_BY_NAME[color],
    start: {
      dateTime: startTime,
      timeZone: config.timezone
    },
    end: {
      dateTime: endTime,
      timeZone: config.timezone
    },
    extendedProperties: {
      private: {
        assistantItemId: item.id,
        source: "feishu-bitable-assistant"
      }
    }
  };
}

export class GoogleCalendarClient {
  private config: GoogleConfig;

  constructor(config: GoogleConfig = getGoogleConfig()) {
    this.config = config;
  }

  async upsertEventFromItem(item: AssistantItem): Promise<GoogleCalendarEvent> {
    const event = buildEventFromItem(item);

    if (item.calendar_event_id) {
      try {
        return await this.patchEvent(item.calendar_event_id, event);
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 404) throw error;
      }
    }

    return this.createEvent(event);
  }

  async listEvents(timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime"
    });

    const data = await this.request<GoogleEventsListResponse>(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events?${params.toString()}`,
      { method: "GET" }
    );

    return data.items || [];
  }

  private async createEvent(event: Omit<GoogleCalendarEvent, "id">): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events`,
      {
        method: "POST",
        body: JSON.stringify(event)
      }
    );
  }

  private async patchEvent(
    eventId: string,
    event: Omit<GoogleCalendarEvent, "id">
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(event)
      }
    );
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) {
      return cachedGoogleToken.token;
    }

    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64Url(
      JSON.stringify({
        iss: this.config.clientEmail,
        scope: CALENDAR_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        exp: now + 3600,
        iat: now
      })
    );
    const unsigned = `${header}.${claims}`;
    const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(this.config.privateKey);
    const assertion = `${unsigned}.${base64Url(signature)}`;

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });

    const payload = (await response.json().catch(() => undefined)) as GoogleTokenResponse | undefined;
    if (!response.ok || !payload?.access_token) {
      throw new HttpError(response.status || 502, "Failed to get Google access token", payload);
    }

    cachedGoogleToken = {
      token: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in || 3600) * 1000
    };

    return cachedGoogleToken.token;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${GOOGLE_CALENDAR_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {})
      }
    });

    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new HttpError(response.status || 502, "Google Calendar API request failed", payload);
    }

    return payload as T;
  }
}
