# PRD · Ñawinchay — Chat familiar y sesión de voz

| Campo | Valor |
|---|---|
| Producto | Ñawinchay (del quechua *ñawinchay*, "leer") |
| Versión del documento | 1.0 · 17 de octubre de 2026 |
| Estado | Borrador para diseño y construcción del MVP (Hack the Andes 2026) |
| Track | Educación Escolar (`education`) |
| Diseño de referencia | Figma: https://www.figma.com/design/Lr5gIFoF53ag9oMXOYWrEV · Excalidraw: `nawinchay-diseno.excalidraw` |
| Documentos relacionados | `NAWINCHAY.md` (técnico, versión docente), `reports/`, investigaciones del equipo D1–D3, EIB, castellano y rutas |

**Cómo leer este documento.** Las secciones 1–4 explican el porqué y el alcance. Las secciones 5–6 listan requisitos con identificador (RF = funcional, RNF = no funcional), cada uno con prioridad: **P0** (MVP del hackathon), **P1** (piloto), **P2** (después). Las secciones 7–9 son la especificación de diseño: sistema visual, componentes y cada pantalla con medidas, estados y criterios de aceptación. Las secciones 10–14 cubren sesión, métricas, datos, arquitectura y riesgos.

---

## Índice

1. Resumen
2. Problema y evidencia
3. Objetivos, no objetivos y métricas de éxito
4. Usuarios y escenarios
5. Requisitos funcionales
6. Requisitos no funcionales
7. Sistema de diseño
8. Componentes
9. Pantallas
10. Sesión de voz: máquina de estados
11. Métricas y rúbricas
12. Datos y eventos
13. Arquitectura e integraciones
14. Riesgos, supuestos y preguntas abiertas
15. Alcance por fase y criterios de la demo

---

## 1. Resumen

Ñawinchay es una aplicación web donde una **familia** sube la tarea de lectura de su hijo (o trae un material de su espacio en **Entiendo**) y el sistema arma una **misión de 8 minutos**. En la misión, el **niño** conversa por voz con un agente que lo escucha leer, le hace preguntas que exigen comprender y opinar, y le presenta una **contraprueba**: un dato que reta su opinión para que la mantenga o la cambie con una razón. Al terminar, la familia recibe un **informe** claro: fluidez, comprensión en tres niveles, cómo construyó su juicio, cómo lo dijo y cómo se sintió (según el propio niño), más una pregunta para conversar en casa.

Funciona en **castellano** (voz a voz en tiempo real) y en **quechua chanka** (por turnos), para niños de **3.º a 6.º de primaria (8 a 12 años)**.

**Frase del producto:** "Escuchamos cómo lee y cómo piensa tu hijo, y te decimos qué hacer en casa."

---

## 2. Problema y evidencia

| Hallazgo | Dato | Fuente |
|---|---|---|
| La comprensión cae con la escolaridad | Satisfactorio en lectura: 32,7 % en 4.º de primaria, 18,5 % en 2.º de secundaria, 11,3 % en 5.º de secundaria | ENLA 2025 (UMC) |
| La lectura crítica es la más débil | Dificultades para inferir, distinguir hechos de opiniones y evaluar la confiabilidad | UMC, ENLA 2025 |
| La reflexión casi no se practica | Solo 13,8 % de las preguntas de comprensión que hacen los docentes piden reflexionar | UMC, EM 2022 |
| La IA reemplaza la lectura | 54 % de estudiantes usa chatbots cada semana y 40 % los usa para resumir lo que debía leer | Nota OCDE Perú, PISA 2025 |
| La IA que responde daña el aprendizaje | Con GPT-4 sin salvaguardas, la nota en el examen sin IA bajó; con pistas sin respuesta, no | Bastani et al., PNAS 2025 |
| En lengua materna nadie mide | 3,1 % de niños de 4.º EIB chanka en nivel Satisfactorio en L1 (2018); la ENLA no mide L1 y la de 2026 se canceló | ECE 2018, RM 550-2026 |
| La familia no sabe cómo ayudar | Los mensajes breves a familias mejoran asistencia y aprendizaje (Brasil +0,33 DE en pruebas con el programa óptimo) | Eduq+, J-PAL |

**Causa raíz.** La tarea escolar premia el producto (una respuesta) y nadie ve el proceso de comprender y juzgar. Con la IA, el producto sale gratis. La familia quiere ayudar pero no sabe en qué nivel está su hijo ni qué preguntarle.

---

## 3. Objetivos, no objetivos y métricas de éxito

### 3.1 Objetivos

| ID | Objetivo |
|---|---|
| O1 | Que el niño practique comprensión y juicio con su propia voz, sin que la IA le dé respuestas |
| O2 | Que la familia entienda en 1 minuto qué logró su hijo y qué hacer en casa |
| O3 | Medir de forma confiable fluidez, comprensión (obtiene, infiere, reflexiona) y revisión justificada |
| O4 | Funcionar en castellano y en quechua chanka |
| O5 | Reutilizar el material que la familia ya tiene (tarea o Entiendo) |

### 3.2 No objetivos

- No es un chatbot abierto para niños.
- No reemplaza al docente ni pone notas oficiales.
- No detecta emociones de forma automática ni diagnostica dificultades de aprendizaje.
- No genera una nota global de "pensamiento crítico".
- No compara al niño con otros niños.

### 3.3 Métricas de éxito

