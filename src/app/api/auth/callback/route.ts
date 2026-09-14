import { NextResponse, type NextRequest } from "next/server";
import { consumeState, cookieOptions, createSession, encodeSession, oauthConfigured, SID_COOKIE } from "@/lib/session";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  code?: number;
  message?: string;
}
interface Profile {
  uid?: number | string;
  hash_id?: string;
  fullname?: string;
  headline?: string;
  avatar_path?: string;
  code?: number;
  data?: unknown;
}

/** uid 可能超出 JS 安全整数，直接从原文里无损取出字符串 */
function extractUid(raw: string): string | undefined {
  const m = raw.match(/"uid"\s*:\s*"?(\d+)"?/);
  return m?.[1];
}

function fail(req: NextRequest, reason: string) {
  return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(reason)}`, req.url));
}

export async function GET(req: NextRequest) {
  if (!oauthConfigured()) return fail(req, "oauth_unconfigured");
  const q = req.nextUrl.searchParams;
  const code = q.get("authorization_code") || q.get("code");
  if (!consumeState(q.get("state"))) return fail(req, "state_mismatch");
  if (!code) return fail(req, "no_code");

  const form = new URLSearchParams({
    app_id: process.env.ZHIHU_OAUTH_APP_ID!,
    app_key: process.env.ZHIHU_OAUTH_APP_KEY!,
    grant_type: "authorization_code",
    redirect_uri: process.env.ZHIHU_OAUTH_REDIRECT_URI!,
    code,
  });
  const tokenRes = await fetch("https://openapi.zhihu.com/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  const token = (await tokenRes.json().catch(() => ({}))) as TokenResponse;
  if (!token.access_token) return fail(req, "token_exchange_failed");

  const profileRes = await fetch("https://openapi.zhihu.com/user", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  const rawProfile = await profileRes.text();
  let profile: Profile = {};
  try {
    profile = JSON.parse(rawProfile);
  } catch {
    return fail(req, "profile_failed");
  }
  const uid = extractUid(rawProfile) || profile.hash_id;
  if (!uid || !profile.fullname) return fail(req, "profile_failed");

  const ttl = Math.max(60, Math.min(token.expires_in ?? 3600, 7 * 86400)) * 1000;
  const session = createSession({
    kind: "oauth",
    identity: `u${uid}`,
    oauthToken: token.access_token,
    expiresAt: Date.now() + ttl,
    user: { name: profile.fullname, avatar: profile.avatar_path, headline: profile.headline },
  });

  const res = NextResponse.redirect(new URL("/plan", req.url));
  res.cookies.set(SID_COOKIE, encodeSession(session), { ...cookieOptions(req), maxAge: Math.floor(ttl / 1000) });
  return res;
}
