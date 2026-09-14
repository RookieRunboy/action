import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, destroySession, SID_COOKIE } from "@/lib/session";

export function POST(req: NextRequest) {
  destroySession(req.cookies.get(SID_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SID_COOKIE);
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
