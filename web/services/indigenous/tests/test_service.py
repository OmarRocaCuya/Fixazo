import io
import asyncio
import json
import os
import struct
import sys
import threading
import unittest
import wave
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / ".test-deps"))
sys.path.insert(0, str(HERE))

from core import Audio, Runtime, ServiceError, Settings, authorize, configured_api_key, validate_translation, validate_wav
from healthcheck import check, is_ready


KEY = "a-long-private-server-key-for-tests-only"


def wav(seconds=1, rate=16000, channels=1, width=2, silence=False):
    output = io.BytesIO()
    with wave.open(output, "wb") as file:
        file.setnchannels(channels)
        file.setsampwidth(width)
        file.setframerate(rate)
        sample = b"\x00" * width if silence else b"\x01" + b"\x00" * (width - 1)
        file.writeframes(sample * int(seconds * rate) * channels)
    return output.getvalue()


def engine(settings=None, **kwargs):
    return Runtime(settings or Settings(api_key=KEY), asr_loader=kwargs.pop("asr_loader", Mock(return_value=object())), asr_infer=kwargs.pop("asr_infer", Mock(return_value="rimaykullayki")), translation_loader=kwargs.pop("translation_loader", Mock(return_value=object())), translation_infer=kwargs.pop("translation_infer", Mock(return_value="Hola")), **kwargs)


