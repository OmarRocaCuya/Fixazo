import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalWhisperRequest, LocalWhisperResponse } from "./local-whisper";

const mocks = vi.hoisted(() => ({
  pipeline: vi.fn(),
  env: { allowLocalModels: true, useBrowserCache: false, backends: { onnx: { wasm: { numThreads: 0, proxy: true } } } },
}));
vi.mock("@huggingface/transformers", () => mocks);

let scope: { postMessage: ReturnType<typeof vi.fn<(message: LocalWhisperResponse) => void>>; onmessage: ((event: { data: LocalWhisperRequest }) => void) | null };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const send = async (message: LocalWhisperRequest) => { scope.onmessage?.({ data: message }); await flush(); };

beforeEach(async () => {
  vi.resetModules(); mocks.pipeline.mockReset();
  scope = { postMessage: vi.fn<(message: LocalWhisperResponse) => void>(), onmessage: null };
  vi.stubGlobal("self", scope);
  await import("./local-whisper.worker");
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Whisper inference worker contract", () => {
  it("does not initialize/download on worker import and loads WASM q8 only on explicit load", async () => {
    expect(mocks.pipeline).not.toHaveBeenCalled();
    expect(mocks.env).toMatchObject({ allowLocalModels: false, useBrowserCache: true, backends: { onnx: { wasm: { numThreads: 1, proxy: false } } } });
    mocks.pipeline.mockResolvedValue(vi.fn()); await send({ type: "load", id: 1 });
    expect(mocks.pipeline).toHaveBeenCalledExactlyOnceWith("automatic-speech-recognition", "onnx-community/whisper-base_timestamped", {
      device: "wasm", dtype: "q8", progress_callback: expect.any(Function),
    });
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "ready", id: 1 });
    await send({ type: "load", id: 2 }); expect(mocks.pipeline).toHaveBeenCalledOnce();
  });

  it("transcribes PCM locally with timestamps, without expected-passage prompts or fabricated confidence", async () => {
    const output = { text: "hola", chunks: [{ text: "hola", timestamp: [0, 0.2] }] };
    const recognize = vi.fn(async () => output); mocks.pipeline.mockResolvedValue(recognize);
    await send({ type: "load", id: 1 }); const audio = new Float32Array(3200).fill(0.1);
    await send({ type: "transcribe", id: 2, audio });
    expect(recognize).toHaveBeenCalledExactlyOnceWith(audio, {
      language: "es", task: "transcribe", return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5, do_sample: false,
    });
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "result", id: 2, output });
  });

  it("rejects inference before loading instead of downloading implicitly", async () => {
    await send({ type: "transcribe", id: 3, audio: new Float32Array(10) });
    expect(mocks.pipeline).not.toHaveBeenCalled();
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "error", id: 3, code: "local-asr-not-ready" });
  });

  it("rejects invalid, empty and oversized PCM before running the model", async () => {
    const recognize = vi.fn(); mocks.pipeline.mockResolvedValue(recognize); await send({ type: "load", id: 1 });
    for (const audio of [new Float32Array(0), new Float32Array([NaN]), new Float32Array(16_000 * 60 + 1)]) {
      await send({ type: "transcribe", id: 2, audio });
      expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "error", id: 2, code: "local-asr-invalid-result" });
    }
    expect(recognize).not.toHaveBeenCalled();
  });

  it("bounds concurrency to one inference and reports a typed busy error", async () => {
    let finish!: (output: unknown) => void;
    const recognize = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    mocks.pipeline.mockResolvedValue(recognize); await send({ type: "load", id: 1 });
    await send({ type: "transcribe", id: 2, audio: new Float32Array(1600) });
    await send({ type: "transcribe", id: 3, audio: new Float32Array(1600) });
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "error", id: 3, code: "local-asr-busy" });
    expect(recognize).toHaveBeenCalledOnce(); finish({ text: "fin" }); await flush();
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "result", id: 2, output: { text: "fin" } });
  });

  it("sanitizes download/inference failures and allows a fresh initialization retry", async () => {
    mocks.pipeline.mockRejectedValueOnce(new Error("private internal URL")); await send({ type: "load", id: 1 });
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "error", id: 1, code: "local-asr-download" });
    mocks.pipeline.mockResolvedValueOnce(vi.fn(async () => { throw new Error("internal tensor details"); })); await send({ type: "load", id: 2 });
    await send({ type: "transcribe", id: 3, audio: new Float32Array(1600) });
    expect(scope.postMessage).toHaveBeenLastCalledWith({ type: "error", id: 3, code: "local-asr-inference" });
    expect(mocks.pipeline).toHaveBeenCalledTimes(2);
  });
});
