# Track 03 · Educación Escolar — Análisis del problema (Perú)

> Hack the Andes · Lima, 17–18 de octubre de 2026
> Pipeline aplicado: `problem-root-cause` → `market-validation-research` → `solution-market-fit`
> Estado: **hipótesis**. Nada de esto es demanda validada hasta correr el experimento de la sección 5.

---

## 0. Lo que el jurado realmente premia

| Criterio | Peso | Implicancia para elegir problema |
|---|---|---|
| Tracción | 30 % | Evidencia **externa**: entrevistas, pruebas con usuarios, uso real. Hay que poder hablar con docentes/directores **este fin de semana**. |
| Esfuerzo técnico | 40 % | Producto funcional, decisiones justificadas, flujo principal demostrable. |
| Pitch | 30 % | Problema, solución y demo claros en 3 min. |

Puntaje por juez = tracción×6 + técnico×8 + pitch×6 (escala 1–5). No hay criterios específicos del track.

**Consecuencia:** elegí el sub-problema donde (a) el usuario es alcanzable en 24 h por WhatsApp y (b) el flujo principal cabe en una demo de 60 s. Eso favorece a **docentes y directores**, no a ministerios ni UGEL.

---

## 1. Datos duros (Perú)

| Dato | Valor | Fuente / fecha | Ojo |
|---|---|---|---|
| Deserción interanual primaria | 1,2 % | ESCALE-Minedu, 2024 (vía El Búho) | Mide matrícula año a año, no abandono permanente |
| Deserción interanual secundaria | 0,8 % | ESCALE-Minedu, 2024 | Ídem |
| Mayores de 15 sin secundaria completa | > 30 % | ENAHO-INEI, 2024 | Indicador acumulado, distinto al anterior |
| Abandonos 2022→2023 | ~46 000 estudiantes | Defensoría del Pueblo | Muchos vinculados a embarazo adolescente |
| Conclusión oportuna de secundaria | 43,2 % (2001) → 81,3 % (2023) | GRADE, dic. 2024 | Mejora fuerte, pero 1 de cada 5 no termina a tiempo |
| Matrícula rural vs urbana | 89,1 % vs 91,5 % | GRADE, 2023 | |
| Causa principal de abandono | Económica / necesidad de trabajar (más en rural) | Edudatos-Minedu | Siguen: matrícula, embarazo, vida en pareja, distancia |
| Más afectados | Rural, lengua originaria, niñas y adolescentes mujeres | RPP / Minedu | |
| 4.º primaria, lectura satisfactoria | 32,8 % | ENLA 2024 | Loreto: 12,8 % |
| 4.º primaria, matemática satisfactoria | 29,5 % | ENLA 2024 (columna de opinión) | Loreto: 6,3 % |
| 2.º secundaria (EM 2022) | Mat. 12,75 % · Lect. 19,1 % | Evaluación Muestral 2022 | Dato viejo; ENLA 2024 de secundaria no encontrado |
| Factor asociado a mejor rendimiento | Acompañamiento de UGEL + retroalimentación docente clara | Resumen ejecutivo ENLA 2025 | Clave para "herramientas docentes" |
| Brecha de infraestructura | S/ 158 832 millones | Comisión de Educación del Congreso, mar. 2025 | |
| Locales en riesgo de colapso | 55,9 % | Misma audiencia, 2025 | Gestión (2024) reporta ~54,6 % para demoler |
| Colegios con internet | 50,6 % (promedio nacional) | Misma audiencia, 2025 | Cambia si se mide por alumnos (54,1 %) |
| Puno | 205 de ~4 000 locales en condición adecuada | Reporte regional, feb. 2025 | |

**Herramienta existente que NO podés ignorar:** **Alerta Escuela** (Minedu, desde oct. 2020). Corre sobre **SIAGIE**, usa *machine learning* con rendimiento académico, educación de los padres y nivel socioeconómico, y le da al director un semáforo (naranja/amarillo/verde) por estudiante. Hay guías pedagógicas para primaria y secundaria. No encontré datos de uso ni evaluación 2025–2026.

