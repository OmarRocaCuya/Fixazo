# Educación escolar rural en el Perú: diagnóstico 2022-2026 y cinco problemas accionables con IA para Hack the Andes

El problema más grave y más accionable de la escuela rural peruana es este: un solo docente, a menudo contratado, sin formación multigrado y a veces sin dominio de la lengua de sus alumnos, debe enseñar a varios grados a la vez en escuelas sin internet ni servicios básicos. Por eso, en la ENLA 2024 solo el 17,3 % de los estudiantes rurales de 4.° de primaria alcanzó el nivel Satisfactorio en Lectura, frente al 35,8 % en zonas urbanas (Minedu, vía El Comercio). Recomendamos priorizar un "copiloto multigrado bilingüe" que funcione sin conexión y por WhatsApp. Es el problema con mayor magnitud, mejor viabilidad técnica y mayor facilidad para generar tracción verificable con docentes reales, que es lo que premia la rúbrica del evento.

## TL;DR

- **La brecha es estructural y está anclada en la escuela multigrado.** En 2024 el estrato rural mejoró más que ningún otro en la ENLA de 4.° de primaria: +24 puntos en Lectura y +22 en Matemática.\[1\] Aun así, sigue muy por detrás del urbano, y en 2.° de secundaria rural solo el 7 % logra el nivel Satisfactorio en Lectura y el 4,1 % en Matemática (ENLA 2023). A esto se suma que en 2025 solo el 22 % de los colegios públicos rurales tenía a la vez agua, desagüe y electricidad, menos que el 26 % de 2015 (IPE, con datos del Censo Escolar).
- **Cinco problemas específicos con solución tecnológica plausible:**
  1. El docente unidocente o multigrado sin apoyo para planificar por niveles.
  2. El déficit de docentes que dominen la lengua originaria en las plazas EIB.
  3. El abandono silencioso en la transición a secundaria y durante ella, asociado al trabajo agrícola y al embarazo adolescente.
  4. La violencia sexual impune en residencias estudiantiles amazónicas.
  5. La pérdida de días de clase por heladas y friaje sin sistemas de alerta ni de continuidad.
- **Recomendación:** priorizar el problema 1 e integrar la capa lingüística del problema 2. Advertencia: la guía oficial de Hack the Andes no menciona un track de "Educación Escolar". Sus valores de track son `environmental`, `security` y `transport`, y los *briefs* se revelan en Lima el 17 de octubre.\[2\]\[3\] Verifiquen hoy mismo en qué track se encuadra el proyecto.

## Key Findings

1. **Hubo mejora real tras la pandemia, pero la brecha rural-urbana persiste y se agrava con la lejanía.**
   - Según Minedu-UMC (ENLA 2024), en Lectura de 4.° grado el estrato rural subió 24 puntos, ganó 3,4 puntos porcentuales (pp) en el nivel Satisfactorio y redujo el nivel "Previo al inicio" de 23,6 % a 9,6 %. En Matemática, el nivel más bajo bajó de 36,8 % a 28,7 %.\[1\]\[4\]
   - Dentro de lo rural la gradiente es fuerte. Según un análisis de PIRKA sobre datos de la ENLA, el logro Satisfactorio es de 10,3 % en Rural 1 (centros poblados de hasta 500 habitantes a más de 2 horas de la capital provincial), 15,5 % en Rural 2 y 19,9 % en Rural 3.\[1\]\[5\]
2. **En secundaria y en EIB la situación es crítica.**
   - En PISA 2022, solo el 21,0 % de los estudiantes rurales alcanzó el nivel 2 o superior en Lectura, frente al 55,7 % de los urbanos (Minedu-UMC).\[6\]\[7\]
   - En la ENLA 2023, solo el 18,4 % de los estudiantes EIB de 4.° grado alcanzó lo esperado en Lectura en castellano como segunda lengua; en escuelas de lengua amazónica, solo el 5,6 %.\[8\]\[9\]
3. **La organización escolar rural es mayoritariamente multigrado.**
   - Según la Encuesta Nacional a Instituciones Educativas del INEI (2018), el 46,2 % de las primarias rurales evaluadas eran unidocentes, el 47,9 % polidocentes multigrado y solo el 5,9 % polidocentes completas.\[10\]
   - Entre 2024 y 2025 el Minedu creó 2373 plazas y convirtió 2359 escuelas unidocentes en polidocentes incompletas.\[11\]\[12\] Es un avance, pero el modelo sigue siendo multigrado.
4. **La política docente no atrae ni retiene a docentes calificados donde más se necesitan.**
   - En el concurso de nombramiento 2024 se adjudicaron solo 25 237 de 47 678 plazas ofertadas, el 53 % (Minedu, citado por Gestión y La República).\[13\]\[14\]
   - Solo 6527 aprobados figuraban en el padrón EIB, frente a 14 953 plazas EIB (El Peruano, 2025).\[15\]\[16\]
   - Los bonos rurales (S/ 500 en Rural 1, S/ 100 en Rural 2 y S/ 70 en Rural 3) redujeron la vacancia apenas entre 1,1 y 1,6 pp, según la evaluación de diseño del MEF (2023).\[17\]\[18\]
5. **El entorno condiciona la permanencia escolar.**
   - En zonas rurales, el trabajo infantil alcanzó al 53,1 % de las personas de 5 a 17 años en 2024 y al 51,5 % en 2025 (ComexPerú sobre la ENAHO).
   - En 2024, el 18,3 % de las adolescentes rurales de 15 a 19 años había estado alguna vez embarazada, frente al 6,1 % en zonas urbanas (MCLCP sobre la ENDES 2024).\[19\]
   - En 2024, la anemia afectó al 51,9 % de los niños rurales de 6 a 35 meses (ENDES 2024, criterio anterior).
6. **Desde 2021 la infraestructura digital y física es el cuello de botella de cualquier solución tecnológica.**
   - Según UNICEF, en 2020 apenas el 11 % de las instituciones educativas rurales tenía internet.
   - Según el MTC, el 70,97 % de los centros poblados (el 52,7 % de la población rural) no tiene servicios móviles.
   - **Consecuencia de diseño:** toda solución debe funcionar *offline-first* o por canales de baja banda (SMS, voz, radio).

## Details

### 1. Panorama general

**Advertencia metodológica.** En 2020-2021 el Minedu adoptó la definición de ruralidad del INEI: ahora son rurales los centros poblados de hasta 2000 habitantes, cuando antes el umbral era de 500. Con el cambio, por ejemplo, el porcentaje de estudiantes rurales de Cajamarca pasó de 36,3 % (2019) a 50,2 % (2024). Según la UMC, las tendencias rurales solo son comparables de 2022 en adelante.\[1\]

