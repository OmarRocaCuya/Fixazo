import { appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ponytail: sin base de datos todavía. Va a los logs del servidor y a un archivo temporal;
// en Vercel /tmp se borra entre instancias, así que pasar a Supabase o Neon para la tracción real.
const ARCHIVO = join(tmpdir(), 'fixazo-registro.jsonl');

export async function registrar(tipo, datos) {
  const linea = JSON.stringify({ tipo, t: new Date().toISOString(), ...datos });
  console.log(linea);
  await appendFile(ARCHIVO, linea + '\n').catch(() => {});
}
