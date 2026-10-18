import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaReadingClient, ReadingChunkQueue, boundedReadingHistory, matchObservedWords, referenceWords, type TimedReadingWord } from "./meta-reading-client";

const ACCESS = { accessCode: "test-adult-demo-code-not-real", audience: "adult-demo", consent: true, adultConfirmed: true } as const;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const words = (...tokens: string[]): TimedReadingWord[] => tokens.map((word, index) => ({ word, start: index * 0.2, end: index * 0.2 + 0.15, confidence: null }));
const transcript = { text: "Mayuqa chakisqam", model: "omniASR_CTC_300M_v2", language: "quy_Latn", durationSeconds: 1, words: words("Mayuqa", "chakisqam"), wordTimestamps: true, timingMethod: "ctc-greedy-frames", requiresHumanReview: true };
const prepared = { passage: "Mayuqa chakisqam", opening: "Imataq pasarqa?", dialogueMode: "guided-reading", requiresHumanReview: true };
const capabilities = { enabled: true, mode: "adult-demo", reason: null, asr: { model: "omniASR_CTC_300M_v2", ready: true, languages: ["quy_Latn", "ayr_Latn"], wordTimestamps: true, timingMethod: "ctc-greedy-frames" }, translation: { enabled: true, ready: true, languages: ["spa_Latn", "quy_Latn", "ayr_Latn"] }, speech: { enabled: true, languages: ["quy_Latn", "ayr_Latn"], models: { quy_Latn: "facebook/mms-tts-quy" }, ready: { quy_Latn: false } } };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("same-origin adult reading client", () => {
  it.each(["global", "injected"] as const)("calls %s browser fetch without a client receiver", async (source) => {
    const request = vi.fn<typeof fetch>(function (this: unknown) {
      expect(this).toBeUndefined();
      return Promise.resolve(json(prepared));
    });
    if (source === "global") vi.stubGlobal("fetch", request);
    const client = source === "global" ? new MetaReadingClient(ACCESS) : new MetaReadingClient(ACCESS, request);
    await expect(client.prepare("El río estaba seco.", "quy_Latn")).resolves.toEqual(prepared);
    expect(request).toHaveBeenCalledOnce();
  });
  it("checks genuine capabilities without credentials or loading a microphone", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(capabilities));
    const status = await MetaReadingClient.capabilities(new AbortController().signal, request);
    expect(status.asr.timingMethod).toBe("ctc-greedy-frames");
    expect(status.speech.ready?.quy_Latn).toBe(false);
    expect(request).toHaveBeenCalledWith("/api/reading", expect.objectContaining({ cache: "no-store" }));
    expect(request.mock.calls[0][1]).not.toHaveProperty("headers");
  });
  it("rejects malformed readiness instead of inventing support", async () => {
    await expect(MetaReadingClient.capabilities(new AbortController().signal, vi.fn<typeof fetch>().mockResolvedValue(json({ ...capabilities, asr: {} })))).rejects.toThrow("invalid-response");
  });
  it("prepares the canonical passage with explicit adult consent and header-only access code", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(prepared));
    expect(await new MetaReadingClient(ACCESS, request).prepare("El río estaba seco.", "quy_Latn")).toEqual(prepared);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("/api/reading");
    expect(init?.headers).toEqual({ "X-Voice-Access-Code": ACCESS.accessCode, "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({ action: "prepare", passage: "El río estaba seco.", language: "quy_Latn", audience: "adult-demo", consent: true, adultConfirmed: true });
    expect(init?.body).not.toContain(ACCESS.accessCode);
  });
  it("sends bounded WAV with no profile and accepts real frame-derived words", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(transcript));
    const result = await new MetaReadingClient(ACCESS, request).transcribe(new Blob([new Uint8Array(100)]), "quy_Latn");
    expect(result.words).toEqual(transcript.words);
    const form = request.mock.calls[0][1]?.body as FormData;
    expect([...form.keys()].sort()).toEqual(["action", "adultConfirmed", "audience", "consent", "file", "language"]);
    expect(form.get("language")).toBe("quy_Latn");
    expect(request.mock.calls[0][1]?.headers).not.toHaveProperty("Content-Type");
  });
  it.each([
    { wordTimestamps: false }, { timingMethod: "fabricated" }, { language: "ayr_Latn" }, { durationSeconds: 31 },
    { words: [] }, { words: [{ word: "Mayu", start: -1, end: 0.2 }] }, { words: [{ word: "Mayu", start: 0, end: 2 }] },
    { words: [{ word: "Mayu", start: 0.5, end: 0.6 }, { word: "chakisqa", start: 0.2, end: 0.4 }] },
  ])("rejects false/invalid timing metadata %j", async (invalid) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ ...transcript, ...invalid }));
    await expect(new MetaReadingClient(ACCESS, request).transcribe(new Blob([new Uint8Array(100)]), "quy_Latn")).rejects.toThrow();
  });
  it("keeps original native speech and canonical Spanish distinct when requesting a guided reply", async () => {
    const reply = { heardSpanish: "El río estaba seco.", replyText: "Imaraykutaq?", replySpanish: "¿Por qué?", dialogueMode: "guided-reading", requiresHumanReview: true };
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(reply));
    expect(await new MetaReadingClient(ACCESS, request).turn("El río estaba seco.", "Mayuqa chakisqam", "quy_Latn", 0)).toEqual(reply);
    const body = JSON.parse(request.mock.calls[0][1]?.body as string);
    expect(body.passage).toBe("El río estaba seco."); expect(body.heard).toBe("Mayuqa chakisqam");
    expect(body).not.toHaveProperty("profile");
  });
  it("does not permit a tenth reply or silently truncate long speech", async () => {
    const request = vi.fn<typeof fetch>(); const client = new MetaReadingClient(ACCESS, request);
    await expect(client.turn("Texto", "Rimay", "quy_Latn", 9)).rejects.toThrow("invalid-turn");
    await expect(client.speak("x".repeat(301), "quy_Latn")).rejects.toThrow("speech-text-too-long");
    expect(request).not.toHaveBeenCalled();
  });
  it("reports the real local model mode and sends only bounded actual Spanish history", async () => {
    const reply = { heardSpanish: "El río estaba seco.", replyText: "Imaraykutaq?", replySpanish: "¿Qué pista encontraste?", dialogueMode: "local-llm-reading", model: "local-qwen-model", requiresHumanReview: true };
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(reply));
    const history = [{ role: "user", text: "Dije que fue al río." }, { role: "assistant", text: "¿Qué pasó allí?" }] as const;
    const result = await new MetaReadingClient(ACCESS, request).turn("El río estaba seco.", "Mayuqa chakisqam", "quy_Latn", 1, history);
    expect(result.dialogueMode).toBe("local-llm-reading"); expect(result.model).toBe("local-qwen-model");
    expect(JSON.parse(request.mock.calls[0][1]?.body as string).history).toEqual(history);
  });
  it("limits history by role, entry count, per-entry length and total size without generating summaries", () => {
    const history = boundedReadingHistory(Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: String(index).repeat(700) })));
    expect(history.length).toBeLessThanOrEqual(6); expect(history.every((entry) => entry.text.length <= 600)).toBe(true);
    expect(history.reduce((sum, entry) => sum + entry.text.length, 0)).toBeLessThanOrEqual(2500);
    expect(history.at(-1)?.text).toBe("9".repeat(600));
  });
  it("accepts only bounded WAV speech, never a JSON body pretending to be speech", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ text: "not-audio" }));
    await expect(new MetaReadingClient(ACCESS, request).speak("Imarayku?", "quy_Latn")).rejects.toThrow("invalid-audio-response");
  });
  it("closes active requests and refuses future network activity", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("abort")))));
    const client = new MetaReadingClient(ACCESS, request);
    const pending = client.prepare("Texto", "quy_Latn");
    client.close();
    await expect(pending).rejects.toThrow("cancelled-or-timeout");
    await expect(client.prepare("Texto", "quy_Latn")).rejects.toThrow("cancelled");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("bounds streaming response bytes even without Content-Length", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(256_001)));
    await expect(new MetaReadingClient(ACCESS, request).prepare("Texto", "quy_Latn")).rejects.toThrow("response-too-large");
  });
});

