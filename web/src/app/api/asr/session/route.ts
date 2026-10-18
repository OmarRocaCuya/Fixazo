import { authorizeVoiceRequest } from "@/lib/server/voice-policy";

const HEADERS = { "Cache-Control": "no-store", "Pragma": "no-cache" };

async function readSmallBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > 2048) { await reader.cancel(); throw new Error("request-too-large"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

/** Grants expire for connection establishment, not as a paid-stream quota. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return Response.json({ error: "request-too-large" }, { status: 413, headers: HEADERS });
  let body: unknown;
  try {
    const text = await readSmallBody(request);
    body = JSON.parse(text);
  } catch (error) {
    const large = error instanceof Error && error.message === "request-too-large";
    return Response.json({ error: large ? "request-too-large" : "invalid-request" }, { status: large ? 413 : 400, headers: HEADERS });
  }
  const authorization = authorizeVoiceRequest(request, body, "deepgram");
  if (!authorization.ok) return Response.json({ error: authorization.error }, { status: authorization.status, headers: HEADERS });
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 8000);
  try {
    if (request.signal.aborted) throw new Error("cancelled");
    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST", cache: "no-store", signal: controller.signal,
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 30 }),
    });
    if (!response.ok) return Response.json({ error: "asr-unavailable" }, { status: 502, headers: HEADERS });
    const token = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof token.access_token !== "string" || !token.access_token || token.access_token.length > 8192 || typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0 || token.expires_in > 60) {
      return Response.json({ error: "invalid-provider-session" }, { status: 502, headers: HEADERS });
    }
    return Response.json({ token: token.access_token, expiresAt: Date.now() + token.expires_in * 1000, model: "nova-3", language: "es-419", maxDurationSeconds: 180 }, { headers: HEADERS });
  } catch {
    // Do not return/log upstream payloads, credentials, voice or transcripts.
    return Response.json({ error: "asr-unavailable" }, { status: 502, headers: HEADERS });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
  }
}
