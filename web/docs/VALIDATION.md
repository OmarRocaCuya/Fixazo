# Verificación de la demo

## Estado más reciente: lectura con tiempos, voz MMS y diálogo local — 18 de octubre de 2026

**Publicado y comprobado en producción, además del backend aislado y el preview.** Los apartados históricos de abajo describen versiones anteriores, no las capacidades actuales de esta entrega.

### Fuentes, build y capacidades

- Frontend: `18939454ad570c5426bf388565bdc05ffa6496cf`; backend: `aa2fcb1967227a02c0feed8050293631e3b672c4`, en la rama `codex/nawinchay-voice-mvp`.
- Preview Vercel `dpl_6Hr9qp7oZ4nmGjc9TEMFH6Ru335Q`: estado `READY`; build Next/TypeScript correcto, **19 entradas**. El proyecto sigue usando **`web`** como raíz.
- Producción final: `dpl_HkiUh3s4N2xcz7oLrvZADYR9XJXm`, estado `READY`, alias https://nawinchay-voice-mvp.vercel.app. Proyecto exclusivo `nawinchay-voice-mvp`, raíz **`web`**, build Turbopack/TypeScript correcto y **19 entradas**. No se cambió el proyecto Vercel de Fixazo.
- Build real Docker Linux/CPU de `nawinchay-meta:aa2fcb1` correcto: `pip check` e importaciones offline de ASR nativo, VITS y Llama. Contenedor saludable con límite de **7 GiB/2 CPU**; no se cambió Fixazo ni el proxy global.
- **557 pruebas web**, ESLint, build local de producción y TypeScript correctos sobre el snapshot Git aislado; **125 pruebas Python con dobles de modelos** correctas. Las inferencias reales se enumeran por separado más abajo: no se presentan los dobles como pruebas de pesos reales. Los cambios ajenos en curso del checkout no se incluyeron en este despliegue.
- El `GET /api/reading` del preview devolvió `enabled=true`, timestamps disponibles y diálogo `local-llm-reading` listo. La caché MMS conserva una sola voz cargada: que solo una variante figure como `ready` es esperado, no prueba de disponibilidad simultánea de ambas voces.
- Auditoría npm de producción (`--omit=dev`): **0 avisos**. Se mantienen los cinco avisos altos de la cadena de desarrollo ESLint/braces, sin aplicar `--force`; no son cinco vulnerabilidades del runtime desplegado.

### Inferencia real del backend, con pesos reales

Se ejecutaron ASR CTC `omniASR_CTC_300M_v2`, NLLB `facebook/nllb-200-distilled-600M`, MMS `facebook/mms-tts-quy` y `facebook/mms-tts-ayr`, y el diálogo CPU cuantizado `Qwen/Qwen2.5-1.5B-Instruct-GGUF`. La siguiente evidencia corresponde a solicitudes individuales contra el backend del contenedor, con pesos ya en caché; **no es un benchmark ni una garantía de latencia extremo a extremo en Vercel**.

| Operación | Resultado observado | Tiempo de solicitud |
| --- | --- | --- |
| Qwen, primera carga del modelo con pesos en caché | `¿Qué encontró Ana?` → `Ana encontró una semilla roja.` | 7,872 s |
| Qwen, continuación con historial | `¿Dónde la sembró?` → `Ana la sembró en el jardín.` | 6,358 s |
| NLLB, castellano → Ayacucho | `Anaqa huk puka sementata tarirqan.` | 1,969 s |
| MMS Ayacucho | WAV de **3,008 s**, 96.300 bytes | 2,001 s |
| ASR sobre ese WAV sintético | 5 palabras con tiempos CTC | 1,376 s |
| NLLB, castellano → aimara central | `Anax mä wila jatha jikxatäna.` | 2,038 s |
| MMS aimara central | WAV de **2,752 s**, 88.108 bytes | 1,631 s |
| ASR sobre ese WAV sintético | 5 palabras con tiempos CTC | 0,947 s |

El audio lo generó MMS: **no se usó voz infantil ni un micrófono físico**. Los resultados completos de esta prueba local están en el artefacto de trabajo no publicado `outputs/reading-native-all.json`.

