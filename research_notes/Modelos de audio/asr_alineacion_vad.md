# Ñawinchay: modelos de voz (ASR, alineación, VAD, TTS, diarización, frameworks)

Fecha de corte: 2026-10-17. Idiomas objetivo: español, quechua chanka (`quy`), quechua collao (`quz`; Puno = `qxp` en Common Voice).
Convención: **[V]** = verificado hoy en fuente oficial (model card en HF vía API, repo en GitHub vía API, paper o docs). **[NV]** = no verificado en esta sesión (viene de memoria o de una fuente secundaria).

---

## 0. Resumen ejecutivo

| Necesidad | Mejor opción abierta y comercializable | Nota |
|---|---|---|
| ASR quechua (quy/quz) | **Meta Omnilingual ASR** (`omniASR_CTC_300M/1B_v2`, `omniASR_LLM_*_v2`), Apache-2.0 | Es el único modelo grande con licencia comercial que cubre `quy_Latn` y `quz_Latn`. CER 2.7 (quy) y 0.2 (quz) en su propio test, que es probablemente habla leída o bíblica (sobreestima el rendimiento real). |
| ASR español en tiempo real | Parakeet TDT 0.6B v3 o Canary 1B v2 (CC-BY-4.0), Whisper large-v3-turbo (MIT) | Para streaming en la nube: OpenAI `gpt-realtime-whisper` / `gpt-transcribe`. |
| Alineación forzada y lectura en voz alta | CTC con **Omnilingual CTC** o MMS + `forced_align` (torchaudio) | MMS y MMS_FA son **CC-BY-NC**. Ojo: torchaudio está en mantenimiento. |
| VAD | **Silero VAD** (MIT) | |
| Turnos (end-of-turn) | Pipecat **smart-turn v3** (BSD-2) | LiveKit turn-detector usa una licencia propia y no cubre quechua. |
| TTS quechua | `facebook/mms-tts-quy` / `mms-tts-quz` | **CC-BY-NC-4.0**: no sirve para uso comercial. |
| Diarización | pyannote `speaker-diarization-community-1` (CC-BY-4.0, gated) | |
| Framework de agente de voz | LiveKit Agents (Apache-2.0), Pipecat (BSD-2) | |

**Alerta de licencias no comerciales (CC-BY-NC-4.0):** MMS (`mms-1b-all`, `mms-300m`, MMS_FA), `mms-tts-quy/quz`, Seamless M4T v2, cualquier fine-tune derivado de ellos (p. ej. `cportoca/MMS_Quechua_finetuned`), y `QuechuaBase/whisper-base-qxp-finetuned`. Coqui XTTS-v2 usa la Coqui Public Model License, que también es no comercial.

---

## 1. ASR multilingüe

### 1.1 Meta Omnilingual ASR [V]
- Repo: https://github.com/facebookresearch/omnilingual-asr · HF: https://huggingface.co/facebook/omniASR-CTC-1B
- Desarrollador: Meta FAIR. Lanzamiento: noviembre de 2025. Versión v2 y variantes "Unlimited": diciembre de 2025. No aparece ningún release nuevo en 2026.
- **Licencia:** código y modelos Apache-2.0. El corpus `facebook/omnilingual-asr-corpus` es CC-BY-4.0.
- **Cobertura:** más de 1600 idiomas. `lang_ids.py` incluye `quy_Latn`, `quz_Latn`, `spa_Latn` y otras 13 variedades de quechua (qub, quf, qug, quh, qul, qum, qup, qur, qus, quv, quw, qux…).
- **CER por idioma** (archivo `per_language_results_table_7B_llm_asr.csv`, modelo LLM 7B):
  - `quy_Latn`: 174.2 h de entrenamiento, **CER 2.7**
  - `quz_Latn`: 141.2 h de entrenamiento, **CER 0.2**. Este valor es sospechosamente bajo; seguramente el test es de habla leída o de dominio cerrado.
  - `spa_Latn`: 10 886.7 h de entrenamiento, CER 1.3
  - En el 78 % de los idiomas el CER queda por debajo de 10.
- **Checkpoints** (VRAM medida con BF16, batch 1 y 30 s de audio en una A100; la velocidad es relativa al LLM_7B):

