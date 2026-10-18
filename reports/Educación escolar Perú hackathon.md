# Cerrar la última milla contra la deserción escolar

El problema que conviene atacar en el track Educación Escolar de Hack the Andes es la **deserción escolar en secundaria pública**. Pero el punto de entrada no es predecirla, porque el Estado ya lo hace. El punto débil está en lo que pasa **después** de que un estudiante empieza a faltar. Perú ya tiene un sistema nacional de predicción, Alerta Escuela, que funciona dentro del SIAGIE desde fines de 2020 y usa un modelo LightGBM. En secundaria detecta solo **~36% de los desertores**, se calcula una vez al año, envía el primer listado recién en mayo y **excluye la asistencia** por ser poco confiable ([MINEDU 2024](https://repositorio.minedu.gob.pe/handle/20.500.12799/10990)). Además, solo **7% de las escuelas con estudiantes en riesgo** lo abrió. La campaña de SMS a directores aumentó el uso de la plataforma, pero **no aumentó las acciones preventivas ni redujo la deserción** ([Banco Mundial](https://blogs.worldbank.org/en/education/early-warning-systems-can-help-prevent-dropouts-administrators-need-consider-critical)). La evidencia confirma en lo esencial tu hipótesis de trabajo, con dos ajustes. Primero, "las familias nunca son contactadas" es demasiado fuerte: la estrategia nacional ENRC sí envió SMS a familias, pero Alerta Escuela no asigna ese contacto a nadie. Segundo, el sistema fue diseñado para **reportar hacia arriba** (director → UGEL) y no para **actuar hacia abajo** (tutor → familia). La propuesta es **"Lista y Llamada"**: un registro de asistencia por excepción que funciona sin conexión, por WhatsApp o en una app web que se instala en el teléfono, y que abre un caso con un responsable con nombre. El sistema envía un mensaje automático a la familia en menos de 48 h, guarda el motivo de la ausencia y le muestra al director y a la UGEL cuántos casos se abrieron y cuántos se cerraron. La solución se apoya en tres evidencias. En Guatemala, el componente que funcionó fue la información sobre **cómo prevenir**, con −1.3 pp de deserción a 2.91 USD por estudiante. En EE. UU., los mensajes a padres subieron la asistencia **17%**. Y Perú no tiene ninguna señal de asistencia dentro del año escolar. El prototipo se puede construir en 36 h y validar el mismo fin de semana con tutores de Lima. Lima Metro/Callao concentra parte del problema: tiene la mayor deserción de 1.º de primaria del país ([MINEDU 2024](https://repositorio.minedu.gob.pe/handle/20.500.12799/10990)), y 84.6% del grupo que no se rematriculó en 2022 era urbano ([Edudatos 43](https://escale.minedu.gob.pe/documents/inicio/Analisis/Edudatos/Edudatos%2043%20-%20Reinsercion%20y%20continuidad.pdf)).

## 1. El panorama por subtema: el aprendizaje es la crisis más grande, pero la deserción tiene la brecha más clara

### Aprendizaje y docentes: 3 de cada 10 alumnos de 4.º de primaria leen al nivel esperado, y casi todos los competidores van por aquí

En la ENLA 2025, solo **32.7%** de los alumnos de 4.º de primaria alcanzó el nivel satisfactorio en Lectura y **30.0%** en Matemática ([Infobae, 2 oct 2026](https://www.infobae.com/peru/2026/10/02/peru-solo-tres-de-cada-diez-ninos-de-cuarto-de-primaria-logran-resolver-operaciones-matematicas-basicas/)). En Lectura, el porcentaje cae a **11.3% en 5.º de secundaria**. En zonas rurales, 4.º de primaria llega a 16.9%, frente a ~35.5% en zonas urbanas ([De la evidencia al aula](https://delaevidenciaalaula.wordpress.com/2026/05/18/algunas-reflexiones-sobre-los-ultimos-resultados-enla-2025/)). En Loreto, apenas ~6 de cada 100 alumnos de 4.º de primaria alcanzan el nivel satisfactorio en Matemática ([El Búho](https://elbuho.pe/?p=428526)). PISA 2022 dio 391 puntos en Matemática, 9 menos que en 2018 ([MINEDU](https://www.gob.pe/institucion/minedu/noticias/877904-pisa-2022-el-peru-mantiene-sus-resultados-en-las-competencias-de-lectura-y-ciencia)).

Hay unos **426,000 docentes**, con un sueldo inicial de **S/3,500.70** por 30 h ([La República](https://larepublica.pe/sociedad/2026/01/05/sueldo-docente-en-2026-minedu-fija-nuevos-montos-para-cpm-y-profesores-contratados-207090)). La única medición disponible de carga extra es de 2014: ~12 h semanales fuera del horario laboral ([CNE, ENDO 2014](https://www.gob.pe/institucion/cne/noticias/504231-cne-presenta-publicacion-endo-2014-sobre-docentes-peruanos)). En Educación Intercultural Bilingüe (EIB) faltan **19,745 docentes formados** ([La República](https://larepublica.pe/sociedad/2026/02/20/una-brecha-que-no-cierra-faltan-mas-de-19000-maestros-de-lenguas-originarias-en-peru-578000)).

La evidencia más sólida sobre qué funciona son las "Great Buys" del panel GEEAP: pedagogía estructurada y enseñanza según el nivel de aprendizaje ([Banco Mundial](https://www.worldbank.org/en/news/feature/2023/06/21/evidence-based-cost-effective-learning-education-improvements)). El caso peruano de "Una Laptop por Niño" es la advertencia: los equipos sin pedagogía no mejoraron el rendimiento ([BID](https://publications.iadb.org/publications/spanish/document/Evaluaci%C3%B3n-Experimental-del-Programa-Una-Laptop-por-Ni%C3%B1o-en-Per%C3%BA.pdf)).

Este es el espacio **más saturado**:

- **Startups peruanas con fondos públicos:** Numeral (matemática), Bilingües (inglés) y Code en mi cole (programación) recibieron financiamiento de ProInnóvate en 2026 ([Ecosistema Startup](https://ecosistemastartup.com/tres-edtech-peruanas-financiadas-por-proinnovate-en-2026/)).
- **Asistentes para docentes:** MagicSchool reúne ~4.5M usuarios tras una Serie B de $45M ([BusinessDen](https://businessden.com/?p=124059)). Khanmigo for Teachers es gratis en español para Latinoamérica desde enero de 2025 ([Khan Academy](https://blog.khanacademy.org/teachers-in-44-countries-now-get-free-access-to-khanmigo-in-english-thanks-to-microsoft-support)).
- **Hackathones:** los tutores de IA sin conexión ya son un tema recurrente en hackathones internacionales ([AngelHack](https://angelhack.com/?p=19858)).

Incluso el mejor asistente evaluado con rigor, Aila (Reino Unido), ahorró ~24% del tiempo de planificación, pero se usó en solo ~7% de las clases ([EEF](https://educationendowmentfoundation.org.uk/projects-and-evaluation/projects/aila-teacher-choices-trial)).

### Deserción: un problema de cientos de miles de estudiantes, con predicción pero sin acción

La deserción interanual en secundaria es de **2.5% (2023–2024)**, con un repunte de 0.9 pp ([CEPLAN](https://observatorio.ceplan.gob.pe/ficha/t87)). Entre 2020 y 2022, **661,150 estudiantes** interrumpieron sus estudios o estaban en riesgo de hacerlo ([Edudatos 43](https://escale.minedu.gob.pe/documents/inicio/Analisis/Edudatos/Edudatos%2043%20-%20Reinsercion%20y%20continuidad.pdf)).

El problema se concentra en dos momentos: el **paso de 6.º de primaria a secundaria** y **3.º–4.º de secundaria**. En la macrorregión Oriente, la deserción llega a **8.41% en 6.º de primaria** y a **6.30% en 4.º de secundaria**, frente a 1.30% y 1.68% en el Sur ([MINEDU 2024](https://repositorio.minedu.gob.pe/handle/20.500.12799/10990)). De los 20 distritos con mayor deserción histórica, 14 están en Loreto ([GRADE A&P 73](https://www.grade.org.pe/wp-content/uploads/GRADEAP73.pdf)).

Las causas más citadas son las económicas (43.5% en la ENAHO 2015, un dato antiguo), el embarazo adolescente, la extraedad y la migración ([Edudatos 24](https://escale.minedu.gob.pe/documents/inicio/Analisis/Edudatos/Edudatos%2024%20agosto%202016.pdf); [GRADE A&P 73](https://www.grade.org.pe/wp-content/uploads/GRADEAP73.pdf)).

**El dinero por sí solo no movió la deserción.** La transferencia de JUNTOS para secundaria (TAS) mejoró la aprobación (+1.2 pp), pero **no tuvo efecto en matrícula ni deserción** ([UNICEF](https://www.unicef.org/peru/documents/evaluacion-de-impacto-de-la-transferencia-alta-secundaria-tas-del-programa-juntos)).

El espacio está **saturado en predicción**, con Alerta Escuela en Perú y el SAT en Chile ([Mineduc](https://www.mineduc.cl/sistema-de-alerta-temprana-contra-la-desercion-escolar/)). En cambio, está **libre en la última milla**: no se encontró ninguna startup peruana que trabaje en el seguimiento con familias ni en el registro de asistencia ([Ecosistema Startup](https://ecosistemastartup.com/tres-edtech-peruanas-financiadas-por-proinnovate-en-2026/)). Esto último es una inferencia a partir de lo encontrado; no se hizo un censo completo.

### Infraestructura y servicios: una brecha de S/150–170 mil millones que nadie monitorea entre operativos

La brecha de infraestructura pasó de ~S/100 mil millones (PNIE 2017) a **S/152,447 millones** ([Congreso/MINEDU 2023](https://www.congreso.gob.pe/Docs/comisiones2021/pro-inversion/files/presentaciones/presentacion_minedu(20.jun.23)_(final).pdf)). Gestión cita S/164 mil millones y 54.6% de locales para demoler ([Gestión 2024](https://gestion.pe/economia/ano-escolar-2024-el-546-de-colegios-publicos-en-el-peru-estan-en-muy-mal-estado-y-deben-ser-demolidos-minedu-pronied-escuelas-infraestructura-educativa-noticia/)).

- **Servicios básicos:** solo ~40% de los locales tiene agua, desagüe y luz a la vez, y **70.8% de los locales públicos carece de al menos uno** ([ESCALE CE2022](https://escale.minedu.gob.pe/documents/inicio/Bases%20de%20datos/A.%20Censo%20Educativo/2022/Presentaciones/Presentacion_Alertas_CE2022.pdf)).
- **Mantenimiento:** el programa de 2026 tiene S/296.6M, cerca de S/5,000 por local ([RM 007-2026](https://cdn.www.gob.pe/uploads/document/file/9260718/7599994-rm-n-007-2026-minedu.pdf)).
- **Obras paralizadas:** hay 2,572 obras públicas paralizadas en todos los sectores ([Caretas](https://caretas.pe/?p=764903)).
- **Supervisión:** el operativo de la Contraloría revisa ~1,100 de ~55,000 locales al año ([Caretas](https://caretas.pe/?p=787471)). En 2024, 70% de los colegios supervisados no había recibido los cuadernos de trabajo ([Contraloría](https://www.gob.pe/institucion/contraloria/noticias/918845-contraloria-alerta-que-70-de-colegios-supervisados-no-recibio-material-educativo)).
- **Alimentación escolar:** Qali Warma pasó a Wasi Mikuna y luego al PAE tras escándalos en 2024–2025 ([Andina](https://andina.pe/ingles/noticia-midis-dispuso-extincion-del-modelo-compra-productos-para-servicio-wasi-mikuna-1022892.aspx)).

Este espacio está **libre**: no se encontró ningún canal público por colegio para reportar incidencias. Pero la causa de fondo es presupuestal y de ejecución, no de información.

## 2. Matriz de candidatos: la última milla de la deserción gana por brecha y factibilidad

La escala va de 1 a 5, donde 5 es lo mejor. "Gravedad" usa solo cifras citadas arriba. "Tracción" considera que el evento cae **sábado 17 y domingo 18 de octubre de 2026**, sin clases, así que el uso real solo se puede probar de forma retrospectiva o en una prueba simulada.

| Candidato | Subtema | Gravedad con evidencia | Brecha no resuelta | Construible en 36 h | Tracción en el evento | Datos abiertos | Total |
|---|---|---|---|---|---|---|---|
| **A. Última milla de la deserción**: asistencia frecuente, responsable con nombre y contacto con la familia | Deserción | 4 (661k estudiantes; 2.5% en secundaria; 8.41% en Oriente) | **5** (AE: 36% de detección, 7% de uso, sin asistencia; los SMS no generaron acciones) | 4 | 4 (tutores y directores de Lima, accesibles por redes docentes) | 3 (padrón ESCALE y desertores por distrito 2023/2024) | **20** |
| B. Reinserción de migrantes y estudiantes con extraedad | Deserción | 3 (reinserción de extranjeros: 17.1% y 30.2%) | 4 | 3 | 2 | 2 | 14 |
| C. Diagnóstico por nivel (TaRL) y agrupación en aulas multigrado | Aprendizaje | **5** (32.7% / 16.9% rural) | 3 (muchos asistentes; el multigrado es un nicho) | 3 (requiere mucho contenido alineado al currículo) | 3 | 2 (la ENLA solo da datos agregados) | 16 |
| D. Asistente de evaluación formativa CNEB y registro en SIAGIE | Docentes | 3 (la carga está mal medida; dato de 2014) | 2 (Khanmigo y MagicSchool son gratis) | 4 | 4 (38% de docentes ya usa IA) | 1 | 14 |
| E. Reporte ciudadano de infraestructura vinculado al monto de mantenimiento | Infraestructura | **5** (S/152–172 mil millones; 70.8% sin algún servicio) | 4 | 4 | 2 (requiere reportes de padres; el impacto se ve tarde) | **4** (padrón, Censo Educativo, anexo de la RM) | 19 |
| F. Monitoreo de entregas e incidentes del PAE | Servicios | 4 (~120 niños intoxicados en una semana, 2025) | 4 | 3 | 1 (sin clases; el modelo PAE 2026 no está confirmado) | 1 | 13 |

**Se elige A.** E queda en segundo lugar, cerca, pero tiene un defecto de fondo. Con ~S/5,000 por local y 71.8% de las obras paralizadas en manos de gobiernos locales ([Caretas](https://caretas.pe/?p=764903)), un canal de reportes visibiliza el problema, pero nadie con presupuesto está obligado a responder. Sería transparencia sin un mecanismo que la convierta en acción. C tiene la mayor gravedad, pero compite contra herramientas gratuitas y bien financiadas, y su impacto no se puede demostrar en un fin de semana.

## 3. Hipótesis de causa raíz: el sistema fue diseñado para reportar, no para actuar

**Quién.** El **tutor de aula de secundaria pública urbana o periurbana** (de 1.º a 4.º), junto con el director que responde ante la UGEL. El beneficiario final es el estudiante que acumula faltas en los grados de transición. Se excluyen las escuelas unidocentes y multigrado pequeñas, porque en Guatemala el efecto de la alerta temprana fue **casi nulo en escuelas pequeñas** ([BM PRWP 9685](https://documents1.worldbank.org/curated/en/983591622568486300/pdf/Scalable-Early-Warning-Systems-for-School-Dropout-Prevention-Evidence-from-a-4-000-School-Randomized-Controlled-Trial.pdf)).

**Dolor.** El estudiante deja de venir y nadie lo nota a tiempo. La asistencia se carga en el SIAGIE **una vez al mes**, el último día hábil ([UGEL 06, 2026](https://ofimult.ugel06.gob.pe/archivos/oficio-multiple-no-00050-2026-mineduvmgi-drelm-ugel06dirasgese-1778285077.pdf)). Por eso, 2 o 3 semanas de ausencia quedan invisibles durante 4 a 6 semanas (esto es una inferencia de las notas). Cuando llega la alerta anual, ya no hay mucho que hacer.

**Workaround actual.** Esto es lo documentado:

- El director consolida la asistencia del mes, que es declarativa y está sesgada por las transferencias de JUNTOS ([MINEDU 2024](https://repositorio.minedu.gob.pe/handle/20.500.12799/10990)).
- Los directores usan Alerta Escuela "para reportes mensuales" y no para prevenir, y consideran las guías "demasiado largas" ([Banco Mundial](https://blogs.worldbank.org/en/education/early-warning-systems-can-help-prevent-dropouts-administrators-need-consider-critical)).
- La UGEL aplica el protocolo de búsqueda activa de la ENRC **después** de que el estudiante ya no se matriculó ([Edudatos 43](https://escale.minedu.gob.pe/documents/inicio/Analisis/Edudatos/Edudatos%2043%20-%20Reinsercion%20y%20continuidad.pdf)).

El contacto informal del tutor con la familia por WhatsApp personal es probable, pero **no está documentado** en las notas. Es justo lo primero que hay que verificar en las entrevistas.

**Causa raíz.** No existe una rutina barata que convierta una señal de inasistencia de esta semana en un contacto con la familia, hecho por alguien con nombre, dentro de un plazo y con registro del motivo. La cadena actual (asistencia → SIAGIE → modelo → director → UGEL) fue construida para **rendir cuentas hacia arriba**, no para **intervenir hacia abajo**. Predecir no es el cuello de botella. Aunque la predicción fuera perfecta, la alerta caería en un director que no tiene un protocolo corto ni un responsable asignado. Eso es lo que muestra el experimento con SMS: subió el uso, pero no subieron las acciones.

**Traza de frameworks.**

- **First Principles.** Una deserción se evita con una intervención humana a tiempo. Para eso hacen falta tres cosas: (1) una señal reciente, (2) alguien responsable y (3) un canal hacia la familia. Las notas muestran que hoy falta (1), porque la señal es mensual y está excluida del modelo. También falta (2): el sistema le llega al director y no al tutor. Y (3) existe solo en campañas de SMS masivas, no en casos individuales. Mejorar el modelo (por ejemplo, subir la detección del 36%) no repone ninguno de los tres.
- **TRIZ (contradicción).** La asistencia en Perú cumple dos funciones opuestas. Sirve de **control** (condiciona la transferencia de JUNTOS, que es de S/100 base) y de **cuidado** (detectar al alumno que se va). Como sirve de control, se infla, y como se infla, MINEDU la descarta del modelo ([MINEDU 2024](https://repositorio.minedu.gob.pe/handle/20.500.12799/10990)). Hay una segunda contradicción: una asistencia más frecuente sería más útil, pero suma carga al docente. La solución TRIZ es **separar por propósito y por momento**. Se crea una señal interna de cuidado, que no alimenta transferencias ni se reporta de inmediato, y se captura **por excepción**: solo se marcan las faltas, en menos de 60 segundos por aula.
- **Marketing Myopia.** MINEDU definió su producto como "una plataforma que predice el riesgo". Pero el trabajo real es "que el alumno siga matriculado el año siguiente". Por eso midió accesos y no acciones ni rematrículas.
- **JTBD.** El tutor quiere poder decir: "que no se me pierda ningún alumno sin haber hecho algo, y poder demostrar que lo hice". El director quiere "cumplir con la UGEL sin más carga". Alerta Escuela no le resuelve ninguno de los dos trabajos al tutor, y al director le suma carga ("solo solicita información").
- **Progress-Making Forces.** El push del director es débil, como muestra el 7% de uso. Por eso la propuesta de valor tiene que ser **un ahorro neto**: que el registro diario genere automáticamente el consolidado mensual para el SIAGIE. Las principales ansiedades son la privacidad de datos de menores y el miedo a quedar "expuesto" ante la UGEL.

**Predicción falsable.** De 10 tutores o directores de secundaria pública entrevistados, **al menos 6** contarán sobre su último alumno que dejó de venir que:

1. Se enteraron de forma informal, más de una semana después de que empezaron las faltas.
2. No siguieron ningún protocolo escrito ni registraron el motivo.
3. El contacto con la familia dependió de su teléfono personal, o no ocurrió.

**La hipótesis se rechaza** si 5 o más de esos 10 describen una rutina que ya funciona: asistencia diaria con aviso a la familia en menos de una semana, por un responsable definido. En ese caso, el cuello de botella sería la causa económica, no la última milla, y conviene girar hacia el candidato B o E.

**Supuestos.** Estos son los supuestos que la solución da por ciertos:

- Que los docentes registran a diario la asistencia en papel o en el SIAGIE v5. No se verificó, porque no se leyeron la RVM 094-2020 ni la RM 432-2020.
- Que las familias tienen WhatsApp.
- Que el contacto temprano cambia la conducta en Perú. La evidencia de mensajes a padres es de EE. UU. ([CESifo WP 6493](https://www.cesifo.org/DocDL/cesifo1_wp6493.pdf)), y la evidencia de "cómo prevenir" es de Guatemala.
- Que el uso de Alerta Escuela no mejoró de forma sustancial entre 2023 y 2026. No hay datos para ese periodo.

**Condición de parada.** Aquí se deja de profundizar. La hipótesis es falsable con entrevistas sobre conducta pasada y está anclada en conductas observables: la carga mensual, el uso de AE para reportes y el 2% de descarga de guías. Seguir preguntando "por qué" llevaría a causas como pobreza, trabajo adolescente o embarazo. Esas causas no se pueden resolver en 36 h, y una herramienta de última milla solo puede **canalizarlas**: registrar el motivo y derivar el caso.

## 4. Tres conceptos de solución: Lista y Llamada resuelve la causa raíz, los otros dos la rodean

| | **1. Lista y Llamada** (recomendado) | 2. Alerta Escuela por WhatsApp | 3. Mapa de prioridades para la UGEL |
|---|---|---|---|
| **Propuesta de valor** | "Sabes hoy quién está faltando, la familia recibe un aviso en 48 h y tu consolidado mensual sale solo" | "Tu lista de riesgo de AE llega a tu WhatsApp con 3 pasos concretos por alumno" | "Sabes qué colegios y distritos visitar primero para la búsqueda activa" |
| **Segmento** | Tutores y directores de secundaria pública urbana o periurbana, empezando por Lima Metro | Directores con estudiantes en riesgo medio o alto según AE | Especialistas de UGEL y DRE responsables de la ENRC |
| **Canales** | Piloto con una UGEL de Lima; grupos docentes; ONG aliadas | Exige un convenio con la OSEE-MINEDU | Contacto directo con la UGEL; enlace público |
| **Ingresos** | Gratis para el docente. Financiamiento B2G por UGEL o DRE, ONG o cooperación (UNICEF, BID/BM) y subvención ProInnóvate (S/50k–150k) ([Innovación Digital 360](https://www.innovaciondigital360.com/industria-4-0/cual-es-el-potencial-edtech-peruano)) | Contrato o convenio con MINEDU, una venta lenta y sin ruta documentada | Licencia por UGEL o proyecto con cooperación |
| **Costos** | Mensajería de WhatsApp o SMS por conversación, hosting, capacitación de 1 h por colegio | Integración y aprobación de datos personales | Procesar datos abiertos; costo marginal casi cero |
| **Ventaja** | Genera un dato que nadie tiene: **motivos de inasistencia en tiempo real**, cuando el último dato nacional de motivos es de 2015–2020. También ahorra la carga mensual al SIAGIE | Reusa un modelo ya existente | Une padrón, deserción distrital y servicios |
| **Ajuste con la evidencia** | **Soportado.** Resuelve las tres fallas: la asistencia excluida del modelo, que no haya un responsable y que no se contacte a la familia. Lo respaldan Bergman (+17% de asistencia) y Guatemala ("cómo prevenir") | **Parcialmente.** Se parece a los SMS a directores, que no generaron acciones. Además, los datos de AE no son públicos | **Parcialmente / no soportado para la causa raíz.** Prioriza mejor, pero no genera acción a tiempo. La UGEL ya hace búsqueda activa |
| **Bandera de riesgo** | Extiende una conducta que ya existe (registrar asistencia, tutoría). El riesgo es de **hábito**: Aila cayó a 7% de uso | Extiende una conducta, pero repite un mecanismo que ya falló | Es un síntoma territorial. Funciona como módulo, no como producto |

Aplicamos el filtro de "solución en busca de problema". Si se quita el lenguaje de causa raíz, el concepto 1 sigue resolviendo, de forma evidente, la señal frecuente, el responsable y el contacto con la familia. El concepto 3 se podría aplicar a cualquier problema territorial, así que queda **como vista de la UGEL dentro del concepto 1**.

**Por qué gana Lista y Llamada.** Es el único concepto que ataca justo la pieza que MINEDU reconoce no tener: una asistencia confiable y frecuente, que su propio documento excluye por falta de verificación. Y la convierte en la intervención que la evidencia internacional sí respalda. En Guatemala, el efecto vino de saber **cómo** prevenir, no de la lista de riesgo, y costó 2.91 USD por estudiante con una relación beneficio-costo de ~19:1 ([BM PRWP 9685](https://documents1.worldbank.org/curated/en/983591622568486300/pdf/Scalable-Early-Warning-Systems-for-School-Dropout-Prevention-Evidence-from-a-4-000-School-Randomized-Controlled-Trial.pdf)). Además, no compite con el Estado: puede importar el nivel de riesgo de AE como dato previo y devolverle a MINEDU una señal mejor. Para el jurado, combina un problema serio y cuantificado, lógica propia (reglas, protocolo, máquina de estados de casos, sincronización sin conexión) e integración real con WhatsApp y con datos abiertos. Y se puede validar el sábado con tutores reales.

## 5. Plan de construcción de 36 h orientado a la rúbrica

**Alcance del MVP.**

| Prioridad | Qué incluye |
|---|---|
| **Must** | Una web instalable en el teléfono (PWA) que funciona sin conexión (IndexedDB) para marcar **solo las faltas** por aula. Un motor de reglas configurable, por ejemplo 3 faltas seguidas o 20% del mes, que abre un caso con el tutor como responsable y una fecha límite de 48 h. Un mensaje automático a la familia por WhatsApp y SMS como alternativa, con respuesta por botones ("está enfermo / trabajando / problemas de traslado / otro"). Un protocolo de 3 pasos en tarjetas cortas (contactar → registrar motivo → derivar al director o psicólogo). Un panel del director con casos abiertos, cerrados y vencidos. Un buscador de colegio por código modular, alimentado con el padrón ESCALE |
| **Should** | Exportar el consolidado mensual en el formato que se carga al SIAGIE (es el ahorro neto para el director). Una vista UGEL con un mapa de distritos coloreado por la tasa de desertores 2023/2024 de Datos Abiertos y los colegios piloto encima. Importación manual (CSV) del nivel de riesgo de AE como dato previo. Mensajes generados por un LLM con plantillas revisadas por humanos |
| **Won't** | Ningún modelo de ML propio de predicción (AE ya existe). Nada de quechua ni lenguas amazónicas en el MVP (riesgo de calidad del LLM). Sin integración directa con el SIAGIE, que no tiene API pública verificada. Sin módulo de alimentación ni de infraestructura |

**Arquitectura y stack.** La recomendación es barata y se despliega como URL pública:

- **Frontend:** Next.js con PWA y service worker, desplegado en Vercel.
- **Backend y datos:** Supabase (Postgres, autenticación por enlace mágico o teléfono, tablas `colegio`, `aula`, `estudiante`, `falta`, `caso`, `evento_caso`).
- **Canal de mensajería:** WhatsApp Cloud API con número de prueba de Meta. Hay que configurarlo en la **hora 0**, porque la plantilla y el número toman tiempo. Si falla, se usa el sandbox de Twilio o SMS.
- **Reglas y vencimientos:** un job programado cada hora (cron de Vercel o Supabase) evalúa las reglas y los vencimientos.
- **Sincronización:** es sin conexión primero. Las faltas se encolan en el teléfono y se suben al recuperar señal, lo que importa porque solo 36% de los locales tiene conectividad suficiente ([Banco Mundial](https://blogs.worldbank.org/en/education/early-warning-systems-can-help-prevent-dropouts-administrators-need-consider-critical)).
- **Datos personales:** se seudonimizan los DNI y los números de teléfono se cifran en reposo.

**Datos abiertos que se cargan.**

- **Padrón de Servicios Educativos de ESCALE** (.dbf, convertir con Python `dbfread`; campos: código modular, código de local, nivel, gestión, ubigeo) ([ESCALE Padrón](https://escale.minedu.gob.pe/web/inicio/padron-de-iiee); [diccionario 2024](https://escale.minedu.gob.pe/documents/inicio/Bases%20de%20datos/A.%20Censo%20Educativo/2024/00_Diccionario%20marco%20censal%202024.pdf)).
- **Tasa y número de desertores por distrito 2023/2024** ([Datos Abiertos](https://www.datosabiertos.gob.pe/dataset/tasa-y-n%C3%BAmero-de-desertores-en-educaci%C3%B3n-primaria-y-secundaria-20232024)). Este dataset además sirve para resolver el conflicto de cifras del punto 8.
- **Opcional:** coordenadas del Mapa de Escuelas (SIGMED). La ubicación es aproximada, según el propio MINEDU.

**Reparto de horas y su relación con la rúbrica.** El **Esfuerzo técnico (40%)** se demuestra con el motor de reglas, la máquina de estados de casos, la sincronización sin conexión, el WhatsApp bidireccional y la carga del padrón:

| Horas | Actividad |
|---|---|
| 0–2 | Configurar WhatsApp y Supabase, y procesar el padrón |
| 2–14 | Núcleo: faltas, reglas, casos y mensaje |
| 14–22 | Panel del director, exportación mensual y vista UGEL |
| 22–30 | Pulido sin conexión y datos de demo realistas |
| 30–36 | Pitch y ensayos |

La **Tracción (30%)** corre en paralelo desde la hora 0 con la persona dedicada a validación (sección 6). El **Pitch (30%)** se cierra en las horas 30–36.

**Guion de demo de 90 s.**

1. La tutora de 3.º B abre la PWA en **modo avión** y marca 3 faltas en 20 segundos.
2. Activa la red: se sincroniza y se abre el caso de "Estudiante 14", que lleva su tercera falta seguida.
3. Llega un WhatsApp **al teléfono de un miembro del jurado**, que hace de apoderado, y este responde "está trabajando".
4. El caso cambia a "motivo: económico". La tarjeta del protocolo sugiere hablar con el director y revisar la elegibilidad para JUNTOS.
5. El panel del director muestra "4 casos abiertos, 1 vencido". El consolidado mensual para el SIAGIE se descarga con un clic.
6. La vista UGEL muestra el distrito sobre la capa de deserción 2023/2024.
7. Se cierra con los números de la validación.

**Qué dejar fuera.** El ML predictivo, los paneles con decenas de métricas, el chatbot generalista, la autenticación compleja, los roles de la DRE y cualquier promesa de integración con el SIAGIE que no se pueda demostrar.

## 6. Plan de validación durante el evento: diez entrevistas y tres pilotos comprometidos antes del domingo

El fin de semana no hay clases. Por eso la validación mide **conducta pasada** (lo que hicieron con el último alumno que faltó) y **compromiso futuro concreto** (piloto el lunes), no opiniones.

**A quién.**

- **Al menos 8 tutores o docentes de secundaria pública**, idealmente de 1.º a 4.º.
- **Al menos 3 directores o subdirectores.**
- **Al menos 4 padres o apoderados.**
- **Si se puede, 1 especialista de UGEL** que trabaje en la ENRC.

Se reclutan por la red personal del equipo, grupos de docentes en Facebook y WhatsApp y otros participantes del evento, con entrevistas por llamada de 15 minutos.

**Preguntas para docentes y tutores** (en orden, sobre conducta pasada):

1. "Piense en el último alumno que dejó de venir varios días. ¿Cómo se enteró y cuántos días después de la primera falta?"
2. "¿Qué hizo usted exactamente? ¿Llamó a la familia? ¿Desde qué teléfono?"
3. "¿Dónde quedó registrado lo que hizo y el motivo?"
4. "¿Cómo registra hoy la asistencia: en papel, en el SIAGIE, a diario o a fin de mes? ¿Cuánto le toma?"
5. "¿Ha abierto Alerta Escuela este año? ¿Qué hizo con la lista?"
6. "¿Qué pasó finalmente con ese alumno?"

**Preguntas para directores:**

1. "¿Cuánto tiempo le toma el consolidado mensual de asistencia y quién lo hace?"
2. "La última vez que la UGEL le pidió información sobre estudiantes en riesgo, ¿qué entregó?"

**Preguntas para padres:**

1. "¿Alguna vez el colegio le avisó que su hijo había faltado? ¿Cómo y cuántos días después?"
2. "¿Por qué medio prefiere que le escriban?"

**Prueba de demanda (smoke test).** Se arma una página de una sola pantalla que diga "Piloto gratuito: sepa cada semana qué alumno está dejando de venir", con un formulario real (nombre, colegio por código modular, cargo). Se difunde el sábado en la mañana en 5 o más grupos docentes y se mide la conversión de visitas a registros. Además se hace una **prueba concierge**: a un tutor que acepte, el equipo le envía manualmente el lunes los mensajes a las familias de sus alumnos ausentes, con su autorización y la del director.

**Umbrales fijados antes de empezar.** Hay que reportar el número real aunque no se alcance:

| Señal | Umbral de éxito |
|---|---|
| Entrevistas que confirman la predicción | **≥6 de 10** confirman la tríada (aviso tardío, sin protocolo, contacto informal o inexistente). **≥5 de 10 con una rutina que ya funciona invalida la hipótesis** |
| Smoke test | ≥10% de conversión con ≥80 visitas, o ≥15 registros de docentes |
| Compromiso | **≥3 tutores o directores** aceptan un piloto concreto el lunes 19 (mensaje escrito o captura de pantalla). **≥1 carta de intención** de un director |
| Padres | ≥3 de 4 dicen no haber recibido nunca un aviso oportuno, o haberlo recibido solo por iniciativa personal de un docente |

## 7. Esqueleto del pitch de 3 minutos

| Tiempo | Contenido |
|---|---|
| 0:00–0:25 | **Gancho:** "En Perú, entre 2020 y 2022, 661 mil estudiantes interrumpieron sus estudios o estaban en riesgo. El Estado tiene una IA que predice quién se va. Solo 7% de los colegios la abrió, y cuando se insistió por SMS, la deserción no bajó." |
| 0:25–0:55 | **Causa raíz:** la asistencia se carga una vez al mes y el modelo la excluye. La alerta le llega al director, no al tutor. Nadie llama a la familia a tiempo. "El problema no es predecir, es actuar." |
| 0:55–1:10 | **Evidencia:** en Guatemala, enseñar cómo prevenir redujo la deserción a 2.91 USD por alumno. En EE. UU., avisar a los padres subió la asistencia 17%. |
| 1:10–2:10 | **Demo en vivo** (el guion de la sección 5), con el WhatsApp sonando en el teléfono del jurado |
| 2:10–2:35 | **Tracción:** "Entrevistamos a N tutores; X de N se enteraron tarde de su último alumno ausente. Y directores empiezan el piloto el lunes." Solo números reales |
| 2:35–2:50 | **Modelo:** gratis para el docente, financiado por UGEL, ONG o ProInnóvate. El ahorro del consolidado mensual paga la adopción |
| 2:50–3:00 | **Cierre:** "Queremos que ningún alumno se pierda sin que alguien haya hecho algo." Lo que pedimos: una UGEL piloto |

## 8. Riesgos, supuestos no verificados y vacíos de evidencia

**Cifras en conflicto.**

- **Deserción en secundaria 2023–2024:** CEPLAN reporta **2.5%** ([CEPLAN](https://observatorio.ceplan.gob.pe/ficha/t87)) y Correo, citando ESCALE, **0.8%** ([Correo](https://diariocorreo.pe/peru/reincorporacion-escolar-claves-para-acompanar-a-quienes-retoman-sus-estudios-en-el-peru-noticia/)). Además, la ficha de CEPLAN solo se leyó en el resumen del buscador. **En el pitch conviene usar los 661,150 de Edudatos 43**, o calcular la tasa en la hora 0 con el CSV de Datos Abiertos.
- **ROC AUC de Alerta Escuela en secundaria:** puede ser ~0.87 o 0.81, porque la tabla del PDF estaba desordenada. Las cifras de detección (36%) y precisión (19%) son más estables ([MINEDU 2024](https://repositorio.minedu.gob.pe/handle/20.500.12799/10990)).
- **Brecha de infraestructura:** las fuentes dan S/152, 164 o 172 mil millones según el año de actualización.
- **Deserción urbana vs. rural:** el dato del INEI 2017–2021 (urbana mayor que rural) tiene otra metodología ([INEI](https://www.inei.gob.pe/media/MenuRecursivo/investigaciones/desercion-escolar.pdf)).

**Datos de una sola fuente o débiles.**

- La anemia asociada a 43.3% de los abandonos según la Defensoría ([Gestión](https://gestion.pe/peru/defensoria-del-pueblo-46000-estudiantes-abandonaron-el-sistema-educativo-en-los-ultimos-dos-anos-noticia/)).
- Los resultados del operativo de la Contraloría 2026 (349 colegios sin docentes), que solo cita Caretas ([Caretas](https://caretas.pe/?p=796704)).
- Los efectos de "Decidiendo para un Futuro Mejor", que vienen de resúmenes institucionales y no de un paper revisado por pares ([J-PAL](https://www.povertyactionlab.org/es/expansiones/un-laboratorio-de-innovacion-gubernamental-para-mejorar-la-educacion)).
- La encuesta de uso de IA docente (38.48%), con metodología desconocida ([Infobae](https://www.infobae.com/peru/2025/02/25/educacion-en-la-era-digital-estudio-revela-que-el-90-de-los-profesores-estan-interesados-en-usar-ia-en-sus-clases/)).

**Vacíos que afectan directamente la solución.**

- **No se sabe si el docente ya registra asistencia diaria en el SIAGIE v5.** No se leyeron las normas base. Si lo hace, el problema se desplaza de "no hay señal" a "la señal no se usa", y la solución cambia de capturar faltas a consumirlas.
- **No hay datos de uso de Alerta Escuela entre 2023 y 2026.** Tampoco se obtuvieron las cifras de las evaluaciones 8681 y 8849, así que el "7%" podría estar desactualizado.
- **No hay evidencia peruana de mensajes a padres por WhatsApp.** La de Bergman es de EE. UU., y en Guatemala el efecto fue casi nulo en escuelas pequeñas.
- **No se verificaron antecedentes de Hack the Andes ni a sus ganadores.**

**Riesgos de ejecución.**

- **Setup del canal:** la aprobación del número y las plantillas de WhatsApp Cloud API puede demorar. Hay que configurarlo en la hora 0, con alternativa por SMS.
- **Datos de menores:** se trabajan datos personales de menores. Hay que cumplir la ley peruana de protección de datos personales (Ley 29733, una referencia externa a estas notas que conviene verificar), usar datos ficticios en la demo y obtener consentimiento del director y de la familia en el concierge.
- **Hábito:** el uso cae con el tiempo, como en Aila.
- **Contradicción con JUNTOS:** si la señal de cuidado se conecta a las transferencias, la UGEL o el director volverán a inflarla. **La señal debe quedarse como un dato interno de cuidado.**

## Conclusión

Lo que cambia la estrategia es entender que el Estado peruano ya hizo la parte que parece más innovadora, el modelo de ML, y que precisamente eso demuestra que la innovación no estaba ahí. Ganar el track con un "predictor de deserción" sería competir con MINEDU en su propio terreno y perder. Ganarlo con una herramienta que **le devuelve al Estado la señal que excluyó por no poder confiar en ella** convierte al equipo en complemento de Alerta Escuela y no en su reemplazo. Esa es la posición más creíble ante un jurado, ante una UGEL y ante ProInnóvate.

La segunda idea, menos obvia, es que el dato más valioso que produce Lista y Llamada no es la falta, sino **el motivo**. Perú no tiene una medición reciente de por qué los adolescentes dejan de asistir: lo último es la ENAHO 2015–2020. Cada caso cerrado con "trabajo", "embarazo", "traslado" o "violencia" sería evidencia nueva para derivar a JUNTOS, MINSA o SíseVe. Eso lo convierte en algo más que un recordatorio: es la infraestructura de datos que la política intersectorial que pide GRADE ([GRADE A&P 73](https://www.grade.org.pe/wp-content/uploads/GRADEAP73.pdf)) todavía no tiene. La condición para todo lo anterior es que el sábado la mayoría de los tutores entrevistados describa lo que la hipótesis predice. Si no es así, el equipo debe girar hacia el candidato E con la misma disciplina.
