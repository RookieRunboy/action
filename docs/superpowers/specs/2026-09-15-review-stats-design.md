# 知行 · 「回顾」统计模块设计规范

日期：2026-09-15 · 状态：已批准 · 路径分类：**Feature**（新增子系统：回顾统计、历史沉淀、热力图）

## 1. 背景与目标

「知行 · 无行动，不知乎」致力于将知乎收藏从沉睡干货转变为每日行动与闪卡记忆。在经历了卡片与间隔调度（v2）后，用户可在 `/plan` 筹划加入卡片、在 `/today` 按照 Leitner 间隔推进完成打卡。

用户需要一个专属于自我成长的**回顾（Stats）**空间，查看连续坚持天数、行动与记忆的打卡沉淀、领域与心智标签的分布，以及 16 周热力分布图。

### 目标

1. **导航扩展**：在顶部导航栏增加第三栏「回顾」，路由 `/review`，需登录保护（未登录重定向至 `/`）。
2. **多维度筛选**：页内支持「全部」「行动」「记」三档切换，通过 URL 查询参数 `?kind=action|flash` 联动；缺省或非法值回退为 `all`；日期参数 `?date=YYYY-MM-DD` 保持与今日页完全一致的解析逻辑。
3. **纯函数统计架构**：只读现有 `zhixing:v2:<identity>` 状态，不引入新 API、不引入新 localStorage 键、不使用第三方图表库，由纯函数 `computeStats(cards, states, filter, today)` 驱动渲染。
4. **三维数据沉淀**：
   - **数量（Counts）**：连续天数（全局 streak，不随 filter 切换）；当前状态摘要（已内化、在练、待开始，按 filter 过滤）；历史累计交互次数（行动 did/later，闪卡 remembered/vague/forgot；即使卡片已被 dismissed 或 internalized，历史记录仍全额计入；later 不计入 streak）。
   - **标签（Tags）**：做什么（`do`）与练什么（`train`）两维，统计具有**有效打卡记录**（至少一条 did/remembered/vague/forgot，later 不计）的独立卡片数。
   - **16 周热力（Calendar Heatmap）**：以 `today` 所在周为截止的连续 16 周（共 112 天）每日有效打卡条数（later 不计）热力矩阵，只看不点。
5. **两档空态**：
   - 第一档（无卡）：尚未加入任何卡片，引导前往 `/plan`（「去筹划页挑几张」）。
   - 第二档（有卡无记录）：已有卡片但尚无任何有效打卡历史，引导前往 `/today`（「从今日开始」）。
6. **宋风纸墨视觉**：延续暗墙（`--wall`）、宣纸（`--paper`）、朱砂（`--seal`）与宋体（`--font-song`）设计语言，采用约 720px 单列居中布局。

### 非目标

- 不修改今日页右侧 `Shelf` 现有展示与逻辑。
- 不引入外部图表库（如 Chart.js, ECharts, Recharts 等），完全基于原生 CSS/SVG 实现。
- 不引入服务端新统计接口或数据库持久化。
- 不改动现有卡片调度算法、分拣逻辑、AI 管线或今日 Leaf 交互。

---

## 2. 路由与交互规范

### 2.1 路由与鉴权

- **路径**：`/review`
- **服务端守卫**：在 `src/app/review/page.tsx` 中调用 `getSession()`，若无有效会话直接 `redirect("/")`。
- **参数解析**：
  - `date`：若 `isValidISODate(params.date)` 为真则使用 `params.date`，否则调用 `todayISO()`。
  - `kind`：若 `params.kind === "action"` 或 `params.kind === "flash"` 则使用该值，其他（含空串、undefined、非法字符）统一视为 `"all"`。

### 2.2 导航集成

- `src/components/AppShell.tsx` 导航属性扩展为 `active: "plan" | "today" | "review"`。
- 顶部导航栏按顺序渲染三项：
  1. `今日`（`/today`）
  2. `筹划`（`/plan`）
  3. `回顾`（`/review`）
- 处于 `/review` 时，选项高亮显示朱砂下边框与高亮白字，其它项保持半透明暗白。

### 2.3 页内筛选器

