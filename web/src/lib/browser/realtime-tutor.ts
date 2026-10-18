/** Independent, ephemeral conversational demo. Never feeds reading assessment. */
export type TutorState = "idle" | "connecting" | "ready" | "listening" | "thinking" | "speaking" | "error";
export type TutorAccess = { audience: "adult-demo" | "approved-pilot"; consent: true; adultConfirmed?: true; accessCode: string };
export type TutorCallbacks = {
  onState: (state: TutorState) => void;
  onError: (message: string) => void;
  onTutorText: (text: string) => void;
  onEnd: (reason: "closed" | "time-limit") => void;
};
type Dependencies = {
  fetch: typeof fetch;
  microphone: () => Promise<MediaStream>;
  peer: () => RTCPeerConnection;
  audio: () => HTMLAudioElement;
};

const MAX_DURATION_MS = 180_000;
const CONNECT_TIMEOUT_MS = 25_000;

export function realtimeTutorSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && typeof RTCPeerConnection !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function friendlyError(error: unknown): string {
  if (error instanceof Error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")) return "No se permitió el micrófono. Revisa el permiso del navegador y vuelve a conectar.";
  if (error instanceof Error && error.name === "NotFoundError") return "No encontramos un micrófono. Conecta uno y vuelve a intentar.";
  if (error instanceof Error && error.name === "NotReadableError") return "No se pudo abrir el micrófono. Cierra otras aplicaciones que lo estén usando y reintenta.";
  return error instanceof Error ? error.message : "No se pudo iniciar la voz. Revisa la conexión y vuelve a intentar.";
}

const API_ERRORS: Record<string, string> = {
  "cloud-disabled": "La voz en la nube está desactivada en este despliegue.",
  "provider-not-configured": "Falta configurar el proveedor de voz en el servidor.",
  "invalid-access-code": "El código de acceso no es válido. Solicítalo al responsable del piloto.",
  "voice-access-required": "El código de acceso no es válido. Solicítalo al responsable del piloto.",
  "provider-busy": "El proveedor está ocupado. Espera un momento antes de intentar otra vez.",
  "rate-limit": "Se alcanzó el límite temporal de conexiones. Espera unos minutos.",
  "voice-rate-limit": "Se alcanzó el límite temporal de conexiones. Espera unos minutos.",
};

export class RealtimeTutor {
  private state: TutorState = "idle";
  private epoch = 0;
  private connection: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private speaker: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private durationTimer: ReturnType<typeof setTimeout> | null = null;
  private responseTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private turnStartedAt = 0;
  private readonly dependencies: Dependencies;

  constructor(private readonly callbacks: TutorCallbacks, dependencies?: Partial<Dependencies>) {
    this.dependencies = {
      fetch: (...args) => fetch(...args),
      microphone: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }),
      peer: () => new RTCPeerConnection(),
      audio: () => new Audio(),
      ...dependencies,
    };
  }

  private setState(state: TutorState) { this.state = state; this.callbacks.onState(state); }
  private mic(enabled: boolean) { this.stream?.getAudioTracks().forEach((track) => { track.enabled = enabled; }); }

  async start(access: TutorAccess): Promise<void> {
    this.cleanup();
    const epoch = ++this.epoch;
    this.setState("connecting");
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.connectTimer = setTimeout(() => this.fail("La conexión tardó demasiado. Vuelve a conectar."), CONNECT_TIMEOUT_MS);
    try {
      const stream = await this.dependencies.microphone();
      if (epoch !== this.epoch) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      this.mic(false);
      const response = await this.dependencies.fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Voice-Access-Code": access.accessCode },
        body: JSON.stringify({ audience: access.audience, consent: access.consent, ...(access.adultConfirmed ? { adultConfirmed: true } : {}) }),
        cache: "no-store",
        signal,
      });
      const token: unknown = await response.json();
      if (epoch !== this.epoch) return;
      if (!response.ok) {
        const code = token && typeof token === "object" ? (token as Record<string, unknown>).error : null;
        throw new Error(typeof code === "string" && API_ERRORS[code] ? API_ERRORS[code] : "No se autorizó la voz. Revisa código, consentimiento y configuración del piloto.");
      }
      if (!token || typeof token !== "object") throw new Error("Respuesta de voz no válida. Vuelve a intentar.");
      const { value, expiresAt } = token as Record<string, unknown>;
      if (typeof value !== "string" || !value.startsWith("ek_") || typeof expiresAt !== "number" || expiresAt * 1000 <= Date.now()) throw new Error("El permiso temporal de voz caducó. Vuelve a conectar.");
      const peer = this.dependencies.peer();
      this.connection = peer;
      const speaker = this.dependencies.audio();
      this.speaker = speaker;
      speaker.autoplay = true;
      peer.ontrack = (event) => {
        if (epoch !== this.epoch) return;
        speaker.srcObject = event.streams[0];
        void speaker.play().catch(() => { if (epoch === this.epoch) this.fail("El navegador bloqueó la reproducción. Permite el sonido y vuelve a conectar."); });
      };
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      channel.onopen = () => {
        if (epoch !== this.epoch) return;
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.setState("ready");
        this.durationTimer = setTimeout(() => this.stop("time-limit"), MAX_DURATION_MS);
      };
      channel.onmessage = (event) => { if (epoch === this.epoch) this.receive(event.data); };
      channel.onclose = () => { if (epoch === this.epoch) this.fail("Se cerró la conexión de voz. Puedes volver a conectar."); };
      channel.onerror = () => { if (epoch === this.epoch) this.fail("Falló la conexión de voz. Revisa la red y vuelve a conectar."); };
      peer.onconnectionstatechange = () => {
        if (epoch === this.epoch && ["failed", "disconnected", "closed"].includes(peer.connectionState)) this.fail("Se perdió la conexión de voz. Vuelve a conectar.");
      };
      const offer = await peer.createOffer();
      if (epoch !== this.epoch) return;
      await peer.setLocalDescription(offer);
      if (epoch !== this.epoch) return;
      const answer = await this.dependencies.fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST", headers: { Authorization: `Bearer ${value}`, "Content-Type": "application/sdp" }, body: offer.sdp, signal,
      });
      if (epoch !== this.epoch) return;
      if (!answer.ok) throw new Error("El proveedor no pudo conectar la voz. Vuelve a intentar.");
      const sdp = await answer.text();
      if (epoch !== this.epoch) return;
      await peer.setRemoteDescription({ type: "answer", sdp });
    } catch (error) { if (epoch === this.epoch) this.fail(friendlyError(error)); }
  }

  private send(type: string): boolean {
    if (this.channel?.readyState !== "open") return false;
    try { this.channel.send(JSON.stringify({ type })); return true; }
    catch { this.fail("No se pudo enviar el turno. Vuelve a conectar."); return false; }
  }

  beginTurn(): void {
    if (this.state !== "ready") return;
    if (!this.send("input_audio_buffer.clear")) return;
    this.turnStartedAt = Date.now();
    this.mic(true);
    this.setState("listening");
    this.turnTimer = setTimeout(() => this.endTurn(), 30_000);
  }

  endTurn(): void {
    if (this.state !== "listening") return;
    this.mic(false);
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (Date.now() - this.turnStartedAt < 300) {
      this.send("input_audio_buffer.clear");
      this.setState("ready");
      return;
    }
    this.setState("thinking");
    // Let the final RTP audio frames reach the provider before committing via
    // the separate data channel. This is not word-level acoustic alignment.
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      if (this.send("input_audio_buffer.commit") && this.send("response.create")) {
        this.responseTimer = setTimeout(() => this.fail("El tutor tardó demasiado en responder. Vuelve a conectar."), 35_000);
      }
    }, 200);
  }

  private receive(raw: unknown): void {
    if (typeof raw !== "string" || raw.length > 100_000) return;
    let event: Record<string, unknown>;
    try { event = JSON.parse(raw); } catch { return; }
    if (!event || typeof event !== "object") return;
    switch (event.type) {
      case "response.created": this.setState("thinking"); break;
      case "output_audio_buffer.started": this.setState("speaking"); break;
      case "output_audio_buffer.stopped":
        if (this.responseTimer) clearTimeout(this.responseTimer);
        this.responseTimer = null;
        this.setState("ready");
        break;
      case "response.output_audio_transcript.done":
        if (typeof event.transcript === "string") this.callbacks.onTutorText(event.transcript.slice(0, 2000));
        break;
      case "response.done": {
        const response = event.response;
        if (response && typeof response === "object" && (response as Record<string, unknown>).status === "failed") this.fail("El tutor no pudo responder. Vuelve a conectar.");
        break;
      }
      case "error": this.fail("El proveedor no pudo procesar el turno. No se ha registrado ninguna evaluación. Vuelve a conectar."); break;
    }
  }

  private fail(message: string): void {
    this.cleanup();
    this.setState("error");
    this.callbacks.onError(message);
  }

  stop(reason: "closed" | "time-limit" = "closed"): void {
    this.cleanup();
    this.setState("idle");
    this.callbacks.onEnd(reason);
  }

  private cleanup(): void {
    ++this.epoch;
    [this.connectTimer, this.durationTimer, this.responseTimer, this.turnTimer, this.commitTimer].forEach((timer) => { if (timer) clearTimeout(timer); });
    this.connectTimer = this.durationTimer = this.responseTimer = this.turnTimer = this.commitTimer = null;
    this.abort?.abort();
    this.abort = null;
    if (this.channel) { this.channel.onopen = this.channel.onmessage = this.channel.onclose = this.channel.onerror = null; this.channel.close(); }
    this.channel = null;
    if (this.connection) { this.connection.ontrack = this.connection.onconnectionstatechange = null; this.connection.close(); }
    this.connection = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.speaker) { this.speaker.pause(); this.speaker.srcObject = null; }
    this.speaker = null;
  }
}
