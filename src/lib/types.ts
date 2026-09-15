// ───────── v2 领域类型（规范 §4）─────────
export type ContentType = "answer" | "article" | "zvideo" | "pin" | "question";

export interface Tags {
  do: string[];
  train: string[];
}

export interface CardSource {
  url: string;
  title: string;
  contentType: ContentType;
  favTime: number;
  likeCount: number;
  summary: string;
  author?: { name: string; url: string };
}

export interface CardBase {
  id: string;
  folderToken: string;
  source: CardSource;
  tags: Tags;
  sourceQuote: string;
  reason: string;
}

export interface ActionCard extends CardBase {
  kind: "action";
  action: string;
  why: string;
  replyDraft: string;
}

export interface FlashCard extends CardBase {
  kind: "flash";
  front: string;
  back: string;
}

export type Card = ActionCard | FlashCard;
export type CardKind = Card["kind"];

export type CardStatus = "queued" | "active" | "internalized" | "dismissed";
export type Result = "did" | "later" | "remembered" | "vague" | "forgot";

export interface HistoryEntry {
  date: string;
  result: Result;
}

export interface CardState {
  id: string;
  kind: CardKind;
  status: CardStatus;
  box: number;
  due: string | null;
  introducedAt: string | null;
  addedAt: number;
  history: HistoryEntry[];
}

export interface DayQueue {
  ids: string[];
}

export interface FolderCounts {
  total: number;
  action: number;
  flash: number;
  skip: number;
}

export interface FolderScan {
  title: string;
  counts: FolderCounts;
  scannedAt: number;
  provider: string;
}

export interface StateV2 {
  version: 2;
  cards: Record<string, Card>;
  states: Record<string, CardState>;
  queues: Record<string, DayQueue>;
  folders: Record<string, FolderScan>;
  lastFolder?: string;
}

export interface SkippedItem {
  id: string;
  title: string;
  url: string;
  reason: string;
}

export interface CardsResponse {
  folder: { urlToken: string; title: string };
  counts: FolderCounts;
  cards: Card[];
  skipped: SkippedItem[];
  provider: string;
  stale: boolean;
}

// ───────── 知乎数据（zhihu.ts 使用）─────────
export interface FavFolder {
  urlToken: string;
  url: string;
  title: string;
  description: string;
  isPublic: boolean;
}

export interface FavAuthor {
  name: string;
  url: string;
  urlToken: string;
  headline: string;
}

export interface FavItem {
  id: string;
  contentType: ContentType;
  url: string;
  title: string;
  summary: string;
  createdAt: number;
  favTime: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  author?: FavAuthor;
}

