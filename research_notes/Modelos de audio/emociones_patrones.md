# Emoción/afecto y patrones paralingüísticos en el habla, para Ñawinchay

Investigación al 17-10-2026. Usuarios: niños de 8 a 12 años, lectura en voz alta y razonamiento oral en español y quechua sureño (Perú).
Convención: **[NV]** = no verificado en fuente oficial durante esta investigación (dato de memoria o de fuente secundaria).

---

## 0. Conclusiones primero

1. **No existe ningún modelo de SER (reconocimiento de emoción en el habla) entrenado con voz infantil en español ni en quechua.** Todos los modelos abiertos relevantes están entrenados con adultos (sobre todo en inglés y chino). Cabe esperar una caída fuerte de rendimiento entre corpus, idiomas y edades.
2. **Riesgo legal alto.**
   - **Perú**: el DS 115-2025-PCM, art. 24.1 i), califica como **ALTO RIESGO** inferir emociones de personas en centros educativos, salvo fines médicos o de seguridad. Las evaluaciones de niños, niñas y adolescentes (NNA) en educación también son de alto riesgo (art. 24.1 b). En Perú esto **no está prohibido, pero sí regulado**: transparencia (art. 25), registro y supervisión humana en el sector privado (art. 31). El plazo para el sector privado de educación es 1 año desde la publicación (09-09-2025), así que ya rige o está por regir.
   - **UE**: el art. 5(1)(f) del AI Act lo **PROHÍBE** en educación desde el 02-02-2025. Solo afecta si la app se ofrece en la UE.
3. **Recomendación de diseño**: no inferir "emociones". Medir **rasgos observables de fluidez y prosodia**: velocidad lectora, pausas, titubeos, repeticiones, autocorrecciones, entonación al final de frase. Presentarlos como retroactividad pedagógica, nunca como un estado emocional. Esto evita la categoría de "reconocimiento de emociones" (a confirmar con abogado) y es científicamente más defendible.
4. **Licencias**:
   - Usables en comercial: librosa (ISC), SpeechBrain (Apache-2.0), superb/hubert-er (Apache-2.0), pyAudioAnalysis (Apache-2.0), DisVoice (MIT), emotion2vec+ (licencia de modelos FunASR, permisiva con atribución).
   - Problemáticas: audEERING msp-dim (**CC-BY-NC-SA-4.0, no comercial**), openSMILE (**gratis solo para investigación, privado o educación; comercial requiere licencia de pago**), Parselmouth y surfboard (**GPL-3.0**; surfboard además está archivado).

---

## 1. Reconocimiento de emoción en el habla (SER)

### 1.1 emotion2vec / emotion2vec+ (seed, base, large)
- **Desarrollador**: Ziyang Ma, Zhisheng Zheng, Jiaxin Ye, Jinchao Li, Zhifu Gao, Shiliang Zhang, Xie Chen (SJTU + Alibaba DAMO / FunASR). Paper arXiv 2312.15185 (dic-2023). emotion2vec+ salió en may-2024. No hay novedades en el repositorio posteriores a oct-2024.
- **Salida**: 9 clases (angry, disgusted, fearful, happy, neutral, other, sad, surprised, unknown) más embeddings utterance-level o frame-level.
- **Tamaño y datos**:
  - base: ~90M parámetros, 4.788 h.
  - large: ~300M parámetros, 42.526 h de datos pseudo-etiquetados, filtrados de 160k h.
  - seed: 201 h académicas de EmoBox.
  - Idiomas de entrenamiento: **no declarados**. El ejemplo del repositorio está en chino. El emotion2vec original se evaluó en mandarín, francés, alemán, italiano, etc.
  - **No menciona español ni niños.**
