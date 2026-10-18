# Desplegar Ñawinchay como MVP de demostración

La aplicación a desplegar es **`web/`**, no la raíz del repositorio (Fixazo). Esta guía prepara un despliegue Next.js con servidor; no afirma que ya exista un despliegue ni que el producto esté validado con niños.

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

- ASR castellano: Web Speech del navegador; su proveedor y modelo no están fijados por la aplicación y puede procesar audio externamente.
- Voz del agente: `speechSynthesis` del navegador/sistema operativo.
- IA opcional: [Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview) (`claude-haiku-5-5`) para misiones y juez de texto, no para escuchar ni alinear la lectura.
- ASR quechua, separación de voces y alineación acústica con tiempos por palabra: pendientes. El seguimiento del texto no equivale a estas capacidades.
- Sin etiquetas emocionales inferidas, huella vocal, juicios de acento ni señales de salud. La evidencia educativa sigue requiriendo confirmación humana y las heurísticas no están validadas para evaluación de niños.
