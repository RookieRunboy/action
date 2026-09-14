# 知行 · 卡片与间隔调度（v2）设计规范

日期：2026-09-14 · 状态：待用户评审 · 路径分类：**Architectural**（新增子系统：卡片模型、调度、筹划页、闪卡）

## 1. 背景

「知行 · 无行动，不知乎」是知乎黑客松 2026 参赛作品（赛道：Agent 在社区中的新角色 / 学习提效）。
痛点：用户在知乎收藏了大量干货，但只停留在「收藏」这个动作，从未回顾、更没有行动。

v1（已在 `feat/cards-v2` 分支 `3490f87` 提交）跑通了最窄路径：读收藏夹 → AI 分拣 → 每天随机抽 3 个两分钟行动 → 勾选 → 回访作者。
v1 的两个缺口：

1. **用户没有参与筛选**：AI 分完直接上，用户不能决定自己想培养什么。
2. **只有一种互动**：所有干货都被硬转成「行动」，但很多干货只是一句值得记住的话，只能「看到、记住」，不能「做」。

## 2. 目标与非目标

### 目标

- 用户能在**筹划页**看到 AI 从收藏夹里提炼出的全部候选卡片（带标签、带出处），勾选想加入的，一键「加入知行」。
- 卡片分两种互动：**行动卡**（做了 / 今天不做）和**闪卡**（翻面后自评 记得 / 模糊 / 忘了）。
- 两种卡片用**同一套艾宾浩斯式间隔调度**决定何时再出现：新卡密集出现，做熟 / 记牢后逐渐淡出，直至「内化」。
- 每张卡带**两维标签**（做什么 / 练什么），标签是属性，不是目录：列表不按标签分组，但可按标签筛选。
- 保留 v1 已有的：知乎登录（OAuth，含 state 校验）与体验模式、收藏夹选择、AI 分拣中「放过的」诚实展示、日历纸视觉、完成盖印、回访作者留言草稿。

### 非目标（本轮不做）

- 服务端持久化用户数据（仍用浏览器 localStorage）。
- 多设备同步、账号系统。
- 复杂 SRS 算法（SM-2 / FSRS）——用固定间隔的 Leitner 盒子即可。
- 闪卡的回访作者。
- 推送 / 提醒（浏览器通知、邮件）。
- 从知乎读取「点赞」（开放平台没有该接口）。
- 部署上线（用户明确本轮只在本地运行）。

## 3. 用户流程

```
/           欢迎页。已登录 → 跳转 /today
            未登录 → 「用知乎账号登录」（OAuth 已配置时）/「进入体验模式」→ /plan
/plan       筹划页：选收藏夹 → 扫描（AI 分拣 + 转化）→ 候选卡片列表（复选框、标签、出处、放过的）
            → 「加入知行 · 已选 N 张」→ /today
/today      今日页：日历纸
              宜  今日到期的行动卡（≤3）    做了 ☑ → 盖「行」印 + 回访作者 / 今天不做 → 明天再来
              记  今日到期的闪卡（≤5）      翻面 → 记得 / 模糊 / 忘了
              忌  每日一句（v1 已有）
            全部完成 → 盖「知行合一」大印
            右侧：连续天数、内化 / 在练 / 待开始、收藏夹体检、去筹划页
```

顶部导航常驻：`知行` 标识 · `今日` / `筹划` · 收藏夹（仅筹划页）· 用户名 · 退出。

## 4. 领域模型

### 4.1 卡片 `Card`

服务端由 AI 生成，客户端存快照。`id` = v1 的 `itemId(url)`（url 的 sha1 前 8 位加 `i` 前缀），一条收藏对应一张卡。

```ts
interface CardSource {
  url: string; title: string; contentType: "answer"|"article"|"zvideo"|"pin"|"question";
  favTime: number; likeCount: number; summary: string;
  author?: { name: string; url: string };
}
interface CardBase { id: string; folderToken: string; source: CardSource; tags: Tags; sourceQuote: string; reason: string; }
interface ActionCard extends CardBase { kind: "action"; action: string; why: string; replyDraft: string; }
interface FlashCard  extends CardBase { kind: "flash";  front: string;  back: string; }
type Card = ActionCard | FlashCard;
```

