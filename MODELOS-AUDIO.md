# Ñawinchay · Catálogo de modelos de audio

Modelos de reconocimiento de voz (ASR), alineación, detección de voz y turnos, síntesis, emoción y patrones de habla útiles para el proyecto. Corte: 17 de octubre de 2026.

- **[V]** verificado en la fuente oficial (model card de Hugging Face, repositorio o documentación).
- **[NV]** no verificado: confirmar antes de citarlo en el pitch o de usarlo en producción.
- Notas completas con todos los enlaces: `research_notes/Modelos de audio/`.

---

## 0. Stack recomendado

| Pieza | Hackathon (demo) | Producto (comercial) |
|---|---|---|
| Voz a texto, quechua chanka | Omnilingual ASR `omniASR_CTC_300M_v2` o `LLM_1B_v2` con `quy_Latn` | Igual, afinado con voz infantil propia |
| Voz a texto, castellano en tiempo real | `gpt-realtime` / `gpt-realtime-whisper` (OpenAI) | Igual, o Parakeet TDT 0.6B v3 propio |
| Alineación forzada (PCPM) | Emisiones CTC de Omnilingual + alineador Viterbi | Igual |
| Detección de voz | Silero VAD | Igual |
| Fin de turno | Pipecat smart-turn v3 (castellano); umbral de silencio en quechua | Igual |
| Voz del agente en quechua | Audio grabado por Omar | Audio grabado + TTS propio con licencia comercial |
| Voz del agente en castellano | Voz del modelo realtime | Igual |
| Patrones de habla | librosa + reglas sobre la alineación | Igual + DisVoice |
| Emociones | Autorreporte del niño (caritas) | Igual. Sin modelo de emociones |
| Framework de voz | Pipecat o LiveKit Agents | Igual |

**Alerta de licencias.** Son **no comerciales** (CC-BY-NC): MMS (`mms-1b-all`, `mms-300m`, MMS_FA), `mms-tts-quy` y `mms-tts-quz`, Seamless M4T v2, los fine-tunes derivados de MMS, el modelo de emociones de audEERING y Coqui XTTS-v2. openSMILE es gratis solo para investigación o educación. Parselmouth y Piper (versión actual) son GPL-3.0. Sirven para la demo; no para un producto que se venda.

---

## 1. Voz a texto (ASR)

| Modelo | Uso en Ñawinchay | Quechua | Castellano | Licencia | Cómputo | Tiempo real | Notas |
|---|---|---|---|---|---|---|---|
| **Meta Omnilingual ASR** `omniASR_CTC_300M/1B/3B/7B_v2` [V] | Lectura y respuestas en quechua; base para alineación | `quy_Latn` (174 h, CER 2,7), `quz_Latn` (141 h, CER 0,2) | `spa_Latn` (CER 1,3) | **Apache-2.0** | CTC 300M: ~2 GiB VRAM; 7B: ~15 GiB | No nativo; audio < 40 s; trocear con VAD | Única opción grande, comercial y con quechua. El CER publicado es sobre habla adulta, probablemente leída: con niños será peor |
| Omnilingual ASR `omniASR_LLM_*_v2` y `LLM_Unlimited_*_v2` [V] | Respuestas libres largas | igual, con condicionamiento de idioma | sí | Apache-2.0 | ~5 a 17 GiB | No | Más preciso y más lento (~1x frente a 96x del CTC 300M) |
| MMS `facebook/mms-1b-all` (adaptadores `quy`, `quz`) [V] | Comparación en la demo | sí | sí | **CC-BY-NC-4.0** | ~4 GB fp16 [NV] | No | Solo no comercial |
| Whisper `large-v3`, `large-v3-turbo` [V] | Castellano fuera de línea | **no** | sí | MIT | turbo 809M; corre en CPU con whisper.cpp | Con envoltorios | Sin quechua |
| faster-whisper, whisper.cpp [V] | Castellano en CPU o dispositivo | no | sí | MIT | CPU | Parcial | Para la escuela sin buena red |
| NVIDIA **Parakeet TDT 0.6B v3** [V] | Castellano rápido propio | no | sí | CC-BY-4.0 | GPU pequeña | Por fragmentos [NV] | Muy rápido |
| NVIDIA **Canary 1B v2** [V] | Castellano propio | no | sí | CC-BY-4.0 | GPU | No | |
| Seamless M4T v2 [V] | — | no | sí | CC-BY-NC-4.0 | GPU | No | Descartado |
| OpenAI `gpt-realtime`, `gpt-realtime-whisper`, `gpt-transcribe` [V] | Agente de voz en castellano con interrupción | sin lista oficial; esperar mal rendimiento [NV] | sí | Comercial (API) | Nube | **Sí** | Costo por minuto a medir |
| Gemini Live API [NV] | Alternativa al anterior | no documentado | sí | Comercial (API) | Nube | Sí | |
| Deepgram Nova-3, AssemblyAI Universal-Streaming [NV] | Transcripción en vivo en castellano | no | sí | Comercial | Nube | Sí | |
| Google Chirp 3, Azure Speech, AWS Transcribe [V] | — | **no** | sí (`es-PE` en Google) | Comercial | Nube | Sí | Quechua no figura |
| `ivangtorre/wav2vec2-xlsr-300m-quechua` [V] | Comparación | quechua sureño (AmericasNLP 2022) | no | CC-BY-4.0 | GPU pequeña | No | CER [NV] |
| `pollitoconpapass/whisper-small-cuzco-quechua` [V] | Comparación | `quz` (audio bíblico) | — | Apache-2.0 | CPU/GPU | No | Calidad no auditada |
| `QuechuaBase/whisper-base-qxp-finetuned` [V] | Comparación | Puno | — | CC-BY-NC-4.0 | CPU | No | No comercial |
| `cportoca/MMS_Quechua_finetuned` [V] | — | quechua | — | CC-BY-NC-4.0 | GPU | No | WER 0,317 en datos no especificados |

