# Servicio privado: lectura indígena, voz y conversación de investigación

Este servicio de referencia usa un **proceso Linux separado del servidor Next.js** para conservar modelos en memoria. El usuario eligió su VPS con Dokploy: ver [DEPLOY_DOKPLOY.md](DEPLOY_DOKPLOY.md); la [guía Compose manual](DEPLOY_VPS.md) queda como alternativa operativa. No se han descargado pesos ni comprobado inferencia real en este entorno. Las pruebas usan dobles de modelo, no resultados inventados. No se afirma que cualquier modalidad de contenedores de Vercel sea técnicamente imposible; esta versión FP32 conjunta no está validada bajo sus cuotas.

## Qué hace cada modelo

| Función | Modelo y cobertura de esta integración | Límite importante |
|---|---|---|
| Transcribir voz en su lengua original | Omnilingual ASR v2: `spa_Latn`, `quy_Latn` (Ayacucho), `quz_Latn` (Cusco), `ayr_Latn` (aimara central) | No traduce ni conversa. CTC-300M tiene un endpoint separado de tiempos de emisión estimados; no es alineación forzada ni precisión fonética validada. |
| Traducir texto, de forma separada | `facebook/nllb-200-distilled-600M`: `spa_Latn`, `quy_Latn`, `ayr_Latn`, en ambas direcciones | Solo investigación/demo **no comercial**; desactivado hasta aceptar ambos indicadores. No soportamos `quz_Latn` ni lo renombramos como Ayacucho. |
| Conversar sobre la lectura | `Qwen/Qwen2.5-1.5B-Instruct-GGUF`, Q4_K_M, castellano, CPU | Opcional y local al VPS. Contexto 2048 tokens, salida 64 tokens/300 caracteres; no es Meta ni está validado como tutor infantil. |
| Sintetizar voz | Meta `facebook/mms-tts-quy` (Ayacucho) y `facebook/mms-tts-ayr` (aimara central) | CC-BY-NC-4.0; requiere dos banderas de investigación. Una lengua residente, no voz clonada, ni Cusco ni castellano. |

La lengua la declara el usuario: no se presenta como detección verificada. Se requiere revisión de un hablante/docente competente. La traducción no reemplaza ni corrige la evidencia original de lectura. No se infieren emociones, identidad, acento, salud ni capacidades. Soporte en la lista de un modelo no demuestra calidad en niños bilingües, variantes locales o mezcla castellano/quechua.

### Licencias y alternativas recientes

