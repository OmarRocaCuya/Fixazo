// Botón de demo: corre el pipeline real para UNA noticia y va contando cada paso (NDJSON en streaming).
// Apagado salvo PERIODICO_DEMO_GENERAR=true y con las claves de búsqueda y de Haiku en el servidor.
import { unaNoticia } from "../../../../../pipeline/correr.mjs";
import { noticiaPublica } from "@/lib/periodico/ediciones";
import type { Noticia } from "@/lib/periodico/tipos";

export const maxDuration = 300;

// ponytail: límites en memoria por instancia; un tope global de gasto sigue siendo el de cada proveedor.
const MAX_POR_INSTANCIA = 15;
let enCurso = false;
let hechas = 0;

const activo = () =>
  process.env.PERIODICO_DEMO_GENERAR === "true" && Boolean(process.env.OPENROUTER_API_KEY) && Boolean(process.env.TAVILY_API_KEY);

export function GET() {
  return Response.json({ enabled: activo() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!activo()) return Response.json({ error: "demo-disabled" }, { status: 404 });
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(request.url).host) return Response.json({ error: "origin" }, { status: 403 });
  if (enCurso) return Response.json({ error: "busy", texto: "Ya se está generando una noticia. Espera a que termine." }, { status: 409 });
  if (hechas >= MAX_POR_INSTANCIA) return Response.json({ error: "limit", texto: "Se alcanzó el límite de noticias de demo." }, { status: 429 });

  enCurso = true;
  hechas++;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (o: object) => controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      try {
        const registro = (await unaNoticia({ alPaso: enviar })) as { id: string; guardada?: boolean; fuentes: unknown; noticia: Noticia | null } | null;
        enviar({
          paso: "fin",
          // Sin criterios privados ni respuesta modelo: lo mismo que ve cualquier lector.
          noticia: registro?.noticia ? noticiaPublica(registro.noticia) : null,
          fuentes: registro?.fuentes ?? [],
          guardada: registro?.guardada ?? false,
        });
      } catch {
        enviar({ paso: "error", texto: "Algo falló al buscar o generar. Prueba de nuevo en un momento." });
      } finally {
        enCurso = false;
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
