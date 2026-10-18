import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

vi.mock("@/lib/server/voice-policy", () => ({ authorizeVoiceRequest: vi.fn(), getVoicePolicyStatus: vi.fn() }));
import { authorizeVoiceRequest, getVoicePolicyStatus } from "@/lib/server/voice-policy";
import { GET, POST } from "./route";

const fetchMock = vi.fn();
function request(body: unknown = { audience: "adult-demo" }) {
  return new Request("https://nawinchay.example/api/voice/session", { method: "POST", headers: { Origin: "https://nawinchay.example", "X-Voice-Access-Code": "a-private-pilot-code", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("voice session issuance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-server-secret-test");
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(getVoicePolicyStatus).mockReturnValue({ enabled: false, mode: "disabled", reason: "cloud-disabled" });
    vi.mocked(authorizeVoiceRequest).mockReturnValue({ ok: true, mode: "adult-demo" });
    fetchMock.mockResolvedValue(Response.json({ value: "ek_ephemeral-test", expires_at: Math.floor(Date.now() / 1000) + 30, private: "do-not-forward" }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("reports configuration without issuing any key or making a paid call", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ enabled: false, mode: "disabled", reason: "cloud-disabled", provider: "openai", model: "gpt-realtime-2.1", voice: "marin" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces authorization before any provider request", async () => {
    vi.mocked(authorizeVoiceRequest).mockReturnValue({ ok: false, status: 403, error: "invalid-access-code" });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized body even without a content-length header", async () => {
    const response = await POST(request({ payload: "á".repeat(1500) }));
    expect(response.status).toBe(400);
    expect(authorizeVoiceRequest).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints GA session configuration with manual turns and no transcription/traces", async () => {
    const input = request();
    const response = await POST(input);
    expect(response.status).toBe(200);
    expect(authorizeVoiceRequest).toHaveBeenCalledWith(input, "openai");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-server-secret-test", "Content-Type": "application/json" });
    const config = JSON.parse(String(init.body));
    expect(config).toMatchObject({ expires_after: { anchor: "created_at", seconds: 30 }, session: { type: "realtime", model: "gpt-realtime-2.1", max_output_tokens: 400, tools: [], tracing: null, output_modalities: ["audio"], audio: { input: { turn_detection: null, transcription: null }, output: { voice: "marin" } } } });
    expect(config.session.instructions).toContain("Nunca infieras ni etiquetes emociones");
    const result = await response.json();
    expect(Object.keys(result).sort()).toEqual(["expiresAt", "mode", "model", "value", "voice"]);
    expect(JSON.stringify(result)).not.toContain("sk-server-secret");
    expect(JSON.stringify(result)).not.toContain("do-not-forward");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it.each([401, 429, 503])("sanitizes provider failure %s without exposing provider response", async (status) => {
    fetchMock.mockResolvedValue(new Response("provider secret diagnostic sk-private", { status }));
    const response = await POST(request());
    expect(response.status).toBe(status === 429 ? 429 : 502);
    expect(await response.text()).not.toContain("sk-private");
  });

  it.each([{ value: "sk-permanent", expires_at: 9999999999 }, { value: "ek_stale", expires_at: 1 }, { value: "ek_no-expiry" }, null])("rejects invalid upstream token %j", async (token) => {
    fetchMock.mockResolvedValue(Response.json(token));
    expect((await POST(request())).status).toBe(502);
  });

  it("handles upstream network errors without logs or provider details", async () => {
    fetchMock.mockRejectedValue(new Error("sk-sensitive-network-error"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).toBe('{"error":"voice-session-unavailable"}');
  });

  it.each(["not-json", "x".repeat(2050)])("rejects malformed or large payloads", async (body) => {
    const response = await POST(new Request("https://nawinchay.example/api/voice/session", { method: "POST", body }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authorizeVoiceRequest).not.toHaveBeenCalled();
  });
});
