# Ñawinchay — documento técnico y de interfaces

Lector-evaluador oral bilingüe (quechua chanka / castellano) para docentes multigrado EIB de Ayacucho, ciclos IV y V (3.º a 6.º de primaria).
Hack the Andes 2026 · Track Educación Escolar (`education`) · Lima, 17–18 de octubre de 2026.

> Estado: diseño implementable, todavía no construido ni validado con niños. Las cifras marcadas como *hipótesis* deben medirse en el piloto. Los textos en quechua de este documento son borradores y debe validarlos un hablante (Omar) antes de usarlos.

---

## 1. Resumen

**Qué es.** Una app web instalable en el celular o la tableta del docente. Escucha a cada niño leer en voz alta en quechua chanka o en castellano, mide su fluidez, le hace preguntas orales que exigen comprender y pensar (incluida una *contraprueba*), y entrega al docente grupos por nivel y un plan para el día siguiente. Los viernes envía un audio corto a la familia.

**Para quién.**
- Usuario principal: docente multigrado de una escuela EIB de Ayacucho, hable o no con fluidez el quechua.
- Beneficiario: niño de 3.º a 6.º de primaria cuya lengua materna es el quechua chanka.
- Usuario secundario: familia (solo recibe audios) y especialista de UGEL (solo ve agregados).

**Problema que resuelve.** El docente multigrado no sabe en qué nivel lee y razona cada niño, menos aún en quechua. Por eso enseña por grado y con preguntas literales. Nadie mide la lectura crítica en lengua materna:
- Solo 3,1 % de niños de 4.º en escuelas EIB chanka alcanzó el nivel Satisfactorio leyendo en su lengua (ECE 2018).
- Solo 13,8 % de las preguntas de comprensión que formulan los docentes piden reflexionar sobre el texto (UMC, EM 2022).
- La prueba nacional en lengua originaria tiene 0–2 % de ítems de reflexión, excluye escuelas con menos de 5 alumnos por grado, y la ENLA 2026 se canceló.
- Ayacucho tiene 2940 IIEE EIB chanka y 580 plazas EIB quedaron desiertas por falta de dominio de la lengua.

**Qué lo diferencia.**
- No es un chatbot: el niño no conversa libremente con una IA. Sigue un protocolo fijo (lee → responde → defiende → lo intenta solo).
- No es un planificador de sesiones (ese espacio está saturado): parte de evidencia del niño, no de texto generado.
- No existe un producto que escuche leer a un niño en quechua y evalúe su comprensión (Read Along, Amira y Ello no trabajan quechua).

---

## 2. Protocolo pedagógico

Cada sesión de un niño dura unos 3 minutos y sigue siempre el mismo orden:

| Paso | Qué hace el niño | Qué se mide | Base |
|---|---|---|---|
| 1. Lee | Lee en voz alta un texto breve durante 60 s | Fluidez: palabras correctas por minuto (PCPM) y errores | EGRA, van der Velde et al. 2025 |
| 2. Obtiene | Responde oralmente una pregunta literal | Capacidad O | Capacidades de lectura de la ENLA |
| 3. Infiere | Responde una pregunta de causa o intención | Capacidad I | ENLA; Reciprocal Teaching (EEF) |
| 4. Reflexiona con contraprueba | Toma postura, escucha un dato que la reta, mantiene o cambia y explica por qué | Capacidad R | Toulmin; Abrami 2015 (g = 0,57 con diálogo); Bastani 2025 |
| 5. Solo (viernes) | Lee un texto nuevo y responde sin repeticiones ni ayudas | Transferencia | Evidence-Centered Design (Mislevy 2003) |

Reglas pedagógicas:
- El niño siempre responde **antes** de recibir ayuda. La única ayuda permitida es repetir la pregunta o reformularla más simple, y queda registrada como "con ayuda".
- Mantener la respuesta con una buena razón cuenta como acierto. La contraprueba no busca que el niño cambie de opinión, busca que justifique.
- Primero en lengua materna y oral; el castellano escrito viene después (transferencia L1→L2, Cummins).
- Los textos tratan temas del entorno (agua, chacra, fiestas, animales) para construir conocimiento a la vez que comprensión.

---

## 3. Arquitectura