| Tipo | Métrica | Meta del hackathon | Meta del piloto (8 semanas) |
|---|---|---|---|
| Norte | % de lecturas SOLO logradas sin ayuda | medir en 5–10 personas | +15 puntos frente a la semana 1 |
| Aprendizaje | Revisión justificada tras contraprueba | ≥ 60 % en la demo | ≥ 70 % |
| Aprendizaje | PCPM | medido en vivo | mejora sostenida por niño |
| Producto | Misiones completadas ÷ programadas | — | ≥ 70 % |
| Producto | Tiempo hasta el primer informe | < 10 min desde el registro | < 10 min |
| Calidad | Acuerdo juez IA vs. humano (κ) | reportar | ≥ 0,7 |
| Calidad | CER del reconocimiento (quy / es) | reportar con voces reales | < 15 % en voz infantil |
| Calidad | Latencia de respuesta del agente (castellano, p95) | < 1,2 s | < 0,8 s |

---

## 4. Usuarios y escenarios

### 4.1 Personas

| Persona | Descripción | Necesidad | Dispositivo |
|---|---|---|---|
| **Rosa, madre** (usuaria principal) | 34 años, Huamanga, trabaja; habla quechua y castellano; usa WhatsApp y algo de web | Saber si su hija entiende lo que lee y cómo ayudarla sin hacerle la tarea | Celular Android de gama media; a veces laptop |
| **Yeni, 9 años, 4.º de primaria** (usuaria de la sesión) | Lengua de casa: quechua chanka; lee en castellano en la escuela | Practicar con su voz, sin sentirse examinada | Celular de la madre o laptop |
| **Familiar acompañante** (abuelo, tío, hermano mayor) | Puede ayudar en la sesión; no necesariamente lee bien | Entender el informe sin leer mucho | Celular |
| **Docente** (fase 2) | Multigrado o urbano | Ver qué practica el niño en casa | Web |

### 4.2 Escenarios principales

| ID | Escenario | Resultado esperado |
|---|---|---|
| E1 | Rosa se registra, da su consentimiento y crea el perfil de Yeni | Perfil listo en < 3 min |
| E2 | Rosa fotografía la página 34 del cuaderno de trabajo | Misión de 8 min lista en < 30 s |
| E3 | Rosa trae una transformación de Entiendo ("El ciclo del agua", Super Podcast) | Misión basada en ese material |
| E4 | Yeni hace la misión en el celular de Rosa | Sesión completa sin intervención adulta |
| E5 | Rosa lee el informe y hace la pregunta sugerida en la cena | Rosa entiende el informe en ≤ 1 min |
| E6 | El viernes Yeni hace una lectura SOLO | Se registra transferencia sin ayuda |
| E7 | Rosa revisa el progreso del mes | Ve tendencia y siguiente objetivo |
| E8 | Rosa retira el permiso de grabar | Se detiene la grabación y se informa qué datos se borran |

---

## 5. Requisitos funcionales

### 5.1 Cuenta y consentimiento

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | La familia se registra con número de celular y código SMS, o con correo y enlace mágico | P0 |
| RF-02 | Antes de la primera sesión se muestra la pantalla de consentimiento (F1) con 4 permisos explicados en lenguaje simple | P0 |
| RF-03 | Permisos configurables: voz durante la sesión (obligatorio para usar el producto), "cómo lo dice" (señales de proceso), "cómo se siente" (autorreporte) | P0 |
| RF-04 | El reconocimiento automático de emociones aparece como **no disponible** con su explicación; no existe forma de activarlo | P0 |
| RF-05 | El texto de consentimiento puede escucharse en castellano y en quechua | P1 |
| RF-06 | La familia puede retirar cualquier permiso en Privacidad; el cambio aplica desde la siguiente sesión y se informa qué se borra | P0 |
| RF-07 | La familia puede descargar o borrar todos los datos del niño | P1 |

### 5.2 Perfil del niño

| ID | Requisito | Prioridad |
|---|---|---|
| RF-10 | Crear perfil con alias (no apellidos), grado (3.º–6.º), lengua de casa y lengua de lectura | P0 |
| RF-11 | Una familia puede tener hasta 4 perfiles; el perfil activo se muestra en la barra lateral | P1 |
| RF-12 | No se piden foto, DNI ni fecha de nacimiento exacta | P0 |

### 5.3 Chat familiar (F2)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-20 | Conversación con el asistente en castellano; mensajes del asistente en burbuja blanca a la izquierda y de la familia en burbuja amarilla a la derecha | P0 |
| RF-21 | La familia puede escribir o dictar por voz | P0 |
| RF-22 | Adjuntar foto (JPG/PNG/HEIC, ≤ 10 MB) o PDF (≤ 20 páginas) | P0 |
| RF-23 | Respuestas rápidas en chips debajo del último mensaje del asistente (máximo 3) | P0 |
| RF-24 | El asistente responde preguntas sobre el progreso ("¿cómo va Yeni?") usando solo datos de informes guardados | P1 |
| RF-25 | El asistente no hace la tarea del niño ni da respuestas de la lectura a la familia antes de la sesión | P0 |
| RF-26 | Historial de conversación persistente por perfil | P1 |

### 5.4 Ingesta de material

| ID | Requisito | Prioridad |
|---|---|---|
| RF-30 | Extraer texto de una foto o PDF con un modelo de visión; si es ilegible, pedir otra foto con un mensaje concreto | P0 |
| RF-31 | Panel "Traer de Entiendo" con los materiales del workspace conectado: tipo de transformación, título y uso sugerido | P1 (depende de API) |
| RF-32 | Si no hay integración con Entiendo, permitir pegar el texto o subir el mismo PDF | P0 |
| RF-33 | Usos por tipo de transformación de Entiendo: Super Podcast → escucha y explica; Debate → fuente de la contraprueba; Examen con retroalimentación → banco de preguntas que se convierten en orales | P1 |