字段约束（服务端裁剪，超长截断）：`action ≤ 40` 字、`why ≤ 60`、`replyDraft ≤ 90`、`front ≤ 40`、`back ≤ 80`、`reason ≤ 30`（分拣理由，来自分拣步骤，写给用户看）、`sourceQuote ≤ 60` 且必须是摘要原文（模糊匹配：去标点空白后为子串；不匹配则退回摘要第一句）。

### 4.2 标签 `Tags`

两维，每维 1–2 个，AI 只能从词表中选，服务端过滤掉词表外的值。

- **做什么 `do`**（必有，空则 `其他`）：冥想 · 运动 · 睡眠饮食 · 阅读 · 外语 · 专业学习 · 写作表达 · 社交 · 职场 · 理财 · 效率工具 · 编程 · 生活整理 · 其他
- **练什么 `train`**（可空）：专注 · 胆识 · 自律 · 耐心 · 好奇 · 决断 · 同理 · 体能 · 独立思考 · 审美

展示格式：`闭眼坐一分钟，只数呼吸  · 冥想 · 专注`（正文在前，标签芯片在后，`do` 在 `train` 前）。

### 4.3 卡片状态 `CardState`（客户端）

```ts
type CardStatus = "queued" | "active" | "internalized" | "dismissed";
type Result = "did" | "later" | "remembered" | "vague" | "forgot";
interface CardState {
  id: string; kind: "action"|"flash"; status: CardStatus;
  box: number;                 // 0..5
  due: string | null;          // ISO 日期，active 时非空
  introducedAt: string | null; // 第一次出现在今日页的日期
  addedAt: number;             // 加入知行的时间戳，决定待开始队列顺序
  history: { date: string; result: Result }[];
}
```

状态含义：`queued` 已加入但还没出现过（待开始）· `active` 在练 · `internalized` 已内化 · `dismissed` 用户取消勾选（不再出现，保留历史）。

没有状态记录的卡 = 候选（筹划页默认勾选）。

### 4.4 客户端存储 `StateV2`

localStorage 键：`zhixing:v2:<identity>`（`identity` 来自会话：OAuth 为 `u<uid>`，体验模式为 `self`）。v1 的 `zhixing:v1` 直接忽略，不迁移。

```ts
interface StateV2 {
  version: 2;
  cards: Record<string, Card>;              // 已勾选过或有状态的卡的内容快照
  states: Record<string, CardState>;
  queues: Record<string, DayQueue>;          // 按日期冻结的今日队列
  folders: Record<string, FolderScan>;       // 每个收藏夹最近一次扫描的统计
  lastFolder?: string;
}
interface DayQueue { actions: string[]; flash: string[] }
interface FolderScan { title: string; counts: { total: number; action: number; flash: number; skip: number }; scannedAt: number; provider: string }
```

读写都包 try/catch；不可用时应用仍能渲染（当日状态仅存内存）。

## 5. 调度算法

### 5.1 盒子与间隔

`box ∈ {0,1,2,3,4,5}`，`INTERVALS = [1, 2, 4, 7, 15]`（按**成功前**所在盒子索引）。

| 结果 | 适用 | 盒子 | 下次到期 | 状态 |
|---|---|---|---|---|
| `did` / `remembered` | 行动 / 闪卡 | box 0–4 → +1；box 5 → 内化 | `date + INTERVALS[oldBox]` | box 5 成功 → `internalized`，`due = null` |
| `later`（今天不做） | 行动 | 不变 | `date + 1` | 不变 |
| `vague`（模糊） | 闪卡 | 不变 | `date + 1` | 不变 |
| `forgot`（忘了） | 闪卡 | `max(0, box − 1)` | `date + 1` | 不变 |

