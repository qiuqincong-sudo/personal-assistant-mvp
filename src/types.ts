export const CATEGORIES = [
  "工作",
  "会议活动",
  "自媒体",
  "生活",
  "健康",
  "宠物",
  "消费账单",
  "长期项目",
  "其他"
] as const;

export const ITEM_TYPES = ["任务", "日程", "提醒", "长期项目", "待确认"] as const;
export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export const STATUSES = ["未开始", "进行中", "待确认", "等待反馈", "已完成", "已取消"] as const;

export type Category = (typeof CATEGORIES)[number];
export type ItemType = (typeof ITEM_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type ItemStatus = (typeof STATUSES)[number];
export type ColorName = "red" | "green" | "purple" | "gray" | "blue" | "yellow" | "orange";

export interface AssistantItemInput {
  title: string;
  category?: Category | string;
  type?: ItemType | string;
  priority?: Priority | string;
  status?: ItemStatus | string;
  receive_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  due_time?: string | null;
  location?: string | null;
  counterpart?: string | null;
  department?: string | null;
  deliverable?: string | null;
  next_action?: string | null;
  estimated_duration?: string | number | null;
  reminder_method?: string | null;
  sync_calendar?: boolean | null;
  calendar_event_id?: string | null;
  notes?: string | null;
  raw_input?: string | null;
}

export type AssistantItemPatch = Partial<AssistantItemInput>;

export interface AssistantItem extends AssistantItemInput {
  id: string;
  color: ColorName;
  created_time?: string;
  updated_time?: string;
}

export interface ItemQuery {
  status?: string;
  category?: string;
  type?: string;
  from?: string;
  to?: string;
  priority?: string;
  keyword?: string;
}

export interface TimelineEntry {
  source: "task_pool" | "google_calendar";
  title: string;
  start_time?: string;
  end_time?: string;
  item_id?: string;
  calendar_event_id?: string;
  category?: string;
  priority?: string;
  location?: string | null;
  color?: ColorName;
}

export interface NeedsInfoItem extends AssistantItem {
  missing_fields: string[];
}

export interface BriefingResponse {
  date: string;
  today_timeline: TimelineEntry[];
  p0_p1_items: AssistantItem[];
  due_soon_items: AssistantItem[];
  pending_confirmation_items: AssistantItem[];
  waiting_feedback_items: AssistantItem[];
  unsynced_calendar_items: AssistantItem[];
  needs_info_items: NeedsInfoItem[];
}
