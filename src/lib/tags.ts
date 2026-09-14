import type { Tags } from "./types";

export const DO_TAGS = [
  "冥想", "运动", "睡眠饮食", "阅读", "外语", "专业学习", "写作表达",
  "社交", "职场", "理财", "效率工具", "编程", "生活整理", "其他",
] as const;

export const TRAIN_TAGS = [
  "专注", "胆识", "自律", "耐心", "好奇", "决断", "同理", "体能", "独立思考", "审美",
] as const;

const MAX_PER_DIM = 2;

function pick(raw: unknown, vocab: readonly string[]): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const out: string[] = [];
  for (const v of list) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!vocab.includes(s) || out.includes(s)) continue;
    out.push(s);
    if (out.length >= MAX_PER_DIM) break;
  }
  return out;
}

/** 过滤词表外的值、去重、每维最多两个；do 为空时补「其他」 */
export function normalizeTags(raw: unknown): Tags {
  const r = (raw && typeof raw === "object" ? raw : {}) as { do?: unknown; train?: unknown };
  const doTags = pick(r.do, DO_TAGS);
  return { do: doTags.length ? doTags : ["其他"], train: pick(r.train, TRAIN_TAGS) };
}