### 5.5 Generación de la misión

| ID | Requisito | Prioridad |
|---|---|---|
| RF-40 | Generar un texto de lectura adaptado al grado: 3.º 40–60 palabras, 4.º 60–90, 5.º–6.º 90–130 | P0 |
| RF-41 | Generar 3 preguntas: Obtiene (literal), Infiere (causa o intención), Reflexiona (opinión) | P0 |
| RF-42 | Generar un dato de contraprueba que rete la respuesta más probable a la pregunta Reflexiona, sin ser falso respecto del texto | P0 |
| RF-43 | Generar una lectura SOLO equivalente para el viernes | P1 |
| RF-44 | En quechua: generar desde glosario y corpus chanka; las preguntas fijas usan audio grabado por un hablante | P0 (demo con textos validados por Omar) |
| RF-45 | Mostrar a la familia el resumen de la misión en el chat, con opción "Ver la lectura y las preguntas" | P0 |
| RF-46 | Validación automática: salida en JSON con esquema; longitud dentro del rango; preguntas etiquetadas | P0 |

### 5.6 Sesión de voz (F3, F4)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-50 | La sesión corre en pantalla completa sin barra lateral, en celular (390 px) y escritorio (1440 px) | P0 |
| RF-51 | Indicador de pasos fijo arriba: Cómo llegas → Lee → Qué dice → Por qué pasó → Qué opinas → Contraprueba → Cierre | P0 |
| RF-52 | Al inicio, el niño elige una carita (5 opciones); al final, otra | P0 |
| RF-53 | Lectura en voz alta de hasta 60 s con palabras resaltadas en vivo (leída, actual, pendiente) | P0 |
| RF-54 | Las palabras leídas de forma distinta **no** se marcan en rojo en la vista del niño; solo en la vista del adulto y el informe | P0 |
| RF-55 | Castellano: conversación voz a voz en tiempo real con interrupción (el niño puede hablar mientras el agente habla) | P0 |
| RF-56 | Quechua: conversación por turnos con detección de fin de turno; el agente habla con audio grabado o síntesis aprobada | P0 |
| RF-57 | Subtítulo en vivo de lo que el sistema escucha | P0 |
| RF-58 | Antes de la contraprueba, el niño indica su seguridad: Poco / Más o menos / Muy seguro | P0 |
| RF-59 | Contraprueba: tarjeta amarilla con el dato, leído en voz alta; botones grandes "Mantengo mi idea" / "Cambio mi idea"; luego "¿Por qué?" por voz | P0 |
| RF-60 | Ayudas permitidas: repetir la pregunta y una versión más simple; máximo 2 por pregunta; quedan registradas como "con ayuda" | P0 |
| RF-61 | El agente nunca da la respuesta; si el niño la pide, repregunta | P0 |
| RF-62 | Botón "Pausar" siempre visible; la sesión puede retomarse en 24 h | P0 |
| RF-63 | Vista del adulto opcional (panel derecho en escritorio, hoja inferior en celular) con señales en vivo | P1 |
| RF-64 | Duración objetivo 8 min; tope 12 min | P0 |
| RF-65 | Si el micrófono falla, mensaje claro y opción de reintentar sin perder el progreso | P0 |

### 5.7 Evaluación

| ID | Requisito | Prioridad |
|---|---|---|
| RF-70 | Calcular PCPM, precisión y errores por palabra con alineación del audio contra el texto esperado | P0 |
| RF-71 | Puntuar Obtiene con reglas (palabra clave o sinónimo) | P0 |
| RF-72 | Puntuar Infiere y Reflexiona con un juez LLM con rúbrica anclada, 2 ejemplos por nivel, 3 corridas y cita textual | P0 |
| RF-73 | Si las 3 corridas no coinciden, marcar "dudoso" y mostrar el nivel como "en revisión" | P0 |
| RF-74 | Si la confianza del reconocimiento es baja, registrar "No observable" (≠ 0) | P0 |
| RF-75 | Registrar estructura del juicio: postura, razón, evidencia, otra opción, revisión (sí/no, con cita) | P0 |
| RF-76 | Calcular calibración (seguridad declarada vs. acierto) | P1 |
| RF-77 | Calcular señales de proceso: latencia de respuesta, pausas > 2 s, autocorrecciones, palabras de duda, ritmo | P1 |
| RF-78 | Ninguna señal de proceso ni de afecto entra en el cálculo de niveles | P0 |

### 5.8 Informe y progreso (F5, F6)

| ID | Requisito | Prioridad |
|---|---|---|
| RF-80 | El informe está listo ≤ 60 s después de terminar la sesión; aviso en el chat | P0 |
| RF-81 | Titular en lenguaje simple que resuma lo más importante de la sesión (generado desde eventos, revisado por plantilla) | P0 |
| RF-82 | 4 tarjetas: Fluidez, Qué dice, Por qué pasó, Qué opina | P0 |
| RF-83 | Cadena del juicio con las frases del niño | P0 |
| RF-84 | Bloques "Cómo lo dijo" y "Cómo se sintió" con su aclaración | P1 |
| RF-85 | Bloque "Para conversar en casa" con 1 pregunta concreta en castellano y, si aplica, en quechua | P0 |
| RF-86 | Bloque "Lo que no medimos" siempre visible | P0 |
| RF-87 | Progreso de 4 semanas: barras de PCPM, cuadrícula de niveles, 4 indicadores y siguiente objetivo | P1 |
| RF-88 | El informe se puede compartir como imagen o enviar por WhatsApp a otro familiar | P2 |

### 5.9 Notificaciones

