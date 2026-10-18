"""Bounded, in-memory Meta ASR/translation runtime; no ML imports at startup."""

from __future__ import annotations

import hashlib
import hmac
import io
import gc
import math
import os
from pathlib import Path
import threading
import wave
from dataclasses import dataclass
from typing import Any, Callable

from ctc_timing import MAX_TIMED_SECONDS, MAX_TIMED_WORDS, TIMED_MODEL, TIMING_METHOD, TimingUnavailable, infer_asr_timed, normalized_text, timing_supported
from speech import SPEECH_MODELS, SpeechAudio, SpeechFailure, infer_speech, load_speech, validate_speech, validate_speech_audio
from dialogue import DIALOGUE_MODEL, DIALOGUE_MODE, DialogueFailure, infer_dialogue, load_dialogue, validate_dialogue
from emotion import EMOTION_ATTRIBUTION, EMOTION_LICENSE, EMOTION_MODEL, EMOTION_REVISION, MAX_EMOTION_SECONDS, MIN_EMOTION_SECONDS, EmotionFailure, infer_emotion, load_emotion, normalize_emotion_result, warmup_audio

ASR_LANGUAGES = ("spa_Latn", "quy_Latn", "quz_Latn", "ayr_Latn")
TRANSLATION_LANGUAGES = ("spa_Latn", "quy_Latn", "ayr_Latn")
ASR_MODELS = tuple(f"omniASR_LLM_{size}_v2" for size in ("300M", "1B", "3B", "7B")) + ("omniASR_CTC_300M_v2",)
NLLB_MODEL = "facebook/nllb-200-distilled-600M"
OMNI_SOURCE_REVISION = "81f51e224ce9e74b02cc2a3eaf21b2d91d743455"
MAX_AUDIO_BYTES = 1_000_000
MAX_BODY_BYTES = 1_010_000  # Below Starlette's 1 MiB file-spooling threshold.
MAX_AUDIO_SECONDS = 30


class ServiceError(Exception):
    def __init__(self, code: str, status: int):
        super().__init__(code)
        self.code = code
        self.status = status


def configured_api_key() -> str:
    """Support Docker's explicit *_FILE convention, never echo secret paths."""
    value = os.getenv("INDIGENOUS_API_KEY", "")
    secret_file = os.getenv("INDIGENOUS_API_KEY_FILE", "")
    if not secret_file:
        return value
    if value:
        raise ValueError("Configure either INDIGENOUS_API_KEY or INDIGENOUS_API_KEY_FILE, not both")
    try:
        with Path(secret_file).open("rb") as stream:
            raw = stream.read(515)
        if len(raw) > 514:
            raise ValueError("secret too large")
        value = raw.decode("utf-8").strip()
        if len(value) > 512:
            raise ValueError("secret too large")
        return value
    except (OSError, UnicodeError, ValueError):
        raise ValueError("Cannot read the configured API secret file") from None


@dataclass(frozen=True)
class Settings:
    api_key: str = ""
    asr_model: str = "omniASR_LLM_300M_v2"
    device: str = "auto"
    research_translation: bool = False
    research_accepted: bool = False
    warmup: bool = False
    research_speech: bool = False
    speech_accepted: bool = False
    local_reading_llm: bool = False
    experimental_emotion: bool = False
    emotion_license_accepted: bool = False
    emotion_warmup: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        model = os.getenv("INDIGENOUS_ASR_MODEL", "omniASR_LLM_300M_v2")
        device = os.getenv("INDIGENOUS_DEVICE", "auto")
        if model not in ASR_MODELS or device not in ("auto", "cuda", "cpu"):
            raise ValueError("Unsupported model/device configuration")
        return cls(
            api_key=configured_api_key(), asr_model=model, device=device,
            research_translation=os.getenv("ENABLE_RESEARCH_TRANSLATION") == "true",
            research_accepted=os.getenv("NLLB_NONCOMMERCIAL_RESEARCH_ACCEPTED") == "true",
            warmup=os.getenv("INDIGENOUS_WARMUP") == "true",
            research_speech=os.getenv("ENABLE_RESEARCH_SPEECH") == "true",
            speech_accepted=os.getenv("MMS_NONCOMMERCIAL_RESEARCH_ACCEPTED") == "true",
            local_reading_llm=os.getenv("ENABLE_LOCAL_READING_LLM") == "true",
            experimental_emotion=os.getenv("ENABLE_EXPERIMENTAL_EMOTION") == "true",
            emotion_license_accepted=os.getenv("EMOTION2VEC_LICENSE_ACCEPTED") == "true",
            emotion_warmup=os.getenv("EMOTION_WARMUP") == "true",
        )

    @property
    def configured(self) -> bool:
        return 32 <= len(self.api_key) <= 512 and all(33 <= ord(character) <= 126 for character in self.api_key)

    @property
    def translation_enabled(self) -> bool:
        return self.research_translation and self.research_accepted

    @property
    def speech_enabled(self) -> bool:
        return self.research_speech and self.speech_accepted

    @property
    def emotion_enabled(self) -> bool:
        return self.experimental_emotion and self.emotion_license_accepted


