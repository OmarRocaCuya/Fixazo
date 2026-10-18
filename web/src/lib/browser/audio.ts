// On-device audio analysis with the Web Audio API. Each frame is reduced to a
// few numbers (RMS, VAD, F0, clipping) inside the audio callback and dropped.
// No audio is recorded, stored or sent anywhere.
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
  level = 0;

  get running() {
    return this.ctx !== null;
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
