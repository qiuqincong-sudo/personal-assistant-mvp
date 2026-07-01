export const FEISHU_FIELD_MAP = {
  title: "标题",
  category: "分类",
  type: "类型",
  priority: "优先级",
  status: "状态",
  receive_date: "接收日期",
  start_time: "开始时间",
  end_time: "结束时间",
  due_time: "截止时间",
  location: "地点",
  counterpart: "对接人",
  department: "对接部门",
  deliverable: "交付物",
  next_action: "下一步动作",
  estimated_duration: "预计耗时",
  reminder_method: "提醒方式",
  sync_calendar: "是否同步日历",
  calendar_event_id: "日历事件ID",
  notes: "备注",
  raw_input: "原始输入"
} as const;

export type ItemFieldKey = keyof typeof FEISHU_FIELD_MAP;

export const DATE_FIELD_KEYS: ItemFieldKey[] = [
  "receive_date",
  "start_time",
  "end_time",
  "due_time"
];

export const BOOLEAN_FIELD_KEYS: ItemFieldKey[] = ["sync_calendar"];