def authorize(settings: Settings, header: str) -> None:
    if not settings.configured:
        raise ServiceError("service-not-configured", 503)
    supplied = header[7:] if header.startswith("Bearer ") else ""
    if len(supplied) > 512 or not hmac.compare_digest(
        hashlib.sha256(supplied.encode()).digest(), hashlib.sha256(settings.api_key.encode()).digest()
    ):
        raise ServiceError("unauthorized", 401)


@dataclass(frozen=True)
class Audio:
    pcm: bytes
    frames: int

    @property
    def seconds(self) -> float:
        return self.frames / 16_000


def validate_wav(payload: bytes) -> Audio:
    if not payload or len(payload) > MAX_AUDIO_BYTES:
        raise ServiceError("audio-size-invalid", 413)
    try:
        with wave.open(io.BytesIO(payload), "rb") as reader:
            if (reader.getnchannels(), reader.getsampwidth(), reader.getframerate(), reader.getcomptype()) != (1, 2, 16_000, "NONE"):
                raise ServiceError("wav-must-be-pcm16-mono-16000hz", 422)
            frames = reader.getnframes()
            if frames < 1600 or frames > MAX_AUDIO_SECONDS * 16_000:
                raise ServiceError("audio-duration-invalid", 422)
            pcm = reader.readframes(frames + 1)
            if len(pcm) != frames * 2:
                raise ServiceError("truncated-audio", 422)
    except (wave.Error, EOFError, OSError, ValueError):
        raise ServiceError("invalid-wav", 422) from None
    # Silence cannot be educational evidence. Do not ask a generative ASR to
    # invent a transcript for an entirely zero-valued microphone stream.
    if not any(pcm):
        raise ServiceError("no-audio-signal", 422)
    return Audio(pcm, frames)


def validate_language(language: Any) -> str:
    if not isinstance(language, str) or language not in ASR_LANGUAGES:
        raise ServiceError("unsupported-asr-language", 422)
    return language


def validate_translation(payload: Any) -> tuple[str, str, str]:
    if not isinstance(payload, dict) or set(payload) != {"text", "sourceLanguage", "targetLanguage"}:
        raise ServiceError("invalid-translation-request", 422)
    text, source, target = payload["text"], payload["sourceLanguage"], payload["targetLanguage"]
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 1500:
        raise ServiceError("translation-text-too-long-or-empty", 422)
    if not isinstance(source, str) or not isinstance(target, str) or source not in TRANSLATION_LANGUAGES or target not in TRANSLATION_LANGUAGES:
        # quz (Cusco) is NOT silently re-labelled as quy (Ayacucho).
        raise ServiceError("unsupported-translation-language", 422)
    if source == target:
        raise ServiceError("translation-languages-must-differ", 422)
    return text.strip(), source, target


def load_asr(settings: Settings) -> Any:
    import torch
    from omnilingual_asr.models.inference.pipeline import ASRInferencePipeline

    device = ("cuda" if torch.cuda.is_available() else "cpu") if settings.device == "auto" else settings.device
    dtype = torch.float32 if device == "cpu" else (torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16)
    return ASRInferencePipeline(model_card=settings.asr_model, device=device, dtype=dtype)


