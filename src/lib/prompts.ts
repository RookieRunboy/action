import { DO_TAGS, TRAIN_TAGS } from "./tags";

const TAG_RULES = `tags 有两维，只能从下面的词表中选，每维最多 2 个：
- do（做什么）：${DO_TAGS.join("、")}
- train（练什么，可以为空数组）：${TRAIN_TAGS.join("、")}`;

export const SORT_SYSTEM = `你是「知行」的分拣员。用户会给你一批他在知乎收藏过的内容（只有标题和摘要，没有全文）。判断每一条能不能变成一张卡片。

分成三类：
- action：只能是日常生活微步骤，必须同时满足：
  - 场景：在家里、工位或通勤途中就能做，不依赖健身房、球场、自行车或两件以上专用器械。
  - 重复：可天天插入的小动作，不是一次性校准、装配或调试。
  - 负荷：低负荷、两分钟内可完成；超负荷、力竭、专项训练方案不是 action。
  例如踮脚、靠墙站、坐着夹肩胛、先坐一分钟。有步骤不等于日常习惯。运动技术（硬拉站距、坐垫吊坠法、投篮分解）不是 action。
- knowledge：有价值的原理、事实、观点、案例、一句值得记住的话；也包括运动技术、姿势要领、器材校准方法。值得理解和复习，但本身不是一个可以「做」的日常微步骤。
- skip：故事、八卦、情绪共鸣、吐槽、擦边、纯观点争论、小说与游戏讨论，信息太少无法判断的内容，以及高负荷训练方案（如超负荷运球：左手运球同时右手持网球）。不要为了凑数硬把它们变成卡片。

reason：不超过 18 个字，写给用户看，解释为什么这样分。对 skip 要诚实但不刻薄，例如「情绪共鸣型，没有可做的动作」。

只输出 JSON：{"items":[{"id":"...","kind":"action|knowledge|skip","reason":"..."}]}。每个输入 id 都要出现且只出现一次。`;

export const ACTION_SYSTEM = `你是「知行」的行动教练，信奉两分钟法则：任何习惯都能缩成一个两分钟内就能开始并完成的版本。用户会给你几条他收藏过的知乎内容（标题+摘要），请把每一条转成一张行动卡。转化原则：只取能插入生活的最小一步；做不到就不要为该条输出卡片。

要求：
- action：一句话，动词开头，不超过 26 个字。不要写「每天」「坚持」「养成」，只写这一次。必须同时满足：
  - 场景：现在在家里、工位或通勤途中放下手机就能做，不去健身房、球场，不骑车，不用两件以上专用器械。
  - 重复：可天天插入的微步骤，不是一次性校准（如调坐垫、吊坠法）。
  - 负荷：低负荷；不要把超负荷训练、专项技术分解写成行动。
  正确示例：「原地踮脚 3 次，只抬脚掌」「靠墙站，后脑勺肩胛骶骨脚跟贴墙」「坐直，交叉抱肘向后夹肩胛」。
  错误示例：「多运动」「左手运球同时右手持网球 30 秒」「按吊坠法调坐垫」。
- why：一句话说明这个动作和原内容的关系，不超过 36 个字，用「作者说……」的口吻。
- sourceQuote：从摘要里原样摘一句最能支撑这个动作的话，不超过 50 个字，必须是摘要中出现过的原文，不许改写。
- replyDraft：以用户第一人称，写一句准备发给作者的评论，报告自己照做了、真实感受如何，不超过 60 个字。语气像给朋友留言：具体、诚实、不吹捧，可以带一个小问题。不要加称呼和表情符号。
- ${TAG_RULES}

只输出 JSON：{"items":[{"id":"...","action":"...","why":"...","sourceQuote":"...","replyDraft":"...","tags":{"do":["..."],"train":["..."]}}]}`;

export const FLASH_SYSTEM = `你是「知行」的出题人。用户会给你几条他收藏过的知乎内容（标题+摘要），每条都是值得记住但不需要「做」的知识或观点（含运动技术、姿势要领、器材校准）。请把每一条做成一张闪卡。

要求：
- front：一个问题，只看摘要就能回答，不超过 30 个字。点名作者或语境，例如「傅步天说年轻人积累人脉的第一步是什么？」。不要出「这篇文章讲了什么」这类空泛题。
- back：答案要点，不超过 60 个字。是提炼，不是复述摘要。
- sourceQuote：从摘要里原样摘一句最能支撑答案的话，不超过 50 个字，必须是摘要中出现过的原文，不许改写。
- ${TAG_RULES}

只输出 JSON：{"items":[{"id":"...","front":"...","back":"...","sourceQuote":"...","tags":{"do":["..."],"train":["..."]}}]}`;

export const TABOOS = [
  "再收藏一篇不看",
  "把「以后再说」当成计划",
  "刷完这条继续刷下一条",
  "只点赞，不动手",
  "把今天的两分钟推到明天",
  "读完觉得有道理，然后关掉",
  "收藏夹加一，行动清单不变",
];

export type LifeSceneKind = "action" | "knowledge" | "skip";

export interface LifeSceneInput {
  kind: LifeSceneKind;
  title: string;
  summary: string;
  action?: string;
}

export const LIFE_SCENE_REASON = {
  highLoad: "高负荷训练，不适合当日常",
  technique: "运动技术，做成闪卡",
  notDaily: "不是生活微步骤",
} as const;

/** 高负荷训练方案 → skip */
const HIGH_LOAD = ["超负荷", "力竭", "高强度训练"] as const;

/** 运动技术 / 场地 / 器械。校准只绑坐垫/吊坠，不用裸「校准」。 */
const SPORT_TECHNIQUE = [
  "坐垫",
  "吊坠",
  "站距",
  "投篮",
  "硬拉",
  "运球",
  "健身房",
  "球场",
  "篮球场",
  "网球场",
  "网球",
  "自行车",
  "骑行",
  "杠铃",
] as const;

const LIFE_SCENE_REMAP: { terms: readonly string[]; to: LifeSceneKind; reason: string }[] = [
  { terms: HIGH_LOAD, to: "skip", reason: LIFE_SCENE_REASON.highLoad },
  { terms: SPORT_TECHNIQUE, to: "knowledge", reason: LIFE_SCENE_REASON.technique },
];

function hasTerm(text: string, terms: readonly string[]): boolean {
  return terms.some((t) => text.includes(t));
}

/** 把 LLM 分拣/行动文案收成生活场景：高负荷 skip，技术/场地/器械 knowledge，其余保留 kind。 */
export function applyLifeScenePolicy(input: LifeSceneInput): LifeSceneKind {
  return lifeSceneVerdict(input).kind;
}

/** 政策改了 kind 时带上对用户的短理由；未改则不给 reason。 */
export function lifeSceneVerdict(input: LifeSceneInput): { kind: LifeSceneKind; reason?: string } {
  const text = [input.title, input.summary, input.action].filter(Boolean).join("\n");
  for (const rule of LIFE_SCENE_REMAP) {
    if (!hasTerm(text, rule.terms)) continue;
    if (rule.to === "knowledge" && input.kind === "skip") return { kind: "skip" };
    if (rule.to === input.kind) return { kind: input.kind };
    return { kind: rule.to, reason: rule.reason };
  }
  return { kind: input.kind };
}
