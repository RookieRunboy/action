"use client";

import type { ReactNode } from "react";
import type { ActionCard, CardState, FlashCard, Result } from "@/lib/types";
import { resultOn } from "@/lib/schedule";
import { leafParts } from "@/lib/dates";
import { TABOOS } from "@/lib/prompts";
import { ActionRow } from "./ActionRow";
import { FlashDeck } from "./FlashDeck";

interface Props {
  date: string;
  actions: ActionCard[];
  flashes: FlashCard[];
  states: Record<string, CardState>;
  onResult: (id: string, result: Result) => void;
  empty?: ReactNode;
  groupComplete?: boolean;
  onRefresh?: () => void;
  completedToday?: boolean;
  libraryEmpty?: boolean;
}

function tabooFor(date: string) {
  const n = date.split("-").reduce((a, b) => a + Number(b), 0);
  return TABOOS[n % TABOOS.length];
}

export function Leaf({
  date, actions, flashes, states, onResult, empty,
  groupComplete = false, onRefresh, completedToday = false, libraryEmpty = false,
}: Props) {
  const { month, day, weekday } = leafParts(date);
  const results = (cards: { id: string }[]) => cards.map((c) => resultOn(states[c.id], date));
  const actionResults = results(actions);
  const flashResults = results(flashes);
  const actionTotal = actionResults.filter((r) => r !== "later").length;
  const actionDone = actionResults.filter((r) => r === "did").length;
  const flashDone = flashResults.filter((r) => r !== undefined).length;
  const hasActions = actions.length > 0;
  const hasFlashes = flashes.length > 0;
  const showYi = hasActions || libraryEmpty || completedToday;
  const showJi = hasFlashes;
  const showRefresh = !!onRefresh && (hasActions || hasFlashes);
  const actionsComplete = actionResults.every((r) => r !== undefined);
  const flashComplete = flashResults.every((r) => r !== undefined);
  const anySuccess = actionResults.includes("did") || flashResults.includes("remembered");
  const anySuccessToday = Object.values(states).some((s) => {
    const r = resultOn(s, date);
    return r === "did" || r === "remembered";
  });
  const sealed = completedToday ? anySuccessToday : actionsComplete && flashComplete && anySuccess;
  const counts = [
    hasActions ? `宜 ${actionDone} / ${actionTotal}` : null,
    hasFlashes ? `记 ${flashDone} / ${flashes.length}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <article className="leaf" aria-live="polite">
      <div className="leaf-holes" aria-hidden><i /><i /></div>
      <header className="px-7 pt-4 pb-5 sm:px-9">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{month} 月 · {weekday}</p>
            <div className="date-num">{String(day).padStart(2, "0")}</div>
          </div>
          <div className="text-right pb-2">
            <p className="brush text-[26px] leading-none text-ink">知行</p>
            <p className="song mt-1 text-[12px] tracking-[0.18em] text-ink-3">无行动，不知乎</p>
          </div>
        </div>
      </header>
      <div className="leaf-rule double mx-7 sm:mx-9" />

      {showYi && (
        <section className="px-7 pt-5 sm:px-9">
          <div className="flex items-start gap-4">
            <span className="mark" aria-label="宜">宜</span>
            <div className="min-w-0 flex-1 pt-1">
              {libraryEmpty && empty}
              {completedToday && <p className="song py-2 text-[15px] text-ink">今天刷完。</p>}
              {actions.map((card) => (
                <ActionRow key={card.id} card={card} state={states[card.id]} date={date} onResult={onResult} />
              ))}
            </div>
          </div>
        </section>
      )}

      {showJi && (
        <>
          {showYi && <div className="leaf-rule mx-7 mt-3 sm:mx-9" />}
          <section className="px-7 pt-5 sm:px-9">
            <div className="flex items-start gap-4">
              <span className="mark" aria-label="记">记</span>
              <div className="min-w-0 flex-1 pt-1">
                <FlashDeck cards={flashes} states={states} date={date} onResult={onResult} />
              </div>
            </div>
          </section>
        </>
      )}

      <div className="leaf-rule mx-7 mt-3 sm:mx-9" />
      <section className="px-7 py-4 sm:px-9">
        <div className="flex items-center gap-4">
          <span className="mark taboo" aria-label="忌">忌</span>
          <p className="song text-[15px] text-ink-2">{tabooFor(date)}</p>
        </div>
      </section>

      <footer className="relative px-7 pb-7 pt-1 sm:px-9">
        <div className="leaf-rule mb-3" />
        <div className="flex items-center justify-between gap-3 text-[12px] text-ink-3 tabular-nums">
          <span>{counts}</span>
          {showRefresh && (
            <button type="button" className="btn btn-ink" disabled={!groupComplete} onClick={onRefresh}>刷新</button>
          )}
        </div>
        {sealed && <span className="stamp big" aria-label="今日知行合一">知行合一</span>}
      </footer>
    </article>
  );
}
