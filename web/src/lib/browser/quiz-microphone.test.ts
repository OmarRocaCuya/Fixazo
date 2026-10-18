import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizMicrophone, type QuizMicrophoneState } from "./quiz-microphone";
import { MetaReadingClient, READING_LANGUAGES, ReadingClientError } from "./meta-reading-client";
import type { ReadingPcmCaptureOptions } from "./reading-pcm-capture";

const ACCESS = { accessCode: "private-test-code-only", audience: "adult-demo" } as const;
function setup(startCapture: () => Promise<boolean> = () => Promise.resolve(true)) {
  let visible = true;
  const segments: { options: ReadingPcmCaptureOptions; start: ReturnType<typeof vi.fn>; abort: ReturnType<typeof vi.fn> }[] = [];
  const client = { transcribe: vi.fn().mockResolvedValue({ text: "opción dos" }), cancel: vi.fn(), close: vi.fn() };
  const onTranscript = vi.fn(), onState = vi.fn<(state: QuizMicrophoneState) => void>();
  const createClient = vi.fn(() => client);
  const controller = new QuizMicrophone({ onTranscript, onState }, {
    client: createClient, visible: () => visible, now: () => Date.now(),
    capture: (options) => {
      const item = { options, start: vi.fn(startCapture), abort: vi.fn() }; segments.push(item); return item;
    },
  });
  const chunk = (index = segments.length - 1) => segments[index].options.onChunk(new Blob([new Uint8Array(100)]), { startSeconds: 0, durationSeconds: 8 });
  return { controller, client, segments, onTranscript, onState, createClient, chunk, hide: () => { visible = false; } };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z")); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("foreground quiz microphone", () => {
  it("uses the authenticated real reading endpoint's Spanish ASR contract without adding Spanish native TTS", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ text: "opción dos", language: "spa_Latn", model: "omniASR_CTC_300M_v2", durationSeconds: 1,
      words: [{ word: "opción", start: 0, end: 0.3 }, { word: "dos", start: 0.4, end: 0.7 }], wordTimestamps: true, timingMethod: "ctc-greedy-frames", requiresHumanReview: true }), { headers: { "Content-Type": "application/json" } }));
    const client = new MetaReadingClient(ACCESS, request as typeof fetch);
    expect((await client.transcribe(new Blob([new Uint8Array(100)]), "spa_Latn")).language).toBe("spa_Latn");
    const call = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("/api/reading"); expect(call[1].headers).toMatchObject({ "X-Voice-Access-Code": ACCESS.accessCode });
    const form = call[1].body as FormData;
    expect(form.get("action")).toBe("transcribe"); expect(form.get("language")).toBe("spa_Latn");
    expect(form.get("adultConfirmed")).toBeNull(); expect(form.get("consent")).toBeNull();
    expect(READING_LANGUAGES.map(({ value }) => value)).toEqual(["quy_Latn", "ayr_Latn"]); client.close();
  });
  it("is inert before explicit start and sends real PCM transport only with an access code", async () => {
    const s = setup(); expect(s.segments).toHaveLength(0); expect(s.createClient).not.toHaveBeenCalled();
    expect(await s.controller.start({ ...ACCESS, accessCode: " " }, "one")).toBe(false);
    expect(await s.controller.start(ACCESS, "one")).toBe(true);
    expect(s.segments).toHaveLength(1); expect(s.segments[0].options).toMatchObject({ chunkSeconds: 8, maxSeconds: 60 });
    expect(await s.controller.start(ACCESS, "one")).toBe(false);
    s.chunk(); await tick();
    expect(s.client.transcribe).toHaveBeenCalledWith(expect.any(Blob), "spa_Latn");
    expect(s.onTranscript).toHaveBeenCalledWith({ stepId: "one", text: "opción dos" });
    s.controller.dispose();
  });
  it("discards the boundary chunk and stale ASR when a question changes without opening another microphone", async () => {
    const s = setup(); let resolve!: (value: { text: string }) => void;
    s.client.transcribe.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    await s.controller.start(ACCESS, "one"); s.chunk();
    s.controller.setStep("two"); expect(s.client.cancel).toHaveBeenCalledOnce();
    resolve({ text: "respuesta de la primera" }); await tick(); expect(s.onTranscript).not.toHaveBeenCalled();
    s.chunk(); await tick(); expect(s.client.transcribe).toHaveBeenCalledTimes(1);
    s.chunk(); await tick(); expect(s.onTranscript).toHaveBeenCalledWith({ stepId: "two", text: "opción dos" });
    expect(s.segments).toHaveLength(1); s.controller.dispose();
  });
  it("does not let rejection from an old cancelled question stop the next one", async () => {
    const s = setup(); let reject!: (error: Error) => void;
    s.client.transcribe.mockImplementationOnce(() => new Promise((_r, j) => { reject = j; }));
    await s.controller.start(ACCESS, "one"); s.chunk(); s.controller.setStep("two"); reject(new Error("aborted")); await tick();
    expect(s.client.close).not.toHaveBeenCalled(); s.chunk(); s.chunk(); await tick();
    expect(s.onTranscript).toHaveBeenCalledWith({ stepId: "two", text: "opción dos" }); s.controller.dispose();
  });
  it("keeps one capture through fragments, without transcribing non-question or boundary audio", async () => {
    const s = setup(); await s.controller.start(ACCESS, "one");
    s.controller.setStep(null); s.chunk(); s.chunk(); await tick();
    expect(s.client.transcribe).not.toHaveBeenCalled(); expect(s.segments[0].abort).not.toHaveBeenCalled();
    s.controller.setStep("two"); s.chunk(); await tick(); expect(s.client.transcribe).not.toHaveBeenCalled();
    s.chunk(); await tick(); expect(s.onTranscript).toHaveBeenCalledWith({ stepId: "two", text: "opción dos" });
    expect(s.segments).toHaveLength(1); s.controller.dispose();
    const reading = setup(); expect(await reading.controller.start(ACCESS, null)).toBe(true);
    reading.chunk(); await tick(); expect(reading.client.transcribe).not.toHaveBeenCalled(); reading.controller.dispose();
  });
  it("never overlaps requests and stops rather than accumulating more than one waiting chunk", async () => {
    const s = setup(); let resolve!: (value: { text: string }) => void;
    s.client.transcribe.mockImplementation(() => new Promise((r) => { resolve = r; }));
    await s.controller.start(ACCESS, "one"); s.chunk(); s.chunk();
    expect(s.client.transcribe).toHaveBeenCalledOnce(); s.chunk();
    expect(s.client.close).toHaveBeenCalledOnce(); expect(s.segments[0].abort).toHaveBeenCalledOnce();
    expect(s.onState.mock.lastCall?.[0]).toMatchObject({ status: "error" });
    resolve({ text: "late" }); await tick(); expect(s.onTranscript).not.toHaveBeenCalled(); s.controller.dispose();
  });
  it("drops silence without inventing answers or stopping the active session", async () => {
    const s = setup(); s.client.transcribe.mockRejectedValueOnce(new ReadingClientError("audio-not-observable"));
    await s.controller.start(ACCESS, "one"); s.chunk(); await tick();
    expect(s.onTranscript).not.toHaveBeenCalled(); expect(s.client.close).not.toHaveBeenCalled();
    s.chunk(); await tick(); expect(s.onTranscript).toHaveBeenCalledOnce(); s.controller.dispose();
  });
  it("renewal follows only a successful active foreground segment and caps the whole session at ten minutes", async () => {
    const s = setup(); await s.controller.start(ACCESS, "one");
    s.segments[0].options.onLimit(); await tick(); expect(s.segments).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(s.client.close).toHaveBeenCalledOnce(); const count = s.segments.length;
    s.segments.at(-1)!.options.onLimit(); await tick(); expect(s.segments).toHaveLength(count);
    expect(s.onState.mock.lastCall?.[0]).toMatchObject({ status: "stopped", remainingSeconds: 0 }); s.controller.dispose();
  });
  it("pauses on hidden state and never resumes on its own", async () => {
    const s = setup(); await s.controller.start(ACCESS, "one"); s.hide();
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.segments[0].abort).toHaveBeenCalledOnce(); expect(s.client.close).toHaveBeenCalledOnce();
    s.segments[0].options.onLimit(); s.chunk(); await tick();
    expect(s.segments).toHaveLength(1); expect(s.onTranscript).not.toHaveBeenCalled();
    expect(await s.controller.start(ACCESS, "one")).toBe(false); s.controller.dispose();
  });
  it("invalidates late results when stopped or disposed", async () => {
    const s = setup(); await s.controller.start(ACCESS, "one"); s.controller.pause();
    const old = s.segments[0]; old.options.onError("denied"); old.options.onLimit(); s.chunk(0); await tick();
    expect(s.onState.mock.lastCall?.[0].status).toBe("stopped"); expect(s.segments).toHaveLength(1);
    await s.controller.start(ACCESS, "two"); s.controller.dispose(); s.chunk(); await tick();
    expect(s.onTranscript).not.toHaveBeenCalled(); expect(await s.controller.start(ACCESS, "three")).toBe(false);
  });
  it("aborts a late microphone grant after pausing while permission is pending", async () => {
    let grant!: (started: boolean) => void;
    const s = setup(() => new Promise((resolve) => { grant = resolve; }));
    const opening = s.controller.start(ACCESS, "one");
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.onState.mock.lastCall?.[0].status).toBe("starting");
    s.controller.pause(); grant(true);
    expect(await opening).toBe(false); expect(s.segments[0].abort).toHaveBeenCalled();
    s.chunk(); await tick(); expect(s.client.transcribe).not.toHaveBeenCalled();
    expect(s.onState.mock.lastCall?.[0].status).toBe("stopped"); s.controller.dispose();
  });
  it("fails safely if permission is denied or start throws, without retry loops", async () => {
    const denied = setup(() => Promise.resolve(false));
    expect(await denied.controller.start(ACCESS, "one")).toBe(false);
    expect(denied.segments[0].abort).toHaveBeenCalled(); expect(denied.client.close).toHaveBeenCalledOnce();
    expect(denied.onState.mock.lastCall?.[0].status).toBe("error"); denied.controller.dispose();
    const throwing = setup(() => Promise.reject(new Error("unsupported")));
    expect(await throwing.controller.start(ACCESS, "one")).toBe(false);
    expect(throwing.segments).toHaveLength(1); expect(throwing.onState.mock.lastCall?.[0].status).toBe("error"); throwing.controller.dispose();
  });
  it("stops and permits only explicit retry after unsupported capture or provider failure", async () => {
    const s = setup(); await s.controller.start(ACCESS, "one"); s.segments[0].options.onError("unsupported");
    expect(s.onState.mock.lastCall?.[0].status).toBe("error"); expect(s.segments).toHaveLength(1);
    await s.controller.start(ACCESS, "one"); s.client.transcribe.mockRejectedValueOnce(new Error("network")); s.chunk(); await tick();
    expect(s.onState.mock.lastCall?.[0].status).toBe("error"); expect(s.segments).toHaveLength(2); s.controller.dispose();
  });
  it("explains a server quota stop distinctly and keeps typing available without automatic retry", async () => {
    const s = setup(); await s.controller.start(ACCESS, "one");
    s.client.transcribe.mockRejectedValueOnce(new ReadingClientError("voice-rate-limit")); s.chunk(); await tick();
    expect(s.onState.mock.lastCall?.[0]).toMatchObject({ status: "error", message: expect.stringContaining("límite temporal del servidor") });
    expect(s.onState.mock.lastCall?.[0].message).toContain("continúa escribiendo");
    await vi.advanceTimersByTimeAsync(30_000); expect(s.segments).toHaveLength(1); expect(s.client.close).toHaveBeenCalledOnce(); s.controller.dispose();
  });
});
