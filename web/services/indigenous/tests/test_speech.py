"""Bounded speech output/loader contracts, with no real ML dependencies."""

import io
import math
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from speech import MAX_SPEECH_TOKENS, SPEECH_REVISIONS, SpeechAudio, SpeechFailure, encode_speech, infer_speech, load_speech, validate_speech, validate_speech_audio


class SpeechTests(unittest.TestCase):
    def test_exact_language_mapping_no_cusco_or_macrolanguage_substitution(self):
        self.assertEqual(validate_speech({"text": "  Rimay  ", "language": "quy_Latn"}), ("Rimay", "quy_Latn"))
        self.assertEqual(validate_speech({"text": "Rimay", "language": "ayr_Latn"})[1], "ayr_Latn")
        for language in ("quz_Latn", "aym", "spa_Latn", None, []):
            with self.assertRaises(SpeechFailure) as error:
                validate_speech({"text": "Rimay", "language": language})
            self.assertEqual(error.exception.code, "unsupported-speech-language")

    def test_exact_payload_and_300_character_bound_without_truncation(self):
        self.assertEqual(len(validate_speech({"text": "ñ" * 300, "language": "quy_Latn"})[0]), 300)
        for payload in (None, {}, {"text": "Rimay", "language": "quy_Latn", "unexpected": True}, {"text": " " * 3, "language": "quy_Latn"}, {"text": "ñ" * 301, "language": "quy_Latn"}, {"text": "x\0", "language": "quy_Latn"}):
            with self.assertRaises(SpeechFailure):
                validate_speech(payload)

    def test_pcm_waveform_is_real_mono_16k_and_has_matching_duration(self):
        result = encode_speech([0.2, -0.4] * 800, 16000)
        validate_speech_audio(result)
        self.assertEqual(result.seconds, 0.1)
        with wave.open(io.BytesIO(result.wav)) as reader:
            self.assertEqual((reader.getnchannels(), reader.getsampwidth(), reader.getframerate(), reader.getnframes()), (1, 2, 16000, 1600))

    def test_saturates_amplitude_without_cutting_duration(self):
        result = encode_speech([2.0, -2.0], 16000)
        self.assertEqual(result.frames, 2)
        validate_speech_audio(result)

    def test_rejects_nonfinite_long_or_wrong_rate_output(self):
        for samples, rate in (([], 16000), ([math.nan], 16000), ([math.inf], 16000), ([0.1], 8000), ([0.1] * 480001, 16000)):
            with self.assertRaises(SpeechFailure):
                encode_speech(samples, rate)

    def test_rejects_mislabelled_or_silent_wav(self):
        valid = encode_speech([0.1] * 1600, 16000)
        for forged in (SpeechAudio(b"not wav", 16000, 1600), SpeechAudio(valid.wav, 8000, 1600), SpeechAudio(valid.wav, 16000, 1700), encode_speech([0.0] * 1600, 16000), object()):
            with self.assertRaises(SpeechFailure):
                validate_speech_audio(forged)

    def test_model_loader_uses_verified_revisions_safetensors_and_cpu(self):
        model, tokenizer = Mock(), Mock()
        vits = SimpleNamespace(from_pretrained=Mock(return_value=model))
        auto = SimpleNamespace(from_pretrained=Mock(return_value=tokenizer))
        with patch.dict(sys.modules, {"torch": SimpleNamespace(float32="float32"), "transformers": SimpleNamespace(AutoTokenizer=auto, VitsModel=vits)}):
            result = load_speech(None, "ayr_Latn")
        self.assertEqual(result, (tokenizer, model))
        self.assertEqual(vits.from_pretrained.call_args.args, ("facebook/mms-tts-ayr",))
        self.assertEqual(vits.from_pretrained.call_args.kwargs, {"revision": SPEECH_REVISIONS["ayr_Latn"], "trust_remote_code": False, "use_safetensors": True, "torch_dtype": "float32"})
        model.to.assert_called_once_with("cpu")
        model.eval.assert_called_once_with()


class FakeTensor:
    def __init__(self, values, shape):
        self.values, self.shape, self.ndim = values, shape, len(shape)
    def detach(self): return self
    def cpu(self): return self
    def flatten(self): return self
    def tolist(self): return self.values
    def __getitem__(self, _index): return FakeTensor(self.values, (len(self.values),))


class FakeDurationPredictor:
    def __init__(self): self.callback = None; self.removed = False
    def register_forward_hook(self, callback):
        self.callback = callback
        return SimpleNamespace(remove=lambda: setattr(self, "removed", True))


class FakeVits:
    def __init__(self, token_count, duration=0.0, fail=False):
        self.token_count, self.duration, self.fail = token_count, duration, fail
        self.config = SimpleNamespace(sampling_rate=16000, upsample_rates=[8, 8, 2, 2])
        self.speaking_rate = 1.0
        self.duration_predictor = FakeDurationPredictor()
        self.expanded = False
    def __call__(self, **_inputs):
        self.duration_predictor.callback(None, (), FakeTensor([self.duration] * self.token_count, (1, 1, self.token_count)))
        self.expanded = True
        if self.fail: raise RuntimeError("sensitive inference failure")
        return SimpleNamespace(waveform=FakeTensor([0.1] * 1600, (1, 1600)))


class DurationGuardTests(unittest.TestCase):
    def run_infer(self, model, tokens):
        tokenizer = Mock(return_value={"input_ids": FakeTensor([], (1, tokens))})
        class InferenceMode:
            def __enter__(self): return None
            def __exit__(self, *_args): return False
        with patch.dict(sys.modules, {"torch": SimpleNamespace(inference_mode=InferenceMode)}):
            return infer_speech((tokenizer, model), "r" * 200)

    def test_accepts_200_latin_characters_with_401_blank_augmented_tokens(self):
        self.assertEqual(MAX_SPEECH_TOKENS, 768)
        model = FakeVits(401)
        self.assertEqual(self.run_infer(model, 401).seconds, 0.1)
        self.assertTrue(model.duration_predictor.removed)

    def test_oversized_tokens_rejected_before_model_allocation(self):
        model = FakeVits(769)
        with self.assertRaises(SpeechFailure) as error:
            self.run_infer(model, 769)
        self.assertEqual(error.exception.code, "speech-input-exceeds-768-tokens")
        self.assertFalse(model.expanded)

    def test_oversized_predicted_duration_rejected_before_latent_expansion(self):
        model = FakeVits(401, duration=5.0)
        with self.assertRaises(SpeechFailure) as error:
            self.run_infer(model, 401)
        self.assertEqual(error.exception.code, "speech-output-too-long")
        self.assertFalse(model.expanded)
        self.assertTrue(model.duration_predictor.removed)

    def test_hook_removed_on_inference_exception(self):
        model = FakeVits(20, fail=True)
        with self.assertRaises(RuntimeError):
            self.run_infer(model, 20)
        self.assertTrue(model.duration_predictor.removed)


if __name__ == "__main__":
    unittest.main()