**Habla infantil:** no hay resultados publicados de estos modelos con niños en quechua ni en castellano peruano. Hay que medirlo con voces reales y planificar un afinamiento de Omnilingual CTC con datos propios.

---

## 2. Datos de voz en quechua

| Dataset | Variedad | Tamaño | Licencia | Uso |
|---|---|---|---|---|
| Siminchik (LREC 2018) | chanka y collao, radio | ~97 h | [NV] | Afinamiento y prueba |
| Huqariq (LREC 2022) | quechua, aimara, shipibo | 220 h, 500+ voluntarios | [NV] (CC0 anunciado) | Afinamiento |
| Common Voice 27.0 `quy` (chanka) [V] | chanka | **1,7 h (0,05 h validadas)** | CC0 | Casi vacío: oportunidad de aportar |
| Common Voice 27.0 `qxp` (Puno) [V] | collao | 34,9 h (31,2 h validadas) | CC0 | Afinamiento |
| Common Voice Spontaneous 5.0 `qxp` [V] | collao, espontáneo | 35,4 h | CC0 [NV] | Habla no leída |
| Omnilingual ASR Corpus [V] | incluye quy/quz | [NV] | CC-BY-4.0 | Afinamiento |
| Corpus emocional quechua collao (Sci Data 2022) [V] | collao, actuado, 7 adultos | ~15 h | artículo CC BY 4.0; dataset [NV] | Solo investigación |
| `josemercado/quechua-chanka-asr` [V] | chanka | 500 ejemplos | no declarada | Pruebas rápidas |

**No existe un corpus público de habla infantil en quechua.** Hay que recolectarlo con consentimiento de familias y comunidad.

---

## 3. Alineación forzada y lectura en voz alta

| Herramienta | Uso | Licencia | Notas |
|---|---|---|---|
| **Emisiones CTC de Omnilingual + alineador Viterbi** [V] | Tiempo y confianza por palabra; PCPM; errores | Apache-2.0 | Opción comercializable recomendada |
| torchaudio `forced_align` + `MMS_FA` [V] | Igual | torchaudio BSD; pesos MMS_FA no comerciales [NV] | Estado de la API ambiguo entre versiones 2.9 y 2.11: fijar versión |
| WhisperX [V] | Tiempos por palabra en castellano | BSD-2 | Sin alineador para quechua |
| Montreal Forced Aligner [V] | Alineación fonética en castellano | MIT | Para quechua habría que entrenar (ortografía casi fonémica: viable) |
| GOP (Goodness of Pronunciation) [NV] | Puntuar cada palabra leída | Método | Se calcula con los posteriores CTC |
| Google Read Along [NV] | Referencia de producto | Propietario | No hay modelo abierto |

No hay una herramienta abierta y madura de fluidez lectora. Se construye así: alinear texto esperado y audio, comparar con la transcripción para marcar omisiones, sustituciones e inserciones, y calcular PCPM y pausas con los tiempos.

---

## 4. Detección de voz, fin de turno y diarización