| Indicador | Dato | Año | Fuente |
|---|---|---|---|
| Locales escolares públicos rurales | 42 648 (frente a 28 282 en 2009) | 2023 | Minedu, vía ComexPerú |
| Secundaria rural: servicios / estudiantes / docentes | 7084 / 627 799 / 67 621 | 2023 | ESCALE, vía Defensoría (Informe 231) |
| Primarias rurales multigrado | 93 % de 22 352 | 2018 | ESCALE, vía UNESCO\[20\] |
| Primaria rural: unidocente / polidocente multigrado / completa | 46,2 % / 47,9 % / 5,9 % | 2018 | INEI-ENEI\[10\] |
| Instituciones EIB | ≈24 000 | 2024 | IPS (declaración de especialista)\[9\] |
| Docentes de EB pública contratados | 49 % (203 780) | 2022 | Censo Educativo 2022, Minedu\[21\] |

**Vacíos de información:**
- No se halló una cifra pública, verificable y desagregada para 2024-2025 sobre la matrícula rural total por nivel.
- Tampoco se halló el porcentaje de docentes contratados solo en el ámbito rural. La cifra rural más reciente es de 2018 (INEI-ENEI): en inicial rural, el 74,5 % de los docentes eran contratados, frente al 53,0 % en urbano.\[10\]
- **Recomendación:** descargar directamente las tablas de "Magnitudes" de ESCALE para el año 2025.

### 2. Acceso, cobertura y trayectoria

**Primaria.** El acceso está prácticamente universalizado: la matrícula primaria fue de 98,6 % en 2023, con diferencias mínimas por área (GRADE, 2024, sobre la ENAHO).\[22\]

**Secundaria.** El problema está en terminar a tiempo.
- La tasa neta de matrícula de 12 a 16 años fue de 89,1 % en el área rural, frente a 90,5 % a nivel nacional (2023).\[23\]
- La conclusión oportuna de secundaria fue de 73,2 % en zonas rurales frente a 83,5 % en urbanas, y de 75,1 % entre estudiantes de lengua indígena frente a 82,2 % entre castellanohablantes. Unos 217 000 estudiantes no terminan a la edad esperada (GRADE, 2024).\[22\]
- La deserción acumulada de 13 a 19 años fue de 5,5 % en el área rural y de 4,7 % a nivel nacional (Defensoría, 2025).\[23\]
- La deserción interanual en secundaria subió a 2,5 % en 2023-2024, 0,9 pp más que el periodo anterior (CEPLAN).\[24\]

**Concentración geográfica y género.**
- De los 20 distritos con mayor deserción histórica entre 2014 y 2023, 14 están en Loreto (GRADE, 2024).\[22\]
- En Amazonas, Cusco, Puno y Piura, ser mujer multiplica por 1,2 la probabilidad de abandono (Sempé, 2023, citado por OBEPE).\[25\]

**Reinserción.** En 2023 solo existían 124 CEBA en áreas rurales (GRADE, 2024). Es una capacidad muy inferior a la demanda potencial.\[22\]

**Secundaria con Residencia Estudiantil (MSE-SRE).** La Defensoría supervisó en 2024 los 79 colegios del modelo, con 5760 residentes, 13 008 no residentes y 1239 docentes, concentrados en Loreto (36) y Amazonas (26).\[23\]
- El traslado desde la capital de distrito tarda entre 2 y 72 horas.\[23\]
- 51 residencias no tienen agua potable y 57 no tienen desagüe.\[23\]
- Hay dormitorios con hasta 50 estudiantes.\[23\]
- En 2024 abandonaron 683 estudiantes, en su mayoría mujeres e indígenas (Informe Defensorial 231, 2025).\[23\]

### 3. Calidad y aprendizajes

| Evaluación | Rural | Urbano / nacional | Año | Fuente |
|---|---|---|---|---|
| ENLA 4.° primaria, Lectura, Satisfactorio | 17,3 % (13,9 % en 2023; +3,4 pp) | 35,8 % urbano; 32,8 % nacional | 2024 | El Comercio y RCR Perú (sobre ENLA 2024 del Minedu); Minedu-UMC |
| ENLA 4.° primaria, Lectura, "Previo al inicio" | 9,6 % (antes 23,6 %) | — | 2024 | Minedu-UMC\[1\] |
| ENLA 4.° primaria, Matemática, nivel más bajo | 28,7 % (antes 36,8 %) | 29,5 % Satisfactorio nacional | 2024 | Minedu / El Peruano\[1\]\[4\] |
| ENLA 2.° secundaria, Satisfactorio (Lectura / Matemática) | 7 % / 4,1 % | — | 2023 | Defensoría (sobre ENLA) |
| EIB 4.° primaria, Lectura en castellano como segunda lengua, Satisfactorio | 18,4 % general; 5,6 % en escuelas amazónicas | — | 2023 | Minedu-UMC\[8\] |
| PISA, Lectura, nivel 2 o superior | 21,0 % | 55,7 % | 2022 | Minedu-UMC\[6\] |
| PISA, Matemática, debajo del nivel 2 | 89 % | 66,2 % nacional | 2022 | Defensoría\[26\] |

**Interpretación.**
- El rebote de 2024 se concentró en reducir los niveles más bajos, no en llevar estudiantes al nivel Satisfactorio. En 6.° grado, la ENLA 2024 no mostró cambios significativos en el estrato rural entre 2022 y 2024.\[1\]
- La recuperación pospandemia es frágil, y la brecha se amplía con la edad: desde 2.° de secundaria, menos de 1 de cada 10 estudiantes rurales alcanza el nivel esperado.

### 4. Docentes

**Contratación.** El 49 % de los docentes de EB pública eran contratados en 2022 (Censo Educativo).\[21\]

**Concurso de nombramiento 2024.**
- Superaron la Prueba Nacional 63 978 postulantes, el 28,7 % de los evaluados (Minedu).\[27\]
- Se adjudicó solo el 53 % de las plazas (25 237 de 47 678). Loreto, que había ofertado más de 7000 plazas, adjudicó 1844 (La República, 2025).\[13\]\[28\]

**Brecha EIB.** Hubo 14 953 plazas EIB frente a 6527 aprobados del padrón EIB:\[16\] el sistema no produce suficientes docentes bilingües calificados.