```
┌───────────────────────────────┐
│  PWA (Next.js + React)        │  celular/tableta del docente
│  - IndexedDB: cola offline    │  modo docente y modo niño
│  - MediaRecorder (opus)       │
└──────────────┬────────────────┘
               │ HTTPS (cuando hay señal)
┌──────────────▼────────────────┐
│  API (Next.js route handlers) │  auth, aulas, lecturas, intentos,
│                               │  grupos, exportes, webhooks
└───┬───────────────┬───────────┘
    │               │
┌───▼─────────┐ ┌───▼──────────────────────┐   ┌──────────────────────┐
│ Postgres +  │ │ Servicio de voz (Python) │   │ Servicio evaluación  │
│ Storage     │ │ FastAPI + GPU por demanda│   │ reglas + LLM rúbrica │
│ (Supabase)  │ │ ASR quy/es, alineación,  │   │ NLLB quy→es apoyo    │
│             │ │ TTS quy                  │   │                      │
└─────────────┘ └──────────────────────────┘   └──────────────────────┘
                              │
                     ┌────────▼─────────┐
                     │ WhatsApp Cloud   │  audios a familias (opt-in)
                     │ API              │
                     └──────────────────┘
```

### 3.1 Componentes

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| App cliente | Next.js (App Router), React, TypeScript, PWA con service worker, IndexedDB (Dexie) | Interfaces de docente y niño; grabación por botón; cola offline; reproducción de audios |
| API | Next.js route handlers, Zod para validar entradas | Auth del docente, CRUD de aulas y lecturas, recepción de intentos, cálculo de grupos, exportes |
| Base de datos | Supabase Postgres con Row Level Security | Datos seudonimizados por aula; cada docente ve solo su aula |
| Almacenamiento | Supabase Storage | Audios temporales (borrado automático tras transcribir) y audios TTS aprobados |
| Servicio de voz | Python 3.12, FastAPI, PyTorch, torchaudio; GPU por demanda (Modal, RunPod o similar) | ASR quechua chanka y castellano, alineación forzada, TTS quechua |
| Servicio de evaluación | Mismo servicio Python o función Node; LLM vía API | Puntuación O por reglas; I y R con rúbrica; traducción de apoyo |
| Mensajería | WhatsApp Cloud API (Meta) | Plantilla de utilidad + audio semanal a familias con consentimiento |
| Observabilidad | Logs estructurados + tabla de métricas | Latencia, CER en el set de validación, acuerdo IA–docente |

### 3.2 Modelos

| Tarea | Modelo | Nota |
|---|---|---|
| Reconocimiento de voz quechua (quy) | Omnilingual ASR (Meta, Apache 2.0); alternativa MMS (`mms-1b-all`, adaptador quy) | CER 2,7 reportado en quy con habla adulta; **no medido con niños** |
| Reconocimiento de voz castellano | Omnilingual ASR o Whisper | Para la ruta castellano L2 |
| Síntesis de voz quechua | MMS-TTS `mms-tts-quy` | Se genera solo cuando el docente aprueba la lectura; se guarda en caché |
| Traducción de apoyo quy→es | NLLB-200 (`quy_Latn`) | Solo para que el docente que no habla quechua entienda la respuesta; nunca reemplaza el original |
| Generación de lecturas y preguntas | LLM vía API (p. ej. Claude Haiku 5.5) con RAG sobre glosario chanka | Salida JSON validada por esquema |
| Extracción de texto de una foto | LLM con visión | Para fotos del cuaderno de trabajo |
| Puntuación I y R | LLM con rúbrica anclada y ejemplos | 3 corridas; desacuerdo → revisión docente |

### 3.3 Funcionamiento sin conexión

- Al tener señal, la app descarga: lecturas aprobadas, audios TTS, lista del aula y grupos vigentes.
- Sin señal, el docente puede tomar lecturas: el audio y los metadatos se guardan en IndexedDB con estado `pendiente`.
- Al volver la señal, la cola sube en orden con reintentos idempotentes (cada intento tiene un `client_id` UUID; el servidor ignora duplicados).
- Los resultados (PCPM, niveles) aparecen cuando el servidor termina de procesar. La interfaz siempre muestra el estado: `guardado en el equipo`, `enviando`, `procesado`.
- Fase posterior (fuera del MVP): ASR en el dispositivo con un modelo cuantizado.

---

## 4. Lógica técnica clave

### 4.1 Generación de lecturas (P1–P2)

