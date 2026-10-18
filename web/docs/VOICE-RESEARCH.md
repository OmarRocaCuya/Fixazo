# Voz y lenguas indígenas: evidencia y decisiones

Revisión: 17 de octubre de 2026. Este documento distingue capacidades del código, disponibilidad del servidor y validación educativa. Un modelo publicado o una prueba unitaria no demuestran calidad con niños peruanos.

## Modelos y finalidad

| Componente | Elección | Qué no demuestra |
|---|---|---|
| Castellano sin cuenta de proveedor | Whisper base multilingüe convertido a ONNX, `onnx-community/whisper-base_timestamped`, Transformers.js 4.3.1; descarga explícita y ejecución en un Web Worker | No cubre quechua; no es streaming de baja latencia ni valida la precisión de lectura |
| Castellano por streaming opcional | Deepgram `nova-3`, `es-419`, hipótesis provisionales y tiempos por palabra | No identifica emociones, al niño ni ayuda adulta; no cubre quechua |
| Conversación de voz independiente | OpenAI `gpt-realtime-2.1`, voz `marin`, WebRTC, turnos manuales | No es el evaluador, no es un transcriptor fiel y no se declara universalmente «el mejor» |
| Lenguas indígenas | Meta Omnilingual ASR autoalojado, familia v2; códigos verificados `quy_Latn`, `quz_Latn`, `ayr_Latn` | Transcribe en la lengua original. El parámetro de lengua NO es una instrucción de traducción |
| Traducción experimental | Meta NLLB-200, solo tras habilitación explícita para investigación no comercial; `quy_Latn`, `ayr_Latn`, `spa_Latn` | No representa todas las variedades quechuas. No se sustituye `quz` por `quy`. Su licencia no habilita un producto comercial |
| Juez y misiones existentes | Reglas por defecto; Claude Haiku 5.5 opcional | Claude no escucha la lectura ni mejora por sí solo la alineación acústica |

Whisper local es una alternativa útil sin claves para castellano, **no un reemplazo de Meta para lenguas indígenas**. Descargar pesos y runtime genera peticiones de red; el audio de esa ruta se procesa localmente. La caché del navegador puede eliminarse.

## Fuentes primarias de implementación

