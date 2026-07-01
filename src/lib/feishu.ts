import { getFeishuConfig, type FeishuConfig } from "../config.js";
import type { AssistantItem, AssistantItemInput, AssistantItemPatch } from "../types.js";
import { HttpError } from "./http.js";
import {
  applyCreateDefaults,
  feishuRecordToItem,
  itemInputToFeishuFields,
  type FeishuRecord
} from "./itemMapper.js";

interface TenantTokenResponse {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
}

interface FeishuApiResponse<T> {
  code: number;
  msg?: string;
  data: T;
}

interface ListRecordsData {
  items?: FeishuRecord[];
  has_more?: boolean;
  page_token?: string;
}

interface RecordData {
  record: FeishuRecord;
}

let cachedTenantToken: { token: string; expiresAt: number } | undefined;

export class FeishuClient {
  private config: FeishuConfig;

  constructor(config: FeishuConfig = getFeishuConfig()) {
    this.config = config;
  }

  async createItem(input: AssistantItemInput): Promise<AssistantItem> {
    const fields = itemInputToFeishuFields(applyCreateDefaults(input));
    const data = await this.request<RecordData>(
      `/open-apis/bitable/v1/apps/${encodeURIComponent(this.config.appToken)}/tables/${encodeURIComponent(
        this.config.tableId
      )}/records`,
      {
        method: "POST",
        body: JSON.stringify({ fields })
      }
    );

    return feishuRecordToItem(data.record);
  }

  async listItems(): Promise<AssistantItem[]> {
    const records: FeishuRecord[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ page_size: "500" });
      if (pageToken) params.set("page_token", pageToken);

      const data = await this.request<ListRecordsData>(
        `/open-apis/bitable/v1/apps/${encodeURIComponent(this.config.appToken)}/tables/${encodeURIComponent(
          this.config.tableId
        )}/records?${params.toString()}`,
        { method: "GET" }
      );

      records.push(...(data.items || []));
      pageToken = data.has_more ? data.page_token : undefined;
    } while (pageToken);

    return records.map(feishuRecordToItem);
  }

  async getItem(recordId: string): Promise<AssistantItem> {
    const data = await this.request<RecordData>(
      `/open-apis/bitable/v1/apps/${encodeURIComponent(this.config.appToken)}/tables/${encodeURIComponent(
        this.config.tableId
      )}/records/${encodeURIComponent(recordId)}`,
      { method: "GET" }
    );

    return feishuRecordToItem(data.record);
  }

  async updateItem(recordId: string, patch: AssistantItemPatch): Promise<AssistantItem> {
    const fields = itemInputToFeishuFields(patch);
    const data = await this.request<RecordData>(
      `/open-apis/bitable/v1/apps/${encodeURIComponent(this.config.appToken)}/tables/${encodeURIComponent(
        this.config.tableId
      )}/records/${encodeURIComponent(recordId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ fields })
      }
    );

    return feishuRecordToItem(data.record);
  }

  private async getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedTenantToken && cachedTenantToken.expiresAt > now + 60_000) {
      return cachedTenantToken.token;
    }

    const response = await fetch(`${this.config.apiBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_secret: this.config.appSecret
      })
    });

    const payload = (await response.json().catch(() => undefined)) as TenantTokenResponse | undefined;
    if (!response.ok || !payload || payload.code !== 0 || !payload.tenant_access_token) {
      throw new HttpError(response.status || 502, "Failed to get Feishu tenant access token", payload);
    }

    cachedTenantToken = {
      token: payload.tenant_access_token,
      expiresAt: now + (payload.expire || 7200) * 1000
    };

    return cachedTenantToken.token;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const token = await this.getTenantAccessToken();
    const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {})
      }
    });

    const payload = (await response.json().catch(() => undefined)) as FeishuApiResponse<T> | undefined;
    if (!response.ok || !payload || payload.code !== 0) {
      throw new HttpError(response.status || 502, "Feishu API request failed", payload);
    }

    return payload.data;
  }
}
