"""EXPERIMENTAL emotion endpoint (emotion2vec+ base) with model doubles only."""

import builtins
import json
import math
import os
import sys
import threading
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / ".test-deps"))
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from core import Audio, Runtime, ServiceError, Settings  # noqa: E402
from emotion import (  # noqa: E402
    EMOTION_LABELS,
    EMOTION_LICENSE,
    EMOTION_MODEL,
    EMOTION_REVISION,
    EmotionFailure,
    infer_emotion,
    load_emotion,
    normalize_emotion_result,
    warmup_audio,
)
import test_service as base  # noqa: E402

KEY = base.KEY
RAW_LABELS = ["生气/angry", "厌恶/disgusted", "恐惧/fearful", "开心/happy", "中立/neutral", "其他/other", "难过/sad", "吃惊/surprised", "<unk>"]
SCORES = [0.02, 0.01, 0.03, 0.70, 0.15, 0.01, 0.05, 0.02, 0.01]


def model_output(labels=None, scores=None):
    return [{"key": "turn", "labels": labels or list(RAW_LABELS), "scores": scores or list(SCORES)}]


def enabled_settings(**extra):
    return Settings(api_key=KEY, experimental_emotion=True, emotion_license_accepted=True, **extra)


def runtime(settings=None, **kwargs):
    return base.engine(
        settings or enabled_settings(),
        emotion_loader=kwargs.pop("emotion_loader", Mock(return_value=object())),
        emotion_infer=kwargs.pop("emotion_infer", Mock(return_value=model_output())),
        **kwargs,
    )


def prepare(engine):
    engine.start_emotion_warmup()
    if not engine._lock.acquire(timeout=5):
        raise AssertionError("emotion warmup did not finish")
    engine._lock.release()
    return engine


class EmotionSettingsTests(unittest.TestCase):
    def test_off_by_default_and_requires_both_flags(self):
        with patch.dict(os.environ, {"INDIGENOUS_API_KEY": KEY}, clear=True):
            self.assertFalse(Settings.from_env().emotion_enabled)
        for flags in ({"ENABLE_EXPERIMENTAL_EMOTION": "true"}, {"EMOTION2VEC_LICENSE_ACCEPTED": "true"}):
            with patch.dict(os.environ, {"INDIGENOUS_API_KEY": KEY, **flags}, clear=True):
                self.assertFalse(Settings.from_env().emotion_enabled)
        with patch.dict(os.environ, {"INDIGENOUS_API_KEY": KEY, "ENABLE_EXPERIMENTAL_EMOTION": "true", "EMOTION2VEC_LICENSE_ACCEPTED": "true"}, clear=True):
            self.assertTrue(Settings.from_env().emotion_enabled)

    def test_independent_warmup_is_explicit(self):
        with patch.dict(os.environ, {"EMOTION_WARMUP": "true"}, clear=True):
            settings = Settings.from_env()
            self.assertTrue(settings.emotion_warmup)
            self.assertFalse(settings.warmup)


class EmotionResultTests(unittest.TestCase):
    def test_maps_bilingual_labels_to_nine_english_classes_sorted(self):
        labels = normalize_emotion_result(model_output())
        self.assertEqual(len(labels), 9)
        self.assertEqual({item["label"] for item in labels}, set(EMOTION_LABELS))
        self.assertEqual(labels[0], {"label": "happy", "score": 0.7})
        self.assertEqual([item["score"] for item in labels], sorted((item["score"] for item in labels), reverse=True))

    def test_rejects_invalid_model_outputs(self):
        bad = [
            [],
            "happy",
            model_output(labels=RAW_LABELS[:8], scores=SCORES[:8]),
            model_output(scores=SCORES[:8] + [float("nan")]),
            model_output(scores=SCORES[:8] + [1.5]),
            model_output(labels=RAW_LABELS[:8] + ["x/joy"]),
            model_output(labels=["开心/happy"] * 9),
            model_output(scores=[0.5] * 9),
            model_output(scores=[True] + SCORES[1:]),
            model_output(scores=["0.02"] + SCORES[1:]),
            model_output() * 2,
        ]
        for output in bad:
            with self.assertRaises(EmotionFailure) as error:
                normalize_emotion_result(output)
            self.assertEqual(error.exception.code, "emotion-output-invalid")


