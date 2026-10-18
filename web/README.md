# Ñawinchay · MVP educativo

Web para practicar lectura y razonamiento con alias, misiones, evidencia provisional y revisión de la familia o docente. **No es una evaluación clínica ni un producto validado con escolares peruanos.**

- Sitio: https://nawinchay-voice-mvp.vercel.app
- Rama: `codex/nawinchay-voice-mvp`.
- Vercel: proyecto separado `nawinchay-voice-mvp`, **Root Directory `web`**. La raíz del repositorio pertenece a Fixazo y no debe desplegarse como Ñawinchay.
- [Despliegue, secretos y límites](DEPLOYMENT.md) · [Lectura multilingüe, contratos y límites](docs/READING-VOICE.md) · [Investigación y licencias](docs/VOICE-RESEARCH.md) · [Servidor Meta](services/indigenous/README.md) · [Verificaciones realmente ejecutadas](docs/VALIDATION.md).

## Ejecutar

Node 24, npm 11. Sin claves funciona el recorrido por reglas y la transcripción manual.

```sh
cd web
npm ci
npm test
npm run lint
npm run build
npx tsc --noEmit
npm start -- --port 3001
```

Desarrollo: `npm run dev` en 3000. No ejecutar dos builds sobre `.next` a la vez. `package-lock.json` fija la instalación. `.env.local` nunca se confirma; `.env.example` contiene solo nombres y valores desactivados.

## Recorrido

| Ruta | Función |
|---|---|
| `/consentimiento` | Ruta antigua: redirige a `/chat`. El MVP no tiene pantalla de consentimiento ni permisos |
| `/chat` | Lectura pegada, ejemplos; foto solo con Claude configurado |
| `/sesion` | Recorrido habitual de lectura y razonamiento; antes de iniciarlo ofrece una **sesión multilingüe independiente de la evaluación** |
| `/informe` | Evidencia provisional, revisión humana, contexto y fuente ASR |
| `/progreso` | Historial local del navegador, no cuenta remota |
| `/privacidad` | Exportar, borrar datos y revisar permisos |
| `/voz` | Demo conversacional independiente; no califica ni guarda respuestas del participante |
| `/lenguas` | Demo de transcripción indígena Meta y traducción de investigación; requiere backend externo |

Pausar sigue disponible durante la misión. Los borradores guardados tienen duración limitada y se depuran; no incluyen audio, códigos de acceso, estado emocional inferido ni línea base acústica.

### Probar la lectura multilingüe en la misma misión

En `/chat`, elige una misión; en la introducción de `/sesion`, pulsa **«Abrir lectura multilingüe de esta misión»**. No se inicia ni se modifica la evaluación habitual. Elige quechua Ayacucho o aimara central, introduce el código privado proporcionado por el responsable y confirma que solo usarás voz adulta/sintética y que autorizas los envíos. El código se configura privadamente en Vercel: **no se publica en este README ni se guarda en el almacenamiento del navegador**.

Prepara y revisa la traducción automática del pasaje. Después puedes leer hasta 60 segundos, recibir coincidencias por fragmentos de unos 4 segundos y conversar con respuestas de hasta 15 segundos. La voz sintética solo se reproduce al solicitarla; mientras habla, el micrófono permanece apagado. Pausar, ocultar la pestaña o salir cancela la captura y revoca la autorización temporal. No crea notas, informes ni perfiles. [Guía completa y condiciones de disponibilidad](docs/READING-VOICE.md).

## Qué modelos usa realmente

