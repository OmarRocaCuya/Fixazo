import { encodeMonoWav, INDIGENOUS_SAMPLE_RATE } from "./indigenous-recorder";

export interface ReadingPcmChunk {
  startSeconds: number;
  durationSeconds: number;
}

export interface ReadingPcmCaptureOptions {
  chunkSeconds?: number;
  maxSeconds?: number;
  onChunk: (audio: Blob, timing: ReadingPcmChunk) => void;
  onLimit: () => void;
  onError: (code: string) => void;
  /** Normalized RMS from this capture, never a second microphone stream. */
  onLevel?: (level: number) => void;
}

interface CaptureSession {
  context: AudioContext | null;
  stream: MediaStream | null;
  source: MediaStreamAudioSourceNode | null;
  processor: ScriptProcessorNode | null;
  timer: ReturnType<typeof setTimeout> | null;
  buffer: Float32Array | null;
  filled: number;
  total: number;
  rate: number;
  maxSamples: number;
}

/** Incremental transport only. Constructing this class never opens a microphone. */
export class ReadingPcmCapture {
  private session: CaptureSession | null = null;
  private readonly chunkSeconds: number;
  private readonly maxSeconds: number;

  constructor(private readonly options: ReadingPcmCaptureOptions) {
    this.chunkSeconds = options.chunkSeconds ?? 4;
    this.maxSeconds = options.maxSeconds ?? 60;
    if (!Number.isFinite(this.chunkSeconds) || this.chunkSeconds < 0.1 || this.chunkSeconds > 30) throw new RangeError("chunkSeconds must be between 0.1 and 30");
    if (!Number.isFinite(this.maxSeconds) || this.maxSeconds < 0.1 || this.maxSeconds > 60) throw new RangeError("maxSeconds must be between 0.1 and 60");
  }

  /** Call directly from an explicit user action, not from mount or a timer. */
  async start(): Promise<boolean> {
    if (this.session) return false;
    if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function" || typeof AudioContext === "undefined") {
      this.options.onError("unsupported");
      return false;
    }
    const session: CaptureSession = { context: null, stream: null, source: null, processor: null,
      timer: null, buffer: null, filled: 0, total: 0, rate: INDIGENOUS_SAMPLE_RATE, maxSamples: 0 };
    this.session = session;
    try {
      // Create/resume synchronously in the gesture path, before permission awaits.
      const context = new AudioContext({ sampleRate: INDIGENOUS_SAMPLE_RATE });
      session.context = context;
      const resumed = context.resume();
      // Attach a rejection handler immediately while getUserMedia may remain open.
      const resumeResult = resumed.then(() => null, (error: unknown) => error);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false,
      } });
      if (this.session !== session) { stream.getTracks().forEach((track) => track.stop()); return false; }
      session.stream = stream;
      const resumeError = await resumeResult;
      if (this.session !== session) return false;
      if (resumeError !== null) throw resumeError;
      if (!Number.isFinite(context.sampleRate) || context.sampleRate <= 0) throw new Error("sample-rate");
      session.rate = context.sampleRate;
      session.maxSamples = Math.floor(session.rate * this.maxSeconds);
      session.buffer = new Float32Array(Math.max(1, Math.round(session.rate * Math.min(this.chunkSeconds, this.maxSeconds))));
      session.source = context.createMediaStreamSource(stream);
      // 64 ms at 16 kHz: live companion reacts while speaking, not after an ASR chunk.
      session.processor = context.createScriptProcessor(1024, 1, 1);
      session.processor.onaudioprocess = (event) => {
        if (this.session !== session) return;
        try {
          event.outputBuffer.getChannelData(0).fill(0);
          const input = event.inputBuffer.getChannelData(0);
          if (this.options.onLevel) {
            let sum = 0;
            for (const value of input) sum += value * value;
            this.options.onLevel(Math.min(1, Math.sqrt(sum / Math.max(1, input.length)) * 8));
          }
          this.accept(session, input);
        } catch { this.fail(session, "audio-capture"); }
      };
      session.source.connect(session.processor);
      session.processor.connect(context.destination);
      // Wall time also bounds the mic if callbacks are throttled or stop arriving.
      session.timer = setTimeout(() => this.finish(session, true, true), this.maxSeconds * 1000);
      return true;
    } catch (error) {
      if (this.session === session) this.fail(session, error instanceof Error && error.name === "NotAllowedError" ? "not-allowed" : "audio-capture");
      return false;
    }
  }

  private accept(session: CaptureSession, input: Float32Array) {
    let offset = 0;
    while (this.session === session && session.buffer && offset < input.length && session.total < session.maxSamples) {
      const count = Math.min(input.length - offset, session.buffer.length - session.filled, session.maxSamples - session.total);
      session.buffer.set(input.subarray(offset, offset + count), session.filled);
      session.filled += count;
      session.total += count;
      offset += count;
      if (session.filled === session.buffer.length && !this.emit(session)) return;
    }
    if (this.session === session && session.total >= session.maxSamples) this.finish(session, true, true);
  }

  private emit(session: CaptureSession): boolean {
    if (!session.buffer || session.filled / session.rate < 0.1) return true;
    const count = session.filled;
    const timing = { startSeconds: (session.total - count) / session.rate, durationSeconds: count / session.rate };
    const wav = encodeMonoWav(session.buffer.subarray(0, count), session.rate);
    session.buffer.fill(0, 0, count);
    session.filled = 0;
    try { this.options.onChunk(new Blob([wav], { type: "audio/wav" }), timing); }
    catch {
      if (this.session === session) this.fail(session, "capture-callback-error");
      return false;
    }
    return true;
  }

  /** Flush the last >=100 ms of PCM once, then release the microphone. */
  stop() {
    if (this.session) this.finish(this.session, true, false);
  }

  /** Discard the incomplete chunk. Already delivered chunks are caller-owned. */
  abort() {
    if (this.session) this.finish(this.session, false, false);
  }

  private finish(session: CaptureSession, flush: boolean, limited: boolean) {
    if (this.session !== session) return;
    // Release first so callbacks cannot accidentally flush the same tail twice.
    this.session = null;
    this.release(session);
    const emitted = !flush || this.emit(session);
    session.buffer?.fill(0);
    session.buffer = null;
    session.filled = 0;
    if (!emitted) this.options.onError("capture-callback-error");
    else if (limited) this.options.onLimit();
  }

  private fail(session: CaptureSession, code: string) {
    if (this.session !== session) return;
    this.finish(session, false, false);
    this.options.onError(code);
  }

  private release(session: CaptureSession) {
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
    if (session.processor) session.processor.onaudioprocess = null;
    for (const node of [session.source, session.processor]) { try { node?.disconnect(); } catch { /* already disconnected */ } }
    session.stream?.getTracks().forEach((track) => { try { track.stop(); } catch { /* already stopped */ } });
    if (session.context && session.context.state !== "closed") void session.context.close().catch(() => {});
    session.source = session.processor = null;
    session.stream = null;
    session.context = null;
  }
}
