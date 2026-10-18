"""Launcher/contract unit tests only. They do NOT prove model inference."""

import copy
import io
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from emotion import EMOTION_LABELS, EMOTION_MODEL, EMOTION_REVISION
from run_emotion_local import backend_environment, web_environment
from smoke_emotion import SmokeError, http_failure, local_url, multipart_voice, read_voice, silence_wav, validate_result


def valid_result():
    labels = [{"label": name, "score": 1 if index == 0 else 0} for index, name in enumerate(EMOTION_LABELS)]
    return {"labels": labels, "top": labels[0], "model": EMOTION_MODEL, "revision": EMOTION_REVISION,
            "experimental": True, "requiresHumanReview": True}


class LocalEmotionScriptsTest(unittest.TestCase):
    def test_http_failure_only_exposes_bounded_safe_error_code(self):
        self.assertEqual(str(http_failure("next", 403, {"error": "same-origin-required"})), "next-inference-http-403-same-origin-required")
        for value in ("Bearer SECRET", "https://secret/path", "x" * 81, {"secret": "hidden"}):
            self.assertEqual(str(http_failure("next", 503, {"error": value})), "next-inference-http-503")

    def test_local_url_rejects_nonlocal_destinations_and_credential_urls(self):
        self.assertEqual(local_url("http://127.0.0.1:8081/"), "http://127.0.0.1:8081")
        for url in ("https://127.0.0.1:8081", "http://localhost:8081", "http://127.0.0.1:8081/a",
                    "http://127.0.0.1", "http://user:secret@127.0.0.1:8081", "http://127.0.0.1:8081/?a=b",
                    "http://10.0.0.1:8081", "http://127.0.0.1:99999"):
            with self.subTest(url=url), self.assertRaises(SmokeError):
                local_url(url)

    def test_only_frontend_may_use_exact_localhost_with_explicit_port(self):
        self.assertEqual(local_url("http://localhost:3001/", allow_localhost=True), "http://localhost:3001")
        with self.assertRaises(SmokeError):
            local_url("http://localhost:8081")
        for url in ("http://localhost.evil:3001", "http://localhost:3001/path", "http://localhost",
                    "http://user:secret@localhost:3001", "http://localhost:3001/?a=b", "http://127.0.0.2:3001"):
            with self.subTest(url=url), self.assertRaises(SmokeError):
                local_url(url, allow_localhost=True)

    def test_pinned_model_and_nine_probabilities_are_required(self):
        validate_result(valid_result())
        for field, value in (("revision", "main"), ("model", "heuristic"), ("experimental", False), ("requiresHumanReview", False)):
            result = valid_result()
            result[field] = value
            with self.subTest(field=field), self.assertRaises(SmokeError):
                validate_result(result)

    def test_invalid_scores_and_top_are_rejected(self):
        for value in (float("nan"), float("inf"), -1, True, "1"):
            result = valid_result()
            result["labels"][0]["score"] = value
            with self.subTest(value=value), self.assertRaises(SmokeError):
                validate_result(result)
        result = valid_result()
        result["top"] = result["labels"][1]
        with self.assertRaises(SmokeError):
            validate_result(result)

    def test_duplicates_missing_classes_and_non_probabilities_are_rejected(self):
        result = valid_result()
        result["labels"].pop()
        with self.assertRaises(SmokeError):
            validate_result(result)
        result = valid_result()
        result["labels"][1]["label"] = result["labels"][0]["label"]
        with self.assertRaises(SmokeError):
            validate_result(result)
        result = valid_result()
        result["labels"][0]["score"] = 0.5
        with self.assertRaises(SmokeError):
            validate_result(result)

    def test_multipart_contains_only_audio_and_explicit_adult_opt_ins(self):
        body, content_type = multipart_voice(b"AUDIO")
        self.assertTrue(content_type.startswith("multipart/form-data; boundary="))
        for expected in (b'AUDIO', b'name="file"', b'name="experimentalEmotion"', b'adult-demo', b'name="adultConfirmed"'):
            self.assertIn(expected, body)
        self.assertNotIn(b"transcript", body)
        self.assertNotIn(b"Authorization", body)

    def test_silence_and_truncated_wav_are_rejected_before_smoke(self):
        for payload in (silence_wav(), silence_wav()[:-1], b"not a wav"):
            with patch.object(Path, "open", return_value=io.BytesIO(payload)):
                with self.assertRaises(SmokeError):
                    read_voice(Path("not-read.wav"))

    def test_complete_nonzero_wav_is_accepted(self):
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as writer:
            writer.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
            writer.writeframes(b"\x01\x00" * 16000)
        with patch.object(Path, "open", return_value=io.BytesIO(buffer.getvalue())):
            self.assertEqual(read_voice(Path("not-read.wav")), buffer.getvalue())

    def test_process_environment_is_scoped_and_disables_other_models(self):
        original = copy.deepcopy(dict(os.environ))
        with patch.dict(os.environ, {"INDIGENOUS_API_KEY_FILE": "do-not-read", "INDIGENOUS_WARMUP": "true"}):
            env = backend_environment("backend-token")
            self.assertNotIn("INDIGENOUS_API_KEY_FILE", env)
            self.assertEqual(env["INDIGENOUS_WARMUP"], "false")
            self.assertEqual(env["EMOTION_WARMUP"], "true")
            self.assertEqual(env["INDIGENOUS_DEVICE"], "cpu")
            self.assertEqual(os.environ["INDIGENOUS_WARMUP"], "true")
        self.assertEqual(dict(os.environ), original)

    def test_web_child_only_gets_development_loopback_settings(self):
        env = web_environment("backend-token", "adult-access-code", "http://127.0.0.1:8081")
        self.assertEqual(env["INDIGENOUS_BACKEND_URL"], "http://127.0.0.1:8081/")
        self.assertEqual(env["INDIGENOUS_BACKEND_TOKEN"], "backend-token")
        self.assertEqual(env["VOICE_ACCESS_CODE"], "adult-access-code")
        self.assertEqual(env["INDIGENOUS_ALLOW_LOOPBACK"], "true")
        self.assertEqual(env["NODE_ENV"], "development")
        self.assertEqual(env["VOICE_CLOUD_MODE"], "adult-demo")
        self.assertEqual(env["NAWINCHAY_EMOTION_LOCAL"], "true")


if __name__ == "__main__":
    unittest.main()
