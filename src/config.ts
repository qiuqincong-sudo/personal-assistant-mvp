export interface AppConfig {
  apiSharedSecret: string;
  timezone: string;
  timezoneOffset: string;
  defaultEventDurationMinutes: number;
  briefingDueSoonDays: number;
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableId: string;
  apiBaseUrl: string;
}

export interface GoogleConfig {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
  timezone: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsed;
}

export function getAppConfig(): AppConfig {
  return {
    apiSharedSecret: requireEnv("API_SHARED_SECRET"),
    timezone: process.env.APP_TIMEZONE || "Asia/Shanghai",
    timezoneOffset: process.env.APP_TIMEZONE_OFFSET || "+08:00",
    defaultEventDurationMinutes: numberEnv("DEFAULT_EVENT_DURATION_MINUTES", 60),
    briefingDueSoonDays: numberEnv("BRIEFING_DUE_SOON_DAYS", 3)
  };
}

export function getFeishuConfig(): FeishuConfig {
  return {
    appId: requireEnv("FEISHU_APP_ID"),
    appSecret: requireEnv("FEISHU_APP_SECRET"),
    appToken: requireEnv("FEISHU_BITABLE_APP_TOKEN"),
    tableId: requireEnv("FEISHU_BITABLE_TABLE_ID"),
    apiBaseUrl: process.env.FEISHU_API_BASE_URL || "https://open.feishu.cn"
  };
}

export function getGoogleConfig(): GoogleConfig {
  return {
    clientEmail: requireEnv("GOOGLE_CLIENT_EMAIL"),
    privateKey: requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    calendarId: requireEnv("GOOGLE_CALENDAR_ID"),
    timezone: process.env.APP_TIMEZONE || "Asia/Shanghai"
  };
}