> **Implicancia:** construir "otro predictor de deserción con IA" es reinventar Alerta Escuela. El jurado lo va a preguntar.

---

## 2. Root-cause por sub-tema

### 2.1 Prevención de la deserción escolar

| Campo | Hipótesis |
|---|---|
| **Quién** | Tutor/a de aula y director/a de secundaria pública, prioritariamente rural o periurbana |
| **Dolor** | Ven a un estudiante faltar repetidamente y no hacen un seguimiento estructurado a tiempo; cuando actúan, ya trabaja o dejó el colegio |
| **Workaround actual** | Cuaderno de asistencia en papel, llamada o WhatsApp informal al apoderado, visita domiciliaria ocasional, semáforo anual de Alerta Escuela |
| **Root cause** | El sistema detecta el riesgo (Alerta Escuela) pero **no cierra el ciclo detección → acción → registro**. La señal temprana real (inasistencias de esta semana) no está en el semáforo, y el tutor no tiene tiempo, protocolo ni canal para actuar sobre ella |

**Framework trace**
- **JTBD:** el tutor no "contrata" un predictor; contrata algo para *"saber a quién llamar hoy y qué decirle, sin sumarme trabajo"*. El trabajo es la intervención, no el diagnóstico.
- **First Principles:** la causa dominante es económica (necesidad de trabajar). Ninguna app paga ese costo de oportunidad. Lo que sí es controlable desde la escuela es el **tiempo de reacción**: actuar en la semana 2 de ausencias, no al cierre del año.
- **TRIZ (contradicción):** el docente necesita *más* información por estudiante para intervenir, pero *menos* carga administrativa para tener tiempo. → La herramienta tiene que salir de la asistencia que ya toma, no pedir datos nuevos.
- **Progress-Making Forces:** *Push* alto (ver al alumno irse es frustrante). *Anxiety* alta (otra plataforma más, miedo a exponer datos de menores). *Habit* fuerte (papel + WhatsApp). → Solo gana una solución que viva en WhatsApp o en la foto del cuaderno.

**Predicción falsable:** si es cierto, al entrevistar tutores **≥ 3 de 5** recordarán un caso concreto *del último mes* de un estudiante con ausencias repetidas al que no le hicieron seguimiento estructurado por falta de tiempo/canal, y **no** consultan Alerta Escuela semanalmente.

**Supuestos sin verificar**
- Que Alerta Escuela no usa asistencia semanal (inferencia a partir de las variables reportadas; verificar).
- Que los tutores tienen horas de tutoría pero no protocolo operativo.
- Frecuencia real de uso de SIAGIE por tutores vs. solo directores.

**Stop condition:** es falsable con 5 entrevistas y está atada a un comportamiento observable (el cuaderno de asistencia, el WhatsApp al apoderado). Ir más profundo ("pobreza estructural") sale del alcance de una escuela y de un hackathon → **zona Segway**.

---

### 2.2 Herramientas docentes y aprendizaje

| Campo | Hipótesis |
|---|---|
| **Quién** | Docente de primaria pública, especialmente multigrado rural |
| **Dolor** | 2 de cada 3 estudiantes de 4.º no lee ni resuelve problemas a nivel satisfactorio; el docente no sabe *qué* niño está atrás *en qué* competencia hasta la evaluación externa |
| **Workaround** | Fichas impresas, YouTube, grupos de WhatsApp de docentes, ChatGPT, materiales del Minedu |
| **Root cause** | La retroalimentación clara al estudiante (factor asociado en ENLA 2025) exige un diagnóstico por alumno que el docente no puede producir manualmente para 30+ estudiantes, ni en multigrado |

