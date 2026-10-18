import { env, pipeline } from "@huggingface/transformers";
import type { LocalWhisperRequest, LocalWhisperResponse } from "./local-whisper";

// Browser-only ONNX Runtime Web. No HTTP inference or browser SpeechRecognition.
// q8 WASM deliberately keeps the advertised download near 80 MB on all devices.
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.proxy = false;

type Recognizer = (audio: Float32Array, options: Record<string, unknown>) => Promise<unknown>;
const scope = self as unknown as {
  postMessage: (message: LocalWhisperResponse) => void;
  onmessage: ((event: MessageEvent<LocalWhisperRequest>) => void) | null;
};
let recognizer: Recognizer | null = null;
let loading: Promise<void> | null = null;
let busy = false;

async function receive(message: LocalWhisperRequest) {
  if (!message || !Number.isInteger(message.id)) return;
  const id = message.id;
  if (message.type === "load") {
    try {
      loading ??= (async () => {
        recognizer = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base_timestamped", {
          device: "wasm", dtype: "q8",
          progress_callback: (progress) => {
            const item = progress as { file?: string; loaded?: number; total?: number; progress?: number };
            scope.postMessage({ type: "progress", id, file: item.file, loaded: item.loaded, total: item.total, progress: item.progress });
          },
        }) as unknown as Recognizer;
      })();
      await loading;
      scope.postMessage({ type: "ready", id });
    } catch { loading = null; recognizer = null; scope.postMessage({ type: "error", id, code: "local-asr-download" }); }
    return;
  }
  if (message.type !== "transcribe") return;
  if (!recognizer) { scope.postMessage({ type: "error", id, code: "local-asr-not-ready" }); return; }
  if (busy) { scope.postMessage({ type: "error", id, code: "local-asr-busy" }); return; }
  if (!(message.audio instanceof Float32Array) || !message.audio.length || message.audio.length > 16_000 * 60
    || message.audio.some((sample) => !Number.isFinite(sample))) {
    scope.postMessage({ type: "error", id, code: "local-asr-invalid-result" }); return;
  }
  busy = true;
  try {
    const output = await recognizer(message.audio, {
      language: "es", task: "transcribe", return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5,
      do_sample: false,
    });
    scope.postMessage({ type: "result", id, output });
  } catch { scope.postMessage({ type: "error", id, code: "local-asr-inference" }); }
  finally { busy = false; }
}

scope.onmessage = (event) => { void receive(event.data); };
