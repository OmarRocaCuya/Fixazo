const app = document.getElementById('app');
const progreso = document.getElementById('progreso');
const CASO_ID = 'sputnik-1957';
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const NIVELES = ['Básico', 'Emergente', 'Competente'];
const MAX_INTENTOS = 2;

// localStorage solo para comodidades del alumno; la app funciona igual sin él.
function guardado(clave, valor) {
  try {
    if (valor === undefined) return JSON.parse(localStorage.getItem(clave));
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    return null;
  }
}

const alumno = guardado('fixazo-alumno') ?? Math.random().toString(36).slice(2, 10);
guardado('fixazo-alumno', alumno);

// Registro de interacciones: se envía por lotes.
let cola = [];
const evento = (tipo, datos) => cola.push({ tipo, datos, t: Date.now() });
function enviarEventos() {
  if (!cola.length) return;
  const body = JSON.stringify({ alumno, casoId: CASO_ID, eventos: cola });
  cola = [];
  fetch('/api/eventos', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    evento('pestana_oculta');
    enviarEventos();
  }
});

// Constructor de nodos: todo texto entra como texto, nunca como HTML.
function el(tag, props = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h instanceof Node ? h : String(h));
  return n;
}

let caso;
let pasos = [];
let i = 0;
const predicciones = {};
const resultados = {};

async function iniciar() {
  try {
    const r = await fetch(`/api/caso?id=${CASO_ID}`);
    if (!r.ok) throw new Error(r.status);
    caso = await r.json();
  } catch {
    app.replaceChildren(el('p', {}, 'No pudimos cargar el caso. Revisa tu conexión y recarga la página.'));
    return;
  }
  const rep = guardado('fixazo-repaso');
  const forzar = new URLSearchParams(location.search).has('repaso');
  const toca = forzar || (rep?.casoId === CASO_ID && Date.now() >= rep.fecha);
  pasos = [{ tipo: 'intro', repaso: toca }, ...(toca ? [caso.repaso] : []), ...caso.pasos];
  mostrar(0);
}

const nombreEtapa = (p) => (p.tipo === 'ficha' || p.tipo === 'fuente' ? `Fuente ${p.fuente}` : p.tipo === 'resumen' ? 'Resumen' : p.habilidad);

// Barra de etapas con nombre (como un índice que avanza).
function pintarProgreso() {
  const p = pasos[i];
  if (p.tipo === 'intro') return progreso.replaceChildren();
  const total = pasos.length - 1;
  progreso.replaceChildren(
    el('div', { class: 'segmentos', 'aria-hidden': 'true' }, pasos.slice(1).map((_, k) => el('span', { class: k < i - 1 ? 'hecho' : k === i - 1 ? 'actual' : '' }))),
    el('div', { class: 'etapa' }, `${i} de ${total} · ${nombreEtapa(p)}`),
  );
}

function mostrar(n) {
  i = n;
  teclaVoz = null;
  estadoVoz('quieto');
  const p = pasos[i];
  pintarProgreso();
  evento('paso', { tipo: p.tipo, id: p.id ?? p.fuente ?? null });
  enviarEventos();
  const vista = { intro, ficha, fuente, pregunta, resumen }[p.tipo](p);
  app.replaceChildren(vista);
  enfocar();
}
const siguiente = () => mostrar(i + 1);
function enfocar() {
  window.scrollTo(0, 0);
  app.querySelector('h1, h2')?.focus?.({ preventScroll: true });
}

function intro(p) {
  return el('section', {},
    el('p', { class: 'eyebrow' }, caso.titulo),
    el('h1', { tabindex: '-1' }, caso.gancho),
    el('p', {}, caso.contexto),
    el('p', { class: 'muted' }, 'Vas a leer dos fuentes reales, predecir qué dicen y explicar con tu voz lo que piensas. Unos 10 minutos.'),
    p.repaso && el('p', { class: 'prediccion' }, 'Antes de empezar, una pregunta de repaso del caso anterior.'),
    el('div', { class: 'acciones' }, el('button', { class: 'btn primario', onclick: siguiente }, 'Empezar')),
  );
}

