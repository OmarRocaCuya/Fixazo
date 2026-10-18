# Servicio privado Meta: voz indígena y traducción de investigación

Este servicio de referencia usa un **proceso Linux separado del servidor Next.js** para conservar modelos en memoria. El usuario eligió su VPS con Dokploy: ver [DEPLOY_DOKPLOY.md](DEPLOY_DOKPLOY.md); la [guía Compose manual](DEPLOY_VPS.md) queda como alternativa operativa. No se han descargado pesos ni comprobado inferencia real en este entorno. Las pruebas usan dobles de modelo, no resultados inventados. No se afirma que cualquier modalidad de contenedores de Vercel sea técnicamente imposible; esta versión FP32 conjunta no está validada bajo sus cuotas.

## Qué hace cada modelo

| Función | Modelo y cobertura de esta integración | Límite importante |
|---|---|---|
| Transcribir voz en su lengua original | Omnilingual ASR v2: `spa_Latn`, `quy_Latn` (Ayacucho), `quz_Latn` (Cusco), `ayr_Latn` (aimara central) | No traduce, no es agente conversacional ni TTS; devuelve texto final, no tiempos por palabra. |
| Traducir texto, de forma separada | `facebook/nllb-200-distilled-600M`: `spa_Latn`, `quy_Latn`, `ayr_Latn`, en ambas direcciones | Solo investigación/demo **no comercial**; desactivado hasta aceptar ambos indicadores. No soportamos `quz_Latn` ni lo renombramos como Ayacucho. |
| Conversar y sintetizar voz | No implementado aquí | La demo OpenAI `/voz` es otra función; no significa que Meta esté haciendo conversación o síntesis quechua. |

La lengua la declara el usuario: no se presenta como detección verificada. Se requiere revisión de un hablante/docente competente. La traducción no reemplaza ni corrige la evidencia original de lectura. No se infieren emociones, identidad, acento, salud ni capacidades. Soporte en la lista de un modelo no demuestra calidad en niños bilingües, variantes locales o mezcla castellano/quechua.

### Licencias y alternativas recientes

