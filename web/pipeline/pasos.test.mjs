import assert from 'node:assert/strict';
import { test } from 'node:test';
import { armarNoticia, citaLiteral, esNota, filtrarCandidatas, limpiarTexto, medioDe, mismoHecho, trataDeIA, validarGeneracion } from './pasos.mjs';

const textoA = 'Más del 50% de las empresas prevé reducir sus ofertas para perfiles junior, aunque sin recurrir a despidos directos. «La inteligencia artificial no está echando a nadie, pero sí está estrechando la puerta de entrada», explica Gloria Martínez.';
const textoB = 'El estudio del Observatorio del Talento Digital reunió 207 respuestas válidas de 19 sectores entre el 13 de julio y el 21 de septiembre.';

const generacionValida = () => ({
  apta: true,
  seccion: 'Trabajo',
  titular: 'La IA y el primer empleo de los jóvenes',
  bajada: 'Un titular fuerte y el estudio que hay detrás.',
  fragmento_a: { citas: ['Más del 50% de las empresas prevé reducir sus ofertas para perfiles junior', 'La inteligencia artificial no está echando a nadie'] },
  fragmento_b: { citas: ['reunió 207 respuestas válidas de 19 sectores'] },
  mirada_a: 'no está echando a nadie',
  mirada_b: '207 respuestas válidas',
  prediccion: { titulo: '¿De dónde sale el número?', opciones: ['De todas', 'De pocas', 'No sé'] },
  comprension: { titulo: '¿Qué prevén las empresas?', opciones: ['Despedir', 'Contratar menos juniors'], correcta: 1 },
  procedencia: { titulo: '¿Quién lo explica?', opciones: ['Una investigadora', 'La jefa de marketing de una empresa de IA'], correcta: 1 },
  variable: { tipo: 'dato_o_afirmacion', titulo: '¿El 50% tiene fuente?', opciones: ['Sí', 'No en este fragmento'], correcta: 1 },
  postura: { titulo: '¿La IA quita empleos a los jóvenes?', opciones: ['Sí', 'No', 'Depende'] },
  voz: {
    titulo: '¿Alcanza ese estudio para hablar de tu país?',
    criterios: [
      { id: 'limite', nombre: 'Límite', descripcion: 'Nota que son pocas empresas', repregunta: '¿Cuántas eran?' },
      { id: 'razon', nombre: 'Razón', descripcion: 'Explica qué haría falta', repregunta: '¿Qué dato te ayudaría?' },
    ],
    respuesta_modelo: 'No, son 207 de España.',
    prohibido: ['solo de españa'],
    pistas: ['¿De dónde son las empresas?'],
  },
});

test('limpia el Markdown y deja solo párrafos', () => {
  const t = limpiarTexto('# Título\n![img](x.png)\n[Inicio](/)\nEste es un párrafo largo con suficientes palabras para contar como contenido real de la nota.');
  assert.equal(t, 'Este es un párrafo largo con suficientes palabras para contar como contenido real de la nota.');
});

test('filtra redes, repetidas y temas sensibles para menores', () => {
  const r = filtrarCandidatas(
    [
      { url: 'https://www.facebook.com/x', title: 'ChatGPT anuncia nuevas funciones para todos', content: '' },
      { url: 'https://diario.com/a', title: 'ChatGPT anuncia nuevas funciones para todos', content: '' },
      { url: 'https://diario.com/a', title: 'ChatGPT anuncia nuevas funciones para todos', content: '' },
      { url: 'https://otro.com/b', title: 'Demanda dice que el chatbot incitó al suicidio de un joven', content: '' },
      { url: 'https://otro.com/c', title: 'Breve', content: '' },
    ],
    new Set(),
  );
  assert.deepEqual(r.map((x) => x.url), ['https://diario.com/a']);
});