| Función | Implementación y disponibilidad |
|---|---|
| Castellano sin descargar modelo | Web Speech `es-PE`, servicio y modelo opacos del navegador. Puede enviar voz a su proveedor; Opera puede tener micrófono sin transcripción |
| Castellano sin cuenta de voz | Whisper base multilingüe ONNX (`onnx-community/whisper-base_timestamped`), Transformers.js 4.3.1, WASM q8 en Web Worker. Preparación **explícita** de ~80 MB más runtime. Solo castellano en este MVP; inferencia local, no streaming instantáneo |
| Castellano en nube opcional | Deepgram Nova-3, `es-419`, tiempos por palabra y resultados provisionales. Desactivado sin clave y autorización; `mip_opt_out=true` |
| Voz del recorrido habitual | `speechSynthesis`, voz del sistema operativo; no un modelo elegido por la app |
| Conversación de voz `/voz` | OpenAI `gpt-realtime-2.1`, voz `marin`, WebRTC con token efímero y turnos manuales. Demo aparte, desactivada sin configuración |
| Lenguas indígenas `/lenguas` | Meta Omnilingual ASR autoalojado: `quy_Latn` (Ayacucho), `quz_Latn` (Cusco), `ayr_Latn` (aimara), `spa_Latn`. Transcripción por turnos; no sigue la lectura por palabra ni traduce por sí solo |
| Lectura multilingüe adulta `/sesion` | `omniASR_CTC_300M_v2` en CPU. Conserva emisiones reales del mismo forward para estimar tiempos CTC por palabra; UI por fragmentos de ~4 s, no streaming instantáneo ni alineación forzada con el pasaje |
| Traducción experimental | NLLB-200 600M: `quy_Latn`, `ayr_Latn`, `spa_Latn`. Licencia CC-BY-NC 4.0, opt-in de investigación no comercial. No transforma `quz` en `quy` silenciosamente |
| Voz en quechua/aimara de la demo lectora | `facebook/mms-tts-quy` / `facebook/mms-tts-ayr`, VITS en CPU, licencia CC-BY-NC 4.0. Son voces sintéticas específicas, no una voz castellana renombrada. Requieren habilitación y revisión por hablantes |
| Conversación local de la demo lectora | Modelo oficial `Qwen/Qwen2.5-1.5B-Instruct-GGUF`, cuantización `Q4_K_M`, CPU. Responde sobre el pasaje en castellano; NLLB traduce la respuesta y MMS la habla. Solo activo si el backend lo habilita; modo/modelo reales se muestran en la UI |
| Conversación sin LLM local configurado | `guided-reading`: guion determinista de preguntas, **etiquetado como tal**. No se presenta como conversación libre ni se usa silenciosamente para ocultar un fallo del LLM habilitado |
| Misiones/juez | Reglas por defecto. Claude Haiku 5.5 opcional (`ANTHROPIC_API_KEY`), tres corridas para el juez y fallback a reglas. Claude no recibe audio para alinear lectura |
| Señales acústicas | Web Audio y heurísticas locales; no modelo de emoción, identidad, edad, acento o salud |
| Emoción experimental opcional | Sólo `emotion2vec/emotion2vec_plus_base` sobre audio de la respuesta, con el código de acceso del despliegue. Sin modelo listo no hay inferencia emocional ni respaldo por texto/energía. Ver [guía local](services/indigenous/EMOTION_LOCAL.md) |

**Tener el código no significa que el servicio esté activo.** `/api/asr`, `/api/voice/session`, `/api/indigenous` y `/api/reading` muestran configuración y límites. Meta/Qwen se ejecutan en el servicio Linux CPU del VPS, separado de Vercel; los pesos deben cargarse antes o bajo una petición explícita. `ready` confirma carga, no precisión ni una inferencia end-to-end. La apertura de lectura puede seguir un guion aunque las respuestas posteriores usen el LLM. Los smokes anteriores de ASR/NLLB no prueban automáticamente CTC temporizado, MMS ni Qwen: [estado evidenciado](docs/VALIDATION.md).

## Si la voz falla en Opera

1. Abrir HTTPS o localhost. Una IP de red HTTP desde el celular no es contexto seguro.
2. Comprobar permisos del sitio, sistema operativo y dispositivo de entrada.
3. «Probar micrófono» mide señal local, no verifica ASR ni identifica a quien habla.
4. Elegir Whisper local y prepararlo explícitamente, un proveedor autorizado o transcripción manual. Cambiar a Opera móvil no garantiza soporte.
5. Si no hay transcripción fiable, marcar **No observable**, nunca respuesta incorrecta por un fallo técnico.

## Seguimiento y evaluación

