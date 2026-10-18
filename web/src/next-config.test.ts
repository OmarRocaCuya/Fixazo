import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isolated local emotion development output", () => {
  it.each([
    ["development", "true", ".next-emotion"],
    ["production", "true", undefined],
    ["test", "true", undefined],
    ["development", "false", undefined],
    ["development", "../arbitrary-path", undefined],
    ["development", undefined, undefined],
  ] as const)("NODE_ENV=%s, explicit flag=%s", async (mode, flag, expected) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("NAWINCHAY_EMOTION_LOCAL", flag);
    vi.resetModules();
    const { default: config } = await import("../next.config");
    expect(config.distDir).toBe(expected);
    expect(config.cacheComponents).toBe(true);
    expect(config.partialPrefetching).toBe(true);
  });
});
