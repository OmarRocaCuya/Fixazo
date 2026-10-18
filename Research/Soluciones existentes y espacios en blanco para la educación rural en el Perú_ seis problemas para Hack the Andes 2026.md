# Soluciones existentes y espacios en blanco para la educación escolar rural en el Perú: análisis de seis problemas para Hack the Andes 2026

Conviene construir donde la saturación es baja y el diagnóstico parte del trabajo real del estudiante. Los dos espacios más prometedores son: (1) la evaluación de fluidez lectora por voz en lenguas originarias para aulas EIB y multigrado, que hoy no ofrece ningún producto identificado, y (2) la verificación de infraestructura escolar con evidencia fotográfica y satelital sobre el canal "Mi Mantenimiento", que ya existe pero no se analiza. La planificación de clases con IA, en cambio, es un espacio saturado incluso en su versión peruana alineada al CNEB.

## TL;DR

- **Problema 1, saturación alta en la versión genérica:** al menos cinco herramientas comerciales ya generan sesiones alineadas al CNEB o a currículos latinoamericanos, varias con módulo multigrado, y el Minedu tiene su propio asistente (INTI) y un piloto de planificación con IA en 205 escuelas rurales para 2026. Ninguna herramienta identificada diagnostica a partir de audio de lectura o foto de cuaderno, agrupa por nivel y funciona sin conexión a la vez. Ese es el vacío defendible.
- **Problemas 2 y 6, vacío mayor:** existen corpus de voz en quechua, aimara y shipibo-konibo, y el modelo abierto Omnilingual ASR de Meta (2025), pero no se encontró ningún producto educativo de lectura asistida ni de medición de fluidez en lengua originaria. En infraestructura, el Censo Educativo se basa en el autorreporte del director y el canal fotográfico "Mi Mantenimiento" no se usa para la detección automática de fallas.
- **Problemas 3, 4 y 5, construir con cautela:** Alerta Escuela ya predice el riesgo de abandono sin impacto demostrado, de modo que el vacío está en la acción y no en la predicción. En violencia sexual, el cuello de botella es institucional (198 de 536 expedientes prescritos en Condorcanqui) y una herramienta de denuncia para menores conlleva riesgos graves. En heladas, la inversión en confort térmico es cara (unos S/7500 a S/9300 por estudiante) y no hay evidencia peruana publicada sobre el uso de sensores IoT en escuelas.

## Key Findings

### Matriz resumen de los seis problemas

| Problema | Saturación | Cantidad y calidad de soluciones existentes | Evidencia de impacto disponible | Tamaño del vacío | Potencial de disrupción |
|---|---|---|---|---|---|
| 1. Docente multigrado sin diagnóstico | Alta (planificación); baja (diagnóstico por voz o foto) | Muchas, en su mayoría generadores de texto sin evaluación | Fuerte para la pedagogía TaRL (0,15 a 0,70 DE) y para los tutores IA (Rori 0,36 DE); nula para los planificadores | Medio a grande en el diagnóstico | Alto si el producto parte del diagnóstico |
| 2. EIB sin docentes que dominen la lengua | Baja | Corpus de investigación y apps de vocabulario; ningún producto de fluidez | Solo métricas técnicas (WER y CER) | Muy grande | Muy alto |
| 3. Abandono silencioso | Media | Alerta Escuela (Perú), SIMPADE (Colombia), SAT (Chile)\[1\] | Mixta: los EWS reducen el ausentismo en EE. UU.; Alerta Escuela no mostró impacto significativo\[2\] | Grande en la intervención; pequeño en la predicción | Medio |
| 4. Violencia sexual en escuelas amazónicas | Media en canales, baja en seguimiento de plazos | SíseVe, Línea 100, CEM, Defensoría | Escasa; el problema central es la prescripción\[3\] | Grande, pero de naturaleza institucional | Bajo a medio, con riesgo ético alto |
| 5. Heladas y friaje | Media | Avisos de Senamhi, escenarios de CENEPRED, módulos y acondicionamiento de Pronied\[4\]\[5\] | Escasa sobre aprendizaje; los costos sí son conocidos | Medio (priorización y continuidad) | Medio |
| 6. Infraestructura y servicios | Media en datos, baja en verificación | Censo Educativo/ESCALE, PNIE, Mi Mantenimiento, Contraloría, Giga\[6\] | Solo descriptiva | Grande en la verificación | Alto |

### Lista priorizada de espacios en blanco

1. **Evaluación automática de fluidez lectora oral en quechua, aimara y lenguas amazónicas, con funcionamiento sin conexión.** Ningún producto identificado la ofrece y los activos técnicos ya existen (Huqariq, Siminchik, Omnilingual ASR, corpus de Puno en Common Voice).
2. **Diagnóstico multimodal (audio de lectura y foto de cuaderno) que alimente el agrupamiento TaRL en aulas multigrado.** Los planificadores existentes generan contenido sin evidencia del estudiante.
3. **Verificación de infraestructura con visión por computador sobre las fotos que los directores ya suben a "Mi Mantenimiento", cruzada con el Censo Educativo y con imágenes satelitales.** Corrige la dependencia del autorreporte.
4. **Capa de acción para Alerta Escuela:** mensajes de voz a familias en lengua local, cuyo mecanismo tiene evidencia en Brasil, en lugar de otro modelo predictivo.\[7\]
5. **Priorización de inversión térmica con costo por estudiante y exposición climática**, sin sensores como primera opción.

## Details

### Problema 1. Docente unidocente o multigrado sin apoyo para diagnosticar y planificar por niveles

**Mapa del panorama**

