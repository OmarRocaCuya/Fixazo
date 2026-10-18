# Lectura multilingüe con voz: demo adulta

## Alcance y estado

Esta vía vive en **`/sesion`, antes de empezar la misión habitual**. Usa el texto de la misión para una prueba adulta no comercial de lectura, conversación y síntesis en quechua Ayacucho (`quy_Latn`) o aimara central (`ayr_Latn`). No es la evaluación infantil ni el laboratorio independiente `/lenguas`.

El código de la cadena está implementado y cuenta con pruebas de contrato, captura y ciclo de vida. **La validación de este incremento requiere todavía smokes reales Linux de CTC temporizado, MMS y Qwen, más el recorrido de UI/audio** hasta que queden registrados en [VALIDATION.md](VALIDATION.md). Las pruebas reales anteriores de Meta ASR/NLLB no acreditan automáticamente los componentes nuevos. Este documento no afirma validación con niños, micrófono físico de Opera, calidad de traducción ni latencia óptima.

## Cómo probarlo

1. Elige una misión en `/chat` y abre `/sesion`. En la introducción, pulsa **«Abrir lectura multilingüe de esta misión»**. El controlador de la misión habitual no se inicia; un borrador anterior no se convierte en datos de esta prueba.
2. Elige Ayacucho o aimara. El servidor debe anunciar ASR temporizado preparado, traducción preparada y síntesis habilitada para esa lengua. La voz puede requerir carga en la primera solicitud: habilitado no equivale a cargado.
3. Introduce el código privado del responsable y confirma consentimiento y **voz adulta o sintética**. El código se configura como secreto privado en Vercel y se entrega por un canal privado, nunca en documentación, repositorio o captura de pantalla. No uses nombres, datos escolares identificables ni información sensible.
4. **Prepara y revisa el texto traducido.** Se conserva el pasaje castellano como contexto; la traducción no sustituye la misión guardada. La casilla de revisión es una decisión del adulto para esta prueba, no certificación lingüística o validación infantil.
5. Pulsa **«Comenzar lectura con micrófono»**. Solo entonces se solicita permiso. La captura dura hasta 60 s y envía fragmentos de unos 4 s. Pulsa **«Terminar lectura y apagar micrófono»** para cerrar; el procesamiento pendiente no cuenta como tiempo de lectura.
6. Escucha la pregunta en la lengua elegida cuando lo solicites. MMS produce la voz; no se sustituye por una voz castellana. Mientras se sintetiza o reproduce, el micrófono está apagado.
7. Pulsa **«Responder con voz»**: una respuesta de hasta 15 s, seguida de transcripción, traducción al castellano, respuesta del modelo/guion y traducción a la lengua elegida. La voz se reproduce con un botón separado; no se abre otro turno automáticamente. Máximo nueve respuestas.
8. **Pausar**, ocultar/cerrar la pestaña o salir detiene captura/reproducción, aborta solicitudes, revoca URLs de audio y borra autorización e historial contextual enviado al modelo. El texto observado puede seguir visible para retomar mientras el componente siga montado; no se persiste. Para continuar hay que autorizar otra vez. Cancelar no retira audio que ya haya recibido el servidor ni interrumpe necesariamente un kernel de inferencia iniciado.

Una misión quechua solo puede usar su `textEs` explícito como contexto castellano. Si falta, el acceso se deshabilita: no se etiqueta el texto quechua como castellano. La demo no transforma Cusco (`quz_Latn`) en Ayacucho ni ofrece síntesis Cusco o castellana como sustituto.

## Modelos y funciones separadas

| Etapa | Modelo | Qué significa |
|---|---|---|
| Reconocimiento | `omniASR_CTC_300M_v2`, CPU/FP32 | Reconoce texto original y conserva frames de la misma inferencia para estimar tiempos. La lengua es seleccionada, no detectada ni forzada: `languageConditioned:false`. |
| Traducción | `facebook/nllb-200-distilled-600M`, CPU/FP32 | Castellano ↔ Ayacucho/aimara. Propuestas automáticas que requieren revisión. No es voz ni conversación. |
| Conversación opcional | `Qwen/Qwen2.5-1.5B-Instruct-GGUF`, `qwen2.5-1.5b-instruct-q4_k_m.gguf`, CPU | Modelo oficial cuantizado Q4_K_M, ejecutado en el VPS. Recibe el pasaje y turnos en castellano; su salida se traduce para presentarla/hablarla. No se declara comprensión nativa validada de quechua/aimara. |
| Conversación sin LLM habilitado | `guided-reading` | Guion determinista, mostrado explícitamente como guion. No es conversación libre. |
| Síntesis | `facebook/mms-tts-quy` / `facebook/mms-tts-ayr`, VITS/CPU | Voces sintéticas específicas de esas lenguas. No identifica, clona ni imita la voz del participante. |

La API devuelve `dialogueMode:"local-llm-reading"` y el modelo real cuando una respuesta procede de Qwen. Si el LLM está deshabilitado, devuelve `guided-reading`; **si está habilitado pero falla, devuelve error, no un guion camuflado como LLM**. La apertura preparada puede seguir el guion: no demuestra que el LLM ya haya generado una respuesta. La UI usa el modo de cada respuesta, no una promesa fija.