function tarjetaFicha(f) {
  const d = caso.fuentes[f];
  return el('div', { class: `tarjeta ficha ${f}` },
    el('div', { class: 'autor' }, d.autor),
    el('div', { class: 'muted' }, `${d.medio} · ${d.fecha}`),
    d.nota && el('div', { class: 'muted' }, d.nota),
  );
}

const referencia = (d) =>
  el('p', { class: 'ref' }, `${d.referencia} Traducción de Fixazo. `, el('a', { href: d.url, target: '_blank', rel: 'noopener' }, 'Ver original'));

// Fuente plegable para consultar mientras responde.
function fuenteConsulta(f, abierta) {
  const d = caso.fuentes[f];
  const det = el('details', { class: `tarjeta fuente ${f}`, open: abierta }, el('summary', {}, `Fuente ${f}: ${d.autor.split(',')[0]}`), el('p', { class: 'texto' }, d.texto), referencia(d));
  det.addEventListener('toggle', () => evento('ver_fuente', { fuente: f, abierta: det.open }));
  return det;
}

function ficha(p) {
  const pr = p.prediccion;
  return el('section', {},
    el('p', { class: 'eyebrow' }, 'Antes de leer'),
    tarjetaFicha(p.fuente),
    el('h2', { tabindex: '-1' }, pr.pregunta),
    el('div', { class: 'opciones' },
      pr.opciones.map((o) =>
        el('button', {
          class: 'opcion',
          onclick: () => {
            predicciones[p.fuente] = o;
            evento('prediccion', { id: pr.id, opcion: o });
            siguiente();
          },
        }, o),
      ),
    ),
  );
}

// Lectura con un párrafo en foco a la vez; la predicción vuelve al final.
function fuente(p) {
  const d = caso.fuentes[p.fuente];
  const partes = d.texto.split('(…)').map((s) => s.trim()).filter(Boolean);
  let k = 0;
  const parrafos = partes.map((t) => el('p', { class: 'parrafo' }, t));
  const boton = el('button', { class: 'btn primario' });
  const cierre = el('div', { 'aria-live': 'polite' });
  const pintar = () => {
    parrafos.forEach((n, j) => (n.className = `parrafo ${j === k ? 'actual' : j < k ? 'leido' : 'pendiente'}`));
    const ultimo = k === partes.length - 1;
    boton.textContent = ultimo ? 'Ya lo leí' : 'Sigue';
    if (ultimo && predicciones[p.fuente]) cierre.replaceChildren(el('p', { class: 'prediccion' }, `Tú predijiste: «${predicciones[p.fuente]}». ¿Se parece a lo que leíste?`));
  };
  boton.addEventListener('click', () => {
    if (k < partes.length - 1) {
      k++;
      pintar();
      parrafos[k].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } else siguiente();
  });
  pintar();
  return el('section', {},
    el('p', { class: 'eyebrow' }, `Fuente ${p.fuente} · ${d.fecha}`),
    el('h2', { tabindex: '-1', class: 'autor-fuente' }, d.autor),
    el('div', { class: `lectura ${p.fuente}` }, parrafos, el('p', { class: 'ref' }, partes.length > 1 ? '(…) indica texto omitido. ' : '', referencia(d))),
    cierre,
    el('div', { class: 'acciones fijas' }, boton),
  );
}