1. **Entrada:** foto o PDF del cuaderno de trabajo, o un tema local escrito o dictado; lengua (`quy`, `es`, ambas); grados del aula.
2. **Extracción:** si es foto o PDF, un modelo con visión extrae el texto.
3. **Recuperación:** se buscan en el glosario pedagógico chanka (neologismos de Comunicación y Matemática documentados por Gálvez Astorayme et al., 2022) y en un corpus de textos chanka revisados los términos relacionados.
4. **Generación:** el LLM produce un JSON con:
   - el texto en 3 niveles: A (40–60 palabras, oraciones simples), B (60–90), C (90–130);
   - la versión en castellano de cada nivel;
   - 3 preguntas (O, I, R) con clave de respuesta y sinónimos aceptables;
   - un dato de contraprueba para la pregunta R.
5. **Validación automática:** esquema Zod; palabras quechua fuera del glosario o del corpus se marcan en amarillo para revisión.
6. **Aprobación:** el docente edita y aprueba. Solo entonces se genera el audio TTS de las preguntas y la lectura queda disponible para el modo niño.

### 4.2 Fluidez (P4)

1. **Grabación:** el niño mantiene el botón; se graba en opus a 16 kHz mono. Duración máxima 60 s.
2. **Normalización del texto esperado:** minúsculas, sin puntuación, variantes gráficas unificadas según una tabla acordada con el hablante (p. ej. grafías alternativas de la misma palabra).
3. **Reconocimiento:** el ASR produce las emisiones CTC y la transcripción.
4. **Alineación:**
   - principal: alineación forzada CTC del audio con el texto esperado (`torchaudio.functional.forced_align`), que da tiempo y probabilidad por palabra;
   - respaldo: alineación de Levenshtein por palabras entre transcripción y texto esperado.
5. **Clasificación por palabra:** correcta (alineada y probabilidad ≥ umbral), sustitución, omisión o inserción. Las repeticiones y autocorrecciones no penalizan.
6. **Cálculo:** `PCPM = palabras_correctas / segundos_leídos × 60`; precisión = correctas / palabras intentadas.
7. **Confianza:** si la confianza media del audio es baja (ruido, silencio, micrófono), el resultado es `NO observable`, nunca "error del niño".

### 4.3 Puntuación de respuestas (P5)

| Capacidad | Cómo se puntúa | Niveles |
|---|---|---|
| O · obtiene | Reglas: la transcripción contiene el lema clave o un sinónimo aceptado | 0 no responde / incorrecto · 2 correcto parcial · 3 correcto completo · NO |
| I · infiere | LLM con rúbrica anclada y 2 ejemplos por nivel, sobre la transcripción quy y su traducción de apoyo | 0 sin relación · 1 repite el texto sin inferir · 2 inferencia válida · 3 inferencia válida con dato del texto · NO |
| R · reflexiona (contraprueba) | LLM con rúbrica; registra postura inicial, si cambió y la razón | 0 sin razón · 1 razón sin texto · 2 razón con dato del texto o del dato nuevo · 3 además considera la otra opción · NO |

Reglas del motor:
- **3 corridas** por respuesta abierta. Si los niveles difieren, la respuesta pasa a "dudosa" y va a P7.
- **Mínimo de evidencia:** respuestas de menos de 3 palabras no superan el nivel 1 en I ni en R (los LLM sobrevaloran respuestas cortas).
- **Con ayuda:** si el niño respondió después de que se repitiera o simplificara la pregunta, el nivel se guarda con la marca `con_ayuda`.
- **La IA propone, el docente decide:** ningún nivel se usa para el registro oficial sin confirmación.
- **Prohibido:** inferir capacidad por acento, velocidad de habla o emoción; dar la respuesta al niño; generar una nota global.

### 4.4 Agrupación semanal (P6)

Reglas iniciales (*hipótesis*, no existen normas de PCPM en chanka):

| Grupo | Condición | Actividad sugerida |
|---|---|---|
| G1 · aún decodifica | PCPM < 30 u O ≤ 1 | Lectura guiada con el docente y audio modelo |
| G2 · lee, infiere poco | PCPM 30–55 o I ≤ 1 | Preguntas de inferencia en pares |
| G3 · listo para reflexionar | PCPM > 55 y O ≥ 2 e I ≥ 2 | Contraprueba retadora, trabajan solos |