class EmotionRuntimeTests(unittest.TestCase):
    def assert_error(self, code, status, function, *args):
        with self.assertRaises(ServiceError) as error:
            function(*args)
        self.assertEqual((error.exception.code, error.exception.status), (code, status))

    def test_disabled_endpoint_is_not_found_and_license_is_required(self):
        self.assert_error("not-found", 404, runtime(Settings(api_key=KEY)).emotion, base.wav(2))
        self.assert_error("emotion-license-not-accepted", 403, runtime(Settings(api_key=KEY, experimental_emotion=True)).emotion, base.wav(2))

    def test_lazy_load_once_and_experimental_contract(self):
        loader = Mock(return_value="model")
        infer = Mock(return_value=model_output())
        engine = runtime(emotion_loader=loader, emotion_infer=infer)
        self.assertFalse(engine.status()["emotion"]["ready"])
        loader.assert_not_called()
        prepare(engine)
        result = engine.emotion(base.wav(2))
        result_again = engine.emotion(base.wav(3))
        loader.assert_called_once()
        audio = infer.call_args[0][1]
        self.assertIsInstance(audio, Audio)
        self.assertEqual(audio.frames, 48_000)
        self.assertTrue(result["experimental"])
        self.assertEqual(result["top"], {"label": "happy", "score": 0.7})
        self.assertEqual(len(result["labels"]), 9)
        self.assertEqual((result["model"], result["revision"], result["license"]), (EMOTION_MODEL, EMOTION_REVISION, EMOTION_LICENSE))
        self.assertIn("emotion2vec", result["attribution"])
        self.assertEqual(result["durationSeconds"], 2)
        self.assertNotIn("embedding", json.dumps(result_again))
        status = engine.status()["emotion"]
        self.assertEqual((status["enabled"], status["ready"], status["experimental"]), (True, True, True))
        self.assertTrue(status["loaded"])
        self.assertTrue(status["inferenceVerified"])

    def test_validates_wav_format_and_duration(self):
        engine = runtime()
        self.assert_error("emotion-audio-duration-invalid", 422, engine.emotion, base.wav(0.5))
        self.assert_error("emotion-audio-duration-invalid", 422, engine.emotion, base.wav(16))
        self.assert_error("wav-must-be-pcm16-mono-16000hz", 422, engine.emotion, base.wav(2, rate=8000))
        self.assert_error("no-audio-signal", 422, engine.emotion, base.wav(2, silence=True))
        self.assert_error("invalid-wav", 422, engine.emotion, b"RIFF-not-a-wav")
        engine._emotion_loader.assert_not_called()

    def test_load_and_inference_failures_are_sanitized(self):
        engine = runtime(emotion_loader=Mock(side_effect=RuntimeError("/private/cache/path")))
        prepare(engine)
        self.assertEqual(engine.status()["emotion"]["lastError"], "model-load-failed")
        self.assertFalse(engine.status()["emotion"]["ready"])
        engine = prepare(runtime())
        engine._emotion_infer.side_effect = RuntimeError("secret")
        self.assert_error("emotion-inference-failed", 503, engine.emotion, base.wav(2))
        self.assertFalse(engine.status()["emotion"]["ready"])
        engine = prepare(runtime())
        engine._emotion_infer.return_value = [{"labels": [], "scores": []}]
        self.assert_error("emotion-output-invalid", 503, engine.emotion, base.wav(2))

    def test_shares_the_single_model_semaphore(self):
        engine = prepare(runtime())
        engine._lock.acquire()
        try:
            self.assert_error("model-busy", 503, engine.emotion, base.wav(2))
        finally:
            engine._lock.release()

    def test_warmup_loads_emotion_only_when_enabled(self):
        loader = Mock(return_value="model")
        runtime(emotion_loader=loader).warmup()
        loader.assert_called_once()
        disabled = Mock(return_value="model")
        runtime(Settings(api_key=KEY), emotion_loader=disabled).warmup()
        disabled.assert_not_called()

    def test_cold_request_returns_loading_without_waiting_or_duplicate_loads(self):
        entered, release = threading.Event(), threading.Event()
        def loader(_settings):
            entered.set()
            release.wait(5)
            return object()
        engine = runtime(emotion_loader=Mock(side_effect=loader))
        try:
            self.assert_error("emotion-model-loading", 503, engine.emotion, base.wav(2))
            self.assertTrue(entered.wait(2))
            self.assert_error("emotion-model-loading", 503, engine.emotion, base.wav(2))
            self.assertFalse(engine.status()["emotion"]["ready"])
            engine._asr_loader.assert_not_called()
            engine._emotion_loader.assert_called_once()
        finally:
            release.set()
            self.assertTrue(engine._lock.acquire(timeout=5))
            engine._lock.release()
        self.assertTrue(engine.status()["emotion"]["ready"])
        engine._emotion_infer.assert_called_once()
        self.assertEqual(engine.emotion(base.wav(2))["top"]["label"], "happy")

    def test_warmup_forward_failure_never_claims_readiness(self):
        engine = prepare(runtime(emotion_infer=Mock(return_value=[{"labels": [], "scores": []}])))
        self.assertEqual(engine.status()["emotion"]["lastError"], "model-inference-failed")
        self.assertFalse(engine.status()["emotion"]["ready"])
        self.assertFalse(engine.status()["emotion"]["loaded"])
        engine._asr_loader.assert_not_called()

    def test_enabled_emotion_must_be_verified_for_container_readiness(self):
        from healthcheck import is_ready
        health = {"configured": True, "asr": {"ready": True}, "translation": {"enabled": False},
                  "emotion": {"enabled": True, "ready": True, "inferenceVerified": False}}
        self.assertFalse(is_ready(health))
        health["emotion"]["inferenceVerified"] = True
        self.assertTrue(is_ready(health))