- **Licencia**:
  - Tag HF `license: other`, que enlaza a la "FunASR Model Open Source License Agreement v1.1" (Alibaba). Permite usar, copiar, modificar y compartir **con atribución** y conservando el nombre del modelo. Declara el software "for reference and learning purposes only" sin garantías. Tiene una cláusula peculiar: la licencia se pierde automáticamente por "denigración injustificada" del software. **Revisar con abogado.**
  - Código del repositorio: el badge dice MIT, pero no se encontró el archivo LICENSE (404). [NV]
- **Cómputo**: la ficha de inferencia HF indica CPU 8 núcleos y 4 GB de RAM. Corre en CPU.
- **Precisión**: la ficha no da cifras, solo un gráfico radar sobre EmoBox. Se afirma estado del arte en IEMOCAP con probe lineal (ver paper).
- **URL**:
  - https://huggingface.co/emotion2vec/emotion2vec_plus_large
  - https://huggingface.co/emotion2vec/emotion2vec_plus_base
  - https://github.com/ddlBoJack/emotion2vec
  - Licencia: https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE

### 1.2 audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim
- **Desarrollador**: audEERING (Wagner et al., "Dawn of the transformer era in SER: closing the valence gap", arXiv 2203.07378, 2022).
- **Salida**: arousal, dominancia y valencia (rango ~0–1) más embeddings agrupados.
- **Datos**: MSP-Podcast v1.7, en inglés y con adultos. Base Wav2Vec2-Large-Robust podada a 12 capas.
- **Licencia**: **CC-BY-NC-SA-4.0. "For research purpose only."** audEERING vende una versión comercial entrenada con más datos.
- **Precisión**: la ficha no da el CCC. En el paper, el CCC de valencia ronda 0,6 en MSP-Podcast [NV].
- **URL**: https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim

### 1.3 speechbrain/emotion-recognition-wav2vec2-IEMOCAP
- **Desarrollador**: SpeechBrain.
- **Salida**: 4 clases de IEMOCAP (neutral, angry, happy, sad).
- **Datos**: IEMOCAP, inglés actuado, 10 actores adultos.
- **Licencia**: **Apache-2.0** (tag HF). La licencia de IEMOCAP en sí es restrictiva y no comercial [NV].
- **Precisión**: ~78,7% en el test de IEMOCAP según la ficha [NV].
- **URL**: https://huggingface.co/speechbrain/emotion-recognition-wav2vec2-IEMOCAP

### 1.4 superb/hubert-large-superb-er
- **Desarrollador**: equipo SUPERB (NTU/MIT/CMU/Meta).
- **Salida**: 4 clases de IEMOCAP.
- **Datos**: IEMOCAP, inglés.
- **Licencia**: **Apache-2.0** (tag HF). Última modificación en 2021.
- **Precisión**: ~67,6% en el benchmark SUPERB ER [NV].
- **URL**: https://huggingface.co/superb/hubert-large-superb-er

### 1.5 Hume AI: Expression Measurement y EVI (comercial)
- **Salida**:
  - Prosodia: 48 dimensiones de expresión emocional a partir de tono, ritmo y timbre.
  - Vocal bursts: 48 dimensiones y 67 tipos de ráfaga (risa, suspiro, etc.).
  - La página "overview" actual describe otro esquema de audio: `expressions` (414 nombres) y `voice_attributes` (190 nombres), con el API en "limited release".
  - Marketing: "50+ idiomas".
- **Estado (CONTRADICTORIO)**: un resultado de búsqueda de los docs de Hume hablaba de *sunset* del Expression Measurement API: crear jobs hasta el 14-05-2026 y usar el API hasta el 14-06-2026. La página overview consultada hoy no muestra ese aviso y dice "limited release, contact the team". **[NV] Confirmar con Hume antes de depender del servicio.**
- **Menores y términos**: no verificado. [NV] Además envía audio de niños a un tercero en EE. UU., lo que implica transferencia internacional (Ley 29733 de Perú).
- **URL**:
  - https://dev.hume.ai/docs/expression-measurement/overview
  - https://dev.hume.ai/docs/expression-measurement/models/prosody
  - https://www.hume.ai/expression-measurement-api

