export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

export type Provider = "dashscope" | "zhida";

export function providerName(): Provider {
  return (process.env.LLM_PROVIDER || "dashscope").toLowerCase() === "zhida" ? "zhida" : "dashscope";
}

export function providerLabel(): string {
  return providerName() === "zhida"
    ? `知乎直答 · ${process.env.ZHIDA_MODEL || "zhida-fast-1p5"}`
    : `通义千问 · ${process.env.DASHSCOPE_MODEL || "qwen-plus"}`;
}

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; code?: string };
  message?: string;
}

async function chatText(system: string, user: string, opts: ChatOptions): Promise<string> {
  const provider = providerName();
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;

  if (provider === "zhida") {
    const secret = process.env.ZHIHU_ACCESS_SECRET?.trim();
    if (!secret) throw new LLMError("未配置 ZHIHU_ACCESS_SECRET，无法调用知乎直答。");
    url = "https://developer.zhihu.com/v1/chat/completions";
    headers = {
      Authorization: `Bearer ${secret}`,
      "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
      "Content-Type": "application/json",
    };
    body = { model: process.env.ZHIDA_MODEL || "zhida-fast-1p5", messages, stream: false };
  } else {
    const key = process.env.DASHSCOPE_API_KEY?.trim();
    if (!key) throw new LLMError("未配置 DASHSCOPE_API_KEY。");
    url = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
    headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    body = {
      model: process.env.DASHSCOPE_MODEL || "qwen-plus",
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 3000,
      response_format: { type: "json_object" },
    };
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  const raw = await res.text();
  let json: ChatCompletion;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new LLMError(`AI 接口返回了无法解析的内容（HTTP ${res.status}）。`);
  }
  if (!res.ok || json.error) {
    const msg = json.error?.message || json.message || `HTTP ${res.status}`;
    throw new LLMError(provider === "zhida" ? `知乎直答调用失败：${msg}` : `通义千问调用失败：${msg}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new LLMError("AI 没有返回内容。");
  return content;
}

export function extractJSON<T>(text: string): T {
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    /* fall through */
  }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1)) as T;
    } catch {
      /* fall through */
    }
  }
  throw new LLMError("AI 返回的不是合法 JSON。");
}

export async function chatJSON<T>(system: string, user: string, opts: ChatOptions = {}): Promise<T> {
  const text = await chatText(system, user, opts);
  return extractJSON<T>(text);
}