**Asignaciones por condiciones especiales.**
- Montos mensuales: Rural 1, S/ 500; Rural 2, S/ 100; Rural 3, S/ 70; VRAEM, S/ 300; frontera, S/ 100; unidocente, S/ 200; multigrado, S/ 140; bilingüe, S/ 50.\[29\]\[30\]\[31\]\[32\]
- Beneficiarios: 199 346 docentes y auxiliares en 2024; para 2026 se presupuestan S/ 813 millones para más de 200 000 personas (Minedu).\[32\]\[33\]\[34\]

**Evidencia sobre incentivos.**
- Bobba et al. (NBER WP 29068) usaron una regresión discontinua en el umbral rural. Encontraron que mayores salarios atraen a docentes con 0,45 desviaciones estándar (DE) más en la prueba nacional y elevan el logro estudiantil en 0,3 DE en matemáticas y 0,35 DE en lenguaje, en escuelas que tenían plazas vacantes.\[35\]
- Los autores concluyen que el esquema actual es "en parte efectivo" pero ineficiente.\[35\]
- Rotación y concentración de docentes de menor escala: la UNESCO documenta "alta rotación" de docentes rurales. Según el DS 013-2018-MINEDU, solo el 3 % de los nombrados en Rural 1 está en la escala 4 o superior, frente al 16 % en zona urbana.\[20\]\[36\]

### 5. Infraestructura y servicios

**Servicios básicos en los locales escolares.**
- En 2023 solo el 16,4 % de los locales públicos rurales tenía los tres servicios básicos (agua, desagüe y electricidad), frente al 79,4 % de los urbanos (ComexPerú).\[37\]
- Según el IPE, con datos del Censo Escolar del Minedu, en 2025 solo el 22 % de los colegios públicos rurales tenía los tres servicios, por debajo del 26 % de 2015 y cuatro veces menos que en el área urbana.
- Según el PNIE citado por la Defensoría, el 85,9 % de los locales rurales tiene acceso inadecuado a agua y saneamiento, frente al 28,3 % de los urbanos.\[23\]

**Conectividad.**
- En 2020, el 11 % de las instituciones educativas rurales tenía internet (UNICEF).\[38\]
- En el II trimestre de 2024, el 55,8 % de la población rural usó internet, casi siempre por celular (INEI).\[39\]

**Dispositivos.**
- En una primera etapa (2020-2021) se distribuyeron 1 056 430 tabletas a 966 293 estudiantes y 90 137 docentes de 27 837 colegios; 494 720 incluían plan de datos y 203 080 cargador solar (ministro Ricardo Cuenca ante la Comisión de Educación del Congreso, vía El Comercio). En 2022 se repartió un segundo lote de 319 492 tabletas y 39 887 cargadores solares para 279 712 estudiantes y 39 780 docentes de 16 208 instituciones (Minedu).
- La Contraloría encontró en 2021 que el 39,77 % de 4649 estudiantes encuestados no usaba las tabletas para Aprendo en Casa.\[40\]
- En Piura, el 90 % de la memoria de las tabletas estaba ocupado por contenido no educativo (Minedu).\[41\]

**Alimentación escolar.** En 2025, Wasi Mikuna reemplazó a Qali Warma, con una meta de 4,2 millones de estudiantes en 67 575 instituciones educativas.\[42\] Persisten incidentes: en noviembre de 2025, 16 escolares resultaron intoxicados en Huánuco (Infobae).\[43\]

**Nutrición.**
- La desnutrición crónica en menores de 5 años fue de 12,1 % a nivel nacional (ENDES 2024).\[44\]
- En 2022 la brecha rural-urbana era de 23,9 % frente a 7,1% (INEI, citado en el informe PISA de la UMC).\[45\]

### 6. Contexto climático

- Según el escenario de riesgo del Minedu, 664 locales escolares (46 255 estudiantes y 3554 docentes) están en riesgo "Muy alto" por heladas, y 933 locales (82 467 estudiantes y 5252 docentes) por friaje.\[46\]
- La respuesta es mínima frente a esa escala. En 2025 el Pronied terminó obras de confort térmico en 9 instituciones (204 estudiantes) con S/ 1,536 millones, y tenía otras 6 en ejecución (169 estudiantes).\[47\]
- **Inferencia propia:** a unos S/ 7500 por estudiante, cubrir a los aproximadamente 129 000 estudiantes en riesgo muy alto costaría cerca de S/ 970 millones.

### 7. Gestión y financiamiento

- El gasto público por alumno fue de S/ 3635 en primaria y S/ 5015 en secundaria en 2022, con gran dispersión regional (Minedu).\[48\]\[49\]
- No existe una serie pública de gasto por alumno rural. Esto impide evaluar la equidad del financiamiento: es en sí misma una brecha de gestión.
- La gestión local muestra debilidades críticas. La Defensoría documenta que las UGEL omiten el monitoreo del MSE-SRE. En Condorcanqui, de 536 expedientes por violencia sexual abiertos entre 2010 y 2024, 198 prescribieron y solo 113 terminaron en destitución.\[23\]

### 8. Dimensión socioemocional y de contexto

**Trabajo infantil.**
- Afecta a la mitad de los niños y adolescentes rurales. Las tasas departamentales más altas en 2025 fueron Huancavelica (53 %), Huánuco (52,5 %) y Apurímac (50,5 %) (ComexPerú).\[50\]
- En secundaria, los adolescentes que trabajan 36 horas o más a la semana faltan cinco veces más a clase (MTPE, 2023, citado por CISEPA).\[51\]

**Embarazo adolescente.** En el área rural subió de 17,1 % a 18,3 % entre 2023 y 2024 (MCLCP).\[19\]

**Diferencias de género en las causas del abandono.** Según GRADE (2024), los hombres abandonan sobre todo por presiones económicas, y las mujeres por embarazo y responsabilidades familiares.\[22\]

**Violencia.** En las residencias estudiantiles, 29 de las 37 víctimas de violencia sexual reportadas eran residentes (Defensoría, 2025).\[23\]

### 9. Políticas e intervenciones: qué funciona y qué no

