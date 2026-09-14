"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FavFolder, PlanResponse } from "@/lib/types";
import { excludedIds, loadState, saveState, streak, totalDone, type LocalState } from "@/lib/store";
import { todayISO } from "@/lib/dates";
import { Leaf } from "./Leaf";
import { Shelf } from "./Shelf";
import { Welcome } from "./Welcome";

export interface ClientSession {
  kind: "oauth" | "demo";
  identity: string;
  user: { name: string; avatar?: string; headline?: string };
}

interface Props {
  initialSession: ClientSession | null;
  oauth: boolean;
  demo: boolean;
  error?: string;
}

const ERRORS: Record<string, string> = {
  oauth_unconfigured: "还没配置知乎登录凭证，先用体验模式看看。",
  state_mismatch: "登录请求已过期或被篡改，请重新登录。",
  no_code: "知乎没有返回授权码，请重新登录。",
  token_exchange_failed: "向知乎换取登录凭证失败，请重试。",
  profile_failed: "读取知乎账号信息失败，请重试。",
};

export function App({ initialSession, oauth, demo, error }: Props) {
  const [session, setSession] = useState<ClientSession | null>(initialSession);
  const [folders, setFolders] = useState<FavFolder[] | null>(null);
  const [folder, setFolder] = useState<string>("");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [state, setState] = useState<LocalState>(() => ({ done: {}, swapped: {} }));
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = useMemo(() => todayISO(), []);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const s = loadState();
    setState(s);
    if (s.folder) setFolder(s.folder);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/favlists")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "读取收藏夹失败。");
        return j.folders as FavFolder[];
      })
      .then((fs) => {
        if (cancelled) return;
        setFolders(fs);
        setFolder((cur) => (cur && fs.some((f) => f.urlToken === cur) ? cur : fs[0]?.urlToken || ""));
      })
      .catch((e: Error) => {
        if (!cancelled) setPlanError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const loadPlan = useCallback(
    async (opts: { refresh?: boolean } = {}) => {
      if (!session || !folder || !hydrated) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setPlanError(null);
      try {
        const q = new URLSearchParams({ folder, date: today, exclude: excludedIds(state, today).join(",") });
        if (opts.refresh) q.set("refresh", "1");
        const r = await fetch(`/api/plan?${q}`, { signal: ac.signal });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "生成今日行动失败。");
        setPlan(j as PlanResponse);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPlanError((e as Error).message);
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    },
    // exclude 变化（打卡/换一条）不应触发重新生成，故不依赖 state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, folder, hydrated, today],
  );

  useEffect(() => {
    if (!folder) return;
    setState((s) => (s.folder === folder ? s : { ...s, folder }));
    setPlan(null);
    loadPlan();
  }, [folder, loadPlan]);

  const doneMap = state.done[today] || {};

  function toggle(id: string, checked: boolean) {
    setState((s) => {
      const day = { ...(s.done[today] || {}) };
      if (checked) day[id] = { at: Date.now() };
      else delete day[id];
      return { ...s, done: { ...s.done, [today]: day } };
    });
  }

  function replied(id: string) {
    setState((s) => {
      const day = { ...(s.done[today] || {}) };
      if (day[id]) day[id] = { ...day[id], replied: true };
      return { ...s, done: { ...s.done, [today]: day } };
    });
  }

  function swap(id: string) {
    if (!plan || plan.spares.length === 0) return;
    const [next, ...rest] = plan.spares;
    setPlan({ ...plan, today: plan.today.map((t) => (t.id === id ? next : t)), spares: rest });
    setState((s) => ({ ...s, swapped: { ...s.swapped, [today]: [...(s.swapped[today] || []), id] } }));
  }

  async function enterDemo() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/demo", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "进入体验模式失败。");
      setSession({ kind: "demo", identity: "self", user: { name: "体验账号", headline: "读取 Access Secret 本人的收藏" } });
    } catch (e) {
      setPlanError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setFolders(null);
    setPlan(null);
    setFolder("");
  }

  if (!session) {
    return <Welcome oauth={oauth} demo={demo} busy={busy} onDemo={enterDemo} error={error ? ERRORS[error] || "登录失败，请重试。" : planError} />;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="brush text-2xl leading-none text-white">知行</span>
          <span className="hidden text-xs tracking-[0.2em] text-wall-dim sm:inline">无行动，不知乎</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {folders && folders.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-wall-dim">
              <span className="hidden sm:inline">收藏夹</span>
              <select className="select" value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="选择收藏夹">
                {folders.map((f) => (
                  <option key={f.urlToken} value={f.urlToken}>
                    {f.title}
                    {f.isPublic ? "" : "（私密）"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => loadPlan({ refresh: true })} disabled={loading || !folder} title="重新分拣这个收藏夹">
            重新分拣
          </button>
          <div className="ml-1 flex items-center gap-2 text-sm">
            {session.user.avatar && <img src={session.user.avatar} alt="" className="h-6 w-6 rounded-full" />}
            <span className="text-wall-ink">{session.user.name}</span>
            {session.kind === "demo" && <span className="rounded-sm border border-white/15 px-1.5 py-0.5 text-[10px] tracking-wider text-wall-dim">体验模式</span>}
            <button type="button" className="btn btn-text !text-wall-dim hover:!text-white" onClick={logout}>
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[560px] lg:mx-0">
          <Leaf
            date={today}
            plan={plan}
            loading={loading || (!plan && !planError)}
            error={planError}
            doneMap={doneMap}
            onToggle={toggle}
            onReplied={replied}
            onSwap={swap}
            onRetry={() => loadPlan()}
          />
        </div>
        <Shelf plan={plan} totalDone={totalDone(state)} streakDays={streak(state, today)} />
      </div>
    </main>
  );
}