class CoreTests(unittest.TestCase):
    def assert_error(self, code, function, *args):
        with self.assertRaises(ServiceError) as error:
            function(*args)
        self.assertEqual(error.exception.code, code)

    def test_configuration_is_fail_closed_and_loads_no_models(self):
        runtime = engine(Settings())
        self.assertFalse(runtime.status()["configured"])
        self.assertFalse(runtime.status()["asr"]["ready"])
        self.assertFalse(runtime.status()["translation"]["enabled"])
        runtime._asr_loader.assert_not_called()
        self.assert_error("service-not-configured", authorize, Settings(), "Bearer anything")

    def test_bearer_required_and_never_echoed(self):
        settings = Settings(api_key=KEY)
        authorize(settings, f"Bearer {KEY}")
        for header in ("", KEY, "Bearer wrong", "Basic " + KEY, "Bearer " + "x" * 1000):
            self.assert_error("unauthorized", authorize, settings, header)

    def test_actual_pcm_duration_and_language_are_returned_with_provenance(self):
        runtime = engine()
        result = runtime.transcribe(wav(0.5), "quz_Latn")
        self.assertEqual(result["durationSeconds"], 0.5)
        self.assertEqual(result["language"], "quz_Latn")
        self.assertEqual(result["text"], "rimaykullayki")
        self.assertTrue(result["requiresHumanReview"])
        self.assertFalse(result["wordTimestamps"])
        self.assertTrue(result["languageConditioned"])
        self.assertTrue(runtime.status()["asr"]["ready"])

    def test_ctc_option_does_not_claim_language_conditioning(self):
        runtime = engine(Settings(api_key=KEY, asr_model="omniASR_CTC_300M_v2"))
        self.assertFalse(runtime.transcribe(wav(), "quy_Latn")["languageConditioned"])
        self.assertFalse(runtime._asr_infer.call_args.args[3])

    def test_reuses_model_without_storing_audio_or_transcript_on_runtime(self):
        runtime = engine()
        runtime.transcribe(wav(), "quy_Latn")
        runtime.transcribe(wav(), "spa_Latn")
        runtime._asr_loader.assert_called_once()
        self.assertNotIn("audio", vars(runtime))
        self.assertNotIn("text", vars(runtime))

    def test_rejects_wrong_format_truncated_silent_or_long_audio(self):
        for bad in (b"not audio", wav(rate=8000), wav(channels=2), wav(width=1), wav(0.05), wav(30.01), wav(silence=True), wav()[:-8]):
            with self.subTest(size=len(bad)), self.assertRaises(ServiceError):
                validate_wav(bad)
        self.assertEqual(validate_wav(wav(30)).seconds, 30)

    def test_rejects_large_upload_before_decoding(self):
        self.assert_error("audio-size-invalid", validate_wav, b"x" * 1_000_001)

    def test_rejects_forged_huge_frame_count(self):
        payload = bytearray(wav())
        payload[40:44] = struct.pack("<I", 1_000_000_000)
        self.assert_error("audio-duration-invalid", validate_wav, bytes(payload))

    def test_rejects_unknown_language_before_model_load(self):
        runtime = engine()
        for language in ("qu", "que_Latn", "", None, ["quy_Latn"]):
            self.assert_error("unsupported-asr-language", runtime.transcribe, wav(), language)
        runtime._asr_loader.assert_not_called()

    def test_model_load_failure_is_sanitized_and_not_ready(self):
        runtime = engine(asr_loader=Mock(side_effect=RuntimeError("secret filesystem details")))
        self.assert_error("asr-model-unavailable", runtime.transcribe, wav(), "quy_Latn")
        status = runtime.status()["asr"]
        self.assertFalse(status["ready"])
        self.assertFalse(status["loading"])
        self.assertEqual(status["lastError"], "model-load-failed")

    def test_inference_failure_releases_semaphore(self):
        runtime = engine(asr_infer=Mock(side_effect=RuntimeError("sensitive audio error")))
        self.assert_error("asr-inference-failed", runtime.transcribe, wav(), "quy_Latn")
        self.assertTrue(runtime._lock.acquire(blocking=False))
        runtime._lock.release()

    def test_rejects_concurrent_work_instead_of_unbounded_queue(self):
        runtime = engine()
        runtime._lock.acquire()
        try:
            self.assert_error("model-busy", runtime.transcribe, wav(), "quy_Latn")
            runtime._asr_loader.assert_not_called()
        finally:
            runtime._lock.release()

    def test_loading_status_is_real_during_explicit_warmup(self):
        entered, release = threading.Event(), threading.Event()
        def load(_settings):
            entered.set()
            release.wait(timeout=2)
            return object()
        runtime = engine(asr_loader=load)
        worker = threading.Thread(target=runtime.warmup)
        worker.start()
        self.assertTrue(entered.wait(timeout=2))
        self.assertTrue(runtime.status()["asr"]["loading"])
        self.assertFalse(runtime.status()["asr"]["ready"])
        release.set()
        worker.join(timeout=2)
        self.assertTrue(runtime.status()["asr"]["ready"])

    def test_translation_needs_both_research_switches(self):
        for flags in ((False, False), (True, False), (False, True)):
            runtime = engine(Settings(api_key=KEY, research_translation=flags[0], research_accepted=flags[1]))
            self.assert_error("research-translation-disabled", runtime.translate, {"text": "Rimay", "sourceLanguage": "quy_Latn", "targetLanguage": "spa_Latn"})
            runtime._translation_loader.assert_not_called()

    def test_translation_stays_noncommercial_research_with_human_review(self):
        runtime = engine(Settings(api_key=KEY, research_translation=True, research_accepted=True))
        result = runtime.translate({"text": "Rimay", "sourceLanguage": "quy_Latn", "targetLanguage": "spa_Latn"})
        self.assertEqual(result["text"], "Hola")
        self.assertTrue(result["researchOnly"])
        self.assertTrue(result["requiresHumanReview"])
        self.assertEqual(runtime._translation_infer.call_args.args[1:], ("Rimay", "quy_Latn", "spa_Latn"))

    def test_translation_does_not_silently_map_cusco_to_ayacucho(self):
        self.assert_error("unsupported-translation-language", validate_translation, {"text": "Rimay", "sourceLanguage": "quz_Latn", "targetLanguage": "spa_Latn"})

    def test_translation_rejects_empty_large_same_language_and_extra_fields(self):
        for payload in (None, {}, {"text": "", "sourceLanguage": "spa_Latn", "targetLanguage": "quy_Latn"}, {"text": "x" * 1501, "sourceLanguage": "spa_Latn", "targetLanguage": "quy_Latn"}, {"text": "Rimay", "sourceLanguage": "quy_Latn", "targetLanguage": "quy_Latn"}, {"text": "Rimay", "sourceLanguage": "quy_Latn", "targetLanguage": "spa_Latn", "unexpected": "value"}):
            with self.assertRaises(ServiceError):
                validate_translation(payload)

    def test_environment_flags_are_explicit_not_truthy_strings(self):
        with patch.dict(os.environ, {"ENABLE_RESEARCH_TRANSLATION": "false", "NLLB_NONCOMMERCIAL_RESEARCH_ACCEPTED": "true", "INDIGENOUS_ASR_MODEL": "omniASR_LLM_300M_v2", "INDIGENOUS_DEVICE": "cpu"}):
            self.assertFalse(Settings.from_env().translation_enabled)

    def test_secret_file_is_supported_without_logging_or_env_override(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "api-secret"
            path.write_text(KEY + "\n", encoding="utf-8")
            with patch.dict(os.environ, {"INDIGENOUS_API_KEY": "", "INDIGENOUS_API_KEY_FILE": str(path)}):
                self.assertEqual(configured_api_key(), KEY)
            with patch.dict(os.environ, {"INDIGENOUS_API_KEY": KEY, "INDIGENOUS_API_KEY_FILE": str(path)}):
                with self.assertRaisesRegex(ValueError, "not both"):
                    configured_api_key()
            path.write_bytes(b"x" * 512 + b"\r\n")
            with patch.dict(os.environ, {"INDIGENOUS_API_KEY": "", "INDIGENOUS_API_KEY_FILE": str(path)}):
                self.assertEqual(configured_api_key(), "x" * 512)

    def test_unreadable_or_large_secret_file_fails_closed_without_path_in_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "private-path-do-not-echo"
            for content in (None, "x" * 513):
                if content:
                    path.write_text(content, encoding="utf-8")
                with patch.dict(os.environ, {"INDIGENOUS_API_KEY": "", "INDIGENOUS_API_KEY_FILE": str(path)}):
                    with self.assertRaises(ValueError) as error:
                        configured_api_key()
                    self.assertNotIn(str(path), str(error.exception))

    def test_invalid_bearer_characters_or_too_long_key_do_not_configure_service(self):
        for key in ("x" * 513, "x" * 32 + "\n", "x" * 31 + "é", "x" * 31 + " "):
            self.assertFalse(Settings(api_key=key).configured)


class HealthProbeTests(unittest.TestCase):
    def test_readiness_requires_asr_and_any_enabled_translation_model(self):
        self.assertFalse(is_ready(None))
        self.assertFalse(is_ready({"configured": False}))
        payload = {"configured": True, "asr": {"ready": True}, "translation": {"enabled": True, "ready": False}}
        self.assertFalse(is_ready(payload))
        payload["translation"]["ready"] = True
        self.assertTrue(is_ready(payload))
        payload["translation"] = {"enabled": False, "ready": False}
        self.assertTrue(is_ready(payload))

    def test_probe_only_fetches_authenticated_state_and_does_not_infer(self):
        response = Mock(status=200)
        response.read.return_value = b'{"configured":true,"asr":{"ready":true},"translation":{"enabled":false}}'
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        opener = Mock()
        opener.open.return_value = response
        with patch.dict(os.environ, {"INDIGENOUS_API_KEY": KEY, "INDIGENOUS_API_KEY_FILE": ""}):
            self.assertTrue(check(opener))
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:8080/health")
        self.assertEqual(request.get_header("Authorization"), f"Bearer {KEY}")
        self.assertIsNone(request.data)


class HTTPTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        from app import create_app
        self.runtime = engine(Settings(api_key=KEY, research_translation=True, research_accepted=True))
        self.app = create_app(self.runtime.settings, self.runtime)

    async def request(self, path, method="GET", *, body=b"", chunks=None, authenticated=True, content_type=None, binary=False):
        headers = [(b"authorization", f"Bearer {KEY}".encode())] if authenticated else []
        if content_type:
            headers.append((b"content-type", content_type.encode()))
        if chunks is None:
            headers.append((b"content-length", str(len(body)).encode()))
        parts = [body] if chunks is None else chunks
        events = [{"type": "http.request", "body": part, "more_body": index < len(parts) - 1} for index, part in enumerate(parts)]
        sent = []
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method, "scheme": "https", "path": path, "raw_path": path.encode(), "query_string": b"", "headers": headers, "server": ("service.test", 443), "client": ("127.0.0.1", 1), "root_path": ""}
        async def receive():
            return events.pop(0) if events else {"type": "http.disconnect"}
        async def send(event):
            sent.append(event)
        await asyncio.wait_for(self.app(scope, receive, send), timeout=3)
        start = next(event for event in sent if event["type"] == "http.response.start")
        raw = b"".join(event.get("body", b"") for event in sent if event["type"] == "http.response.body")
        return start["status"], raw if binary else json.loads(raw), dict(start["headers"])

    @staticmethod
    def multipart(audio, language="quy_Latn"):
        boundary = "nawinchay-test-boundary"
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n{language}\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="turn.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + audio + f"\r\n--{boundary}--\r\n".encode())
        return body, f"multipart/form-data; boundary={boundary}"

    async def test_health_is_authenticated_and_does_not_load_weights(self):
        self.assertEqual((await self.request("/health", authenticated=False))[0], 401)
        status, payload, headers = await self.request("/health")
        self.assertEqual(status, 200)
        self.assertFalse(payload["asr"]["ready"])
        self.assertIn(b"no-store", headers[b"cache-control"])
        self.runtime._asr_loader.assert_not_called()

    async def test_public_liveness_never_exposes_configuration_or_loads_models(self):
        status, payload, _ = await self.request("/", authenticated=False)
        self.assertEqual(status, 200)
        self.assertEqual(payload, {"service": "nawinchay-indigenous", "process": "running", "modelReadiness": "authentication-required"})
        self.assertNotIn(KEY, json.dumps(payload))
        self.runtime._asr_loader.assert_not_called()
        self.assertEqual((await self.request("/health", authenticated=False))[0], 401)

    async def test_unconfigured_service_denies_even_health(self):
        from app import create_app
        self.app = create_app(Settings(), engine(Settings()))
        self.assertEqual((await self.request("/health"))[0], 503)

    async def test_multipart_transcription_stays_in_memory_and_returns_real_contract(self):
        body, content_type = self.multipart(wav(30), "ayr_Latn")
        with patch("tempfile.TemporaryFile", side_effect=AssertionError("must not spool audio")):
            status, result, _ = await self.request("/transcribe", "POST", body=body, content_type=content_type)
        self.assertEqual(status, 200)
        self.assertEqual(result["durationSeconds"], 30)
        self.assertFalse(result["wordTimestamps"])

    async def test_oversized_multipart_is_rejected_without_loading(self):
        body, content_type = self.multipart(b"x" * 1_010_001)
        self.assertEqual((await self.request("/transcribe", "POST", body=body, content_type=content_type))[0], 413)
        self.runtime._asr_loader.assert_not_called()

    async def test_chunked_body_is_limited_even_without_content_length(self):
        self.assertEqual((await self.request("/transcribe", "POST", chunks=[b"x" * 500_000, b"x" * 600_000]))[0], 413)

    async def test_multipart_invalid_audio_is_rejected(self):
        body, content_type = self.multipart(b"no audio")
        self.assertEqual((await self.request("/transcribe", "POST", body=body, content_type=content_type))[0], 422)
        self.runtime._asr_loader.assert_not_called()

    async def test_translate_returns_generated_text_not_automatic_asr_translation(self):
        body = json.dumps({"text": "Hola", "sourceLanguage": "spa_Latn", "targetLanguage": "quy_Latn"}).encode()
        status, result, _ = await self.request("/translate", "POST", body=body, content_type="application/json")
        self.assertEqual(status, 200)
        self.assertTrue(result["researchOnly"])
        self.runtime._asr_loader.assert_not_called()

    async def test_translation_rejects_cusco_and_malformed_request(self):
        body = json.dumps({"text": "Rimay", "sourceLanguage": "quz_Latn", "targetLanguage": "spa_Latn"}).encode()
        status, result, _ = await self.request("/translate", "POST", body=body, content_type="application/json")
        self.assertEqual(status, 422)
        self.assertEqual(result["error"], "unsupported-translation-language")
        self.assertEqual((await self.request("/translate", "POST", body=b"bad"))[0], 415)
        self.assertEqual((await self.request("/translate", "POST", body=b"bad", content_type="application/json"))[0], 400)