| Intervención | Evidencia | Juicio |
|---|---|---|
| Conversión de escuelas unidocentes (2024-2025) | 2373 plazas; formación de 4773 docentes multigrado\[12\] | Necesaria; aún sin evaluación de impacto |
| Asignaciones rurales | Efecto de 1,1 a 1,6 pp en vacancia (MEF); efectos en aprendizaje si cubren vacantes (Bobba et al.)\[17\]\[35\] | Mal calibradas: la diferencia entre S/ 500 y S/ 100 es abrupta |
| Tabletas y Aprendo en Casa | 39,77 % de no uso (Contraloría) | Sin acompañamiento pedagógico, el *hardware* no basta |
| MSE-SRE | Fallas graves de infraestructura y protección (Defensoría) | El diseño es correcto; la implementación falla |
| Juntos | Factor protector contra el abandono (MEF, 2017, citado por GRADE)\[22\] | Útil, pero no cubre costos indirectos |
| Qali Warma / Wasi Mikuna | Reestructuración por denuncias; incidentes en 2025 | Gobernanza frágil |
| Tutor con IA generativa, Nigeria (Banco Mundial) | +0,31 DE en 6 semanas; US$ 48 por estudiante; supera al 80 % de las intervenciones evaluadas\[52\]\[53\] | El referente más fuerte para IA educativa, aunque con docente presente y laboratorio conectado |

**Referentes comparables.** Escuela Nueva (Colombia) institucionalizó guías autoinstructivas para el aula multigrado. La Telesecundaria (México) resolvió la oferta secundaria dispersa con medios. El Banco Mundial documenta experiencias de tutoría matemática por WhatsApp en Ghana. Estos modelos validan las tres palancas que proponemos: material autoinstructivo diferenciado, canales de baja banda y docente como facilitador.

### 10. Oportunidades tecnológicas y riesgos

**Voz en lenguas originarias.** Omnilingual ASR de Meta (noviembre de 2025):
- Es de código abierto y cubre más de 1600 idiomas, 500 de ellos nunca antes soportados por un sistema de reconocimiento de voz.\[54\]
- Ofrece modelos de 300 millones a 7000 millones de parámetros; el de 7000 millones logra un error de caracteres menor al 10 % en el 78 % de los idiomas.\[54\]\[55\]
- Puede extenderse a lenguas nuevas con pocos ejemplos.\[56\]
- Existen además corpus de quechua (Siminchik) y tareas de traducción quechua-español en IWSLT y AmericasNLP.\[57\]
- **Implicación:** el reconocimiento de voz y la lectura asistida en quechua o aimara son viables hoy. En awajún o asháninka requieren datos que la comunidad debe recolectar.

**Modelos pequeños sin conexión.** Los modelos compactos de reconocimiento de voz y los LLM cuantizados permiten tutores en tabletas existentes o en un servidor local por escuela con energía solar. Esto aprovecha el parque de aproximadamente 1,38 millones de tabletas entregadas (1 056 430 en 2020-2021 y 319 492 en 2022, según el Minedu).

**Canales.** El 55,8 % de la población rural usa internet, sobre todo por celular. WhatsApp, IVR (respuesta de voz interactiva por teléfono) y radio son canales realistas para llegar a las familias. Para el docente, el canal viable es la sincronización diferida, cuando baja a la capital de distrito.

**Riesgos.**
- Sesgo y errores en lenguas de pocos recursos.
- Extracción de datos lingüísticos sin consentimiento comunitario. La soberanía de datos indígenas es un riesgo ético y legal (Ley 29733 de protección de datos personales).
- Sustitución del docente en lugar de apoyo, y alucinaciones en contenido curricular.
- Exposición de menores. En el problema 4, la confidencialidad es una condición de seguridad de las víctimas, no un detalle.

## Recommendations: cinco problemas específicos

### Problema 1. El docente unidocente o multigrado no tiene cómo planificar y enseñar por niveles a varios grados a la vez

- **(i) Evidencia.**
  - El 46,2 % de las primarias rurales eran unidocentes en 2018.\[10\]
  - En Rural 1, solo el 10,3 % alcanza el nivel Satisfactorio en Lectura.\[5\]
  - En 2024-2025 se formó a 4773 docentes en estrategias multigrado,\[58\] una fracción de los que enseñan en estas escuelas.
- **(ii) Población.** Unos 300 000 estudiantes en más de 12 000 instituciones multigrado o unidocentes castellanohablantes (dato de 2018, GRADE-CREER), además de las EIB.\[59\] Se concentran en Cajamarca, Amazonas, Loreto, Puno, Cusco y Huánuco.
- **(iii) Causas raíz.**
  - La formación inicial está pensada para el aula monogrado.
  - El acompañamiento es escaso y presencial.
  - El currículo y los materiales están organizados por grado.
  - El docente es a la vez director y gestor administrativo.
- **(iv) Por qué fallan las soluciones actuales.** La conversión a polidocencia es lenta y costosa. La formación es episódica. Las tabletas entregaron contenido, no apoyo para planificar ni para diagnosticar.
- **(v) Solución disruptiva: "Copiloto Multigrado".**
  - Corre sin conexión en la tableta del docente.
  - El docente dicta por voz qué hizo cada estudiante, o fotografía cuadernos y fichas. Un modelo de visión y lenguaje estima el nivel de cada niño por competencia del CNEB (Currículo Nacional de Educación Básica).
  - El copiloto genera una sesión diaria con grupos según el nivel real, no según el grado: un tema común con actividades diferenciadas al estilo de Teaching at the Right Level y Escuela Nueva.
  - Produce fichas autoinstructivas imprimibles o audios para los grupos que trabajan solos mientras el docente atiende a otro.
  - Sincroniza con la UGEL al conectarse, lo que genera un mapa de aprendizajes por red educativa rural.
- **(vi) Medición e impacto.**
  - Indicadores: tiempo de planificación ahorrado, proporción de la clase con instrucción diferenciada (observación) y prueba corta de fluidez lectora al inicio y a los 3 meses frente a un grupo control.
  - Barreras: batería y energía (usar cargadores solares existentes), confianza del docente y carga de registro.
  - Costo marginal bajo, porque reutiliza las tabletas.
  - Riesgo: contenido incorrecto. Mitigación: biblioteca curada de actividades validadas y generación restringida a ella.
- **(vii) Referentes.** Escuela Nueva (Colombia), Teaching at the Right Level (India y África) y el tutor con IA del Banco Mundial en Nigeria (+0,31 DE).

### Problema 2. Las plazas EIB se cubren con docentes que no dominan la lengua de sus estudiantes

- **(i) Evidencia.**
  - En el concurso 2024 hubo 14 953 plazas EIB y solo 6527 aprobados del padrón EIB.\[16\]
  - En las escuelas amazónicas, solo el 5,6 % de los estudiantes alcanza el nivel Satisfactorio en Lectura en castellano como segunda lengua.\[9\]
  - Según la especialista Elena Burga, docentes contratados "porque hablen quechua, shipibo, asháninka" terminan enseñando en castellano (IPS, 2024).\[9\]