### 1.6 Corpus de emoción en español
- **EmoMatchSpanishDB / EmoSpanishDB**
  - Autores: García-Cuesta, Barba y Gachet, *Multimedia Tools and Applications* (2023/2024).
  - Habla elicitada de 50 **no actores (adultos)**: 6 emociones de Ekman más neutral, validada por crowdsourcing.
  - EmoMatch es el subconjunto de 2.050 audios cuya emoción percibida coincide con la elicitada.
  - Español de España [NV]. Licencia en Figshare: [NV].
  - URL: https://figshare.com/articles/dataset/EmoMatchSpanishDB/14215850
- **Spanish MEACorpus 2023**
  - Autores: Pan, García-Díaz, Rodríguez-García y Valencia-García, *Computer Standards & Interfaces* vol. 90 (2024).
  - 13,16 h y 5.129 segmentos de YouTube (habla natural), etiquetados con 6 emociones de Ekman más neutral.
  - **No redistribuye audio** por copyright: solo IDs, tiempos y transcripciones. Versión 2 en Zenodo, feb-2026.
  - Desbalance: no hay "surprise", hay poco "fear" y predominan neutral y disgust.
  - Se usó en el reto IberLEF 2024 EmoSPeech. El enfoque del equipo BSC-UPC usa attention pooling: https://arxiv.org/pdf/2407.12467
  - URL: https://portalcientifico.uned.es/documentos/6633a67f3eb1a152cbc0da67
- **Corpus infantil en español (México)**
  - Pérez-Espinosa, Reyes-García y Villaseñor-Pineda (2011).
  - Niños de **7 a 13 años** durante un juego de clasificación de cartas con un examinador.
  - 6 categorías más 3 primitivas continuas, con 11 evaluadores.
  - Es el más cercano a la población de Ñawinchay. Disponibilidad y licencia: [NV].
  - URL: https://www.springerpflege.de/chapter/10.1007/978-3-642-24571-8_7

### 1.7 Corpus de emoción en quechua collao (Scientific Data, 2022)
- **Referencia**: Paccotacya-Yanque et al. (UNSA, Arequipa). "A speech corpus of Quechua Collao for automatic dimensional emotion recognition", *Sci Data* 9 (2022), DOI 10.1038/s41597-022-01855-9.
- **Contenido**:
  - 12.420 segmentos, ~15 h 15 min.
  - **7 actores adultos** de 24 a 49 años (4 mujeres y 3 hombres), nacidos en Puno, Cusco y Apurímac.
  - **Habla actuada** a partir de guion.
  - **Sin niños.**
- **Etiquetas**:
  - Valencia, arousal y dominancia en escala 1–5, con 4 anotadores.
  - 9 categorías: happy, sad, bored, fear, sleepy, calm, excited, angry, neutral.
- **Línea base (CCC en test)**:
  - LSTM: media 0,731 (valencia 0,648, arousal 0,764, dominancia 0,782).
  - Random Forest: media 0,631.
- **Licencia**: el artículo es CC BY 4.0. La licencia del dataset en Figshare no figura en el artículo. Figshare suele usar CC BY 4.0. [NV]
- **Modelos entrenados con él**: solo las líneas base del paper. No se halló un modelo público en HF. [NV]
- **URL**:
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC9789950/
  - https://figshare.com/articles/media/Quechua_Collao_for_Speech_Emotion_Recognition/20292516

### 1.8 Evidencia con niños
- **FAU Aibo / corpus AIBO** (LREC 2004): niños alemanes e ingleses dando órdenes a un robot. Fue la base del Interspeech 2009 Emotion Challenge. No incluye español. https://aclanthology.org/L02-1174/ (enlace del resultado; verificar que corresponda) [NV]
- Hay pocos corpus infantiles con emoción anotada, y aún menos de lectura con disfluencias anotadas (arXiv 2010.04293).
- Lista general de corpus infantiles: https://en.wikipedia.org/wiki/List_of_children%27s_speech_corpora

