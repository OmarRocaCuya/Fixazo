import { authorizeVoiceRequest } from "@/lib/server/voice-policy";
import { getIndigenousCapabilities, IndigenousProxyError, readIndigenousBody, transcribeIndigenousAudio, translateIndigenousText } from "@/lib/server/indigenous-proxy";
import { connection } from "next/server";

export const maxDuration = 60;
const HEADERS = { "Cache-Control": "no-store", "Pragma": "no-cache" };
const MAX_REQUEST_BYTES = 1_010_000;

export async function GET(request: Request) {
  await connection();
  return Response.json(await getIndigenousCapabilities(request.signal), { headers: HEADERS });
}

export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("application/json") && !type.startsWith("multipart/form-data")) {
      return Response.json({ error: "unsupported-content-type" }, { status: 415, headers: HEADERS });
    }
    const limit = type.startsWith("application/json") ? 8192 : MAX_REQUEST_BYTES;
    if (Number(request.headers.get("content-length") ?? 0) > limit) throw new IndigenousProxyError("request-too-large", 413);
    const bytes = await readIndigenousBody(request.body, limit);
    if (type.startsWith("multipart/form-data")) {
      let form: FormData;
      try { form = await new Response(bytes as BodyInit, { headers: { "Content-Type": type } }).formData(); }
      catch { return Response.json({ error: "invalid-request" }, { status: 400, headers: HEADERS }); }
      const authorization = authorizeVoiceRequest(request, "meta");
      if (!authorization.ok) return Response.json({ error: authorization.error }, { status: authorization.status, headers: HEADERS });
      const file = form.get("file");
      const language = form.get("language");
      if (form.get("action") !== "transcribe" || !(file instanceof Blob) || typeof language !== "string") {
        return Response.json({ error: "invalid-request" }, { status: 400, headers: HEADERS });
      }
      return Response.json(await transcribeIndigenousAudio(file, language, request.signal), { headers: HEADERS });
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { return Response.json({ error: "invalid-request" }, { status: 400, headers: HEADERS }); }
    const authorization = authorizeVoiceRequest(request, "meta");
    if (!authorization.ok) return Response.json({ error: authorization.error }, { status: authorization.status, headers: HEADERS });
    if (!body || body.action !== "translate" || typeof body.text !== "string" || typeof body.sourceLanguage !== "string" || typeof body.targetLanguage !== "string") {
      return Response.json({ error: "invalid-request" }, { status: 400, headers: HEADERS });
    }
    return Response.json(await translateIndigenousText(body.text, body.sourceLanguage, body.targetLanguage, request.signal), { headers: HEADERS });
  } catch (error) {
    return Response.json({ error: error instanceof IndigenousProxyError ? error.code : "indigenous-unavailable" }, { status: error instanceof IndigenousProxyError ? error.status : 502, headers: HEADERS });
  }
}
