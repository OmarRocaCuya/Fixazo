import { afterEach, describe, expect, it, vi } from "vitest";
import { EMOTION_TIMEOUT_MS, requestEmotionModel } from "./emotion-client";
import { encodeWav16 } from "@/lib/audio/wav";

const ACCESS = { accessCode: "test-demo-code-not-real", audience: "adult-demo" } as const;
const WAV = encodeWav16(new Float32Array(32_000));
const OK = {
  labels: ["happy", "neutral", "sad", "angry", "surprised", "fearful", "disgusted", "other", "unknown"].map((label, i) => ({ label, score: i === 0 ? 0.7 : 0.3 / 8 })),
  top: { label: "happy", score: 0.7 },
  model: "emotion2vec/emotion2vec_plus_base",
  revision: "b318240bfe67db81a8c572ecb37ce9c3759b81c9",
  experimental: true,
};

describe("emotion client (browser → /api/emotion)", () => {
  afterEach(() => vi.useRealTimers());
  it("posts only the WAV, without consent fields or an access code", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(OK));
    const result = await requestEmotionModel(WAV, ACCESS, fetcher);
    expect(result?.top).toEqual({ label: "happy", score: 0.7 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/emotion");
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect((form.get("file") as Blob).type).toBe("audio/wav");
    expect([...form.keys()]).toEqual(["file"]);
  });
  it("exposes unavailable/loading/invalid/network errors, never a fabricated fallback", async () => {
    await expect(requestEmotionModel(WAV, ACCESS, vi.fn().mockResolvedValue(Response.json({ fallback: true, error: "emotion-model-loading" }, { status: 503 })))).rejects.toMatchObject({ code: "emotion-model-loading" });
    for (const body of [
      { ...OK, top: { label: "happy", score: 7 } },
      { ...OK, experimental: false },
      { ...OK, labels: Array(9).fill({ label: "happy", score: 1 / 9 }) },
      { ...OK, top: { label: "sad", score: 0.0375 } },
      { ...OK, revision: "wrong-revision" },
      { ...OK, model: "text-emotion-model" },
      { ...OK, labels: OK.labels.map((entry) => ({ ...entry, score: 1 })) },
    ]) await expect(requestEmotionModel(WAV, ACCESS, vi.fn().mockResolvedValue(Response.json(body)))).rejects.toMatchObject({ code: "invalid-response" });
    await expect(requestEmotionModel(WAV, ACCESS, vi.fn().mockRejectedValue(new Error("offline")))).rejects.toMatchObject({ code: "network" });
  });

  it("does not send short audio, an unknown audience or a cancelled request", async () => {
    const fetcher = vi.fn();
    await expect(requestEmotionModel(WAV.subarray(0, 44), ACCESS, fetcher)).rejects.toMatchObject({ code: "invalid-audio" });
    await expect(requestEmotionModel(WAV, { ...ACCESS, audience: "disabled" as never }, fetcher)).rejects.toMatchObject({ code: "not-authorized" });
    const controller = new AbortController(); controller.abort();
    await expect(requestEmotionModel(WAV, ACCESS, fetcher, controller.signal)).rejects.toMatchObject({ code: "cancelled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds and aborts an in-flight inference without retrying", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const pending = requestEmotionModel(WAV, ACCESS, fetcher);
    const check = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(EMOTION_TIMEOUT_MS);
    await check;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a stalled response body and rejects oversized responses", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }));
    const pending = requestEmotionModel(WAV, ACCESS, vi.fn().mockResolvedValue(response), controller.signal);
    const check = expect(pending).rejects.toMatchObject({ code: "cancelled" });
    await Promise.resolve();
    controller.abort();
    await check;
    expect(cancel).toHaveBeenCalled();
    const oversized = vi.fn().mockResolvedValue(new Response(" ".repeat(20_000)));
    await expect(requestEmotionModel(WAV, ACCESS, oversized)).rejects.toMatchObject({ code: "invalid-response" });
  });
});
