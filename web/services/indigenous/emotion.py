"""EXPERIMENTAL, opt-in speech emotion recognition (emotion2vec+ base).

No ML imports at startup: FunASR, NumPy and huggingface_hub are imported only
when the feature is enabled AND a request (or warmup) needs the model. Audio is
processed in memory; no output_dir is passed, so FunASR writes nothing to disk.

Model: emotion2vec/emotion2vec_plus_base (Ma et al., "emotion2vec", ACL Findings
2024), FunASR Model Open Source License Agreement v1.1 (Alibaba Group), which
requires attributing source/author and retaining the model name. Trained on
adult (acted / pseudo-labelled) speech: NOT validated with children, Peruvian
Spanish or Quechua. It is an estimate, never a diagnosis or a grade.
"""

from __future__ import annotations

from array import array
import math
import sys
from typing import Any

EMOTION_MODEL = "emotion2vec/emotion2vec_plus_base"
EMOTION_REVISION = "b318240bfe67db81a8c572ecb37ce9c3759b81c9"
EMOTION_LICENSE = "FunASR Model License v1.1"
EMOTION_ATTRIBUTION = "emotion2vec+ base (emotion2vec/emotion2vec_plus_base), Ma et al. 2024, Alibaba DAMO / FunASR"
EMOTION_LABELS = ("angry", "disgusted", "fearful", "happy", "neutral", "other", "sad", "surprised", "unknown")
EMOTION_FILES = ["model.pt", "config.yaml", "configuration.json", "tokens.txt"]
MIN_EMOTION_SECONDS = 1
MAX_EMOTION_SECONDS = 15


class EmotionFailure(ValueError):
    def __init__(self, code: str, status: int = 503):
        super().__init__(code)
        self.code, self.status = code, status


def load_emotion(settings: Any) -> Any:
    """Download the pinned revision (weights only) and build a CPU FunASR model."""
    from huggingface_hub import snapshot_download
    from funasr import AutoModel

    # FunASR's own HF download ignores model_revision; pin it ourselves and hand
    # FunASR a local directory so it never fetches a moving branch.
    path = snapshot_download(EMOTION_MODEL, revision=EMOTION_REVISION, allow_patterns=EMOTION_FILES)
    return AutoModel(model=path, hub="hf", device="cpu", ncpu=2, trust_remote_code=False,
                     disable_update=True, disable_pbar=True, disable_log=True)


def infer_emotion(model: Any, audio: Any) -> Any:
    """Utterance-level 9-class probabilities. No embeddings, no files."""
    import numpy as np

    pcm = array("h")
    pcm.frombytes(audio.pcm)
    if sys.byteorder != "little":
        pcm.byteswap()
    waveform = np.asarray([value / 32768.0 for value in pcm], dtype=np.float32)
    return model.generate(waveform, fs=16000, granularity="utterance", extract_embedding=False, disable_pbar=True)


def warmup_audio() -> Any:
    """Non-user test signal to verify a real forward, not emotion accuracy.

    Kept in RAM and never exposed as a person's emotion. Importing Audio here
    avoids a module-level core/emotion cycle and keeps the default stack light.
    """
    from core import Audio

    pcm = array("h", (int(3000 * math.sin(2 * math.pi * 220 * i / 16000)) for i in range(16000)))
    if sys.byteorder != "little":
        pcm.byteswap()
    return Audio(pcm.tobytes(), 16000)


def _english(label: Any) -> str | None:
    if not isinstance(label, str):
        return None
    if label.strip() == "<unk>":
        return "unknown"
    name = label.split("/")[-1].strip().lower()
    return name if name in EMOTION_LABELS else None


def normalize_emotion_result(result: Any) -> list[dict]:
    """Validate the model output and return the 9 classes sorted by score."""
    try:
        first = result[0] if isinstance(result, list) and len(result) == 1 else None
        labels, scores = first["labels"], first["scores"]
    except (TypeError, KeyError, IndexError):
        raise EmotionFailure("emotion-output-invalid") from None
    if not isinstance(labels, list) or not isinstance(scores, list) or len(labels) != len(EMOTION_LABELS) or len(scores) != len(labels):
        raise EmotionFailure("emotion-output-invalid")
    items: list[dict] = []
    for raw, score in zip(labels, scores):
        name = _english(raw)
        if type(score) not in (int, float):
            raise EmotionFailure("emotion-output-invalid")
        try:
            value = float(score)
        except (TypeError, ValueError):
            raise EmotionFailure("emotion-output-invalid") from None
        if name is None or not math.isfinite(value) or not -1e-6 <= value <= 1 + 1e-6:
            raise EmotionFailure("emotion-output-invalid")
        items.append({"label": name, "score": round(min(1.0, max(0.0, value)), 4)})
    if {item["label"] for item in items} != set(EMOTION_LABELS):
        raise EmotionFailure("emotion-output-invalid")
    # The real classifier returns softmax probabilities, not arbitrary logits.
    if abs(sum(float(score) for score in scores) - 1.0) > 1e-4:
        raise EmotionFailure("emotion-output-invalid")
    return sorted(items, key=lambda item: item["score"], reverse=True)


if __name__ == "__main__":  # Manual smoke test on the VPS: python -B emotion.py turn.wav
    from core import Settings, validate_wav

    with open(sys.argv[1], "rb") as stream:
        clip = validate_wav(stream.read())
    print(normalize_emotion_result(infer_emotion(load_emotion(Settings()), clip)))
