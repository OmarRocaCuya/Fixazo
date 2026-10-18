import { connection } from "next/server";
import type { Grade } from "@/lib/types";
import { buildMissionFromText, detectTextLang } from "@/lib/mission/builder";
import { describeError, generateMissionWithClaude, hasClaudeKey, type ImageInput } from "@/lib/server/claude";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_TEXT = 20_000;
const MAX_IMAGE_B64 = 14_000_000; // ≈ 10 MB file

export async function GET() {
  await connection();
  return Response.json({ llm: hasClaudeKey() });
}

const QUECHUA_MSG =
  "Por ahora las misiones en quechua usan textos validados por un hablante. Elige la misión de ejemplo en quechua o pega un texto en castellano.";

function fromText(text: string, grade: Grade, fallbackReason?: string) {
  if (detectTextLang(text) === "qu") return Response.json({ error: QUECHUA_MSG }, { status: 422 });
  const r = buildMissionFromText(text, { grade });
  if (!r.ok) return Response.json({ error: r.error }, { status: 422 });
  return Response.json({ source: "reglas", mission: r.mission, warnings: r.warnings, ...(fallbackReason ? { fallbackReason } : {}) });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "El cuerpo debe ser JSON." }, { status: 400 });
  }
  const grade = Number(body.grade);
  if (![3, 4, 5, 6].includes(grade)) return Response.json({ error: "Grado inválido (3 a 6)." }, { status: 400 });
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT) : "";

  let image: ImageInput | undefined;
  const img = body.image as { data?: unknown; mediaType?: unknown } | undefined;
  if (img) {
    if (typeof img.data !== "string" || img.data.length > MAX_IMAGE_B64 || !MEDIA_TYPES.includes(img.mediaType as (typeof MEDIA_TYPES)[number])) {
      return Response.json({ error: "La foto debe ser JPG, PNG o WebP de hasta 10 MB." }, { status: 400 });
    }
    image = { data: img.data, mediaType: img.mediaType as ImageInput["mediaType"] };
  }
  if (!text.trim() && !image) return Response.json({ error: "Pega un texto o sube una foto." }, { status: 400 });

  if (!hasClaudeKey()) {
    if (image && !text.trim()) {
      return Response.json(
        { error: "Para leer fotos se necesita configurar ANTHROPIC_API_KEY. Mientras tanto, pega el texto de la lectura." },
        { status: 400 },
      );
    }
    return fromText(text, grade as Grade);
  }

  try {
    const r = await generateMissionWithClaude({ text: text || undefined, image, grade: grade as Grade });
    if (r.ok) return Response.json({ source: "llm", mission: r.mission, warnings: [] });
    if (r.unreadable) return Response.json({ error: `No pude leer bien la foto: ${r.error}`, unreadable: true }, { status: 422 });
    if (text.trim()) return fromText(text, grade as Grade, "llm_invalid");
    return Response.json({ error: "No pude armar la misión con esa foto. Intenta con otra foto o pega el texto." }, { status: 502 });
  } catch (e) {
    if (text.trim()) return fromText(text, grade as Grade, describeError(e));
    return Response.json({ error: "No pude leer la foto ahora. Intenta otra vez o pega el texto." }, { status: 502 });
  }
}