- [Omnilingual ASR](https://github.com/facebookresearch/omnilingual-asr/tree/81f51e224ce9e74b02cc2a3eaf21b2d91d743455) publica código y pesos bajo Apache-2.0; el corpus tiene su propia licencia. El paquete fuente está fijado al SHA `81f51e224ce9e74b02cc2a3eaf21b2d91d743455` (versión declarada 0.2.0).
- [NLLB-200, ficha oficial](https://huggingface.co/facebook/nllb-200-distilled-600M) publica pesos **CC-BY-NC-4.0** y describe el modelo como investigación, no despliegue de producción. Esta integración está restringida a la demo/investigación no comercial autorizada por el usuario; no concede permiso comercial ni certifica conformidad legal. Pesos/tokenizador fijados a [revisión `f8d333a098d19b4fd9a8b18f94170487ad3f821d`](https://huggingface.co/facebook/nllb-200-distilled-600M/commit/f8d333a098d19b4fd9a8b18f94170487ad3f821d).
- [Omnilingual MT, marzo de 2026](https://ai.meta.com/research/publications/omnilingual-mt-machine-translation-for-1600-languages/) es un trabajo **distinto** de Omnilingual ASR. La página oficial/paper consultados enlazan investigación y evaluación BOUQuET; no pudimos verificar un release oficial de pesos, API de inferencia y licencia de modelo instalables. No se inventa aquí un ID `OMT-NLLB` descargable.
- [SeamlessM4T v2, ficha oficial](https://huggingface.co/facebook/seamless-m4t-v2-large) tiene CC-BY-NC-4.0 y su tabla publicada no incluye quechua/aimara; no es sustituto para prometer esta cobertura.
- MMS: [Ayacucho, revisión fijada](https://huggingface.co/facebook/mms-tts-quy/commit/3fa7ac3f7bd06cd5ca8f33267a2744f0f397dc19) y [aimara central, revisión fijada](https://huggingface.co/facebook/mms-tts-ayr/commit/8e79a97785a908d9e84bf7784e03671227d8bb91). Ambos pesos son **CC-BY-NC-4.0**, aproximadamente 36 millones de parámetros cada uno. Se exige `safetensors`, CPU FP32 y código remoto deshabilitado.
- [Qwen2.5-1.5B-Instruct-GGUF oficial](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/a615a81362316d7b9f5a7a9c4313adfdf9b54588), Apache-2.0: archivo `qwen2.5-1.5b-instruct-q4_k_m.gguf`, 1,117,320,736 bytes, SHA-256 `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`. Se verifica tamaño/hash antes de abrirlo con [llama-cpp-python 0.3.36](https://pypi.org/project/llama-cpp-python/0.3.36/). No se permite seleccionar modelos ni URLs mediante peticiones.

## Hardware, modelos y ABI

Predeterminado: `omniASR_LLM_300M_v2`. Su nombre se refiere al encoder; el modelo completo tiene aproximadamente **1.63 mil millones** de parámetros. [La tabla oficial](https://github.com/facebookresearch/omnilingual-asr#model-architectures) indica descarga FP32 de ~6.1 GiB y ~5 GiB de VRAM en su prueba BF16/A100 de 30 segundos. No es una promesa de consumo/latencia para otra GPU. Una GTX 1650 de 4 GB puede no alojarlo; no activar CUDA a ciegas.

Alternativa configurable: `omniASR_CTC_300M_v2` (~1.3 GiB de descarga, ~2 GiB de VRAM en aquella prueba). **CTC no admite condicionamiento de lengua**: el adaptador pasa `lang=None` y devuelve `languageConditioned:false`. La lengua devuelta sigue siendo la seleccionada, no una detección. También se permiten LLM 1B/3B/7B v2 en equipos suficientes. CPU usa float32 y puede ser mucho más lenta; este servicio no mide ni garantiza rendimiento local.

Usar Linux x86_64/Python 3.12 o WSL2. [fairseq2 0.6](https://github.com/facebookresearch/fairseq2/blob/v0.6.0/README.md#variants) no tiene soporte Windows nativo y exige correspondencia **exacta** entre PyTorch y su extensión C++/CUDA. Se fijan Torch/Torchaudio 2.8.0, fairseq2/fairseq2n 0.6 y variantes `cpu` o `cu126`. No actualizar Torch aisladamente. `constraints.txt` fija dependencias directas y del transporte probado; no es un lock transitivo completo con hashes ni una auditoría de dependencias.

Se fijan además `numpy==1.26.4` y `pyarrow==21.0.0`: una instalación sin techo de Arrow llegó a resolver PyArrow 26, cuyo import exige NumPy 2, incompatible con el requisito NumPy <2 de fairseq2. [Arrow 21 documenta Python 3.12 y NumPy 1.x](https://arrow.apache.org/docs/21.0/python/install.html#dependencies) y satisface `pyarrow>=20` de Omnilingual. El Dockerfile ejecuta `pip check` e imports **reales y offline** de ASR, NLLB, VitsModel y Llama. Construye llama.cpp CPU con 2 tareas y sin CUDA ni optimización `native` del host de build. Un error de ABI/import detiene el build; no construye modelos ni descarga pesos. Este preflight no sustituye la inferencia del servicio desplegado.

### Construcción y ejecución (Linux)

Construir una imagen instala dependencias grandes, **no pesos**. Reservar disco/RAM suficientes. El build comprueba imports nativos, pero la disponibilidad y la inferencia se verifican después en el contenedor desplegado.

```sh
cd web/services/indigenous
# CPU, más compatible pero sin garantía de latencia útil.
docker build --build-arg TORCH_VARIANT=cpu -t nawinchay-indigenous .

# O GPU con NVIDIA Container Toolkit y driver compatibles con CUDA 12.6.
# docker build --build-arg TORCH_VARIANT=cu126 -t nawinchay-indigenous .
```

Crear un archivo `.env` privado (no versionarlo):

```dotenv
INDIGENOUS_API_KEY=REEMPLAZAR_POR_SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
INDIGENOUS_ASR_MODEL=omniASR_CTC_300M_v2
INDIGENOUS_DEVICE=cpu
INDIGENOUS_WARMUP=true
ENABLE_RESEARCH_TRANSLATION=true
NLLB_NONCOMMERCIAL_RESEARCH_ACCEPTED=true
# Opcionales; todos son false si se omiten.
ENABLE_RESEARCH_SPEECH=true
MMS_NONCOMMERCIAL_RESEARCH_ACCEPTED=true
ENABLE_LOCAL_READING_LLM=true
```

Las parejas NLLB/MMS solo se activan para investigación/demo **no comercial** confirmada por el usuario. Son independientes: habilitar traducción no habilita síntesis ni diálogo. `ENABLE_LOCAL_READING_LLM` exige autorización operativa y revisión de memoria. Si una función no se necesita, omitir sus indicadores. No transmitir voz infantil sin aprobación de privacidad, consentimiento y restricciones del piloto en la interfaz/proxy y del alojamiento.

```sh
# Primera carga con WARMUP=true puede descargar varios GB.
docker run --rm --env-file .env -p 127.0.0.1:8080:8080 \
  -v nawinchay-model-cache:/home/app/.cache nawinchay-indigenous
# En equipo GPU suficiente, añadir --gpus all y configurar DEVICE=cuda.
```

Solo la caché de **pesos** persiste en ese volumen; la aplicación no escribe voz ni texto de petición allí. Revisar además swap, crash dumps, logs y copias del proveedor: memoria efímera de aplicación no equivale a una garantía contractual del alojamiento. No habilitar capturas de cuerpos HTTP ni trazas que registren voz/texto.

Publicar mediante HTTPS privado con límite de peticiones, control de acceso y límites de gasto/recursos. Un bearer compartido y un semáforo no son autenticación individual ni una cuota distribuida. No exponer el puerto 8080 directamente a Internet. Solo el servidor Next.js conoce `INDIGENOUS_API_KEY`.

## Carga inicial y disponibilidad real

- `GET /health` **no carga pesos**. `asr.ready:false` significa que el modelo todavía no está en memoria, no que esté funcionando.
- `INDIGENOUS_WARMUP=true` inicia carga en un hilo al arrancar; `loading:true` y después `ready:true` reflejan el estado real. Si falla, `lastError:"model-load-failed"` y `ready:false`.
- Calentar antes de vincular Vercel. Una primera petición fría puede descargar GB y exceder el timeout del proxy; no se promete que complete en 40–60 segundos.
- Si se omite warmup, la primera petición válida carga el modelo de forma perezosa. Las peticiones concurrentes reciben `503 model-busy`, no se encolan sin límite. Una desconexión HTTP no puede interrumpir de forma segura un kernel de PyTorch ya iniciado.
- Un worker por proceso conserva una copia de cada modelo. `ready:true` solo confirma carga, **no** una prueba de calidad o exactitud.
- MMS y Qwen son siempre perezosos: warmup solo carga ASR y NLLB habilitado. `speech.enabled`/`dialogue.enabled` permiten solicitar la primera carga aunque `ready:false`; esa llamada fría puede exceder el timeout HTTP. Calentar con texto público adulto antes de abrir la demo. Solo un MMS permanece en memoria y se libera al cambiar de lengua.
- ASR, NLLB, MMS y Qwen comparten el mismo semáforo. Qwen usa 2 hilos/contexto 2048 y conserva solo pesos; no guarda historial ni prompts. La caché de archivos del sistema puede elevar la memoria de cgroup sin equivaler a RSS anónimo; medir `anon/file`, picos y OOM antes de aumentar límites del servicio propio.

## Contrato HTTP privado

Todas las rutas de la API requieren `Authorization: Bearer <INDIGENOUS_API_KEY>`; falta de configuración devuelve 503 y credencial incorrecta 401. La única excepción es `GET /` / `HEAD /`, una sonda pública del proceso sin configuración ni disponibilidad de modelos. Se usa `Cache-Control: no-store, private`. No hay CORS público, documentación Swagger ni logs de acceso en el comando de arranque.

### GET `/health`

Devuelve `configured`, `asr`, `translation`, `speech` y `dialogue`. Cada bloque contiene estado real de carga/error y modelo. `speech.ready` es `{quy_Latn:boolean,ayr_Latn:boolean}`; `dialogue.mode` es `local-llm-reading`. `asr.wordTimestamps` anuncia la implementación CTC admitida, no exactitud comprobada. Un modelo cargado incompatible desactiva esa capacidad. Health nunca descarga ni ejecuta modelos.

### POST `/transcribe`

`multipart/form-data`: exactamente `file` (WAV PCM16 mono 16 kHz) y `language` (uno de los cuatro códigos ASR). Archivo máximo 1,000,000 bytes, cuerpo máximo 1,010,000 bytes, duración real 0.1–30 segundos. No se confía solo en MIME/extensión o duración declarada: se valida el WAV decodificado y su conteo de frames. Los cuerpos se limitan antes de parsear multipart, por debajo del umbral de escritura temporal a disco. Un audio silencioso/inválido no produce una puntuación cero ni una transcripción simulada.

```sh
curl -H "Authorization: Bearer $INDIGENOUS_API_KEY" \
  -F file=@turno.wav -F language=quy_Latn http://127.0.0.1:8080/transcribe
```

Respuesta (forma ilustrativa, no resultado ejecutado):

```json
{"text":"texto reconocido en su lengua original","language":"quy_Latn","model":"omniASR_LLM_300M_v2","durationSeconds":4.2,"wordTimestamps":false,"languageConditioned":true,"requiresHumanReview":true}
```

[La API oficial](https://github.com/facebookresearch/omnilingual-asr/blob/81f51e224ce9e74b02cc2a3eaf21b2d91d743455/src/omnilingual_asr/models/inference/pipeline.py) es `ASRInferencePipeline(...).transcribe(audio_inputs, lang=[code], batch_size=1) -> list[str]`. No entrega timestamps/confianza por palabra a este contrato ni garantiza alineación acústica. No fabricar tiempos uniformes para aparentar seguimiento real. [Su guía](https://github.com/facebookresearch/omnilingual-asr/blob/81f51e224ce9e74b02cc2a3eaf21b2d91d743455/src/omnilingual_asr/models/inference/README.md) recomienda segmentos cortos; el MVP limita a 30 segundos y no expone streaming de palabras.

### POST `/transcribe-timed`

Mismos campos/WAV, pero **0.1–15 segundos**, solo `omniASR_CTC_300M_v2`. Un hook temporal captura los logits del **mismo y único forward** que usa `pipeline.transcribe`; siempre se retira. Se colapsan repeticiones/blanks CTC y se decodifican prefijos con el tokenizador real. Una salida no append-only, vocabulario/geometría incompatible, múltiples forwards o texto/tiempos discrepantes falla `503 timed-asr-unavailable`: nunca se rellena con tiempos uniformes.

Se verifica la [geometría convolucional fijada](https://github.com/facebookresearch/fairseq2/blob/v0.6.0/src/fairseq2/models/wav2vec2/config.py): hop 320 y campo receptivo 400 muestras a 16 kHz. Inicio = `primerFrame*320/16000`; fin = `(últimoFrame*320+400)/16000`, acotado al audio. La respuesta añade `words:[{word,start,end,confidence:null}]`, `wordTimestamps:true`, `timingMethod:"ctc-greedy-frames"`, `languageConditioned:false`; las palabras reconstruyen exactamente el texto normalizado. Son **tiempos estimados de emisión**, no fronteras fonéticas, forced alignment de la referencia ni evidencia validada de fluidez infantil. El cliente puede comparar texto reconocido y referencia, sin convertir esa comparación en alineación acústica.

Lectura en ventanas cortas (por ejemplo 4 s) permite actualizaciones **después** de captura+inferencia; no es streaming de baja latencia garantizada. Medir CPU y demoras reales, conservar pausas y no transcribir silencio como evidencia.

### POST `/translate`

`application/json`, exactamente:

```json
{"text":"texto de una oración","sourceLanguage":"quy_Latn","targetLanguage":"spa_Latn"}
```

Respuesta contiene `text` (solo traducción), códigos origen/destino, `model`, `researchOnly:true` y `requiresHumanReview:true`. La UI debe conservar el texto original por separado. Máximo 1500 caracteres y 256 tokens de entrada; no truncar silenciosamente. Los códigos permitidos corresponden a [FLORES-200 oficial](https://github.com/facebookresearch/flores/blob/main/flores200/README.md). `quz_Latn` devuelve 422: Cusco no se convierte automáticamente en Ayacucho.

### POST `/dialogue`

JSON exacto `{passage,heardSpanish,history?}`: pasaje castellano y pregunta de 1–1500 caracteres cada uno; historial máximo 6 entradas exactas `{role:"user"|"assistant",text}` de 1–600 caracteres, total 2500. Rechaza roles `system`, controles, delimitadores ChatML y campos desconocidos. El historial se incorpora como datos no confiables en un solo mensaje, no como instrucciones privilegiadas. Esto reduce superficie de inyección, no garantiza obediencia del modelo.

Respuesta `{replySpanish,model:"Qwen/Qwen2.5-1.5B-Instruct-GGUF",dialogueMode:"local-llm-reading",requiresHumanReview:true}`. ChatML fijo, contexto 2048, máximo 64 tokens, temperatura 0.3 y respuesta ≤300 caracteres; contexto/salida excesivos se rechazan, no se truncan. El KV lógico se reinicia tras cada solicitud; no hay `save_state` ni persistencia de historial. No tiene herramientas ni Internet. El prompt limita respuestas al pasaje, sin notas ni emociones/identidad/salud. **Revisión humana sigue siendo obligatoria**, no hay filtro semántico infalible. Si está habilitado y falla, se devuelve error; no se oculta con un guion de conversación.

### POST `/speak`

JSON exacto `{text,language}`: texto 1–300 caracteres y lengua `quy_Latn` o `ayr_Latn`; máximo 768 tokens (incluidos blanks VITS). No acepta `quz_Latn`, `aym` ni castellano. Devuelve WAV PCM16 mono 16 kHz, ≤30 s/2 MB, y cabeceras `X-Speech-Model`, `X-Speech-Language`, `X-Speech-Research-Only:true`, `X-Speech-Duration` en segundos reales del WAV. Un hook sobre el predictor de duración comprueba el límite **antes** de la expansión latente; no recorta audio ni inventa síntesis si falla.

La cadena conversacional nativa es ASR original → NLLB al castellano → Qwen → NLLB a la lengua seleccionada → MMS. Cada componente es distinto, con latencia y errores acumulados. No afirmar conversación óptima ni calidad local validada sin pruebas de hablantes. La demo OpenAI `/voz` sigue siendo otra función independiente.

Errores: `{"error":"código-estable"}` sin voz, texto de petición, claves, paths ni detalles internos. 400 JSON inválido; 413 exceso de tamaño; 415 formato; 422 audio/lengua no observable; 403 traducción de investigación deshabilitada; 503 carga/inferencia ocupada o fallida. Usar revisión humana y **No observable** cuando corresponda.

## Pruebas ligeras, sin descargar modelos

```sh
python3.12 -m venv .venv-test
. .venv-test/bin/activate
pip install -r requirements-test.txt
python -B -m unittest discover -s tests -v
```

123 pruebas cubren autorización, WAV real, límites/chunks, independencia de funciones, revisión humana, variantes, multipart en RAM, errores, semáforo, liveness, secretos por archivo, readiness, fuentes comprometidas por allowlist, pins/preflight, colapso CTC/Unicode/tiempos, hooks y limpieza, MMS/LRU/duración, diálogo/contexto/historial no privilegiado y salida sin truncamiento. **No prueban calidad de los modelos**, latencia, memoria nativa ni compilación del contenedor. En el sandbox Windows de Codex, `asyncio` puede bloquear al abrir su socket interno; las pruebas HTTP se ejecutaron con permiso fuera de ese sandbox, sin llamadas a modelos.