- **JTBD:** "quiero saber en 5 minutos quién no entendió hoy y qué le doy mañana".
- **Marketing Myopia:** no es el negocio de "contenido educativo" (sobrado); es el de **diagnóstico formativo rápido**.
- **Riesgo:** mercado lleno de generadores de material con IA. Si el pitch suena a "ChatGPT para profes", pierde.

**Predicción falsable:** ≥ 3 de 5 docentes describen haber corregido manualmente una evaluación diagnóstica en la última quincena dedicando > 2 h, sin tabla por competencia.

---

### 2.3 Infraestructura y servicios escolares

| Campo | Hipótesis |
|---|---|
| **Quién** | Director/a de institución pública; APAFA; UGEL (área de infraestructura) |
| **Dolor** | Baños sin agua, techos dañados, sin luz o internet; el reporte se pierde y nadie sabe qué se priorizó |
| **Workaround** | Oficios en papel, fotos por WhatsApp a la UGEL, colectas de APAFA, Censo Educativo anual, fondos del programa de mantenimiento |
| **Root cause** | Asimetría de información: la brecha se mide una vez al año y en agregado (S/ 158 832 M), pero no existe un **registro vivo, verificable y público** del estado de *este* baño en *este* colegio que conecte el reporte con la respuesta |

- **First Principles:** el cuello de botella dominante es presupuesto y ejecución pública, no software. Una app no construye techos.
- **TRIZ:** el director quiere visibilidad para conseguir fondos, pero exponer fallas puede jugarle en contra frente a la UGEL.
- **Progress Forces:** *Push* alto, pero el *Pull* depende de que alguien del otro lado responda. Sin la UGEL a bordo, el producto es un buzón.

**Predicción falsable:** ≥ 3 de 5 directores tienen un reporte de mantenimiento enviado hace > 60 días sin respuesta trazable.

**Advertencia:** este sub-tema tiene el problema más grande y la palanca más débil desde un hackathon. Tracción difícil de demostrar en 24 h.

---

## 3. Evidence Dossier

| Sub-tema | Claim falsable | Evidencia publicada | Evidencia proxy | Veredicto |
|---|---|---|---|---|
| Deserción | El cuello de botella es el ciclo detección→acción, no la detección | Alerta Escuela existe desde 2020 con semáforo y guías; causa dominante económica; > 30 % sin secundaria | Ausencia de datos públicos de uso/evaluación de Alerta Escuela | **pending** |
| Docentes | Falta diagnóstico formativo por alumno | ENLA 2024: 32,8 % lectura / 29,5 % mat.; ENLA 2025 asocia retroalimentación a rendimiento | Ninguna sobre tiempo de corrección | **pending** |
| Infraestructura | Falta registro vivo reporte→respuesta | 55,9 % en riesgo; brecha S/ 158 832 M; 50,6 % con internet | Puno 205/4 000 | **pending** |

Las cifras vienen de fuentes de 2022–2025, algunas periodísticas. Verificar en ESCALE / UMC / PRONIED antes de ponerlas en un slide.

---

## 4. Conceptos de solución (puntuados)

### A. "Del cuaderno a la acción" — seguimiento de inasistencias para tutores ⭐

- **Propuesta de valor:** el tutor saca foto al registro de asistencia (o lo dicta por WhatsApp). La herramienta detecta patrones (p. ej. 3 faltas en 2 semanas, lunes repetidos), arma la **lista de "a quién llamar hoy"**, sugiere un mensaje al apoderado (castellano / quechua) y registra la intervención en 1 toque.
- **Segmento:** tutores y directores de secundaria pública.
- **Canal:** WhatsApp (habit) + panel web simple para el director.
- **Modelo:** gratuito para el docente; financiado por UGEL/DRE, gobierno regional, ONG o fundación corporativa (no por el docente).
- **Costos:** OCR/LLM por foto, WhatsApp Business API, hosting.
- **Ventaja injusta:** complementa a Alerta Escuela (anual, estructural) con la señal semanal y el registro de la acción. No compite, cierra su ciclo.
- **Encaje con evidencia:** **parcialmente soportado** — el problema general (abandono, perfil de riesgo) está bien documentado; la forma (tutor sin canal de acción) depende de las entrevistas.
- **Riesgo:** ataca el root cause directo, **no** inventa una necesidad latente. Riesgo real: datos de menores (Ley 29733) → demo con datos sintéticos / anonimizados.
- **Demo de 60 s:** foto de cuaderno → lista priorizada → mensaje enviado → registro en el panel. Técnicamente rico (visión + reglas + mensajería + panel) → puntúa en el 40 %.

