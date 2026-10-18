import { connection } from "next/server";
import { authorizeVoiceRequest } from "@/lib/server/voice-policy";
import { readIndigenousBody } from "@/lib/server/indigenous-proxy";
import { getReadingCapabilities, guidedReadingTurn, preflightReadingRequest, prepareGuidedReading, readingError, speakGuidedReading, transcribeTimedReading, ReadingVoiceError } from "@/lib/server/reading-voice";

export const maxDuration = 60;
const HEADERS = { "Cache-Control": "no-store, private", "Pragma": "no-cache" };

export async function GET(request: Request) {
  await connection();
  return Response.json(await getReadingCapabilities(request.signal), { headers: HEADERS });
}

function consent(request: Request, body: unknown) {
  const result = authorizeVoiceRequest(request, body, "meta");
  if (!result.ok) throw new ReadingVoiceError(result.error, result.status);
  // This research lane remains adult-only even in a configured child pilot.
  if (!body || typeof body !== "object" || (body as Record<string, unknown>).adultConfirmed !== true) throw new ReadingVoiceError("adult-demo-only", 403);
}

export async function POST(request: Request) {
  try {
    preflightReadingRequest(request);
    const type = request.headers.get("content-type") ?? "";
    const multipart = type.startsWith("multipart/form-data");
    if (!multipart && !type.startsWith("application/json")) throw new ReadingVoiceError("unsupported-content-type", 415);
    const limit = multipart ? 1_010_000 : 8192;
    if (Number(request.headers.get("content-length") ?? 0) > limit) throw new ReadingVoiceError("request-too-large", 413);
    const bytes = await readIndigenousBody(request.body, limit);
    if (multipart) {
      let form: FormData;
      try { form = await new Response(bytes as BodyInit, { headers: { "Content-Type": type } }).formData(); }
      catch { throw new ReadingVoiceError("invalid-request", 400); }
      consent(request, { audience: form.get("audience"), consent: form.get("consent") === "true", adultConfirmed: form.get("adultConfirmed") === "true" });
      const file = form.get("file");
      if (form.get("action") !== "transcribe" || !(file instanceof Blob)) throw new ReadingVoiceError("invalid-request", 400);
      return Response.json(await transcribeTimedReading(file, form.get("language"), request.signal), { headers: HEADERS });
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new ReadingVoiceError("invalid-request", 400); }
    consent(request, body);
    if (!body || typeof body !== "object") throw new ReadingVoiceError("invalid-request", 400);
    switch (body.action) {
      case "prepare": return Response.json(await prepareGuidedReading(body.passage, body.language, request.signal), { headers: HEADERS });
      case "turn": return Response.json(await guidedReadingTurn(body.passage, body.heard, body.language, body.turn, request.signal, body.history), { headers: HEADERS });
      case "speak": {
        const audio = await speakGuidedReading(body.text, body.language, request.signal);
        return new Response(audio as BodyInit, { headers: { ...HEADERS, "Content-Type": "audio/wav", "X-Content-Type-Options": "nosniff" } });
      }
      default: throw new ReadingVoiceError("invalid-reading-action", 400);
    }
  } catch (error) {
    const safe = readingError(error);
    return Response.json({ error: safe.error }, { status: safe.status, headers: HEADERS });
  }
}
