# Meta/NLLB en el Dokploy existente del VPS

Esta ruta usa **un servicio Compose nuevo**; no cambia despliegues, redes, dominios ni variables de Fixazo. La autenticación y el inventario del VPS se confirmaron por el operador: aproximadamente 16.78 GB RAM (4.55 GB usados), 4 CPU y disco 211 GB (45.7 GB usados). Es una instantánea, no una reserva de recursos.

Configuración base: **Omnilingual CTC-300M v2 en CPU + NLLB-600M FP32**, límite `7g` (7 GiB: 7,516,192,768 bytes), 2 CPU y 2 hilos. El margen de la instantánea inicial no es garantía actual: medir consumo, caché y aplicaciones existentes antes de añadir modelos. No cambiar a LLM-ASR ni elevar límites automáticamente. CTC no condiciona por lengua; `/transcribe-timed` añade estimaciones de frames reales, no forced alignment. MMS y Qwen son opcionales y perezosos.

## Fuente y rutas exactas

- Crear un proyecto/servicio Docker Compose independiente en Dokploy; **no Docker Stack**, porque esta configuración usa `build`.
- Service name para el dominio: **`meta`**; puerto interno **`8080`**.
- El operador comprobó que los proveedores GitHub disponibles no pueden leer este repositorio privado. La ruta seleccionada es **Raw Compose + File Mounts de fuentes comprometidas**, sin solicitar ni extraer un PAT y sin modificar esos proveedores.
- La plantilla versionada sigue siendo `web/services/indigenous/compose.dokploy.yaml`; su adaptación raw solo cambia el contexto de build y entrega los diez archivos necesarios.

### Preparar el payload sin credenciales ni llamadas de red

Después de que el operador haga commit de todos los archivos del backend:

```sh
python -B web/services/indigenous/prepare_dokploy.py \
  --compose-id ID_DEL_SERVICIO_COMPOSE_NUEVO > outputs/dokploy-source.json
```

El generador resuelve **Git HEAD una sola vez** y lee sus blobs, no el árbol de trabajo ni archivos `.env`, cachés o almacenes de credenciales. Falla si falta algún archivo en ese commit. No hace commit, push, llamadas HTTP, cambios de infraestructura ni interpolación de variables. El JSON es un artefacto privado de operación, **no** un archivo para versionar.

El objeto resultante contiene exactamente:

- `composeFile`: la plantilla con su **único** `build.context: .` cambiado a `../files/indigenous`; el secreto sigue siendo `${INDIGENOUS_API_KEY:?...}`, nunca su valor.
- `mounts`: diez objetos `type:file`, `serviceType:compose`, `serviceId:<ID nuevo>`, con `filePath:indigenous/<archivo>`, `mountPath:/tmp/build-source/<archivo>` y el contenido comprometido.
- `sha256s`: hash SHA-256 del contenido UTF-8 de cada archivo para comprobar la entrega.

La allowlist es **Dockerfile, requirements.txt, requirements-models.txt, constraints.txt, app.py, core.py, healthcheck.py, ctc_timing.py, speech.py y dialogue.py**. No admite nombres arbitrarios, `../`, `.env`, tokens, modelos, pruebas ni el resto de Fixazo. Los mount targets quedan dentro de `/tmp`, que este contenedor ya tiene como tmpfs escribible; la imagen copia el código a `/service` durante el build y no depende de estos duplicados para ejecutar la API.

El operador aplica `composeFile` al **servicio raw nuevo** y crea cada entrada de `mounts` por la API de mounts verificada de Dokploy. `sha256s` es evidencia local, no un campo que deba enviarse a esa API. No reenviar el objeto completo indiscriminadamente ni editar los servicios existentes.

En la ruta raw comprobada por el operador para Dokploy 0.30.8, los mounts se materializan así antes del build:

```text
<COMPOSE_PATH>/<app>/code/docker-compose.yml
<COMPOSE_PATH>/<app>/code/.env                 # entorno privado del gestor
<COMPOSE_PATH>/<app>/files/indigenous/Dockerfile
<COMPOSE_PATH>/<app>/files/indigenous/...      # los otros nueve archivos
```