- 在回顾页面顶部提供三段式切换：
  - `全部`：导航至 `/review`（或 `/review?date=...`）
  - `行动`：导航至 `/review?kind=action`（带 date 时附带 `&date=...`）
  - `记`：导航至 `/review?kind=flash`（带 date 时附带 `&date=...`）
- 切换使用 `<Link>` 或客户端路由推入，保证浏览器前进/后退历史正常工作。

---

## 3. 统计计算纯函数：`computeStats`

位于 `src/lib/stats.ts`，为无副作用纯函数。

### 3.1 函数签名与类型定义

```ts
import type { Card, CardKind, CardState, Result } from "./types";

export type StatsFilter = "all" | "action" | "flash";

export interface ReviewSummary {
  internalized: number;
  active: number;
  queued: number;
}

export interface ReviewCounts {
  streakDays: number;
  summary: ReviewSummary;
  action: { did: number; later: number };
  flash: { remembered: number; vague: number; forgot: number };
}

export interface TagStat {
  tag: string;
  count: number; // 有效记录的独立卡片数
}

export interface ReviewTags {
  do: TagStat[];
  train: TagStat[];
}

export interface CalendarCell {
  date: string;       // YYYY-MM-DD
  count: number;      // 当日符合 filter 的有效记录条数
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  inFuture: boolean;
}

export interface CalendarWeek {
  days: CalendarCell[]; // 固定 7 天 (周日 d=0 至 周六 d=6)
}

export interface ReviewCalendar {
  weeks: CalendarWeek[]; // 固定 16 周
  startDate: string;
  endDate: string;
  totalRecords: number;
}

export type EmptyStateTier = "none" | "no_cards" | "no_records";

export interface ReviewStats {
  filter: StatsFilter;
  today: string;
  emptyTier: EmptyStateTier;
  hasCards: boolean;
  totalEffectiveRecords: number;
  filteredEffectiveRecords: number;
  counts: ReviewCounts;
  tags: ReviewTags;
  calendar: ReviewCalendar;
}

export function computeStats(
  cards: Record<string, Card>,
  states: Record<string, CardState>,
  filter: StatsFilter,
  today: string,
): ReviewStats;
```

### 3.2 规则与判定逻辑

#### 1. 有效记录定义
- **有效打卡记录**：`h.result ∈ {"did", "remembered", "vague", "forgot"}`。
- **later 规则**：`later`（今天不做）为跳过而非实践完成，**严格不计入** streak、不计入标签有效卡数、不计入 16 周热力图。但保留在「数量」模块中的行动 `later` 历史计数器内供用户查看。
- **已删除/已内化卡片历史**：若某张卡片当前状态为 `dismissed`（已移出）或 `internalized`（已内化），其历史记录已真实发生，**仍然全额计入**累计次数、标签统计与热力日历。

#### 2. 空态判定（`emptyTier`）
- `hasCards = Object.keys(states).length > 0 || Object.keys(cards).length > 0`
- `totalEffectiveRecords` = 所有卡片所有历史中满足有效打卡记录的条数之和。
- 若 `!hasCards`：`emptyTier = "no_cards"`。
- 若 `hasCards && totalEffectiveRecords === 0`：`emptyTier = "no_records"`。
- 否则：`emptyTier = "none"`。

#### 3. 连续天数（`streakDays`）
- **全局连续**：不根据 `filter` 截断。调用既有 `streak(states, today)` 算法，即从 `today`（当天若无记录则从 `today - 1`）向前回溯，每日至少有 1 条有效记录。

#### 4. 状态摘要（`summary`）
- 根据 `filter` 筛选当前状态（`filter === "all"` 计全部，否则仅计 `state.kind === filter`）。
- 统计 `status === "internalized"`、`status === "active"`、`status === "queued"` 的卡片张数（`dismissed` 不计入 summary）。

#### 5. 交互累计（`counts.action` & `counts.flash`）
- 遍历所有 `states`（含 `dismissed` 与 `internalized`）：
  - 若 `state.kind === "action"`：累计历史中的 `did` 与 `later` 次数。
  - 若 `state.kind === "flash"`：累计历史中的 `remembered`、`vague`、`forgot` 次数。