### B. Diagnóstico formativo express para docentes

- **Propuesta:** el docente fotografía 30 hojas de una evaluación corta; obtiene una tabla por estudiante × competencia del Currículo Nacional y agrupaciones para reforzar mañana.
- **Encaje:** **parcialmente soportado** (ENLA respalda el problema; no hay dato del tiempo de corrección).
- **Riesgo:** competencia alta con herramientas de IA genéricas; precisión de OCR de letra manuscrita infantil es un riesgo técnico serio para una demo.

### C. Mapa vivo de servicios escolares

- **Propuesta:** el director reporta por WhatsApp (foto + categoría: agua, luz, baños, techo, internet); mapa público con antigüedad del reporte y estado; reporte consolidado para la UGEL.
- **Encaje:** **parcialmente soportado** en el problema, **no soportado** en que alguien del lado público vaya a responder.
- **Riesgo:** sin la UGEL, crea una necesidad latente ("transparencia ciudadana") que nadie está jalando → alto riesgo, payoff alto solo a largo plazo.

### Filtro "solución buscando problema" — qué NO construir

- Otro predictor de deserción con ML (ya existe Alerta Escuela).
- Una plataforma LMS / "Moodle peruano".
- Un chatbot para estudiantes que "los motive a no dejar el colegio" (no ataca la causa económica).
- Un generador de sesiones de aprendizaje con IA sin diagnóstico detrás.

### Recomendación: **Concepto A**

Gana porque ataca la única palanca que la escuela controla frente a una causa mayormente económica: **el tiempo de reacción**. Se apoya en un hábito existente (cuaderno + WhatsApp) en vez de pedir uno nuevo, se diferencia limpiamente de Alerta Escuela (la complementa en lugar de duplicarla), su usuario es alcanzable este fin de semana para sumar el 30 % de tracción, y su flujo principal tiene suficiente profundidad técnica para el 40 % sin depender de un OCR imposible. B es un buen plan alternativo si las entrevistas muestran que el dolor docente está en evaluar, no en dar seguimiento.

---

## 5. Experimento de validación (hacer HOY)

**Método:** concierge / Wizard-of-Oz, costo ~S/ 0, 4–6 h.

1. Contactar **5+ tutores o directores de colegios públicos que NO sean amigos ni familia** (grupos de docentes, DRE/UGEL, contactos de mentores del evento).
2. Preguntar solo por **comportamiento pasado**, nunca intención futura:
   - "¿Cuándo fue la última vez que un estudiante tuyo faltó varias veces seguidas?"
   - "¿Qué hiciste? ¿Cuántos días después?"
   - "¿Dónde quedó registrado?"
   - "¿Cuándo abriste Alerta Escuela / SIAGIE por última vez y para qué?"
3. Pedirles una foto de un registro de asistencia **anonimizado** (o con nombres tapados) y devolverles, a mano, la lista de "a quién llamar" + borrador de mensaje.

**Umbral pre-comprometido (no se mueve después):**

| Resultado | Veredicto |
|---|---|
| ≥ 3 de 5 cuentan un caso del último mes sin seguimiento estructurado **y** ≥ 2 envían una foto real anonimizada | **validated** → construir A |
| 1–2 de 5 cumplen | **weak signal** → evaluar pivote a B |
| 0 de 5, o todos ya usan un protocolo que funciona | **falsified** → descartar A |

Las respuestas literales (anonimizadas) son tu slide de **tracción**. Publicalas como update del proyecto con `andes project update`.