---

## 2. Extracción de rasgos paralingüísticos y prosódicos

| Herramienta | Qué extrae | Licencia | Notas |
|---|---|---|---|
| **openSMILE 3.x** + `opensmile` (Python) | eGeMAPS (88 rasgos: F0, jitter, shimmer, loudness, HNR, formantes, tasas de segmentos sonoros) y ComParE | **Dual. Gratis para "private, research, and educational use". Prohibido en "any sort of commercial product"**: requiere licencia comercial de audEERING | eGeMAPS: Eyben et al., IEEE TAC 2016 [NV en esta sesión]. https://github.com/audeering/opensmile · https://github.com/audeering/opensmile-python |
| **Parselmouth** (Praat en Python) | F0, intensidad, jitter, shimmer, HNR, formantes, TextGrids | **GPL-3.0** (copyleft: cuidado si se distribuye el binario de la app; en servidor es menos crítico) | Activo (último push oct-2026). https://github.com/YannickJadoul/Parselmouth |
| **librosa** | pyin (F0), RMS, onsets, tempo, MFCC, espectrales | **ISC** (permisiva) | https://github.com/librosa/librosa |
| **DisVoice** | Rasgos de fonación (jitter, shimmer), articulación, prosodia (F0, energía, duraciones, pausas) y fluidez | **MIT** | Autor J.C. Vásquez-Correa (Univ. de Antioquia). Pensado para habla patológica en español. https://github.com/jcvasquezc/DisVoice |
| **pyAudioAnalysis** | Rasgos de corto plazo, segmentación por silencios y clasificación | **Apache-2.0** | https://github.com/tyiannak/pyAudioAnalysis |
| **surfboard** (Novoic) | F0, jitter, shimmer, formantes, rasgos clínicos | **GPL-3.0** y **repositorio ARCHIVADO** (2022) | No recomendado. https://github.com/Novoic/surfboard |

**Medidas útiles y cómo obtenerlas**:
- **Velocidad de habla y de articulación**: sílabas o palabras por segundo, contando o sin contar las pausas.
  - Con ASR: timestamps por palabra de Whisper o WhisperX.
  - Sin ASR: script de núcleos silábicos de Praat (de Jong & Wempe, 2009) [NV].
  - Para lectura, lo estándar es **PCPM** (palabras correctas por minuto).
- **Pausas**: tasa de pausas, duración media y pausas dentro o entre frases (VAD, por ejemplo Silero VAD [NV], o umbral de energía).
- **Pitch y entonación**: F0 con pyin o Praat, pendiente final de frase (descenso en enunciados, ascenso en preguntas) y rango de F0 (lectura monótona frente a expresiva).
- **Intensidad**: RMS o dB.
- **Jitter y shimmer**: se usan sobre todo en voz clínica. Su valor pedagógico es bajo y son inestables en niños, cuya F0 es alta.

---

## 3. Patrones de habla relevantes para lectura y razonamiento

### 3.1 Disfluencias, muletillas ("eh", "este", "mmm"), repeticiones y autocorrecciones
- **No se encontró un modelo ni un dataset de disfluencias de niños en español.**
- Lo más cercano:
  - **Black et al., Interspeech 2007 (USC)**: errores de lectura disfluentes en niños de K-2 de familias hispanohablantes (leyendo en inglés). El 21% de los enunciados tenía al menos un error disfluente. Detector de sound-outs, titubeos y susurros: 14,9% de detecciones perdidas y 8,9% de falsas alarmas. https://www.isca-archive.org/interspeech_2007/black07_interspeech.html
  - **"Analysis of Disfluency in Children's Speech"** (inglés, 2020). Destaca que la detección de disfluencias en lectura sirve para evaluar la competencia lectora. https://arxiv.org/pdf/2010.04293
  - **Whisper para pausas llenas en español** (Mateo et al., 2024): presentaciones orales de universitarios. https://scitepress.org/PublishedPapers/2024/126221
  - **Pausas llenas "eh" y "ah" en habla formal española** (Campillos y Alcántara; análisis con Praat): https://www.lllf.uam.es/ESP/Publicaciones/106_FullPaper.pdf
  - **Modelado de pausas llenas para ASR en español** (Rodríguez et al., Eurospeech 2001): https://www.isca-archive.org/eurospeech_2001/rodriguez01_eurospeech.html
  - **CrisperWhisper** (Nyra Health): Whisper ajustado para transcripción *verbatim* con muletillas y timestamps precisos. Inglés y alemán [NV]. El código es **MIT** (LICENSE del repositorio, 2026). La licencia de los **pesos en HF no se pudo verificar**; históricamente era CC-BY-NC-4.0 [NV]. https://github.com/nyrahealth/CrisperWhisper
