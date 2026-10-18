# Verificación de la demo

## Despliegue Meta/NLLB — 18 de octubre de 2026

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

## Verificación inicial — 17 de octubre de 2026

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
