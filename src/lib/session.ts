import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export interface SessionUser {
  name: string;
  avatar?: string;
  headline?: string;
}

export interface Session {
  id: string;
  kind: "oauth" | "demo";
  /** 用于缓存隔离的用户标识：OAuth 为 uid，体验模式为 self */
  identity: string;
  oauthToken?: string;
  expiresAt: number;
  user: SessionUser;
}

interface Store {
  sessions: Map<string, Session>;
  states: Map<string, number>;
}

const g = globalThis as unknown as { __zxStore?: Store };
const store: Store = (g.__zxStore ??= { sessions: new Map(), states: new Map() });

export const SID_COOKIE = "zx_sid";
export const DEMO_COOKIE = "zx_demo";
const STATE_TTL = 10 * 60 * 1000;

export function demoEnabled(): boolean {
  return (process.env.DEMO_MODE || "on").toLowerCase() !== "off";
}

export function oauthConfigured(): boolean {
  return !!(process.env.ZHIHU_OAUTH_APP_ID && process.env.ZHIHU_OAUTH_APP_KEY && process.env.ZHIHU_OAUTH_REDIRECT_URI);
}

export function newState(): string {
  const s = crypto.randomBytes(24).toString("base64url");
  store.states.set(s, Date.now());
  return s;
}

/** 校验并一次性消费 state */
export function consumeState(s: string | null): boolean {
  if (!s) return false;
  const at = store.states.get(s);
  store.states.delete(s);
  if (at === undefined) return false;
  return Date.now() - at < STATE_TTL;
}

export function createSession(input: Omit<Session, "id">): Session {
  const id = crypto.randomBytes(24).toString("base64url");
  const session = { ...input, id };
  store.sessions.set(id, session);
  return session;
}

export function destroySession(id: string | undefined) {
  if (id) store.sessions.delete(id);
}

function demoSession(): Session {
  return {
    id: "demo",
    kind: "demo",
    identity: "self",
    expiresAt: Number.MAX_SAFE_INTEGER,
    user: { name: "体验账号", headline: "读取 Access Secret 本人的收藏" },
  };
}

function resolve(sid: string | undefined, demo: string | undefined): Session | null {
  if (sid) {
    const s = store.sessions.get(sid);
    if (s && s.expiresAt > Date.now()) return s;
    if (s) store.sessions.delete(sid);
  }
  if (demo === "1" && demoEnabled()) return demoSession();
  return null;
}

/** 服务端组件中读取当前会话 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return resolve(jar.get(SID_COOKIE)?.value, jar.get(DEMO_COOKIE)?.value);
}

/** Route Handler 中读取当前会话 */
export function getSessionFromRequest(req: NextRequest): Session | null {
  return resolve(req.cookies.get(SID_COOKIE)?.value, req.cookies.get(DEMO_COOKIE)?.value);
}

export function cookieOptions(req: NextRequest) {
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
}
