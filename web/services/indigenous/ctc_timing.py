"""CTC emission-frame estimates, not forced alignment to an expected passage.

Only the pinned Omnilingual CTC frontend is supported. No ML import or model
download happens at module import. Uncertain decoding fails closed.
"""

from __future__ import annotations

import math
import unicodedata
from typing import Any, Callable, Sequence

TIMING_METHOD = "ctc-greedy-frames"
TIMED_MODEL = "omniASR_CTC_300M_v2"
MAX_TIMED_SECONDS = 15
MAX_TIMED_WORDS = 512


class TimingUnavailable(ValueError):
    pass


def normalized_text(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())


def frontend_geometry(pipeline: Any) -> tuple[int, int]:
    """Use the actual no-padding convolution descriptors, not audio/word count."""
    try:
        layers = pipeline.model.encoder_frontend.feature_extractor.layer_descs
        hop, receptive = 1, 1
        if not isinstance(layers, (list, tuple)) or len(layers) != 7:
            raise TimingUnavailable()
        for layer in layers:
            if len(layer) != 3 or any(type(value) is not int or value <= 0 for value in layer):
                raise TimingUnavailable()
            _, kernel, stride = layer
            receptive += (kernel - 1) * hop
            hop *= stride
        if (hop, receptive) != (320, 400):
            raise TimingUnavailable()
        return hop, receptive
    except (AttributeError, TypeError, ValueError):
        raise TimingUnavailable("Unsupported CTC frontend") from None


def timing_supported(pipeline: Any) -> bool:
    try:
        frontend_geometry(pipeline)
        return pipeline.tokenizer.vocab_info.pad_idx == 0 and callable(pipeline.model.register_forward_hook) and callable(pipeline.token_decoder)
    except (AttributeError, TimingUnavailable):
        return False


def frame_word_timings(
    frame_ids: Sequence[int], decode: Callable[[list[int]], str], samples: int,
    *, expected_text: str, hop: int = 320, receptive: int = 400, blank: int = 0,
    special_ids: Sequence[int] = (),
) -> list[dict]:
    """Collapse CTC runs while retaining the frames that emitted each token.

Prefix decoding preserves the tokenizer's real whitespace and Unicode rules.
It must be append-only; normalization that revises previous characters is not
given guessed timings. Every character in one token shares its emission span.
"""
    if type(samples) is not int or samples < receptive or samples > MAX_TIMED_SECONDS * 16_000:
        raise TimingUnavailable("Unsupported duration")
    if (hop, receptive, blank) != (320, 400, 0):
        raise TimingUnavailable("Unsupported geometry or blank")
    if len(frame_ids) != 1 + (samples - receptive) // hop:
        raise TimingUnavailable("Unexpected frame count")
    forbidden = set(special_ids) - {blank}
    if any(type(value) is not int or value < 0 or value in forbidden for value in frame_ids):
        raise TimingUnavailable("Unsupported token")

    ids: list[int] = []
    prefix = ""
    characters: list[tuple[str, int, int]] = []
    index = 0
    while index < len(frame_ids):
        token, end = frame_ids[index], index + 1
        while end < len(frame_ids) and frame_ids[end] == token:
            end += 1
        if token != blank:
            ids.append(token)
            current = decode(ids)
            if not isinstance(current, str):
                raise TimingUnavailable("Invalid decoder output")
            current = unicodedata.normalize("NFC", current)
            if not current.startswith(prefix) or "\ufffd" in current or any(unicodedata.category(c) in ("Cs", "Cc") and not c.isspace() for c in current):
                raise TimingUnavailable("Non-append-only decoder")
            characters.extend((character, index, end - 1) for character in current[len(prefix):])
            prefix = current
        index = end
    if normalized_text(prefix) != normalized_text(expected_text):
        raise TimingUnavailable("Transcript/timing mismatch")

    words: list[dict] = []
    pending: list[tuple[str, int, int]] = []

    def finish() -> None:
        if not pending:
            return
        start = pending[0][1] * hop / 16_000
        end = min(samples, pending[-1][2] * hop + receptive) / 16_000
        word = "".join(character for character, _, _ in pending)
        if not word or end <= start or (words and start < words[-1]["end"]):
            raise TimingUnavailable("Overlapping/invalid word spans")
        words.append({"word": word, "start": start, "end": end, "confidence": None})
        pending.clear()

    for character in characters:
        if character[0].isspace():
            finish()
        else:
            pending.append(character)
    finish()
    if len(words) > MAX_TIMED_WORDS or " ".join(word["word"] for word in words) != normalized_text(expected_text):
        raise TimingUnavailable("Uncertain word boundaries")
    return words


def infer_asr_timed(pipeline: Any, audio: Any, language: str) -> tuple[str, list[dict]]:
    """Capture the SAME forward pass used by the official transcribe method.

    The caller must hold Runtime._lock. Never leave a hook installed, including
    when normalization, inference or decoding raises.
    """
    import torch
    from fairseq2.models.wav2vec2.asr import Wav2Vec2AsrModel

    if not isinstance(pipeline.model, Wav2Vec2AsrModel) or not timing_supported(pipeline):
        raise TimingUnavailable("Not a supported CTC pipeline")
    hop, receptive = frontend_geometry(pipeline)
    captured: list[list[int]] = []

    def capture(_model, _inputs, output):
        if captured or not isinstance(output, tuple) or len(output) != 2:
            raise TimingUnavailable("Expected exactly one CTC forward")
        logits, layout = output
        if logits.ndim != 3 or logits.shape[0] != 1 or not bool(torch.isfinite(logits).all()):
            raise TimingUnavailable("Invalid emissions")
        valid = int(layout.seq_lens[0])
        if valid < 1 or valid > logits.shape[1]:
            raise TimingUnavailable("Invalid output layout")
        captured.append(logits[0, :valid].argmax(dim=-1).detach().cpu().tolist())

    hook = pipeline.model.register_forward_hook(capture)
    try:
        waveform = torch.frombuffer(bytearray(audio.pcm), dtype=torch.int16).to(torch.float32).div_(32768.0)
        with torch.inference_mode():
            result = pipeline.transcribe([{"waveform": waveform, "sample_rate": 16_000}], lang=None, batch_size=1)
        if len(captured) != 1 or not isinstance(result, list) or len(result) != 1 or not isinstance(result[0], str):
            raise TimingUnavailable("Missing CTC emissions")
        text = normalized_text(result[0])
        vocab = pipeline.tokenizer.vocab_info
        specials = [value for name in ("unk_idx", "bos_idx", "eos_idx") if (value := getattr(vocab, name, None)) is not None]

        def decode(ids: list[int]) -> str:
            return pipeline.token_decoder(torch.tensor(ids, dtype=torch.int64, device=pipeline.device))

        words = frame_word_timings(captured[0], decode, audio.frames, expected_text=text, hop=hop, receptive=receptive, special_ids=specials)
        return text, words
    finally:
        hook.remove()
