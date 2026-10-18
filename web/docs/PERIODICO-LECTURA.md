# Lectura enriquecida del periódico

## Uso

`/noticia/[id]` abre una lectura completa, no un generador de ejercicios.
El formato se adapta al género detectado: crónica/línea de tiempo,
opinión/pancarta, informativa/pirámide, datos/cifras, entrevista/diálogo
y comparada/dos fuentes. Los párrafos originales siguen disponibles;
los extractos y ayudas no los reemplazan.

- **Lectura**: presentación enriquecida, entidades, ficha 5W y visuales
  cuando hay evidencia en el texto. El glosario puede estar vacío.
- **Texto original**: conserva los fragmentos y su atribución.
- **Comprensión**: reutiliza `NoticiaFlow`, sus preguntas y su avance local.
  Cambiar de vista no crea respuestas ni modifica resultados.
- **Escuchar**: usa síntesis de voz del navegador, solo al activarla.
  El resaltado sigue eventos de palabras reales; no simula tiempos.
  La disponibilidad de voz y sincronización depende del navegador.
  No utiliza el micrófono.

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

La integración no modifica `NoticiaFlow`. Para retirarla, restaurar la
página de noticia y la configuración Next/alias anteriores, y retirar
los nuevos componentes `Lectura*`, helpers de lectura y esta documentación.
El microservicio puede seguir usándose de forma independiente.

## Compatibilidad del motor compartido

Los imports relativos TypeScript del servicio usan `.ts`. TypeScript >=5.7
reescribe esas extensiones a `.js` al compilar el servicio para Node ESM
(`rewriteRelativeImportExtensions`). El web usa `allowImportingTsExtensions`
con `noEmit`. Así el mismo código funciona con Turbopack y como microservicio.

## Estado de verificación — 18 de octubre de 2026

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