每次结果追加 `history` 一条。同一张卡同一天只接受一次结果：`applyResult` 对当日已有记录的卡返回原状态不变；UI 在记录后禁用该卡的按钮 / 复选框（`did` 不可撤销）。
一张新卡从加入到内化最快需要 6 次成功、29 天。

### 5.2 今日队列 `buildQueue(states, date, existing?)`

上限 `CAPS = { action: 3, flash: 5 }`，每日新卡 `NEW_PER_DAY = { action: 2, flash: 3 }`。对每种 kind 分别：

1. 以 `existing`（`state.queues[date]`）为起点，**不移除**已在队列中的卡（当日队列冻结，避免刷新后换题）。
2. 到期卡：`status === "active" && due <= date` 且不在队列中，按 `box` 升序、`due` 升序（更久没做的更靠前）填充到上限。
3. 仍有空位时引入新卡：数量 = `min(NEW_PER_DAY[kind] − 当日已引入数, 剩余空位)`，其中「当日已引入数」= 同 kind 且 `introducedAt === date` 的状态数；从 `status === "queued"` 中按 `addedAt` 升序取；被引入的卡 `status = "active"`、`introducedAt = date`、`due = date`。
4. 返回新队列与更新后的状态。函数纯、幂等：同一输入多次调用结果一致。

「今天不做」= 对该卡 `applyResult("later")`，然后再次执行 `buildQueue` 补位。计算上限时**不计入**当日结果为 `later` 的卡（它们仍留在冻结队列里，UI 显示为一行灰字「明天再来 · 动作」），因此有到期 / 待开始卡时会补进一张。冻结队列中状态变为 `dismissed` 的卡会被移除。

### 5.3 连续天数 `streak(states, date)`

从 `date`（若当天无记录则从 `date − 1`）向前数，每天至少有一条 `result ∈ {did, remembered, vague, forgot}` 的历史（`later` 不算）。

### 5.4 统计

`internalized` / `active`（在练）/ `queued`（待开始）数量，跨所有收藏夹。

### 5.5 演示用日期覆盖

`/today?date=YYYY-MM-DD` 覆盖「今天」。仅用于演示与测试（评委可看到多天后卡片淡出与内化）。不校验方向，允许任意日期。

## 6. AI 管线（服务端模块 `src/lib/pipeline.ts`）

输入：一个收藏夹前 100 条（两页 × 50）的标题 + 摘要（开放平台不提供全文）。

```
items ──sort──▶ action | knowledge | skip (+reason)
action    ──convertActions──▶ ActionCard  (action, why, sourceQuote, replyDraft, tags)
knowledge ──convertFlash────▶ FlashCard   (front, back, sourceQuote, tags)
skip      ──▶ 原样返回 {id,title,url,reason} 供筹划页「放过的」展示
```

- **分拣**：批 24 条一次调用，并行。输出 `kind` + `reason`（≤ 18 字，写给用户看；对 skip 诚实不刻薄）。缓存 24 小时，键含全部 item id；`refresh=1` 跳过缓存。
- **转化**：批 12 条一次调用，并行；每张卡按 id 永久缓存（`convert-a/<id>`、`convert-f/<id>`）。AI 漏掉或字段缺失的条目直接丢弃，不补假数据。
- **闪卡正面**必须是一个用摘要就能回答的问题（如「傅步天说年轻人积累人脉的第一步是什么？」），**背面**是要点，不是摘要复述。
- **行动卡**遵循两分钟法则：动词开头、现在放下手机就能做、不写「每天 / 坚持 / 养成」。
- LLM 提供方可切换：`LLM_PROVIDER=dashscope`（通义 `qwen-plus`，默认）/ `zhida`（知乎直答 `zhida-fast-1p5`，OpenAI 兼容格式，本账号每日仅 2 次额度）。两者都要求 JSON 输出，解析兼容 ``` 围栏与前后杂文。
- 管线函数接受可注入的 `chat` 函数（默认 `chatJSON`），便于测试不打真实接口；缓存目录可用环境变量 `ZHIXING_CACHE_DIR` 覆盖。

**知乎额度**（本账号实测）：用户数据 1000/日，知乎搜索 10/日，直答 2/日。所有知乎响应文件缓存 24 小时，且**缓存文件永不删除**：过期后重新拉取失败（限流、额度耗尽、断网）时回退到旧快照，并在响应中标记 `stale: true`，前端在体检卡下方显示「使用的是 <时间> 的快照」类提示可选、本轮只需透传字段。缓存目录默认 `.cache/`，可用 `ZHIXING_CACHE_DIR` 覆盖。

## 7. 接口

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/auth/login` `/api/auth/callback` `/api/auth/demo` `/api/auth/logout` `/api/me` | 已有 | 仅改一处：OAuth 回调成功后重定向到 `/plan`（v1 为 `/`） |
| `/api/favlists` | GET，已有 | 响应改为 `{ folders: FavFolder[]; stale: boolean }` |
| `/api/cards?folder=<token>&refresh=0\|1` | GET | **新增**，替代 v1 的 `/api/plan`（删除） |

