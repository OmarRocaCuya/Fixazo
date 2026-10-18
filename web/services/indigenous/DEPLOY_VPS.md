# Despliegue aislado en el VPS del usuario

El usuario eligió su VPS; el operador confirmó acceso e inventario y seleccionó **Dokploy**, cuya guía está en [DEPLOY_DOKPLOY.md](DEPLOY_DOKPLOY.md). Este documento conserva la alternativa Compose manual; no ejecutarla además del servicio administrado. No instala Caddy/Nginx ni cambia Fixazo.

## Antes de arrancar

Confirmar con el operador: SSH/puerto, arquitectura Linux x86_64, CPU/RAM/disco disponibles **descontando aplicaciones existentes**, Docker + Compose, puerto local libre, dominio y proxy actuales. Verificar identidad del host SSH; no desactivar comprobaciones de claves.

- `compose.vps.yaml` crea un proyecto independiente `nawinchay-meta` y publica **solo `127.0.0.1:18080`**. No ocupa 80/443 ni expone directamente la API a Internet.
- CPU y RAM son obligatorias: `INDIGENOUS_CPU_LIMIT`, `INDIGENOUS_MEMORY_LIMIT`. No hay un valor por defecto que pueda consumir la memoria de otras apps.
- El modelo también es una elección obligatoria: `INDIGENOUS_ASR_MODEL`. No arrancar LLM-ASR porque su nombre diga 300M: su modelo completo ocupa mucho más que CTC. CPU CTC-300M + NLLB-600M es un candidato más ligero, pero requiere medición real y conserva las limitaciones lingüísticas documentadas.
- Una sola instancia/worker, semáforo de inferencia, root filesystem de solo lectura, caché de pesos separada, sin capacidades de Linux adicionales y logs rotados. El límite de memoria puede producir OOM si es insuficiente; no interpretar un reinicio como prueba de que el modelo funciona.

## Preparar configuración privada fuera de Git

El operador crea un directorio dedicado fuera del checkout, por ejemplo `/etc/nawinchay-meta/`, de acceso restringido. No subir contraseñas, claves SSH ni `.env` al repositorio.