| ID | Requisito | Prioridad |
|---|---|---|
| RF-90 | Recordatorio de misión programada (navegador o WhatsApp con permiso) | P1 |
| RF-91 | Resumen semanal los viernes 6 p. m. | P2 |

---

## 6. Requisitos no funcionales

| ID | Categoría | Requisito |
|---|---|---|
| RNF-01 | Latencia | Castellano: primera respuesta de voz del agente < 0,8 s p50 y < 1,2 s p95 desde fin de turno |
| RNF-02 | Latencia | Quechua: respuesta < 2,5 s p95 desde fin de turno |
| RNF-03 | Latencia | Resaltado de palabras en lectura con retraso < 300 ms |
| RNF-04 | Latencia | Informe listo < 60 s |
| RNF-05 | Rendimiento | Primera carga < 2,5 s (LCP) en 4G; app instalable (PWA) |
| RNF-06 | Compatibilidad | Chrome Android ≥ 110, Safari iOS ≥ 16, Chrome/Edge escritorio; ancho mínimo 360 px |
| RNF-07 | Conectividad | Si la red cae durante la sesión, guardar audio y eventos localmente y reintentar; no perder respuestas |
| RNF-08 | Accesibilidad | WCAG 2.2 AA: contraste ≥ 4,5:1 en texto, objetivos táctiles ≥ 48 px (≥ 56 px en modo niño), foco visible, navegación por teclado, `prefers-reduced-motion` |
| RNF-09 | Accesibilidad | Ninguna información solo por color: niveles con número y etiqueta |
| RNF-10 | Idioma | Interfaz de familia en castellano; sesión en castellano o quechua chanka; textos en quechua validados por hablante antes de producción |
| RNF-11 | Privacidad | Audio borrado al transcribir (retención 0 días por defecto); datos de menores seudonimizados; cumplimiento de la Ley 29733 |
| RNF-12 | Seguridad | TLS, cifrado en reposo, control de acceso por familia, registros de auditoría de acceso a datos |
| RNF-13 | Ética | Sin reconocimiento automático de emociones; sin comparación entre niños; sin publicidad |
| RNF-14 | Confiabilidad | Disponibilidad 99 % en piloto; reintentos idempotentes por `client_id` |
| RNF-15 | Costos | Costo variable ≤ US$0,50 por sesión de 8 min en castellano (incluye voz en tiempo real) y ≤ US$0,10 en quechua |
| RNF-16 | Observabilidad | Métricas de latencia, errores, CER sobre set de validación y κ juez vs. humano en un panel interno |
| RNF-17 | Seguridad de la IA | Verificador de salida que bloquea respuestas finales; prompts versionados; pruebas automáticas con casos de "dame la respuesta" |

---

## 7. Sistema de diseño

### 7.1 Principios

1. **Escuchar antes que mostrar.** En la sesión, la voz manda y la pantalla acompaña.
2. **Una decisión por pantalla en modo niño.**
3. **Datos con frase.** Toda métrica va con una explicación en lenguaje simple.
4. **Nunca culpar.** Los errores de lectura no se marcan frente al niño.
5. **Transparencia.** Siempre se dice qué no se mide.

### 7.2 Marcos y retícula

| Contexto | Marco | Retícula | Márgenes |
|---|---|---|---|
| Escritorio (familia) | 1440 × 900 (F5: 1440 × 1360 con scroll) | Barra lateral fija 280 px + contenido fluido | Contenido: 40 px laterales, 32 px arriba |
| Escritorio (sesión) | 1440 × 900 | Zona del niño fluida + vista del adulto 340 px | 32 px laterales, gap 24 |
| Tableta | 768 × 1024 | Barra lateral colapsada a 72 px (íconos) | 24 px |
| Celular (familia y sesión) | 390 × 844 | 4 columnas, gutter 16 | 16 px laterales |

Puntos de quiebre: `< 600` celular, `600–1023` tableta, `≥ 1024` escritorio.

### 7.3 Color (tokens)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` | #F3F5F1 | #0F1613 | Fondo de página |
| `surface` | #FFFFFF | #17211C | Tarjetas, burbujas del asistente |
| `ink` | #18221D | #E4EBE6 | Texto principal |
| `muted` | #5B6A62 | #9DB0A6 | Texto secundario, etiquetas |
| `line` | #D6DDD7 | #2B3A33 | Bordes |
| `sidebar` | #18221D | #050807 | Barra lateral |
| `accent` | #0D6B57 | #4FC2A3 | Acción principal, valores, paso hecho |
| `accent-soft` | #DCEFE8 | #163A31 | Fondos positivos, "para conversar en casa" |
| `maize` | #E2A91F | #F0C04D | Paso actual, contraprueba |
| `maize-soft` | #FBEFCF | #3A3016 | Burbuja de la familia, tarjeta de contraprueba |
| `red` | #B4442F | #EF8A73 | Error de lectura (solo adulto), "lo que no medimos" |
| `red-soft` | #F7E0DA | #3D1F19 | Nivel 0 |
| `blue` | #2F5F9E | #8DB4EC | Etiquetas de vista del adulto y Entiendo |
| `blue-soft` | #E0E9F6 | #1B2A40 | Fondos informativos |

Escala de niveles: 0 = `red-soft`, 1 = `maize-soft`, 2 = `accent-soft`, 3 = `accent` con texto blanco.

### 7.4 Tipografía