#### 6. 标签统计（`tags.do` & `tags.train`）
- 目标：统计**具有有效记录的卡片数**。
- 过滤：仅考虑符合当前 `filter` 的卡片（`filter === "all"` 包含两类）。
- 对每张符合条件的卡片，检查其 `history` 是否包含至少一条有效打卡记录。若包含且 `cards[id]?.tags` 存在：
  - 对 `tags.do` 中每个标签，计数加 1。
  - 对 `tags.train` 中每个标签，计数加 1。
- 排序：按卡片数降序排列；卡片数相同时按标签名称字典序排列；过滤掉卡片数为 0 的标签。

#### 7. 16 周热力日历（`calendar`）
- **周对齐**：使用星期日作为每周起始（符合 `dates.ts:WEEKDAYS` 索引 `0`）。
- **时间窗计算**：
  - 计算 `today` 的星期序号 `wDay`（0 为周日，6 为周六）。
  - 本周起始日（周日）：`currentWeekSunday = addDays(today, -wDay)`。
  - 本周结束日（周六）：`currentWeekSaturday = addDays(today, 6 - wDay)`。
  - 16 周窗口起始日（第 1 周周日）：`startDate = addDays(currentWeekSunday, -15 * 7)`（即 `addDays(today, -wDay - 105)`）。
  - 16 周窗口结束日（第 16 周周六）：`endDate = currentWeekSaturday`。
  - 窗口共 16 列 × 7 行 = 112 天。
- **每日数据聚合**：
  - 聚合符合 `filter` 且结果为有效打卡的全部历史记录，按 `date` 统计条数。
  - 每一天对应一个 `CalendarCell`：
    - `date`: 该天 ISO 字符串。
    - `count`: 当日有效打卡条数。
    - `isToday`: `date === today`。
    - `inFuture`: `date > today`。
    - `level`:
      - 若 `inFuture` 或 `count === 0`: `0`
      - `count === 1`: `1`
      - `count === 2`: `2`
      - `count === 3`: `3`
      - `count >= 4`: `4`
  - `totalRecords`: 16 周内有效打卡总条数。

---

## 4. 组件架构与视觉规范

### 4.1 目录与文件职责

```
src/
├── app/
│   └── review/
│       └── page.tsx              # Server Component，登录守卫、参数解析、向客户端组件传参
├── components/
│   ├── AppShell.tsx              # 扩展 active='review'，增加第三栏链接
│   ├── ReviewPage.tsx            # Client Component，承载 state 读取、空态切换与单列布局
│   ├── StatsCounts.tsx           # 数量模块：streak、状态摘要、打卡行为频次卡片
│   ├── StatsTags.tsx             # 标签模块：做什么(do)与练什么(train)芯片与条形分布
│   └── StatsCalendar.tsx         # 16 周热力日历组件：原生 CSS 网格，朱砂层级渐变
└── lib/
    └── stats.ts                  # 纯计算逻辑与数据结构
tests/
└── stats.test.ts                 # 统计纯函数及边界场景完整单测
```

### 4.2 页面整体布局（`ReviewPage.tsx`）

- 单列居中容器：`mx-auto max-w-[720px] px-4`。
- 头部：
  - 标题：「知行回顾」与副标题「温故而知新，日日行，不怕千万里」。
  - 筛选器 Tab 切换：
    - 全部 (`all`) · 行动 (`action`) · 记 (`flash`)
    - 采用带动画或朱砂底线的选项设计，切换保留 `date` 参数。
- 空态处理：
  - 若 `emptyTier === "no_cards"`：展示纸墨卡片，文案「还没有加入任何卡片」，附带行动按钮「去筹划页挑几张」，链接到 `/plan`。
  - 若 `emptyTier === "no_records"`：展示纸墨卡片，文案「还没有打卡记录」，附带行动按钮「从今日开始」，链接到 `/today`。
- 正常态：顺序渲染 `StatsCounts`、`StatsTags`、`StatsCalendar`，板块间距 `space-y-6`。

### 4.3 数量模块（`StatsCounts.tsx`）

- 采用暗色卡片（`.card p-6`）。
- 第一行：连续天数大数字（`date-num !text-[64px]`），附带副文案（如 `streakDays > 0 ? "连续践行中" : "今日启程"`）。
- 第二行：卡片状态概览（已内化、在练、待开始），带有数字与说明。
- 第三行：历史交互总数统计：
  - 若 `filter !== "flash"`：行动卡实践（做了 `did` 次、今天不做 `later` 次）。
  - 若 `filter !== "action"`：闪卡复习（记得 `remembered` 次、模糊 `vague` 次、忘了 `forgot` 次）。