La prueba descubrió y permitió corregir un error real del decodificador CTC: en `RawSentencePieceTokenizer`, el padding es **1** y el blank es **0**; no deben confundirse. Aun corregido, el ASR devolvió `naqa huk puka cimientata tarirqan` frente al texto sintetizado `Anaqa huk puka sementata tarirqan.`, y `nax mä wila jatha jikhatän` frente a `Anax mä wila jatha jikxatäna.`. Esto demuestra ejecución y timestamps, **no precisión lingüística ni calidad educativa**.

Al finalizar la secuencia, el cgroup registró **4.375.310.336 bytes** de memoria actual (aprox. 4,08 GiB), pico **4.431.704.064 bytes** (aprox. 4,13 GiB) y límite **7.516.192.768 bytes** (7 GiB). El desglose final fue 3.665.948.672 bytes anónimos y 679.034.880 bytes de caché de archivos. Los contadores `oom` y `oom_kill` permanecieron en **0**. Es una observación de esta secuencia, no una prueba de carga concurrente.

### Prueba de extremo a extremo y de interfaz pública

- En preview y después en la URL pública se completaron **ambas** cadenas `prepare → MMS → transcribe CTC temporizado → Qwen → traducción → MMS de respuesta`, con HTTP 200 y las identidades de modelo verificadas. Solo se usaron textos ficticios y audio sintético generado por MMS.
- En producción, el audio Ayacucho duró **8,384 s**, devolvió **12 palabras** con tiempos y el turno de diálogo tardó **15,042 s**. El audio aimara duró **9,312 s**, devolvió **11 palabras** con tiempos y su turno tardó **16,053 s**. Son mediciones individuales, no SLA ni precisión de reconocimiento. La cadena completa se probó en `f305d2b`; las rutas API no cambiaron en el arreglo posterior del cliente `18939454`.
- La prueba visual descubrió otro bug que los mocks permisivos no cubrían: `this.request(...)` entregaba `this=MetaReadingClient` a la función nativa `fetch`. El cliente fallaba antes de enviar la preparación aunque la API funcionara. Se desacopló la llamada y se añadieron dos regresiones **rojo → verde**, incluidas en las 557 pruebas.
- Tras publicar `18939454`, en la **UI pública de `/sesion`** se abrió «Lectura multilingüe» desde la misión «Rosa y el puquio», se autorizó la prueba de texto ficticio y se recibió el pasaje traducido en Ayacucho. La UI mostró **0 de 40 coincidencias observadas**, sin inventar resaltados; el micrófono permaneció apagado y no se confirmó una revisión humana inexistente. Se dejó la sesión pausada, revocando la autorización para que el usuario otorgue la suya.
- La comprobación final tras las pruebas públicas y de interfaz mantuvo ASR/tiempos/Qwen listos: memoria actual **4.718.972.928 bytes** (aprox. 4,40 GiB), pico **4.871.749.632 bytes** (aprox. 4,54 GiB), límite 7 GiB/2 CPU y **0** eventos OOM/oom_kill. No se aumentó la asignación de recursos ni se modificaron los otros servicios.
- Evidencias visuales locales no versionadas: `outputs/reading-session-live.png` y `outputs/reading-models-live.png`. El endpoint público rechazó una petición sin código con **401**; `/health` del backend también devolvió **401** sin bearer, con TLS validado.
- La rama `periodico` se revisó por separado: [hallazgos y alcance](PERIODICO-REVIEW.md). No hubo merge ni cambios en esa rama o en `main`.

### Alcance y límites todavía no validados

