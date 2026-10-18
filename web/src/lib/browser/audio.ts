// On-device audio analysis with the Web Audio API. Each frame is reduced to a
// few numbers (RMS, VAD, F0, clipping) inside the audio callback and dropped.
// Exception (EXPERIMENTAL emotion estimate): one answer
// turn may be held in RAM (capped at 15 s) for the emotion estimate; the caller
// takes it once, sends it as an in-memory WAV, and wipes it. Never stored.
import type { FrameFeature } from "../types";
import { clippingRatio, createVad, detectPitch, rms, vadStep, type VadState } from "../dsp";

const FRAME = 2048;
const PITCH_TARGET_SR = 16000;

export class AudioAnalyzer {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private vad: VadState = createVad();
  private t0 = 0;
  private listeners = new Set<(f: FrameFeature) => void>();
  private scratch = new Float32Array(FRAME);
  private capture: { buffer: Float32Array; length: number } | null = null;
  level = 0;

  get running() {
    return this.ctx !== null;
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  /** EXPERIMENTAL (opt-in): start holding this turn's raw samples in RAM, capped. */
  startCapture(maxSeconds = 15) {
    this.discardCapture();
    if (!this.ctx) return;
    const seconds = Number.isFinite(maxSeconds) ? Math.min(15, Math.max(1, maxSeconds)) : 15;
    this.capture = { buffer: new Float32Array(Math.ceil(this.ctx.sampleRate * seconds)), length: 0 };
  }

  /** Hands over the captured samples once and forgets them. */
  takeCapture(): { samples: Float32Array; rate: number } | null {
    const c = this.capture;
    this.capture = null;
    if (!c || !this.ctx || c.length === 0) {
      c?.buffer.fill(0);
      return null;
    }
    return { samples: c.buffer.subarray(0, c.length), rate: this.ctx.sampleRate };
  }

  discardCapture() {
    this.capture?.buffer.fill(0);
    this.capture = null;
  }

  now(): number {
    return typeof performance !== "undefined" ? performance.now() - this.t0 : 0;
  }

  async start(): Promise<void> {
    if (this.ctx) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("no-mediadevices");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => undefined);
    this.t0 = performance.now();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(FRAME, 1, 1);
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0;
    const sr = this.ctx.sampleRate;
    const factor = Math.max(1, Math.floor(sr / PITCH_TARGET_SR));
    const down = new Float32Array(Math.floor(FRAME / factor));
    this.node.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0);
      const capture = this.capture;
      if (capture) {
        const n = Math.min(capture.buffer.length - capture.length, input.length);
        if (n > 0) {
          capture.buffer.set(input.subarray(0, n), capture.length);
          capture.length += n;
        }
      }
      this.scratch.set(input);
      const level = rms(this.scratch);
      const step = vadStep(this.vad, level);
      this.vad = step.state;
      let f0: number | null = null;
      if (step.voiced) {
        for (let i = 0; i < down.length; i++) down[i] = this.scratch[i * factor];
        f0 = detectPitch(down, sr / factor);
      }
      this.level = level;
      const frame: FrameFeature = { t: this.now(), rms: level, voiced: step.voiced, f0, clip: clippingRatio(this.scratch) };
      this.scratch.fill(0);
      for (const l of this.listeners) l(frame);
    };
    this.source.connect(this.node);
    this.node.connect(this.sink);
    this.sink.connect(this.ctx.destination);
  }

  subscribe(cb: (f: FrameFeature) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  stop() {
    this.discardCapture();
    if (this.node) this.node.onaudioprocess = null;
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      this.sink?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.node = null;
    this.source = null;
    this.sink = null;
    this.stream = null;
    this.ctx = null;
    this.listeners.clear();
    this.vad = createVad();
  }
}
