# 知行 · 好友（看山）设计规范

日期：2026-09-15 · 状态：已评审 · 路径分类：**Feature**（新增好友页；看山写死；「我」只读现有进度）

## 1. 背景

知行目前是一个人的日历：收藏 → 卡片 → 今日行动 / 闪卡。本轮加一个最窄的「好友」入口，用来演示：打开别人正在练的习惯和知识点，并能把看山复习的闪卡加入自己的知行。

没有服务端，真人之间看不到彼此的墙。因此好友模块**自己不存任何东西**：看山是代码常量；「我」是现有 `StateV2` 的只读投影；「加入我的知行」只写入已经存在的卡片队列。

## 2. 目标与非目标

### 目标

- 顶栏增加「好友」，进入 `/friends`。
- 列表固定两行：**看山**（上）和**我**（下）。每行露出名字、ID、最新一条文案。
- 点其中一行，弹出二级小卡片，分两块：**在执行的习惯**、**在复习的知识点**。
- 看山的知识点可翻开原文（小 icon）、可「加入我的知行」。
- 看山的人设、习惯、闪卡全部写死，原文指向真实知乎专栏。

### 非目标（本轮不做）

- 加真人好友、好友图、任何新的 localStorage 键或字段。
- 筹划页「对外展示」开关、「我的主页」独立路由。
- 看山的习惯加入知行。
- 小卡片上翻面、记得 / 模糊 / 忘了（那是今日页的事）。
- 打开主页现拉知乎、服务端同步、推送。

## 3. 用户流程

```
已登录 → 顶栏「好友」→ /friends
  列表：看山 · kanshan · 最新一张闪卡正面
        我   · <identity> · 最新一条在练文案（或「还没有在练的」）
  点看山 → 遮罩 + 二级小卡
        在执行的习惯：写死的 3 条行动文案（只读）
        在复习的知识点：写死的 6 张闪卡正面 + 原文 icon + 「加入我的知行」
        已在知行 → 按钮变为「已在知行」且 disabled
  点我 → 同样的小卡
        习惯 / 知识点来自本地 status === "active" 的卡
        没有「加入我的知行」
        两类都空 → 「还没有在练的习惯或知识点」+ 去筹划页
  Esc 或点遮罩 → 关掉小卡
```

未登录访问 `/friends` 与 `/today` 相同：重定向 `/`。

## 4. 导航

`AppShell` 的 `active` 增加 `"friends"`。顶栏顺序：

`今日` `/today` · `筹划` `/plan` · `回顾` `/review` · `好友` `/friends`

不改回顾页。

## 5. 领域模型

不修改 `StateV2`、`Card`、`CardState`。好友页只读、只通过下面两个纯函数写回已有结构。

### 5.1 投影 `FriendPeek`

```ts
export const PEEK_CAP = 5;

export interface PeekItem {
  id: string;
  text: string;          // 习惯 = action；知识点 = front
  kind: "action" | "flash";
  sourceUrl?: string;    // 仅闪卡
}

export interface FriendPeek {
  habits: PeekItem[];
  knowledge: PeekItem[];
  remainingHabits: number;
  remainingKnowledge: number;
  latest: string;        // 列表第三列
}
```

`latest` 规则：优先第一张知识点 `text`；否则第一张习惯 `text`；都没有则为 `还没有在练的`。

列表截断：习惯、知识点各最多 `PEEK_CAP` 条；超出部分计入 `remaining*`，小卡底部写「还有 N 项」。

### 5.2 `peekMe(state: StateV2): FriendPeek`

从 `state.states` 取 `status === "active"` 的卡，用 `state.cards[id]` 取内容。

- 习惯：`kind === "action"`，`text = action`
- 知识点：`kind === "flash"`，`text = front`，`sourceUrl = source.url`
- 排序：`addedAt` 升序，同分 `id` 升序
- `queued` / `dismissed` / `internalized` / 缺快照的 id 都不出现

### 5.3 `peekKanshan(): FriendPeek`