test('solo acepta notas de la lista cerrada de medios', () => {
  assert.deepEqual(medioDe('https://www.bbc.com/mundo/articles/c64g12190082o'), { medio: 'BBC News Mundo', lista: 'A' });
  assert.equal(medioDe('https://www.bbc.com/news/articles/c64g12190082o'), null); // BBC en inglés
  assert.deepEqual(medioDe('https://computerhoy.20minutos.es/tecnologia/x'), { medio: '20minutos', lista: 'A' });
  assert.equal(medioDe('https://www.infobae.com/tecno/2026/10/17/x/').lista, 'B');
  assert.equal(medioDe('https://diariosocialista.net/x'), null);
  assert.equal(medioDe('https://notelpais.com/x'), null);
  assert.ok(esNota('https://elpais.com/tecnologia/2026-10-13/asi-es-homeview.html'));
  assert.ok(!esNota('https://www.eltiempo.com/opinion/columnistas/colombia-frente-a-la-ia-3594354'));
  assert.ok(!esNota('https://efecomunica.efe.com/axi-lanza-una-integracion'));
  assert.ok(!esNota('https://www.dw.com/es/inteligencia-artificial-ia/t-63771882/page-1'));
});

test('detecta si dos titulares hablan del mismo hecho', () => {
  assert.ok(mismoHecho('Ocho estados demandan a OpenAI por daños a niños', 'Estados demandan a OpenAI, dicen que su chatbot daña a niños'));
  assert.ok(!mismoHecho('ChatGPT empieza a mostrar anuncios', 'Gobierno de México capacita a jóvenes en IA'));
});

test('las citas tienen que estar literal en la nota, también con (…)', () => {
  assert.ok(citaLiteral('«La inteligencia artificial no está echando a nadie»', textoA));
  assert.ok(citaLiteral('Más del 50% de las empresas prevé reducir (…) no está echando a nadie', textoA));
  assert.ok(!citaLiteral('La IA está echando a todos los jóvenes', textoA));
});

test('valida la generación y rechaza citas inventadas', () => {
  assert.deepEqual(validarGeneracion(generacionValida(), textoA, textoB), []);
  const mala = generacionValida();
  mala.fragmento_b.citas = ['reunió 5.000 respuestas'];
  mala.comprension.correcta = 7;
  const errores = validarGeneracion(mala, textoA, textoB);
  assert.ok(errores.some((x) => x.includes('fragmento_b.citas[0]')));
  assert.ok(errores.some((x) => x.includes('comprension')));
  const fuera = generacionValida();
  fuera.variable = { tipo: 'dato_o_afirmacion', titulo: '¿Qué dato comprobarías?', opciones: ['El 94% de tareas', 'La fecha'], correcta: 0 };
  assert.ok(validarGeneracion(fuera, textoA, textoB).some((x) => x.includes('«94»')));
  assert.deepEqual(validarGeneracion({ apta: false, motivo_no_apta: 'tema violento' }, textoA, textoB), ['No apta: tema violento']);
});

test('arma siempre la misma estructura de 8 pasos con una sola pregunta de voz', () => {
  const fuente = { medio: 'Infobae', fecha: '17 oct 2026', titular: 'X', url: 'https://infobae.com/x' };
  const n = armarNoticia('empleo', generacionValida(), fuente, { ...fuente, medio: 'El Ecosistema Startup' });
  assert.deepEqual(
    n.pasos.map((p) => p.tipo),
    ['opciones', 'fragmento', 'opciones', 'opciones', 'opciones', 'opciones', 'opciones', 'fragmento', 'opciones', 'voz'],
  );
  assert.equal(n.pasos.filter((p) => p.tipo === 'voz').length, 1);
  assert.equal(n.pasos[7].medio, 'El Ecosistema Startup');
  assert.equal(n.pasos.at(-1).privado.criterios.length, 2);
});

test('solo entran noticias que tratan de IA', () => {
  assert.ok(trataDeIA('OpenAI abre la publicidad dentro de ChatGPT', 'La empresa de inteligencia artificial anunció...'));
  assert.ok(!trataDeIA('Autoridades cierran 240 sitios web de estafas con criptomonedas', 'La policía desarticuló una red que usaba páginas falsas.'));
  assert.ok(!trataDeIA('Gobierno revisa hojas de vida del Banco de Talentos', 'Más de 140 personas contratadas. Vía libre para la revisión.'));
});
