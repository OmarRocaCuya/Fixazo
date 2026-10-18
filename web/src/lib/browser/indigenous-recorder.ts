/** Transport-only WAV capture. No persistence, identities or voice analysis. */
export const INDIGENOUS_AUDIO_LIMIT_S = 30;
export const INDIGENOUS_SAMPLE_RATE = 16000;

export function encodeMonoWav(samples: Float32Array, inputRate: number): ArrayBuffer {
  if (!Number.isFinite(inputRate) || inputRate <= 0) throw new Error("invalid-sample-rate");
  const length = Math.min(INDIGENOUS_AUDIO_LIMIT_S * INDIGENOUS_SAMPLE_RATE, Math.floor(samples.length * INDIGENOUS_SAMPLE_RATE / inputRate));
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, INDIGENOUS_SAMPLE_RATE, true); view.setUint32(28, INDIGENOUS_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const position = i * inputRate / INDIGENOUS_SAMPLE_RATE;
    const left = Math.floor(position);
    const fraction = position - left;
    const value = samples[left] * (1 - fraction) + (samples[Math.min(left + 1, samples.length - 1)] ?? 0) * fraction;
    const sample = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}

export class IndigenousRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private samples: Float32Array[] = [];
  private size = 0;
  private cancelled = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  async start(onLimit: () => void) {
    this.cancelled = false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    if (this.cancelled) { stream.getTracks().forEach((track) => track.stop()); return false; }
    this.stream = stream;
    try {
      const context = new AudioContext({ sampleRate: INDIGENOUS_SAMPLE_RATE });
      this.context = context;
      await context.resume();
      if (this.cancelled) { this.cancel(); return false; }
      this.source = context.createMediaStreamSource(stream);
      this.processor = context.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        event.outputBuffer.getChannelData(0).fill(0);
        const input = event.inputBuffer.getChannelData(0);
        const remaining = Math.max(0, Math.floor(context.sampleRate * INDIGENOUS_AUDIO_LIMIT_S) - this.size);
        if (!remaining || this.cancelled) return;
        const chunk = input.slice(0, Math.min(remaining, input.length));
        this.samples.push(chunk);
        this.size += chunk.length;
      };
      this.source.connect(this.processor);
      this.processor.connect(context.destination); // The output buffer remains silent.
      this.timer = setTimeout(onLimit, INDIGENOUS_AUDIO_LIMIT_S * 1000);
      return true;
    } catch (error) {
      this.cancel();
      throw error;
    }
  }

  finish(): Blob | null {
    const rate = this.context?.sampleRate;
    const merged = new Float32Array(this.size);
    let offset = 0;
    for (const chunk of this.samples) { merged.set(chunk, offset); offset += chunk.length; }
    this.cancel();
    if (!rate || !merged.length) return null;
    return new Blob([encodeMonoWav(merged, rate)], { type: "audio/wav" });
  }

  cancel() {
    this.cancelled = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.processor) this.processor.onaudioprocess = null;
    this.source?.disconnect();
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    this.source = null;
    this.processor = null;
    this.context = null;
    this.stream = null;
    this.samples = [];
    this.size = 0;
  }
}

/** An older async permission failure must not clear a newer capture attempt. */
export function releaseIndigenousRecorder(ref: { current: IndigenousRecorder | null }, client: IndigenousRecorder) {
  client.cancel();
  if (ref.current === client) ref.current = null;
}