从 `src/lib/kanshan.ts` 的常量投影。看山恒有 3 条习惯、6 张知识点，不超过 cap，`remaining* = 0`。`latest` 为第一张闪卡正面。

### 5.4 `adoptFlash(state, card, now): { state: StateV2; outcome: "added" | "already" | "requeued" }`

只用于看山的闪卡。

| 本地 `states[card.id]` | 行为 | outcome |
|---|---|---|
| 无 | 写入 `cards[id] = card`，`states[id] = newCardState(id, "flash", now)`（`queued`） | `added` |
| `queued` / `active` / `internalized` | 原状态不动 | `already` |
| `dismissed` | `status = "queued"`，`box = 0`，`due = null`，`introducedAt = null`，`addedAt = now`，history 保留，快照覆盖为传入 card | `requeued` |

不修改 `queues`、`folders`、`lastFolder`。卡 `id` 必须等于 `itemId(card.source.url)`，与收藏扫描同一套，同一原文以后撞上同一张卡。

`folderToken` 固定 `"kanshan"`。

## 6. 看山常量

文件：`src/lib/kanshan.ts`。

```ts
export const KANSHAN_ID = "kanshan";
export const KANSHAN_NAME = "看山";
export const KANSHAN_HANDLE = "kanshan";
export const KANSHAN_HEADLINE = "横看成岭侧成峰。值得记住的，做成闪卡给你。";
export const KANSHAN_HABITS: ActionCard[];     // 3
export const KANSHAN_KNOWLEDGE: FlashCard[];   // 6
```

文案遵守现有裁剪：`action ≤ 40`、`why ≤ 60`、`front ≤ 40`、`back ≤ 80`、`sourceQuote ≤ 60`、`reason ≤ 30`。`sourceQuote` 必须能在对应专栏摘要里对上（去标点空白后为子串）；对不上则用摘要第一句。

标签从现有词表取：习惯 `do: ["冥想"]` `train: ["专注"]`；知识点同。

### 6.1 习惯（只读，不能加入）

原文均 `https://zhuanlan.zhihu.com/p/33950891`，作者 身心灵张超，`contentType: "article"`。

1. action: `闭眼坐两分钟，只数呼吸` · why: `入门不求长，先每天两分钟坐下来`
2. action: `走神时微笑，从一重新数` · why: `走神不是失败，回到呼吸才是练习`
3. action: `起床后先看到冥想再坐下` · why: `把两分钟放到早上第一件事，才不会忘`

### 6.2 知识点（可加入）

| # | front | back | 原文 |
|---|---|---|---|
| 1 | 冥想入门最短从多久开始？ | 每天两分钟，连续一周。 | p/33950891 |
| 2 | 数呼吸时一呼一吸怎么数？ | 吸气数一，呼气数二，数到十再从一。 | p/33950891 |
| 3 | 走神了该怎么办？ | 微笑，轻轻回到呼吸，从一重新数。 | p/33950891 |
| 4 | 初学冥想必须纠结坐垫吗？ | 不必。椅子、沙发、床都可以，身体挺直就行。 | p/93967061 |
| 5 | 数息法数到几再从头？ | 数到十，再从一开始。 | p/127759023 |
| 6 | 为什么冥想叫练习不是做好？ | 不要期望一开始就表现良好，所以叫练习。 | p/460344179 |

完整 URL（无 UTM）：

- `https://zhuanlan.zhihu.com/p/33950891`
- `https://zhuanlan.zhihu.com/p/93967061`
- `https://zhuanlan.zhihu.com/p/127759023`
- `https://zhuanlan.zhihu.com/p/460344179`

`id = itemId(url)`。同一 URL 多张卡时，id 会碰撞。因此 **每张闪卡必须用自己的 URL**：1–3 都来自 33950891 时，第 2、3 张在 URL 上加 fragment `#f2` `#f3`（只用于区分 id，原文 icon 仍打开去 fragment 的同一篇）。习惯三条共享 33950891 即可，它们不能加入，不要求 id 互异。

## 7. 界面

### 7.1 列表 `/friends`

