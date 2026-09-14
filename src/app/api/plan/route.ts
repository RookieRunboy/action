import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { buildPlan } from "@/lib/pipeline";
import { ZhihuError } from "@/lib/zhihu";
import { LLMError } from "@/lib/llm";
import { todayISO } from "@/lib/dates";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const s = getSessionFromRequest(req);
  if (!s) return NextResponse.json({ error: "还没有登录。" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const folder = q.get("folder")?.trim();
  if (!folder || !/^\d+$/.test(folder)) return NextResponse.json({ error: "缺少收藏夹。" }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") || "") ? q.get("date")! : todayISO();
  const exclude = (q.get("exclude") || "").split(",").filter(Boolean).slice(0, 500);
  const refresh = q.get("refresh") === "1";

  try {
    const plan = await buildPlan({ identity: s.identity, folderToken: folder, date, exclude, oauthToken: s.oauthToken, refresh });
    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof ZhihuError) {
      const status = e.code === 20001 ? 401 : e.code === 30002 || e.code === 30001 ? 429 : 502;
      return NextResponse.json({ error: e.message, source: "zhihu" }, { status });
    }
    if (e instanceof LLMError) return NextResponse.json({ error: e.message, source: "llm" }, { status: 502 });
    console.error(e);
    return NextResponse.json({ error: "生成今日行动失败，稍后再试。" }, { status: 500 });
  }
}
