# Ñawinchay · MVP web

> *Ñawinchay* (quechua): "leer". Escuchamos cómo lee y cómo piensa tu hijo, y te decimos qué hacer en casa.

Aplicación web para familias. La familia pega la lectura de la tarea (o elige una misión de ejemplo), el sistema arma una **misión de 8 minutos** y el niño la hace por voz con un agente que **nunca da la respuesta**. Al final, la familia recibe un informe: fluidez, comprensión en tres niveles (Obtiene, Infiere, Reflexiona), cómo construyó su juicio ante una **contraprueba**, cómo lo dijo, cómo se sintió (según el propio niño) y una pregunta para conversar en casa.

Especificación: `../PRD-Nawinchay.md`. Patrones de habla: `../MODELOS-AUDIO.md` §7.

---

## Cómo correrlo

Requisitos: Node 24 y npm 11. **No necesita ninguna clave ni variable de entorno.**

```bash
cd web
npm ci
npm run dev        # http://localhost:3000
npm test           # pruebas unitarias (Vitest)
npm run lint
npm run build
npx tsc --noEmit   # comprobación TypeScript tras generar tipos de Next
npm start          # servir el build, no ejecutar junto con dev en el mismo puerto
```

Para desplegar: **[guía de producción y Preview](DEPLOYMENT.md)**. Root Directory de Vercel: `web`; preset Next.js. La raíz del repositorio es otra app, Fixazo. Un build correcto permite probar un MVP en el hosting; no supone validación con niños ni seguridad suficiente para publicar una API de IA de pago sin controles de acceso.

También hay una configuración `nawinchay-web` en `../.claude/launch.json` (`npm run dev --prefix web`, puerto 3000).

Para probar voz, usa **Chrome en la misma computadora**: no hace falta una app móvil. El soporte se comprueba en ejecución; tener micrófono no garantiza tener servicio de transcripción. En Opera puede no estar disponible. Si falta la API o falla el servicio, continúa con **transcripción manual** (modo simulación), sin convertir el fallo técnico en una respuesta incorrecta.

### Si no reconoce tu voz

1. Abre `http://localhost:3000` en la computadora o una URL **HTTPS**. En un celular, `http://192.168…:3000` no es localhost ni un contexto seguro.
2. Revisa el permiso del sitio, el permiso de micrófono de Windows/Android y el dispositivo de entrada seleccionado. En Opera: Configuración → Privacidad y seguridad → Configuración de sitios → Micrófono.
3. Prueba el micrófono desde la pantalla de sesión. Esta prueba mide señal localmente, no identifica a la persona ni graba audio; no prueba el servicio de transcripción.
4. Si la señal llega pero no aparece texto, prueba Chrome y revisa conexión/permisos del reconocimiento. Cambiar a Opera móvil no resuelve necesariamente la incompatibilidad.
5. Usa escritura manual si el servicio no está disponible o si no deseas enviar voz al proveedor del navegador. Para quechua, esta es la ruta disponible del MVP: **el ASR quechua todavía no está conectado**.