| Rol | Familia | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|---|
| Display XL | Bricolage Grotesque | 56 / 110 % | ExtraBold | Portadas y tablero |
| Display L | Bricolage Grotesque | 34–36 / 115 % | ExtraBold | Titular de pantalla (F1, F5, F6) |
| Título | Bricolage Grotesque | 30 / 120 % | ExtraBold | Título del chat |
| Subtítulo | Bricolage Grotesque | 20–22 / 125 % | Bold | Bloques |
| Texto de lectura | Atkinson Hyperlegible | 34 / 165 % (celular 24 / 160 %) | Regular | Texto que lee el niño |
| Cuerpo | Atkinson Hyperlegible | 16 / 150 % | Regular | Mensajes, descripciones |
| Cuerpo S | Atkinson Hyperlegible | 14 / 145 % | Regular | Ayudas |
| Etiqueta | Atkinson Hyperlegible | 11–12 / 130 %, +8 % de espaciado, mayúsculas | Bold | Eyebrows y rótulos |
| Dato | IBM Plex Mono | 32 (tarjeta) · 14–15 (fila) | Medium | Números y transcripción |

Atkinson Hyperlegible se elige por legibilidad para lectores en formación.

### 7.5 Espaciado, radios, elevación

- Espaciado base 4: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Radios: 6 (celda de nivel), 10 (fila de señal), 12 (tarjeta pequeña, botón), 14–16 (tarjeta), 18 (texto de lectura), 999 (chip, píldora, orbe).
- Elevación: solo el orbe de voz tiene sombra (resplandor `accent` 35 %, radio 18). El resto usa borde de 1 px `line`.

### 7.6 Movimiento

| Elemento | Animación | Duración |
|---|---|---|
| Orbe escuchando | Pulso de escala 1 → 1,06 | 1,2 s en bucle |
| Orbe hablando | Anillos según amplitud de audio | tiempo real |
| Palabra actual | Contorno `maize` parpadeante | 1,6 s |
| Paso completado | Relleno de píldora | 200 ms ease-out |
| Con `prefers-reduced-motion` | Sin bucles; cambios instantáneos | — |

### 7.7 Voz y tono del texto

- Familia: tuteo, frases cortas, sin jerga técnica ("palabras correctas por minuto", no "PCPM", salvo en tarjeta con explicación).
- Niño: segunda persona, ánimo sin exagerar ("Sigue no más"), nunca "incorrecto".
- Quechua: solo textos validados por hablante; variedad chanka.

---

## 8. Componentes

Cada componente existe en Figma en la sección "Componentes". Medidas en px.

| Componente | Variantes | Medidas | Estados | Contenido |
|---|---|---|---|---|
| **Button** | Primary, Ghost | alto 44 (familia), 64 (niño); padding 20 × 12; radio 12 | default, hover (−8 % luminosidad), pressed, disabled (40 % opacidad), loading (spinner) | Label |
| **Chip** | default, selected | alto 32; padding 12 × 6; radio 999 | default, hover, selected (`accent` + texto blanco) | Label |
| **Bubble/Asistente** | — | ancho máx. 560 (celular 85 %); padding 16 × 14; radio 16 | normal, escribiendo (3 puntos), error | Who (11 px bold `accent`), Text |
| **Bubble/Familia** | — | igual; alineada a la derecha | normal, enviando, error con reintento | Who, Text, adjunto opcional |
| **Composer** | — | alto 56; radio 14 | vacío, escribiendo, grabando voz, subiendo adjunto | Campo, Foto, PDF, Entiendo, Micrófono |
| **MetricCard** | — | ancho flexible ≥ 200; padding 18 × 16; radio 12 | normal, en revisión, no observable | Title, Value (mono 32), Caption |
| **StepPill** | Hecho, Ahora, Siguiente | alto 28; padding 12 × 6 | — | Label (con ✓ si hecho) |
| **Toggle** | on, off, bloqueado | 48 × 28; perilla 22 | — | — |
| **PermissionRow** | activo, no disponible | padding 16 × 14; radio 12 | — | Título, descripción, Toggle |
| **VoiceOrb** | escuchando, pensando, hablando, pausado, error | círculo 56 (escritorio) / 72 (celular) dentro de píldora | — | Título y subtítulo |
| **ReadingText** | — | tamaño 34/24 | palabra leída (`ink`), actual (negrita `accent` + contorno), pendiente (`#9AA59F`), distinta (rojo subrayado, **solo vista adulto**) | Texto |
| **LiveCaption** | — | padding 18 × 12; mono 18 | — | Transcripción |
| **ConfidencePicker** | Poco, Más o menos, Muy seguro | 3 chips | uno seleccionado | — |
| **CounterCard** | — | fondo `maize-soft`; padding 22 × 18 | — | Etiqueta, dato (22–24 Bold) |
| **DecisionButtons** | Mantengo, Cambio | 2 botones de alto 64, mitad de ancho cada uno | default, seleccionado | — |
| **SignalRow** | — | padding 12 × 10; radio 10 | — | Nombre, valor (mono) |
| **LevelCell** | 0, 1, 2, 3, NO | 44 × 32; radio 6 | — | Número |
| **JudgmentChain** | — | 5 celdas en fila (celular: columna) | elemento ausente en gris punteado | Postura, Razón, Dato nuevo, Revisión, Otra opción |
| **BarChart** | — | barras de 56 de ancho, altura proporcional | semana actual en `accent` | Valores y etiquetas |
| **MoodPicker** | 5 caritas | 64 × 64 cada una | seleccionada con anillo `accent` | Etiqueta debajo |
| **Sidebar** | expandida 280, colapsada 72 | — | ítem activo `accent` | Marca, niño activo, navegación, estado de Entiendo |

---

## 9. Pantallas

Para cada pantalla: objetivo, regiones con medidas, contenido, interacciones, estados y criterios de aceptación (CA).

