import assert from 'node:assert/strict';
import { test } from 'node:test';
import { casos, casoPublico, buscarPregunta } from '../lib/casos.js';
import { calcularNivel, citaValida, guardia, normalizar, revisarCodigo, revisarTexto, validarCriterios } from '../lib/reglas.js';

const caso = casos['sputnik-1957'];

test('normalizar quita tildes, signos y mayúsculas', () => {
  assert.equal(normalizar('¡Ni un ÁPICE, dijo!'), 'ni un apice dijo');
});

test('la cita tiene que estar literal en la respuesta del alumno', () => {
  const texto = 'Creo que quería presumir, por eso habla de la sociedad socialista.';
  assert.ok(citaValida('habla de la sociedad socialista', texto));
  assert.ok(!citaValida('quería calmar a la gente', texto));
  assert.ok(!citaValida('', texto));
});

test('respuestas cortas o pidiendo la solución no gastan IA', () => {
  assert.equal(revisarTexto('no sé, dime tú'), 'pide');
  assert.equal(revisarTexto('porque sí'), 'corta');
  assert.equal(revisarTexto('Porque el gobierno quería mostrar que su sistema era mejor'), null);
});

test('la parte cerrada la corrige el código', () => {
  const p2 = buscarPregunta(caso, 'p2');
  assert.equal(revisarCodigo(p2, { eleccion: 1 }).ok, true);
  assert.equal(revisarCodigo(p2, { eleccion: 0 }).ok, false);
  const p3 = buscarPregunta(caso, 'p3');
  assert.equal(revisarCodigo(p3, { orden: [0, 1, 0] }).ok, true);
  assert.equal(revisarCodigo(p3, { orden: [0, 0, 0] }).ok, false);
  const p4 = buscarPregunta(caso, 'p4');
  assert.equal(revisarCodigo(p4, { toque: 8 }).ok, true);
  assert.equal(revisarCodigo(p4, { toque: 5 }).ok, false);
  assert.equal(revisarCodigo(buscarPregunta(caso, 'p1'), {}).ok, null);
});

test('un criterio sin cita literal se descarta y queda dudoso', () => {
  const crit = buscarPregunta(caso, 'p1').privado.criterios;
  const texto = 'Lanzaron un satélite y fue el primero.';
  const r = validarCriterios(
    [
      { id: 'hecho', cumple: true, cita: 'Lanzaron un satélite' },
      { id: 'primero', cumple: true, cita: 'el primero del mundo entero' },
      { id: 'inventado', cumple: true, cita: 'x' },
    ],
    crit,
    texto,
  );
  assert.deepEqual(r.map((c) => [c.id, c.cumple, c.dudoso]), [['hecho', true, false], ['primero', false, true]]);
});

test('la guardia bloquea retroalimentación que revela la respuesta', () => {
  const prohibido = ['tranquilizar', 'inofensivo'];
  assert.equal(guardia('¿Qué quería que sintiera la gente al escucharlo?', prohibido, 'lo dice pequeño'), true);
  assert.equal(guardia('Lo dijo para tranquilizar a la gente.', prohibido, 'lo dice pequeño'), false);
  // si el alumno ya lo dijo, repetirlo no es revelar
  assert.equal(guardia('Bien: dices que quería tranquilizar.', prohibido, 'quería tranquilizar a todos'), true);
  assert.equal(guardia('', prohibido, ''), false);
});

test('niveles: 2 si cumple todo, 1 si algo, 0 si nada', () => {
  const si = { cumple: true };
  const no = { cumple: false };
  assert.equal(calcularNivel([si, si], true), 2);
  assert.equal(calcularNivel([si, si], false), 1);
  assert.equal(calcularNivel([si, no], null), 1);
  assert.equal(calcularNivel([no, no], null), 0);
});

test('el caso público no filtra criterios, respuestas ni respuesta modelo', () => {
  const json = JSON.stringify(casoPublico(caso));
  for (const secreto of ['privado', 'respuesta_modelo', 'eleccion_correcta', 'orden_correcto', 'toques_correctos', 'criterios']) {
    assert.ok(!json.includes(secreto), secreto);
  }
});

test('el caso está completo y sus índices son válidos', () => {
  const preguntas = [...caso.pasos.filter((p) => p.tipo === 'pregunta'), caso.repaso];
  for (const p of preguntas) {
    assert.ok(p.privado.criterios.length > 0, p.id);
    for (const c of p.privado.criterios) assert.ok(c.repregunta && c.descripcion, `${p.id}.${c.id}`);
    assert.ok(p.pistas.length > 0, p.id);
    for (const f of p.fuentes) assert.ok(caso.fuentes[f], `${p.id} fuente ${f}`);
  }
  const p3 = buscarPregunta(caso, 'p3');
  assert.equal(p3.privado.orden_correcto.length, p3.orden.afirmaciones.length);
  const p4 = buscarPregunta(caso, 'p4');
  for (const t of p4.privado.toques_correctos) assert.ok(caso.fuentes.B.fragmentos[t], `toque ${t}`);
});
