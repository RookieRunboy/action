import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, SID_COOKIE } from "@/lib/session";

export function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const opts = cookieOptions(req);
  res.cookies.set(SID_COOKIE, "", { ...opts, maxAge: 0 });
  return res;
}