### F0 · Registro y perfil (P0, por diseñar)

- **Objetivo:** cuenta y perfil del niño en < 3 min.
- **Regiones:** tarjeta centrada de 520 px.
- **Pasos:** 1) celular o correo; 2) código; 3) perfil del niño: alias, grado (chips 3.º–6.º), lengua de casa, lengua de lectura.
- **CA:** no pide apellidos, foto ni DNI; botón "Continuar" deshabilitado hasta completar los campos obligatorios.

### F1 · Antes de empezar (consentimiento)

- **Objetivo:** que la familia decida qué se graba, entendiendo cada permiso.
- **Regiones (escritorio):** barra lateral 280 (ítem activo "Privacidad") + contenido con tarjeta centrada de **760 px**, padding 36 × 32, radio 16.
- **Contenido en orden:**
  1. Etiqueta "PASO 1 DE 2 · FAMILIA".
  2. Título "Antes de empezar con Yeni" (Display L).
  3. Explicación en 2 líneas.
  4. Chips del perfil: alias, grado, lengua de casa, segunda lengua.
  5. 4 PermissionRow: voz durante la sesión (on), cómo lo dice (on), cómo se siente (on), reconocimiento automático de emociones (no disponible, fondo `bg`, texto `muted`).
  6. Acciones: "Aceptar y continuar" (Primary) y "Leer cómo cuidamos los datos" (Ghost).
- **Interacciones:** tocar la fila cambia el toggle; la fila de emociones no responde y muestra un tooltip con la explicación.
- **Estados:** si se desactiva "voz durante la sesión", aparece aviso "Sin este permiso no se puede hacer la sesión de voz" y el botón principal cambia a "Guardar sin sesiones de voz".
- **Celular:** tarjeta a ancho completo; filas apiladas; botones a ancho completo.
- **CA:** se guarda fecha, versión del texto y permisos elegidos; nada se graba antes de aceptar.

### F2 · Chat familiar

- **Objetivo:** convertir la tarea o un material de Entiendo en una misión.
- **Regiones (escritorio):** barra lateral 280 · columna de conversación fluida (mín. 560) · panel "Traer de Entiendo" **360 px** · composer fijo abajo dentro de la columna.
- **Contenido:**
  - Título "Chat con Ñawinchay".
  - Hilo: saludo del asistente → mensaje de la familia con adjunto → resumen de la misión en 4 pasos → chips "Ahora, con mi celular", "Hoy a las 7 p. m.", "Ver la lectura y las preguntas".
  - Composer: campo "Escribe o mantén el micrófono para hablar…", chips Foto / PDF / Entiendo, botón micrófono.
  - Panel Entiendo: título, explicación de 2 líneas, 3 tarjetas de material (tipo en `blue`, título, uso sugerido), nota de integración pendiente.
- **Interacciones:** "Ahora" abre F3 en pantalla completa; "Hoy a las 7 p. m." programa recordatorio; "Ver la lectura" abre una hoja con texto y preguntas (las respuestas no se muestran).
- **Estados:** procesando foto ("Leyendo tu foto…" con 3 puntos); foto ilegible; sin conexión ("Te avisaremos cuando vuelva la señal"); Entiendo desconectado (panel con botón "Conectar Entiendo").
- **Celular:** sin barra lateral (menú arriba); panel Entiendo como hoja inferior desde el chip "Entiendo".
- **CA:** de foto a misión en < 30 s; la misión siempre incluye las 3 preguntas y la contraprueba.

### F3 · Sesión en vivo · Lee

- **Objetivo:** medir fluidez mientras el niño lee sin presión.
- **Regiones (escritorio):** barra superior (alto 64: marca, indicador de pasos centrado, "Pausar") · zona del niño fluida · vista del adulto **340 px**.
- **Contenido de la zona del niño:**
  - VoiceOrb "Te escucho, Yeni" + "Lee en voz alta. Si te equivocas, sigue no más."
  - Tarjeta de lectura (padding 36 × 30, radio 18): título del texto, ReadingText 34 px, contador "Leyendo · 0:41 de 1:00".
  - LiveCaption.
- **Vista del adulto:** "Lectura en curso"; filas PCPM, precisión, autocorrecciones, pausas largas, lee en frases (x de 4); nota "La palabra roja… solo tú"; caja "Cómo llegó (lo eligió Yeni)".
- **Interacciones:** el niño solo habla; a los 60 s o al terminar el texto pasa a "Qué dice". "Pausar" detiene y muestra "Seguir" y "Terminar después".
- **Estados:** esperando voz (orbe pulsa), ruido alto ("Hay mucho ruido, ¿nos movemos a un lugar más tranquilo?"), sin micrófono, red perdida (sigue grabando local).
- **Celular (390):** barra superior con pasos como puntos + paso actual en texto; texto de lectura 24 px; vista del adulto oculta tras botón "Ver como adulto".
- **CA:** resaltado < 300 ms; errores no visibles para el niño; PCPM disponible al terminar.

### F4 · Sesión en vivo · Contraprueba

- **Objetivo:** que el niño tome postura, enfrente un dato y justifique.
- **Regiones:** iguales a F3.
- **Contenido de la zona del niño en orden:**
  1. VoiceOrb "Ñawinchay está hablando… Puedes interrumpir cuando quieras".
  2. Burbuja del agente con la pregunta (quechua + castellano).
  3. Burbuja del niño con su respuesta transcrita (alineada a la derecha).
  4. ConfidencePicker "¿Qué tan segura estás?".
  5. CounterCard "CONTRAPRUEBA" con el dato.
  6. DecisionButtons.
  7. Burbuja con la razón del niño.