| Modelo | Params | Descarga | VRAM | Velocidad |
|---|---|---|---|---|
| omniASR_CTC_300M(_v2) | 325.5M | 1.3 GiB | ~2 GiB | 96x |
| omniASR_CTC_1B(_v2) | 975M | 3.7 GiB | ~3 GiB | 48x |
| omniASR_CTC_3B(_v2) | 3.08B | 12 GiB | ~8 GiB | 32x |
| omniASR_CTC_7B(_v2) | 6.5B | 25 GiB | ~15 GiB | 16x |
| omniASR_LLM_300M/1B/3B/7B(_v2) | 1.63B a 7.8B | 6 a 30 GiB | ~5 a 17 GiB | ~1x |
| omniASR_LLM_Unlimited_*_v2 | igual | igual | ~5 a 17 GiB | ~1x (audio de cualquier longitud) |
| omniASR_LLM_7B_ZS (zero-shot) | 7.81B | 30 GiB | ~20 GiB | 0.5x |

- **Streaming:** no lo soporta de forma nativa. Los modelos CTC y LLM aceptan audio de menos de 40 s. Para tiempo real hay que trocear el audio con VAD y procesar fragmentos cortos.
- **CPU:** el CTC_300M es el candidato para CPU o edge, por tamaño (1.3 GiB) [NV: no hay benchmark de CPU publicado].
- **Encaje con Ñawinchay:** el CTC sirve también de modelo acústico para alineación forzada y para puntuar la lectura (posteriors por carácter). Es la mejor base para un fine-tune con habla infantil.
- **Habla infantil:** no hay evidencia publicada.

### 1.2 MMS (Massively Multilingual Speech), Meta [V]
- HF: https://huggingface.co/facebook/mms-1b-all
- **Licencia: CC-BY-NC-4.0** (también `mms-300m`). No sirve para uso comercial.
- Cobertura: la lista del card incluye `quy` y `quz` (líneas 1135-1136 del README) y `es`. Tiene más de 1000 adaptadores de idioma (se cargan con `load_adapter("quy")`) [V cobertura; el mecanismo de adaptadores es conocido].
- Tamaño: 1B parámetros [NV: VRAM, ~4 GB en fp16].
- Streaming: no.
- WER/CER: el paper MMS (Pratap et al., 2023) reporta CER en FLEURS y MMS-lab (Biblia) [NV: cifras específicas de quy].

### 1.3 Whisper (OpenAI) [V]
- `openai/whisper-large-v3` y `openai/whisper-large-v3-turbo` (809M), con licencia **MIT**.
- **Quechua: no está soportado.** La lista de 99 idiomas del card no incluye `qu`. Español sí.
- Streaming: no es nativo; se usan wrappers como whisper_streaming o WhisperLive [NV].
- **faster-whisper** (SYSTRAN, MIT, activo en 2026-10) https://github.com/SYSTRAN/faster-whisper y **whisper.cpp** (ggml-org, MIT, activo) https://github.com/ggml-org/whisper.cpp sirven para CPU o edge en español.
- Fine-tunes comunitarios para quechua (calidad no auditada):
  - `pollitoconpapass/whisper-small-cuzco-quechua`: Apache-2.0, entrenado con audio bíblico de Cusco (quz) https://huggingface.co/pollitoconpapass/whisper-small-cuzco-quechua
  - `QuechuaBase/whisper-base-qxp-finetuned`: **CC-BY-NC-4.0**, Puno https://huggingface.co/QuechuaBase/whisper-base-qxp-finetuned
  - `gmezan/whisper-quechua`, `Epiph0nE/whisper-quz`: sin licencia declarada [NV].

### 1.4 NVIDIA Parakeet / Canary (solo español) [V]
- `nvidia/parakeet-tdt-0.6b-v3`: **CC-BY-4.0**, 25 idiomas europeos incluido `es`, sin quechua. Card actualizado en 2026-08. https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- `nvidia/canary-1b-v2`: **CC-BY-4.0**, 25 idiomas, `es` incluido. https://huggingface.co/nvidia/canary-1b-v2
- Streaming: Parakeet TDT soporta inferencia por chunks en NeMo [NV]. Es muy rápido en GPU. Está entrenado con español de España y de Latinoamérica [NV].

### 1.5 Seamless M4T v2 (Meta) [V]
- `facebook/seamless-m4t-v2-large`: **CC-BY-NC-4.0**. Cubre 96 códigos, `es` sí, quechua **no**. https://huggingface.co/facebook/seamless-m4t-v2-large

