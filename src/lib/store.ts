"use client";

import { toISODate } from "./dates";

export interface DoneRecord {
  at: number;
  replied?: boolean;
}

export interface LocalState {
  folder?: string;
  done: Record<string, Record<string, DoneRecord>>;
  swapped: Record<string, string[]>;
}

const KEY = "zhixing:v1";

const empty = (): LocalState => ({ done: {}, swapped: {} });

export function loadState(): LocalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return { folder: parsed.folder, done: parsed.done || {}, swapped: parsed.swapped || {} };
  } catch {
    return empty();
  }
}

export function saveState(s: LocalState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 私密模式等情况下忽略 */
  }
}

/** 之前任何一天完成过的条目 + 今天换掉的条目，都不再出现 */
export function excludedIds(s: LocalState, today: string): string[] {
  const ids = new Set<string>();
  for (const day of Object.values(s.done)) for (const id of Object.keys(day)) ids.add(id);
  for (const id of s.swapped[today] || []) ids.add(id);
  return [...ids];
}

export function totalDone(s: LocalState): number {
  return Object.values(s.done).reduce((n, d) => n + Object.keys(d).length, 0);
}

/** 连续打卡天数：从今天（或昨天）往前数，每天至少完成 1 条 */
export function streak(s: LocalState, today: string): number {
  const has = (iso: string) => Object.keys(s.done[iso] || {}).length > 0;
  const d = new Date(today + "T00:00:00");
  if (!has(toISODate(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(toISODate(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