// Cada pregunta en dos pantallas: 1) elegir (si hay parte cerrada) y 2) explicar por voz.
function pregunta(p) {
  const r = { eleccion: null, orden: p.orden ? p.orden.afirmaciones.map(() => null) : null, toque: null };
  const raiz = el('section');
  const tieneCerrada = Boolean(p.eleccion || p.orden || p.tocar);
  const inicio = Date.now();
  let intento = 0;
  let pistas = 0;
  let pego = false;

  // Pantalla 1: elegir.
  const continuar = el('button', { class: 'btn primario', disabled: true, onclick: () => explicar() }, 'Continuar');
  const cerradaLista = () =>
    (!p.eleccion || r.eleccion != null) && (!p.orden || r.orden.every((x) => x != null)) && (!p.tocar || r.toque != null);
  const marcar = (botones, k) => botones.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)));
  const cambio = (previo, nuevo) => previo != null && previo !== nuevo && evento('cambio_opcion', { pregunta: p.id });
  const listaCerrada = () => (continuar.disabled = !cerradaLista());
  const cerrada = [];
  if (p.eleccion) {
    const botones = p.eleccion.opciones.map((o, k) =>
      el('button', { class: 'opcion', 'aria-pressed': 'false', onclick: () => { cambio(r.eleccion, k); r.eleccion = k; marcar(botones, k); listaCerrada(); } }, o),
    );
    cerrada.push(el('h2', { tabindex: '-1' }, p.eleccion.pregunta), el('div', { class: 'opciones' }, botones));
  }
  if (p.orden) {
    cerrada.push(el('h2', { tabindex: '-1' }, p.orden.instruccion));
    cerrada.push(
      el('div', { class: 'orden' },
        p.orden.afirmaciones.map((a, k) => {
          const grupo = p.orden.grupos.map((g, j) =>
            el('button', { class: 'opcion', 'aria-pressed': 'false', onclick: () => { cambio(r.orden[k], j); r.orden[k] = j; marcar(grupo, j); listaCerrada(); } }, g),
          );
          return el('div', { class: 'fila' }, el('div', {}, a), el('div', { class: 'grupo' }, grupo));
        }),
      ),
    );
  }
  if (p.tocar) {
    const d = caso.fuentes[p.tocar.fuente];
    const frags = d.fragmentos.map((f, k) =>
      el('button', { class: 'frag', 'aria-pressed': 'false', onclick: () => { cambio(r.toque, k); r.toque = k; marcar(frags, k); listaCerrada(); } }, f),
    );
    cerrada.push(el('h2', { tabindex: '-1' }, p.tocar.instruccion), el('div', { class: `lectura ${p.tocar.fuente}` }, el('p', { class: 'parrafo actual' }, frags)));
  }
  const consulta = (abierta) => (p.fuentes ?? []).filter((f) => f !== p.tocar?.fuente).map((f) => fuenteConsulta(f, abierta));
  const pantallaCerrada = () =>
    el('div', {}, el('p', { class: 'eyebrow' }, p.habilidad), consulta(matchMedia('(min-width: 1024px)').matches), cerrada, el('div', { class: 'acciones' }, continuar));

  // Pantalla 2: explicar por voz (o escribiendo).
  const enviar = el('button', { class: 'btn primario', hidden: true }, 'Enviar');
  const pedirPista = el('button', { class: 'btn', disabled: !p.pistas?.length }, 'Pedir pista');
  const volver = el('button', { class: 'btn', hidden: true, onclick: () => mostrarCerrada() }, 'Cambiar mi elección');
  const seguir = el('button', { class: 'btn primario', hidden: true, onclick: siguiente }, 'Seguir');
  const zonaRetro = el('div', { 'aria-live': 'polite' });
  const zonaPista = el('div');
  const aviso = el('p', { class: 'aviso' });
  const texto = el('textarea', { id: `r-${p.id}`, class: 'transcripcion', rows: '3', 'aria-label': 'Tu respuesta', placeholder: SR ? 'Lo que digas aparece aquí.' : 'Escribe tu respuesta aquí…' });
  let terminado = false;
  const actualizar = () => {
    enviar.hidden = terminado || !texto.value.trim() || voz.escuchando();
    enviar.disabled = intento >= MAX_INTENTOS;
  };
  texto.addEventListener('input', actualizar);
  texto.addEventListener('paste', () => {
    pego = true;
    evento('pegar', { pregunta: p.id });
    aviso.textContent = 'Mejor explícalo con tus propias palabras: es lo que te ayuda a aprender.';
  });
  pedirPista.addEventListener('click', () => {
    const t = p.pistas[pistas++];
    evento('pista', { pregunta: p.id, n: pistas });
    zonaPista.replaceChildren(el('p', { class: 'retro' }, `Pista: ${t}`));
    if (pistas >= p.pistas.length) pedirPista.disabled = true;
  });

  async function mandar() {
    if (!texto.value.trim() || intento >= MAX_INTENTOS) return;
    intento++;
    enviar.hidden = true;
    volver.hidden = true;
    evento('respuesta', { pregunta: p.id, intento, tiempoMs: Date.now() - inicio, largo: texto.value.length, pistas, pego });
    zonaRetro.replaceChildren(el('p', { class: 'esperando' }, 'Leyendo tu respuesta…'));
    estadoVoz('pensando');
    voz.estado('Leyendo tu respuesta…');
    let d;
    try {
      const res = await fetch('/api/responder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ alumno, casoId: CASO_ID, preguntaId: p.id, intento, respuesta: { ...r, texto: texto.value } }),
      });
      if (!res.ok) throw new Error(res.status);
      d = await res.json();
    } catch {
      d = { retro: `Sigamos pensando. ${p.pistas?.[0] ?? ''}`, listo: false, nivel: null, criterios: [] };
    }
    estadoVoz('quieto');
    if (d.nivel != null) {
      const previo = resultados[p.id];
      if (!previo || d.nivel >= previo.nivel) resultados[p.id] = { habilidad: p.habilidad, nivel: d.nivel, criterios: d.criterios };
    }
    zonaRetro.replaceChildren(el('p', { class: `retro${d.listo ? ' bien' : ''}` }, d.retro));
    if (d.nivel == null) intento--; // respuesta muy corta o pidiendo la solución: no gasta intento
    if (d.codigoOk === false && intento < MAX_INTENTOS) volver.hidden = false;
    if (d.listo || intento >= MAX_INTENTOS) {
      terminado = true;
      pedirPista.hidden = true;
      volver.hidden = true;
      voz.ocultar();
      seguir.hidden = false;
      seguir.focus({ preventScroll: true });
      if (!d.listo) zonaRetro.append(el('p', { class: 'aviso' }, 'Seguimos. Esto lo repasamos más adelante.'));
    } else {
      voz.estado('Toca para responder otra vez');
    }
    actualizar();
  }
  enviar.addEventListener('click', mandar);
  const voz = microfono({ texto, aviso, preguntaId: p.id, alTerminar: mandar, alCambiar: actualizar });

  const resumenEleccion = () => {
    if (p.eleccion) return `Elegiste: «${p.eleccion.opciones[r.eleccion]}»`;
    if (p.tocar) return `Tocaste: «${caso.fuentes[p.tocar.fuente].fragmentos[r.toque].trim()}»`;
    if (p.orden) return 'Ya clasificaste las afirmaciones.';
    return null;
  };
  const pantallaExplicar = () =>
    el('div', { class: 'explicar' },
      el('p', { class: 'eyebrow' }, p.habilidad),
      tieneCerrada && el('p', { class: 'eleccion-hecha' }, resumenEleccion()),
      el('h2', { tabindex: '-1' }, p.pregunta),
      texto,
      aviso,
      zonaPista,
      zonaRetro,
      el('div', { class: 'acciones' }, enviar, pedirPista, volver, seguir),
      consulta(false),
      voz.nodo,
    );

  function mostrarCerrada() {
    voz.parar();
    teclaVoz = null;
    raiz.replaceChildren(pantallaCerrada());
    enfocar();
  }
  function explicar() {
    raiz.replaceChildren(pantallaExplicar());
    teclaVoz = () => !terminado && voz.alternar();
    actualizar();
    enfocar();
  }
  tieneCerrada ? raiz.append(pantallaCerrada()) : explicar();
  return raiz;
}