| Herramienta | Uso | Licencia | Notas |
|---|---|---|---|
| **Silero VAD** [V] | Saber cuándo habla el niño; trocear audio | MIT | CPU, ONNX, también en navegador |
| WebRTC VAD [V] | Alternativa ligera | BSD-3 [NV] | Falla con ruido |
| pyannote `segmentation-3.0` [V] | Segmentación | MIT (acceso con registro) | |
| **Pipecat smart-turn v3** [V] | Fin de turno por audio | BSD-2 | 23 idiomas anunciados [NV]; sin quechua confirmado |
| LiveKit turn-detector [V] | Fin de turno | Licencia propia de LiveKit | 14 idiomas, sin quechua |
| pyannote `speaker-diarization-community-1` / `3.1` [V] | Separar voz del niño y del adulto | CC-BY-4.0 / MIT | No clasifica edad; añadir regla por tono (F0) |

**Regla para niños:** los niños hacen pausas largas al leer. Durante la lectura se desactiva el fin de turno automático (cierra el tiempo o el texto); en las respuestas se usa un umbral de silencio de 1,5 a 3 s.

---

## 5. Síntesis de voz (voz del agente)

| Modelo | Idioma | Licencia | Uso |
|---|---|---|---|
| **Audio grabado por Omar** | quechua chanka | propio | Preguntas fijas y contrapruebas de la demo (lo más confiable) |
| `facebook/mms-tts-quy`, `mms-tts-quz` [V] | quechua | **CC-BY-NC-4.0** | Solo demo o piloto sin fines de lucro |
| TTS quechua de la Constitución (arXiv 2604.13288) [NV] | quechua y castellano | [NV] | Referencia |
| Kokoro-82M [V] | castellano [NV] | Apache-2.0 | Castellano propio |
| Piper (`OHF-Voice/piper1-gpl`) [V] | castellano | GPL-3.0 (el original MIT está archivado) | Revisar licencia de cada voz |
| Coqui XTTS-v2 [V] | castellano | No comercial | Descartado |
| OpenAI `gpt-4o-mini-tts`, ElevenLabs [NV] | castellano | Comercial | Voz de alta calidad |

---

## 6. Emoción en la voz

### 6.1 Modelos que existen

| Modelo | Qué entrega | Datos de entrenamiento | Licencia | ¿Sirve para niños peruanos? |
|---|---|---|---|---|
| emotion2vec+ base / large [V] | 9 emociones + embeddings | 4.788 h / 42.526 h pseudoetiquetadas; idiomas no declarados | FunASR Model License v1.1 (atribución; cláusula rara: se pierde por "denigración") | No validado |
| audEERING `wav2vec2-large-robust-12-ft-emotion-msp-dim` [V] | activación, dominancia, valencia | MSP-Podcast, inglés, adultos | **CC-BY-NC-SA-4.0** | No; no comercial |
| SpeechBrain `emotion-recognition-wav2vec2-IEMOCAP` [V] | 4 emociones | IEMOCAP, inglés actuado | Apache-2.0 (el dataset es restrictivo) | No |
| `superb/hubert-large-superb-er` [V] | 4 emociones | IEMOCAP | Apache-2.0 | No |
| Hume AI Expression Measurement / EVI [NV] | 48 dimensiones de prosodia | propietario | Comercial | Estado confuso (posible cierre en 2026); envía voz de niños a EE. UU. |

| Corpus de emoción | Población | Nota |
|---|---|---|
| Quechua collao (Sci Data 2022) | 7 adultos, actuado | Valencia es la dimensión más difícil (CCC 0,648) |
| EmoMatchSpanishDB | 50 adultos, castellano de España | 2.050 audios |
| Spanish MEACorpus 2023 | YouTube, adultos | No redistribuye audio |
| Corpus infantil mexicano (Pérez-Espinosa 2011) | niños de 7 a 13 años | El más cercano; disponibilidad [NV] |

### 6.2 Por qué no usarlos para evaluar

- **Ningún modelo está entrenado con voz infantil en castellano ni en quechua.** La precisión cae fuerte al cambiar de corpus, idioma y edad (Latif 2018; Milner 2022).
- La relación entre expresión y emoción no es fiable ni universal (Barrett et al., 2019).
- **Perú (DS 115-2025-PCM, verificado):** inferir emociones en centros educativos es **alto riesgo** (art. 24.1 i): no está prohibido, pero exige transparencia (art. 25), registro y supervisión humana (art. 31). Las evaluaciones de niños en educación también son alto riesgo (art. 24.1 b), **salvo sistemas complementarios que no reemplazan la evaluación del docente**. Ñawinchay debe diseñarse dentro de esa excepción.
- **Unión Europea (AI Act, art. 5.1.f):** prohibido en educación desde febrero de 2025. Solo aplica si se ofrece en la UE.