`/api/cards` 响应 200：

```ts
{
  folder: { urlToken: string; title: string };
  counts: { total: number; action: number; flash: number; skip: number };  // action/flash 为成功转化的张数
  cards: Card[];
  skipped: { id: string; title: string; url: string; reason: string }[];
  provider: string;   // 如「通义千问 · qwen-plus」
  stale: boolean;     // 收藏夹数据是否来自过期快照（§6）
}
```

错误：`401` 未登录 / 知乎鉴权失败；`400` 缺少或非法 folder；`429` 知乎限流或额度耗尽；`502` 知乎或 AI 上游错误（含 `source: "zhihu"|"llm"`）；`500` 其他。错误体统一 `{ error: string }`，文案面向用户、可直接展示。

## 8. 页面规格

设计语言沿用 v1：墨色墙面 + 宣纸日历 + 朱砂印。字体 Big Shoulders Display（日期数字）、Zhi Mang Xing（书法「知行」「宜 / 忌 / 记」与印章）、Noto Serif SC（正文宋体）。所有 token 已在 `globals.css`。

### 8.1 `/`  欢迎页

v1 的 Welcome，改动：体验模式成功后 `router.push("/plan")`；OAuth 登录按钮不变（回调成功也落到 `/plan`）。已登录访问 `/` 时服务端 `redirect("/today")`；未登录访问 `/plan` 或 `/today` 时服务端 `redirect("/")`。

### 8.2 `/plan`  筹划页

- 顶部：收藏夹下拉（默认上次选择，其次列表第一个即「我的收藏」）· 「重新分拣」按钮。
- 切换收藏夹即自动请求 `/api/cards`；加载时显示骨架与文案「正在读你的收藏夹，分拣哪些能做、哪些该记、哪些该放过……大约 40 秒」。
- 加载完成：
  - 体检条：能做的 / 值得记的 / 放过的 数量与比例条（复用 v1 `.bar`）。
  - 标签筛选芯片行：从当前卡片的 `do` 标签去重生成，「全部」在首；点选只过滤列表，不改变勾选。
  - 候选列表 `CandidateRow`：`[☑] 做|记 字形 · 正文（action 或 front）· 标签芯片 · 出处（作者 的回答/文章，链接新窗口）· 分拣理由`。
    - 无状态的卡默认勾选；`dismissed` 不勾选；`queued/active` 勾选并在右侧显示状态字（待开始 / 在练 · 第 n 格）；`internalized` 勾选且复选框禁用，显示「已内化」。
    - 取消勾选一张 `queued/active` 的卡 = 提交时标记 `dismissed`（保留 history）。
  - 「放过的 N」折叠区：标题 + 理由，无复选框，链接可点。
