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

export const SID_COOKIE = "zx_sid";
export const DEMO_COOKIE = "zx_demo";
const STATE_TTL = 10 * 60 * 1000;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.ZHIHU_OAUTH_APP_KEY || "";
}

function hmac(payload: string): string {
  const key = secret();
  if (!key) return "";
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function splitSigned(raw: string): { payload: string; mac: string } | null {
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  return { payload: raw.slice(0, i), mac: raw.slice(i + 1) };
}

export function demoEnabled(): boolean {
  return (process.env.DEMO_MODE || "on").toLowerCase() !== "off";
}

export function oauthConfigured(): boolean {
  return !!(process.env.ZHIHU_OAUTH_APP_ID && process.env.ZHIHU_OAUTH_APP_KEY && process.env.ZHIHU_OAUTH_REDIRECT_URI);
}

export function newState(now = Date.now()): string {
  const payload = `${now.toString(36)}.${crypto.randomBytes(16).toString("base64url")}`;
  return `${payload}.${hmac(payload)}`;
}

/** 校验签名与时效。服务端无共享内存，同一 state 在 TTL 内可重复通过。 */
export function consumeState(s: string | null, now = Date.now()): boolean {
  if (!s) return false;
  const parts = splitSigned(s);
  if (!parts || !same(hmac(parts.payload), parts.mac)) return false;
  const at = parseInt(parts.payload.split(".")[0] ?? "", 36);
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age < STATE_TTL;
}

export function createSession(input: Omit<Session, "id">): Session {
  return { ...input, id: crypto.randomBytes(24).toString("base64url") };
}

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  const parts = splitSigned(raw);
  if (!parts || !same(hmac(parts.payload), parts.mac)) return null;
  try {
    const s = JSON.parse(Buffer.from(parts.payload, "base64url").toString("utf8")) as Session;
    if (!s?.id || !s.identity || typeof s.expiresAt !== "number") return null;
    if (s.expiresAt <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function demoSession(): Session {
  return {
    id: "demo",
    kind: "demo",
    identity: "self",
    expiresAt: Number.MAX_SAFE_INTEGER,
    user: { name: "示例账号", headline: "项目作者的公开收藏夹" },
  };
}

function resolve(sid: string | undefined, demo: string | undefined): Session | null {
  const s = decodeSession(sid);
  if (s) return s;
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
  const host = req.nextUrl.hostname;
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const domain = host === "runbol.cn" || host.endsWith(".runbol.cn") ? ".runbol.cn" : undefined;
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", ...(domain ? { domain } : {}) };
}