// --- Voz -------------------------------------------------------------------
// Tocar para empezar y tocar para terminar. El navegador convierte la voz en texto (Web Speech API);
// la IA solo recibe texto. Mientras escucha, los bordes de la pantalla brillan y siguen el volumen.

const raizDoc = document.documentElement;
let objetivo = 0;
let actual = 0;
let suavizando = false;
// ponytail: suavizado exponencial simple; ajustar 0.10 (subida) y 0.035 (bajada) si se siente lento o nervioso.
function suavizar() {
  actual += (objetivo - actual) * (objetivo > actual ? 0.1 : 0.035);
  raizDoc.style.setProperty('--nivel', actual.toFixed(3));
  if (objetivo > 0 || actual > 0.002) requestAnimationFrame(suavizar);
  else suavizando = false;
}
function fijarNivel(v) {
  objetivo = Math.min(1, Math.max(0, v));
  if (!suavizando) {
    suavizando = true;
    requestAnimationFrame(suavizar);
  }
}
function estadoVoz(e) {
  document.body.classList.toggle('escuchando', e === 'escuchando');
  document.body.classList.toggle('pensando', e === 'pensando');
  if (e === 'pensando') fijarNivel(0.3);
  if (e === 'quieto') fijarNivel(0);
}

let volumen = null;
async function medirVolumen() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const datos = new Uint8Array(an.fftSize);
    volumen = { stream, ctx, raf: 0 };
    const loop = () => {
      an.getByteTimeDomainData(datos);
      let s = 0;
      for (const x of datos) s += ((x - 128) / 128) ** 2;
      fijarNivel(Math.sqrt(s / datos.length) * 4);
      volumen.raf = requestAnimationFrame(loop);
    };
    loop();
  } catch {
    fijarNivel(0.4); // sin medidor: el brillo respira igual
  }
}
function pararVolumen() {
  if (volumen) {
    cancelAnimationFrame(volumen.raf);
    volumen.stream.getTracks().forEach((t) => t.stop());
    volumen.ctx.close();
    volumen = null;
  }
}