- 底部粘性栏：`加入知行 · 已选 N 张` 主按钮（朱砂）。点击 `commitSelection`：勾选且无状态 → 新建 `queued`（box 0、due null、addedAt = now、history 空）并写入卡片快照；勾选且 `dismissed` → `queued`（box 归 0、due null、addedAt = now，history 保留）；勾选且 `queued/active/internalized` → 不变；未勾选且 `queued/active` → `dismissed`（due null）；未勾选且无状态 → 不写入。之后记录 `folders[token]` 体检结果与 `lastFolder`，`router.push("/today")`。
- 空 / 错：收藏夹为空 → 「这个收藏夹是空的，换一个试试」；无可转化卡 → 「N 条里没有能变成卡片的」；接口错误 → 直接显示 `error` 文案 + 「再试一次」。

### 8.3 `/today`  今日页

左：日历纸 `Leaf`。右：`Shelf`。

- 页眉：月 · 星期，日期大数字，右上「知行 / 无行动，不知乎」。
- **宜**：今日队列中的行动卡，每张 `ActionRow`：复选框（做了）· 正文 · 标签芯片 · `why · 作者 的回答 · 收藏了 N 天` · 引句 · 「今天不做」文字按钮。
  - 做了 → 复选框朱砂勾、正文划线、右侧盖「行」印（v1 动画）、展开回访面板（v1：可编辑草稿、「复制并去原文留言」、「这次不说」）。
  - 今天不做 → 该行变为一行灰字「明天再来 · 动作」，并按 §5.2 尝试补进一张卡。
  - 回访面板的「已留言」状态只保存在组件内存中（刷新后不再显示），不进入 `CardState`。
- **记**（新增，字形「记」与「宜」同款方框）：闪卡一次只显示一张，形如一张小纸片叠在日历纸上：
  - 正面：问题（宋体 19px）+ 「翻面」按钮 + 右上角进度 `2 / 5`。
  - 背面：要点 + 引句「…」+ 出处链接 + 三个按钮 `记得` `模糊` `忘了`（`记得` 为实心墨色，其余描边）。
  - 选择后进入下一张；全部完成显示「今日闪卡完成 · 记得 a · 模糊 b · 忘了 c」。
  - 键盘：空格翻面，1/2/3 对应三个按钮（有 `aria-keyshortcuts`）。
- **忌**：v1 不变。
- 页脚：`宜 x/a · 记 y/b`（a = 当日行动队列中不含「明天再来」的张数，b = 闪卡队列长度）；宜与记都完成（各自队列中每张卡都有当日结果，队列为空视为完成）且当日至少 1 条结果 ∈ {did, remembered} → 盖「知行合一」大印。
- **空态**（没有任何 `queued/active` 卡）：宜栏显示「还没有加入任何卡片。」+ 「去筹划页挑几张」按钮 → `/plan`。
- `Shelf`：① 连续天数大数字 + 内化 / 在练 / 待开始 三格；② 收藏夹体检（`folders` 中当前 `lastFolder`，无则隐藏）；③ 「去筹划页 →」链接；④ 页脚小字：AI 提供方与数据来源声明（v1 文案）。

### 8.4 通用

- 响应式：≤ 640px 单列，日历纸满宽，底部粘性栏适配；最小侧边距 16px。
- 可见焦点环（v1 已有），`prefers-reduced-motion` 关闭印章与骨架动画。
- 文案：句子式、动词开头、不用感叹号；错误说明发生了什么与怎么办。

## 9. 错误处理与降级

| 场景 | 行为 |
|---|---|
| 未配置 `ZHIHU_ACCESS_SECRET` | 欢迎页无体验模式按钮，提示「服务端还没有配置知乎凭证」 |
| 未配置 OAuth 三项 | 欢迎页无登录按钮，仅体验模式；`/api/auth/login` 跳回 `/?error=oauth_unconfigured` |
| 知乎 20001 | 会话失效，接口 401，前端显示「知乎鉴权失败……重新登录」 |
| 知乎 30001/30002 | 429，「请求太频繁 / 今日额度已用完」，不自动重试 |
| AI 失败 | 502，展示 `error`，「再试一次」按钮；已有缓存的部分不丢 |
| localStorage 不可用 | 内存态运行，Shelf 显示「本浏览器无法保存进度」 |
| 分拣结果全为 skip | 筹划页说明并建议换收藏夹；不硬转 |

