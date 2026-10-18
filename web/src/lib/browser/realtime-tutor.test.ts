import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeTutor, type TutorAccess, type TutorState } from "./realtime-tutor";

const access: TutorAccess = { audience: "adult-demo", accessCode: "private-pilot-code" };
function harness() {
  const track = { enabled: true, stop: vi.fn() };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
  const channel = { readyState: "open", onopen: null, onmessage: null, onclose: null, onerror: null, send: vi.fn(), close: vi.fn() } as unknown as RTCDataChannel;
  const peer = { ontrack: null, onconnectionstatechange: null, connectionState: "connected", addTrack: vi.fn(), createDataChannel: vi.fn(() => channel), createOffer: vi.fn(async () => ({ type: "offer", sdp: "v=0\r\noffer" })), setLocalDescription: vi.fn(async () => {}), setRemoteDescription: vi.fn(async () => {}), close: vi.fn() } as unknown as RTCPeerConnection;
  const speaker = { autoplay: false, srcObject: null, play: vi.fn(async () => {}), pause: vi.fn() } as unknown as HTMLAudioElement;
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ value: "ek_test", expiresAt: Math.floor(Date.now() / 1000) + 30 })).mockResolvedValue(new Response("v=0\r\nanswer"));
  const microphone = vi.fn(async () => stream);
  const callbacks = { onState: vi.fn<(state: TutorState) => void>(), onError: vi.fn(), onTutorText: vi.fn(), onEnd: vi.fn() };
  const tutor = new RealtimeTutor(callbacks, { fetch: fetchMock, microphone, peer: () => peer, audio: () => speaker });
  const open = () => channel.onopen?.({} as Event);
  const event = (data: unknown) => channel.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent);
  const sent = () => vi.mocked(channel.send).mock.calls.map((call: readonly unknown[]) => JSON.parse(String(call[0])).type);
  return { tutor, track, stream, channel, peer, speaker, fetchMock, microphone, callbacks, open, event, sent };
}

