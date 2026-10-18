# Lectura enriquecida del periódico

## Uso

`/noticia/[id]` abre el texto original en una columna, con sus titulares y
fuentes. El artículo permanece visible y la metodología pedagógica aparece
debajo, sin cambiar entre vistas excluyentes. No muestra glosario, ficha 5W
ni insights antes de solicitarlos, aunque ya exista avance de comprensión.

- **Lectura**: texto fiel, siempre presente, sin anotaciones ni reorganización.
- **Metodología de lectura**: debajo del artículo, reutiliza `NoticiaFlow`,
  sus preguntas y su avance local. No duplica la cabecera de la noticia.
- **Volver al texto**: enfoca y desplaza al titular del artículo original,
  pausando la metodología hasta pulsar **Retomar metodología**. No abre ayudas.
  También se ofrece tras una elección incorrecta o una explicación evaluada
  aún no lograda; no ante una predicción ni un fallo del evaluador.
- **Insights de esta lectura**: pestaña elevada en una franja con espacio
  propio tras el artículo. No se fija encima del texto, tampoco en móvil.
  Abre una sección no modal entre el original y la metodología, sin fondo
  oscuro, bloqueo de scroll, columna lateral ni superposición. Sólo contiene
  ayudas: momentos clave para crónica, tesis y argumentos para opinión,
  pistas de jerarquía para informativa, cifras para datos, citas de voces
  para entrevista y puntos para contrastar en una comparada. No vuelve a
  imprimir los bloques ni los titulares de la noticia.
- **Ayudas breves y verificables**: cada cita muestra un extracto literal de
  como máximo 220 caracteres, incluido el signo de recorte; los insights por
  género limitan sus entradas (tres momentos, argumentos, voces o puntos;
  cuatro cifras destacadas). Las 5W, el glosario, las entidades y los visuales
  son complementos; la ausencia de datos se indica, no se inventa. En una
  comparada, una entidad compartida se amplía a un pasaje contextual literal
  de cada fuente, no se presenta el nombre repetido como contraste. Si faltan
  dos pasajes informativos o el texto es idéntico, aparece el fallback.
- **Ver en el texto**: las referencias llevan a anclas únicas de la cabecera
  o del fragmento en el artículo original. Cierran los apoyos y pausan la
  metodología para releer; no guardan una segunda copia del artículo.
- **Cerrar insights** o Escape dentro de las ayudas cierran la sección y
  devuelven el foco a la pestaña, sin encerrar el foco ni bloquear la lectura.
  Si no hay apoyos, el mensaje aparece sólo después de pedirlos.
- **Escuchar**: control opcional junto al artículo original; usa síntesis de
  voz del navegador sólo al activarlo, no el micrófono. Pausa la metodología
  para evitar que la narración coincida con la captura de voz. En español,
  el resaltado sigue límites reales de palabras; no simula tiempos. Las citas
  y la voz de esta función conservan el original en español. La disponibilidad
  de voz y sincronización depende del navegador.

Abrir insights o volver al artículo desmonta la metodología: no deja un
micrófono ni una petición de evaluación activos en contenido oculto.
Abrir insights también detiene una narración anterior; cerrarlos nunca la
reinicia. Al cerrar se retoma la metodología si no estaba pausada por una
relectura o por la escucha original.

Las elecciones conservan su
avance local; el borrador y los intentos evaluados de la explicación se
conservan sólo en memoria mientras esa noticia siga abierta. No se guardan
nuevos textos sensibles en localStorage. Cambiar de noticia o recargar
restablece la primera lectura simple y descarta ese borrador en memoria.
La sección «Cómo se preparó esta lectura» describe la procedencia de las
ayudas; no sustituye la metodología pedagógica que acompaña las preguntas.

## Servicio opcional

Sin configuración, el servidor reutiliza el motor determinista de
`services/reader-enricher` con `llm: null`, sin llamadas a IA.
Para usar el microservicio HTTP, configurar **solo en el servidor web**:

```dotenv
READER_ENRICHER_URL=http://localhost:8787
READER_ENRICHER_TOKEN=el-mismo-SERVICE_TOKEN-del-servicio
```

No usar prefijos `NEXT_PUBLIC_`. La clave del proveedor se configura
exclusivamente en el microservicio, no en el navegador.
Si falla el servicio, la lectura usa el motor local; si tampoco puede
enriquecerse, muestra el original y mantiene disponible Comprensión.