---

## 6. Fuentes

- [Hack the Andes — guía del participante](https://hacktheandes.com/guide)
- [El Búho — deserción interanual 2024 y ENAHO](https://elbuho.pe/?p=411682)
- [GRADE — matrícula rural y conclusión oportuna (dic. 2024)](https://grade.org.pe/wp-content/uploads/GRADEAP73.pdf)
- [Diario Correo — reincorporación escolar](https://diariocorreo.pe/peru/reincorporacion-escolar-claves-para-acompanar-a-quienes-retoman-sus-estudios-en-el-peru-noticia/)
- [Andina — Minedu implementa Alerta Escuela](https://andina.pe/agencia/noticia-minedu-implementa-sistema-identifica-a-estudiantes-riesgo-abandonar-escuela-817316.aspx)
- [Minedu — Alerta Escuela y sistemas de alerta temprana](https://repositorio.minedu.gob.pe/handle/20.500.12799/9574)
- [ESCALE — Edudatos 48, policy brief alerta temprana](https://escale.minedu.gob.pe/documents/inicio/Analisis/Edudatos/Edudatos%2048%20-%20Policy%20brief%20Alerta%20temprana%20interrupcion%20de%20estudios.pdf)
- [Minedu — Estrategia Nacional para la Reinserción y la Continuidad Educativa](https://formacionenservicio.minedu.gob.pe/sifods/orientaciones/2022/2.Estrategia_Nacional_para_la_Reinsercion_y_la_Continuidad_Educativa.pdf)
- [ESCALE — Edudatos 24 (causas de abandono)](https://escale.minedu.gob.pe/documents/inicio/Analisis/Edudatos/Edudatos%2024%20agosto%202016.pdf)
- [RPP — causas de la interrupción escolar](https://rpp.pe/campanas/valor-compartido/interrupcion-del-ano-escolar-cuales-son-sus-causas-y-como-afecta-a-los-estudiantes-desercion-escolar-brecha-educativa-noticia-1338709)
- [La República — ENLA 2024: 3 de cada 10 entienden lo que leen](https://larepublica.pe/sociedad/2025/04/14/minedu-revela-que-solo-3-de-cada-10-escolares-de-cuarto-de-primaria-entiende-lo-que-lee-brecha-se-intensifica-en-regiones-amazonicas-746998)
- [La República — UNICEF, déficit lectura y matemática (EM 2022)](https://larepublica.pe/sociedad/2024/02/21/unicef-hay-deficit-en-comprension-lectora-y-razonamiento-matematico-en-escolares-1822968)
- [El Comercio — Loreto, niveles más bajos](https://elcomercio.pe/peru/por-que-loreto-tiene-los-niveles-educativos-mas-bajos-del-pais-noticia/)
- [Minedu — ENLA 2025 resumen ejecutivo](https://repositorio.minedu.gob.pe/handle/20.500.12799/12773)
- [Congreso — audiencia Piura, brecha de infraestructura (mar. 2025)](https://www.congreso.gob.pe/Docs/comisiones2024/Educacion/files/informe_resumen_audiencia_pÚblica_piura_[21.03.2025].pdf)
- [Gestión — 54,6 % de colegios en muy mal estado (2024)](https://gestion.pe/economia/ano-escolar-2024-el-546-de-colegios-publicos-en-el-peru-estan-en-muy-mal-estado-y-deben-ser-demolidos-minedu-pronied-escuelas-infraestructura-educativa-noticia/)
- [Banco Mundial — Plan Nacional de Infraestructura Educativa al 2025](https://gpss.worldbank.org/sites/gpss/files/knowledge_products/2019/3.%20Nota%20T%C3%A9cnica_Plan%20Nacional%20de%20Infraestructura%20educativa%20en%20Per%C3%BA%20al%202025-%20Metodolog%C3%ADa%20de%20costeo%20de%20las%20intervenciones_031617PDF.pdf)