- **Enfoque práctico**: con texto de referencia conocido (lectura), alinear el ASR contra el texto (forced alignment o comparación de secuencias) para detectar:
  - repeticiones (palabra o secuencia duplicada),
  - autocorrecciones (palabra errónea seguida de la correcta),
  - omisiones e inserciones,
  - titubeos (pausa larga o alargamiento antes de una palabra).
  
  Para el razonamiento oral (sin texto de referencia) usar un ASR verbatim más reglas para "eh", "este", "o sea" y reformulaciones. Hay que validarlo con audio infantil peruano.

### 3.2 Evaluación automática de la prosodia lectora (estilo NAEP)
- La escala NAEP de fluidez oral (4 niveles) y la *Multidimensional Fluency Scale* son la referencia humana [NV para el detalle de NAEP].
- **Multon et al., *Speech Communication* (2022)**: estimación de fluidez en primaria (francés) que combina rasgos lingüísticos (PCPM, repeticiones) y prosódicos. 1.063 lecturas de 442 niños, 29 evaluadores. https://hal.archives-ouvertes.fr/hal-03585934
- **Wang et al., *Frontiers in Education* (2024)**: puntuación de prosodia con deep learning y foco en generalización entre alumnos y textos. Los modelos previos generalizaban mal a textos y alumnos nuevos. https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2024.1440760/pdf
- **Tesis SMU 2026** (mismo autor): rasgos acústicos más silencios a nivel de frase y de chunk. https://scholar.smu.edu/simmons_depl_etds/24
- **Vaidya, Sahoo y Rao (IIT Bombay), arXiv 2405.19426**: wav2vec 2.0 ajustado de extremo a extremo con lecturas infantiles anotadas por expertos. https://arxiv.org/html/2405.19426v2
- **Duong y Mostow, Interspeech 2010** (Project LISTEN): prosodia de 55 niños de 7 a 10 años con un modelo de duración. https://www.isca-archive.org/interspeech_2010/duong10_interspeech.html
- **Ninguno está en español ni en quechua.** Haría falta un corpus propio anotado con rúbrica.

### 3.3 Confianza e incertidumbre en el habla ("feeling of knowing")
- **Smith & Clark (1993)**, *J. Memory and Language*, "On the course of answering questions": las respuestas inseguras llevan más latencia, entonación ascendente y "eh/um" [hallazgos NV, fuente secundaria].
- **Brennan & Williams (1995)**: los oyentes usan la prosodia y las pausas llenas para juzgar la incertidumbre del hablante. Las respuestas seguras tienden a entonación descendente y mayor volumen (según trabajos que lo citan).
- **Swerts & Krahmer (2005)**: prosodia audiovisual y *feeling of knowing* (adultos).
- **Pon-Barry & Shieber (2011)**, "Recognizing Uncertainty in Speech": clasificación automática de incertidumbre con rasgos prosódicos. https://arxiv.org/pdf/1103.1898
- **Niños**: Moore, Harris & Patriquin (1993), *J. Child Language*. Los niños empiezan a interpretar la certeza del hablante por indicios léxicos antes que por la prosodia; a los 5 años la prosodia ya modula. https://resolve-he.cambridge.org/core/journals/journal-of-child-language/article/abs/lexical-and-prosodic-eues-in-the-comprehension-of-relative-certainty/5338A3BBBE4F368885883AC664A9A2E9
- **Uso sugerido**: latencia antes de responder, pausas llenas y entonación final ascendente como **indicios de duda** para que el tutor ofrezca andamiaje ("¿quieres pensarlo de nuevo?"). No deben usarse como calificación.

