"use client";
import { AppShell, type ClientSession } from "./AppShell";
export function TodayPage({ session, date }: { session: ClientSession; date: string }) {
  return <AppShell active="today" session={session}><p className="text-wall-dim">今日页施工中 · {date}</p></AppShell>;
}