## 10. 安全

- `ZHIHU_ACCESS_SECRET`、`ZHIHU_OAUTH_APP_KEY`、`DASHSCOPE_API_KEY`、OAuth token 只在服务端；不进前端响应、日志、截图。
- OAuth `state`：服务端生成、10 分钟有效、一次性消费（v1 已实现）。
- 会话 cookie `HttpOnly`；体验模式 cookie 仅标记，不含凭证。
- `/api/cards` 的 `folder` 仅接受 `^\d+$`。

## 11. 测试策略

- 运行器：`bun test`（内建），脚本 `bun run test`。测试放 `tests/`，纯函数全覆盖：
  - `tags.test.ts`：词表过滤、去重、上限 2、`do` 空默认「其他」。
  - `schedule.test.ts`：`applyResult` 全部转换表；`buildQueue` 上限、每日新卡上限、幂等、到期优先级、冻结队列不被移除；`streak` 含 `later` 不计、隔天中断。
  - `state.test.ts`：`commitSelection` 五种状态转换、卡片快照写入、`recordResult` 追加历史与 `later` 补位、`ensureQueue`、序列化往返、v1 / 损坏数据忽略。
  - `cache.test.ts`：`cachedWithFallback` 命中 / 过期重拉 / 重拉失败回退旧快照并 `stale: true` / 无快照时抛错。
  - `llm.test.ts`：`extractJSON` 围栏 / 前后杂文 / 非法输入抛 `LLMError`。
  - `pipeline.test.ts`：注入假 `chat`，验证分拣合并、缺失条目丢弃、字段截断、引句校验回退、标签过滤。
- 手工验收（计划中给出命令）：体验模式 → `/plan` 扫描「我的收藏」→ 加入 → `/today` 完成一张行动与一张闪卡 → `?date=` 前进 1 / 2 / 4 天观察到期 → 截图。
- 本机有代理环境变量，curl 需 `--noproxy '*'`，浏览器访问用 `http://localhost:3000`（`next.config.ts` 已允许 `127.0.0.1` 与 `localhost`）。

## 12. 对 v1 代码的处置

| v1 | 处置 |
|---|---|
| `src/lib/{zhihu,llm,cache,session,dates}.ts` | 保留；`cache.ts` 增加 `ZHIXING_CACHE_DIR` 与 `cachedWithFallback`；`zhihu.ts` 使用回退并返回 `stale`；`llm.ts` 导出 `ChatFn` 类型；`dates.ts` 增加 `addDays` `isValidISODate` |
| `src/lib/pipeline.ts` `prompts.ts` | 重写（§6） |
| `src/lib/types.ts` | 重写为 v2 类型（§4）；v1 类型以「兼容块」暂留，待 v1 组件全部替换后删除 |
| `src/lib/store.ts` | 删除；新增纯函数模块 `src/lib/state.ts`（§4.4 的读写与状态转换）与 `src/lib/schedule.ts`（§5）、`src/lib/tags.ts`（§4.2） |
| `src/app/api/plan/route.ts` | 删除，改为 `api/cards` |
| `src/components/App.tsx` | 删除，拆为 `AppShell`（导航壳）`PlanPage` `CandidateRow` `TagChips` `TodayPage` `FlashDeck` |
| `Leaf.tsx` `ActionRow.tsx` `Shelf.tsx` `Welcome.tsx` | 按 §8 修改 |
| `globals.css` | 保留全部 token；新增闪卡与标签芯片样式 |

## 13. 交付物（黑客松提交所需）

- 本地可运行的 Demo（`bun run dev`），体验模式可完整走通。
- `README.md`：产品说明（核心思路、目标用户、核心体验、技术方案、使用的知乎开放能力、与社区生态契合点、对用户价值）— 由本规范 §1–§6 精简而来。