---

## 4. Validez científica y marco legal

### 4.1 Críticas científicas
- **Barrett, Adolphs, Marsella, Martinez y Pollak (2019)**, "Emotional Expressions Reconsidered", *Psychological Science in the Public Interest* 20(1):1–68. No hay correspondencia fiable ni específica entre configuraciones expresivas y estados emocionales; hay alta variabilidad por contexto, cultura e individuo. Aunque se centra en la cara, el argumento aplica a la voz. [NV en esta sesión; cita estándar]
- **Caída entre corpus e idiomas**:
  - Latif et al. (2018): el SER "drops significantly in cross-corpus and cross-language scenarios".
  - Milner et al. (2022, arXiv 2207.02104): la transferencia ingenua entre corpus falla; la adaptación al dominio ayuda.
  - https://arxiv.org/pdf/2207.02104
- **Etiquetas actuadas frente a naturales**: el corpus quechua y la mayoría de los SER están actuados por adultos. La emoción actuada exagera los rasgos y generaliza mal al habla espontánea infantil.
- **Valencia**: es la dimensión más difícil. En el corpus quechua tiene el CCC más bajo y el menor acuerdo entre anotadores.
- **Niños**: tienen F0 y formantes más altos y mayor variabilidad, y los datos anotados escasean. No se encontró evidencia cuantitativa directa de la caída de SER de adultos a niños en esta búsqueda [NV], pero es esperable.

### 4.2 UE: AI Act, art. 5(1)(f)
- Prohíbe comercializar o usar sistemas de IA para **inferir emociones de personas en el lugar de trabajo y en instituciones educativas**, salvo por **razones médicas o de seguridad**. Aplica desde el **02-02-2025**.
- Solo cubre sistemas basados en **datos biométricos** (definición de sistema de reconocimiento de emociones, art. 3(39)). La voz cuenta como biométrico en ese sentido.
- Directrices de la Comisión (feb-2025):
  - "Seguridad" se entiende de forma restringida, como protección de la vida y la salud.
  - Se extiende también a la inferencia de **intenciones** (párr. 245).
  - Estados físicos como **fatiga o dolor no son emociones**.
- No está claro si queda cubierto cuando la emoción es una funcionalidad secundaria (FPF).
- Fuera de la prohibición, un sistema puede ser de alto riesgo (Anexo III).
- Fuentes:
  - https://fpf.org/blog/red-lines-under-eu-ai-act-unpacking-the-prohibition-of-emotion-recognition-in-the-workplace-and-education-institutions/
  - https://www.wsgrdataadvisor.com/2025/02/eu-commission-issues-guidelines-on-prohibited-ai-practices-under-eu-ai-act/
- **Relevancia**: solo si Ñawinchay se ofrece en la UE. Sirve como referencia de buenas prácticas.