- [Transformers.js: ejemplo oficial de timestamps](https://github.com/huggingface/transformers.js-examples/tree/main/whisper-word-timestamps), [versión 4.3.1](https://github.com/huggingface/transformers.js/releases/tag/4.3.1), [pesos ONNX](https://huggingface.co/onnx-community/whisper-base_timestamped). WASM q8 requiere unos 77 MB de pesos más runtime; el rendimiento depende del equipo. Los timestamps son estimaciones del ASR, no alineación forzada verificada.
- [Deepgram: streaming](https://developers.deepgram.com/docs/listen-live), [tokens temporales](https://developers.deepgram.com/reference/auth/grant), [exclusión de mejora del modelo](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program). La integración solicita `mip_opt_out=true`; el token de corta duración no es un límite de gasto ni de duración de la conexión.
- [OpenAI: agentes de voz](https://developers.openai.com/api/docs/guides/voice-agents), [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime), [modelo Realtime 2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1), [datos](https://developers.openai.com/api/docs/guides/your-data), [menores](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance). Las claves permanentes permanecen en servidor. Un piloto con voces infantiles exige revisión contractual y de privacidad; `store: false` no sustituye la aprobación de Zero Data Retention cuando corresponde.
- [Meta Omnilingual ASR: repositorio](https://github.com/facebookresearch/omnilingual-asr), [inferencia](https://github.com/facebookresearch/omnilingual-asr/blob/main/src/omnilingual_asr/models/inference/README.md), [artículo](https://arxiv.org/abs/2511.09690). Familia de modelos de transcripción para más de 1.600 lenguas; el soporte nominal no equivale a calidad validada para una variedad, edad o micrófono.
- [NLLB-200: ficha del modelo](https://huggingface.co/facebook/nllb-200-distilled-600M), [artículo](https://arxiv.org/abs/2207.04672). Pesos CC-BY-NC 4.0; la ficha no lo presenta como solución para producción. [Omnilingual MT (2026)](https://arxiv.org/abs/2603.16309) es investigación más reciente: no se integra basándose solo en el artículo sin verificar pesos ejecutables y licencia.

## Características propuestas y alcance seguro

| Señal | Uso admisible en este MVP | Límite |
|---|---|---|
| Conectores, evidencia textual, largo y mezcla de lenguas | Mostrar evidencia provisional, corregible y confirmable por familia/docente | No penalizar mezcla de lenguas; las reglas morfológicas necesitan revisión por hablantes |
| Pausas, latencia, ritmo, autocorrecciones y muletillas | Describir lo observado; separar tiempo de inferencia, descarga y voz del agente | Un ASR puede omitir vacilaciones y repeticiones; «no encontrado» no significa ausente en el audio |
| Prosodia de lectura | Estimación exploratoria local, nunca diagnóstico | Requiere validación de rúbrica y población antes de usar como evaluación formal |
| Cambio de ritmo respecto de sí mismo | Ofrecer una pausa genérica, solo en memoria | No etiquetar ansiedad, tristeza, agitación o cansancio ni guardar inferencias emocionales |
| Emoción | Autorreporte voluntario del niño, identificado como tal | No inferir estados emocionales o de salud de voz/tono |
| Ruido, saturación, interrupciones | Informar calidad y «No observable» | No son mediciones calibradas de dB SPL ni prueba de dictado adulto |
| Otra persona/ayuda | Declaración humana de ayuda | Diarización no prueba edad, identidad, parentesco ni que alguien dictó |
| Conversación | Registrar pedidos de repetir, preguntas y cambios de postura | Depende de transcripción y contexto; mantener una opinión con evidencia vale igual que cambiarla |

### Investigación relevante

1. [Harmsen et al., Interspeech 2025](https://www.isca-archive.org/interspeech_2025/harmsen25_interspeech.pdf): resultados de métricas lectoras en niños neerlandeses, no validación peruana. Las sustituciones e inserciones y los fenómenos que el ASR normaliza requieren cautela. No se proporciona el pasaje esperado al reconocedor para luego afirmar que su coincidencia prueba una lectura correcta.
2. [EmoBox, Interspeech 2024](https://www.isca-archive.org/interspeech_2024/ma24b_interspeech.pdf): benchmark multilingüe de reconocimiento emocional; no sustenta clasificar emociones de escolares quechuahablantes ni usar esa clasificación para notas.
3. [Huqariq, LREC 2022](https://aclanthology.org/2022.lrec-1.537/): recurso relevante para lenguas peruanas. La descripción de una futura publicación abierta no otorga licencia sobre una versión privada. No se descargaron ni redistribuyeron grabaciones de participantes.
4. [WhisperX](https://github.com/m-bain/whisperX) y [Montreal Forced Aligner](https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner): posibles componentes de alineación posteriores, no implementados por el mero hecho de citarlos. [Silero VAD](https://github.com/snakers4/silero-vad) y [librosa](https://github.com/librosa/librosa): herramientas acústicas, no modelos de diagnóstico emocional.

## Repositorios descargados para inspección

Se hicieron clones superficiales y dispersos fuera del paquete desplegable, en `outputs/research-repos/`. No se ejecutaron scripts de esos repositorios ni se descargaron sus modelos completos. No se incorporan repositorios Git anidados al producto.

| Repositorio | Commit inspeccionado | Licencia del código / advertencia |
|---|---|---|
| [deepgram/deepgram-js-sdk](https://github.com/deepgram/deepgram-js-sdk) | `73f7ea3c32b60ebbfddfc7faa1f662a2b8ea21a7` | MIT; el servicio tiene condiciones propias |
| [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | `9687b544c8c873080e6ff7e7d294c0b353cd9ab6` | MIT; no se añade SDK para la conexión WebRTC nativa |
| [huggingface/transformers.js-examples](https://github.com/huggingface/transformers.js-examples) | `204b0948e88cd2bdc046316e78b754359653caea` | Apache 2.0; revisar por separado pesos y runtime |
| [facebookresearch/omnilingual-asr](https://github.com/facebookresearch/omnilingual-asr) | `81f51e224ce9e74b02cc2a3eaf21b2d91d743455` | Apache 2.0; no confundir con la licencia no comercial de NLLB |

## Criterio para una siguiente validación

Medir WER/CER por variedad y grupo de edad, errores/latencia por dispositivo y ruido, falsos cierres de lectura y acuerdo docente. Para traducción, revisión por hablantes y evaluación de omisiones, alucinaciones y sentido cultural; no basta BLEU ni que el texto «suene bien». Conservar consentimiento y gobernanza comunitaria, minimizar grabaciones y permitir corregir/eliminar datos. No se promete funcionamiento «óptimo» sin esta evidencia.