| Solución | Desarrollador, país, año | Qué hace | Sin conexión | Lenguas originarias | Diagnostica con trabajo real | Multigrado | Costo y modelo | Evidencia |
|---|---|---|---|---|---|---|---|---|
| INTI, en el programa "Planificación curricular con herramientas IA para el Buen Inicio del Año Escolar 2026" | Minedu (SIFODS), Perú, 2025-2026 | Revisa y retroalimenta unidades y sesiones; programa autoformativo de 112 horas\[8\] | No (plataforma en línea) | No consta | No (revisa la planificación) | No consta | Gratuito, estatal | Sin evaluación publicada |
| IA para planificación en secundaria rural | Minedu (DISER), Perú, anunciado en diciembre de 2025 para 2026 | Planificación de aprendizajes en 205 IIEE de Alternancia, Residencia y Tutorial, con cerca de 27 000 estudiantes\[9\] | No consta | No consta | No consta | Modelos rurales | Estatal | Sin evaluación |
| Curso de IA de PerúEduca y Smart Yachay | Minedu, Perú, 2025 | Formación docente; Smart Yachay es la estrategia offline de PerúEduca | Smart Yachay sí | No | No | No | Gratuito | Más de 30 000 inscritos y 11 032 certificados en 2025\[10\] |
| Piloto de IA de la DRELM con el Banco Mundial | DRELM y Banco Mundial, Lima, 2025 | Planificación pedagógica con IA para más de 300 docentes\[11\] | No | No | No consta | No (urbano) | Cooperación | Resultados no localizados |
| EducaTech IA | Privado, Perú | Programaciones, unidades, sesiones y rúbricas alineadas al CNEB; "Módulo Multigrado" | No | No consta | No | Sí (declarado) | Comercial | Solo marketing ("hasta 20 horas semanales")\[12\] |
| PlanProfe | Privado, Perú | Sesiones, planificación anual, multigrado y unidocente, adaptaciones NEE\[13\] | No | No consta | No | Sí | Planes con 350 generaciones al año\[13\] | Sin evaluación |
| ProfePlanner | Privado, Latinoamérica | Planeación en el formato de cada país, incluido Perú\[14\] | No | No | No | No consta | Gratis con 30 créditos al mes; plan básico de USD 7,75 al mes\[14\] | Declara más de 250 000 docentes (autodeclarado)\[14\] |
| Ketzai Teacher Lab | Privado, Panamá | Planificación MEDUCA; multigrado y telebásica en el plan gratuito\[15\] | No | No | No | Sí | Freemium | Sin evaluación |
| S-NAVI | SAMASAT, Ecuador | Planificación por normativa de cada país\[16\] | No | No | No | No consta | Comercial | Sin evaluación |
| Teachy, Gemini, Diffit (recomendadas en una guía difundida como del Minedu) | Varios, global | Planificación, generación y nivelación de textos\[17\] | No | No | Diffit nivela textos, no diagnostica | No | Freemium | Sin evaluación rural |
| Go Escuela | ONG o empresa social, Latinoamérica, desde 2022 | Contenido personalizado con IA, solución híbrida sin internet para aulas multigrado\[18\] | Sí (declarado) | No consta | No consta | Sí | No consta | No se localizó una evaluación |
| Teaching at the Right Level (TaRL) | Pratham y J-PAL, India, desde 2001 | Evaluación oral simple, agrupamiento por nivel y no por grado, actividades | Sí (no es tecnología) | Adaptable | Sí (evaluación oral) | Sí (agrupa entre grados 3 a 5) | Bajo costo | 0,15 DE en Haryana; 0,61 a 0,70 DE en Uttar Pradesh; Balsakhi 0,14 y 0,28 DE\[19\]\[20\]\[21\] |
| Rori | Rising Academies, Ghana y Sierra Leona, 2023 | Tutor de matemáticas con IA por WhatsApp | Baja conectividad (WhatsApp) | No | Sí (respuestas del estudiante) | No | Henkel et al. (2024) estiman que "the marginal cost of providing Rori is approximately $5 per student" | ECA con 11 escuelas: efecto de 0,36 DE (477 estudiantes con ambas pruebas), que los autores consideran "approximately equivalent to an extra year of learning" |

**Saturación.** La versión genérica ("generar una sesión alineada al CNEB, con opción multigrado") tiene saturación **alta**. Existen al menos cinco productos comerciales en español que declaran alineación al CNEB o a currículos regionales, dos de ellos peruanos con módulo multigrado explícito (EducaTech IA y PlanProfe).\[13\]\[22\] El Estado también entró: INTI revisa planificaciones y la DISER llevará la IA a 205 escuelas rurales en 2026.\[8\]\[9\] A esto se suman decenas de herramientas globales (MagicSchool, Brisk, Eduaide, Diffit, Curipod) que esta investigación no reverificó una por una.\[23\] Por lo tanto, no es posible establecer una cifra exacta de herramientas. Lo verificado basta para afirmar que la planificación ya no diferencia ningún producto. Las subpartes **no cubiertas** son tres: el diagnóstico a partir del trabajo real del estudiante (audio de lectura o foto de cuaderno), el agrupamiento automático por nivel en el estilo TaRL y la operación local sin conexión. No se encontró ninguna solución que combine diagnóstico por voz y foto, agrupamiento por nivel, material autoinstructivo y funcionamiento sin conexión para aulas multigrado. Esta conclusión es una inferencia sobre una búsqueda finita, no una prueba de inexistencia.

**Qué funciona y qué no.** La evidencia rigurosa respalda la pedagogía, no el hardware. En el Perú, la evaluación aleatoria de Una Laptop por Niño en escuelas rurales elevó la razón de computadoras por estudiante de 0,12 a 1,18 sin efectos en matemáticas ni lenguaje a los 15 meses (Cristia et al., 2017).\[24\] El seguimiento de largo plazo en 531 escuelas rurales, entre 2007 y 2019, tampoco halló efectos significativos (Cueto et al., Journal of Public Economics, 2025).\[25\]\[26\] TaRL logra efectos grandes cuando hay tiempo dedicado y monitoreo; la misma serie de ensayos documentó que, en algunos estados, los docentes públicos no adoptaron la metodología pese a la capacitación.\[19\]\[21\] Rori muestra que un tutor de bajo ancho de banda puede producir 0,36 DE, aunque los propios análisis advierten que los estudiantes seguían con acceso al tutor al momento de la medición.\[27\] La lección para el Perú rural: el valor está en medir el nivel real y agrupar, no en distribuir dispositivos ni en generar más texto.\[28\]\[29\]

**Ángulos de disrupción.**
1. *Diagnóstico primero, planificación después.* Un registro de 60 segundos de lectura oral por estudiante (palabras correctas por minuto) y una foto de una tarea resuelta producen grupos TaRL. El riesgo es la precisión del reconocimiento de voz infantil en contextos ruidosos.
2. *Operación local en un teléfono del docente.* Los modelos pequeños de reconocimiento de voz y de visión corren en el dispositivo y sincronizan cuando hay señal. El riesgo es el rendimiento en teléfonos de gama baja.
3. *Material autoinstructivo por grupo y no por grado,* impreso o en audio, para que el docente atienda a un grupo mientras los otros trabajan solos. El riesgo es la calidad pedagógica sin revisión humana.

**Activos reutilizables.** La metodología abierta de TaRL y la evaluación ASER; los textos y cuadernos de trabajo del Minedu; Smart Yachay como canal offline; los resultados de ENLA y la ECE en ESCALE para calibrar niveles.

### Problema 2. Plazas EIB cubiertas por docentes que no dominan la lengua

**Estado de la tecnología de voz en lenguas peruanas**

