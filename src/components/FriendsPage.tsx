"use client";
import { useEffect, useState } from "react";
import { AppShell, type ClientSession } from "./AppShell";
import { KANSHAN_HANDLE, KANSHAN_NAME } from "@/lib/kanshan";
import { peekKanshan, peekMe } from "@/lib/friends";
import { emptyState, loadState } from "@/lib/state";
import type { StateV2 } from "@/lib/types";

export function FriendsPage({ session }: { session: ClientSession }) {
  const [state, setState] = useState<StateV2>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<"kanshan" | "me" | null>(null);
  useEffect(() => {
    setState(loadState(session.identity));
    setHydrated(true);
  }, [session.identity]);
  const mine = peekMe(state);
  const mountain = peekKanshan();
  return (
    <AppShell active="friends" session={session}>
      <ul className="friend-list">
        <li>
          <button type="button" className="friend-row" onClick={() => setSelected("kanshan")}>
            <span className="friend-name">{KANSHAN_NAME}</span>
            <span className="friend-id">{KANSHAN_HANDLE}</span>
            <span className="friend-latest">{mountain.latest}</span>
          </button>
        </li>
        <li>
          <button type="button" className="friend-row" onClick={() => setSelected("me")}>
            <span className="friend-name">{session.user.name}</span>
            <span className="friend-id">{session.identity}</span>
            <span className="friend-latest">{hydrated ? mine.latest : ""}</span>
          </button>
        </li>
      </ul>
      {selected && <div data-testid="friend-peek-placeholder">{selected}</div>}
    </AppShell>
  );
}
