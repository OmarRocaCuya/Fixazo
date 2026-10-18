import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("../../../../../pipeline/correr.mjs", () => ({ unaNoticia: vi.fn() }));
vi.mock("@/lib/periodico/ediciones", () => ({ noticiaPublica: vi.fn() }));
import { connection } from "next/server";
import { unaNoticia } from "../../../../../pipeline/correr.mjs";
import { GET, POST } from "./route";

beforeEach(() => {
  vi.stubEnv("PERIODICO_DEMO_GENERAR", "");
  vi.stubEnv("OPENROUTER_API_KEY", "unit-test-never-a-real-key");
  vi.stubEnv("TAVILY_API_KEY", "unit-test-never-a-real-key");
  vi.clearAllMocks();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("live generation runtime capability", () => {
  it("waits for request-time rendering before reading the flag", async () => {
    let release!: () => void;
    vi.mocked(connection).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    const response = GET();
    expect(connection).toHaveBeenCalledOnce();
    vi.stubEnv("PERIODICO_DEMO_GENERAR", "true");
    release();
    expect(await (await response).json()).toEqual({ enabled: true });
    expect(unaNoticia).not.toHaveBeenCalled();
  });

  it.each(["", "false", "TRUE"])("stays disabled without explicit true: %j", async (flag) => {
    vi.stubEnv("PERIODICO_DEMO_GENERAR", flag);
    const response = await GET();
    expect(await response.json()).toEqual({ enabled: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(unaNoticia).not.toHaveBeenCalled();
  });

  it.each(["OPENROUTER_API_KEY", "TAVILY_API_KEY"])("stays disabled without %s", async (key) => {
    vi.stubEnv("PERIODICO_DEMO_GENERAR", "true");
    vi.stubEnv(key, "");
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect(unaNoticia).not.toHaveBeenCalled();
  });

  it("reads runtime flag changes on each call, without requiring optional Exa", async () => {
    expect(await (await GET()).json()).toEqual({ enabled: false });
    vi.stubEnv("PERIODICO_DEMO_GENERAR", "true");
    vi.stubEnv("EXA_API_KEY", "");
    expect(await (await GET()).json()).toEqual({ enabled: true });
    vi.stubEnv("PERIODICO_DEMO_GENERAR", "false");
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect(unaNoticia).not.toHaveBeenCalled();
  });

  it("rejects disabled POST without starting the pipeline", async () => {
    const response = await POST(new Request("https://example.test/api/periodico/generar", { method: "POST" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "demo-disabled" });
    expect(unaNoticia).not.toHaveBeenCalled();
  });
});