- Se usa la mediana de las últimas 2 sesiones para evitar que un mal día mueva a un niño de grupo.
- El docente puede mover a un niño manualmente; el cambio queda registrado.
- Los umbrales se calibrarán con los datos del piloto.

### 4.5 Audio a la familia (P9)

- Solo a familias con consentimiento registrado (opt-in en P0).
- Plantilla de utilidad aprobada por Meta con 2 líneas en castellano y un audio en chanka generado por TTS a partir de un guion fijo con variables (nombre, PCPM, una fortaleza, una pregunta para conversar en casa).
- Envío los viernes a las 6 p. m.; si falla, un reintento el sábado.
- Contenido permitido: progreso propio y una sugerencia. Contenido prohibido: comparaciones con otros niños, notas, diagnósticos.

---

## 5. Modelo de datos

```sql
teacher(id, name, phone, school_id, created_at)
school(id, codigo_modular, name, ugel, district, eib_language)        -- código modular de ESCALE
classroom(id, school_id, teacher_id, grades int[], name)
student(id, classroom_id, alias, color, grade, home_language, l2_language, active)
family_contact(id, student_id, phone_encrypted, consent_at, consent_scope, language)
reading(id, classroom_id, source_type, topic, level, text_quy, text_es,
        approved_by, approved_at, glossary_flags jsonb)
question(id, reading_id, capacity check (capacity in ('O','I','R')),
         prompt_quy, prompt_es, answer_key jsonb, counter_fact_quy, counter_fact_es, tts_url)
session(id, student_id, reading_id, mode check (mode in ('practica','solo')), started_at, client_id unique)
reading_attempt(id, session_id, duration_s, words_expected, words_correct, pcpm,
                accuracy, errors jsonb, asr_confidence, observable boolean)
answer(id, session_id, question_id, transcript_quy, translation_es, initial_stance, changed boolean,
       proposed_level, quote, runs jsonb, status check (status in ('propuesto','dudoso','confirmado')),
       with_help boolean, confirmed_level, confirmed_by)
weekly_group(id, classroom_id, week, student_id, group_code, rule_snapshot jsonb, overridden_by)
message_log(id, family_contact_id, week, template, status, sent_at)
audio_blob(id, session_id, storage_path, delete_after)                -- borrado automático
```

Reglas de acceso (RLS): un docente solo lee y escribe filas de su `classroom`. La UGEL solo accede a vistas agregadas sin alias.

---