- Los tiempos de palabras proceden de frames del decodificador CTC (`ctc-greedy-frames`), **no de alineación forzada con el pasaje** ni de una comparación validada para puntuar lectura. La variante elegida no condiciona este modelo CTC ni confirma la lengua detectada; no se inventan confidencias.
- El diálogo local es generativo y puede alucinar; no se confunde con el modo guiado determinista ni se presenta como evaluación de respuestas. Traducciones, respuestas y síntesis requieren revisión humana.
- Sigue siendo una demo de investigación **no comercial**, para voz adulta/sintética, con código privado y consentimiento explícito. No infiere emociones, salud, identidad o calidad del acento; no existe validación con niños, comunidades o docentes, ni métricas WER/CER o evaluación humana de traducción/TTS.
- **Pendiente:** captura con micrófono físico de Opera, conversación hablada completa desde un dispositivo real, rendimiento móvil y validación con hablantes de las variedades locales. Las pruebas API con audio sintético y la preparación visual no sustituyen esas comprobaciones. La actualización de lectura llega por fragmentos de unos **4 segundos más procesamiento/red**, no palabra a palabra instantáneamente.

## Historial: despliegue Meta/NLLB anterior — 18 de octubre de 2026

> Estado histórico de `228fe98`: su producción pública y sus limitaciones no acreditan la promoción ni describen las nuevas capacidades de lectura/voz/diálogo del preview indicado arriba.

- Fuente ejecutable: `228fe98bf9f1b1bc50c2b11b312ea2c73ca5d3d5`, rama `codex/nawinchay-voice-mvp`.
- Producción Vercel: `dpl_vw9VoE6EX2YaQv3TpEHYoBFYo4Uu`, estado `READY`, proyecto exclusivo `nawinchay-voice-mvp`, raíz **`web`**, Node 24.x. Demo: https://nawinchay-voice-mvp.vercel.app/lenguas.
- Backend en el proyecto separado **Nawinchay Meta Lab** de Dokploy: imagen `nawinchay-meta:228fe98`, límite 7 GiB/2 CPU, una inferencia simultánea, caché de pesos persistente, sin puertos de host publicados y APIs privadas por bearer. Sin cambios a los otros proyectos ni al proxy global.
- Modelos realmente cargados: **`omniASR_CTC_300M_v2`** y **`facebook/nllb-200-distilled-600M`**, con los pines de revisión del servicio. HTTPS válido y capacidad `backendReachable/asr.ready/translation.ready=true` verificados a través de Vercel.
- Se detectó y reparó un fallo real de importación: PyArrow 26 requería NumPy 2, incompatible con NumPy 1.x del stack. Se fijaron `numpy==1.26.4` y `pyarrow==21.0.0`; el build Linux pasó `pip check` y el preflight offline del pipeline nativo.
- **419 pruebas web** (28 suites), TypeScript y ESLint correctos; **45 pruebas Python** correctas. El build remoto Next/Turbopack pasó y generó 18 entradas.

### Pruebas reales, no simuladas

- Meta transcribió una muestra **adulta sintética** de 7,574 s, PCM16/mono/16 kHz, en aproximadamente **4,93 s** de solicitud directa. También respondió mediante los proxies de preview y **producción pública** de Vercel. La muestra es Microsoft Zira en inglés leyendo castellano y presenta errores de reconocimiento: confirma inferencia, **no precisión** ni calidad en lenguas indígenas.
- NLLB tradujo `La niña lee un libro.` a Ayacucho (`quy_Latn`) en 6,15 s y aimara central (`ayr_Latn`) en 2,86 s. Son tiempos observados de solicitudes individuales, no un benchmark ni garantía de latencia.
- En la **UI pública de producción**, `Chay wamraqa librota leen.` produjo `El niño está leyendo un libro.` mediante NLLB; la interfaz mostró original, propuesta y advertencia de revisión. El cambio de género ilustra por qué no debe tratarse como traducción certificada.
- El backend devolvió **HTTP 401** a `/health` sin bearer; la consulta autorizada pasó por HTTPS válido. No se desactivó autenticación ni validación de certificados.
- Deepgram devolvió un rechazo real de credenciales/permisos al solicitar el grant (`asr-credentials-rejected`). Su clave **no se habilitó en producción** ni se reemplazó por un token permanente en el cliente. OpenAI no está configurado.
- Se conservó `main` en `01ba51199e574fa9db299fd2f6cb0d657a7e087d`; los commits publicados solo afectan `web/`. Los cambios locales previos de Fixazo no se incluyeron.

### Límites de esta entrega

