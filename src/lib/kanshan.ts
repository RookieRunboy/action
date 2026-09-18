import type { ActionCard, FlashCard } from "./types";
import { itemId } from "./zhihu";

export const KANSHAN_ID = "kanshan";
export const KANSHAN_NAME = "看山";
export const KANSHAN_HANDLE = "kanshan";
export const KANSHAN_HEADLINE = "横看成岭侧成峰。值得记住的，做成闪卡给你。";

const ARTICLE = "article" as const;

function habit(action: string, why: string, url: string, quote: string): ActionCard {
  return {
    id: itemId(url + "#habit:" + action),
    kind: "action",
    folderToken: "kanshan",
    reason: "看山正在做",
    source: {
      url,
      title: "冥想静心的20个实用技巧",
      contentType: ARTICLE,
      favTime: 0,
      likeCount: 0,
      summary: quote,
      author: { name: "身心灵张超", url: "https://www.zhihu.com/people/fei-zhou-wu-liu-zhuan-jia" },
    },
    tags: { do: ["冥想"], train: ["专注"] },
    sourceQuote: quote,
    action,
    why,
    replyDraft: "按你说的，我先坐两分钟。",
  };
}

function flash(front: string, back: string, url: string, title: string, author: string, authorUrl: string, quote: string): FlashCard {
  return {
    id: itemId(url),
    kind: "flash",
    folderToken: "kanshan",
    reason: "看山觉得值得记住",
    source: {
      url,
      title,
      contentType: ARTICLE,
      favTime: 0,
      likeCount: 0,
      summary: quote,
      author: { name: author, url: authorUrl },
    },
    tags: { do: ["冥想"], train: ["专注"] },
    sourceQuote: quote,
    front,
    back,
  };
}

const U1 = "https://zhuanlan.zhihu.com/p/33950891";
const U4 = "https://zhuanlan.zhihu.com/p/93967061";
const U5 = "https://zhuanlan.zhihu.com/p/127759023";
const U6 = "https://zhuanlan.zhihu.com/p/460344179";

export const KANSHAN_HABITS: ActionCard[] = [
  habit("闭眼坐两分钟，只数呼吸", "入门不求长，先每天两分钟坐下来", U1, "直接静坐两分钟。它很简单，但你一定要专注"),
  habit("走神时微笑，从一重新数", "走神不是失败，回到呼吸才是练习", U1, "当你注意到自己思维走神时，请微笑面对"),
  habit("起床后先看到冥想再坐下", "把两分钟放到早上第一件事，才不会忘", U1, "把它当做每天早上第一件事来做"),
];

export const KANSHAN_KNOWLEDGE: FlashCard[] = [
  flash("冥想入门最短从多久开始？", "每天两分钟，连续一周。", U1, "冥想静心的20个实用技巧", "身心灵张超", "https://www.zhihu.com/people/fei-zhou-wu-liu-zhuan-jia", "直接静坐两分钟。它很简单，但你一定要专注"),
  flash("数呼吸时一呼一吸怎么数？", "吸气数一，呼气数二，数到十再从一。", U1 + "#f2", "冥想静心的20个实用技巧", "身心灵张超", "https://www.zhihu.com/people/fei-zhou-wu-liu-zhuan-jia", "当吸入空气时，直接把个人注意力放在呼吸运动上"),
  flash("走神了该怎么办？", "微笑，轻轻回到呼吸，从一重新数。", U1 + "#f3", "冥想静心的20个实用技巧", "身心灵张超", "https://www.zhihu.com/people/fei-zhou-wu-liu-zhuan-jia", "当你注意到自己思维走神时，请微笑面对"),
  flash("初学冥想必须纠结坐垫吗？", "不必。椅子、沙发、床都可以，身体挺直就行。", U4, "冥想初学者指南(附详细练习教程)", "Now冥想", "https://www.zhihu.com/people/nowming-xiang", "像国王和王后一样安静的坐着"),
  flash("数息法数到几再从头？", "数到十，再从一开始。", U5, "4种呼吸练习方法详解", "wayne 史", "https://www.zhihu.com/people/shi-wei-68", "吸气时，在心里数1，呼气时，在心里数1"),
  flash("为什么冥想叫练习不是做好？", "不要期望一开始就表现良好，所以叫练习。", U6, "冥想静心的20个实用技巧(建议收藏)", "盖娅Uni", "https://www.zhihu.com/people/gaeauni", "请别期待一开始就能表现良好"),
];