class DeploymentDocsTests(unittest.TestCase):
    def test_vercel_variables_match_frontend_contract_and_keep_python_secret_separate(self):
        document = (HERE / "DEPLOY_VPS.md").read_text(encoding="utf-8")
        for name in ("INDIGENOUS_BACKEND_URL", "INDIGENOUS_BACKEND_TOKEN", "INDIGENOUS_TRANSLATION_RESEARCH_ONLY"):
            self.assertIn(f"`{name}`" if name != "INDIGENOUS_TRANSLATION_RESEARCH_ONLY" else f"`{name}=true`", document)
        self.assertNotIn("INDIGENOUS_API_URL", document)
        self.assertIn("`INDIGENOUS_API_KEY_FILE` y `INDIGENOUS_API_KEY` pertenecen al backend Python", document)
        # Keep this service test runnable as a standalone copied folder; when
        # inside the monorepo, also check the actual frontend policy source.
        policy = HERE.parents[1] / "src" / "lib" / "server" / "voice-policy.ts"
        if policy.is_file():
            source = policy.read_text(encoding="utf-8")
            self.assertIn("INDIGENOUS_BACKEND_URL", source)
            self.assertIn("INDIGENOUS_BACKEND_TOKEN", source)

    def test_dokploy_service_keeps_selected_resources_private_and_routes_only_meta(self):
        compose = (HERE / "compose.dokploy.yaml").read_text(encoding="utf-8")
        self.assertIn("  meta:\n", compose)
        self.assertIn("context: .", compose)
        self.assertIn("${INDIGENOUS_MEMORY_LIMIT:-7g}", compose)
        self.assertIn("${INDIGENOUS_CPU_LIMIT:-2}", compose)
        self.assertIn("${INDIGENOUS_ASR_MODEL:-omniASR_CTC_300M_v2}", compose)
        self.assertIn("${INDIGENOUS_API_KEY:?", compose)
        self.assertNotIn("\n    ports:", compose)
        self.assertNotIn("INDIGENOUS_API_KEY_FILE:", compose)
        self.assertIn('      - "8080"', compose)
        self.assertIn("model_cache:/home/app/.cache", compose)
        self.assertNotIn("traefik.http.routers", compose)


if __name__ == "__main__":
    unittest.main()