墙面背景，与筹划页同一 `AppShell`。列表是两张纸片行（`.friend-row`）：

- 第一行看山：名字「看山」、ID `kanshan`、最新 = `peekKanshan().latest`
- 第二行我：名字 = `session.user.name`、ID = `session.identity`、最新 = `peekMe(state).latest`

点整行打开小卡。键盘：行是 `button`，Enter/Space 打开。

### 7.2 二级小卡 `FriendPeek`

全屏半透明遮罩 + 居中纸片（`.peek-mask` / `.peek`），`role="dialog"`，`aria-modal="true"`，标题为好友名字。

结构：

1. 名字 · ID；看山额外一行 headline。
2. 「在执行的习惯」：行动文案列表。看山只读；我只读。
3. 「在复习的知识点」：正面文案 + 原文 icon（`aria-label="原文"`，`target=_blank` `rel="noopener noreferrer"`）+ 仅看山有「加入我的知行」按钮。
4. 若 `remaining* > 0`，对应块底「还有 N 项」。
5. 我且两类都空：`还没有在练的习惯或知识点。` + 链接「去筹划页挑几张」`/plan`。

关闭：Esc、点遮罩、小卡内「关闭」按钮。打开时焦点进对话框，关闭后焦点回那一行。

原文 icon 不占主视觉：16–18px 的 ↗ 链接，不是大按钮。

加入后若 `saveState` 失败：页顶出现与今日页相同的「本浏览器无法保存进度」。

### 7.3 文案

简体中文、句子式、不用感叹号。按钮：「加入我的知行」「已在知行」「关闭」。

## 8. 文件结构

| 文件 | 职责 |
|---|---|
| `src/lib/kanshan.ts` | 看山人设与写死卡片 |
| `src/lib/friends.ts` | `PEEK_CAP` `FriendPeek` `peekMe` `peekKanshan` `adoptFlash` |
| `src/components/FriendsPage.tsx` | 列表 + 选中态 + 读/写现有 StateV2 |
| `src/components/FriendPeek.tsx` | 二级小卡 |
| `src/app/friends/page.tsx` | 登录校验后挂载 FriendsPage |
| `src/components/AppShell.tsx` | `active` 增加 `friends`，导航加「好友」 |
| `src/app/globals.css` | 追加 `.friend-row` `.peek-mask` `.peek` 等，不改已有规则 |
| `tests/friends.test.ts` | peekMe / peekKanshan / adoptFlash |
| `tests/kanshan.test.ts` | 常量形状、长度、id 规则 |
| `tests/appshell.test.ts` | 导航四项，含 /friends |

## 9. 测试

纯函数，`bun test`。

`peekMe`：只收 active；行动/闪卡分开；超过 5 条截断并报 remaining；queued / dismissed / internalized 不出现；缺快照不出现；latest 规则。

`adoptFlash`：新卡 → queued + added；已在三种状态 → already 且原状态不变；dismissed → requeued。

`kanshan`：3 习惯 6 闪卡；front/back/action 不超过上限；闪卡 id 互异且等于 `itemId(source.url)`；原文 host 为 `zhuanlan.zhihu.com`。

`AppShell`：nav 四项顺序 今日、筹划、回顾、好友；`active="friends"` 时好友高亮。

## 10. 错误与边界

- 未登录：`/friends` → `/`
- 我无在练：空态，不崩溃
- 看山无空态
- 原文打不开：由知乎处理，应用不拦截
- localStorage 失败：提示，不丢内存里刚 adopt 的状态（与今日页一致）
- 同一原文已被用户收藏扫描过：adopt 走 already 或合并到已有进度，不复制第二张

## 11. 成功标准

- 登录后顶栏能进好友页，看到看山和我。
- 点看山弹出小卡，能打开原文，能把一张未加入的闪卡加入知行；再点变成「已在知行」。
- 点我弹出小卡，内容与今日在练的 active 卡一致（含空态）。
- `bun test` 全绿；`bunx tsc --noEmit -p .` 通过。
- 不新增 localStorage 键，不改调度算法，不改筹划页勾选逻辑。
