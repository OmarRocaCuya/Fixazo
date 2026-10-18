// Pure, in-memory audio helpers for the experimental emotion pipeline.
// Nothing here touches storage or the network; callers drop buffers after use.

export const TARGET_RATE = 16_000;

/** Average all channels into one. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return Float32Array.from(channels[0]);
  const n = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] / channels.length;
  return out;
}

/** Box-filtered resampling to 16 kHz (averaging also acts as a simple low-pass). */
export function resampleTo16k(input: Float32Array, rate: number): Float32Array {
  if (rate === TARGET_RATE) return Float32Array.from(input);
  const ratio = rate / TARGET_RATE;
  const n = Math.round(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = i * ratio;
    const end = Math.min(input.length, start + Math.max(1, ratio));
    let sum = 0;
    let weight = 0;
    for (let p = Math.floor(start); p < end; p++) {
      const w = Math.min(p + 1, end) - Math.max(p, start);
      if (w <= 0) continue;
      sum += input[p] * w;
      weight += w;
    }
    out[i] = weight > 0 ? sum / weight : 0;
  }
  return out;
}

export function capSeconds(samples: Float32Array, rate: number, maxSeconds: number): Float32Array {
  const max = Math.floor(rate * maxSeconds);
  return samples.length > max ? samples.subarray(0, max) : samples;
}

/** PCM16 mono WAV at 16 kHz, the format the private backend validates. */
export function encodeWav16(samples: Float32Array, rate = TARGET_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i])) : 0;
    view.setInt16(44 + i * 2, v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), true);
  }
  return bytes;
}