class EmotionModelAdapterTests(unittest.TestCase):
    def test_loader_pins_the_revision_and_disables_updates(self):
        snapshot = Mock(return_value="/cache/emotion2vec_plus_base")
        auto_model = Mock(return_value="loaded")
        fakes = {"huggingface_hub": types.SimpleNamespace(snapshot_download=snapshot), "funasr": types.SimpleNamespace(AutoModel=auto_model)}
        with patch.dict(sys.modules, fakes):
            self.assertEqual(load_emotion(enabled_settings()), "loaded")
        self.assertEqual(snapshot.call_args.args[0] if snapshot.call_args.args else snapshot.call_args.kwargs["repo_id"], EMOTION_MODEL)
        self.assertEqual(snapshot.call_args.kwargs["revision"], EMOTION_REVISION)
        kwargs = auto_model.call_args.kwargs
        self.assertEqual(kwargs["model"], "/cache/emotion2vec_plus_base")
        self.assertEqual(kwargs["hub"], "hf")
        self.assertTrue(kwargs["disable_update"])
        self.assertEqual(kwargs["device"], "cpu")
        self.assertFalse(kwargs["trust_remote_code"])
        self.assertEqual(kwargs["ncpu"], 2)

    def test_inference_runs_in_memory_without_output_dir(self):
        model = Mock()
        model.generate.return_value = model_output()
        fake_numpy = types.SimpleNamespace(float32="float32", asarray=Mock(side_effect=lambda values, dtype=None: ("array", len(values), dtype)))
        audio = Audio(b"\x00\x40" * 16_000, 16_000)
        with patch.dict(sys.modules, {"numpy": fake_numpy}), patch.object(builtins, "open", side_effect=AssertionError("no disk writes")):
            self.assertEqual(infer_emotion(model, audio), model_output())
        args, kwargs = model.generate.call_args
        self.assertEqual(args[0], ("array", 16_000, "float32"))
        self.assertEqual(kwargs["granularity"], "utterance")
        self.assertFalse(kwargs["extract_embedding"])
        self.assertEqual(kwargs["fs"], 16000)
        self.assertNotIn("output_dir", kwargs)
        values = fake_numpy.asarray.call_args.args[0]
        self.assertTrue(all(math.isclose(v, 0.5) for v in values))