Referencias: [compatibilidad de SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [contexto seguro y permisos de micrófono](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [permisos de Opera](https://help.opera.com/en/latest/Web-preferences/).

## Recorrido

| Pantalla | Ruta | Qué hace |
|---|---|---|
| F1 · Antes de empezar | `/consentimiento` | Alias, grado, lenguas y 4 permisos (el de emociones aparece como "no disponible") |
| F2 · Chat familiar | `/chat` | Pegar texto, foto (solo con clave de IA), misiones de ejemplo, panel "Traer de Entiendo" (integración pendiente) |
| F3/F4/F4b · Sesión | `/sesion` | Pantalla completa con máquina de estados, botón "Pausar" siempre visible, vista del adulto |
| F5 · Informe | `/informe` | Titular, 4 tarjetas, cadena del juicio, cómo lo dijo, cómo se sintió, contexto, conversación, "Para conversar en casa", "Lo que no medimos" |
| F6 · Progreso | `/progreso` | Barras de palabras correctas por minuto, cuadrícula de niveles, 4 indicadores |
| F7 · Privacidad | `/privacidad` | Permisos, descargar datos, borrar todo con confirmación |

Máquina de estados (`src/lib/session/machine.ts`, PRD §10):
`CHECK_IN → READ → Q_OBTIENE → Q_INFIERE → STANCE (opinión + seguridad, ANTES de la contraprueba) → COUNTER (Mantengo/Cambio) → REVISE ("¿Por qué?") → CHECK_OUT → REPORT`, con `PAUSED` desde cualquier estado.

## Modo simulación

Para probar todo **sin micrófono** (y para pruebas automáticas con navegador):

- Se activa con la casilla "Usar modo simulación" al empezar la sesión, con el botón "Cambiar a simulación", o **solo** si no hay reconocimiento de voz, si el micrófono falla, si la familia quitó el permiso de voz o si la misión está en quechua.
- El adulto escribe lo que dijo el niño ("Lo que dijo…" / "Lo que leyó…") y, opcionalmente, **"Silencio antes de responder (s)"** (latencia) o **"Segundos leyendo"** (si se deja vacío, 60 s). "Simular silencio" equivale a 8 s sin respuesta.
- Los turnos simulados pasan por **el mismo análisis**: rasgos de texto completos; los rasgos de audio se marcan "no disponible en simulación".
- En simulación la lectura no se corta a los 60 s: el adulto decide cuándo enviar.

## Qué modelos usa realmente

| Función | Implementación efectiva |
|---|---|
| Transcribir castellano | Web Speech del navegador (`es-PE`); la aplicación no elige ni conoce su modelo ASR. No hay integración propia de Whisper y Claude no transcribe el audio. |
| Hablar como agente | `speechSynthesis`; voz disponible en el navegador/sistema operativo. |
| Medir volumen, pausas y tono | Web Audio + heurísticas DSP locales; no un modelo de emociones, salud o identidad. |
| Seguir la lectura | Comparación del texto reconocido con el texto de la misión; no alineación acústica con timestamps por palabra. |
| Misiones y juez sin clave | Reglas y plantillas locales/servidor, **sin LLM**. |
| Misiones/foto y juez con clave | Claude Haiku 5.5 (`claude-haiku-5-5`) mediante API Anthropic; no recibe audio para seguir la lectura. |
| Transcribir quechua | No conectado: el adaptador Omnilingual es una ranura pendiente; se usa transcripción manual. |

El [ID de Haiku 5.5 está documentado por Anthropic](https://platform.claude.com/docs/en/models/haiku-5-5/overview). Tener instalado el SDK no activa IA. No se necesitan claves para el MVP por reglas. Confirma el modo del servidor con `/api/judge`; una clave configurada no demuestra disponibilidad del proveedor ni elimina el fallback.

### Cómo sigue el texto

El resaltado es **aproximado y depende de que llegue transcripción**: compara la hipótesis acumulada de Web Speech con el inicio de la lectura. Las frases repetidas priorizan la primera coincidencia y el cursor puede retroceder si el reconocedor corrige su hipótesis. Los resultados provisionales mueven el cursor, pero no generan nuevas métricas de precisión; el cierre automático requiere un resultado final con cobertura suficiente y coincidencia con el final del texto.

En modo manual no se sigue al niño mientras el adulto escribe: se compara al enviar. Una transcripción sin coincidencias suficientes deja la lectura **No observable**, con precisión y PCPM no disponibles, en lugar de penalizarla como cero. No hay timestamps de palabras ni alineación acústica forzada; cambiar el juez Claude no mejora estas limitaciones del reconocimiento.

### Variables de entorno opcionales

| Variable | Efecto |
|---|---|
| `ANTHROPIC_API_KEY` | Activa el juez con Claude (`claude-haiku-5-5`) en `/api/judge` (rúbrica anclada, salida JSON con esquema, 3 corridas; si no coinciden → "dudoso", se muestra "en revisión") y la generación de misiones desde texto o **foto** en `/api/mission`. Ante cualquier error se vuelve a las reglas. |

Sin clave: juez por reglas y constructor determinista de misiones (elige oraciones del texto y llena plantillas) + 2 misiones de ejemplo (castellano y quechua en borrador).

Para probar IA localmente, copia `.env.example` a `.env.local` **dentro de `web`** y reinicia el servidor. La clave permanece en servidor; nunca debe llevar prefijo `NEXT_PUBLIC_` ni subirse al repositorio. En el hosting usa su almacén de secretos. **No hay autenticación de aplicación ni cuotas/rate limiting:** mantén el despliegue de prueba restringido antes de añadir una clave de pago; consulta [la guía de despliegue](DEPLOYMENT.md#ia-opcional-activar-deliberadamente).

`GET /api/judge` informa el modo (`{"mode":"reglas"}` o `{"mode":"ia"}`); `GET /api/mission` informa si hay IA para fotos.

## Arquitectura

```
Navegador (DSP local; Web Speech puede procesar voz en un proveedor externo)
┌──────────────────────────────────────────────────────────────────────┐
│  UI (Next.js App Router, React)                                      │
│   /consentimiento /chat /sesion /informe /progreso /privacidad       │
│                         │                                            │
│   SessionController (components/session/controller.ts)               │
│     ├─ machine.ts  ← estado explícito, puro, probado                 │
│     ├─ AgentVoice  (speechSynthesis, es-PE)                          │
│     ├─ Transcriber ─┬─ WebSpeechTranscriber (es-PE, continuo)        │
│     │               ├─ OmnilingualAsrTranscriber (ranura, sin hacer) │
│     │               └─ (simulación: el adulto escribe)               │
│     └─ AudioAnalyzer (Web Audio, ScriptProcessor 2048)               │
│          frame → RMS, VAD adaptativo, F0 (YIN), clipping → se bota   │
│                         │                                            │
│   lib/signals/*  (capas 1–5, funciones puras)                        │
│   lib/scoring.ts  → niveles 0–3 / NO, cadena del juicio, calibración │
│   lib/report/build.ts → informe                                      │
│   lib/guardrails.ts → assertReportIsClean() antes de guardar         │
│   lib/storage.ts → localStorage con try/catch (o memoria)            │
└───────────────┬──────────────────────────────────────────────────────┘
                │ solo texto (y la foto si la familia la sube)
┌───────────────▼──────────────────────────────────────────────────────┐
│ Servidor Next.js: /api/judge  /api/mission                           │
│   reglas por defecto · Claude opcional (ANTHROPIC_API_KEY)           │
└──────────────────────────────────────────────────────────────────────┘
```

## Capas de señal (`src/lib/signals/`)

| Capa | Archivo | Qué calcula | Uso |
|---|---|---|---|
| DSP común | `../dsp.ts` | RMS, dB, VAD de energía adaptativo, tono YIN 60–600 Hz, picos de energía (sílabas aprox.), pendiente | Base de todo |
| 1 · Qué dice | `text.ts` | Conectores de razonamiento (es/qu, `-pti/-ptin`), evidenciales quechua `-mi/-m`, `-si/-s`, `-chá` → postura epistémica (TODO validar), solapamiento con el texto y la contraprueba, largo, mezcla de lenguas | Niveles y cadena del juicio |
| 2 · Cómo lo dice | `reading.ts`, `prosody.ts` | Alineación Levenshtein por palabra (correcta/sustitución/omisión/inserción), repeticiones, autocorrecciones, PCPM, precisión, pausas > 2 s, latencia, muletillas y palabras de duda, entonación final (últimos 500 ms), prosodia 1–4 aproximada | Fluidez e informe "Cómo lo dijo" (nunca entra en niveles) |
| 3 · Estado / ritmo | `pace.ts` | Línea base de los primeros 30 s de habla; por turno `ok / acelerado / cansado` | **Solo en vivo** para ofrecer "¿Hacemos una pausa de un minuto?". Nunca se guarda ni se nombra como emoción |
| 4 · Contexto | `context.ts` | Ruido de fondo, SNR y clipping; ayuda adulta declarada por la familia o docente, no inferida por tono | Validez "NO observable" y contexto confirmado por una persona |
| 5 · Conversación | `conversation.ts` | Interrupción, pide repetir, pide la respuesta (el agente repregunta), preguntas propias, revisión tras la contraprueba, **verificador de fuga de respuesta** | Agente y bloque "Conversación" |

`summary.ts` reduce los frames de un turno a unos pocos números; los frames se descartan.

## Rúbricas (PRD §11)

### Revisión humana del MVP

El informe nuevo es **provisional**. En «Revisar la evidencia», la familia o docente compara la transcripción con lo que escuchó y confirma cada evidencia (lectura, qué dice, por qué pasó y opinión/revisión). Si no puede comprobarla, la marca **No observable**, nunca 0. Los informes anteriores sin revisión también son provisionales. La ayuda de un adulto se declara manualmente: el tono de voz no permite saber si alguien dictó una respuesta.

La revisión se guarda en el mismo navegador. No equivale a una validación científica de las rúbricas, del ASR infantil ni de las heurísticas acústicas. Para un piloto real aún hacen falta validación de hablantes/docentes, acuerdo entre evaluadores y pruebas con los dispositivos del aula.

- **Obtiene** (reglas): palabra clave o sinónimo → 3; parcial → 2; si no, 0.
- **Infiere**: 0 sin relación · 1 repite el texto · 2 conector causal + contenido del texto · 3 además usa el dato clave.
- **Reflexiona** (tras la contraprueba): 0 sin razón · 1 razón ajena al texto · 2 razón con el texto o el dato · 3 además considera otra opción. **Mantener con buena razón vale igual que cambiar.**
- "Con ayuda" si se repitió o simplificó la pregunta (máximo 2 ayudas).
- **NO observable ≠ 0** en todo el sistema.

## Guardrails (`src/lib/guardrails.ts`)

El sistema **no calcula ni guarda**:

1. Emociones etiquetadas (ansioso, triste…). El ánimo es solo la carita que elige el niño (`source: "autorreporte"`).
2. Identidad de voz (huella de voz, embeddings de hablante): solo un alias.
3. Juicios sobre el acento o la forma de hablar.
4. Señales de salud (ronquera, respiración).

`FORBIDDEN_FIELDS` + `assertReportIsClean(report)` se ejecutan **antes de guardar cualquier informe** (`storage.saveReport`). También rechazan audio binario, el estado de ritmo en vivo (`pace`) y valores de emoción. Hay pruebas que lo demuestran (`guardrails.test.ts`, `report/build.test.ts`, `storage.test.ts`). Cada informe muestra el bloque **"Lo que no medimos"**.

## Privacidad del audio

- Las señales acústicas se calculan en el navegador con Web Audio. **La app no graba ni almacena el audio.**
- **Aviso:** la transcripción en castellano usa un servicio distinto: el reconocimiento del navegador (`SpeechRecognition` o `webkitSpeechRecognition`, `es-PE`), que **puede enviar audio a su proveedor**. Por eso no se promete que todo el audio permanezca local. Si no se quiere usar ese servicio, desactivar voz y usar transcripción manual. El juez de IA opcional recibe texto cuando se configura su clave.

## Quechua

- En este MVP no se habilita reconocimiento Web Speech para quechua: en esas misiones se muestra el texto y se usa el modo simulación. El agente muestra el texto en quechua y **habla la traducción al castellano** (TODO: audio grabado por un hablante).
- Todos los textos en quechua son **borradores** marcados con `// TODO(validate-quechua)`.
- **Ranura para ASR:** `OmnilingualAsrTranscriber` en `src/lib/browser/transcriber.ts` implementa la interfaz `Transcriber` (`start(handlers) / stop() / abort()`). Pendiente: un servidor de Omnilingual ASR (`quy_Latn`, Apache 2.0). Para respetar "el audio no sale del dispositivo", debe correr en el mismo equipo o en la red local de la escuela, con consentimiento explícito. No está implementado.

## Accesibilidad

Botones ≥ 48 px (≥ 56–64 px en la sesión), foco visible, etiquetas en controles, niveles con número y etiqueta (no solo color), `prefers-reduced-motion`, diseño probado desde 360 px, tema claro/oscuro con los tokens del PRD §7.3.

## Limitaciones conocidas

- **Privacidad de Web Speech:** en Chrome la transcripción puede pasar por servidores de Google.
- **Heurísticas aproximadas:** VAD por energía, tono YIN, picos de energía como "sílabas", prosodia 1–4 y ritmo son aproximaciones **no validadas**. No se usa librosa ni hay alineación forzada con tiempos por palabra: las pausas en puntuación no se miden. No hay separación de voces ni detección automática de dictado; la ayuda de un adulto requiere declaración humana.
- **Valores no validados con niños:** umbrales (8 s sin respuesta, 2,5 s de fin de turno, +35 % / −30 % de ritmo, SNR < 6 dB) y rúbricas por reglas necesitan calibrarse con voces infantiles reales y acuerdo humano (κ).
- **Quechua:** sin reconocimiento de voz; necesita el servidor ASR y validación de textos por un hablante. La contraprueba en quechua está solo en castellano.
- **Constructor de misiones sin IA:** usa plantillas (completar una frase, "¿Por qué…?" desde una oración causal); es más pobre que la versión con IA. Solo arma misiones en castellano.
- La interrupción (barge-in) usa un umbral de energía y puede activarse con el eco del parlante.
- Sin cuentas: los datos viven en el `localStorage` de un solo dispositivo. Retomar una sesión en pausa guarda solo el estado y los números derivados (24 h).
- PDF, Entiendo, lecturas SOLO, recordatorios reales y WhatsApp no están en este MVP.
