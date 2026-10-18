# Ñawinchay · MVP educativo

Web para practicar lectura y razonamiento con alias, misiones, evidencia provisional y revisión de la familia o docente. **No es una evaluación clínica ni un producto validado con escolares peruanos.**

- Sitio: https://nawinchay-voice-mvp.vercel.app
- Rama: `codex/nawinchay-voice-mvp`.
- Vercel: proyecto separado `nawinchay-voice-mvp`, **Root Directory `web`**. La raíz del repositorio pertenece a Fixazo y no debe desplegarse como Ñawinchay.
- [Despliegue, secretos y límites](DEPLOYMENT.md) · [Investigación y licencias](docs/VOICE-RESEARCH.md) · [Servidor Meta](services/indigenous/README.md).

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
| `/consentimiento` | Alias, grado, lenguas y permisos separados |
| `/chat` | Lectura pegada, ejemplos; foto solo con Claude configurado |
| `/sesion` | Check-in → lectura → preguntas → postura → contraprueba → revisión → check-out |
| `/informe` | Evidencia provisional, revisión humana, contexto y fuente ASR |
| `/progreso` | Historial local del navegador, no cuenta remota |
| `/privacidad` | Exportar, borrar datos y revisar permisos |
| `/voz` | Demo conversacional independiente; no califica ni guarda respuestas del participante |
| `/lenguas` | Demo de transcripción indígena Meta y traducción de investigación; requiere backend externo |

Pausar sigue disponible durante la misión. Los borradores guardados tienen duración limitada y se depuran; no incluyen audio, códigos de acceso, estado emocional inferido ni línea base acústica.

## Qué modelos usa realmente

| Función | Implementación y disponibilidad |
|---|---|
| Castellano sin descargar modelo | Web Speech `es-PE`, servicio y modelo opacos del navegador. Puede enviar voz a su proveedor; Opera puede tener micrófono sin transcripción |
| Castellano sin cuenta de voz | Whisper base multilingüe ONNX (`onnx-community/whisper-base_timestamped`), Transformers.js 4.3.1, WASM q8 en Web Worker. Preparación **explícita** de ~80 MB más runtime. Solo castellano en este MVP; inferencia local, no streaming instantáneo |
| Castellano en nube opcional | Deepgram Nova-3, `es-419`, tiempos por palabra y resultados provisionales. Desactivado sin clave y autorización; `mip_opt_out=true` |
| Voz de las misiones | `speechSynthesis`, voz del sistema operativo; no un modelo elegido por la app |
| Conversación de voz `/voz` | OpenAI `gpt-realtime-2.1`, voz `marin`, WebRTC con token efímero y turnos manuales. Demo aparte, desactivada sin configuración |
| Lenguas indígenas `/lenguas` | Meta Omnilingual ASR autoalojado: `quy_Latn` (Ayacucho), `quz_Latn` (Cusco), `ayr_Latn` (aimara), `spa_Latn`. Transcripción por turnos; no sigue la lectura por palabra ni traduce por sí solo |
| Traducción experimental | NLLB-200 600M: `quy_Latn`, `ayr_Latn`, `spa_Latn`. Licencia CC-BY-NC 4.0, opt-in de investigación no comercial. No transforma `quz` en `quy` silenciosamente |
| Misiones/juez | Reglas por defecto. Claude Haiku 5.5 opcional (`ANTHROPIC_API_KEY`), tres corridas para el juez y fallback a reglas. Claude no recibe audio para alinear lectura |
| Señales acústicas | Web Audio y heurísticas locales; no modelo de emoción, identidad, edad, acento o salud |

**Tener el código no significa que el servicio esté activo.** `/api/asr`, `/api/voice/session` y `/api/indigenous` muestran configuración y límites. Meta necesita un servidor de inferencia fuera de Vercel y pesos precargados: este repositorio incluye el servicio, no una GPU hospedada. Sin claves ni servidor, las demos externas se muestran desactivadas y no simulan respuestas.

## Si la voz falla en Opera

