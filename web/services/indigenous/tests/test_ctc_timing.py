"""Pure timing tests: no model/tokenizer/torch downloads or imports."""

import sys
import unittest
from unittest.mock import patch
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ctc_timing import TimingUnavailable, frame_word_timings, frontend_geometry, timing_supported, infer_asr_timed


VOCAB = {1: "ñ", 2: "a", 3: "w", 4: "i", 5: "▁", 6: "r", 7: "m", 8: "'", 9: "á"}


def decode(ids):
    return "".join(VOCAB.get(token, "?") for token in ids).replace("▁", " ").lstrip()


def frame_ids(tokens, samples=16000):
    frames = [0] * (1 + (samples - 400) // 320)
    for index, token in enumerate(tokens):
        frames[1 + index * 2] = token
    return frames


class CTCTimingTests(unittest.TestCase):
    def test_frame_positions_not_uniform_word_distribution(self):
        ids = frame_ids([1, 2, 3, 4, 5, 6, 4, 7, 9])
        result = frame_word_timings(ids, decode, 16000, expected_text="ñawi rimá")
        self.assertEqual([word["word"] for word in result], ["ñawi", "rimá"])
        self.assertEqual(result[0]["start"], 320 / 16000)
        self.assertEqual(result[0]["end"], (7 * 320 + 400) / 16000)
        self.assertEqual(result[1]["start"], 11 * 320 / 16000)
        self.assertEqual(result[1]["end"], (17 * 320 + 400) / 16000)
        self.assertTrue(all(word["confidence"] is None for word in result))

    def test_unicode_apostrophe_and_punctuation_are_not_rewritten(self):
        ids = frame_ids([1, 9, 8, 4])
        result = frame_word_timings(ids, decode, 16000, expected_text="ñá'i")
        self.assertEqual(result[0]["word"], "ñá'i")

    def test_repeated_identical_frames_collapse_but_blank_separated_chars_do_not(self):
        ids = [1, 1, 1, 0, 1] + [0] * 44
        result = frame_word_timings(ids, decode, 16000, expected_text="ññ")
        self.assertEqual(result[0], {"word": "ññ", "start": 0.0, "end": (4 * 320 + 400) / 16000, "confidence": None})

    def test_repeated_words_remain_separate_emissions(self):
        result = frame_word_timings(frame_ids([1, 5, 1]), decode, 16000, expected_text="ñ ñ")
        self.assertEqual([item["word"] for item in result], ["ñ", "ñ"])
        self.assertLess(result[0]["end"], result[1]["start"])

    def test_blank_only_audio_gets_no_invented_words(self):
        self.assertEqual(frame_word_timings([0] * 49, decode, 16000, expected_text=""), [])

    def test_boundary_never_exceeds_actual_audio(self):
        ids = [0] * 49
        ids[-1] = 1
        result = frame_word_timings(ids, decode, 16000, expected_text="ñ")
        self.assertEqual(result[0]["end"], (48 * 320 + 400) / 16000)
        self.assertLessEqual(result[0]["end"], 1.0)

    def test_rejects_mismatched_reference_instead_of_forcing_expected_text(self):
        with self.assertRaises(TimingUnavailable):
            frame_word_timings(frame_ids([1]), decode, 16000, expected_text="El niño leyó todo")

    def test_rejects_wrong_geometry_duration_and_layout(self):
        for kwargs in ({"hop": 160}, {"blank": 1}, {"receptive": 320}):
            with self.assertRaises(TimingUnavailable):
                frame_word_timings([0] * 49, decode, 16000, expected_text="", **kwargs)
        for samples in (True, 200, 240001):
            with self.assertRaises(TimingUnavailable):
                frame_word_timings([0] * 49, decode, samples, expected_text="")
        with self.assertRaises(TimingUnavailable):
            frame_word_timings([0] * 50, decode, 16000, expected_text="")

    def test_rejects_unknown_special_and_invalid_ids(self):
        for token in (True, -1, 99):
            with self.assertRaises(TimingUnavailable):
                frame_word_timings(frame_ids([token]), decode, 16000, expected_text="?", special_ids=[99])

    def test_rejects_decoder_revision_and_shared_token_word_boundaries(self):
        with self.assertRaises(TimingUnavailable):
            frame_word_timings(frame_ids([1, 2]), lambda ids: "e" if len(ids) == 1 else "é", 16000, expected_text="é")
        with self.assertRaises(TimingUnavailable):
            frame_word_timings(frame_ids([1]), lambda _ids: "ñ a", 16000, expected_text="ñ a")

    def test_rejects_replacement_and_control_characters(self):
        for text in ("\ufffd", "x\0", "\ud800"):
            with self.assertRaises(TimingUnavailable):
                frame_word_timings(frame_ids([1]), lambda _ids: text, 16000, expected_text=text)

    def test_reads_actual_frontend_descriptors_and_fail_closed_capability(self):
        extractor = SimpleNamespace(layer_descs=[(512, 10, 5)] + [(512, 3, 2)] * 4 + [(512, 2, 2)] * 2)
        pipeline = SimpleNamespace(model=SimpleNamespace(encoder_frontend=SimpleNamespace(feature_extractor=extractor), register_forward_hook=lambda _hook: None), tokenizer=SimpleNamespace(vocab_info=SimpleNamespace(pad_idx=0)), token_decoder=decode)
        self.assertEqual(frontend_geometry(pipeline), (320, 400))
        self.assertTrue(timing_supported(pipeline))
        pipeline.tokenizer.vocab_info.pad_idx = 1
        self.assertFalse(timing_supported(pipeline))
        extractor.layer_descs = [(512, 10, 10)]
        self.assertFalse(timing_supported(pipeline))
        self.assertFalse(timing_supported(object()))


class FakePredictions:
    def __init__(self, ids): self.ids = ids
    def argmax(self, **_kwargs): return self
    def detach(self): return self
    def cpu(self): return self
    def tolist(self): return self.ids


class FakeLogits:
    ndim, shape = 3, (1, 49, 10288)
    def __init__(self, ids): self.ids = ids
    def __getitem__(self, index): return FakePredictions(self.ids[index[1]])


class FakeCTCModel:
    def __init__(self):
        self.callback, self.removed = None, False
        self.encoder_frontend = SimpleNamespace(feature_extractor=SimpleNamespace(layer_descs=[(512, 10, 5)] + [(512, 3, 2)] * 4 + [(512, 2, 2)] * 2))
    def register_forward_hook(self, callback):
        self.callback = callback
        return SimpleNamespace(remove=lambda: setattr(self, "removed", True))


class FakePipeline:
    def __init__(self, *, forwards=1, fail=False, valid=49):
        self.model, self.forwards, self.fail, self.valid = FakeCTCModel(), forwards, fail, valid
        self.tokenizer = SimpleNamespace(vocab_info=SimpleNamespace(pad_idx=0, unk_idx=99, bos_idx=100, eos_idx=101))
        self.token_decoder, self.device = decode, "cpu"
    def transcribe(self, inputs, *, lang, batch_size):
        assert len(inputs) == 1 and lang is None and batch_size == 1
        for _index in range(self.forwards):
            self.model.callback(self.model, (), (FakeLogits(frame_ids([1, 2, 3, 4])), SimpleNamespace(seq_lens=[self.valid])))
        if self.fail: raise RuntimeError("sensitive native failure")
        return ["ñawi"]


class FakeWaveform:
    def to(self, *_args): return self
    def div_(self, *_args): return self


class FakeInferenceMode:
    def __enter__(self): return None
    def __exit__(self, *_args): return False


class CTCHookTests(unittest.TestCase):
    def infer(self, pipeline):
        fake_torch = SimpleNamespace(int16="int16", float32="float32", int64="int64", frombuffer=lambda *_args, **_kwargs: FakeWaveform(), isfinite=lambda _tensor: SimpleNamespace(all=lambda: True), tensor=lambda ids, **_kwargs: ids, inference_mode=FakeInferenceMode)
        with patch.dict(sys.modules, {"torch": fake_torch, "fairseq2.models.wav2vec2.asr": SimpleNamespace(Wav2Vec2AsrModel=FakeCTCModel)}):
            return infer_asr_timed(pipeline, SimpleNamespace(pcm=b"\1\0" * 16000, frames=16000), "quy_Latn")

    def test_reuses_forward_pass_and_always_removes_hook(self):
        pipeline = FakePipeline()
        text, words = self.infer(pipeline)
        self.assertEqual(text, "ñawi")
        self.assertEqual(words[0]["word"], "ñawi")
        self.assertTrue(pipeline.model.removed)

    def test_missing_multiple_or_wrong_layout_emissions_fail_closed(self):
        for kwargs in ({"forwards": 0}, {"forwards": 2}, {"valid": 48}):
            pipeline = FakePipeline(**kwargs)
            with self.assertRaises(TimingUnavailable):
                self.infer(pipeline)
            self.assertTrue(pipeline.model.removed)

    def test_native_inference_exception_removes_hook(self):
        pipeline = FakePipeline(fail=True)
        with self.assertRaises(RuntimeError):
            self.infer(pipeline)
        self.assertTrue(pipeline.model.removed)

    def test_non_ctc_model_does_not_install_hook(self):
        pipeline = FakePipeline()
        pipeline.model = object()
        with self.assertRaises(TimingUnavailable):
            self.infer(pipeline)


if __name__ == "__main__":
    unittest.main()