- **Vista del adulto:** "Juicio en construcción" con filas Postura, Seguridad, Ante el dato nuevo, Razón usa el dato, Otra opción; caja "Nivel propuesto" con cita; nota de proceso.
- **Interacciones:** la seguridad se pide **antes** de mostrar la contraprueba; tras elegir Mantengo/Cambio el agente pregunta "¿Por qué?".
- **Estados:** sin respuesta 8 s (repite pregunta, marca "con ayuda"); pide la respuesta (el agente repregunta); respuesta muy corta (el agente pide "cuéntame un poquito más").
- **CA:** mantener con buena razón se valora igual que cambiar con buena razón; el nivel se muestra con cita.

### F4b · Cierre (P0, por diseñar)

- MoodPicker "¿Cómo te fuiste?", mensaje de logro sin nota ("Hoy explicaste por qué cambiaste de idea"), botón "Listo" que devuelve al adulto.

### F5 · Informe de la sesión

- **Objetivo:** que la familia entienda en 1 minuto y sepa qué hacer.
- **Regiones:** barra lateral (ítem "Sesiones") + contenido de una columna, ancho máximo 1080; marco 1440 × 1360.
- **Contenido en orden:**
  1. Etiqueta con día, duración, título y lengua.
  2. Titular (Display L), por ejemplo "Yeni cambió de opinión con una buena razón".
  3. Fila de 4 MetricCard.
  4. JudgmentChain con frases.
  5. Dos columnas: "Cómo lo dijo" (5 SignalRow + aclaración) y "Cómo se sintió" (inicio y fin + aclaración).
  6. "Para conversar en casa" (fondo `accent-soft`) con pregunta y botones "Programar la próxima misión" / "Ver la transcripción".
  7. "Lo que no medimos".
- **Estados:** procesando (esqueleto con "Preparando el informe…"); nivel en revisión (tarjeta con etiqueta "en revisión"); no observable (valor "—" con explicación).
- **Celular:** tarjetas 2 × 2; cadena del juicio vertical; columnas apiladas.
- **CA:** titular ≤ 10 palabras; ninguna cifra sin frase; siempre aparece "Lo que no medimos".

### F6 · Progreso

- **Objetivo:** mostrar la tendencia y el siguiente objetivo.
- **Regiones:** barra lateral (ítem "Progreso") + contenido.
- **Contenido:** etiqueta "Últimas 4 semanas"; titular; BarChart de PCPM; cuadrícula de niveles (3 filas × 4 semanas); 4 MetricCard (Lecturas SOLO, Cambios con razón, Seguridad ajustada, Misiones hechas); tarjeta "Esta semana trabajamos…".
- **Estados:** menos de 2 semanas de datos ("Necesitamos 2 semanas para mostrar una tendencia").
- **CA:** las metas de PCPM en quechua se muestran como "por definir" hasta tener datos del piloto.

### F7 · Privacidad (P0, por diseñar)

- Lista de permisos con toggles (como F1), botón "Descargar datos", botón "Borrar todos los datos de Yeni" con confirmación en la propia pantalla.

---

## 10. Sesión de voz: máquina de estados

El orquestador decide el orden; el modelo de lenguaje solo redacta dentro de cada estado.

| Estado | Entrada | El agente dice / hace | Sale cuando | Si falla |
|---|---|---|---|---|
| CHECK_IN | inicio | "¿Cómo llegas hoy?" + MoodPicker | elige carita | 15 s → sigue sin dato |
| READ | CHECK_IN | presenta el texto; escucha 60 s | 60 s o fin del texto | ruido alto → pide lugar tranquilo; 3 intentos → No observable |
| Q_OBTIENE | READ | pregunta literal | respuesta | silencio 8 s → repite (con ayuda) |
| Q_INFIERE | Q_OBTIENE | pregunta de causa | respuesta | 2 ayudas máximo |
| STANCE | Q_INFIERE | pregunta de opinión + seguridad 1–3 | postura + seguridad | — |
| COUNTER | STANCE | presenta el dato que reta la postura | decisión Mantengo/Cambio | — |
| REVISE | COUNTER | "¿Por qué?" | razón | muy corta → "cuéntame un poquito más" (1 vez) |
| CHECK_OUT | REVISE | "¿Cómo te fuiste?" + mensaje de logro | elige carita | 15 s → cierra |
| REPORT | CHECK_OUT | genera informe desde eventos | informe guardado | reintento; aviso a la familia |

Reglas globales: el verificador de salida bloquea cualquier respuesta final; "Pausar" lleva a PAUSED desde cualquier estado; reconexión retoma en el último estado completado.

---

## 11. Métricas y rúbricas

### 11.1 Definiciones

| Métrica | Fórmula / método | Escala | Visible para | Regla de visualización |
|---|---|---|---|---|
| PCPM | palabras correctas ÷ minutos leídos (alineación forzada) | número | familia, adulto | con "palabras correctas por minuto" en texto |
| Precisión | correctas ÷ intentadas | % | familia | junto a PCPM |
| Prosodia | pausas en puntuación vs. dentro de frase; escala NAEP 1–4 | 1–4 | adulto | "lee en frases: x de 4" |
| Obtiene / Infiere / Reflexiona | reglas (O), juez con rúbrica (I, R) | 0–3 + NO | familia | x/3 con frase |
| Estructura del juicio | presencia de cada elemento de Toulmin | sí/no | familia | cadena con citas |
| Revisión justificada | contrapruebas con razón ÷ contrapruebas | % | familia (progreso) | — |
| Calibración | seguridad declarada vs. acierto | % ajustado | familia | "cuando dice estar segura, acierta" |
| Transferencia | SOLO logradas ÷ intentadas | % | familia | métrica norte |
| Proceso de voz | latencia, pausas > 2 s, autocorrecciones, palabras de duda, ritmo | descriptivo | familia, adulto | siempre con "no es una nota" |
| Afecto | autorreporte inicio/fin | 5 caritas | familia | "lo eligió el niño" |
| CER/WER | sobre set de validación | % | interno | panel técnico |
| κ juez vs. humano | sobre respuestas revisadas | 0–1 | interno | panel técnico |

