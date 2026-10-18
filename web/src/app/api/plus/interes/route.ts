// Interés en Fixazo Plus: un evento anónimo en los logs del servidor (sin IP, sin datos personales).
// ponytail: logs del hosting como contador; pasar a una base de datos si se abre la lista de espera.
export function POST(request: Request) {
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(request.url).host) return Response.json({ ok: false }, { status: 403 });
  console.log(JSON.stringify({ evento: "plus-interes", t: new Date().toISOString() }));
  return Response.json({ ok: true });
}
