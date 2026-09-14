export type ContentType = "answer" | "article" | "zvideo" | "pin" | "question";

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

export type Kind = "action" | "knowledge" | "skip";

export interface SortedItem extends FavItem {
  kind: Kind;
  domain: string;
  reason: string;
}

export interface Conversion {
  id: string;
  action: string;
  why: string;
  sourceQuote: string;
  replyDraft: string;
}

export interface TodayAction extends SortedItem {
  action: string;
  why: string;
  sourceQuote: string;
  replyDraft: string;
  daysOnShelf: number;
}

export interface PlanCounts {
  total: number;
  action: number;
  knowledge: number;
  skip: number;
}

export interface SortResponse {
  folder: string;
  counts: PlanCounts;
  fetched: number;
  total: number;
}

export interface PlanResponse {
  date: string;
  folder: string;
  counts: PlanCounts;
  today: TodayAction[];
  spares: TodayAction[];
  knowledge: SortedItem[];
  skipped: SortedItem[];
  provider: string;
}
