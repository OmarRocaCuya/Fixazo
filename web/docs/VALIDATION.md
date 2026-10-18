# Verificación de la demo — 17 de octubre de 2026

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