- **(ii) Población.** Estudiantes de unas 24 000 instituciones EIB,\[9\] especialmente en Loreto, Amazonas (awajún), Ucayali, Junín (asháninka), Puno y Cusco.
- **(iii) Causas raíz.**
  - Escasa formación inicial EIB.
  - Lenguas sin materiales en todas las áreas y grados.\[60\]
  - Diversidad dialectal.
  - La asignación de S/ 50 es irrelevante como incentivo.
- **(iv) Por qué fallan las soluciones actuales.** El Registro Nacional de Docentes Bilingües certifica, pero no forma a escala. Los materiales impresos no cubren todos los grados ni todas las variantes.
- **(v) Solución disruptiva: "Yachay Voz".**
  - Combina reconocimiento de voz en lenguas originarias (Omnilingual ASR afinado con grabaciones de la comunidad) con síntesis de voz.
  - Funciones: escucha leer al niño en su lengua y en castellano, mide la fluidez y da retroalimentación oral.
  - Genera cuentos decodificables en la variante local a partir de narraciones grabadas por los sabios de la comunidad.
  - Ofrece al docente no hablante traducción y pronunciación inmediata para conducir la clase.
  - Gobernanza: un corpus bajo licencia comunitaria, con las organizaciones indígenas como copropietarias de los datos.
- **(vi) Medición e impacto.**
  - Indicadores: error de caracteres por variante, palabras correctas por minuto en lengua originaria y en castellano, y uso de la lengua originaria en clase (observación).
  - Barreras: escasez de datos en awajún y asháninka, y legitimidad cultural.
  - Riesgo principal: normalizar una variante sobre otras y extraer datos sin consentimiento.
- **(vii) Referentes.** Proyectos comunitarios de procesamiento de lenguaje para el quechua de Puno; las tareas AmericasNLP e IWSLT de quechua-español.

### Problema 3. El abandono silencioso en la transición a secundaria y durante ella, ligado al calendario agrícola, el trabajo infantil y el embarazo

- **(i) Evidencia.**
  - Conclusión oportuna de secundaria de 73,2 % en zonas rurales frente a 83,5 % en urbanas.
  - Trabajo infantil rural de 53,1 % (2024).\[61\]
  - Embarazo adolescente rural de 18,3 % (2024).\[19\]
  - 14 de los 20 distritos con mayor deserción están en Loreto.\[22\]
- **(ii) Población.** Adolescentes de 12 a 17 años en la selva y la sierra central. Las adolescentes rurales concentran el mayor riesgo.\[62\]
- **(iii) Causas raíz.**
  - Distancia a la escuela secundaria.
  - Costo de oportunidad del trabajo agrícola.\[63\]
  - Atraso escolar acumulado.
  - Normas de género.
  - Falta de un sistema de alerta temprana y de una política integral de retención (GRADE, 2024).\[22\]
- **(iv) Por qué fallan las soluciones actuales.** Juntos condiciona la asistencia, pero no detecta el riesgo a tiempo. Los CEBA rurales (124) llegan tarde. Las alertas que existen dependen de reportes manuales.
- **(v) Solución disruptiva: "Sentinela".**
  - Modelo predictivo de riesgo de abandono que cruza la asistencia y las notas del SIAGIE con el calendario agrícola local, estimado con datos satelitales de fenología de cultivos (Sentinel-2).
  - Envía al tutor y a la familia alertas por IVR y WhatsApp en la lengua local.
  - Activa trayectorias flexibles: módulos de recuperación por audio en los meses de cosecha y reconocimiento de aprendizajes para no perder el año.
- **(vi) Medición e impacto.**
  - Precisión y equidad del modelo por sexo y pueblo.
  - Reducción de la deserción interanual en distritos piloto frente a sus pares.
  - Barreras: acceso a datos del SIAGIE (requiere convenio con el Minedu) y estigmatización por el puntaje.
  - Riesgo: usar la predicción para sancionar. El modelo debe activar apoyo, nunca exclusión.
- **(vii) Referentes.** Sistemas de alerta temprana en Europa y EE. UU. (De Witte et al., 2013, citado por GRADE);\[22\] el Sistema de Alerta Temprana de Guatemala y Chile (referencia general).

### Problema 4. La violencia sexual contra estudiantes de residencias y escuelas amazónicas queda impune por diseño institucional

- **(i) Evidencia.**
  - En Condorcanqui hubo 536 expedientes entre 2010 y 2024; 198 prescribieron.
  - 29 de las 37 víctimas reportadas en el MSE-SRE eran residentes.
  - Hay dormitorios de hasta 50 estudiantes (Defensoría, 2025).
- **(ii) Población.** Unos 5760 residentes y 13 008 no residentes del MSE-SRE, principalmente awajún y wampis en Amazonas, y estudiantes de Loreto.
- **(iii) Causas raíz.**
  - Barreras lingüísticas para denunciar.
  - Distancia a la justicia.
  - UGEL sin capacidad para procesar los expedientes antes de que prescriban.
  - Cultura de impunidad.
- **(iv) Por qué fallan las soluciones actuales.** El portal SíseVe exige alfabetización digital y en castellano. Los procesos disciplinarios no tienen alertas de plazo.
- **(v) Solución disruptiva: "Kanus".**
  - Canal de denuncia por voz en awajún o castellano, con un botón físico o un número de teléfono gratuito que no deja rastro en el dispositivo.
  - Un asistente de IA transcribe y traduce la denuncia y la deriva a un humano capacitado.
  - Un tablero de gestión de casos para la UGEL y la Defensoría con semáforos de prescripción y trazabilidad.
- **(vi) Medición e impacto.**
  - Indicadores: casos que prescriben (meta: cero), tiempo hasta la separación preventiva del agresor y casos atendidos con apoyo psicológico.
  - Riesgos muy altos: represalias, falsos positivos y filtración de datos. Requiere alianza con la Defensoría y protocolos de protección de datos.
  - Por ética, el prototipo de la hackathon debe usar solo datos simulados.
- **(vii) Referentes.** Líneas de ayuda infantil de voz, como Child Helpline International, y sistemas de gestión de casos con plazos legales.

### Problema 5. Heladas y friaje interrumpen las clases sin alerta anticipada ni plan de continuidad, y la inversión térmica no se prioriza con datos

- **(i) Evidencia.**
  - 46 255 estudiantes están en riesgo muy alto por heladas y 82 467 por friaje.
  - En 2025 el Pronied terminó obras de confort térmico para solo 204 estudiantes.
  - La anemia rural (51,9 %) agrava la vulnerabilidad al frío.