**Decisión:** el estado de ánimo se recoge por **autorreporte** (caritas). Si en el futuro se investiga un modelo de emociones, que sea solo con consentimiento, sin decisiones automáticas y con consulta previa a la Secretaría de Gobierno y Transformación Digital (SGTD).

---

## 7. Patrones de habla útiles (lo que sí medimos)

| Patrón | Qué indica | Cómo se obtiene | Herramienta | Uso en la app |
|---|---|---|---|---|
| Palabras correctas por minuto (PCPM) | Fluidez lectora | correctas ÷ minutos, por alineación | Omnilingual CTC + alineador | Métrica principal de lectura |
| Precisión | Decodificación | correctas ÷ intentadas | idem | Informe |
| Omisiones, sustituciones, inserciones | Tipo de error | comparar alineación y transcripción | idem | Vista del adulto |
| Repeticiones | Duda o relectura | secuencia de palabras duplicada | reglas sobre la alineación | Señal de proceso |
| Autocorrecciones | Monitoreo (buena señal) | palabra errónea seguida de la correcta | reglas | Señal de proceso; no penaliza |
| Pausas largas (> 2 s) y su ubicación | Dificultad o lectura en frases | tiempos entre palabras; VAD | Silero VAD + tiempos | Prosodia y vista del adulto |
| Pausas en puntuación vs. dentro de frase | Lectura en frases (prosodia) | cruzar pausas con signos del texto | reglas | Escala de prosodia 1–4 |
| Velocidad de habla y de articulación | Ritmo | sílabas o palabras por segundo, con y sin pausas | tiempos del ASR; librosa | Contexto |
| Entonación final (sube o baja) | Pregunta, certeza o duda | pendiente de F0 al final de la frase | librosa `pyin` | Indicio de duda |
| Rango de F0 | Lectura monótona o expresiva | variación del tono | librosa | Prosodia |
| Latencia antes de responder | Tiempo para pensar o duda | fin de la pregunta → inicio de la respuesta | VAD | Indicio de duda; ofrecer ayuda |
| Muletillas ("eh", "este", "mmm", "creo", "no sé") | Duda o planificación | ASR literal + lista de palabras | ASR + reglas | Indicio de duda; nunca nota |
| Intensidad | Volumen, posible inseguridad o ruido | RMS / dB | librosa | Control de calidad del audio |

**Regla de uso:** estos patrones describen el proceso y sirven para que el agente ofrezca ayuda ("¿quieres pensarlo de nuevo?"). Nunca entran en el nivel ni en una nota.

**Investigación de referencia:** prosodia lectora automática en niños (Multon et al. 2022, francés; Vaidya et al. 2024; Duong y Mostow 2010); señales de incertidumbre (Brennan y Williams 1995; Pon-Barry y Shieber 2011; Moore et al. 1993 en niños); disfluencias en lectura infantil (Black et al. 2007). Ninguno está en castellano ni en quechua: hace falta un corpus propio anotado con rúbrica.

### 7.1 Herramientas de rasgos de audio

| Herramienta | Qué extrae | Licencia | ¿Producto comercial? |
|---|---|---|---|
| **librosa** | tono (pyin), energía, MFCC, tempo | ISC | Sí |
| **DisVoice** | fonación, articulación, prosodia, fluidez (pensado para castellano) | MIT | Sí |
| pyAudioAnalysis | rasgos y segmentación por silencios | Apache-2.0 | Sí |
| openSMILE (eGeMAPS, 88 rasgos) | conjunto estándar de rasgos de voz | Gratis solo para investigación o educación | No sin licencia de pago |
| Parselmouth (Praat) | tono, intensidad, formantes | GPL-3.0 | Solo en servidor o revisando copyleft |
| surfboard | rasgos clínicos | GPL-3.0, archivado | No |
| CrisperWhisper | transcripción literal con muletillas | código MIT; pesos [NV] | Revisar; inglés y alemán |

---

## 8. Frameworks de agente de voz en tiempo real

| Framework | Licencia | Nota |
|---|---|---|
| **Pipecat** [V] | BSD-2 | Integra OpenAI realtime, Silero VAD y smart-turn |
| **LiveKit Agents** [V] | Apache-2.0 | WebRTC propio, muy activo |

---

## 9. Pendientes por verificar

- Licencias de Siminchik, Huqariq y del corpus emocional quechua.
- Licencia de los pesos de MMS_FA y de CrisperWhisper.
- Idiomas de Gemini Live, Deepgram y AssemblyAI.
- Estado real de la API de Hume.
- CER de Omnilingual con voz infantil y con ruido de casa o aula (medir el día de la demo con Omar y voluntarios).
- Costo por minuto de `gpt-realtime` en castellano.
