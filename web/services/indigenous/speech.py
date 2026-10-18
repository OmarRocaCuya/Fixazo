"""Opt-in, noncommercial Meta MMS speech synthesis. No startup ML imports."""

from __future__ import annotations

from array import array
from dataclasses import dataclass
import io
import math
import sys
import unicodedata
import wave
from typing import Any, Sequence

SPEECH_MODELS = {"quy_Latn": "facebook/mms-tts-quy", "ayr_Latn": "facebook/mms-tts-ayr"}
SPEECH_REVISIONS = {
    "quy_Latn": "3fa7ac3f7bd06cd5ca8f33267a2744f0f397dc19",
    "ayr_Latn": "8e79a97785a908d9e84bf7784e03671227d8bb91",
}
MAX_SPEECH_SECONDS = 30
MAX_SPEECH_BYTES = 2_000_000
MAX_SPEECH_TOKENS = 768  # Up to 300 Latin characters plus VITS blank tokens.


class SpeechFailure(ValueError):
    def __init__(self, code: str, status: int = 503):
        super().__init__(code)
        self.code, self.status = code, status


@dataclass(frozen=True)
class SpeechAudio:
    wav: bytes
    sample_rate: int
    frames: int

    @property
    def seconds(self) -> float:
        return self.frames / self.sample_rate


def validate_speech(payload: Any) -> tuple[str, str]:
    if not isinstance(payload, dict) or set(payload) != {"text", "language"}:
        raise SpeechFailure("invalid-speech-request", 422)
    text, language = payload["text"], payload["language"]
    if not isinstance(language, str) or language not in SPEECH_MODELS:
        raise SpeechFailure("unsupported-speech-language", 422)
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 300 or any(unicodedata.category(c) in ("Cs", "Cc") and not c.isspace() for c in text):
        raise SpeechFailure("speech-text-too-long-or-empty", 422)
    return text.strip(), language


def encode_speech(samples: Sequence[float], sample_rate: int) -> SpeechAudio:
    if type(sample_rate) is not int or sample_rate != 16_000:
        raise SpeechFailure("tts-inference-failed")
    frames = len(samples)
    if frames < 1 or frames > MAX_SPEECH_SECONDS * sample_rate or frames * 2 + 44 > MAX_SPEECH_BYTES:
        raise SpeechFailure("speech-output-too-long")
    pcm = array("h")
    for value in samples:
        value = float(value)
        if not math.isfinite(value):
            raise SpeechFailure("tts-inference-failed")
        # PCM amplitude saturation is allowed; duration/content is NEVER cut.
        pcm.append(round(max(-1.0, min(1.0, value)) * 32767))
    if sys.byteorder != "little":
        pcm.byteswap()
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(pcm.tobytes())
    return SpeechAudio(output.getvalue(), sample_rate, frames)


def validate_speech_audio(audio: Any) -> None:
    if not isinstance(audio, SpeechAudio) or not isinstance(audio.wav, bytes) or len(audio.wav) > MAX_SPEECH_BYTES:
        raise SpeechFailure("tts-inference-failed")
    try:
        with wave.open(io.BytesIO(audio.wav), "rb") as reader:
            if (reader.getnchannels(), reader.getsampwidth(), reader.getframerate(), reader.getcomptype()) != (1, 2, 16_000, "NONE") or audio.sample_rate != 16_000:
                raise SpeechFailure("tts-inference-failed")
            if not 1 <= reader.getnframes() <= MAX_SPEECH_SECONDS * 16_000 or reader.getnframes() != audio.frames:
                raise SpeechFailure("speech-output-too-long")
            pcm = reader.readframes(audio.frames + 1)
            if len(pcm) != audio.frames * 2 or not any(pcm):
                raise SpeechFailure("tts-inference-failed")
    except SpeechFailure:
        raise
    except (wave.Error, EOFError, OSError, ValueError):
        raise SpeechFailure("tts-inference-failed") from None


def load_speech(_settings: Any, language: str) -> tuple[Any, Any]:
    import torch
    from transformers import AutoTokenizer, VitsModel

    model_id, revision = SPEECH_MODELS[language], SPEECH_REVISIONS[language]
    tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision, trust_remote_code=False)
    model = VitsModel.from_pretrained(model_id, revision=revision, trust_remote_code=False, use_safetensors=True, torch_dtype=torch.float32)
    model.to("cpu")
    model.eval()
    return tokenizer, model


def infer_speech(bundle: tuple[Any, Any], text: str) -> SpeechAudio:
    import torch

    tokenizer, model = bundle
    inputs = tokenizer(text, return_tensors="pt", truncation=False)
    if inputs["input_ids"].shape != (1, inputs["input_ids"].shape[-1]) or not 1 <= inputs["input_ids"].shape[-1] <= MAX_SPEECH_TOKENS:
        raise SpeechFailure("speech-input-exceeds-768-tokens", 422)
    rate = model.config.sampling_rate
    hops = model.config.upsample_rates
    if type(rate) is not int or rate != 16_000 or not isinstance(hops, (list, tuple)) or not hops or any(type(x) is not int or x <= 0 for x in hops):
        raise SpeechFailure("tts-inference-failed")
    hop = math.prod(hops)
    max_decoder_frames = MAX_SPEECH_SECONDS * rate // hop
    speaking_rate = float(model.speaking_rate)
    if not math.isfinite(speaking_rate) or speaking_rate <= 0:
        raise SpeechFailure("tts-inference-failed")
    predictions = 0

    def bound_duration(_module, _args, log_duration):
        nonlocal predictions
        predictions += 1
        if predictions != 1 or log_duration.ndim != 3 or log_duration.shape[:2] != (1, 1):
            raise SpeechFailure("tts-inference-failed")
        # Check BEFORE VITS allocates expanded latent/audio tensors. At most
        # 768 duration values reach this hook; reject, never truncate speech.
        values = log_duration.detach().cpu().flatten().tolist()
        if len(values) > MAX_SPEECH_TOKENS or any(not math.isfinite(float(x)) or float(x) > math.log(max_decoder_frames * speaking_rate) for x in values):
            raise SpeechFailure("speech-output-too-long")
        predicted = sum(math.ceil(math.exp(float(x)) / speaking_rate) for x in values)
        if predicted < 1 or predicted > max_decoder_frames:
            raise SpeechFailure("speech-output-too-long")

    hook = model.duration_predictor.register_forward_hook(bound_duration)
    try:
        with torch.inference_mode():
            output = model(**inputs).waveform
        if predictions != 1 or output.ndim != 2 or output.shape[0] != 1 or output.shape[1] > MAX_SPEECH_SECONDS * rate:
            raise SpeechFailure("speech-output-too-long")
        return encode_speech(output[0].detach().cpu().tolist(), rate)
    finally:
        hook.remove()