### 11.2 Rúbrica Reflexiona (contraprueba)

| Nivel | Descripción | Ejemplo |
|---|---|---|
| 0 | Responde sin razón o sin relación | "No sé" / "Porque sí" |
| 1 | Da una razón que no viene del texto ni del dato | "Porque Rosa es buena" |
| 2 | Razón apoyada en el texto o en el dato nuevo | "Porque llueve y es lejos" |
| 3 | Además considera otra opción o un límite | "Debió ir con su mamá, porque llueve y es lejos" |
| NO | No hay evidencia suficiente (audio, ruido, no entendió) | — |

Rúbricas análogas para Infiere (0 sin relación, 1 repite el texto, 2 inferencia válida, 3 inferencia con dato del texto) y Obtiene (0, 2, 3 por reglas).

---

## 12. Datos y eventos

### 12.1 Entidades

`family` · `child_profile` (alias, grado, lengua_casa, lengua_lectura) · `consent` (permisos, versión, fecha) · `material` (origen: foto, pdf, entiendo; texto extraído) · `mission` (texto, nivel, lengua, preguntas, contraprueba, solo) · `session` (estado, inicio, fin, client_id) · `event` (tipo, estado, payload, timestamp) · `reading_attempt` · `answer` (transcripción, nivel propuesto, cita, corridas, estado) · `report` · `weekly_progress`.

### 12.2 Eventos de producto

`signup_completed`, `consent_saved`, `material_uploaded`, `mission_generated`, `session_started`, `state_entered`, `help_given`, `answer_requested_blocked`, `session_paused`, `session_completed`, `report_viewed`, `home_question_marked_done`, `solo_completed`, `permission_revoked`.

---

## 13. Arquitectura e integraciones

| Capa | Tecnología | Nota |
|---|---|---|
| Cliente | Next.js + React, PWA, WebRTC, Silero VAD en el navegador | Celular y escritorio |
| Orquestador | TypeScript, máquina de estados explícita, WebSocket/WebRTC | Registra eventos (event sourcing) |
| Voz castellano | Modelo realtime voz a voz (gpt-realtime o Gemini Live) | Interrupción; costo por minuto a confirmar |
| Voz quechua | Omnilingual ASR `quy_Latn` (Apache 2.0) en GPU + audio grabado o TTS | MMS y NLLB son CC-BY-NC: solo no comercial |
| Analizadores | Alineación forzada (torchaudio), prosodia y pausas, detección de palabras de duda | En paralelo sobre el mismo audio |
| Juez | LLM con rúbrica y salida estructurada | 3 corridas |
| Datos | Postgres + almacenamiento con borrado automático de audio | — |
| Entiendo | API o exportación del workspace **por confirmar** | Alternativa: subir el mismo PDF |
| WhatsApp | Cloud API (fase 2) | Recordatorios y resumen |

---

## 14. Riesgos, supuestos y preguntas abiertas

| Tipo | Descripción | Mitigación / siguiente paso |
|---|---|---|
| Riesgo | Reconocimiento de voz infantil en quechua sin medir | Medir CER con voces reales; mostrar No observable |
| Riesgo | Costo de la voz en tiempo real en castellano | Medir costo por sesión; usar turnos si excede RNF-15 |
| Riesgo | Calidad del quechua generado | Glosario, corpus y validación por hablante |
| Riesgo | Dependencia o uso excesivo | Límite de 2 misiones por día |
| Supuesto | Las familias pagarán por el informe (castellano urbano) | Validar con 10 familias y una oferta concreta |
| Supuesto | La contraprueba mejora la revisión justificada | Medir en el piloto frente a la semana 1 |
| Pregunta | ¿Entiendo tiene API o acuerdo de integración? | Consultar con el equipo de Entiendo |
| Pregunta | ¿Quién paga en zonas EIB rurales? | UGEL, ONG o ProInnóvate |
| Pregunta | ¿La sesión se hace en el celular de la familia o en la escuela? | Diseñar ambos; MVP en celular |

---

## 15. Alcance por fase y criterios de la demo

| Fase | Incluye |
|---|---|
| **P0 · Hackathon** | F1, F2 (sin integración real con Entiendo), F3, F4, F4b, F5; castellano en tiempo real; quechua con 3 textos validados por Omar; juez con rúbrica; métricas de fluidez y comprensión |
| **P1 · Piloto** | F0 completo, F6, F7, vista del adulto en celular, integración Entiendo, calibración y señales de proceso, recordatorios |
| **P2** | Vista docente, WhatsApp, varios niños por familia, más variedades de quechua |

**Criterios de aceptación de la demo (90 s):**
1. Una foto de tarea se convierte en misión en < 30 s.
2. Omar lee en quechua y se ven palabras resaltadas y PCPM.
3. Un compañero hace la contraprueba en castellano en tiempo real, con interrupción.
4. El agente se niega a dar la respuesta cuando se le pide.
5. El informe aparece en < 60 s con cita textual y pregunta para la casa.
6. Se muestran CER y κ medidos el mismo día.
