"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ActionCard, FlashCard, Result, StateV2 } from "@/lib/types";
import { emptyState, ensureQueue, loadState, recordResult, saveState } from "@/lib/state";
import { streak, summarize } from "@/lib/schedule";
import { AppShell, type ClientSession } from "./AppShell";
import { Leaf } from "./Leaf";
import { Shelf } from "./Shelf";

export function TodayPage({ session, date }: { session: ClientSession; date: string }) {
  const [state, setState] = useState<StateV2>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [saveWarn, setSaveWarn] = useState(false);

  useEffect(() => {
    const s = ensureQueue(loadState(session.identity), date);
    setState(s);
    setHydrated(true);
  }, [session.identity, date]);

  useEffect(() => {
    if (hydrated && !saveState(session.identity, state)) setSaveWarn(true);
  }, [state, hydrated, session.identity]);

  const onResult = useCallback((id: string, result: Result) => {
    setState((s) => recordResult(s, id, result, date));
  }, [date]);

  const queue = state.queues[date] ?? { ids: [] };
  const actions = useMemo(
    () => queue.ids.map((id) => state.cards[id]).filter((c): c is ActionCard => !!c && c.kind === "action"),
    [queue.ids, state.cards],
  );
  const flashes = useMemo(
    () => queue.ids.map((id) => state.cards[id]).filter((c): c is FlashCard => !!c && c.kind === "flash"),
    [queue.ids, state.cards],
  );

  const empty = (
    <div className="py-2">
      <p className="song text-[15px] text-ink">还没有加入任何卡片。</p>
      <Link href="/plan" className="btn btn-ink mt-3 inline-flex">去筹划页挑几张</Link>
    </div>
  );

  return (
    <AppShell active="today" session={session}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[560px] lg:mx-0">
          {hydrated ? (
            <Leaf date={date} actions={actions} flashes={flashes} states={state.states} onResult={onResult} empty={empty} />
          ) : (
            <div className="leaf h-[520px]" aria-busy />
          )}
        </div>
        <Shelf
          summary={summarize(state.states)}
          streakDays={streak(state.states, date)}
          scan={state.lastFolder ? state.folders[state.lastFolder] : undefined}
          saveWarn={saveWarn}
        />
      </div>
    </AppShell>
  );
}
