import { casos, casoPublico } from '../lib/casos.js';

export function GET(request) {
  const id = new URL(request.url).searchParams.get('id') ?? 'sputnik-1957';
  const caso = casos[id];
  if (!caso) return Response.json({ error: 'El caso no existe' }, { status: 404 });
  return Response.json(casoPublico(caso));
}
