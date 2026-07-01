import type { AssistantItem, AssistantItemInput, ColorName } from "../types.js";
import { isBetween } from "./dateTime.js";

export const GOOGLE_COLOR_ID_BY_NAME: Record<ColorName, string> = {
  red: "11",
  green: "10",
  purple: "3",
  gray: "8",
  blue: "9",
  yellow: "5",
  orange: "6"
};

function textOf(item: AssistantItemInput): string {
  return [
    item.title,
    item.category,
    item.type,
    item.location,
    item.deliverable,
    item.next_action,
    item.notes,
    item.raw_input
  ]
    .filter(Boolean)
    .join(" ");
}

export function pickColor(item: AssistantItemInput, todayRange?: { start: string; end: string }): ColorName {
  const text = textOf(item);

  if (
    item.priority === "P0" ||
    (todayRange && item.due_time && isBetween(item.due_time, todayRange.start, todayRange.end))
  ) {
    return "red";
  }

  if (item.category === "自媒体" || /自媒体|内容|选题|脚本|发布|剪辑/.test(text)) {
    return "green";
  }

  if (item.category === "会议活动" || /文创|竞赛|设计|会议|活动/.test(text)) {
    return "purple";
  }

  if (/表格|报表|资料整理|整理资料|台账/.test(text)) {
    return "gray";
  }

  if (item.category === "消费账单" || /账单|还款|消费|付款|缴费/.test(text)) {
    return "yellow";
  }

  if (item.category === "健康" || item.category === "宠物" || /体检|复诊|用药|疫苗|宠物/.test(text)) {
    return "orange";
  }

  return "blue";
}

export function withColor<T extends AssistantItem>(item: T, todayRange?: { start: string; end: string }): T {
  return {
    ...item,
    color: pickColor(item, todayRange)
  };
}
