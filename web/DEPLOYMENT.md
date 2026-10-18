# Desplegar Ñawinchay como MVP de demostración

La aplicación a desplegar es **`web/`**, no la raíz del repositorio (Fixazo). Proyecto separado: **`nawinchay-voice-mvp`**, [sitio](https://nawinchay-voice-mvp.vercel.app), rama `codex/nawinchay-voice-mvp`. No cambiar el proyecto, dominios ni rama principal de Fixazo. Un despliegue correcto no implica validación con niños.

## 1. Verificar el paquete local

Requisitos: Node 24 y npm 11. Desde la raíz del repositorio:

```sh
cd web
npm ci
npm test
npm run build
npx tsc --noEmit
npm start -- --port 3001
```

Usa `http://localhost:3001` para probar **el build de producción** sin interferir con un servidor de desarrollo en 3000. Solo continúa si cada comando termina correctamente. No ejecutes varios builds sobre el mismo directorio `.next` a la vez. Para desarrollar, usa `npm run dev`; no lo uses como servidor público.

No se necesita clave de IA. La instalación se reproduce con `package-lock.json`; no reemplaces `npm ci` por una actualización de dependencias al desplegar. Las rutas `/api/mission` y `/api/judge` requieren servidor: no configures una exportación estática ni subas solo `public/`.

### Corrección de Turbopack

Se retiró el loader `@tailwindcss/turbopack` y Tailwind, que no se usaban para las clases de la interfaz. Ese camino de procesamiento CSS arrancaba un pool de Node que fallaba durante el build. El reset equivalente queda como CSS estático y las cuatro fuentes WOFF2 están incluidas localmente con sus licencias: ya no se descargan de Google al compilar. `npm run build` sigue ejecutando `next build` con Turbopack; no se sustituyó por Webpack ni se ocultaron errores de TypeScript. El build local se ha completado con esta corrección; el Preview aún debe pasar la lista siguiente.

## 2. Configurar Vercel

Si despliegas desde Git, primero incluye y confirma los archivos de `web/`, incluidas las fuentes, sus licencias, `reset.css`, `package-lock.json` y `.env.example`. No incluyas `node_modules`, `.next` ni `.env.local`. Preparar estos archivos localmente no los sube al repositorio ni publica la aplicación.

Importa el repositorio como **un proyecto separado para Ñawinchay**. No cambies los ajustes de un proyecto Fixazo existente. Vercel permite elegir una aplicación del repositorio mediante [Root Directory](https://vercel.com/docs/monorepos).

| Ajuste | Valor |
|---|---|
| Root Directory | `web` |
| Framework Preset | Next.js |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Valor predeterminado de Next.js, sin sobrescribir |
| Variables de entorno | Ninguna para el modo por reglas |

Node 24 está en las [versiones compatibles de Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Los comandos anteriores se ejecutan dentro de `web`; no uses `npm run build:mvp` como Build Command con esa Root Directory.

Crea primero un **Preview** y comprueba su URL HTTPS antes de promoverlo. Los permisos del micrófono son por origen: un permiso concedido a localhost no se transfiere al dominio nuevo. En móvil, una IP de red con HTTP no sustituye a HTTPS.

### IA opcional: activar deliberadamente

1. Mantén `ANTHROPIC_API_KEY` ausente para la primera demostración por reglas.
2. Si vas a probar IA, añádela como secreto del servidor únicamente en el entorno elegido y crea un nuevo despliegue. Para local, copia `.env.example` a `.env.local` dentro de `web`.
3. No uses `NEXT_PUBLIC_ANTHROPIC_API_KEY`, no pegues claves en código ni las compartas por capturas o logs.
4. Confirma el modo con `GET /api/judge` (`reglas` o `ia`) y la disponibilidad de fotos con `GET /api/mission`. Un modo `ia` significa clave configurada, **no** que una llamada al proveedor haya tenido éxito; comprueba una misión y un informe reales del Preview. Un fallo vuelve a reglas.

**Límite de seguridad:** este MVP no implementa autenticación de aplicación ni cuotas/rate limiting para sus endpoints. No actives una clave de pago en una URL pública sin restringir quién puede acceder. Para una prueba cerrada, configura y verifica [Deployment Protection](https://vercel.com/docs/deployment-protection), según el plan y entorno del proyecto, o usa un entorno privado. Antes de abrirlo al público con IA, añade autenticación, autorización y límites de uso en servidor; un Preview por sí solo no garantiza privacidad.

## 3. Lista de aceptación del Preview

Usa datos ficticios y realiza este recorrido en el **dominio definitivo de prueba**, no solo en localhost:

- [ ] Abren `/`, `/consentimiento`, `/chat`, `/sesion`, `/informe`, `/progreso` y `/privacidad` sin errores del servidor o de consola.
- [ ] Se puede crear una misión sin clave y completar una sesión con transcripción manual.
- [ ] El informe permanece provisional hasta la revisión humana; «No observable» no se convierte en cero.
- [ ] Se puede exportar y borrar la información del navegador. Recargar conserva solo los datos esperados.
- [ ] En Chrome con HTTPS, se comprueban permiso, señal del micrófono y transcripción por separado. Probar también rechazo de permiso y recuperación manual, sin perder el texto.
- [ ] El seguimiento visual no salta al final con voz ajena al texto; repetir una frase no termina la lectura prematuramente.
- [ ] En Opera o sin servicio ASR, la alternativa manual sigue funcionando. En quechua no se ofrece ASR conectado.
- [ ] El diseño funciona en móvil sin desbordamiento horizontal.
- [ ] Si hay clave: acceso restringido verificado, misión/foto y juez probados sin exponer secretos ni respuestas personales en logs.

La persistencia es `localStorage`: datos de un dispositivo y un origen no aparecen en otro. Cambiar de localhost a Preview o a un dominio nuevo no migra informes. No existe sincronización de cuentas ni copia remota del progreso.

## 4. Si falla o hay que volver atrás

| Síntoma | Comprobar primero |
|---|---|
| Se abre Fixazo en vez de Ñawinchay | Root Directory debe ser `web`, no `.` |
| Falla instalación | Versión Node/npm y `package-lock.json`; conservar el primer error del log |
| Falla build | Reproducir `npm ci` y `npm run build` dentro de `web`; no dar por bueno un servidor `dev` |
| La IA no responde o vuelve a reglas | Entorno del secreto, nuevo despliegue, permisos/créditos del proveedor y error del servidor, sin registrar el secreto |
| Hay señal pero no texto | Servicio de reconocimiento del navegador, no el juez Claude; probar Chrome y ruta manual |
| No aparece progreso de otro dominio | `localStorage` está aislado por origen; no es una caída del backend |

Para una regresión tras promover: vuelve al último despliegue estable con [Rollback de Vercel](https://vercel.com/docs/deployments/rollback-production-deployment), vuelve a comprobar las rutas y el modo IA, y conserva el ID del despliegue fallido y su error. El rollback de código no restaura datos de `localStorage` ni cambia por sí solo el consentimiento del navegador. Si el incidente implica una clave expuesta, revócala en el proveedor y rota el secreto antes de reactivar IA.

## Alcance que no cambia al desplegar

- ASR castellano: Web Speech del navegador, Whisper base local tras descarga explícita, o Deepgram Nova-3 tras configuración y consentimiento separado. La disponibilidad se comprueba en ejecución.
- Voz de la misión: `speechSynthesis` del navegador/sistema operativo. `/voz` añade una demo independiente OpenAI Realtime 2.1, no vinculada al informe ni activa sin claves.
- IA opcional: [Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview) (`claude-haiku-5-5`) para misiones y juez de texto, no para escuchar ni alinear la lectura.
- `/lenguas`: adaptador de Meta Omnilingual ASR autoalojado, distinto del seguimiento de lectura. Requiere un servidor de modelos externo operativo; Vercel NO ejecuta los pesos. Traducción NLLB únicamente de investigación no comercial. Separación de voces y alineación forzada con el pasaje no están implementadas.
- Sin huella vocal, juicios de acento ni señales de salud. La evidencia educativa no usa etiquetas emocionales para calificar; la única estimación emocional es la demo adulta experimental y opcional descrita abajo. La evidencia educativa sigue requiriendo confirmación humana y las heurísticas no están validadas para evaluación de niños.

## Servicios de voz nuevos: activación y límites

El despliegue sin secretos mantiene **desactivados** Deepgram, OpenAI y el proxy Meta. No se incluyen claves de demostración. Whisper local se prepara desde la sesión, sin cuenta de proveedor; unos 80 MB más runtime, solo castellano en este MVP. En celulares puede ser lento y no sustituye el reconocimiento indígena.

Variables del servidor: consultar `.env.example`. Para una demo cerrada con voces **adultas o sintéticas**:

1. Proteger el despliegue y configurar presupuestos en los proveedores.
2. Establecer `VOICE_CLOUD_MODE=adult-demo` y un `VOICE_ACCESS_CODE` aleatorio de al menos 16 caracteres; compartirlo fuera de la app solo con participantes autorizados.
3. Añadir únicamente las claves necesarias: `DEEPGRAM_API_KEY` para streaming; `OPENAI_API_KEY` para `/voz`.
4. Para Meta, desplegar y precalentar por separado [el servicio Python](services/indigenous/README.md), con su token de servidor. Configurar aquí `INDIGENOUS_BACKEND_URL` HTTPS y `INDIGENOUS_BACKEND_TOKEN`. No exponer los pesos, token ni un endpoint abierto en Vercel.
5. Para NLLB, confirmar el uso **no comercial** y habilitar su opción de investigación tanto en ese backend como `INDIGENOUS_TRANSLATION_RESEARCH_ONLY=true` en Next.js. Revisar las traducciones con hablantes. No hay conversión implícita de quechua Cusco a Ayacucho.
6. **Emociones (EXPERIMENTAL, opcional):** solo para la demo con voces adultas.
   - En el servicio Python: reconstruir con `--build-arg INSTALL_EXPERIMENTAL_EMOTION=true`, definir `ENABLE_EXPERIMENTAL_EMOTION=true` y `EMOTION2VEC_LICENSE_ACCEPTED=true`, y sumar ≈1–2 GB de memoria.
   - Aceptar la FunASR Model License v1.1 con su atribución: emotion2vec+, Ma et al. 2024, Alibaba DAMO / FunASR.
   - En Next.js `/api/emotion` reutiliza `INDIGENOUS_BACKEND_URL`, `INDIGENOUS_BACKEND_TOKEN`, `VOICE_CLOUD_MODE` y `VOICE_ACCESS_CODE`, con autorización propia para la demo emocional. Sin modelo listo o autorización, la app muestra ausencia de inferencia y su motivo: nunca reemplaza emotion2vec+ con texto ni heurísticas acústicas, aunque una respuesta de error mantenga `{fallback:true}` por compatibilidad de transporte.
   - `GET /api/emotion` anuncia disponibilidad del modelo, independiente de ASR. `ready=true` exige `inferenceVerified=true`, no sólo cargar pesos. Para calentar sólo emoción: `EMOTION_WARMUP=true` e `INDIGENOUS_WARMUP=false`.
   - Para desarrollo CPU Windows, [guía local aislada](services/indigenous/EMOTION_LOCAL.md): sólo ese launcher activa `INDIGENOUS_ALLOW_LOOPBACK=true` y `NAWINCHAY_EMOTION_LOCAL=true` bajo `NODE_ENV=development`. Producción mantiene HTTPS obligatorio y output Next predeterminado; no trasladar esos permisos al despliegue.
   - En el Perú, inferir emociones en educación es de alto riesgo (DS 115-2025-PCM, art. 24.1 i). No activarlo en un piloto infantil sin evaluación de impacto.
7. Redesplegar y verificar `/api/asr`, `/api/voice/session` y `/api/indigenous`. Configurado no significa alcanzable ni modelo listo. Probar un turno real autorizado antes de declarar operativo el proveedor.

La ejecución real de emotion2vec+ en CPU Windows está comprobada con voz pública; no equivale a un build Linux con emoción, una cadena HTTP/UI íntegra ni publicación del cambio. Exigir el smoke real de la guía y revisar la [evidencia actual](docs/VALIDATION.md), sin usar resultados históricos de otros modelos como sustituto.

Para un piloto infantil, no basta cambiar una bandera: revisar consentimiento, responsables y ubicación/retención de datos. El código exige `VOICE_CLOUD_MODE=approved-pilot` y `CHILD_VOICE_PRIVACY_APPROVED=true`; OpenAI exige adicionalmente `OPENAI_ZDR_CONFIRMED=true` tras la aprobación real correspondiente. Mantener todo desactivado hasta completar esas gestiones.

Los límites en memoria son una defensa adicional, **no cuotas distribuidas**. Los TTL de tokens y límites del cliente no son topes de gasto seguros. Las APIs existentes de Claude no tienen autenticación de aplicación: no activar Anthropic en una URL pública abierta. No registrar audio, códigos, claves ni respuestas personales. Las demos nuevas conservan contenido solo temporalmente en memoria y no lo agregan al informe educativo.

### Build y dependencias

Con `cacheComponents: true`, las rutas nuevas no exportan `runtime` ni `dynamic`; usan `connection()` en GET de capacidades para no congelar configuración durante el build. Node es el runtime predeterminado. No desactivar comprobaciones de tipos para desplegar.

Vitest se actualizó a 4.1.11 para retirar avisos críticos de su cadena de desarrollo. `npm audit --omit=dev` debe revisarse por separado: las dependencias de herramientas también importan, pero no son lo mismo que código publicado en la función. No usar `npm audit fix --force` ni degradar Next para maquillar el informe. Ejecutar CI solo con código confiable; no exponer servidores Vite de pruebas a internet.

### Publicar sin subir archivos de Fixazo

Confirmar solo `web/` en la rama dedicada. Para despliegue CLI, crear un directorio de staging a partir de `git archive <commit> web/`; enlazar **ese staging** a `nawinchay-voice-mvp`, confirmar `Root Directory: web`, y desplegarlo. Excluir `.env*`, `node_modules`, `.next` y `outputs`. La CLI puede generar un token OIDC en un `.env.local` ignorado del staging: no copiarlo al código ni mostrarlo en logs. El primer despliegue de un proyecto nuevo puede asignarse automáticamente a producción; comprobar el resultado real de la CLI.

La web no sincroniza automáticamente informes entre dominios: el almacenamiento sigue aislado por navegador/origen. Ver [evidencia, licencias y decisiones](docs/VOICE-RESEARCH.md).