| Recurso | Desarrollador, año | Lenguas | Tamaño | Métrica publicada | Licencia |
|---|---|---|---|---|---|
| Siminchik | Cardenas, Zevallos, Baquerizo y Camacho, LREC 2018 | Quechua sureño (Chanca y Collao) | 97 horas de conversación espontánea de radio | Experimentos iniciales con HMM\[30\]\[31\] | Disponible para investigación (no verificado en detalle) |
| Aumento de datos para ASR quechua | Zevallos et al., Interspeech 2022 | Quechua sureño | Siminchik más el corpus Lurín (83,3 h) | El WER bajó de 31,5 % a 22,8 % con texto y voz sintéticos\[32\]\[33\] | Académica |
| Huqariq | Zevallos et al., LREC 2022 | Quechua sureño y central, aimara, shipibo-konibo | 220 horas transcritas; entrenamiento: 144 h de quechua sureño, 12 h de aimara, 4 h de shipibo | CER por lengua con Wav2Vec2 | Los autores anunciaron una versión CC0\[34\]\[35\] |
| Corpus de emociones en quechua collao | Scientific Data, 2022 | Quechua collao | 15 horas | Reconocimiento de emociones | Público\[36\] |
| TTS shipibo-konibo | AmericasNLP 2025 | Shipibo-konibo | 4 horas y 3025 frases | Inteligibilidad de 88,56 % para la voz sintética frente a 83,45 % para la natural\[37\]\[38\] | Académica |
| Recursos comunitarios para quechua de Puno | AmericasNLP 2026 | Quechua de Puno (Common Voice)\[39\] | Corpus validado más transcripciones "plata" | Mejor resultado: 2,11 % de WER en habla leída y 3,15 % en espontánea; whisper-base: 42,0 % de WER fuera de dominio\[40\] | Common Voice (CC0) |
| TTS quechua sobre la Constitución | arXiv, 2026 | Quechua y castellano | Corpus legal bilingüe | WER de 0,16 en voz sintetizada (modelo de 164 M parámetros)\[41\] | Académica |
| Omnilingual ASR | Meta FAIR, 10 de noviembre de 2025 | Más de 1600 lenguas | Modelos de 300 M a 7 B y corpus de 350 lenguas | Según el blog de Meta FAIR, el sistema 7B-LLM-ASR alcanza un CER menor a 10 en 78 % de las lenguas (la cifra corresponde al modelo de 7B, no a toda la familia); 95 % con 10 o más horas de entrenamiento; 36 % con menos de 10 horas | Apache 2.0 según Open Source For You (noviembre de 2025), dato secundario no confirmado en el repositorio |

Los WER de un dígito de Puno corresponden a habla leída o a un dominio controlado. El 42 % fuera de dominio es más representativo del aula real.\[40\] No se verificaron las cifras de Omnilingual ASR para awajún ni asháninka.

**Productos educativos existentes**

| Producto | Desarrollador, año | Qué hace | Fluidez automática | Sin conexión |
|---|---|---|---|---|
| App "Lenguas OEI" | Minedu y OEI, piloto 2026 | Lecciones de quechua collao con ejercicios de repetición y grabación de voz; más de 5000 escolares en 102 IIEE\[42\] | No (enseña la lengua) | No consta |
| Yachasun | Docente Reyna Rodríguez, Cusco | Comprensión lectora en quechua y castellano; mide el tiempo y plantea preguntas\[43\] | Mide el tiempo, sin reconocimiento de voz | No consta |
| Illariy | UNMSM, 2024 | Avatar de noticias y cuentos en quechua (TTS)\[44\]\[45\] | No | No |
| Habla Quechua | PromPerú | App de vocabulario\[46\] | No | No consta |

**Saturación: baja.** Hay investigación sólida, pero ningún producto identificado escucha a un niño leer en quechua, aimara o shipibo y estima su fluidez o sus errores de decodificación. También se documentó que los LLM generales traducen mal las lenguas indígenas ("ChatGPT is not a good indigenous translator", AmericasNLP 2023), lo que desaconseja depender de modelos generalistas para producir textos en la variante local.\[47\]\[48\]

**Gobernanza de datos.** Una solución que grabe voces de niños indígenas requiere un consentimiento informado de las familias y de las comunidades. Las grabaciones deben quedar localmente bajo control comunitario, con reglas explícitas de uso. Los principios CARE, OCAP, la licencia Kaitiakitanga de Te Hiku Media y las etiquetas de Local Contexts son referentes internacionales de soberanía de datos indígenas. Esta investigación no los reverificó en sus textos primarios. Su aplicación al Perú debe articularse con la Ley 29735 de lenguas originarias y con la Ley 29733 de protección de datos personales, que tampoco se analizaron aquí en su articulado.

**Ángulos de disrupción.**
1. *Medición de fluidez oral en lengua originaria* sobre textos decodificables de la variante local, ajustada con Huqariq y los corpus de Puno. El riesgo son las variantes dialectales y la normalización ortográfica.
2. *Docente que no domina la lengua como usuario explícito:* el sistema le dice qué grafemas falla cada niño, aunque él no hable la lengua. El riesgo es desplazar la exigencia de docentes bilingües.
3. *Datos comunitarios con licencia de soberanía* como ventaja competitiva. El riesgo es la lentitud de los procesos de consentimiento.

**Activos reutilizables.** Huqariq (CC0 anunciado), Siminchik, Common Voice de Puno, Omnilingual ASR, los materiales EIB del Minedu (ya usados como fuente para el TTS shipibo) y AmericasNLP como comunidad de pares.\[34\]\[37\]

### Problema 3. Abandono silencioso en la transición a secundaria

**Mapa del panorama**

| Sistema | País, año | Qué hace | Evidencia |
|---|---|---|---|
| Alerta Escuela | Minedu, Perú, 2020 | Riesgo individual con machine learning, en el SIAGIE, para más de 90 000 directores; actualización mensual | La evaluación de impacto de la Oficina de Seguimiento y Evaluación Estratégica del Minedu (2023) halló efectos sobre el abandono "especialmente en estudiantes con riesgo medio y alto", pero "dichos resultados no fueron" significativos, y documentó "autoselección docente en el uso de AE". Certificada como Buena Práctica de Gestión Pública en 2023 |
| Campaña SMS para promover Alerta Escuela | Minedu, 2021-2022 | Mensajes para aumentar el uso de la herramienta | Mide la promoción del uso, no el abandono\[49\]\[50\] |
| SIMPADE | MEN, Colombia, desde 2012 | Índice de riesgo vinculado al SIMAT\[1\]\[51\]\[52\] | Sin evaluación causal localizada |
| SAT escolar | Mineduc, Chile, 2019 | Arrancó en 294 escuelas de los Servicios Locales y se amplió en 2020\[1\]\[53\] | Sin evaluación causal localizada |
| EWIMS | EE. UU. (Faria et al., 2017) | Indicadores de asistencia, conducta y cursos | ECA: redujo el ausentismo crónico y la reprobación sin efecto en GPA ni créditos; 7 de 37 escuelas abandonaron la implementación\[54\]\[55\] |
| Diplomas Now | Johns Hopkins, City Year y Communities In Schools, EE. UU. | Alerta temprana más acompañamiento | ECA en 62 escuelas: más estudiantes sin indicadores de alerta\[56\] |
| EWS de Montana | EE. UU., 2012-2020 | Analítica predictiva | El uso más intensivo se asoció a mejor graduación\[57\] |
| Eduq+ (Movva) | Brasil | SMS a padres sobre asistencia y notas | ECA con 19 300 estudiantes de noveno grado en São Paulo: 2,1 puntos porcentuales más de asistencia; el programa óptimo de nudges elevó las pruebas en 0,33 DE\[58\]\[59\] |
| Eduq+ por audio | Costa de Marfil | Mensajes de texto y de voz (IVR)\[7\]\[60\] | ECA de Wolf y Lichand en 100 escuelas con 2246 estudiantes (npj Science of Learning, 2023): según Evans y Mendez Acosta (CGD, 2020), los mensajes dos veces por semana a padres o a docentes redujeron el abandono entre 2 y 2,5 puntos porcentuales, cerca del 50 % de la tasa del grupo de control; escribir a ambos a la vez tuvo un efecto no significativo |