describe("observed word matching", () => {
  it("marks only observed exact matches, never the skipped prefix", () => {
    const matched = matchObservedWords("Rosaqa tutapayta mayuman rirqa", words("mayuman", "rirqa"));
    expect([...matched.observed]).toEqual([2, 3]); expect(matched.cursor).toBe(4);
  });
  it("does not advance on silence, unrelated audio, distant words or near matches", () => {
    const text = "uno dos tres cuatro cinco seis siete ocho nueve diez once";
    for (const value of [[], words("hola", "mañana"), words("once"), words("cuatr")]) expect(matchObservedWords(text, value).observed.size).toBe(0);
  });
  it("keeps monotonic matches through repetitions and does not mark an earlier repetition twice", () => {
    const first = matchObservedWords("mayu mayu chakisqa", words("mayu"));
    const second = matchObservedWords("mayu mayu chakisqa", words("mayu", "chakisqa"), first.observed, first.cursor);
    expect([...second.observed]).toEqual([0, 1, 2]);
  });
  it("normalizes punctuation/case but keeps the actual observed word set", () => {
    expect(referenceWords("Mayuqa, ¿chakisqam? !")).toEqual(["Mayuqa,", "¿chakisqam?"]);
    expect([...matchObservedWords("Mayuqa, ¿chakisqam?", words("mayuqa", "chakisqam")).observed]).toEqual([0, 1]);
  });
});

describe("bounded reading queue", () => {
  it("permits one active and one pending chunk, reports overflow without hidden queuing", async () => {
    const completions: (() => void)[] = [];
    const process = vi.fn((value: number) => new Promise<void>((resolve) => { completions.push(resolve); void value; }));
    const errors = vi.fn(); const queue = new ReadingChunkQueue(process, errors);
    expect(queue.enqueue(1)).toBe(true); expect(queue.enqueue(2)).toBe(true); expect(queue.enqueue(3)).toBe(false);
    const idle = queue.idle(); completions.shift()!(); await Promise.resolve();
    expect(process.mock.calls.map(([value]) => value)).toEqual([1, 2]);
    completions.shift()!(); await idle; expect(errors).not.toHaveBeenCalled();
  });
  it("does not process pending chunks after cancellation", async () => {
    let finish!: () => void;
    const process = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const queue = new ReadingChunkQueue(process, vi.fn()); queue.enqueue(1); queue.enqueue(2); queue.cancel(); finish();
    await queue.idle(); expect(process).toHaveBeenCalledTimes(1); expect(queue.enqueue(3)).toBe(false);
  });
  it("surfaces processing failure once and discards no fragment silently", async () => {
    const error = new Error("model-unavailable"); const errors = vi.fn();
    const queue = new ReadingChunkQueue(async () => { throw error; }, errors); queue.enqueue(1); queue.enqueue(2);
    await queue.idle(); expect(errors).toHaveBeenCalledExactlyOnceWith(error); expect(queue.enqueue(3)).toBe(false);
  });
});