Qwen puede equivocarse o incumplir una instrucción. No tiene herramientas ni acceso al perfil; esta demo adulta puede explicar/responder sobre la lectura y está separada del agente evaluativo que evita adelantar respuestas. El historial conserva solo extractos de `heardSpanish`/`replySpanish` realmente recibidos: seis entradas como máximo, 600 caracteres por entrada y 2500 en total, sin roles de sistema.

Licencias: [Omnilingual ASR](https://github.com/facebookresearch/omnilingual-asr) es Apache-2.0; [Qwen GGUF oficial](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF) es Apache-2.0. [NLLB](https://huggingface.co/facebook/nllb-200-distilled-600M), [MMS Ayacucho](https://huggingface.co/facebook/mms-tts-quy) y [MMS aimara](https://huggingface.co/facebook/mms-tts-ayr) publican pesos CC-BY-NC-4.0. Por ello esta cadena sigue restringida a investigación/demo **no comercial**; cuantizar Qwen o autoalojar no elimina las restricciones de los otros modelos. Revisiones, hashes y banderas operativas: [servicio Linux](../services/indigenous/README.md).

## Qué significan los tiempos y el resaltado

El adaptador captura los **logits reales del mismo forward** que produce la transcripción oficial. Hace argmax, colapsa runs CTC/blanks y reconstruye palabras con el tokenizador real. Verifica que palabras/transcripción coincidan, que los spans estén ordenados y que quepan en el audio. Si no puede establecerlos, falla: no reparte la duración uniformemente entre palabras ni inventa tiempos a partir de la longitud del texto.

La geometría comprobada del frontend es un paso de **320 muestras / 16 kHz = 20 ms** y un campo receptivo de **400 muestras = 25 ms**. Son la rejilla y ventana de emisión, **no un error máximo de ±20 ms ni tiempos fonéticos exactos**. Una palabra hereda los spans de sus emisiones CTC; no se hace alineación forzada con el pasaje esperado. El contexto posterior del modelo, el tokenizador y los cortes pueden desplazar/alterar lo reconocido.

La UI recibe segmentos de **~4 s más red e inferencia**, no actualizaciones instantáneas cada 20 ms. Solo compara palabras devueltas por el ASR con palabras normalizadas del pasaje, mediante búsqueda monótona acotada. Colorea únicamente los índices coincidentes observados, **no todo el prefijo saltado**. Un temporizador, el silencio o audio ajeno sin coincidencias no hacen avanzar marcas; la lectura termina por acción del usuario o por el límite de captura, no porque el cursor llegue al final.

Las palabras sin marcar son **evidencia faltante**, no errores ni una nota. Puede haber errores del ASR, cortes dentro de una palabra, traducción no equivalente o coincidencias textuales ambiguas. No se calcula PCPM, precisión educativa, pronunciación ni emoción en esta vía.

## Contrato HTTP del navegador

Destino fijo, mismo origen: **`/api/reading`**. El navegador nunca recibe el bearer del VPS ni elige una URL/modelo arbitrario. Todas las respuestas, incluido WAV y errores, llevan `Cache-Control: no-store, private`; no se usan como caché de contenido del participante.

### GET: capacidades sin cargar modelos

Devuelve política `enabled/mode/reason`, `adultOnly:true`, ASR (`ready`, modelo, lenguas, `wordTimestamps`, `timingMethod`), traducción, síntesis (`enabled`, modelos, lenguas, readiness por lengua) y conversación (`enabled`, `ready`, modelo y modo). La disponibilidad se deriva de salud/contratos del backend. `speech.ready:false` puede significar primera carga pendiente; `ready:true` es carga, no calidad ni prueba de inferencia.

### POST: acceso común

Requiere Origin del mismo sitio y cabecera **`X-Voice-Access-Code`**, sin poner su valor en URL, ejemplos públicos o almacenamiento local. Cada cuerpo incluye `audience` igual al modo del despliegue, `consent:true`, `adultConfirmed:true`. Esta vía sigue siendo adulta incluso si el servidor tiene modo `approved-pilot`.

| Acción | Cuerpo y límites | Respuesta |
|---|---|---|
| `prepare` | JSON: `action`, `passage` castellano ≤1500 caracteres, `language`, acceso común | `passage` traducido, `opening`, `dialogueMode`, `requiresHumanReview:true` |
| `transcribe` | Multipart: `action`, `file`, `language`, acceso común como strings. WAV PCM16, mono, 16 kHz; fragmento 0,1–15 s; archivo ≤1.000.000 bytes, cuerpo ≤1.010.000 bytes | `text`, modelo, lengua declarada, duración real, `words:[{word,start,end,confidence:null}]`, `wordTimestamps:true`, `timingMethod:"ctc-greedy-frames"`, `languageConditioned:false`, revisión humana |
| `turn` | JSON: `action`, `passage` castellano ≤1500, `heard` nativo ≤1500, `language`, `turn:0..8`, `history?` español `{role:"user"|"assistant",text}` y acceso común | `heardSpanish`, `replyText` nativo, `replySpanish`, modo real, modelo o `null`, revisión humana |
| `speak` | JSON: `action`, `text` nativo ≤300 caracteres, `language` (`quy_Latn`/`ayr_Latn`), acceso común | WAV PCM16 mono ≤2.000.000 bytes y ≤30 s, validado también por el proxy |

El JSON completo tiene además un límite de **8192 bytes**: los máximos de campos no garantizan que cualquier combinación UTF-8 quepa. NLLB limita entrada a 256 tokens sin truncado silencioso. El servidor valida audio decodificado, geometría/timestamps, modelo de origen y WAV de salida, no solo MIME o duración declarada.

Estados típicos: 401 acceso inválido; 403 origen/consentimiento/modalidad rechazados; 413 exceso de tamaño; 415 formato incorrecto; 422 dato o variante no admitida; 429 límite de solicitudes; 502/503 contrato inválido, modelo ocupado/no preparado o fallo de inferencia. No se convierten en respuestas incorrectas ni se cambia de proveedor/modo automáticamente.

### Flujo interno, no API pública directa

Next llama al servicio HTTPS privado: `/health`, `/transcribe-timed`, `/translate`, `/dialogue`, `/speak`. El proxy traduce entre el contrato público de historial y el del backend; el navegador no puede enviar roles de sistema ni parámetros de muestreo. El bearer queda exclusivamente en servidor. Configuración privada de Vercel: `INDIGENOUS_BACKEND_URL`, `INDIGENOUS_BACKEND_TOKEN`, `VOICE_CLOUD_MODE`, `VOICE_ACCESS_CODE` e `INDIGENOUS_TRANSLATION_RESEARCH_ONLY`. **Sin valores reales aquí.** Las nuevas banderas/revisiones del backend se mantienen en [su README](../services/indigenous/README.md) y [runbook Dokploy](../services/indigenous/DEPLOY_DOKPLOY.md), no se duplican en esta guía.

## Recursos, cancelación y privacidad

- Un proceso de inferencia y un semáforo compartido serializan ASR, traducción, conversación y síntesis. El perfil Compose limita por defecto a **2 CPU y 7 GiB configurables**; hay que medir RSS máximo de carga e inferencia con todos los modelos antes de afirmar que sobra memoria. Los límites de ejecución no limitan el build.
- Reservar margen para el sistema y los demás proyectos. El despliegue de Ñawinchay usa proyecto/imagen/volumen/dominio propios: no modifica Fixazo, puertos publicados ni el proxy global. No ampliar recursos a costa de otras aplicaciones sin autorización.
- Cliente: una solicitud ASR activa y un fragmento pendiente. Si se llena, pausa con aviso en vez de acumular memoria o descartar silenciosamente audio. Evitar envíos continuos/reintentos automáticos. El rate limit Meta es un control en memoria por proceso, no una cuota distribuida ni garantía de aislamiento de CPU.
- Next limita cada solicitud upstream y esta ruta a tiempos acotados; el cliente también cancela. Una descarga fría o inferencia lenta puede excederlos. Precargar y comprobar el modelo antes de anunciar disponibilidad; no prometer primera respuesta en cuatro segundos.
- Solo los pesos van a la caché persistente del servidor. El audio, texto e historial de esta vía no se guardan por la aplicación en perfil, informe, chat o `localStorage`. La seguridad de logs, swap, dumps y copias del VPS sigue siendo responsabilidad del operador.
- No huella vocal, embeddings de hablante, identificación, emoción inferida, juicio del acento ni señales de salud. Un ASR reconoce contenido; **no verifica identidad/edad ni valida que el micrófono físico o la persona sean quienes dicen ser**. La confirmación adulta es una declaración de uso, no detección biométrica.

## Verificación reproducible

Desde `web/`:

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Pruebas focales:

```sh
npx vitest run src/lib/browser/meta-reading-client.test.ts src/lib/browser/reading-pcm-capture.test.ts src/components/session/MultilingualReadingSession.test.ts src/lib/server/reading-voice.test.ts src/app/api/reading/route.test.ts
```

Backend ligero, sin pesos (desde la raíz del repositorio, usando un entorno con dependencias de pruebas):

```sh
python -B -m unittest discover -s web/services/indigenous/tests -v
```

Los tests comprueban acceso, límites, metadatos/tiempos inválidos, captura/cancelación tardía, backpressure, coincidencias sin prefijos ficticios, modo/modelo e historial y aislamiento del perfil. El preflight Docker importa el stack nativo offline, pero tampoco ejecuta modelos.

Antes de afirmar «funciona» en el despliegue nuevo, registrar en [VALIDATION.md](VALIDATION.md): revisiones ejecutadas; ASR temporizado y spans reales con audio adulto/sintético; traducción original/propuesta revisable; WAV MMS por ambas lenguas; primera y segunda respuesta Qwen con historial; modos reales y error sin fallback; latencias y pico RSS; denegación sin credencial; captura/reproducción detenidas al pausar/ocultar/salir; comprobación de UI móvil/escritorio. No probar con voces infantiles ni presentar un WAV generado o un mock como validación de un micrófono físico.
