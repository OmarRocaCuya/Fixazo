import { describe, expect, it, vi } from "vitest";
import { estimarEmocionRespuesta } from "./quiz-emotion";

const MODEL = "emotion2vec/emotion2vec_plus_base";
const REVISION = "b318240bfe67db81a8c572ecb37ce9c3759b81c9";
const LABELS = ["angry", "disgusted", "fearful", "happy", "neutral", "other", "sad", "surprised", "unknown"];
function wav(seconds: number) { return new Blob([new Uint8Array(44 + Math.round(seconds * 32_000))], { type: "audio/wav" }); }
function modelResponse() {
  const labels = LABELS.map((label) => ({ label, score: label === "happy" ? 0.6 : 0.05 }));
  return Response.json({ experimental: true, model: MODEL, revision: REVISION, labels, top: { label: "happy", score: 0.6 } });
}

describe("experimental emotion estimate for a quiz voice answer", () => {
  it("posts the answer WAV to /api/emotion without an access code and maps the model label", async () => {
    const fetcher = vi.fn(async () => modelResponse());
    const estimate = await estimarEmocionRespuesta(wav(8), fetcher as unknown as typeof fetch);
    expect(estimate).toMatchObject({ label: "contento/a", source: "voz-emotion2vec", confidence: "media", experimental: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/emotion"); expect(new Headers(init.headers).get("x-voice-access-code")).toBeNull();
  });
  it("reports 'sin modelo' instead of inventing an emotion when the backend fails", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: "emotion-disabled", fallback: true }, { status: 503 }));
    expect(await estimarEmocionRespuesta(wav(8), fetcher as unknown as typeof fetch)).toMatchObject({ label: "sin datos suficientes", source: "sin-modelo", score: null });
  });
  it("never sends audio longer than 15 s or shorter than 1 s", async () => {
    const fetcher = vi.fn();
    expect((await estimarEmocionRespuesta(wav(16), fetcher as unknown as typeof fetch)).source).toBe("sin-modelo");
    expect((await estimarEmocionRespuesta(wav(0.5), fetcher as unknown as typeof fetch)).source).toBe("sin-modelo");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