describe("ephemeral WebRTC tutor lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T00:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("connects using server ephemeral token and never automatically records a turn", async () => {
    const h = harness();
    await h.tutor.start(access);
    expect(h.track.enabled).toBe(false);
    expect(h.sent()).toEqual([]);
    expect(h.fetchMock.mock.calls[0][0]).toBe("/api/voice/session");
    const init = h.fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ "X-Voice-Access-Code": access.accessCode });
    expect(JSON.parse(String(init.body))).toEqual({ audience: "adult-demo" });
    expect(String(init.body)).not.toContain(access.accessCode);
    expect(h.fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer ek_test");
    h.open();
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("ready");
    h.tutor.stop();
  });

  it("clears buffers, transmits only explicit turns and commits after tail frames", async () => {
    const h = harness();
    await h.tutor.start(access); h.open();
    h.tutor.beginTurn();
    expect(h.track.enabled).toBe(true);
    expect(h.sent()).toEqual(["input_audio_buffer.clear"]);
    await vi.advanceTimersByTimeAsync(1000);
    h.tutor.endTurn();
    expect(h.track.enabled).toBe(false);
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("thinking");
    expect(h.sent()).not.toContain("input_audio_buffer.commit");
    await vi.advanceTimersByTimeAsync(200);
    expect(h.sent()).toEqual(["input_audio_buffer.clear", "input_audio_buffer.commit", "response.create"]);
    h.event({ type: "output_audio_buffer.started" });
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("speaking");
    h.event({ type: "response.output_audio_transcript.done", transcript: "¿Qué pista encontraste?" });
    expect(h.callbacks.onTutorText).toHaveBeenCalledWith("¿Qué pista encontraste?");
    h.event({ type: "response.done", response: { status: "completed" } });
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("speaking");
    h.event({ type: "output_audio_buffer.stopped" });
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("ready");
    h.tutor.stop();
  });

  it("does not commit very short accidental turns", async () => {
    const h = harness(); await h.tutor.start(access); h.open(); h.tutor.beginTurn(); h.tutor.endTurn();
    await vi.advanceTimersByTimeAsync(250);
    expect(h.sent()).toEqual(["input_audio_buffer.clear", "input_audio_buffer.clear"]);
    expect(h.track.enabled).toBe(false);
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("ready");
    h.tutor.stop();
  });

  it("automatically ends a 30 second microphone turn", async () => {
    const h = harness(); await h.tutor.start(access); h.open(); h.tutor.beginTurn();
    await vi.advanceTimersByTimeAsync(30_200);
    expect(h.track.enabled).toBe(false);
    expect(h.sent()).toContain("input_audio_buffer.commit");
    h.tutor.stop();
  });

  it("disposes all tracks, playback, pending events and connections at UI duration limit", async () => {
    const h = harness(); await h.tutor.start(access); h.open();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(h.track.stop).toHaveBeenCalledOnce();
    expect(h.channel.close).toHaveBeenCalledOnce();
    expect(h.peer.close).toHaveBeenCalledOnce();
    expect(h.speaker.pause).toHaveBeenCalledOnce();
    expect(h.speaker.srcObject).toBeNull();
    expect(h.callbacks.onEnd).toHaveBeenLastCalledWith("time-limit");
    expect(h.channel.onmessage).toBeNull();
  });

  it("handles denied permission without minting a token", async () => {
    const h = harness();
    h.microphone.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await h.tutor.start(access);
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(h.callbacks.onError).toHaveBeenCalledWith(expect.stringContaining("permiso"));
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("error");
  });

  it("releases a late permission result after user cancels", async () => {
    const h = harness();
    let release!: (stream: MediaStream) => void;
    h.microphone.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const start = h.tutor.start(access);
    h.tutor.stop(); release(h.stream); await start;
    expect(h.track.stop).toHaveBeenCalledOnce();
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("idle");
  });

  it("sanitizes upstream protocol errors and releases resources", async () => {
    const h = harness(); await h.tutor.start(access); h.open();
    h.event({ type: "error", error: { message: "sensitive-provider-error" } });
    expect(h.callbacks.onError).toHaveBeenCalledWith(expect.not.stringContaining("sensitive-provider-error"));
    expect(h.track.stop).toHaveBeenCalledOnce();
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("error");
  });

  it("rejects stale or permanent key-shaped server responses", async () => {
    const h = harness();
    h.fetchMock.mockReset().mockResolvedValue(Response.json({ value: "sk_not-ephemeral", expiresAt: 1 }));
    await h.tutor.start(access);
    expect(h.peer.addTrack).not.toHaveBeenCalled();
    expect(h.track.stop).toHaveBeenCalledOnce();
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("error");
  });

  it("handles authorization rejection without contacting OpenAI", async () => {
    const h = harness(); h.fetchMock.mockReset().mockResolvedValue(Response.json({ error: "invalid-access-code" }, { status: 403 }));
    await h.tutor.start(access);
    expect(h.fetchMock).toHaveBeenCalledOnce();
    expect(h.callbacks.onError).toHaveBeenCalledWith(expect.stringContaining("código"));
    expect(h.track.stop).toHaveBeenCalledOnce();
  });

  it("ignores unsupported events and malformed JSON without inferring user emotion", async () => {
    const h = harness(); await h.tutor.start(access); h.open();
    h.event("not-json"); h.event(null); h.event({ type: "conversation.item.input_audio_transcription.completed", transcript: "No persistas mi voz" });
    expect(h.callbacks.onTutorText).not.toHaveBeenCalled();
    expect(h.callbacks.onError).not.toHaveBeenCalled();
    h.tutor.stop();
  });

  it("ends an unresponsive connection and late microphone result safely", async () => {
    const h = harness(); let release!: (stream: MediaStream) => void;
    h.microphone.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const start = h.tutor.start(access); await vi.advanceTimersByTimeAsync(25_000); release(h.stream); await start;
    expect(h.track.stop).toHaveBeenCalledOnce();
    expect(h.callbacks.onState).toHaveBeenLastCalledWith("error");
    expect(h.fetchMock).not.toHaveBeenCalled();
  });
});