Solo demo no comercial con voz adulta/sintética, código privado y consentimiento explícito. No hay validación con niños, hablantes peruanos ni corpus de quechua/aimara; no se midieron WER/CER o calidad humana de traducción. No se verificó un micrófono físico de Opera ni rendimiento móvil.

CTC no condiciona el reconocimiento con la variante elegida y no aporta timestamps de palabras: la variante es declarada, no una detección confirmada. Este laboratorio funciona por turnos de hasta 30 s, **no es seguimiento alineado del texto ni un agente conversacional/TTS indígena**. No infiere emociones, salud, identidad o calidad del acento. Las limitaciones de la verificación inicial que siguen se refieren al estado anterior al despliegue, no al estado actual del backend.

## Historial: verificación inicial — 17 de octubre de 2026

> Estado anterior a los despliegues e inferencias reales posteriores. Los apartados «No ejecutado / no validado» siguientes se conservan como registro de aquella verificación, no como estado actual.

## Ejecutado

- Web: **415 pruebas Vitest** (28 archivos), TypeScript sin errores y ESLint sin errores.
- Fixazo, sin cambios publicados fuera de `web/`: **9 pruebas** existentes correctas.
- Servicio Python: **26 pruebas** de API/núcleo con modelos dobles; no pesos reales.
- Build Next 16.4.2 con Turbopack: compilación y generación de 18 entradas correctas. Las rutas de capacidad usan datos de petición, no configuración congelada en build.
- Navegador sobre build de producción: ocho pantallas visitadas, HTTP 200, sin errores de página en contextos aislados. `/voz`, `/lenguas` y consentimiento sin desbordamiento a 390 px.
- Capacidades sin secretos: Deepgram/OpenAI/Meta desactivados, backend Meta no configurado ni listo. No hay conversaciones, transcripciones ni traducciones falsas para ocultar esa falta de configuración.
- Auditoría npm de runtime: sin vulnerabilidades reportadas con `--omit=dev`. Auditoría completa: cinco avisos altos de la cadena de ESLint, sin parche compatible verificado; no se aplicó `--force`. Vitest 4.1.11 retiró los avisos críticos anteriores.

## Inferencia local REAL, no un mock

En Chromium y el build de producción se eligió Whisper local desde la UI. Antes de aceptar la descarga no se había creado worker ni solicitado pesos. La preparación cargó **79.641.437 bytes** de archivos del modelo y produjo `ready`, sin errores del worker de Turbopack/WASM.

Se envió al worker un PCM de **7,5737 s**, generado localmente con la voz sintética adulta Microsoft Zira (voz en inglés leyendo una frase en castellano), no una grabación infantil. Hubo resultado real y **11 fragmentos con timestamps** entre 0,30 y 7,48 s, en aproximadamente **7,7 s** de inferencia en ese equipo. El reconocedor transcribió incorrectamente parte de la frase. Esta prueba confirma ejecución y formato, **no calidad en castellano ni precisión lectora infantil**. No justifica prometer seguimiento instantáneo ni llamar a ese modelo universalmente superior.

La prueba técnica introdujo el PCM directamente al worker. No verifica captura desde un micrófono físico, permisos reales de Opera, rendimiento móvil ni ausencia de todos los errores acústicos. Los caminos de captura, cancelación, tiempo y permisos tienen pruebas unitarias separadas.

## No ejecutado / no validado

- Ninguna llamada real pagada a Deepgram, OpenAI o Claude: no hay claves configuradas.
- Ninguna inferencia real Omnilingual/NLLB, descarga de esos pesos, build Docker ni instalación del stack ML completo. El backend externo debe instalarse, precalentarse y probarse antes de habilitar la demo.
- Ninguna validación con niños, variedades peruanas, mezcla de lenguas, docentes o comunidades; no se calcularon WER/CER ni calidad de traducción.
- Sin clasificación emocional de voz, separación fiable de dictado adulto, identidad/acento/salud ni alineación forzada con el pasaje.

La disponibilidad del despliegue y su commit se comprueban por separado. Un build y estas pruebas no sustituyen una revisión de privacidad, límites de gasto ni validación educativa.