- **(ii) Población.** La sierra alta (Puno, Cusco, Huancavelica, Pasco y Junín) por heladas, y la selva (Ucayali, Madre de Dios y Loreto) por friaje.
- **(iii) Causas raíz.**
  - Locales sin aislamiento ni servicios.
  - Alertas del Senamhi que no se traducen en decisiones escolares.
  - Inversión dispersa, que no se prioriza por costo-efectividad.
- **(iv) Por qué fallan las soluciones actuales.** Los planes multisectoriales son reactivos. Los módulos prefabricados llegan a pocas escuelas.
- **(v) Solución disruptiva: "Wayra".**
  - Sensores IoT de temperatura de bajo costo, conectados por LoRaWAN, en aulas centinela.
  - Pronóstico local combinado con datos del Senamhi.
  - Alertas por SMS y radio comunitaria para ajustar horarios.
  - Paquetes de continuidad por audio y radio.
  - Un optimizador geoespacial que ordena qué locales intervenir primero para maximizar los estudiante-días protegidos por sol invertido.
- **(vi) Medición e impacto.**
  - Indicadores: días de clase perdidos, temperatura en el aula frente a la exterior y costo por estudiante-día protegido.
  - Barreras: mantenimiento de sensores y cobertura LoRa.
  - Costo bajo por escuela centinela.
- **(vii) Referentes.** Iniciativas de escuelas bioclimáticas en los Andes y sistemas de alerta temprana climática con radio comunitaria.

## Matriz comparativa

Escala del 1 (bajo) al 5 (alto). La columna de alineación con el track se puntúa frente a la rúbrica real del evento: tracción 30 %, esfuerzo técnico 40 % y *pitch* 30 %.\[2\]

| Criterio | P1 Copiloto Multigrado | P2 Yachay Voz (EIB) | P3 Sentinela (abandono) | P4 Kanus (violencia) | P5 Wayra (clima) |
|---|---|---|---|---|---|
| Magnitud | 5 | 4 | 4 | 3 | 3 |
| Urgencia | 4 | 5 | 4 | 5 | 3 |
| Viabilidad técnica con IA hoy | 5 | 3 | 3 | 4 | 4 |
| Originalidad | 4 | 5 | 4 | 4 | 4 |
| Potencial de escala | 5 | 4 | 4 | 2 | 3 |
| Tracción demostrable en 30 h | 5 | 3 | 2 | 1 | 2 |
| Alineación con la rúbrica | 5 | 4 | 3 | 2 | 3 (encaja en `environmental`) |
| **Total (sobre 35)** | **33** | **28** | **24** | **21** | **22** |

**Recomendación.** Prioricen el **Problema 1** y añadan la capa de voz bilingüe del **Problema 2** como diferenciador: un copiloto multigrado que también escucha y habla quechua.

- **Tracción:** es el único problema en el que pueden conseguir evidencia verificable de usuarios en horas, contactando por WhatsApp a docentes rurales reales (redes de UGEL, Enseña Perú, Fe y Alegría 48) para probar el flujo principal.
- **Esfuerzo técnico:** permite demostrar ingeniería sólida: funcionamiento sin conexión, visión sobre cuadernos, generación restringida al currículo y sincronización diferida.
- **Pitch:** la cifra de 10,3 % en Rural 1 y la imagen de un docente con seis grados a la vez se entienden en tres minutos.
- **Si el track asignado resulta ser `environmental`:** el Problema 5 es la alternativa natural.

## Caveats

- **Track del evento.** La guía revisada no menciona un track de Educación Escolar. Los tracks se revelan en Lima, y la CLI acepta solo `environmental`, `security` y `transport`.\[2\]\[3\] Confirmen con la organización antes de comprometer el alcance.
- **Comparabilidad rural.** Por el cambio de definición de 2021, las comparaciones rurales anteriores a 2022 están sesgadas.\[1\]
- **Fuentes secundarias.** Varias cifras provienen de fuentes secundarias que citan datos oficiales: ComexPerú, IPE, PIRKA, prensa y MCLCP.
  - La cifra rural de logro Satisfactorio de la ENLA 2024 (17,3 % frente a 35,8 % urbano) proviene de El Comercio y RCR Perú, que citan al Minedu, y la gradiente Rural 1-3 viene de PIRKA; ninguna se verificó directamente en un cuadro de la UMC.
  - Las de embarazo adolescente provienen de la MCLCP, no del cuadro primario del INEI.
- **Datos antiguos.** Las cifras de multigrado y de docentes contratados en el ámbito rural son de 2018. No se encontró desagregación oficial pública para 2024-2025.
- **Concurso 2024.** Las cifras de adjudicación provienen de prensa que cita al Minedu, y el número de plazas varía entre 48 083 y 47 678 según la fecha.\[14\]\[15\]
- **Estimación propia.** El costo de cubrir a todos los estudiantes en riesgo térmico es una extrapolación propia, no una cifra oficial.
- **Validez externa del estudio de Nigeria.** Se trató de una tutoría extraescolar con docente y laboratorio conectado. Los resultados no se transfieren automáticamente a escuelas rurales peruanas sin conexión.

## Sources

