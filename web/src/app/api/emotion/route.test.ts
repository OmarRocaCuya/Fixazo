import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { estimateEmotionWithBackend } from "@/lib/server/emotion-proxy";
import { encodeWav16 } from "@/lib/audio/wav";

const fetcher = vi.fn();
const TOKEN = "never-expose-this-backend-secret-123456";
let serial = 0;
const MODEL = "emotion2vec/emotion2vec_plus_base";
const LABELS = ["happy", "neutral", "sad", "angry", "surprised", "fearful", "disgusted", "other", "unknown"];
const UPSTREAM = {
  labels: LABELS.map((label, i) => ({ label, score: i === 0 ? 0.72 : 0.035 })),
  top: { label: "happy", score: 0.72 },
  model: MODEL,
  revision: "b318240bfe67db81a8c572ecb37ce9c3759b81c9",
  license: "FunASR Model License v1.1",
  attribution: "emotion2vec+ base",
  durationSeconds: 2,
  experimental: true,
  requiresHumanReview: true,
};

function tone(seconds: number) {
  const s = new Float32Array(Math.round(seconds * 16000));
  for (let i = 0; i < s.length; i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000);
  return encodeWav16(s);
}

function request(fields: Record<string, string> = {}, { wav = tone(2), headers = {} as Record<string, string> } = {}) {
  const form = new FormData();
  form.set("file", new Blob([wav as BlobPart], { type: "audio/wav" }), "turn.wav");
  for (const [k, v] of Object.entries(fields)) if (v !== "") form.set(k, v);
  return new Request("https://education.example/api/emotion", {
    method: "POST",
    headers: { Origin: "https://education.example", "X-Voice-Access-Code": process.env.VOICE_ACCESS_CODE ?? "", ...headers },
    body: form,
  });
}