Solo se envían metadatos de la noticia y fragmentos del artículo.
No se envían preguntas, respuestas del lector ni criterios privados.
La respuesta HTTP se valida por versión, estructura, layout y texto fuente
antes de renderizarse; los enlaces de fuentes se limitan a HTTP(S).

## Desarrollo

Ejecutar desde la raíz del checkout del periódico:

```powershell
npm ci --prefix web
npm ci --prefix services/reader-enricher
npm run dev --prefix web -- --port 3107
npm test --prefix web
npm test --prefix services/reader-enricher
npm run build --prefix web
```

El build web necesita incluir archivos fuera de `web`: conservar
`services/reader-enricher` y permitir archivos externos al directorio raíz
en la configuración de despliegue. `next.config.ts` limita el root de
Turbopack y de los traces a la raíz de este repositorio.

## Límite de rollback

`NoticiaFlow` acepta callbacks opcionales de relectura y un snapshot de
explicación en memoria; sin ellos mantiene el flujo independiente. Para retirar la integración, restaurar la
página de noticia y la configuración Next/alias anteriores, y retirar
los nuevos componentes `Lectura*`, helpers de lectura y esta documentación.
El microservicio puede seguir usándose de forma independiente.

## Compatibilidad del motor compartido

Los imports relativos TypeScript del servicio usan `.ts`. TypeScript >=5.7
reescribe esas extensiones a `.js` al compilar el servicio para Node ESM
(`rewriteRelativeImportExtensions`). El web usa `allowImportingTsExtensions`
con `noEmit`. Así el mismo código funciona con Turbopack y como microservicio.

## Verificación de la integración previa — 18 de octubre de 2026

- Web: **679/679 pruebas**, 43 suites (baseline 637; 30 nuevas de integración
  y 12 de UI), TypeScript, ESLint y `git diff --check` correctos.
- Servicio: **83/83 pruebas**, 10 suites, build, typecheck e import/ejecución
  real de `dist/enrich.js` correctos después del cambio de imports.
- Build web estándar con Turbopack correcto, 22 entradas.
- HTTP local: health 200, sin bearer 401, seis géneros/layouts 200 sin IA.
  Web con motor local y web con URL del servicio devuelven 200; una consulta
  posterior confirmó `X-Cache: hit` para el artículo solicitado por el web.
  El token de servicio no apareció en el HTML servido.
- Navegador de producción: texto original, ficha de entidad y cierre con
  Escape, cambio Lectura/Comprensión con avance conservado, móvil de 390 px
  sin desbordamiento y popover dentro de pantalla. Se corrigió la navegación
  heredada que producía scrollWidth 426 px al no permitir saltos de línea.
- Karaoke probado con eventos de voz **simulados**: resalta la palabra del
  boundary, cancela al mostrar original e ignora eventos tardíos.
- Voz real (Windows, voces locales Microsoft Raul/Sabina es-MX): emiten
  eventos `word` reales; "Escuchar lectura" entró en modo sincronizado.
  No verificado: voces de macOS/Android/iOS ni audición humana.
- Servicio: peticiones concurrentes idénticas comparten una sola llamada al
  LLM (deduplicación en vuelo); 84/84 pruebas.
- LLM con clave real (OpenRouter, `anthropic/claude-haiku-5.5`): muestras en
  4,7–7,5 s con glosario, entidades y 5W citados; la guardia no descartó nada.
  Noticias reales superaban el antiguo límite de 9 s (`TimeoutError`), por eso
  el timeout pasa a 25 s (`OPENROUTER_TIMEOUT_MS`) y los fallos se registran
  con su causa. Flujo web verificado: la primera visita usa el motor local
  (límite web de 4 s), el servicio termina y guarda en caché, y la siguiente
  visita muestra la lectura con IA (≈300 ms).
- Nota de pruebas: en un panel de navegador oculto `requestAnimationFrame` se
  pausa y React no revela/hidrata la frontera `$~`; no es un fallo del lector.
- Sin errores JavaScript observados. Hubo una advertencia de CSS precargado
  de Next al navegar desde la portada; no una excepción del lector.
- Receipt-driven review: **disabled/unmanaged**. No se inició una revisión
  ni se fabricó una aprobación.

No se hizo commit, push ni despliegue. Las noticias del archivo no se
verificaron como información de actualidad. El checkout original del MVP
no recibió cambios de código de esta integración.