class EmotionHTTPTests(base.HTTPTests):
    def setUp(self):
        from app import create_app
        # Inherited base HTTP tests keep running with the same research flags.
        self.runtime = runtime(enabled_settings(research_translation=True, research_accepted=True))
        self.app = create_app(self.runtime.settings, self.runtime)

    async def test_health_is_authenticated_and_does_not_load_weights(self):
        status, body, _ = await self.request("/health")
        self.assertEqual(status, 200)
        self.assertTrue(body["emotion"]["enabled"])
        self.runtime._emotion_loader.assert_not_called()

    async def test_wav_body_returns_experimental_probabilities_in_memory(self):
        prepare(self.runtime)
        with patch.object(builtins, "open", side_effect=AssertionError("no disk writes")):
            status, body, headers = await self.request("/v1/emotion", "POST", body=base.wav(2), content_type="audio/wav")
        self.assertEqual(status, 200)
        self.assertTrue(body["experimental"])
        self.assertEqual(body["top"]["label"], "happy")
        self.assertEqual(headers[b"cache-control"], b"no-store, private")

    async def test_requires_auth_wav_content_type_and_feature_flag(self):
        status, body, _ = await self.request("/v1/emotion", "POST", body=base.wav(2), content_type="audio/wav", authenticated=False)
        self.assertEqual((status, body["error"]), (401, "unauthorized"))
        status, body, _ = await self.request("/v1/emotion", "POST", body=b"{}", content_type="application/json")
        self.assertEqual((status, body["error"]), (415, "wav-required"))
        from app import create_app
        self.app = create_app(Settings(api_key=KEY), runtime(Settings(api_key=KEY)))
        status, body, _ = await self.request("/v1/emotion", "POST", body=base.wav(2), content_type="audio/wav")
        self.assertEqual((status, body["error"]), (404, "not-found"))

    async def test_oversized_body_is_rejected_before_parsing(self):
        status, body, _ = await self.request("/v1/emotion", "POST", body=b"\x00" * 1_100_000, content_type="audio/wav")
        self.assertEqual((status, body["error"]), (413, "request-too-large"))
        self.runtime._emotion_infer.assert_not_called()


class EmotionDeploymentTests(unittest.TestCase):
    def test_dependency_is_pinned_and_only_installed_behind_a_build_flag(self):
        requirements = (HERE / "requirements-emotion.txt").read_text(encoding="utf-8")
        self.assertIn("-c constraints.txt", requirements)
        self.assertIn("funasr==1.4.16", (HERE / "constraints.txt").read_text(encoding="utf-8").splitlines())
        docker = (HERE / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("ARG INSTALL_EXPERIMENTAL_EMOTION=false", docker)
        self.assertIn('if [ "$INSTALL_EXPERIMENTAL_EMOTION" = "true" ]', docker)
        self.assertIn("requirements-emotion.txt", docker)
        self.assertIn("emotion.py", docker)
        # The default image never imports FunASR: core must not import it at module level.
        self.assertNotIn("import funasr", (HERE / "core.py").read_text(encoding="utf-8"))

    def test_compose_and_docs_keep_the_feature_off_and_attributed(self):
        for name in ("compose.dokploy.yaml", "compose.vps.yaml"):
            compose = (HERE / name).read_text(encoding="utf-8")
            self.assertIn("ENABLE_EXPERIMENTAL_EMOTION: ${ENABLE_EXPERIMENTAL_EMOTION:-false}", compose)
            self.assertIn("EMOTION2VEC_LICENSE_ACCEPTED: ${EMOTION2VEC_LICENSE_ACCEPTED:-false}", compose)
            self.assertIn("INSTALL_EXPERIMENTAL_EMOTION: ${INSTALL_EXPERIMENTAL_EMOTION:-false}", compose)
        readme = (HERE / "README.md").read_text(encoding="utf-8")
        for fragment in ("POST `/v1/emotion`", "FunASR Model License", "emotion2vec", "DS 115-2025-PCM", EMOTION_REVISION):
            self.assertIn(fragment, readme)


if __name__ == "__main__":
    unittest.main()