El comando usa `--project-directory <...>/code`; por eso `../files/indigenous` apunta al contexto correcto, sin incluir `.env` en el contexto. No desplegar raw únicamente con el YAML: **los diez mounts deben estar materializados antes de construir**. El uso de `../files` y los mounts administrados está documentado en [Docker Compose de Dokploy](https://docs.dokploy.com/docs/core/docker-compose).

### Referencia de la plantilla GitHub

`build.context: .` y `dockerfile: Dockerfile` se resuelven desde la carpeta de este Compose al ejecutarlo como `-f <checkout>/web/services/indigenous/compose.dokploy.yaml`. No usar `context: ./web/services/indigenous` dentro de ese archivo, pues duplicaría el subdirectorio. Antes de desplegar, comprobar en **Preview Compose** y el comando real que Dokploy conserva esa base. Si una versión del gestor reubica el YAML, revisar su base explícitamente en lugar de desplegar con un contexto equivocado. [Compose y configuración de Dokploy](https://docs.dokploy.com/docs/core/docker-compose).

Se verificó localmente con Docker Compose v5.1.4, sin daemon ni despliegue, desde una raíz de checkout ficticia y `-f web/services/indigenous/compose.dokploy.yaml config --format json`. Los cuatro casos usaron la clave **dummy** del `.env` junto al YAML: sin `.env` raíz, con `.env` raíz ajeno, con una clave raíz en conflicto y con `--env-file` explícito. Todos resolvieron el contexto a la carpeta del servicio, traducción habilitada, 2 CPU y el límite de memoria esperado. La prueba no usa claves reales ni demuestra inferencia; su informe local está en `outputs/compose-env-test/results.json`.

## Variables de Dokploy: secreto del backend, no del navegador

Configurar en el almacén de entorno/secretos del **servicio nuevo**:

```dotenv
INDIGENOUS_API_KEY=GENERAR_Y_GUARDAR_COMO_SECRETO_NO_VERSIONAR
INDIGENOUS_ASR_MODEL=omniASR_CTC_300M_v2
INDIGENOUS_MEMORY_LIMIT=7g
INDIGENOUS_CPU_LIMIT=2
INDIGENOUS_TORCH_THREADS=2
ENABLE_RESEARCH_TRANSLATION=true
NLLB_NONCOMMERCIAL_RESEARCH_ACCEPTED=true
# Opcionales autorizados; revisar memoria. False por defecto.
ENABLE_RESEARCH_SPEECH=true
MMS_NONCOMMERCIAL_RESEARCH_ACCEPTED=true
ENABLE_LOCAL_READING_LLM=true
INDIGENOUS_IMAGE_TAG=nawinchay-meta:REVISION_NUEVA
```

El valor de `INDIGENOUS_API_KEY` debe ser aleatorio, 32–512 caracteres ASCII imprimibles sin espacios. El marcador anterior no es una clave para usar. No añadir `INDIGENOUS_API_KEY_FILE`: esta variante utiliza el secreto de Dokploy por entorno; la variante manual `compose.vps.yaml` utiliza archivo. La app falla si recibe ambos.

Las variables declaradas en la interfaz Dokploy se interpolan **explícitamente** en el YAML; no se presupone que el gestor inyecte todo el `.env` en el contenedor. Ese almacén es privado y Dokploy puede materializarlo en un archivo `.env` del despliegue: no imprimir `Preview Compose` interpolado, `docker inspect`, entornos ni respuestas administrativas con la clave. Las banderas NLLB corresponden únicamente a la investigación/demo no comercial que confirmó el usuario.

## Dominio y aislamiento

Añadir solo el dominio/subdominio autorizado a **Domains** del servicio nuevo, destino `meta`, puerto `8080`, usando el Traefik que Dokploy ya administra. El YAML no publica puertos del host ni contiene Caddy ni etiquetas Traefik manuales. Dokploy añade las etiquetas/red del dominio durante el despliegue; verificar esa modificación en su preview sin divulgar secretos. No editar la configuración global del proxy ni los dominios existentes. [Dominios Compose oficiales](https://docs.dokploy.com/docs/core/docker-compose/domains).

El proceso escucha en 8080; `/` es solo liveness público. `/health`, `/transcribe`, `/transcribe-timed`, `/translate`, `/speak` y `/dialogue` requieren bearer. El volumen nombrado guarda pesos, no voz/texto, y pertenece al proyecto Compose nuevo. No mapear carpetas de Fixazo ni directorios absolutos de otras aplicaciones como caché.

## Build, carga y pruebas reales

1. Confirmar que el commit nuevo está publicado en la rama correcta, generar su payload y comprobar/materializar los diez mounts en el servicio raw nuevo. No depender de un proveedor GitHub que no tenga acceso.
2. Desplegar solo este servicio. La imagen instala Torch/Torchaudio 2.8.0 CPU + fairseq2/fairseq2n 0.6 y Omnilingual fijado por SHA. El build descarga dependencias grandes, no pesos. Los límites `mem_limit`/`cpus` del servicio son de ejecución y no garantizan límites equivalentes del proceso de build; supervisar también ese consumo sin cambiar aplicaciones existentes.
3. El arranque, con warmup explícito, descarga y carga **ambos modelos** porque la traducción está habilitada. `/` puede responder antes de eso. Consultar `/health` con la clave en memoria y esperar `asr.ready:true`, `translation.enabled:true` y `translation.ready:true`, sin copiar secretos a logs.
4. Medir consumo/tiempo y revisar `OOMKilled` o errores. El healthcheck no hace inferencia y un contenedor vivo no prueba que Meta funciona. Si fallan límites, no aumentarlos ni reiniciar otras apps sin revisar el margen.
5. Traducir una oración pública conocida y transcribir audio **adulto/sintético** conocido. Comparar el texto real con la referencia. Mantener el original separado de su traducción; `quz_Latn` no se sustituye por `quy_Latn` para NLLB.
6. Solo tras esas pruebas, configurar **Vercel**: `INDIGENOUS_BACKEND_URL` con el dominio HTTPS, `INDIGENOUS_BACKEND_TOKEN` con la misma clave y `INDIGENOUS_TRANSLATION_RESEARCH_ONLY=true`. Las variables `INDIGENOUS_API_KEY`/`_FILE` son del backend Python, no el contrato del proxy Next.js.
7. Comprobar el recorrido desde Vercel y su timeout, no solo un acceso local del VPS. Mantener controles de demo/piloto, consentimiento y revisión lingüística. No probar con voz infantil como atajo.

No usar datos de niños para confirmar que el contenedor arranca. No registrar audio, transcripciones, texto de petición ni cabeceras. Si se necesita revertir, usar la imagen/revisión previa del **servicio nuevo** sin borrar su caché ni modificar otros proyectos.

## Estado de verificación

La preparación local prueba contratos, configuración, autorizaciones y recursos previstos. **No equivale a build Linux exitoso ni a inferencia real**; registrar por separado el resultado del despliegue, disponibilidad real, duración y exactitud de las dos pruebas. No afirmar que una plantilla Compose ya conectó Vercel.

## Lectura temporizada, MMS y diálogo local opcionales

- `/transcribe-timed`: WAV hasta 15 s, solo CTC-300M v2, palabras desde el mismo forward. Método `ctc-greedy-frames`, no tiempos uniformes ni alineación forzada. Ventanas de 4 s no garantizan baja latencia.
- MMS exige las dos banderas de síntesis. Solo Ayacucho `quy` y aimara central `ayr`, CC-BY-NC-4.0; una lengua residente. Qwen exige `ENABLE_LOCAL_READING_LLM=true`: GGUF oficial Q4_K_M de 1,117,320,736 bytes, verificado por SHA, contexto 2048, 2 hilos y salida máxima 64 tokens/300 caracteres. No es un modelo Meta ni evalúa emociones.
- Los modelos nuevos cargan solo ante petición válida habilitada. `enabled:true,ready:false` indica una función aún fría, no inferencia comprobada. El healthcheck conserva el contrato ASR/NLLB de warmup. Probar con texto/audio público adulto y registrar latencia, respuesta, memoria `anon/file`, picos y OOM; revisar cada lengua con hablante competente.
- El build incluye compilación CPU de llama-cpp-python y preflight offline de Llama/VitsModel. Mantener inicialmente 7 GiB/2 CPU; un aumento requiere inventario **actual** y solo afecta este servicio. Caché de archivos ocupando el cgroup no equivale a RSS anónimo ni demuestra que todos los modelos caben.
- Historial solo en RAM por solicitud, máximo 6 entradas; sin logs/caché de mensajes. Fallos de modelos habilitados son errores explícitos, no respuestas fingidas. Ver [README](README.md) para límites, pins, licencias y contratos completos.