// Barra espaciadora en PC: activa el micrófono de la pantalla actual.
let teclaVoz = null;
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !teclaVoz || e.repeat) return;
  if (e.target.closest?.('textarea, input, button, summary, a')) return;
  e.preventDefault();
  teclaVoz();
});

function microfono({ texto, aviso, preguntaId, alTerminar, alCambiar }) {
  const estado = el('p', { class: 'estado-voz', 'aria-live': 'polite' });
  const escribir = el('button', { class: 'escribir', type: 'button', onclick: () => texto.focus() }, 'o escribe tu respuesta');
  const ico = el('span', { class: 'ico', 'aria-hidden': 'true' });
  ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'; // ícono fijo, sin datos del usuario
  const boton = el('button', { class: 'mic-grande', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Empezar a hablar' }, ico, el('span', { class: 'stop', 'aria-hidden': 'true' }));
  boton.addEventListener('click', () => (rec ? terminar() : empezar()));
  const nodo = el('div', { class: 'zona-mic' }, estado, boton, escribir);
  let rec = null;
  let base = '';
  let inicio = 0;
  let enviarAlTerminar = false;

  const fijarEstado = (t) => (estado.textContent = t);
  if (!SR) {
    boton.hidden = true;
    escribir.hidden = true;
    fijarEstado('Tu navegador no permite dictar: escribe tu respuesta. Para hablar, usa Chrome o Edge.');
  } else fijarEstado('Toca para hablar');

  function empezar() {
    if (rec || !SR) return;
    rec = new SR();
    rec.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-MX';
    rec.interimResults = true;
    rec.continuous = true;
    base = texto.value.trim() ? `${texto.value.trim()} ` : '';
    rec.onresult = (ev) => {
      let t = '';
      for (const res of ev.results) t += res[0].transcript;
      texto.value = base + t;
      alCambiar();
    };
    rec.onerror = (ev) => {
      enviarAlTerminar = false;
      aviso.textContent =
        ev.error === 'not-allowed' ? 'Necesitamos permiso para usar el micrófono. También puedes escribir.' : 'No te escuché bien. Toca para intentar de nuevo o escribe.';
    };
    rec.onend = () => {
      rec = null;
      pararVolumen();
      boton.classList.remove('activo');
      boton.setAttribute('aria-pressed', 'false');
      boton.setAttribute('aria-label', 'Empezar a hablar');
      evento('voz', { pregunta: preguntaId, duracionMs: Date.now() - inicio });
      if (enviarAlTerminar && texto.value.trim()) alTerminar();
      else {
        estadoVoz('quieto');
        fijarEstado('Toca para hablar');
        alCambiar();
      }
    };
    inicio = Date.now();
    enviarAlTerminar = true;
    aviso.textContent = '';
    rec.start();
    boton.classList.add('activo');
    boton.setAttribute('aria-pressed', 'true');
    boton.setAttribute('aria-label', 'Terminar de hablar');
    fijarEstado('Te escucho… toca para terminar');
    estadoVoz('escuchando');
    medirVolumen();
    alCambiar();
  }
  function terminar() {
    rec?.stop();
  }
  return {
    nodo,
    escuchando: () => Boolean(rec),
    alternar: () => (rec ? terminar() : empezar()),
    estado: fijarEstado,
    parar: () => {
      enviarAlTerminar = false;
      rec?.abort();
    },
    ocultar: () => (nodo.hidden = true),
  };
}

function resumen() {
  evento('fin', { resultados: Object.fromEntries(Object.entries(resultados).map(([k, v]) => [k, v.nivel])) });
  enviarEventos();
  const hizoRepaso = pasos.some((p) => p.id === 'repaso');
  guardado('fixazo-repaso', hizoRepaso ? null : { casoId: CASO_ID, fecha: Date.now() + 2 * 864e5 });
  const filas = pasos
    .filter((p) => p.tipo === 'pregunta')
    .map((p) => {
      const res = resultados[p.id];
      const nivel = res?.nivel;
      const cita = res?.criterios?.find((c) => c.cumple)?.cita;
      return el('div', { class: 'tarjeta habilidad' },
        el('div', { class: 'nombre' }, el('span', {}, p.habilidad), el('span', { class: 'muted' }, nivel == null ? 'Sin calificar' : NIVELES[nivel])),
        el('div', { class: 'barra-nivel', role: 'img', 'aria-label': nivel == null ? 'Sin calificar' : `${NIVELES[nivel]}, ${nivel + 1} de 3` },
          el('span', { style: `width:${nivel == null ? 0 : ((nivel + 1) / 3) * 100}%` }),
        ),
        cita && el('p', { class: 'cita' }, `«${cita}», lo dijiste tú.`),
      );
    });
  return el('section', {},
    el('p', { class: 'eyebrow' }, 'Terminaste'),
    el('h1', { tabindex: '-1' }, 'Así leíste como historiador'),
    el('p', { class: 'muted' }, 'Cada barra es una habilidad. No es una nota: muestra qué ya haces y qué practicar.'),
    el('div', { class: 'habilidades' }, filas),
    !hizoRepaso && el('p', { class: 'prediccion' }, 'En 2 días, cuando vuelvas, te haremos una pregunta de este caso para repasar.'),
    el('p', { class: 'ref muted' }, 'Fuentes originales: ', el('a', { href: caso.fuentes.A.url, target: '_blank', rel: 'noopener' }, 'TASS (NASA)'), ' · ', el('a', { href: caso.fuentes.B.url, target: '_blank', rel: 'noopener' }, 'Eisenhower (UCSB)')),
    el('div', { class: 'acciones' }, el('button', { class: 'btn', onclick: () => location.reload() }, 'Volver a empezar')),
  );
}

iniciar();
