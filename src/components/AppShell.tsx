"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export interface ClientSession {
  kind: "oauth";
  identity: string;
  user: { name: string; avatar?: string; headline?: string };
}

interface Props {
  active: "plan" | "today" | "review" | "friends";
  session: ClientSession;
  right?: ReactNode;
  children?: ReactNode;
}

export function AppShell({ active, session, right, children }: Props) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  const tab = (href: "/plan" | "/today" | "/review" | "/friends", label: string, key: "plan" | "today" | "review" | "friends") => (
    <Link
      href={href}
      className={`px-2 py-1 text-sm transition-colors ${active === key ? "text-white border-b border-[var(--seal)]" : "text-wall-dim hover:text-white"}`}
      aria-current={active === key ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <span className="brush text-2xl leading-none text-white">知行</span>
            <span className="hidden text-xs tracking-[0.2em] text-wall-dim sm:inline">无行动，不知乎</span>
          </div>
          <nav className="flex items-center gap-3" aria-label="页面">
            {tab("/today", "今日", "today")}
            {tab("/plan", "筹划", "plan")}
            {tab("/review", "回顾", "review")}
            {tab("/friends", "好友", "friends")}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {right}
          <div className="ml-1 flex items-center gap-2 text-sm">
            {session.user.avatar && <img src={session.user.avatar} alt="" className="h-6 w-6 rounded-full" />}
            <span className="text-wall-ink">{session.user.name}</span>
            <button type="button" className="btn btn-text !text-wall-dim hover:!text-white" onClick={logout}>
              退出
            </button>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
