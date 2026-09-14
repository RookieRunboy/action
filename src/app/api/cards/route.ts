import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { ingestLibrary } from "@/lib/pipeline";
import { ZhihuError } from "@/lib/zhihu";
import { LLMError } from "@/lib/llm";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const s = getSessionFromRequest(req);
  if (!s) return NextResponse.json({ error: "还没有登录。" }, { status: 401 });

  try {
    const res = await ingestLibrary({
      identity: s.identity,
      oauthToken: s.oauthToken,
      demo: s.kind === "demo",
      refresh: req.nextUrl.searchParams.get("refresh") === "1",
    });
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof ZhihuError) {
      const status = e.code === 20001 ? 401 : e.code === 30001 || e.code === 30002 ? 429 : 502;
      return NextResponse.json({ error: e.message, source: "zhihu" }, { status });
    }
    if (e instanceof LLMError) return NextResponse.json({ error: e.message, source: "llm" }, { status: 502 });
    console.error(e);
    return NextResponse.json({ error: "读取收藏失败，稍后再试。" }, { status: 500 });
  }
}