## 6. API

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/auth/otp` | Login del docente por código SMS o correo |
| GET/POST | `/api/classrooms/:id/students` | Lista y alta de niños |
| POST | `/api/readings/draft` | Envía foto, PDF o tema; devuelve borrador JSON |
| PATCH | `/api/readings/:id` | Ediciones del docente |
| POST | `/api/readings/:id/approve` | Aprueba y dispara la generación de TTS |
| POST | `/api/sessions` | Crea sesión (idempotente por `client_id`) |
| POST | `/api/sessions/:id/reading-audio` | Sube el audio de lectura → servicio de voz |
| POST | `/api/sessions/:id/answers` | Sube el audio de una respuesta → transcripción y puntuación |
| GET | `/api/classrooms/:id/groups?week=` | Grupos y plan sugerido |
| GET | `/api/classrooms/:id/review` | Respuestas dudosas |
| POST | `/api/answers/:id/confirm` | Confirma o cambia un nivel |
| GET | `/api/students/:id/profile` | Ficha del niño |
| POST | `/api/messages/weekly` | Tarea programada del viernes |
| GET | `/api/classrooms/:id/export?period=` | Evidencias por competencia para el registro AD/A/B/C |

Servicio de voz (interno):
- `POST /asr/align` → `{audio, expected_text, lang}` → palabras con tiempos, probabilidades, PCPM, errores.
- `POST /asr/transcribe` → `{audio, lang}` → transcripción y confianza.
- `POST /tts` → `{text, lang:'quy'}` → audio.

---

## 7. Interfaces en detalle

Principios comunes:
- **Audio primero en modo niño:** cada consigna se escucha; el texto escrito es apoyo.
- **Botones grandes** (mínimo 56 px), alto contraste, como máximo 2 decisiones por pantalla en modo niño.
- **Graba solo mientras se mantiene el botón;** un indicador rojo muestra que está grabando.
- **Estado de conexión siempre visible** en la barra superior: `Sin señal · se guarda`, `Enviando 3`, `Todo al día`.
- **Idioma de la interfaz:** docente en castellano con términos en quechua; modo niño en quechua chanka con opción de castellano.
- **Accesibilidad:** foco visible, etiquetas en todos los controles, sin depender solo del color (los niveles llevan letra y número), respeto a `prefers-reduced-motion`.

### P0 · Mi aula (docente, configuración inicial)

- **Objetivo:** registrar el aula una sola vez.
- **Contenido:** nombre de la escuela (búsqueda por código modular de ESCALE), grados que atiende, lista de niños con alias, grado, color y lengua de casa (quechua, castellano o ambas), y teléfono de la familia con casilla de consentimiento.
- **Acciones:** agregar niño, editar, desactivar; registrar consentimiento (texto leído en voz alta en quechua y castellano).
- **Estados:** vacío ("Agrega a tu primer estudiante"), sin señal (se guarda local), error de teléfono inválido.
- **Reglas:** no se piden apellidos, fotos ni DNI del niño.

### P1 · Nueva lectura (docente)

- **Objetivo:** convertir el material del docente en una lectura evaluable.
- **Contenido:** zona grande para fotografiar la página o subir un PDF; campo opcional de tema local (escrito o dictado); selector de lengua (quechua chanka, castellano, ambas); grados del aula preseleccionados.
- **Acción principal:** "Preparar lectura".
- **Estados:**
  - cargando: "Leyendo tu foto…" y luego "Preparando 3 niveles…" (≈ 10–20 s);
  - sin señal: "Necesitas señal para preparar una lectura nueva. Puedes usar las lecturas ya aprobadas";
  - foto ilegible: "No pudimos leer la foto. Toma otra con más luz".
- **Diferencia con Entiendo:** el material del docente no se transforma en contenido para mirar, sino en preguntas que el niño debe responder.

### P2 · Revisa y aprueba (docente)

- **Objetivo:** que nada llegue al niño sin control humano.
- **Contenido:**
  - pestañas de nivel A / B / C con el texto en quechua y, debajo, la traducción en castellano en cursiva;
  - tres tarjetas de pregunta etiquetadas **Obtiene** (azul), **Infiere** (amarillo) y **Reflexiona** (rojo), cada una con su versión en castellano y la clave de respuesta;
  - la tarjeta Reflexiona muestra además el **dato de contraprueba**;
  - aviso amarillo cuando hay palabras fuera del glosario ("2 palabras no están en el glosario chanka").
- **Acciones:** tocar cualquier texto para editarlo; escuchar la pregunta con TTS de prueba; "Aprobar".
- **Al aprobar:** se generan y guardan los audios; la lectura aparece en el modo niño y se descarga al equipo.

### P3 · ¿Quién lee? (modo niño)

- **Objetivo:** que el niño se identifique sin escribir.
- **Contenido:** cuadrícula de tarjetas con el alias y el color de cada niño del aula; los que ya leyeron hoy aparecen con un check.
- **Acción:** el niño toca su nombre; la app pasa a modo niño (se ocultan menús del docente).
- **Salida del modo niño:** mantener presionado el ícono del docente 3 segundos.

### P4 · Lee en voz alta (modo niño)

- **Objetivo:** medir fluidez con 60 s de lectura.
- **Contenido:**
  - el texto en letra grande (≥ 22 px) con interlineado amplio;
  - botón rojo circular grande "Mantén para leer";
  - cronómetro visible;
  - audio modelo opcional solo para el grupo G1 (en práctica, nunca en Solo).
- **Durante la lectura:** las palabras ya leídas se marcan suavemente; las dudosas no se marcan en rojo frente al niño (el error se muestra solo al docente).
- **Al terminar:** mensaje de ánimo en quechua y paso a las preguntas. El PCPM se muestra solo en la vista del docente.
- **Estados:** micrófono bloqueado ("Pide ayuda a tu profesor"), audio demasiado corto, ruido alto (se marca NO observable).

### P5 · Responde y defiende (modo niño)

- **Objetivo:** recoger las respuestas a O, I y R.
- **Contenido por pregunta:** botón de reproducir la pregunta en quechua (se reproduce sola al entrar), el texto de la pregunta, botón "Mantén para responder".
- **Pregunta R (contraprueba):**
  1. el niño responde su postura;
  2. aparece una tarjeta amarilla con el dato que la reta, leído en voz alta;
  3. dos botones grandes: **Mantengo** / **Cambio**;
  4. "¿Imanaptin?" (¿por qué?) y botón para responder.
- **Ayuda permitida:** botón "Otra vez" que repite la pregunta (queda registrado); en el segundo intento se ofrece una versión más simple (queda marcado "con ayuda").
- **Modo Solo (viernes):** sin botón "Otra vez" ni versión simple; un sello indica "Solo".
- **Al terminar:** "Allinmi" y regreso a P3 para el siguiente niño.

### P6 · Grupos por nivel (docente)

- **Objetivo:** responder en 2 minutos "¿quién necesita qué mañana?".
- **Contenido:**
  - tres bloques G1, G2 y G3 con nombre, criterio y número de niños;
  - en cada niño: alias, grado (etiqueta gris), PCPM en número y tres casillas O / I / R con color y número de nivel;
  - un recuadro "Plan sugerido" con una actividad por grupo;
  - aviso de respuestas dudosas pendientes con enlace a P7.
- **Mensaje clave:** los grupos mezclan grados (un niño de 4.º y uno de 6.º pueden estar juntos).
- **Acciones:** arrastrar a un niño a otro grupo (se registra), tocar un niño para abrir P8, compartir el plan como imagen.

### P7 · Revisar dudosos (docente)

- **Objetivo:** confirmar niveles donde la IA no está segura.
- **Contenido por respuesta:** pregunta, botón para escuchar el audio del niño, transcripción en quechua, traducción de apoyo, nivel propuesto con la cita que lo justifica, y la rúbrica del nivel en una línea.
- **Acciones:** "Confirmar" o elegir otro nivel (0, 1, 2, 3, NO). Tiempo objetivo: menos de 30 s por respuesta.
- **Nota:** cada confirmación alimenta la medición de acuerdo IA–docente.

### P8 · Ficha del niño (docente)

- **Contenido:** línea de PCPM por semana; evolución de O, I y R; últimas respuestas de reflexión con la frase de antes y la de después de la contraprueba; lecturas Solo logradas vs. con ayuda.
- **Acciones:** escuchar audios guardados con permiso, agregar una nota del docente.
- **Regla:** no hay comparación con otros niños en esta pantalla.

### P9 · Audio a la familia (WhatsApp)

- **Contenido:** un audio de unos 20–30 s en quechua chanka y dos líneas en castellano, por ejemplo: "Esta semana Yeni leyó 38 palabras por minuto y supo explicar por qué cambió de opinión. Pregúntale esta noche: ¿Imanaptintaq? cuando te cuente algo."
- **Momento:** viernes 6 p. m.
- **Opciones de la familia:** responder con un emoji o audio (se guarda como acuse), escribir "BAJA" para dejar de recibir.

### P10 · Sincronizar y exportar (docente)

- **Sincronizar:** lista de sesiones guardadas en el equipo con su estado; botón "Enviar ahora"; última sincronización.
- **Exportar:** al cierre del bimestre, por niño y por competencia "Lee diversos tipos de textos": evidencias (frases y niveles confirmados) y una propuesta de nivel AD/A/B/C con borrador de conclusión descriptiva. El docente decide el nivel final.

---

## 8. Seguridad, privacidad y datos comunitarios

- Consentimiento informado de la familia (y acuerdo con la comunidad) antes de grabar, conforme a la Ley 29733 y las recomendaciones de la ANPD.
- Audio con retención de 0 días por defecto: se borra al transcribir. Guardarlo para mejorar el modelo requiere permiso explícito y un acuerdo comunitario de uso de datos (principios CARE).
- Niños sin cuenta, sin foto, sin DNI: alias y color. Teléfonos de familias cifrados.
- Row Level Security por aula; la UGEL solo ve agregados anónimos.
- La IA propone y el docente decide; ningún resultado automático entra al registro oficial sin confirmación.

---

## 9. Pruebas y métricas técnicas

Pruebas automatizadas (escritas antes del código, modo TDD):
- Alineación y PCPM: casos con lectura perfecta, omisiones, sustituciones, inserciones, autocorrección y silencio.
- Normalizador ortográfico chanka: tabla de equivalencias acordada con el hablante.
- Reglas de puntuación O y de agrupación G1–G3, incluidos los límites (29/30, 55/56 PCPM).
- Idempotencia de la cola offline (el mismo `client_id` dos veces no duplica sesiones).
- Validación del JSON de lecturas generadas.

Métricas a reportar en el pitch (solo si se miden de verdad):
- CER/WER del ASR sobre 10–20 lecturas grabadas por Omar y por becarios quechuahablantes.
- Acuerdo IA–docente (κ) en niveles de I y R sobre las respuestas revisadas.
- Latencia de procesamiento por sesión.

---

## 10. Costos estimados

| Concepto | Supuesto | Costo por niño al mes |
|---|---|---|
| Reconocimiento de voz | ~4 min de audio, GPU por demanda | ≈ US$0,10 |
| LLM (lecturas y puntuación) | modelo ligero, 3 corridas por respuesta abierta | ≈ US$0,05 |
| WhatsApp | 4 mensajes de utilidad (tarifa Perú por verificar) | ≈ US$0,05–0,10 |
| **Total** | sin hardware nuevo | **≈ US$0,2–0,3** |

Pagadores posibles: DRE y UGEL de Ayacucho, ONG con presencia rural (Tarea, Fe y Alegría), ProInnóvate, cooperación (BID ya evaluó una app de quechua en Perú). No se cobra a las familias en esta etapa.

---

## 11. Plan de construcción para el evento (~30 h)

| Horas | Entrega |
|---|---|
| 0–3 | Repositorio, Supabase, esqueleto PWA desplegado; servicio de voz con ASR quy respondiendo; Omar graba 10 lecturas de prueba |
| 3–10 | P4 completo: grabación, alineación, PCPM y errores, con pruebas |
| 10–16 | P1–P2: generación con glosario, edición, aprobación y TTS; P5 con contraprueba |
| 16–22 | Puntuación con rúbrica y 3 corridas; P6 grupos; P7 dudosos |
| 22–26 | P9 WhatsApp con plantilla; P10 cola offline básica; P0 mínima |
| 26–30 | Despliegue final, medición de CER con voz real, video de respaldo, presentación y entrega con `andes project submit` |

Fuera del MVP: ASR en el dispositivo, lenguas amazónicas, P8 completa, exportación AD/A/B/C, integración con SIAGIE.

### Guion de demo (90 s)

1. El docente fotografía una página y aprueba la lectura en quechua (P1–P2).
2. Omar lee en vivo; la pantalla muestra la transcripción, los errores y el PCPM (P4).
3. Responde la pregunta de reflexión, recibe la contraprueba y cambia de opinión con una razón (P5).
4. Aparece en P6 dentro de un grupo, junto a niños de otro grado, con el plan de mañana.
5. Se muestra el audio que recibiría su familia (P9).

---

## 12. Riesgos y supuestos

| Riesgo | Mitigación |
|---|---|
| El ASR se probó con adultos (CER 2,7 en quy), no con niños ni con ruido de aula | Medir con voz real; mostrar "NO observable" en vez de penalizar; recolectar datos infantiles con consentimiento |
| Calidad del quechua generado (los LLM traducen mal lenguas indígenas) | Glosario + corpus + revisión obligatoria del docente o hablante |
| Variación dialectal y ortográfica | Normalizador acordado; empezar solo con chanka |
| Umbrales de PCPM sin normas en chanka | Tratarlos como hipótesis y calibrar con el piloto |
| Conectividad rural | Offline primero, sincronización diferida |
| Cifras desactualizadas o contradictorias (3,1 % es de 2018; cifras EIB 2023–2025 difieren) | Citar el año y la fuente primaria en el pitch |
| Docentes que no adoptan la herramienta | Mostrar ahorro de tiempo (plan de mañana en 2 minutos) y validarlo en entrevistas |

---

## 13. Fuentes principales

Las fuentes con sus enlaces están en los informes del equipo:
- *Educación escolar rural en el Perú: diagnóstico 2022-2026* (D1).
- *Soluciones existentes y espacios en blanco para la educación rural en el Perú* (D2).
- *Evaluación nacional, población objetivo y pensamiento crítico en la era de la IA* (D3).
- *Comprensión lectora en la EIB como base del pensamiento crítico* (quechua chanka, Ayacucho).
- `reports/` de este repositorio: deserción, saturación de información y evaluación del pensamiento crítico.
