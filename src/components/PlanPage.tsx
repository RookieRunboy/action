"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CardsResponse, FavFolder, FolderScan, StateV2 } from "@/lib/types";
import { pickDefaultFolder } from "@/lib/folders";
import { dismissCard, emptyState, importCards, loadLibrary, loadState, saveLibrary, saveState, visibleCandidates } from "@/lib/state";
import { AppShell, type ClientSession } from "./AppShell";
import { CandidateRow } from "./CandidateRow";
import { TagChips } from "./TagChips";

function scanOf(data: CardsResponse, scannedAt: number): { token: string } & FolderScan {
  return {
    token: data.folder.urlToken,
    title: data.folder.title,
    counts: data.counts,
    scannedAt,
    provider: data.provider,
  };
}

export function PlanPage({ session }: { session: ClientSession }) {
  const [state, setState] = useState<StateV2>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [folders, setFolders] = useState<FavFolder[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [data, setData] = useState<CardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [saveWarn, setSaveWarn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const ingestLock = useRef(false);
  const defaultToken = folders ? pickDefaultFolder(folders)?.urlToken : undefined;

  useEffect(() => {
    const lib = loadLibrary(session.identity);
    let s = loadState(session.identity);
    if (lib) {
      const scannedAt = s.folders[lib.folder.urlToken]?.scannedAt ?? Date.now();
      s = importCards(s, lib.cards, Date.now(), scanOf(lib, scannedAt));
    }
    setState(s);
    setData(lib);
    setHydrated(true);
  }, [session.identity]);

  useEffect(() => {
    if (!hydrated) return;
    if (!saveState(session.identity, state)) setSaveWarn(true);
  }, [state, hydrated, session.identity]);

  useEffect(() => {
    if (!hydrated) return;
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
        const d = pickDefaultFolder(fs);
        setPicked(new Set(d ? [d.urlToken] : []));
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const ingest = useCallback(async () => {
    if (ingestLock.current) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    ingestLock.current = true;
    setLoading(true);
    setError(null);
    setTag(null);
    const keys = [...picked];
    const q = keys.length ? `?folders=${keys.map(encodeURIComponent).join(",")}` : "";
    try {
      const r = await fetch(`/api/cards${q}`, { signal: ac.signal });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "读取收藏失败。");
      const lib = j as CardsResponse;
      saveLibrary(session.identity, lib);
      setData(lib);
      setState((prev) => importCards(prev, lib.cards, Date.now(), scanOf(lib, Date.now())));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      ingestLock.current = false;
      if (abortRef.current === ac) setLoading(false);
    }
  }, [session.identity, picked]);

  const listed = useMemo(
    () => (data ? visibleCandidates(data.cards, state.states) : []),
    [data, state.states],
  );

  const doTags = useMemo(() => {
    const set = new Set<string>();
    listed.forEach((c) => c.tags.do.forEach((t) => set.add(t)));
    return [...set];
  }, [listed]);

  useEffect(() => {
    if (tag !== null && !doTags.includes(tag)) setTag(null);
  }, [tag, doTags]);

  const visible = useMemo(
    () => (data ? visibleCandidates(data.cards, state.states, tag) : []),
    [data, state.states, tag],
  );

  function remove(id: string) {
    setState((prev) => dismissCard(prev, id));
  }

  const c = data?.counts;
  const pct = (n: number) => (c && c.total ? `${(n / c.total) * 100}%` : "0%");

  return (
    <AppShell active="plan" session={session}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)] lg:items-start">
        <section className="leaf px-7 py-6 sm:px-9">
          <p className="eyebrow">筹划</p>
          <h1 className="song mt-1 text-[22px] font-semibold text-ink">从收藏里挑出想养成的</h1>
          <p className="mt-1 text-sm text-ink-2">
            「做」是两分钟能完成的动作，「记」是翻面自测的闪卡。确认读入后默认加入，不顺眼就删。
            {" "}
            <Link href="/today" className="text-link underline decoration-[var(--rule)] underline-offset-2">去今日</Link>
          </p>
          {saveWarn && <p className="mt-2 text-xs text-[#e8897a]">本浏览器无法保存进度，进度只在本次会话有效。</p>}

          {loading && (
            <div className="mt-6 space-y-5" aria-label="正在读收藏">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-[24px_32px_1fr] gap-3">
                  <div className="shimmer h-6 w-6" />
                  <div className="shimmer h-8 w-8" />
                  <div className="space-y-2">
                    <div className="shimmer h-4 w-[70%]" />
                    <div className="shimmer h-3 w-[50%]" />
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-3">
                {picked.size > 1 ? `正在读 ${picked.size} 个收藏夹` : "正在读默认收藏夹"}，分拣哪些能做、哪些该记……大约一分钟。
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="mt-6">
              <p className="song text-ink">{error}</p>
              <button type="button" className="btn btn-ink mt-3" onClick={() => void ingest()}>再试一次</button>
            </div>
          )}

          {!loading && !error && !data && (
            <p className="song mt-6 text-ink">右边勾选要读的收藏夹，点「确认读入」。不勾则只读默认收藏夹。</p>
          )}
          {!loading && !error && data && data.counts.total === 0 && (
            <p className="song mt-6 text-ink">收藏里还是空的。去知乎收藏几篇真正想做的，再来登录。</p>
          )}
          {!loading && !error && data && data.counts.total > 0 && data.cards.length === 0 && (
            <p className="song mt-6 text-ink">{data.counts.total} 条里没有能变成卡片的。去知乎收藏几篇真正想做的再来。</p>
          )}

          {!loading && !error && data && data.cards.length > 0 && (
            <>
              <div className="mt-5"><TagChips tags={doTags} active={tag} onChange={setTag} /></div>
              <div className="mt-2">
                {visible.map((card) => (
                  <CandidateRow key={card.id} card={card} state={state.states[card.id]} onDismiss={remove} />
                ))}
                {visible.length === 0 && (
                  <p className="py-6 text-sm text-ink-3">
                    {tag !== null
                      ? "这个标签下没有卡片。"
                      : <>不顺眼的都删了。<Link href="/today" className="text-link underline decoration-[var(--rule)] underline-offset-2">去今日</Link></>}
                  </p>
                )}
              </div>
            </>
          )}

          {!loading && !error && data && data.skipped.length > 0 && (
            <div className="mt-6 border-t border-dashed border-[var(--rule)] pt-4">
              <button type="button" className="flex w-full items-baseline justify-between text-left" onClick={() => setSkipOpen((o) => !o)} aria-expanded={skipOpen}>
                <span className="song text-[15px] text-ink">放过的 <span className="tabular-nums text-ink-3">{data.skipped.length}</span></span>
                <span className="text-xs text-ink-3">{skipOpen ? "收起" : "展开"}</span>
              </button>
              <p className="mt-1 text-xs text-ink-3">故事、情绪、争论。不会硬把它们变成任务。</p>
              {skipOpen && (
                <ul className="mt-2 space-y-2">
                  {data.skipped.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3 text-[13px]">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate text-ink-2 underline decoration-[var(--rule)] underline-offset-2">{s.title}</a>
                      <span className="shrink-0 text-ink-3">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {folders && folders.length > 0 && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">收藏夹</p>
              <p className="mt-1 text-[11px] leading-relaxed text-wall-dim">勾选不会立刻读取。选好后点确认，不选则只读默认收藏夹。</p>
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {folders.map((f) => (
                  <li key={f.urlToken}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-wall-ink">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={picked.has(f.urlToken)}
                        onChange={(e) => {
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(f.urlToken);
                            else next.delete(f.urlToken);
                            return next;
                          });
                        }}
                      />
                      <span>
                        {f.title}
                        {f.urlToken === defaultToken && <span className="ml-1 text-[10px] tracking-wider text-wall-dim">默认</span>}
                        {!f.isPublic && <span className="ml-1 text-[10px] text-wall-dim">私密</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-seal mt-3 w-full" disabled={loading} onClick={() => void ingest()}>
                确认读入
              </button>
            </div>
          )}
          {c && c.total > 0 && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">收藏夹体检</p>
              <div className="bar mt-3" aria-hidden>
                <i style={{ width: pct(c.action), background: "var(--seal)" }} />
                <i style={{ width: pct(c.flash), background: "#5f7fa8" }} />
                <i style={{ width: pct(c.skip), background: "rgba(255,255,255,0.14)" }} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-wall-dim">能做的</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.action}</dd></div>
                <div><dt className="text-wall-dim">值得记的</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.flash}</dd></div>
                <div><dt className="text-wall-dim">放过的</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.skip}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-wall-dim">
                {c.skip > c.action + c.flash
                  ? `${c.total} 条里只有 ${c.action + c.flash} 条能变成卡片。收藏得多，不等于学到得多。`
                  : `${c.total} 条里有 ${c.action + c.flash} 条能变成卡片，这是个干货密度很高的收藏夹。`}
              </p>
            </div>
          )}
          {data && (
            <p className="px-1 text-[11px] leading-relaxed text-wall-dim">分拣与转化：{data.provider}。只读取标题与摘要，结果保存在本浏览器。</p>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