**Saturación: media.** La predicción ya existe en el Perú y está integrada al SIAGIE.\[61\] Un nuevo modelo predictivo sería una copia. El vacío está en la **intervención**: la evaluación del Minedu sugiere que el problema es que el director no actúa, y la evidencia de Brasil muestra que el mecanismo eficaz es la saliencia del mensaje a las familias, no la precisión del modelo. El efecto de Eduq+ se explica sobre todo por la saliencia y no por la información específica del estudiante, de modo que los mensajes genéricos y baratos funcionan.\[58\]\[59\]

**Datos satelitales de fenología.** No se encontró ningún proyecto que use la fenología de cultivos (por ejemplo, el NDVI de Sentinel-2) para predecir el abandono escolar. La idea es nueva, pero su valor añadido es dudoso: el calendario agrícola es conocido por la comunidad y por el docente, y la asistencia diaria (si se registra) capta la ausencia de forma más directa. Se recomienda usarla solo para programar los mensajes antes de la siembra y la cosecha, no como predictor.

**Ángulos de disrupción.**
1. *Mensajes de voz (IVR) en quechua o awajún a las familias,* sincronizados con el calendario agrícola local. El riesgo es la cobertura móvil y los teléfonos compartidos.
2. *Registro de asistencia por voz del docente* para cerrar el vacío de datos de asistencia en tiempo real. El riesgo es la carga de trabajo adicional.
3. *Trayectorias flexibles:* materiales de recuperación para quien vuelve tras la cosecha. El riesgo es la articulación con la normativa de evaluación.

Juntos y Qali Warma no se investigaron en esta ronda; sus datos de corresponsabilidad podrían enriquecer las señales de riesgo, pero su acceso no se verificó.

### Problema 4. Violencia sexual contra estudiantes en residencias y escuelas amazónicas

**Datos verificados.** Entre enero y agosto de 2026, SíseVe registró 2059 reportes de violencia sexual: 1198 entre estudiantes (frente a 885 en 2025 y 986 en 2024) y 861 atribuidos a personal de las IIEE.\[62\]\[63\] Lima Metropolitana concentra el 34 % de los reportes entre estudiantes, lo que sugiere un subregistro en la Amazonía (inferencia).\[64\] En Condorcanqui, el Informe Defensorial 231 (2025) reporta 536 expedientes disciplinarios entre 2010 y 2024, de los cuales 198 prescribieron, 9 se archivaron y 72 terminaron en absolución.\[65\] En 2018, la Defensoría halló que el 64 % de los casos evaluados entre 2012 y 2017 en esa UGEL había prescrito.\[66\] Según el SIMEX, entre 2014 y 2023 se archivaron 604 expedientes nacionales por prescripción (prensa).\[3\] La Junta de Fiscales de Amazonas reportó a junio de 2024 que solo 8 de 256 procesos anteriores tenían sentencia (prensa).\[66\]

| Canal existente | Alcance | Limitaciones para estudiantes amazónicos |
|---|---|---|
| SíseVe (Minedu) | Reporte confidencial en línea por víctimas o testigos | Requiere internet y alfabetización en castellano; registra presuntos hechos\[67\]\[68\] |
| Comisiones de procesos disciplinarios de la UGEL | Sanción administrativa | Prescripción; la Defensoría describe a las UGEL de Amazonas como un "cementerio de expedientes" (cita de una dirigente en prensa)\[69\] |
| Fiscalía y Poder Judicial | Sanción penal (los delitos contra la indemnidad sexual no prescriben)\[3\] | Distancia geográfica, muy pocas sentencias\[3\]\[66\] |
| Línea 100, CEM, Programa Aurora (MIMP), DEMUNA | Atención y derivación | Esta investigación no verificó su cobertura en lenguas originarias |
| Bloqueo en los sistemas de RR. HH. del Minedu | Impide recontratar a denunciados\[70\] | Medida de 2024; su cumplimiento no se verificó\[70\] |

**Saturación: media en canales, baja en el seguimiento de plazos.** El cuello de botella no es la falta de un canal, sino que los expedientes prescriben.\[3\]\[69\] Un tablero de plazos para los funcionarios de la UGEL y de la Defensoría no expone a los menores y ataca el problema documentado.

**Riesgos éticos de una herramienta de denuncia para menores.** Represalia si el agresor accede al teléfono o al canal; revictimización por entrevistas repetidas; falsa sensación de protección si nadie responde; exposición de datos sensibles de menores; denuncias en lengua originaria sin intérpretes capacitados del lado receptor. Esta sección se limita al estado del arte y no propone diseños que capten datos de menores.

### Problema 5. Heladas y friaje

**Sistemas existentes.** El Plan Multisectorial ante Heladas y Friaje (ediciones 2019-2021, 2022-2024 y 2025-2027) asigna a Pronied el acondicionamiento térmico, el mantenimiento y los módulos prefabricados.\[4\]\[71\]\[72\] CENEPRED elaboró escenarios de riesgo 2025-2027 con el percentil 1 de la temperatura mínima de julio (1965-2020) y con la fragilidad de los locales educativos tomada del Censo Educativo **2019**, un dato desactualizado para 2026.\[4\] El plan de 2018 ya reconocía que las infecciones respiratorias agudas en temporada de heladas aumentan el ausentismo escolar.\[71\] Senamhi emite avisos meteorológicos; esta investigación no verificó su canal escolar específico ni la existencia de un protocolo de alerta a las UGEL.

| Intervención | Escala | Costo verificado | Costo por estudiante (cálculo propio) |
|---|---|---|---|
| Módulos prefabricados tipo heladas con invernadero y cámara de aire (Pronied, plan 2022-2024) | 347 módulos en 235 IIEE\[5\] | S/48 776 474 para 8088 estudiantes (incluye 221 kits de pararrayos)\[5\] | Cerca de S/6030 |
| Acondicionamiento térmico (Pronied, mismo año) | 68 IIEE\[5\] | S/12 530 133 para 1346 estudiantes\[5\] | Cerca de S/9309 |
| Confort térmico concluido en 2025 | 9 IIEE | S/1 536 000 para 204 estudiantes\[73\] | Cerca de S/7529 |
| Confort térmico en ejecución en 2025 | 6 IIEE\[73\] | S/1 334 333 para 169 estudiantes\[73\] | Cerca de S/7896 |
| Mantenimiento priorizado por heladas y friaje | 5630 IIEE (3320 por heladas, 2310 por friaje)\[74\] | Parte de la bolsa de mantenimiento; al 3 de julio de 2024, el 69,67 % de los directores había reportado\[74\] | No aplica |

