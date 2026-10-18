# Emoción desde la voz: demo local real en CPU

Esta ruta usa **emotion2vec+ base**, no el texto ni un léxico emocional. Analiza
un WAV de cada turno y devuelve las nueve probabilidades del modelo. Si el
modelo no está listo o falla, la interfaz debe mostrar que no hay estimación;
no sustituirla por una emoción inventada a partir del texto o de la energía.

Es una **estimación experimental para una demo con adultos que consienten**.
No está validada con menores, español peruano ni quechua. No es un diagnóstico,
una medición del estado interno ni una calificación. Se necesita revisión humana.

**Evidencia local:** se ejecutó el modelo real CPU Windows con una muestra pública
de voz de **4,104125 s**, carga de aproximadamente **26,703 s** e inferencia de
**1,25 s** en esa ejecución. Esto no demuestra exactitud emocional ni acredita por
sí solo la cadena HTTP/UI o un despliegue; los pasos de abajo son la ruta de
verificación reproducible. El estado evidenciado se recoge en
[VALIDATION.md](../../docs/VALIDATION.md).

## 1. Preparar el entorno aislado

Requisitos: Windows, **Python 3.12 x64**, Node y las dependencias del proyecto
web (`npm ci` en la carpeta `web`). No es necesario instalar fairseq2,
Omnilingual ASR, llama-cpp, MMS ni otro servidor para probar sólo emociones.
Usa la ruta de un Python instalado: el alias `python` de Microsoft Store puede
no ser ejecutable en este equipo. Si `.venv-emotion` ya está preparado, salta
setup y usa directamente el launcher del paso 2.

Desde la raíz del repositorio, en PowerShell sin cargar el perfil:

```powershell
pwsh -NoProfile -File .\web\services\indigenous\scripts\Setup-EmotionLocal.ps1 -Python 'C:\ruta\a\python.exe'
```

El script crea `web/services/indigenous/.venv-emotion`, instala Torch y
torchaudio **2.8.0 CPU**, FunASR **1.4.16** y el stack mínimo fijado en
`constraints.txt`. Comprueba imports reales y `pip check`. **Setup no descarga
pesos**. No modifica el Python global ni los archivos `.env.local`.

## 2. Arrancar Python y Next con la misma configuración