Hay dos vías diferentes. La demo multilingüe adulta no usa el controlador evaluativo ni genera informes: resalta **solo índices de palabras observadas que coinciden con el texto**, sin colorear todo un prefijo cuando se salta palabras. Sus tiempos proceden de emisiones CTC: paso de frames ~20 ms y campo receptivo ~25 ms, **no exactitud temporal garantizada de 20 ms**. La UI espera fragmentos de ~4 segundos más red/inferencia; ni un temporizador ni la traducción hacen avanzar la lectura. [Detalles y límites](docs/READING-VOICE.md#qué-significan-los-tiempos-y-el-resaltado).

En el recorrido habitual, el resaltado compara la hipótesis reconocida con el prefijo del pasaje. Prioriza la primera coincidencia, permite corregir resultados provisionales y solo cierra automáticamente con resultado final y cobertura suficiente. No se alimenta al ASR con la lectura esperada para luego usar su coincidencia como prueba de exactitud.

Los tiempos de descarga, conexión y procesamiento final no cuentan como tiempo de lectura ni silencio del niño. En modelo local puede haber espera para transcribir; no se promete seguimiento instantáneo. Los tiempos de palabra, si existen, son del ASR: **no son alineación forzada verificada con el pasaje**. El informe conserva solo procedencia mínima, no credenciales, audio ni timestamps crudos.

En manual se compara al enviar, no mientras el adulto escribe. Una hipótesis ajena al texto deja precisión y PCPM no observables. Repeticiones, autocorrecciones y muletillas pueden ser eliminadas por el ASR: «no encontradas en la transcripción» no significa que no ocurrieran.

La evidencia de lectura, obtención, inferencia y postura/revisión debe confirmarse individualmente por una persona. **No observable ≠ 0**. Mantener una postura con evidencia vale igual que cambiarla. La ayuda adulta se declara, no se infiere del tono. La revisión guardada localmente no autentica al docente ni demuestra validación científica.

## Privacidad y límites

- Sin huella vocal, identificación de hablante, juicios de acento ni señales de salud. El ánimo del informe es el autorreporte voluntario identificado como tal. La única excepción emocional es la **estimación experimental opcional** (ver abajo): apagada por defecto, solo para el adulto y nunca usada para calificar.
- Cambios de ritmo solo ofrecen una pausa genérica en vivo; no se guardan como ansiedad o cansancio.
- El audio de Whisper se conserva temporalmente en memoria para transcribir en el dispositivo y se descarta. Deepgram/OpenAI reciben audio al elegirlos; las demos Meta envían muestras/fragmentos al servidor configurado. «LLM local» significa **local al VPS**, no al celular. La app no persiste grabaciones, pero no se promete procesamiento exclusivamente local al dispositivo para esas rutas.
- Los códigos de acceso de demos quedan solo en memoria y no se exportan. No usar datos personales en las pruebas.
- Servicios externos desactivados por defecto. `adult-demo` exige el código de acceso privado; el MVP ya no pide confirmación adulta ni consentimiento en pantalla (decisión de producto). Un piloto infantil exige revisión real de privacidad; las banderas no sustituyen consentimiento, contratos ni ZDR cuando corresponde.
- Límites de cliente/tokens y rate limit en memoria **no son presupuestos ni cuotas distribuidas**. Configurar protección y topes del proveedor. Claude existente no tiene autenticación de aplicación: no activar una clave en una URL abierta.
- `localStorage` es por origen y navegador; no hay sincronización entre dispositivo, localhost y Vercel. Exportar/borrar está en Privacidad.
- Quechua de las misiones y traducciones nuevas siguen pendientes de validación por hablantes. La demo lectora usa MMS como **síntesis artificial**, no como una persona nativa identificada ni validación de pronunciación. NLLB y MMS restringen esta integración a investigación/demo no comercial; la licencia de Qwen no elimina esas restricciones.

## Estimación experimental de emociones

Función **experimental para la demo**, pedida explícitamente. En el MVP **no hay consentimiento ni permiso adulto**: está disponible siempre que el despliegue tenga emotion2vec+ y se introduzca el código de acceso en la vista del adulto. Privacidad solo informa y permite borrar las estimaciones guardadas.

**Sale del audio, no de las palabras.** La transcripción no es una entrada del modelo. La inferencia arranca desde el WAV capturado, independientemente de que el ASR produzca texto; una transcripción vacía o un fallo de ASR no convierte texto en evidencia emocional.

1. **Único estimador emocional activo: emotion2vec+ base** en el servicio privado (`POST /v1/emotion`, ver [su README](services/indigenous/README.md)).
   - En cada respuesta hablada (nunca durante la lectura), el navegador guarda en RAM el audio del turno, hasta 15 s.
   - Lo baja a 16 kHz, lo codifica como WAV en memoria y lo envía a `/api/emotion`. Ese proxy lo reenvía con `INDIGENOUS_BACKEND_TOKEN`. Después el buffer se borra.
   - Requiere el código de voz en la vista del adulto, con la misma política de operador que el resto del audio enviado a Meta (modo configurado, mismo origen, código y límite de solicitudes).
   - Las 9 clases se muestran en castellano: enojado/a, disgustado/a, con miedo, contento/a, neutral, triste y sorprendido/a; «other» y «unknown» se muestran como «sin datos suficientes».
   - La confianza es «media» si la probabilidad mayor es ≥ 0,6 y «baja» si no; nunca «alta». La fuente se muestra como «voz (emotion2vec+)».
2. **Sin modelo no hay inferencia.** Si no hay código de acceso, el backend no está configurado, carga o falla, se muestra «sin datos suficientes», fuente «sin inferencia del modelo» y un motivo visible. No se generan etiquetas con texto, energía, F0 ni una línea base de lectura. Los helpers acústicos históricos que aún existen no participan del estimador activo.
3. **Modo simulación o transcripción manual:** no hay audio, así que se muestra «sin audio: la estimación necesita el micrófono» y ninguna etiqueta.
4. **Demo sin micrófono:** «Analizar un audio de prueba» (WAV o WebM) en la vista del adulto, solo con el código de acceso. Decodifica el archivo en el navegador y lo pasa por la misma ruta.

**Garantías.**

- Solo la ve el adulto. La zona del niño usa una lista blanca (`lib/session/childView.ts`) y el agente nunca la dice.
- No toca la máquina de estados, la oferta de pausa (`pace.ts`) ni `scoring.ts`.
- `assertReportIsClean` acepta `experimentalAffect` solo con entradas marcadas `experimental: true` y campos acotados. Las inferencias nuevas tienen fuente `voz-emotion2vec`, probabilidad `score` y `activation:null`; sin modelo, `score:null` y `activation:null`. El campo de activación permanece por compatibilidad histórica, no como emoción nueva. Nada de audio, F0 ni embeddings.
- Las palabras de emoción siguen prohibidas en cualquier otro campo del informe.
- «Borrar estimaciones experimentales» en Privacidad elimina las estimaciones de los informes guardados.
- El informe agrega un bloque EXPERIMENTAL con la línea de tiempo, lo más frecuente y la coincidencia con la carita al inicio y al final.

**Variables.**

- Next.js: `VOICE_CLOUD_MODE=adult-demo`, `VOICE_ACCESS_CODE`, `INDIGENOUS_BACKEND_URL` e `INDIGENOUS_BACKEND_TOKEN`.
- Servicio privado: build arg `INSTALL_EXPERIMENTAL_EMOTION=true`, más `ENABLE_EXPERIMENTAL_EMOTION=true` y `EMOTION2VEC_LICENSE_ACCEPTED=true`. Ver [DEPLOYMENT.md](DEPLOYMENT.md).

Para CPU Windows sin Docker, usa el [setup y launcher locales aislados](services/indigenous/EMOTION_LOCAL.md): `EMOTION_WARMUP=true`, `INDIGENOUS_WARMUP=false`, credencial backend efímera y output Next `.next-emotion`. `GET /api/emotion` anuncia disponibilidad propia; emoción sólo está lista con `ready=true` e `inferenceVerified=true`.

**Evidencia y alcance.** El modelo real se ejecutó en CPU Windows sobre una muestra pública de 4,104125 s: carga aproximada de 26,703 s e inferencia de 1,25 s en esa ejecución. No son garantías de latencia ni pruebas de exactitud emocional; tampoco acreditan por sí solas la cadena HTTP/UI completa o un despliegue publicado. Ver [validación](docs/VALIDATION.md) y ejecutar el smoke real de la guía antes de declarar operativo todo el recorrido.

**Licencia y atribución.** emotion2vec+ (Ma et al., ACL Findings 2024), Alibaba DAMO / FunASR, bajo la FunASR Model License v1.1, que exige citar la fuente y el autor y conservar el nombre del modelo. La licencia no aclara el uso comercial. Los modelos de audEERING son no comerciales y no se usan.

**Límites.**

- El modelo se entrenó con habla adulta actuada o pseudoetiquetada. No está validado con niños, castellano peruano ni quechua.
- El ruido, el micrófono y el eco alteran el resultado.
- Sin servidor/modelo listo se muestra ausencia de inferencia, no una emoción local aproximada.
- Es una estimación, no un diagnóstico. Prevalece el autorreporte.

**Nota legal.** En el Perú, inferir emociones en educación se considera de **alto riesgo** (DS 115-2025-PCM, art. 24.1 i). Usar solo para demostración con voces adultas o datos de prueba. Un piloto con niños requiere evaluación de impacto y un consentimiento informado específico.

## Arquitectura breve

`SessionController` coordina una máquina de estados pura, TTS, `Transcriber`, Web Audio y análisis de texto. `lib/signals` extrae evidencia; `report/build` genera informe y `guardrails`/`storage` impiden persistir campos prohibidos. `lib/transcription` valida procedencia ASR. APIs de servidor emiten credenciales efímeras o actúan como proxy autorizado; nunca publican claves permanentes. `services/indigenous` es un proceso Python separado, no una función de Vercel.

`MultilingualReadingSession` constituye una vía aislada dentro de la introducción: recibe únicamente pasaje/título, captura PCM incremental y usa `/api/reading`. `MetaReadingClient` limita solicitudes, resultados e historial español en memoria; la cola acepta una petición activa y un fragmento pendiente. Si el servidor se retrasa, se pausa explícitamente en vez de acumular audio o descartar fragmentos sin avisar. No llama a `buildReport` ni adjunta perfil/alias a sus solicitudes.

Próximo requisito para un piloto real: validar WER/CER y traducciones por variedad/edad, latencia por dispositivo, errores de seguimiento y acuerdo docente; incorporar gobierno de datos con las comunidades. Ni un benchmark general ni pasar pruebas unitarias demuestran funcionamiento óptimo con niños.

## Lectura enriquecida del periódico

`/noticia/[id]` ofrece lectura interactiva adaptada al género (línea de tiempo,
pancarta, pirámide, datos, diálogo o dos medios) sin reemplazar el cuestionario
existente. El renderizado recibe solo la noticia pública; criterios y respuestas
privadas permanecen en el servidor.

Sin configuración utiliza el motor determinista compartido de
`../services/reader-enricher`, sin llamadas al LLM ni a servicios externos.
El frontend consume las fuentes mediante el alias `@reader-enricher/*`, no un
`dist` precompilado. Los imports relativos `.ts` del servicio se reescriben a
`.js` al compilarlo por separado con TypeScript 5.7 o superior.
El glosario generativo no está disponible en ese modo. Para usar el microservicio,
configura **solo en el servidor** `READER_ENRICHER_URL` (URL base) y, si está
protegido con `SERVICE_TOKEN`, el mismo valor en `READER_ENRICHER_TOKEN` del frontend.
No uses prefijos `NEXT_PUBLIC_` ni pegues tokens en el navegador.

Se envían únicamente titular, bajada, sección y fragmentos con sus fuentes; nunca
preguntas, soluciones, criterios, respuestas del lector ni audio. La petición tiene
un límite de 4 segundos, no sigue redirecciones y valida esquema, layout, identidad,
texto, citas y referencias antes de renderizar. Si falla, se usa el motor local;
si este tampoco puede procesar el artículo, se conserva la lectura original.
Los tokens no constituyen audio ni una alineación temporal verificada: el modo
karaoke depende de los eventos de la síntesis de voz del navegador.

Prueba enfocada: `npm test -- src/lib/periodico/lectura.test.ts` desde `web`.