**Saturación: media.** La infraestructura física tiene un responsable claro, pero su ritmo es lento (15 IIEE en 2025 frente a decenas de miles de estudiantes en riesgo).\[73\] No se encontró evidencia peruana publicada sobre sensores IoT o LoRaWAN en escuelas andinas ni sobre el efecto causal del frío en el aprendizaje en el Perú. **Vacío:** priorizar con costo por estudiante y exposición real, y disponer de paquetes de continuidad activados por el aviso de Senamhi. Una red de sensores agregaría costos de mantenimiento con un valor marginal incierto frente a los pronósticos existentes; un piloto con pocos termómetros de bajo costo sería suficiente para calibrar la temperatura interior de las aulas frente a la exterior.

### Problema 6. Infraestructura y servicios escolares

**Sistemas existentes y brechas de datos**

| Sistema | Qué contiene | Debilidad documentada |
|---|---|---|
| Censo Educativo (Cédula 11 "Local Educativo") y ESCALE | Agua, desagüe, electricidad y estado de los espacios; anual desde 1998 | El llenado y la remisión son responsabilidad del director (autorreporte en la plataforma EOL)\[75\]\[76\] |
| PNIE | Brecha y priorización; la RM 076-2026-MINEDU lo amplió hasta 2028 | La brecha cambia según la fuente: S/158 832 millones (diciembre de 2024), S/170 000 millones (Minedu, 2026), S/172 000 millones (IPE, cierre de 2025)\[77\]\[78\]\[79\]\[80\] |
| Programa de Mantenimiento de Pronied y aplicativo "Mi Mantenimiento" | S/295 millones para 55 014 locales en 2026; el director registra la ficha de acciones, el panel de culminación **con fotos** y la declaración de gastos | No se encontró una tasa nacional de rendición; un dato histórico de Cusco muestra cerca de 88,7 %\[81\]\[82\]\[83\] |
| Contraloría, Operativo Educación 2025 | Visitas in situ | En Huánuco (45 IIEE), el 30 % no tenía servicios higiénicos y el 14 % de las aulas era inhabitable\[84\] |
| Defensoría | Supervisiones | ID 231: 58 de 79 IIEE con residencia sin acceso a agua; en 2026, 185 de 550 IIEE (33,6 %) no recibieron presupuesto de mantenimiento\[65\]\[85\] |
| UNICEF Giga | Mapeo de escuelas con IA en imágenes satelitales en 8 países; Giga Maps con cerca de 2,3 millones de establecimientos\[6\]\[86\]\[87\] | No se confirmó la carga de datos del Perú |

**La definición cambia la cifra.** Una nota del Minedu informaba que el 92,6 % de los colegios públicos tenía los tres servicios si se cuenta cualquier tipo de acceso.\[88\] Con conexión a la red pública, la cifra baja a 40 % (Censo 2022) o 29,4 % (2023, ComexPerú).\[89\]\[90\] En el ámbito rural, solo el 22 % tenía los tres servicios en 2025, frente a 26 % en 2015 (IPE).\[91\] La cifra de 51 residencias sin agua potable de la investigación previa del equipo no coincide con los 58 colegios sin acceso a agua que reporta el ID 231; conviene citar la cifra del informe primario.\[65\]

**Verificación con visión por computador.** Ya existe para la *detección* de escuelas: UNICEF y sus socios mapean escuelas con IA en imágenes de alta resolución y hay trabajos de 2026 sobre detección con pocas etiquetas (por ejemplo, en Kenia solo 7000 de unas 33 000 escuelas tenían coordenadas verificadas).\[6\]\[87\]\[92\] No se encontró ningún sistema que evalúe el *estado* de la infraestructura escolar a partir de las fotos de los directores ni de imágenes satelitales en el Perú. Tampoco existe en el Perú una plataforma ciudadana o docente de reporte de fallas en escuelas públicas: SíseVe es solo para violencia e Identicole acepta reclamos de infraestructura solo de colegios privados.\[67\]\[93\] En la región existen "Reportes de Escuelas" en Ciudad de México y el formulario de RedPaPaz en Colombia.\[94\]\[95\]

**Ángulos de disrupción.**
1. *Analizar las fotos que ya fluyen por "Mi Mantenimiento"* con visión por computador para detectar techos dañados, falta de servicios higiénicos o discrepancias con el Censo. El riesgo es el acceso a los datos (requiere una alianza con Pronied).
2. *Puntaje de confiabilidad del Censo* que cruce el autorreporte con la Contraloría, la Defensoría y las imágenes satelitales. El riesgo es la resistencia institucional.
3. *Reporte por voz del docente en lengua local,* convertido en un ticket estructurado. El riesgo es la falta de respuesta, que desgasta el canal.

## Recommendations

1. **Construir el Problema 2 combinado con el Problema 1:** un medidor de fluidez lectora sin conexión, en quechua y castellano como segunda lengua, que agrupe a los estudiantes por nivel al estilo TaRL y entregue material decodificable por grupo. Es el único producto que combina un vacío verificado, activos abiertos y evidencia pedagógica fuerte. Empezar con el quechua de Puno o el chanca (hay más datos) y documentar un plan de consentimiento comunitario.
2. **Como segunda opción, el Problema 6:** un verificador de infraestructura sobre "Mi Mantenimiento" y el Censo Educativo. Su disrupción no está en recolectar datos nuevos, sino en auditar los que el Estado ya recibe.
3. **No construir** otro planificador de clases, otro modelo predictivo de abandono ni una red de sensores IoT como producto central: replicarían lo existente o agregarían costos sin evidencia.
4. **Para el Problema 4,** si se aborda, limitarse a herramientas para funcionarios (seguimiento de plazos de prescripción) sin captar datos de menores.
5. **Medir desde el inicio** con una métrica de aprendizaje (palabras correctas por minuto) y diseñar una evaluación aleatoria por escuela: la historia de Una Laptop por Niño muestra que la adopción no equivale a impacto.

## Caveats