### 1.6 Nubes comerciales
- **Google Cloud Speech-to-Text (Chirp 3 / chirp_3):** la página de idiomas soportados (docs.cloud.google.com) **no lista quechua** ni aimara ni guaraní [V por ausencia en el HTML]. `es-PE` sí está, con los modelos `short`, `telephony` y `telephony_short` (y `chirp_3` [NV para es-PE]). https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
- **Google USM:** el paper afirma más de 300 idiomas [NV: si incluye quechua; el modelo no es público].
- **Azure Speech:** la página de idiomas no muestra "Quechua" [V por ausencia en el HTML; la tabla puede cargarse dinámicamente, así que conviene reconfirmar].
- **AWS Transcribe:** no hay quechua; `es-US` y `es-ES` sí [V por ausencia o presencia en el HTML]. https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html
- **OpenAI:** las docs actuales recomiendan `gpt-transcribe` para integraciones nuevas y `gpt-realtime-whisper` para streaming de baja latencia. Siguen disponibles `gpt-4o-transcribe` y `gpt-4o-mini-transcribe`. Quechua: no hay lista oficial [NV] y probablemente el rendimiento sea malo. https://developers.openai.com/api/docs/guides/speech-to-text · https://developers.openai.com/api/docs/guides/realtime-transcription/index.html
- **Deepgram (Nova-3) y AssemblyAI (Universal-Streaming):** español en tiempo real sí, quechua no [NV].
- **Gemini Live API:** audio bidireccional, con español [NV]; quechua no está documentado [NV].

