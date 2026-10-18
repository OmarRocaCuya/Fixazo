"""Bounded, in-memory Meta ASR/translation runtime; no ML imports at startup."""

from __future__ import annotations

import hashlib
import hmac
import io
import os
from pathlib import Path
import threading
import wave
from dataclasses import dataclass
from typing import Any, Callable

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
        )

    @property
    def configured(self) -> bool:
        return 32 <= len(self.api_key) <= 512 and all(33 <= ord(character) <= 126 for character in self.api_key)

    @property
    def translation_enabled(self) -> bool:
        return self.research_translation and self.research_accepted


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
    """One process / one resident model; never queue unbounded inference jobs."""

    def __init__(self, settings: Settings, *, asr_loader: Callable = load_asr, asr_infer: Callable = infer_asr, translation_loader: Callable = load_translation, translation_infer: Callable = infer_translation):
        self.settings = settings
        self._asr_loader, self._asr_infer = asr_loader, asr_infer
        self._translation_loader, self._translation_infer = translation_loader, translation_infer
        self._asr: Any = None
        self._translation: Any = None
        self._lock = threading.BoundedSemaphore(1)
        self._asr_loading = self._translation_loading = False
        self._asr_error: str | None = None
        self._translation_error: str | None = None

    @property
    def conditioned(self) -> bool:
        return not self.settings.asr_model.startswith("omniASR_CTC_")

    def status(self) -> dict:
        return {
            "configured": self.settings.configured,
            "asr": {"ready": self._asr is not None, "loading": self._asr_loading, "lastError": self._asr_error, "model": self.settings.asr_model, "languages": list(ASR_LANGUAGES), "languageConditioned": self.conditioned, "wordTimestamps": False, "sourceRevision": OMNI_SOURCE_REVISION},
            "translation": {"ready": self._translation is not None, "enabled": self.settings.translation_enabled, "loading": self._translation_loading, "lastError": self._translation_error, "model": NLLB_MODEL, "languages": list(TRANSLATION_LANGUAGES), "researchOnly": True},
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

    def warmup(self) -> None:
        if not self.settings.configured or not self._lock.acquire(blocking=False):
            return
        try:
            self._ensure_asr()
            if self.settings.translation_enabled:
                self._ensure_translation()
        except ServiceError:
            pass  # Read /health; never log raw exceptions, paths, audio or text.
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