- **Fuentes primarias:** documentos del Minedu (gob.pe, repositorio, ESCALE), Defensoría (ID 231 e ID 218), CENEPRED, Contraloría, artículos revisados por pares (Cristia et al.; Cueto et al.; Banerjee et al.; Henkel et al.; Zevallos et al.; Faria et al.) y documentos técnicos de Meta. **Fuentes secundarias o prensa:** cifras de SíseVe 2026 (RPP, La República, CNN), Condorcanqui según la UGEL y la Fiscalía (Wayka, El Comercio, Inforegión), brecha de infraestructura (ComexPerú, Gestión, IPE), costos de Pronied (TV Perú, Constructivo) y las páginas comerciales de las herramientas (autodeclaraciones sin verificar).
- **No verificado en esta investigación:** el texto de la Ley 29735 y de la Ley 29733; los principios CARE y OCAP y la licencia Kaitiakitanga; la cobertura de la Línea 100 y de los CEM en lenguas originarias; el canal escolar de Senamhi; Juntos y Qali Warma como fuentes de datos; la licencia de Omnilingual ASR en fuente primaria (solo se encontró la mención secundaria de Apache 2.0); las cifras de Mindspark, Khanmigo, MagicSchool y otras herramientas globales listadas en la consulta; los datos del Perú en Giga Maps.
- La afirmación de que "no existe" una solución integrada para los problemas 1 y 2 es una inferencia a partir de una búsqueda acotada; debe confirmarse con una revisión de GitHub, Product Hunt y los ganadores de Tools Competition y del XPRIZE antes de presentar el proyecto.
- Los costos por estudiante del Problema 5 son cálculos propios a partir de montos publicados y no incluyen mantenimiento ni vida útil.
- Las referencias completas en formato APA 7 se gestionan en el aparato de citas del documento.

## Sources