1. Abrir HTTPS o localhost. Una IP de red HTTP desde el celular no es contexto seguro.
2. Comprobar permisos del sitio, sistema operativo y dispositivo de entrada.
3. «Probar micrófono» mide señal local, no verifica ASR ni identifica a quien habla.
4. Elegir Whisper local y prepararlo explícitamente, un proveedor autorizado o transcripción manual. Cambiar a Opera móvil no garantiza soporte.
5. Si no hay transcripción fiable, marcar **No observable**, nunca respuesta incorrecta por un fallo técnico.

## Seguimiento y evaluación

El resaltado compara la hipótesis reconocida con el prefijo del pasaje. Prioriza la primera coincidencia, permite corregir resultados provisionales y solo cierra automáticamente con resultado final y cobertura suficiente. No se alimenta al ASR con la lectura esperada para luego usar su coincidencia como prueba de exactitud.

Los tiempos de descarga, conexión y procesamiento final no cuentan como tiempo de lectura ni silencio del niño. En modelo local puede haber espera para transcribir; no se promete seguimiento instantáneo. Los tiempos de palabra, si existen, son del ASR: **no son alineación forzada verificada con el pasaje**. El informe conserva solo procedencia mínima, no credenciales, audio ni timestamps crudos.

En manual se compara al enviar, no mientras el adulto escribe. Una hipótesis ajena al texto deja precisión y PCPM no observables. Repeticiones, autocorrecciones y muletillas pueden ser eliminadas por el ASR: «no encontradas en la transcripción» no significa que no ocurrieran.

La evidencia de lectura, obtención, inferencia y postura/revisión debe confirmarse individualmente por una persona. **No observable ≠ 0**. Mantener una postura con evidencia vale igual que cambiarla. La ayuda adulta se declara, no se infiere del tono. La revisión guardada localmente no autentica al docente ni demuestra validación científica.

## Privacidad y límites

- Sin clasificación emocional inferida, huella vocal, identificación de hablante, juicios de acento ni señales de salud. El ánimo es únicamente autorreporte voluntario identificado como tal.
- Cambios de ritmo solo ofrecen una pausa genérica en vivo; no se guardan como ansiedad o cansancio.
- El audio de Whisper se conserva temporalmente en memoria para transcribir en el dispositivo y se descarta. Deepgram/OpenAI reciben audio al elegirlos; la demo Meta envía una muestra al servidor configurado. La app no persiste grabaciones, pero no se promete procesamiento exclusivamente local para esas rutas.
- Los códigos de acceso de demos quedan solo en memoria y no se exportan. No usar datos personales en las pruebas.
- Servicios externos desactivados por defecto. `adult-demo` exige confirmación de voz adulta/sintética y acceso restringido. Un piloto infantil exige revisión real de privacidad; las banderas no sustituyen consentimiento, contratos ni ZDR cuando corresponde.
- Límites de cliente/tokens y rate limit en memoria **no son presupuestos ni cuotas distribuidas**. Configurar protección y topes del proveedor. Claude existente no tiene autenticación de aplicación: no activar una clave en una URL abierta.
- `localStorage` es por origen y navegador; no hay sincronización entre dispositivo, localhost y Vercel. Exportar/borrar está en Privacidad.
- Quechua de las misiones sigue siendo borrador hasta validación por hablantes. La demo indígena es independiente, sin calificación ni voz quechua sintética presentada como nativa.

## Arquitectura breve

`SessionController` coordina una máquina de estados pura, TTS, `Transcriber`, Web Audio y análisis de texto. `lib/signals` extrae evidencia; `report/build` genera informe y `guardrails`/`storage` impiden persistir campos prohibidos. `lib/transcription` valida procedencia ASR. APIs de servidor emiten credenciales efímeras o actúan como proxy autorizado; nunca publican claves permanentes. `services/indigenous` es un proceso Python separado, no una función de Vercel.

Próximo requisito para un piloto real: validar WER/CER y traducciones por variedad/edad, latencia por dispositivo, errores de seguimiento y acuerdo docente; incorporar gobierno de datos con las comunidades. Ni un benchmark general ni pasar pruebas unitarias demuestran funcionamiento óptimo con niños.
