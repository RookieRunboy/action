"use client";
import { useEffect, useRef, useState } from "react";
import { AppShell, type ClientSession } from "./AppShell";
import { FriendPeek } from "./FriendPeek";
import { KANSHAN_HANDLE, KANSHAN_HEADLINE, KANSHAN_KNOWLEDGE, KANSHAN_NAME } from "@/lib/kanshan";
import { adoptFlash, peekKanshan, peekMe } from "@/lib/friends";
import { emptyState, loadState, saveState } from "@/lib/state";
import type { StateV2 } from "@/lib/types";

export function FriendsPage({ session }: { session: ClientSession }) {
  const [state, setState] = useState<StateV2>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<"kanshan" | "me" | null>(null);
  const [saveWarn, setSaveWarn] = useState(false);
  const kanshanRowRef = useRef<HTMLButtonElement>(null);
  const meRowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setState(loadState(session.identity));
    setHydrated(true);
  }, [session.identity]);
  useEffect(() => {
    if (!hydrated) return;
    if (!saveState(session.identity, state)) setSaveWarn(true);
  }, [hydrated, session.identity, state]);
  const mine = peekMe(state);
  const mountain = peekKanshan();
  const adoptedIds = new Set(
    Object.values(state.states)
      .filter((s) => s.status !== "dismissed")
      .map((s) => s.id),
  );
  function onAdopt(id: string) {
    const card = KANSHAN_KNOWLEDGE.find((c) => c.id === id);
    if (!card) return;
    setState((prev) => adoptFlash(prev, card, Date.now()).state);
  }
  function closePeek() {
    const row = selected === "me" ? meRowRef.current : kanshanRowRef.current;
    setSelected(null);
    requestAnimationFrame(() => row?.focus());
  }
  return (
    <AppShell active="friends" session={session}>
      {saveWarn && <p className="mt-2 text-xs text-[#e8897a]">本浏览器无法保存进度，进度只在本次会话有效。</p>}
      <ul className="friend-list">
        <li>
          <button type="button" className="friend-row" ref={kanshanRowRef} onClick={() => setSelected("kanshan")}>
            <span className="friend-name">{KANSHAN_NAME}</span>
            <span className="friend-id">{KANSHAN_HANDLE}</span>
            <span className="friend-latest">{mountain.latest}</span>
          </button>
        </li>
        <li>
          <button type="button" className="friend-row" ref={meRowRef} onClick={() => setSelected("me")}>
            <span className="friend-name">{session.user.name}</span>
            <span className="friend-id">{session.identity}</span>
            <span className="friend-latest">{hydrated ? mine.latest : ""}</span>
          </button>
        </li>
      </ul>
      {selected === "kanshan" && (
        <FriendPeek
          name={KANSHAN_NAME}
          handle={KANSHAN_HANDLE}
          headline={KANSHAN_HEADLINE}
          peek={mountain}
          canAdopt
          adoptedIds={adoptedIds}
          onAdopt={onAdopt}
          onClose={closePeek}
        />
      )}
      {selected === "me" && (
        <FriendPeek
          name={session.user.name}
          handle={session.identity}
          peek={mine}
          canAdopt={false}
          adoptedIds={new Set<string>()}
          onAdopt={() => {}}
          onClose={closePeek}
        />
      )}
    </AppShell>
  );
}