def infer_asr(pipeline: Any, audio: Audio, language: str, conditioned: bool) -> str:
    import torch

    waveform = torch.frombuffer(bytearray(audio.pcm), dtype=torch.int16).to(torch.float32).div_(32768.0)
    return pipeline.transcribe(
        [{"waveform": waveform, "sample_rate": 16_000}],
        lang=[language] if conditioned else None,
        batch_size=1,
    )[0]


def load_translation(settings: Settings) -> tuple[Any, Any]:
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    # Separate device avoids silently occupying scarce ASR GPU memory. This
    # research demo is deliberately sentence-sized, not a real-time translator.
    tokenizer = AutoTokenizer.from_pretrained(NLLB_MODEL, revision="f8d333a098d19b4fd9a8b18f94170487ad3f821d", trust_remote_code=False)
    model = AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL, revision="f8d333a098d19b4fd9a8b18f94170487ad3f821d", trust_remote_code=False, torch_dtype=torch.float32)
    model.eval()
    return tokenizer, model


def infer_translation(bundle: tuple[Any, Any], text: str, source: str, target: str) -> str:
    import torch

    tokenizer, model = bundle
    tokenizer.src_lang = source
    inputs = tokenizer(text, return_tensors="pt", truncation=False)
    if inputs["input_ids"].shape[-1] > 256:
        raise ServiceError("translation-input-exceeds-256-tokens", 422)
    with torch.inference_mode():
        output = model.generate(**inputs, forced_bos_token_id=tokenizer.convert_tokens_to_ids(target), max_new_tokens=256, do_sample=False)
    return tokenizer.batch_decode(output, skip_special_tokens=True)[0]


