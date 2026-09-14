import { beforeEach, describe, expect, test } from "bun:test";
import { consumeState, createSession, decodeSession, encodeSession, newState } from "@/lib/session";

beforeEach(() => {
  process.env.ZHIHU_OAUTH_APP_KEY = "test-app-key-for-hmac";
});

describe("OAuth state（无共享内存）", () => {
  test("签发后在另一进程也能校验", () => {
    const now = 1_700_000_000_000;
    const s = newState(now);
    expect(consumeState(s, now + 1000)).toBe(true);
  });
  test("篡改后的 state 无效", () => {
    const s = newState(1_700_000_000_000);
    expect(consumeState(s.slice(0, -2) + "xx")).toBe(false);
    expect(consumeState("not-a-state")).toBe(false);
    expect(consumeState(null)).toBe(false);
  });
  test("超过 10 分钟过期", () => {
    const now = 1_700_000_000_000;
    const s = newState(now);
    expect(consumeState(s, now + 10 * 60 * 1000 - 1)).toBe(true);
    expect(consumeState(s, now + 10 * 60 * 1000 + 1)).toBe(false);
  });
});

describe("会话 cookie", () => {
  const input = {
    kind: "oauth" as const,
    identity: "u42",
    oauthToken: "tok-abc",
    expiresAt: 1_800_000_000_000,
    user: { name: "张三", headline: "h" },
  };

  test("编码后可在另一进程还原", () => {
    const session = createSession(input);
    const raw = encodeSession(session);
    const got = decodeSession(raw);
    expect(got).toMatchObject(input);
    expect(got?.id).toBe(session.id);
  });
  test("篡改 cookie 无效", () => {
    const raw = encodeSession(createSession(input));
    expect(decodeSession(raw.slice(0, -3) + "zzz")).toBeNull();
    expect(decodeSession("garbage")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
  test("过期会话无效", () => {
    const session = createSession({ ...input, expiresAt: Date.now() - 1000 });
    expect(decodeSession(encodeSession(session))).toBeNull();
  });
});
