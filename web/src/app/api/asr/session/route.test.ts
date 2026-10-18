import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { GET } from "../route";
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

let serial = 0;
const mockedFetch = vi.fn();
function request(body: unknown = { audience: "adult-demo", consent: true, adultConfirmed: true }, options: { headers?: Record<string, string>; signal?: AbortSignal } = {}) {
  return new Request("https://education.example/api/asr/session", { method: "POST", signal: options.signal, headers: { Origin: "https://education.example", "X-Voice-Access-Code": process.env.VOICE_ACCESS_CODE ?? "", ...options.headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
beforeEach(() => {
  vi.stubEnv("VOICE_CLOUD_MODE", "adult-demo");
  vi.stubEnv("VOICE_ACCESS_CODE", `route-access-code-${++serial}`);
  vi.stubEnv("DEEPGRAM_API_KEY", "private-deepgram-key");
  vi.stubGlobal("fetch", mockedFetch);
  mockedFetch.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("ASR grant route", () => {
  it("reports capabilities without returning any credential", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await response.json();
    expect(data.providers.deepgram).toEqual({ enabled: true, mode: "adult-demo", reason: null });
    expect(JSON.stringify(data)).not.toContain("private-deepgram-key");
    expect(data.limitations).toContain("no-quechua");
  });
  it("mints a 30 second grant server-side with no-store and no audio", async () => {
    mockedFetch.mockResolvedValue(Response.json({ access_token: "ephemeral-only", expires_in: 30 }));
    const now = Date.now();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedFetch).toHaveBeenCalledOnce();
    expect(mockedFetch.mock.calls[0][0]).toBe("https://api.deepgram.com/v1/auth/grant");
    expect(JSON.parse(mockedFetch.mock.calls[0][1].body)).toEqual({ ttl_seconds: 30 });
    const grant = await response.json();
    expect(grant).toMatchObject({ token: "ephemeral-only", maxDurationSeconds: 180, model: "nova-3", language: "es-419" });
    expect(grant.expiresAt).toBeGreaterThanOrEqual(now + 30_000);
    expect(JSON.stringify(grant)).not.toContain("private-deepgram-key");
  });
  it.each(["{broken", "a".repeat(2049)])("rejects malformed or oversized JSON before contacting the provider", async (body) => {
    const response = await POST(request(body));
    expect([400, 413]).toContain(response.status);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
  it("does not mint tokens for unauthorized or disabled clients", async () => {
    expect((await POST(request(undefined, { headers: { Origin: "https://evil.example" } }))).status).toBe(403);
    vi.stubEnv("VOICE_CLOUD_MODE", "disabled");
    expect((await POST(request())).status).toBe(503);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
  it.each([{ access_token: "token" }, { access_token: "token", expires_in: 100 }, { access_token: 123, expires_in: 30 }])("fails closed on invalid grant %j", async (grant) => {
    mockedFetch.mockResolvedValue(Response.json(grant));
    expect((await POST(request())).status).toBe(502);
  });
  it("redacts provider failures and removes timers/listeners", async () => {
    vi.useFakeTimers();
    mockedFetch.mockRejectedValue(new Error("private-deepgram-key provider details"));
    const response = await POST(request());
    expect(await response.json()).toEqual({ error: "asr-unavailable" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([401, 403])("distinguishes upstream credential/permission rejection %s without reading its payload", async (status) => {
    const upstream = Response.json({ error: "private-deepgram-key details", token: "permanent-key-must-not-be-forwarded" }, { status });
    const readBody = vi.spyOn(upstream, "json");
    mockedFetch.mockResolvedValue(upstream);
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "asr-credentials-rejected" });
    expect(readBody).not.toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("distinguishes provider rate limiting without exposing its body or retrying", async () => {
    mockedFetch.mockResolvedValue(Response.json({ error: "private-deepgram-key details" }, { status: 429 }));
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "asr-provider-rate-limit" });
    expect(mockedFetch).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([500, 503])("keeps upstream %s failures generic and redacted", async (status) => {
    mockedFetch.mockResolvedValue(Response.json({ error: "private-deepgram-key details" }, { status }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "asr-unavailable" });
  });
  it("cancels the upstream request when the client disconnects", async () => {
    const controller = new AbortController();
    mockedFetch.mockImplementation((_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal!.addEventListener("abort", () => reject(new Error("abort")))));
    const pending = POST(request(undefined, { signal: controller.signal }));
    await vi.waitFor(() => expect(mockedFetch).toHaveBeenCalledOnce());
    controller.abort();
    expect((await pending).status).toBe(502);
  });
});