class Runtime:
    """One ASR/NLLB/dialogue model and one TTS language, serialized, no queue."""

    def __init__(self, settings: Settings, *, asr_loader: Callable = load_asr, asr_infer: Callable = infer_asr, translation_loader: Callable = load_translation, translation_infer: Callable = infer_translation, timed_infer: Callable = infer_asr_timed, speech_loader: Callable = load_speech, speech_infer: Callable = infer_speech, dialogue_loader: Callable = load_dialogue, dialogue_infer: Callable = infer_dialogue, emotion_loader: Callable = load_emotion, emotion_infer: Callable = infer_emotion):
        self.settings = settings
        self._asr_loader, self._asr_infer = asr_loader, asr_infer
        self._translation_loader, self._translation_infer = translation_loader, translation_infer
        self._timed_infer = timed_infer
        self._speech_loader, self._speech_infer = speech_loader, speech_infer
        self._dialogue_loader, self._dialogue_infer = dialogue_loader, dialogue_infer
        self._emotion_loader, self._emotion_infer = emotion_loader, emotion_infer
        self._emotion: Any = None
        self._emotion_loading = False
        self._emotion_error: str | None = None
        self._emotion_verified = False
        self._asr: Any = None
        self._translation: Any = None
        self._speech: Any = None
        self._speech_language: str | None = None
        self._dialogue: Any = None
        self._lock = threading.BoundedSemaphore(1)
        self._asr_loading = self._translation_loading = False
        self._asr_error: str | None = None
        self._translation_error: str | None = None
        self._speech_loading = False
        self._speech_error: str | None = None
        self._dialogue_loading = False
        self._dialogue_error: str | None = None

    @property
    def conditioned(self) -> bool:
        return not self.settings.asr_model.startswith("omniASR_CTC_")

    def status(self) -> dict:
        return {
            "configured": self.settings.configured,
            "asr": {"ready": self._asr is not None, "loading": self._asr_loading, "lastError": self._asr_error, "model": self.settings.asr_model, "languages": list(ASR_LANGUAGES), "languageConditioned": self.conditioned, "wordTimestamps": self.settings.asr_model == TIMED_MODEL and (self._asr is None or timing_supported(self._asr)), "timingMethod": TIMING_METHOD if self.settings.asr_model == TIMED_MODEL else None, "sourceRevision": OMNI_SOURCE_REVISION},
            "translation": {"ready": self._translation is not None, "enabled": self.settings.translation_enabled, "loading": self._translation_loading, "lastError": self._translation_error, "model": NLLB_MODEL, "languages": list(TRANSLATION_LANGUAGES), "researchOnly": True},
            "speech": {"enabled": self.settings.speech_enabled, "ready": {language: self._speech is not None and self._speech_language == language for language in SPEECH_MODELS}, "loading": self._speech_loading, "lastError": self._speech_error, "models": dict(SPEECH_MODELS), "languages": list(SPEECH_MODELS), "researchOnly": True},
            "dialogue": {"enabled": self.settings.local_reading_llm, "ready": self._dialogue is not None, "loading": self._dialogue_loading, "lastError": self._dialogue_error, "model": DIALOGUE_MODEL, "mode": DIALOGUE_MODE, "researchOnly": True},
            "emotion": {"enabled": self.settings.emotion_enabled, "loaded": self._emotion is not None, "ready": self._emotion_verified and not self._emotion_loading, "inferenceVerified": self._emotion_verified, "loading": self._emotion_loading, "lastError": self._emotion_error, "model": EMOTION_MODEL, "revision": EMOTION_REVISION, "license": EMOTION_LICENSE, "experimental": True},
        }

    def _ensure_asr(self) -> None:
        if self._asr is None:
            self._asr_loading = True
            try:
                self._asr = self._asr_loader(self.settings)
                self._asr_error = None
            except Exception:
                self._asr_error = "model-load-failed"
                raise ServiceError("asr-model-unavailable", 503) from None
            finally:
                self._asr_loading = False

    def _ensure_translation(self) -> None:
        if self._translation is None:
            self._translation_loading = True
            try:
                self._translation = self._translation_loader(self.settings)
                self._translation_error = None
            except Exception:
                self._translation_error = "model-load-failed"
                raise ServiceError("translation-model-unavailable", 503) from None
            finally:
                self._translation_loading = False

    def _ensure_speech(self, language: str) -> None:
        if self._speech is not None and self._speech_language == language:
            return
        # Only one TTS language is resident; disk caches contain weights only.
        self._speech = None
        self._speech_language = None
        gc.collect()
        self._speech_loading = True
        try:
            self._speech = self._speech_loader(self.settings, language)
            self._speech_language = language
            self._speech_error = None
        except Exception:
            self._speech_error = "model-load-failed"
            raise ServiceError("tts-model-unavailable", 503) from None
        finally:
            self._speech_loading = False

    def warmup(self) -> None:
        if not self.settings.configured or not self._lock.acquire(blocking=False):
            return
        try:
            # Prioritize the small emotion model; the same worker/semaphore
            # then warms ASR, so enabling both cannot starve either loader.
            if self.settings.emotion_enabled:
                self._prepare_emotion_locked()
        except ServiceError:
            pass
        try:
            self._ensure_asr()
            if self.settings.translation_enabled:
                self._ensure_translation()
        except ServiceError:
            pass  # Read /health; never log raw exceptions, paths, audio or text.
        finally:
            self._lock.release()

    def start_emotion_warmup(self) -> None:
        """Load and verify only emotion in the background; never load ASR.

        A cold user request must not wait through a model download (potentially
        minutes) and hit the web proxy timeout. One semaphore owns both loading
        and inference; repeated requests cannot spawn duplicate downloads.
        """
        if not self.settings.configured or not self.settings.emotion_enabled or self._emotion_verified:
            return
        if not self._lock.acquire(blocking=False):
            return
        self._emotion_loading = True

        def prepare():
            try:
                self._prepare_emotion_locked()
            except ServiceError:
                pass  # Sanitized state is available from /health.
            finally:
                self._lock.release()

        try:
            threading.Thread(target=prepare, daemon=True, name="emotion-warmup").start()
        except Exception:
            self._emotion_loading = False
            self._emotion_error = "model-load-failed"
            self._lock.release()

    def _prepare_emotion_locked(self) -> None:
        self._emotion_loading = True
        try:
            self._ensure_emotion()
            normalize_emotion_result(self._emotion_infer(self._emotion, warmup_audio()))
            self._emotion_verified = True
            self._emotion_error = None
        except ServiceError:
            raise
        except Exception:
            self._emotion = None
            self._emotion_verified = False
            self._emotion_error = "model-inference-failed"
            raise ServiceError("emotion-inference-failed", 503) from None
        finally:
            self._emotion_loading = False

    def _ensure_dialogue(self) -> None:
        if self._dialogue is not None:
            return
        self._dialogue_loading = True
        try:
            self._dialogue = self._dialogue_loader(self.settings)
            self._dialogue_error = None
        except Exception:
            self._dialogue_error = "model-load-failed"
            raise ServiceError("dialogue-model-unavailable", 503) from None
        finally:
            self._dialogue_loading = False

    def _ensure_emotion(self) -> None:
        if self._emotion is not None:
            return
        self._emotion_loading = True
        try:
            self._emotion = self._emotion_loader(self.settings)
            self._emotion_error = None
        except Exception:
            self._emotion_error = "model-load-failed"
            raise ServiceError("emotion-model-unavailable", 503) from None

    def emotion(self, payload: bytes) -> dict:
        """EXPERIMENTAL: 9-class emotion probabilities for one short utterance."""
        if not self.settings.experimental_emotion:
            raise ServiceError("not-found", 404)
        if not self.settings.emotion_license_accepted:
            raise ServiceError("emotion-license-not-accepted", 403)
        audio = validate_wav(payload)
        if not MIN_EMOTION_SECONDS <= audio.seconds <= MAX_EMOTION_SECONDS:
            raise ServiceError("emotion-audio-duration-invalid", 422)
        if not self._emotion_verified:
            self.start_emotion_warmup()
            code = "emotion-model-loading" if self._emotion_loading or self._emotion_verified else "emotion-model-unavailable" if self._emotion_error else "model-busy"
            raise ServiceError(code, 503)
        if not self._lock.acquire(blocking=False):
            raise ServiceError("model-busy", 503)
        try:
            self._ensure_emotion()
            labels = normalize_emotion_result(self._emotion_infer(self._emotion, audio))
            self._emotion_error = None
            return {"labels": labels, "top": labels[0], "model": EMOTION_MODEL, "revision": EMOTION_REVISION, "license": EMOTION_LICENSE, "attribution": EMOTION_ATTRIBUTION, "durationSeconds": audio.seconds, "experimental": True, "requiresHumanReview": True}
        except EmotionFailure as error:
            self._emotion_error = "model-inference-failed"
            self._emotion_verified = False
            raise ServiceError(error.code, error.status) from None
        except ServiceError:
            raise
        except Exception:
            self._emotion_error = "model-inference-failed"
            self._emotion_verified = False
            raise ServiceError("emotion-inference-failed", 503) from None
        finally:
            self._lock.release()

    def transcribe(self, payload: bytes, language: Any) -> dict:
        language = validate_language(language)
        audio = validate_wav(payload)
        if not self._lock.acquire(blocking=False):
            raise ServiceError("model-busy", 503)
        try:
            self._ensure_asr()
            text = self._asr_infer(self._asr, audio, language, self.conditioned)
            if not isinstance(text, str) or not text.strip() or len(text) > 8000:
                raise ServiceError("no-observable-transcript", 422)
            return {"text": text.strip(), "language": language, "model": self.settings.asr_model, "durationSeconds": audio.seconds, "wordTimestamps": False, "languageConditioned": self.conditioned, "requiresHumanReview": True}
        except ServiceError:
            raise
        except Exception:
            raise ServiceError("asr-inference-failed", 503) from None
        finally:
            self._lock.release()

    def translate(self, payload: Any) -> dict:
        if not self.settings.translation_enabled:
            raise ServiceError("research-translation-disabled", 403)
        text, source, target = validate_translation(payload)
        if not self._lock.acquire(blocking=False):
            raise ServiceError("model-busy", 503)
        try:
            self._ensure_translation()
            translated = self._translation_infer(self._translation, text, source, target)
            if not isinstance(translated, str) or not translated.strip() or len(translated) > 8000:
                raise ServiceError("translation-not-observable", 422)
            return {"text": translated.strip(), "sourceLanguage": source, "targetLanguage": target, "model": NLLB_MODEL, "researchOnly": True, "requiresHumanReview": True}
        except ServiceError:
            raise
        except Exception:
            raise ServiceError("translation-inference-failed", 503) from None
        finally:
            self._lock.release()

    def transcribe_timed(self, payload: bytes, language: Any) -> dict:
        language = validate_language(language)
        audio = validate_wav(payload)
        if audio.seconds > MAX_TIMED_SECONDS:
            raise ServiceError("timed-audio-duration-invalid", 422)
        if self.settings.asr_model != TIMED_MODEL:
            raise ServiceError("timed-asr-unavailable", 503)
        if not self._lock.acquire(blocking=False):
            raise ServiceError("model-busy", 503)
        try:
            self._ensure_asr()
            text, words = self._timed_infer(self._asr, audio, language)
            if not isinstance(text, str) or not text.strip() or len(text) > 8000:
                raise ServiceError("no-observable-transcript", 422)
            if not isinstance(words, list) or not 1 <= len(words) <= MAX_TIMED_WORDS:
                raise TimingUnavailable()
            previous_end = 0.0
            for item in words:
                if not isinstance(item, dict) or set(item) != {"word", "start", "end", "confidence"}:
                    raise TimingUnavailable()
                word, start, end = item["word"], item["start"], item["end"]
                if not isinstance(word, str) or not word or any(c.isspace() for c in word) or item["confidence"] is not None:
                    raise TimingUnavailable()
                if any(type(value) not in (int, float) or not math.isfinite(value) for value in (start, end)) or not previous_end <= start < end <= audio.seconds:
                    raise TimingUnavailable()
                previous_end = end
            if " ".join(item["word"] for item in words) != normalized_text(text):
                raise TimingUnavailable()
            return {"text": normalized_text(text), "language": language, "model": self.settings.asr_model, "durationSeconds": audio.seconds, "words": words, "wordTimestamps": True, "timingMethod": TIMING_METHOD, "languageConditioned": False, "requiresHumanReview": True}
        except TimingUnavailable:
            raise ServiceError("timed-asr-unavailable", 503) from None
        except ServiceError:
            raise
        except Exception:
            raise ServiceError("asr-inference-failed", 503) from None
        finally:
            self._lock.release()

    def speak(self, payload: Any) -> tuple[SpeechAudio, str, str]:
        if not self.settings.speech_enabled:
            raise ServiceError("research-tts-disabled", 403)
        try:
            text, language = validate_speech(payload)
        except SpeechFailure as error:
            raise ServiceError(error.code, error.status) from None
        if not self._lock.acquire(blocking=False):
            raise ServiceError("model-busy", 503)
        try:
            self._ensure_speech(language)
            audio = self._speech_infer(self._speech, text)
            validate_speech_audio(audio)
            return audio, language, SPEECH_MODELS[language]
        except SpeechFailure as error:
            raise ServiceError(error.code, error.status) from None
        except ServiceError:
            raise
        except Exception:
            raise ServiceError("tts-inference-failed", 503) from None
        finally:
            self._lock.release()

    def dialogue(self, payload: Any) -> dict:
        if not self.settings.local_reading_llm:
            raise ServiceError("dialogue-disabled", 403)
        try:
            passage, heard, history = validate_dialogue(payload)
        except DialogueFailure as error:
            raise ServiceError(error.code, error.status) from None
        if not self._lock.acquire(blocking=False):
            raise ServiceError("model-busy", 503)
        try:
            self._ensure_dialogue()
            reply = self._dialogue_infer(self._dialogue, passage, heard, history)
            if not isinstance(reply, str) or not reply.strip() or len(reply.strip()) > 300 or any(ord(c) < 32 and c not in "\n\t" for c in reply):
                raise ServiceError("dialogue-reply-too-long", 503)
            return {"replySpanish": reply.strip(), "model": DIALOGUE_MODEL, "dialogueMode": DIALOGUE_MODE, "requiresHumanReview": True}
        except DialogueFailure as error:
            raise ServiceError(error.code, error.status) from None
        except ServiceError:
            raise
        except Exception:
            raise ServiceError("dialogue-inference-failed", 503) from None
        finally:
            self._lock.release()