### 4.3 Perú: Ley 31814 y su Reglamento, DS 115-2025-PCM (VERIFICADO en El Peruano)
- Publicado el **09-09-2025**. Entra en vigencia 90 días hábiles después de su publicación.
- **Art. 24.1 i) (ALTO RIESGO)**: inferir "las emociones de una persona física en los entornos de trabajo y en los centros educativos", con excepción para fines médicos o de seguridad. El texto aparece pegado al final del literal i).
- **Art. 24.1 b) (ALTO RIESGO)**: evaluaciones de NNA en el sector educativo (acceso, evaluación de aprendizajes, detección de conductas prohibidas en exámenes). **Excluye los sistemas complementarios que no reemplacen la evaluación pedagógica humana.** Esta excepción es clave para el diseño de Ñawinchay.
- **Art. 23.1 d) (USO INDEBIDO, prohibido)**: inferir datos sensibles (raza, opiniones políticas, creencias, orientación sexual) a partir de biométricos, y evaluaciones con resultados discriminatorios.
- **Art. 23.1 e)**: prohíbe la identificación biométrica en tiempo real para categorizar personas en espacios públicos.
- **Art. 12**: los servicios con IA deben considerar las necesidades diferenciadas de NNA.
- **Art. 36.1**: los NNA pueden alertar de usos indebidos a través de sus padres o tutores.
- **Art. 25**: transparencia algorítmica para sistemas de alto riesgo (informar, etiquetar, explicar).
- **Art. 26**: cumplir la normativa de protección de datos personales (Ley 29733, ANPDP).
- **Sector privado**:
  - Art. 31: registro de sistemas de alto riesgo y supervisión humana.
  - Art. 32: evaluación de impacto **voluntaria**; si se hace, debe conservarse 3 años.
- **Plazos para el sector privado (1ª DCF)**:
  - **Educación: 1 año** desde la publicación (≈ sep-2026, ya vencido o por vencer [NV para el cálculo exacto]).
  - Pequeña empresa: 2 años. Microempresa: 3 años.
- **Consulta**: la SGTD (PCM) absuelve consultas sobre si un sistema es de alto riesgo o indebido (arts. 23.3 y 24.2).
- **No hay prohibición expresa** del reconocimiento de emociones en educación. Es **alto riesgo con obligaciones**.
- Fuentes:
  - https://busquedas.elperuano.pe/dispositivo/NL/2436426-1
  - https://www.gob.pe/institucion/pcm/normas-legales/7133522-115-2025-pcm
- Además, la voz de menores es dato personal y posiblemente biométrico o sensible según la Ley 29733 y su reglamento (DS 016-2024-JUS). Requiere consentimiento de padres o tutores [NV; revisar con abogado].

---

## 5. Implicaciones para Ñawinchay (propuesta)
1. **Evitar el SER categórico o dimensional en el producto.**
   - Si se explora, que sea solo en investigación, con consentimiento, sin decisiones automáticas y documentado como alto riesgo (art. 24.1 i).
   - Con licencias permisivas, la única opción viable es emotion2vec+ (FunASR) o SpeechBrain. Nada de ello está validado en niños, en español peruano ni en quechua.
2. **Priorizar métricas de fluidez lectora**: PCPM, precisión, pausas, repeticiones, autocorrecciones y prosodia de fin de frase. Usar librosa (ISC) y DisVoice (MIT), y ASR con timestamps.
   - Evitar openSMILE en producción comercial sin licencia.
   - Parselmouth (GPL) solo en servidor, o tras revisar las obligaciones de copyleft.
3. **Indicios de duda en el razonamiento oral** (latencia, "eh/este", entonación ascendente), usados solo para andamiaje y no para calificar. Encaja con la exclusión de "sistemas complementarios que no reemplacen la evaluación pedagógica humana" del art. 24.1 b).
4. **Corpus propio**: grabar lecturas infantiles en español peruano y quechua sureño con consentimiento, anotadas con rúbrica de prosodia tipo NAEP. Es imprescindible para validar cualquier métrica.
5. **Consulta formal a la SGTD** sobre la clasificación de riesgo antes del lanzamiento.

## Pendientes [NV]
- Estado real del API de Hume (¿sunset en 2026?) y sus términos sobre menores.
- Licencia de los pesos de CrisperWhisper en HF.
- Licencia del dataset quechua en Figshare.
- Disponibilidad del corpus infantil mexicano (Pérez-Espinosa, 2011).
- Precisiones reportadas de SpeechBrain/SUPERB (cifras de memoria).
- Texto oficial de la escala NAEP de fluidez oral.