1. [Sistemas de alerta temprana en la educación secundaria](https://www.cippec.org/wp-content/uploads/2021/09/233-DPP-EDU-Sistemas-de-alerta-temprana-Perusia-y-Cardini-septiembre-2021.pdf)
2. [APPENDIXES August 2021 Regional Educational Laboratory Northwest](https://ies.ed.gov/sites/default/files/migrated/rel/regions/northwest/pdf/REL_2021097_appendices.pdf)
3. [195 casos de abuso sexual de docentes contra niñas awajún en Condorcanqui han prescrito - Wayka.pe](https://wayka.pe/195-casos-de-abuso-sexual-de-docentes-contra-ninas-awajun-en-condorcanqui-han-prescrito/)
4. [ESCENARIOS DE RIESGO POR HELADAS Y FRIAJE 2021 0](https://cdn.www.gob.pe/uploads/document/file/6495134/67666-17665_escenarios-de-riesgo-por-heladas-y-friajes-en-el-marco-del-plan-multisectorial-multianual-2025-2027.pdf)
5. [Pronied instalará 347 módulos tipo heladas en 235 colegios para abrigar a 10 mil estudiantes de zonas altoandinas - Revista Constructivo](https://constructivo.com/actualidad/pronied-instalara-347-modulos-tipo-heladas-en-235-colegios-para-abrigar-a-10-mil-estudiantes-de-zonas-altoandinas-1652795291)
6. [Education in the age of connectivity](https://www.unicef.org/lac/en/education-age-connectivity)
7. [Evaluating the Impact of Text and Audio Messages for Parents and Teachers in Côte d’Ivoire](https://poverty-action.org/evaluating-impact-text-and-audio-messages-parents-and-teachers-cote-divoire)
8. [Programa “Planificación curricular con herramientas IA para el Buen Inicio del Año Escolar 2026” - Orientación - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/107687-programa-planificacion-curricular-con-herramientas-ia-para-el-buen-inicio-del-ano-escolar-2026)
9. [Minedu implementará uso de inteligencia artificial para fortalecer aprendizajes de 27 000 estudiantes del ámbito rural - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/1304191-minedu-implementara-uso-de-inteligencia-artificial-para-fortalecer-aprendizajes-de-27-000-estudiantes-del-ambito-rural)
10. [Plataforma PerúEduca del Minedu se consolida como herramienta clave para conectar a más docentes y estudiantes con la educación - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/1242110-plataforma-perueduca-del-minedu-se-consolida-como-herramienta-clave-para-conectar-a-mas-docentes-y-estudiantes-con-la-educacion)
11. [Docentes de Lima se integrarán al programa piloto de inteligencia artificial del DRELM y el Banco Mundial en 2025](https://larepublica.pe/sociedad/2024/12/09/docentes-de-lima-se-integraran-al-programa-piloto-de-inteligencia-artificial-del-drelm-y-el-banco-mundial-en-2025-minedu-381924)
12. [EducaTech IA - Inteligencia Artificial para el Docente Peruano](http://educatech.pe/public/)
13. [PlanProfe - Tu planificación curricular con IA](https://planprofe.pe/)
14. [Profe Planner AI- Tu asistente de IA para la planificación ...](https://www.profeplanner.com/)
15. [Ketzai - Planificación Docente con IA](https://www.ketzai.com/)
16. [S-NAVI - inteligencia artificial](https://samasat.com/s-navi/)
17. [MINEDU RECOMIENDA IA GRATUITAS PARA DOCENTES](https://www.gdp-pe.lat/2025/06/10/minedu-recomienda-ia-gratuitas-para-docentes/)
18. [En zonas rurales, un maestro debe atender varios grados a la ...](https://goescuela.org/)
19. [TaRL Evidence - India - Teaching at the Right Level Africa](https://teachingattherightlevel.org/impact-and-learning/tarl-evidence/history-of-tarls-evidence-in-india/)
20. [Lessons from the Teaching at the Right Level Evidence](https://resep.sun.ac.za/wp-content/uploads/2019/10/QER-A-Morrell.pdf)
21. [Mainstreaming an Effective Intervention: Evidence from Randomized Evaluations of "Teaching at the Right Level" in India](https://ideas.repec.org/p/ecl/harjfk/rwp16-043.html)
22. [Ketzai Teacher Lab](https://www.ketzai.com/teacher-lab)
23. [10 Herramientas de IA para Docentes Gratis 2026: Guía LATAM](https://mentoraia.com/herramientas-de-ia-para-docentes-gratis/)
24. [Giving every child a laptop did not raise Peru's test scores](https://screenchildhood.com/archive/one-laptop-per-child-peru-evaluation-2012/)
25. [Laptops in the long run: Evidence from the one laptop per child program in rural Peru - ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0047272725002373)
26. [The Effects of the One Laptop per Child Program in Peru](https://www.cato.org/research-briefs-economic-policy/effects-one-laptop-child-program-peru)
27. [Balancing the Equation: Why AI in Math Teaching Cuts Both Ways](https://edtechinsiders.substack.com/p/balancing-the-equation-why-ai-in)
28. [(PDF) Inteligencia artificial como recurso docente en un colegio rural agrupado](https://www.researchgate.net/publication/376424541_Inteligencia_artificial_como_recurso_docente_en_un_colegio_rural_agrupado)
29. [IMPLEMENTACIÓN DE LA INTELIGENCIA ARTIFICIAL COMO HERRAMIENTA DIDÁCTICA EN COLEGIOS RURALES DE COLOMBIA](https://revistas.upel.edu.ve/index.php/trascendere/article/view/5650)
30. [Siminchik: A Speech Corpus for Preservation of Southern Quechua](http://lrec-conf.org/workshops/lrec2018/W14/pdf/4_W14.pdf)
31. [Siminchik: A Speech Corpus for Preservation of Southern Quechua](https://zenodo.org/records/3595354)
32. [Automatic Speech Recognition of Quechua Language Using HMM Toolkit](https://www.researchgate.net/publication/340835565_Automatic_Speech_Recognition_of_Quechua_Language_Using_HMM_Toolkit)
33. [Data Augmentation for Low-Resource Quechua ASR Improvement](https://www.isca-archive.org/interspeech_2022/zevallos22_interspeech.pdf)
34. [Huqariq: A Multilingual Speech Corpus of Native Languages of Peru for Speech Recognition](https://arxiv.org/pdf/2207.05498)
35. [A Multilingual Speech Corpus of Native Languages of Peru ...](https://aclanthology.org/2022.lrec-1.537.pdf)
36. [A speech corpus of Quechua Collao for automatic dimensional emotion recognition](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9789950/)
37. [NAACL 2025 The Fifth Workshop on NLP for Indigenous Languages of the Americas](https://aclanthology.org/2025.americasnlp-1.pdf)
38. [A case study in Shipibo-Konibo (a Panoan language from ...](https://aclanthology.org/2025.americasnlp-1.1.pdf)
39. [Quechua Speech Datasets in Common Voice: The Case of Puno Quechua](https://arxiv.org/pdf/2510.13871)
40. [Building Community-Centred NLP Resources for Puno ...](https://aclanthology.org/2026.americasnlp-6.13.pdf)
41. [Giving Voice to the Constitution: Low-Resource Text-to-Speech for Quechua and Spanish Using a Bilingual Legal Corpus](https://arxiv.org/html/2604.13288)
42. [El quechua llega a tu celular: Minedu presenta app gratuita para aprender la lengua originaria y la cultura andina - Infobae](https://www.infobae.com/peru/2026/06/03/el-quechua-llega-a-tu-celular-minedu-presenta-app-gratuita-para-aprender-la-lengua-originaria-y-la-cultura-andina/)
43. [Quechua, la lengua milenaria del Perú que resurge con la tecnología](https://elcomercio.pe/tecnologia/actualidad/quechua-la-lengua-milenaria-del-peru-que-resurge-con-la-tecnologia-windows-11-office-microsoft-tiktok-yachasun-musquriy-google-noticia/)
44. [Uso de la transcripción fonética para lograr que avatares de inteligencia artificial pronuncien discurso en lengua quechua: caso Illariy](http://www.scielo.org.pe/scielo.php?script=sci_arttext&pid=S2413-26592024000200034)
45. [La IA abraza el quechua - Diario de Yucatán](https://www.yucatan.com.mx/imagen/2024/02/02/la-ia-abraza-el-quechua.html)
46. [Habla Quechua, un app que tenemos que descargar! - YouTube](https://www.youtube.com/watch?v=qDV-JFVBUyc)
47. [NLP Progress in Indigenous Latin American Languages](https://arxiv.org/pdf/2404.05365)
48. [ChatGPT is not a good indigenous translator](https://aclanthology.org/2023.americasnlp-1.17.pdf)
49. [Description: Alerta Escuela y la importancia de los sistemas de alerta temprana para prevenir la interrupción de estudios](https://alicia.concytec.gob.pe/vufind/Record/MIIN_7d720c816ea3889e93b55754150d2159)
50. [evaluación de impacto de la herramienta alerta escuela](https://repositorio.minedu.gob.pe/bitstream/handle/20.500.12799/8849/Evaluaci%C3%B3n%20de%20impacto%20de%20la%20herramienta%20Alerta%20Escuela%20brindando%20informaci%C3%B3n%20oportuna%20sobre%20el%20riesgo%20de%20abandono%20escolar.pdf?sequence=4&isAllowed=y)
51. [SIMPADE - Ingreso - Secretaría de Educación de Buenaventura](https://simpade.mineducacion.gov.co/simpade/)
52. [SIMPADE](https://sedcauca.gov.co/simpade/)
53. [Sistema de Alerta Temprana contra la deserción escolar](https://www.mineduc.cl/sistema-de-alerta-temprana-contra-la-desercion-escolar/)
54. [First-Year Effects of Early Indicator and Intervention Systems in Oregon](https://ies.ed.gov/rel-northwest/2025/01/oregon-eiis-study-slides)
55. [implementation of an early warning system - ERIC](https://files.eric.ed.gov/fulltext/ED607284.pdf)
56. [Diplomas Now - Attendance Works](https://www.attendanceworks.org/diplomas-now/)
57. [EPAA 8700 Clausen et al. FNL](https://opi.mt.gov/Portals/182/Page%20Files/Data%20Reporting/Research%20Portal/EPAA_8700_Clausen_et_al._FNL.pdf)
58. [How Messages to Parents Impact Student Performance in Brazil](https://www.povertyactionlab.org/evaluation/how-messages-parents-impact-student-performance-brazil)
59. [What is It About Communicating With Parents?∗](https://cepa.stanford.edu/sites/default/files/cunha_cover_paper1.pdf)
60. [Are the Effects of Informational Interventions Driven by Salience?](https://www.researchgate.net/publication/342983658_Are_the_Effects_of_Informational_Interventions_Driven_by_Salience)
61. [Minedu implementa sistema que identifica a estudiantes con riesgo de abandonar la escuela](https://andina.pe/agencia/noticia-minedu-implementa-sistema-identifica-a-estudiantes-riesgo-abandonar-escuela-817316.aspx)
62. [Minedu reporta 1198 casos de violencia sexual entre estudiantes entre enero y agosto del 2026](https://rpp.pe/peru/actualidad/minedu-reporta-1198-casos-de-violencia-sexual-entre-estudiantes-entre-enero-y-agosto-del-2026-noticia-1707961)
63. [Colegio Liceo Naval: Minedu registra más de 2.000 reportes de violencia sexual en escuelas en lo que va del 2026](https://larepublica.pe/sociedad/2026/09/17/colegio-liceo-naval-minedu-registra-mas-de-2000-reportes-de-violencia-sexual-en-escuelas-en-lo-que-va-del-2026-284801)
64. [Violencia escolar: más de 11 mil casos fueron reportados ante el Minedu en lo que va del año](https://rpp.pe/peru/actualidad/violencia-escolar-mas-de-11-mil-casos-fueron-reportados-ante-el-minedu-en-lo-que-va-del-ano-noticia-1708089)
65. [Informe-Defensorial-231-Supervisión-de-la- ...](https://www.defensoria.gob.pe/wp-content/uploads/2025/10/Informe-Defensorial-231-Supervisi%C3%B3n-de-la-implementaci%C3%B3n-del-Modelo-de-Servicio-Educativo-Secundaria-con-Residencia-Estudiantil.pdf)
66. [Violencia sexual, desprotección e impunidad en Condorcanqui: Dan 30 días al Estado para enfrentar una crisis estructural que afecta a niñas awajún y wampis](https://inforegion.pe/violencia-sexual-desproteccion-e-impunidad-en-condorcanqui-dan-30-dias-al-estado-para-enfrentar-una-crisis-estructural-que-afecta-a-ninas-awajun-y-wampis/)
67. [Reportar casos de violencia escolar en la plataforma SíseVe del Minedu - Servicio - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/62013-reportar-casos-de-violencia-escolar-en-la-plataforma-siseve-del-minedu)
68. [Más de mil casos de violencia sexual entre escolares se reportaron hasta agosto](https://www.gacetaperutv.pe/2026/09/mas-de-mil-casos-de-violencia-sexual-entre-escolares-se-reportaron-hasta-agosto.html)
69. [Niñas y niños Awajún: las víctimas de la indiferencia Estatal y la ausencia de recursos - Wayka.pe](https://wayka.pe/ninas-y-ninos-awajun-las-victimas-de-la-indiferencia-estatal-y-la-ausencia-de-recursos/)
70. [Caso Condorcanqui: docentes denunciados de abuso sexual no volverán a ser contratados](https://andina.pe/agencia/noticia-caso-condorcanqui-docentes-denunciados-abuso-sexual-no-volveran-a-ser-contratados-989912.aspx)
71. [1 Plan Multisectorial ante Heladas y Friaje 2019](https://cdn.www.gob.pe/uploads/document/file/292992/Plan_Multisectorial_ante_Heladas_y_Friaje_2019-2021-Anexos.pdf)
72. [1 Plan Multisectorial ante Heladas y Friaje 2022](https://cdn.www.gob.pe/uploads/document/file/3066879/PMHF%202022-2024.pdf.pdf)
73. [Minedu brinda confort térmico a colegios rurales para enfrentar heladas y friaje](https://www.tvperu.gob.pe/noticias/nacionales/minedu-brinda-confort-termico-a-colegios-rurales-para-enfrentar-heladas-y-friaje)
74. [AVANCE FÍSICO Y FINANCIERO DE LAS INTERVENCIONES ESTABLECIDAS EN EL](https://www.defensoria.gob.pe/wp-content/uploads/2024/09/Informe-Defensorial-N.-218.pdf)
75. [CÉDULA 11: LOCAL EDUCATIVO FICHA UNIFICADA DE INFRAESTRUCTURA EDUCATIVA - FUIE](https://escale.minedu.gob.pe/documents/10156/7019133/Manual-FUIE-C%C3%A9dula+11-Local+Educativo+CE2021.pdf)
76. [Guía Rápida](https://cdn.www.gob.pe/uploads/document/file/4332912/Gu%C3%ADa%20R%C3%A1pida%20Censo%20Educativo%202022%20.pdf?v=1680012635)
77. [-22- Domingo 1 de marzo del 2026 ECONOMÍA Costo per cápita de cerrar la brecha](https://ipe.org.pe/wp-content/uploads/2026/03/Informe-IPE-EC-Regreso-a-clases-1.pdf)
78. [Año Escolar 2025: Brecha en infraestructura educativa asciende a S/ 158,832 millones](https://gestion.pe/economia/ano-escolar-2025-brecha-en-infraestructura-educativa-asciende-a-s-158832-millones-colegios-noticia/)
79. [Resolución Ministerial Nº 076-2026-MINEDU](https://actualidadempresarial.pe/normas-legales/resolucion-ministerial-076-2026-minedu/e7d289eb-3269-49db-a102-3f3640b41ac4)
80. [Minedu conectará a internet satelital a 55 000 escuelas públicas - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/1438938-minedu-conectara-a-internet-satelital-a-55-000-escuelas-publicas)
81. [Programa de Mantenimiento de Locales Educativos 2026 - Campañas - Programa Nacional de Infraestructura Educativa - Plataforma del Estado Peruano](https://www.gob.pe/institucion/pronied/campa%C3%B1as/134853-programa-de-mantenimiento-de-locales-educativos-2026)
82. [Minedu destina S/295 millones para mantenimiento de instituciones educativas públicos - Noticias - Programa Nacional de Infraestructura Educativa - Plataforma del Estado Peruano](https://www.gob.pe/institucion/pronied/noticias/1341628-minedu-destina-s-295-millones-para-mantenimiento-de-instituciones-educativas-publicos)
83. [Cusco: Directores rindieron gastos por S/ 16.5 millones en mantenimiento de colegios - Noticias - Programa Nacional de Infraestructura Educativa - Plataforma del Estado Peruano](https://www.gob.pe/institucion/pronied/noticias/201572-cusco-directores-rindieron-gastos-por-s-16-5-millones-en-mantenimiento-de-colegios)
84. [El 60% de infraestructuras educativas verificadas por la Contraloría presentan deficiencias](https://tudiariohuanuco.pe/actualidad/el-60-de-infraestructuras-educativas-verificadas-por-la-contraloria-presentan-deficiencias/)
85. [Crisis educativa en Perú: Defensoría del Pueblo alerta graves fallas en colegios públicos por falta de presupuesto, materiales y docentes - Infobae](https://www.infobae.com/peru/2026/04/29/crisis-educativa-en-peru-defensoria-del-pueblo-alerta-graves-fallas-en-colegios-publicos-por-falta-de-presupuesto-materiales-y-docentes/)
86. [GigaMaps](https://maps.giga.global/about)
87. [School mapping using AI and high-resolution satellite imagery](https://ircai.org/top100/entry/school-mapping-using-ai-and-high-resolution-satellite-imagery/)
88. [El 92.6 % de los colegios públicos tiene servicios de agua, desagüe y energía eléctrica - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/340350-el-92-6-de-los-colegios-publicos-tiene-servicios-de-agua-desague-y-energia-electrica)
89. [Solo el 31.3% de los colegios de Cusco tiene acceso a agua, luz y desagüe en simultáneo - Inforegión](https://inforegion.pe/solo-el-31-3-de-los-colegios-de-cusco-tiene-acceso-a-agua-luz-y-desague-en-simultaneo/)
90. [Acceso a los servicios básicos en los locales ... - ESCALE](https://escale.minedu.gob.pe/c/document_library/get_file?uuid=ad60df4b-47b5-46a6-92e3-f2360548cffa&groupId=10156)
91. [Más de un millón de estudiantes retornarán a colegios con riesgo alto de colapso](https://ipe.org.pe/mas-de-un-millon-de-estudiantes-retornaran-a-colegios-con-riesgo-alto-de-colapso/)
92. [Label-Efficient School Detection from Aerial Imagery via Weakly Supervised Pretraining and Fine-Tuning](https://arxiv.org/pdf/2605.03968)
93. [Presenta tu reclamo - Educación - Indecopi](https://consumidor.gob.pe/presenta-tu-reclamo-educacion/)
94. [Reporte de escuelas](https://www.reportesescuelas.cdmx.gob.mx/)
95. [Reporte - Experiencias RedPaPaz](https://experiencias.redpapaz.org/reporte/)