Antes de aceptar la licencia, revisa la ficha y licencia del modelo
[emotion2vec+ base](https://huggingface.co/emotion2vec/emotion2vec_plus_base).
Se fija la revisión `b318240bfe67db81a8c572ecb37ce9c3759b81c9` y se conserva
la atribución **emotion2vec+ base (Ma et al. 2024), Alibaba DAMO / FunASR**.

```powershell
.\web\services\indigenous\scripts\Start-EmotionLocal.ps1 -AdultDemoConsent -AcceptModelLicense
```

Introduce un código de demo de **16 a 256 caracteres** en el prompt oculto.
Introduce **ese mismo código** en la interfaz. También se puede suministrar
`-AccessCode (Read-Host -AsSecureString)` o un `VOICE_ACCESS_CODE` ya presente
en el entorno de esa sesión; no se muestra en la salida ni se guarda.

El supervisor:

- Liga Python a **127.0.0.1:8081** y el socket Next a **127.0.0.1:3001**, no a
  toda la LAN. Abre la interfaz en **http://localhost:3001**, su origen canónico:
  Next normaliza así `Request.url` y la política de mismo origen se conserva
  estricta. El endpoint privado Python continúa usando `127.0.0.1`.
- Genera una clave backend efímera, sólo para los entornos de sus procesos.
- Usa la caché ignorada `web/services/indigenous/.cache` para pesos y temporales,
  no la carpeta personal del usuario; una descarga completa se reutiliza.
- Activa `EMOTION_WARMUP=true` y mantiene `INDIGENOUS_WARMUP=false`: descarga
  los pesos fijados de emoción la primera vez, sin descargar/calentar ASR.
- Espera `/health.emotion.ready=true` **y** `inferenceVerified=true`, no sólo
  que los pesos hayan cargado. El warmup usa una señal sintética en RAM:
  verifica un forward real, **no la exactitud con voz humana**.
- Inicia Next con `VOICE_CLOUD_MODE=adult-demo`, `INDIGENOUS_BACKEND_URL`,
  `INDIGENOUS_BACKEND_TOKEN` y `INDIGENOUS_ALLOW_LOOPBACK=true` sólo en su
  proceso. El permiso HTTP loopback funciona únicamente en desarrollo.
- Usa `NAWINCHAY_EMOTION_LOCAL=true` para seleccionar el único output alternativo
  permitido, `.next-emotion`, únicamente en desarrollo. El `.next` y lock de
  cualquier sesión Next existente quedan intactos; producción ignora ese flag.
- No sobrescribe `.env.local`, no reinicia servicios ajenos, no borra locks y
  no termina procesos por puerto. Su bloque `finally` cierra sólo sus propios
  procesos al salir normalmente o manejar `Ctrl+C`. Una cancelación forzada
  del anfitrión puede impedir esa limpieza; no cierres a la fuerza el terminal.

En la web confirma que eres adulto, autoriza el uso de voz y activa por separado
**Emociones experimentales**. Habla durante al menos un segundo por respuesta.
El endpoint de emoción recibe únicamente audio, no transcripciones.

Para cambiar puertos usa `-BackendPort 8082 -WebPort 3002`. La demo puede coexistir
con una sesión Next que use `.next/dev/lock`: sus outputs y locks son distintos.
Si ya hay otra demo usando `.next-emotion/dev/lock`, Next rechaza un segundo
arranque: detén tú esa demo o usa **`-NoWeb`** para verificar solamente el backend.
No conectes un Next existente a una clave distinta ni borres su lock.

El launcher mínimo prepara sólo emoción. Las otras funciones ASR/TTS/conversación
requieren su propio despliegue y dependencias; no se anuncian listas por esta prueba.

## 3. Verificar voz real de extremo a extremo

Usa una grabación de **un adulto con permiso** o una muestra pública con licencia
adecuada: WAV **PCM16, mono, 16 kHz, de 1 a 15 segundos**, sin silencio total.
El script no descarga ni conserva grabaciones. No uses voz infantil para esta demo.

```powershell
.\web\services\indigenous\scripts\Start-EmotionLocal.ps1 -AdultDemoConsent -AcceptModelLicense -SmokeAudio 'C:\audio\adulto.wav' -SmokeOnly
```

La prueba inicia **el modelo real** y envía el mismo WAV a:

1. Python `POST /v1/emotion` con body WAV y credencial privada.
2. Next `POST /api/emotion` con multipart, mismo origen, código de acceso,
   consentimiento adulto y opt-in experimental.

Comprueba modelo y revisión exactos, nueve etiquetas únicas, probabilidades que
suman uno, `top` coherente, `experimental=true`, `requiresHumanReview=true` y
que el proxy preserve la distribución. También exige rechazar silencio
(`400/422`), backend sin credencial (`401`), falta de opt-in (`403`) y otro origen
(`403`). La línea **`EMOTION_SMOKE { ... }`** contiene probabilidades y latencias,
sin claves, ruta de grabación ni audio. `-SmokeOnly` termina sus procesos al acabar.

Esto prueba inferencia e integración reales, **no** que la etiqueta sea la emoción
verdadera del hablante. Las nueve clases son `angry`, `disgusted`, `fearful`,
`happy`, `neutral`, `other`, `sad`, `surprised` y `unknown`.

Para comprobar sólo Python, añade `-NoWeb`. Para mantener la demo abierta después
de probar, omite `-SmokeOnly`. El primer arranque puede tardar varios minutos;
`-ReadyTimeoutSeconds 1800` amplía el plazo sin cambiar la revisión.

## Diagnóstico sin afirmar disponibilidad falsa

- `ready=false, loading=true`: espera al modelo. Un POST frío puede responder
  `503 emotion-model-loading`; no es una emoción ni un resultado vacío válido.
- `emotion-warmup-failed`: comprueba que se usó `.venv-emotion`, ejecuta setup
  de nuevo para validar dependencias y comprueba conectividad al repositorio.
  No borres una caché o un proceso ajeno como solución automática.
- Lock `.next-emotion/dev/lock` ocupado o puerto ocupado: el launcher no cambia
  nada ajeno. Usa otros puertos o `-NoWeb`, según el caso. Cambiar de puerto no
  evita el lock si ya hay otra demo usando el mismo output.
- `access-not-configured`/`voice-access-required`: código de demo de 16+ caracteres,
  idéntico en proceso web e interfaz; no es la clave privada backend.
- Sin consentimiento o servidor listo: mostrar **sin datos suficientes**, nunca
  una emoción heurística local como si fuera emotion2vec+.

Pruebas rápidas de los scripts (sin pesos ni inferencia):

```powershell
& .\web\services\indigenous\.venv-emotion\Scripts\python.exe -B -m unittest discover -s .\web\services\indigenous\scripts -p 'test_*.py' -v
```

Estas pruebas unitarias no sustituyen la línea `EMOTION_SMOKE` con voz humana.
