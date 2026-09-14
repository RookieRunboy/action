import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, DEMO_COOKIE, demoEnabled } from "@/lib/session";

export function POST(req: NextRequest) {
  if (!demoEnabled()) return NextResponse.json({ error: "体验模式已关闭。" }, { status: 403 });
  if (!process.env.ZHIHU_ACCESS_SECRET) {
    return NextResponse.json({ error: "服务端未配置 ZHIHU_ACCESS_SECRET，体验模式不可用。" }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, "1", { ...cookieOptions(req), maxAge: 30 * 86400 });
  return res;
}