### 4.4 标签模块（`StatsTags.tsx`）

- 采用暗色卡片（`.card p-6`）。
- 划分两个子段：「做什么 (Do)」与「练什么 (Train)」。
- 每一项展示标签名称、独立卡片数、以及按最高卡片数归一化的横向比例条（使用 `var(--seal)` 或墨青色渐变）。
- 若某维度无标签记录，展示低调提示「暂无标签数据」。

### 4.5 16 周热力图（`StatsCalendar.tsx`）

- 采用暗色卡片（`.card p-6`）。
- 标题区域：「16 周行动足迹」，副标题「只看不点 · 过去 16 周共完成 N 次打卡」。
- 网格结构：
  - 16 列（每列一周），7 行（每行一天，周日到周六）。
  - 左侧标注星期刻度：周一（一）、周三（三）、周五（五）。
  - 格子尺寸：约 `12px × 12px`，圆角 `2px`，间距 `3px`。
  - 色彩层级：
    - Level 0: `bg-white/[0.04]`（未来日期稍淡 `bg-white/[0.02]`）
    - Level 1: `bg-[rgba(200,50,30,0.25)]`
    - Level 2: `bg-[rgba(200,50,30,0.50)]`
    - Level 3: `bg-[rgba(200,50,30,0.75)]`
    - Level 4: `bg-[var(--seal)]` (#c8321e)
    - 当日格子（`isToday`）：叠加白色微弱光环（`ring-1 ring-white/70`）。
  - 底部图例：少 ▫ ◽ ◻ ◼ 多（从 Level 0 至 Level 4）。

---

## 5. 边界场景与测试策略

### 5.1 纯函数单元测试清单（`tests/stats.test.ts`）

1. **空状态与冷启动**：
   - 库内无卡（`cards={}`, `states={}`）→ `emptyTier === "no_cards"`, streak=0。
   - 库内有卡但无 history → `emptyTier === "no_records"`, streak=0。
   - 库内仅有 `later` 记录 → `emptyTier === "no_records"`, streak=0, action.later=N。
2. **筛选器过滤行为**：
   - `filter="all"`：summary 汇总两种类型，counts 包含 action 与 flash，热力图汇总两类。
   - `filter="action"`：summary 仅统计行动卡，flash 计数不展示或为 0，热力图仅含行动卡。
   - `filter="flash"`：summary 仅统计闪卡，action 计数不展示或为 0，热力图仅含闪卡。
3. **Streak 与 Later 特性**：
   - 全局 streak 不受 `kind` 筛选影响。
   - `later` 严禁计入 streak。
   - 昨天有有效打卡、今天无打卡 → streak 延续。
   - 隔天无打卡 → streak 中断重置。
4. **历史保留特性（dismissed / internalized）**：
   - 卡片状态置为 `dismissed` 或 `internalized` 后，其已产生的历史仍被全额计入各统计项（counts/tags/calendar）。
5. **标签统计**：
   - 仅统计有至少一次有效打卡的卡片。
   - 一张卡片多次打卡只为该卡片的标签贡献 1 张卡数（去重卡数）。
   - `tags.do` 与 `tags.train` 降序排列及首要字母排序。
6. **16 周日历生成**：
   - 严格产出 16 周、每周 7 天、共 112 个单元格。
   - 第一周周日与第 16 周周六计算精准。
   - 未来日期标记 `inFuture=true` 且 level 为 0。
   - 当日标记 `isToday=true`。
   - 数量等级映射（0..4）正确无误。

---

## 6. 自审结论

- [x] **占位检查**：无 TBD、TODO、占位符或未定内容。
- [x] **内部一致性**：URL 结构、状态类型、组件层级与测试项完全契合。
- [x] **范围控制**：严格局限于回顾统计模块，不改动 Shelf、调度算法或 AI 管线。
- [x] **歧义消除**：明确有效记录排斥 later、明确历史保留包含 dismissed、明确 streak 全局独立、明确日历 16 周边界计算。