- [Omnilingual ASR](https://github.com/facebookresearch/omnilingual-asr/tree/81f51e224ce9e74b02cc2a3eaf21b2d91d743455) publica código y pesos bajo Apache-2.0; el corpus tiene su propia licencia. El paquete fuente está fijado al SHA `81f51e224ce9e74b02cc2a3eaf21b2d91d743455` (versión declarada 0.2.0).
- [NLLB-200, ficha oficial](https://huggingface.co/facebook/nllb-200-distilled-600M) publica pesos **CC-BY-NC-4.0** y describe el modelo como investigación, no despliegue de producción. Esta integración está restringida a la demo/investigación no comercial autorizada por el usuario; no concede permiso comercial ni certifica conformidad legal. Pesos/tokenizador fijados a [revisión `f8d333a098d19b4fd9a8b18f94170487ad3f821d`](https://huggingface.co/facebook/nllb-200-distilled-600M/commit/f8d333a098d19b4fd9a8b18f94170487ad3f821d).
- [Omnilingual MT, marzo de 2026](https://ai.meta.com/research/publications/omnilingual-mt-machine-translation-for-1600-languages/) es un trabajo **distinto** de Omnilingual ASR. La página oficial/paper consultados enlazan investigación y evaluación BOUQuET; no pudimos verificar un release oficial de pesos, API de inferencia y licencia de modelo instalables. No se inventa aquí un ID `OMT-NLLB` descargable.
- [SeamlessM4T v2, ficha oficial](https://huggingface.co/facebook/seamless-m4t-v2-large) tiene CC-BY-NC-4.0 y su tabla publicada no incluye quechua/aimara; no es sustituto para prometer esta cobertura.

## Hardware, modelos y ABI

Predeterminado: `omniASR_LLM_300M_v2`. Su nombre se refiere al encoder; el modelo completo tiene aproximadamente **1.63 mil millones** de parámetros. [La tabla oficial](https://github.com/facebookresearch/omnilingual-asr#model-architectures) indica descarga FP32 de ~6.1 GiB y ~5 GiB de VRAM en su prueba BF16/A100 de 30 segundos. No es una promesa de consumo/latencia para otra GPU. Una GTX 1650 de 4 GB puede no alojarlo; no activar CUDA a ciegas.

Alternativa configurable: `omniASR_CTC_300M_v2` (~1.3 GiB de descarga, ~2 GiB de VRAM en aquella prueba). **CTC no admite condicionamiento de lengua**: el adaptador pasa `lang=None` y devuelve `languageConditioned:false`. La lengua devuelta sigue siendo la seleccionada, no una detección. También se permiten LLM 1B/3B/7B v2 en equipos suficientes. CPU usa float32 y puede ser mucho más lenta; este servicio no mide ni garantiza rendimiento local.

Usar Linux x86_64/Python 3.12 o WSL2. [fairseq2 0.6](https://github.com/facebookresearch/fairseq2/blob/v0.6.0/README.md#variants) no tiene soporte Windows nativo y exige correspondencia **exacta** entre PyTorch y su extensión C++/CUDA. Se fijan Torch/Torchaudio 2.8.0, fairseq2/fairseq2n 0.6 y variantes `cpu` o `cu126`. No actualizar Torch aisladamente. `constraints.txt` fija dependencias directas y del transporte probado; no es un lock transitivo completo con hashes ni una auditoría de dependencias.

### Construcción y ejecución (Linux)

Construir una imagen instala dependencias grandes, **no pesos**. Reservar disco/RAM suficientes; no se ha construido esta imagen en esta sesión.

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
```

Los dos últimos indicadores solo se activan para el uso de investigación/demo **no comercial** confirmado por el usuario. Si no se necesita traducción, omitirlos. No transmitir voz infantil sin aprobación de privacidad, consentimiento y restricciones del piloto en la interfaz/proxy y en el operador del alojamiento.

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

## Contrato HTTP privado

Todas las rutas de la API requieren `Authorization: Bearer <INDIGENOUS_API_KEY>`; falta de configuración devuelve 503 y credencial incorrecta 401. La única excepción es `GET /` / `HEAD /`, una sonda pública del proceso sin configuración ni disponibilidad de modelos. Se usa `Cache-Control: no-store, private`. No hay CORS público, documentación Swagger ni logs de acceso en el comando de arranque.

### GET `/health`

```json
{"configured":true,"asr":{"ready":false,"loading":false,"lastError":null,"model":"omniASR_LLM_300M_v2","languages":["spa_Latn","quy_Latn","quz_Latn","ayr_Latn"],"languageConditioned":true,"wordTimestamps":false,"sourceRevision":"81f51e224ce9e74b02cc2a3eaf21b2d91d743455"},"translation":{"ready":false,"enabled":false,"loading":false,"lastError":null,"model":"facebook/nllb-200-distilled-600M","languages":["spa_Latn","quy_Latn","ayr_Latn"],"researchOnly":true}}
```

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

### POST `/translate`

`application/json`, exactamente:

```json
{"text":"texto de una oración","sourceLanguage":"quy_Latn","targetLanguage":"spa_Latn"}
```

Respuesta contiene `text` (solo traducción), códigos origen/destino, `model`, `researchOnly:true` y `requiresHumanReview:true`. La UI debe conservar el texto original por separado. Máximo 1500 caracteres y 256 tokens de entrada; no truncar silenciosamente. Los códigos permitidos corresponden a [FLORES-200 oficial](https://github.com/facebookresearch/flores/blob/main/flores200/README.md). `quz_Latn` devuelve 422: Cusco no se convierte automáticamente en Ayacucho.

Errores: `{"error":"código-estable"}` sin voz, texto de petición, claves, paths ni detalles internos. 400 JSON inválido; 413 exceso de tamaño; 415 formato; 422 audio/lengua no observable; 403 traducción de investigación deshabilitada; 503 carga/inferencia ocupada o fallida. Usar revisión humana y **No observable** cuando corresponda.

## Pruebas ligeras, sin descargar modelos

```sh
python3.12 -m venv .venv-test
. .venv-test/bin/activate
pip install -r requirements-test.txt
python -B -m unittest discover -s tests -v
```

42 pruebas cubren autorización, validación WAV real, límites de carga/chunks, independencia de traducción/ASR, revisión humana, variante no intercambiable, in-memory multipart, carga real/errores, exclusión mutua, liveness sin datos, secretos por archivo, readiness, contratos Dokploy y payload de fuentes comprometidas por allowlist. **No prueban calidad del modelo**, latencia, memoria de GPU ni compilación del contenedor. En el sandbox Windows de Codex, `asyncio` puede bloquear al abrir su socket interno; las pruebas HTTP se ejecutaron con permiso fuera de ese sandbox, sin llamadas a modelos.