El secreto puede entregarse por archivo Docker: `INDIGENOUS_KEY_FILE=/etc/nawinchay-meta/api.key`. Debe ser aleatorio, 32–512 caracteres ASCII imprimibles sin espacios, y no imprimirse en consola ni incluirse como argumento CLI. No sobrescribir una clave ya usada por otro despliegue. Docker ejecuta la app como UID/GID **1000**: el archivo fuente del secreto debe ser legible para ese UID al montarlo, por ejemplo propietario `1000:1000`, modo `0400`, dentro del directorio del host restringido al administrador. Compose monta archivos; no asumir que una propiedad `uid` ignorada cambiará sus permisos. [Secretos en Compose](https://docs.docker.com/compose/how-tos/use-secrets/).

La app lee `/run/secrets/indigenous_api_key` mediante `INDIGENOUS_API_KEY_FILE`. Si se configuraran a la vez archivo y `INDIGENOUS_API_KEY`, falla cerrada para evitar una credencial ambigua. Un archivo ilegible no se convierte en acceso público. No imprimir `docker inspect` ni entornos de procesos con secretos.

Crear también `/etc/nawinchay-meta/deploy.env` privado. Contiene configuración y la **ruta**, no el contenido del secreto:

```dotenv
INDIGENOUS_KEY_FILE=/etc/nawinchay-meta/api.key
INDIGENOUS_IMAGE_TAG=nawinchay-meta:release-revisada
INDIGENOUS_BIND_PORT=18080
INDIGENOUS_MEMORY_LIMIT=ELEGIR_TRAS_REVISAR_RAM
INDIGENOUS_CPU_LIMIT=ELEGIR_TRAS_REVISAR_CPU
INDIGENOUS_ASR_MODEL=ELEGIR_CTC_O_LLM_TRAS_REVISAR_RAM
INDIGENOUS_TORCH_THREADS=2
ENABLE_RESEARCH_TRANSLATION=true
NLLB_NONCOMMERCIAL_RESEARCH_ACCEPTED=true
```

Los valores `ELEGIR_…` son marcadores, no configuración ejecutable. El usuario confirmó investigación/demo no comercial; eso justifica los dos indicadores NLLB para esta demo, no una licencia comercial. No activar voz infantil sin el consentimiento/política del piloto correspondientes.

## Validar, construir y arrancar tras aprobación de recursos

Copiar únicamente esta carpeta de servicio al directorio de despliegue autorizado; no copiar `.test-deps`, `build`, `.env`, cachés, pesos, claves ni el proyecto Fixazo completo. Desde la carpeta del servicio en el VPS:

```sh
# Validación de configuración: no arranca ni modifica contenedores.
docker compose --env-file /etc/nawinchay-meta/deploy.env \
  -f compose.vps.yaml config --quiet

# Solo después de revisar recursos, permisos y puerto libre:
docker compose --env-file /etc/nawinchay-meta/deploy.env \
  -f compose.vps.yaml build
docker compose --env-file /etc/nawinchay-meta/deploy.env \
  -f compose.vps.yaml up -d
```

El build descarga dependencias ML grandes, pero no pesos. `up` activa **warmup real de ASR y de NLLB si está habilitado**, descargando GB al volumen de caché. No ejecutar estos pasos como un supuesto diagnóstico inocuo. El servicio reinicia con `unless-stopped` si cae; el estado `unhealthy` por sí solo no hace que Docker lo reinicie.

## Disponibilidad e inferencia reales

`GET /` solo prueba que el proceso vive. El healthcheck del contenedor consulta `/health` con la clave leída del archivo, **sin imprimirla ni ejecutar inferencia**. Solo devuelve éxito si ASR está cargado y cualquier traducción habilitada también lo está. Durante la carga inicial permanece `starting`; hay 30 minutos de tolerancia configurada, no una promesa de que la descarga termine en ese plazo.

```sh
docker compose --env-file /etc/nawinchay-meta/deploy.env \
  -f compose.vps.yaml ps
docker compose --env-file /etc/nawinchay-meta/deploy.env \
  -f compose.vps.yaml exec -T meta python -B healthcheck.py
```

Estado `healthy` confirma carga, **no exactitud**. Antes de vincular Vercel:

1. Traducir una oración pública conocida castellano ↔ Ayacucho/aimara, revisar el resultado con hablante competente y medir duración.
2. Transcribir un WAV adulto/sintético conocido, mono PCM16/16 kHz/≤30 segundos; comparar contra su transcripción de referencia y medir tiempo/RAM.
3. Comprobar errores 401 sin clave, 422 ante lengua no soportada/audio inválido y rechazo de `quz_Latn` para NLLB; nunca simular resultados para una pantalla verde.
4. Probar el mismo recorrido desde Vercel dentro de su timeout. Si CPU tarda demasiado, mostrar indisponibilidad o diseñar trabajos asíncronos; no inventar timestamps ni llamar óptimo a un modelo no medido.

No registrar audio, texto de peticiones ni cabeceras de autorización en el proxy ni en herramientas de observabilidad. El volumen solo debe contener pesos. Revisar swap, core dumps y backups del VPS: memoria temporal de la app no garantiza borrado contractual en toda la infraestructura.

## HTTPS usando el proxy que ya existe

El contenedor no inicia un proxy ni cambia DNS. `Caddyfile.example` es solo un **fragmento** para un Caddy que ya se ejecute en el host, con dominio reservado `.invalid` que debe sustituirse tras verificar propiedad/DNS. Revisar/validar el cambio con el administrador y conservar todos los sitios existentes; no reemplazar su archivo de configuración.

Si el proxy existente está **dentro de otro contenedor**, `127.0.0.1:18080` desde ese contenedor apunta al propio proxy, no al host. Elegir una red Docker compartida y un nombre de servicio explícito, o una ruta de host aprobada, tras inspeccionar la infraestructura. No conectar redes, reiniciar proxies ni abrir puertos públicos automáticamente.

Cuando HTTPS responda y ambas pruebas reales pasen, el operador configura `INDIGENOUS_BACKEND_URL` en Vercel con ese dominio, `INDIGENOUS_BACKEND_TOKEN` con el mismo secreto y `INDIGENOUS_TRANSLATION_RESEARCH_ONLY=true`. Son los nombres que lee el proxy Next.js; `INDIGENOUS_API_KEY_FILE` y `INDIGENOUS_API_KEY` pertenecen al backend Python, no sustituyen aquellas variables de Vercel. Mantener los controles de demo/piloto del MVP. No exponer el secreto en `NEXT_PUBLIC_*`.

## Actualización y reversión

Usar etiquetas de imagen por revisión, conservar la anterior y actualizar **solo** el servicio de este proyecto. Para volver, restaurar `INDIGENOUS_IMAGE_TAG` a la imagen anterior y ejecutar `up -d --no-build` sobre este Compose; verificar carga y pruebas de nuevo. No ejecutar `docker system prune`, borrar volúmenes, detener todos los contenedores ni usar `down` sobre otros proyectos. Una reversión de código no justifica rotar o borrar secretos por sorpresa.

**Comprobado localmente:** 42 pruebas de core, ASGI, secretos, readiness, contratos Dokploy y payload de fuentes comprometidas; sin pesos ni inferencia real. El operador confirmó inventario y seleccionó Dokploy; seguir [su guía](DEPLOY_DOKPLOY.md). **Pendiente:** build Linux, carga de modelos, pruebas reales, dominio administrado y conexión con Vercel.