1. <http://umc.minedu.gob.pe/wp-content/uploads/2025/04/Presentaci%C3%B3n-de-logros-de-aprendizaje-ENLA-2024.pdf>
2. [Hack the Andes — Lima, 17–18 oct 2026](https://hacktheandes.com/guide)
3. [Hack the Andes — Lima, 17–18 oct 2026](https://hacktheandes.com/)
4. [Evaluación de aprendizaje 2024: escolares de primaria registran avances en matemáticas y lectura](https://elperuano.pe/noticia/267874-evaluacion-de-aprendizaje-2024-escolares-de-primaria-registran-avances-en-matematicas-y-lectura)
5. [Brechas de aprendizaje urbano rural en Perú - PIRKA Consultoría](https://pirka.pe/brechas-de-aprendizaje-urbano-rural-en-peru/)
6. [Características de PISA 2022](https://www3.congreso.gob.pe/Docs/comisiones2021/CESIP-OCDE/files/pisa_minedu.pdf)
7. [Perú: Última prueba PISA expone las marcadas desigualdades de la educación en el Perú - Leer y Difundir](https://www.leerydifundir.com/2024/01/peru-ultima-prueba-pisa-expone-las-marcadas-desigualdades-la-educacion-peru/)
8. [Resumen ejecutivo de resultados - ENLA 2023](http://umc.minedu.gob.pe/wp-content/uploads/2024/06/Resumen_ejecutivo_ENLA_2023.pdf)
9. [Aprendizaje de mayoría de escolares indígenas se hunde en Perú : IPS Agencia de Noticias](https://ipsnoticias.net/2024/09/aprendizaje-de-mayoria-de-escolares-indigenas-se-hunde-en-peru/)
10. [2\. INFORMACIÓN GENERAL DE LAS INSTITUCIONES EDUCATIVAS INFORMACIÓN GENERAL DE](https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1684/cap02.pdf)
11. [Gobierno fortalece educación rural: Más de 2300 nuevas plazas docentes convierten escuelas unidocentes en polidocentes - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/1209569-gobierno-fortalece-educacion-rural-mas-de-2300-nuevas-plazas-docentes-convierten-escuelas-unidocentes-en-polidocentes)
12. [Minedu crea 2373 plazas docentes en zonas rurales y capacita a más de 4700 maestros](https://actualidad.educacionenred.pe/2025/07/minedu-crea-2373-plazas-docentes-zonas-rurales-capacita-mas-4700-maestros-325353.html)
13. [Nombramiento docente: solo el 53% de plazas dispuestas por el Minedu se adjudicaron](https://larepublica.pe/sociedad/2025/01/29/nombramiento-docente-solo-el-53-de-plazas-dispuestas-por-el-minedu-se-adjudicaron-hnews-1200513)
14. [Resultados de docentes que ganaron plazas en CPM del Minedu: aquí el link oficial](https://gestion.pe/peru/resultados-de-docentes-que-ganaron-plazas-en-cpm-del-minedu-aqui-el-link-oficial-carrera-publica-magisterial-noticia/)
15. [Minedu adjudicará 48 083 plazas docentes en todo el país](https://www.elperuano.pe/noticia/261606-minedu-adjudicara-48-083-plazas-docentes-en-todo-el-pais)
16. [Nombramiento docente: Minedu asignará más de 40,000 plazas en Carrera Pública Magisterial en 2025](https://larepublica.pe/sociedad/2025/01/07/nombramiento-docente-minedu-asignara-mas-de-40000-plazas-en-carrera-publica-magisterial-en-2025-405797)
17. [EVALUACIÓN DE DISEÑO DE LOS INCENTIVOS DE LA ...](https://www.mef.gob.pe/contenidos/presu_publ/anexos/Informe_Final_EDIS_Reforma_Magisterial.pdf)
18. [Minedu publica padrones que habilitan pago de asignaciones para docentes y auxiliares de educación - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/719989-minedu-publica-padrones-que-habilitan-pago-de-asignaciones-para-docentes-y-auxiliares-de-educacion)
19. [PERÚ: Prevención del Embarazo y Maternidad en Niñas y ...](https://intranet.mesadeconcertacion.org.pe/storage/documentos/2025-09-26/embarazo-y-maternidad-en-ninas-y-adolescentes.pdf)
20. [Ruralidad y educación en el Perú: ruralidad y lejanía en el Perú](https://unesdoc.unesco.org/ark:/48223/pf0000374789)
21. [RESULTADOS DEL CENSO EDUCATIVO 2022 EDUCATIVO](https://escale.minedu.gob.pe/documents/10156/9345030/PPT_Censo_Educativo_2023_final.pdf)
22. [Interrupción escolar y vulnerabilidad educativa en el Perú](https://www.grade.org.pe/wp-content/uploads/GRADEAP73.pdf)
23. [LA ACCIÓN ESTATAL PARA GARANTIZAR UNA EDUCACIÓN DE CALIDAD](https://www.defensoria.gob.pe/wp-content/uploads/2025/10/Informe-Defensorial-231-Supervisi%C3%B3n-de-la-implementaci%C3%B3n-del-Modelo-de-Servicio-Educativo-Secundaria-con-Residencia-Estudiantil.pdf)
24. [Observatorio Nacional de Prospectiva](https://observatorio.ceplan.gob.pe/ficha/t87)
25. [Documento de Posición 02 de la Mesa de Trabajo “Nuevas Perspectivas sobre la Problemática de Deserción Escolar de las y los Adolescentes Peruanos” - Observatorio de la Educación Peruana](https://obepe.org/general/documento-de-posicion-02-de-la-mesa-de-trabajo-nuevas-perspectivas-sobre-la-problematica-de-desercion-escolar-de-las-y-los-adolescentes-peruanos/)
26. [Oficina de Comunicaciones e Imagen Institucional](https://www.defensoria.gob.pe/wp-content/uploads/2023/12/NP-672-2023-Resultados-de-PISA-2022-Per%C3%BA-12-12-2023.pdf)
27. [Minedu publica resultados finales de la prueba nacional del Concurso de Ingreso a la Carrera Pública Magisterial - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/1029854-minedu-publica-resultados-finales-de-la-prueba-nacional-del-concurso-de-ingreso-a-la-carrera-publica-magisterial)
28. [Nombramiento docente 2024: aprobaron 45.780 docentes, pero no cubrirán todas las plazas del concurso](https://larepublica.pe/sociedad/2024/12/24/nombramiento-aprobaron-45780-docentes-pero-no-cubriran-todas-las-plazas-del-concurso-2207356)
29. [Nuevo sueldo docente 2026: Los montos que ganan los maestros de la CPM y profesores contratados - Infobae](https://www.infobae.com/peru/2026/01/02/nuevo-sueldo-docente-2026-esto-es-lo-que-ganaran-los-maestros-de-la-cpm-y-profesores-contratados/)
30. [MINEDU: desde marzo pagarán asignaciones a docentes y auxiliares en zona rural, frontera y el VRAEM](https://actualidad.educacionenred.pe/2025/02/minedu-desde-marzo-pagaran-asignaciones-docentes-auxiliares-zona-rural-frontera-316417.html)
31. [Reforma Magisterial - Docentes Nombrados](https://www.minedu.gob.pe/reforma-magisterial/docentes-nombrados.php)
32. [Minedu destina S/813 millones para pagar bonificaciones a 200 000 docentes en zonas rurales - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/1341796-minedu-destina-s-813-millones-para-pagar-bonificaciones-a-200-000-docentes-en-zonas-rurales)
33. [En marzo pagarán asignaciones a docentes y auxiliares que laboran en zona rural, frontera y el VRAEM, o en escuelas unidocente - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/1108149-en-marzo-pagaran-asignaciones-a-docentes-y-auxiliares-que-laboran-en-zona-rural-frontera-y-el-vraem-o-en-escuelas-unidocente)
34. [Pago a docentes y auxiliares en marzo 2025: consulta AQUÍ el padrón para asignaciones y bonos, vía Minedu](https://larepublica.pe/sociedad/2025/02/12/pago-a-docentes-y-auxiliares-en-marzo-2025-consulta-aqui-el-padron-para-asignaciones-y-bonos-via-minedu-723360)
35. [How teacher wage policies help reduce urban-rural achievement gaps: Evidence from Peru](https://voxdev.org/topic/education/how-teacher-wage-policies-help-reduce-urban-rural-achievement-gaps-evidence-peru)
36. [Decreto Supremo que aprueba la Política de Atención Educativa para la Población de Ámbitos Rurales - DECRETO SUPREMO -](https://busquedas.elperuano.pe/dispositivo/NL/1723311-1)
37. [Solo el 29.1% de los colegios de Junín tiene acceso a agua, luz y desagüe en simultáneo](https://elbuho.pe/2024/09/solo-el-29-1-de-los-colegios-de-junin-tiene-acceso-a-agua-luz-y-desague-en-simultaneo/)
38. [Educar para transformar](https://www.unicef.org/peru/articulos/educar-para-transofmar-digital-aula-infraestructura)
39. [Uso de Internet en Perú alcanza el 79,9%: Crece la conectividad en áreas rurales y entre jóvenes según informe del INEI](https://cuadernoborrador.com/2024/10/01/uso-de-internet-en-peru-alcanza-el-799-crece-la-conectividad-en-areas-rurales-y-entre-jovenes-segun-informe-del-inei/)
40. [Tras problemas con las tabletas, Minedu ejecutará acciones](https://larepublica.pe/sociedad/2021/07/05/tras-problemas-con-las-tabletas-minedu-ejecutara-acciones)
41. [Minedu está atendiendo y superando observaciones sobre tablets - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/504169-minedu-esta-atendiendo-y-superando-observaciones-sobre-tablets)
42. [Wasi Mikuna brindará el servicio alimentario escolar este año a todo el país](https://n60.pe/wasi-mikuna-brindara-el-servicio-alimentario-escolar-este-ano-a-todo-el-pais/)
43. [Wasi Mikuna cambia de rostro, pero siguen las fallas: 16 escolares resultaron intoxicados en Huánuco](https://www.infobae.com/peru/2025/11/12/wasi-mikuna-cambia-de-rostro-pero-siguen-las-fallas-16-escolares-resultaron-intoxicados-en-huanuco/)
44. [Endes 2024](https://proyectos.inei.gob.pe/endes/2024/departamentales/map/principal.html)
45. [Perú: tendencias en los resultados en PISA 2000-2022](https://repositorio.minedu.gob.pe/bitstream/handle/20.500.12799/10226/Per%C3%BA%20tendencias%20en%20los%20resultados%20en%20PISA%202000-2022.pdf?sequence=1)
46. [Minedu refuerza acciones para reducir riesgos de heladas y friaje en colegios - Noticias - Ministerio de Educación - Plataforma del Estado Peruano](https://www.gob.pe/institucion/minedu/noticias/811535-minedu-refuerza-acciones-para-reducir-riesgos-de-heladas-y-friaje-en-colegios)
47. [Minedu brinda confort térmico a colegios rurales para enfrentar heladas y friaje](https://www.tvperu.gob.pe/noticias/nacionales/minedu-brinda-confort-termico-a-colegios-rurales-para-enfrentar-heladas-y-friaje)
48. [Inversión pública en educación por alumno de secundaria supera los 5,000 soles](https://www.elperuano.pe/noticia/237248-inversion-publica-en-educacion-por-alumno-de-secundaria-supera-los-5000-soles)
49. [Año Escolar](https://gestion.pe/peru/ano-escolar-cuanta-es-la-inversion-del-gobierno-por-alumno-en-estudiantes-de-primaria-y-secundaria-minedu-ministerio-de-educacion-noticia/)
50. [ComexPerú - El trabajo infantil en el Perú afecta a 1.8 millones de menores](https://www.comexperu.org.pe/articulo/el-trabajo-infantil-en-el-peru-afecta-a-18-millones-de-menores)
51. [EL TRABAJO INFANTIL EN EL PERÚ - CISEPA](https://cisepa.pucp.edu.pe/novedades-y-eventos/novedades/el-trabajo-infantil-en-el-peru/)
52. [GPT-4 Tutoring in Nigeria Boosts English Scores, Offers Scalable, Cost-Effective Model](https://www.devdiscourse.com/article/education/3419251-gpt-4-tutoring-in-nigeria-boosts-english-scores-offers-scalable-cost-effective-model)
53. [AI Tutors: What the Randomized Trials Found, and What They Cost](https://metaroles.ai/posts/ai-tutors-trials)
54. [What is Meta’s Omnilingual ASR? - Slator](https://slator.com/what-is-meta-omnilingual-asr/)
55. [Omnilingual ASR: Advancing Automatic Speech Recognition for 1,600+ Languages](https://ai.meta.com/blog/omnilingual-asr-advancing-automatic-speech-recognition/)
56. [Meta Expands AI Speech Recognition to 1,600+ Languages - TechRepublic](https://www.techrepublic.com/article/news-meta-expands-ai-speech-recognition/)
57. [Giving Voice to the Constitution: Low-Resource Text-to-Speech for Quechua and Spanish Using a Bilingual Legal Corpus](https://arxiv.org/pdf/2604.13288)
58. [Educación rural: escuelas unidocentes se convierten en polidocentes gracias a 2,373 plazas](https://andina.pe/agencia/noticia-educacion-rural-escuelas-unidocentes-se-convierten-polidocentes-gracias-a-2373-plazas-1037513.aspx)
59. [Cifras sobre la educación rural en el Perú - Proyecto CREER](https://www.grade.org.pe/creer/educacion-rural-en-el-peru/cifras/)
60. [Material educativo en lenguas originarias para la ...](https://www.revistaespacios.com/a24v45n06/a24v45n06p08.pdf)
61. [ComexPerú - ¿Qué funciona contra el trabajo infantil?](https://www.comexperu.org.pe/articulo/que-funciona-contra-el-trabajo-infantil)
62. [Más educación, menos delincuencia: la urgencia de políticas integrales para la niñez - IDEHPUCP](https://idehpucp.pucp.edu.pe/boletin-eventos/mas-educacion-menos-delincuencia-la-urgencia-de-politicas-integrales-para-la-ninez/)
63. [Educación Secundaria en Perú: Análisis de la Deserción, Retos y Reformas](https://actosenlaescuela.com/educacion-secundaria-en-peru/)
