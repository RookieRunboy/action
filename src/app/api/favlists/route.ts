import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getFavlists, ZhihuError } from "@/lib/zhihu";

export async function GET(req: NextRequest) {
  const s = getSessionFromRequest(req);
  if (!s) return NextResponse.json({ error: "还没有登录。" }, { status: 401 });
  try {
    const folders = await getFavlists(s.identity, s.oauthToken);
    return NextResponse.json({ folders });
  } catch (e) {
    const status = e instanceof ZhihuError && e.code === 20001 ? 401 : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "读取收藏夹失败。" }, { status });
  }
}