### 1.7 ASR específico para quechua [V salvo que se indique]
- `ivangtorre/wav2vec2-xlsr-300m-quechua`: **CC-BY-4.0**, XLS-R 300M afinado con el dataset de AmericasNLP 2022 (`ivangtorre/second_americas_nlp_2022`). Reporta CER [NV valor]. https://huggingface.co/ivangtorre/wav2vec2-xlsr-300m-quechua
- `cportoca/MMS_Quechua_finetuned`: **CC-BY-NC-4.0** (derivado de mms-1b-all), WER 0.317 en un dataset sin especificar.
- `QuechuaBase/wav2vec2-base-qxp-finetuned` (Puno) [NV licencia].
- **AmericasNLP:** la competencia de 2022 (NeurIPS) tuvo una tarea de ASR con quechua (https://proceedings.mlr.press/v220/ebrahimi23a.html). En 2025-2026 no encontré una tarea compartida de ASR de AmericasNLP con quechua [NV]. Lo más cercano es la tarea **IWSLT 2026 QUE→SPA** de traducción de voz, centrada en Collao (`quz`). El equipo QUESPA usó Whisper large-v3 + NLLB y SpeechT5, con BLEU 27.2 (https://aclanthology.org/2026.iwslt-1.5.pdf).

---

## 2. Datasets de voz en quechua

| Dataset | Variedad | Tamaño | Licencia | URL |
|---|---|---|---|---|
| **Siminchik** (Cardenas et al., LREC 2018) | Chanka + Collao, radio | ~97 h transcritas | [NV] | Citado en https://arxiv.org/pdf/2310.03639 |
| **Huqariq** (Zevallos et al., LREC 2022) | 4 lenguas peruanas, incluye quechua | 220 h, más de 500 voluntarios | [NV] | https://aclanthology.org/2022.lrec-1.537 · https://arxiv.org/abs/2207.05498 |
| **Common Voice 27.0** (2026-09-11), scripted | `quy` (Chanka) | **1.7 h en total, 0.05 h validadas**, 8 usuarios | CC0 [NV para CV27] | https://github.com/common-voice/cv-dataset |
| Common Voice 27.0 | `qxp` (Puno, Collao) | 34.88 h en total, 31.18 h validadas, 81 usuarios | CC0 | idem |
| Common Voice 27.0 | `quz` | **no existe como locale** | | |
| Common Voice Spontaneous 5.0 (2026-09-11) | `qxp` | 35.41 h en total, 5.18 h validadas, 110 usuarios | CC0 [NV] | idem |
| Paper sobre Puno en CV (Huaman et al., SIMBig 2025) | 17 variedades de quechua | 191.1 h en total en CV, 86 % validadas | | https://arxiv.org/abs/2510.13871 |
| Omnilingual ASR Corpus (Meta) | incluye quy/quz [NV horas propias del corpus] | | CC-BY-4.0 | HF `facebook/omnilingual-asr-corpus` |
| AmericasNLP 2022 (Quechua) | Sureño | [NV] | [NV] | `ivangtorre/second_americas_nlp_2022` |
| `josemercado/quechua-chanka-asr` | Chanka | 500 ejemplos, ~85 MB | no declarada | HF |
| `johann2357/quechua_bible_audio`, `pollitoconpapass/quechua-cuzco-bible-audio-dataset` | Biblia | [NV] | [NV] | HF |
| **Corpus emocional quechua collao** ("A speech corpus of Quechua Collao for…" emotion recognition) | Collao | [NV] | [NV] | https://sotaverified.org/papers/a-speech-corpus-of-quechua-collao-for · solo embeddings: `QuechuaBase/asr-ser-quechua-collao-embeddings` (CC-BY-4.0, sin audio crudo) |
| **Lurín** | [NV] | [NV] | [NV] | No lo encontré en esta sesión |

**No hay ningún corpus público de habla infantil en quechua** [NV, pero ninguna búsqueda devolvió uno]. Para Ñawinchay habrá que recolectarlo con consentimiento parental, en línea con la soberanía de datos indígenas que discute el paper de CV Puno.

---

## 3. Alineación forzada y evaluación de lectura

- **torchaudio `functional.forced_align` + `pipelines.MMS_FA`** [V]. El tutorial de 2.11 advierte: "deprecated in 2.8 and have been removed in 2.9". Sin embargo, la página `functional.html` de 2.11 todavía lista `forced_align` y `merge_tokens`. **Estado ambiguo**: conviene fijar la versión de torchaudio o usar la alternativa `ctc-forced-aligner` [NV]. Los pesos de MMS_FA son **CC-BY-NC** (derivan de MMS) [NV para el card de MMS_FA]. https://docs.pytorch.org/audio/2.11.0/tutorials/ctc_forced_alignment_api_tutorial.html · issue https://github.com/pytorch/audio/issues/3902
- **Alternativa comercializable:** usar las emisiones CTC de **Omnilingual CTC (Apache-2.0)** con un alineador CTC (Viterbi). Así se obtienen tiempos por palabra o carácter y puntuaciones de confianza por segmento.
- **WhisperX** (m-bain): BSD-2-Clause, activo en 2026-09. Alinea con wav2vec2 por idioma; para español hay un modelo de alineación por defecto [NV]; para quechua no. https://github.com/m-bain/whisperX
- **Montreal Forced Aligner:** MIT, activo en 2026-10. Tiene modelos acústicos y diccionarios MFA para español [NV: nombre exacto `spanish_mfa`]. Para quechua habría que entrenar uno (el quechua tiene ortografía casi fonémica, así que un G2P por reglas es viable). https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner
- **GOP (Goodness of Pronunciation):** se calcula con posteriors CTC (log-posterior del fonema o carácter esperado menos el máximo). Hay implementaciones en Kaldi y en papers con wav2vec2 [NV para una herramienta concreta].
- **Google Read Along:** usa reconocimiento en el dispositivo y es propietario. No hay modelo abierto [NV].
- **Fluidez lectora (ORF, palabras correctas por minuto):** no encontré una herramienta abierta y madura [NV]. El patrón recomendado es: (1) alinear el texto esperado con el audio por CTC, (2) marcar palabras omitidas, sustituidas o insertadas comparando contra la transcripción ASR y (3) calcular WCPM y prosodia (pausas a partir de los timestamps).

---

## 4. VAD y detección de turnos

- **Silero VAD:** **MIT**, activo en 2026-09. Corre en CPU, ONNX disponible. https://github.com/snakers4/silero-vad
- **WebRTC VAD** (`py-webrtcvad`): licencia NOASSERTION en GitHub. El código de WebRTC es BSD-3 [NV]. Último push en 2024 y es poco preciso con ruido. https://github.com/wiseman/py-webrtcvad
- **pyannote `segmentation-3.0`:** MIT, gated en HF (requiere aceptar condiciones). https://huggingface.co/pyannote/segmentation-3.0
- **LiveKit `turn-detector`:** licencia propia **"livekit-model-license"** (no es OSI; revisar sus términos). Idiomas: en, es, fr, de, it, pt, nl, zh, ja, ko, id, tr, ru, hi. **No incluye quechua.** https://huggingface.co/livekit/turn-detector
- **Pipecat `smart-turn-v3`:** **BSD-2-Clause** y modelo de audio puro (no depende del texto) [NV para la lista de idiomas; en la v3 se anunciaron 23 idiomas]. Repo https://github.com/pipecat-ai/smart-turn · HF https://huggingface.co/pipecat-ai/smart-turn-v3
- **Advertencia para niños:** los niños hacen pausas largas al leer. Hay que subir el umbral de silencio (por ejemplo, 1.5 a 3 s) o desactivar el end-of-turn durante la lectura y cerrar con un botón.

---

## 5. TTS

- `facebook/mms-tts-quy` y `facebook/mms-tts-quz` (VITS): **CC-BY-NC-4.0** [V]. https://huggingface.co/facebook/mms-tts-quy · https://huggingface.co/facebook/mms-tts-quz
- Alternativas comunitarias para quechua: `pollitoconpapass/quz-tts-model`, `johann2357/parler-tts-mini-v0.1-quechua`, dataset `Epiph0nE/quechua-puno-tts` [NV licencias]. Hay un paper de 2026 sobre TTS quechua-español a partir de la Constitución que combina Siminchik con otro corpus (~180 h) https://arxiv.org/pdf/2604.13288 [NV detalles].
- **Piper:** el repo original `rhasspy/piper` (MIT) está **archivado**; el sucesor es `OHF-Voice/piper1-gpl` con licencia **GPL-3.0** (ojo con el copyleft). Las voces en español (es_ES, es_MX) tienen licencias individuales [NV]. https://github.com/OHF-Voice/piper1-gpl
- **Coqui XTTS-v2:** **Coqui Public Model License (no comercial)** [V]. El fork que se mantiene es `idiap/coqui-ai-TTS` (código MPL-2.0). https://huggingface.co/coqui/XTTS-v2
- **Kokoro-82M:** Apache-2.0 [V]. El card declara solo `en`, aunque la librería `hexgrad/kokoro` incluye voces en español [NV]. https://huggingface.co/hexgrad/Kokoro-82M
- OpenAI TTS (`gpt-4o-mini-tts`) y ElevenLabs tienen voces en español de buena calidad; no tienen quechua [NV].

---

## 6. Diarización (voz adulta frente a infantil)

- `pyannote/speaker-diarization-community-1`: **CC-BY-4.0**, gated, de 2025-09 [V]. https://huggingface.co/pyannote/speaker-diarization-community-1
- `pyannote/speaker-diarization-3.1`: MIT, gated [V]. La librería `pyannote-audio` también es MIT [V].
- Separar niño de adulto no viene incluido: la diarización separa hablantes, pero no clasifica la edad. Opción: un clasificador de edad o tono (F0) encima de los embeddings [NV para un modelo abierto específico].

---

## 7. Frameworks de agentes de voz en tiempo real

- **LiveKit Agents:** **Apache-2.0**, muy activo (push 2026-10-17) [V]. https://github.com/livekit/agents
- **Pipecat:** **BSD-2-Clause**, muy activo [V]. Tiene integración con el STT de OpenAI, entre otros. https://github.com/pipecat-ai/pipecat

---

## 8. Evidencia sobre habla infantil

No encontré resultados publicados de ASR infantil en quechua ni en español infantil con estos modelos [NV]. Hay que asumir que el WER/CER sube bastante con niños (por el F0 más alto y la disfluencia) y planificar un fine-tune con datos propios, empezando por Omnilingual CTC.

## Fuentes principales
- https://github.com/facebookresearch/omnilingual-asr (y `per_language_results_table_7B_llm_asr.csv`, `lang_ids.py`)
- API de Hugging Face (`/api/models/...`) para las licencias de los cards citados
- https://github.com/common-voice/cv-dataset (cv-corpus-27.0-2026-09-11.json, sps-corpus-5.0-2026-09-11.json)
- https://arxiv.org/abs/2510.13871 · https://aclanthology.org/2022.lrec-1.537 · https://arxiv.org/pdf/2310.03639
- https://aclanthology.org/2026.iwslt-1.5.pdf
- https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
- https://docs.pytorch.org/audio/2.11.0/tutorials/ctc_forced_alignment_api_tutorial.html