beforeEach(() => {
  vi.stubEnv("VOICE_CLOUD_MODE", "adult-demo");
  vi.stubEnv("VOICE_ACCESS_CODE", `emotion-access-${++serial}-long-enough`);
  vi.stubEnv("INDIGENOUS_BACKEND_URL", "https://indigenous.example");
  vi.stubEnv("INDIGENOUS_BACKEND_TOKEN", TOKEN);
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/api/emotion (experimental proxy, no consent gate)", () => {
  it("forwards the WAV in memory to the backend and returns validated probabilities", async () => {
    fetcher.mockResolvedValue(Response.json(UPSTREAM));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ top: { label: "happy", score: 0.72 }, model: MODEL, experimental: true });
    expect(body.labels).toHaveLength(9);
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    const [url, init] = fetcher.mock.calls[0];
    expect(url.toString()).toBe("https://indigenous.example/v1/emotion");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(new Headers(init.headers).get("content-type")).toBe("audio/wav");
    expect(new Uint8Array(init.body as ArrayBuffer).byteLength).toBe(tone(2).byteLength);
  });

  it("rejects unexpected fields, including retired consent fields (no upstream contact)", async () => {
    for (const field of ["experimentalEmotion", "consent", "adultConfirmed", "text"]) {
      const response = await POST(request({ [field]: "true" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid-request", fallback: true });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the operator voice policy: access code and same origin", async () => {
    expect((await POST(request({}, { headers: { "X-Voice-Access-Code": "wrong" } }))).status).toBe(401);
    expect((await POST(request({}, { headers: { Origin: "https://evil.example" } }))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns 503 fallback when the backend is not configured or the cloud voice mode is off", async () => {
    vi.stubEnv("INDIGENOUS_BACKEND_URL", "");
    let response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ fallback: true });
    vi.stubEnv("INDIGENOUS_BACKEND_URL", "https://indigenous.example");
    vi.stubEnv("VOICE_CLOUD_MODE", "disabled");
    response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ fallback: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("validates the WAV and its duration (1–15 s) before contacting the backend", async () => {
    expect((await POST(request({}, { wav: new Uint8Array([1, 2, 3]) }))).status).toBe(422);
    expect((await POST(request({}, { wav: tone(0.5) }))).status).toBe(422);
    expect((await POST(request({}, { wav: tone(16) }))).status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects silent PCM before inference and preserves upstream silence as422", async () => {
    const silent = encodeWav16(new Float32Array(32000));
    let response = await POST(request({}, { wav: silent }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "audio-not-observable", fallback: true });
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(Response.json({ error: "no-audio-signal" }, { status: 422 }));
    response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "audio-not-observable" });
  });

  it("falls back (503) when the backend fails, is disabled, or returns an invalid shape", async () => {
    for (const upstream of [
      () => Promise.reject(new Error("down")),
      () => Promise.resolve(Response.json({ error: "not-found" }, { status: 404 })),
      () => Promise.resolve(Response.json({ ...UPSTREAM, model: "other/model" })),
      () => Promise.resolve(Response.json({ ...UPSTREAM, labels: UPSTREAM.labels.slice(0, 3) })),
      () => Promise.resolve(Response.json({ ...UPSTREAM, experimental: false })),
      () => Promise.resolve(Response.json(null)),
      () => Promise.resolve(Response.json({ ...UPSTREAM, revision: "f".repeat(40) })),
      () => Promise.resolve(Response.json({ ...UPSTREAM, top: { label: "sad", score: 0.035 } })),
      () => Promise.resolve(Response.json({ ...UPSTREAM, labels: UPSTREAM.labels.map((item) => ({ ...item, score: 0.5 })) })),
      () => Promise.resolve(Response.json({ ...UPSTREAM, labels: UPSTREAM.labels.map(() => UPSTREAM.labels[0]) })),
    ]) {
      fetcher.mockReset();
      fetcher.mockImplementation(upstream);
      const response = await POST(request());
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.fallback).toBe(true);
      expect(JSON.stringify(body)).not.toContain(TOKEN);
    }
  });

  it("requires multipart", async () => {
    const response = await POST(new Request("https://education.example/api/emotion", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
    expect(response.status).toBe(415);
  });

  it("rejects transcript fields and malformed declared lengths before upstream", async () => {
    expect((await POST(request({ text: "not an emotion input" }))).status).toBe(400);
    expect((await POST(request({}, { headers: { "Content-Length": "invalid" } }))).status).toBe(400);
    expect((await POST(request({}, { headers: { "Content-Length": "-1" } }))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves sanitized loading state instead of claiming an estimate", async () => {
    fetcher.mockResolvedValue(Response.json({ error: "emotion-model-loading" }, { status: 503 }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "emotion-model-loading", fallback: true });
  });

  it("does not send audio after an already aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(estimateEmotionWithBackend(tone(2), controller.signal)).rejects.toMatchObject({ code: "emotion-request-aborted" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports its own emotion readiness, not ASR readiness or configuration alone", async () => {
    const req = () => new Request("https://education.example/api/emotion");
    fetcher.mockResolvedValue(Response.json({ emotion: { model: MODEL, revision: UPSTREAM.revision, experimental: true,
      enabled: true, ready: false, loading: true, inferenceVerified: false }, asr: { ready: true } }));
    let response = await GET(req());
    expect(await response.json()).toMatchObject({ enabled: true, mode: "adult-demo", ready: false, loading: true, reason: "emotion-model-loading" });
    fetcher.mockResolvedValue(Response.json({ emotion: { model: MODEL, revision: UPSTREAM.revision, experimental: true,
      enabled: true, ready: true, loading: false, inferenceVerified: true } }));
    response = await GET(req());
    expect(await response.json()).toMatchObject({ enabled: true, ready: true, inferenceVerified: true, reason: null });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(await (await GET(req())).json())).not.toContain(TOKEN);
    const [url] = fetcher.mock.calls[0];
    expect(url.toString()).toBe("https://indigenous.example/health");
  });

  it("does not contact the backend when policy is disabled and never reports failed health as ready", async () => {
    vi.stubEnv("VOICE_CLOUD_MODE", "disabled");
    expect(await (await GET(new Request("https://education.example/api/emotion"))).json()).toMatchObject({ enabled: false, ready: false });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("VOICE_CLOUD_MODE", "adult-demo");
    fetcher.mockRejectedValue(new Error(TOKEN));
    expect(await (await GET(new Request("https://education.example/api/emotion"))).json()).toMatchObject({ ready: false, reason: "emotion-backend-unavailable" });
  });
});
