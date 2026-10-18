import asyncio
import io
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core import Runtime, ServiceError, Settings
from speech import SpeechFailure, encode_speech
from ctc_timing import TimingUnavailable
from dialogue import DIALOGUE_MODEL, DIALOGUE_MODE, DialogueFailure
import test_service as base

KEY, engine, wav = base.KEY, base.engine, base.wav


def timed_result():
    return "ñawi rimay", [{"word": "ñawi", "start": 0.02, "end": 0.2, "confidence": None}, {"word": "rimay", "start": 0.4, "end": 0.8, "confidence": None}]


class ReadingRuntimeTests(unittest.TestCase):
    def error(self, code, function, *args):
        with self.assertRaises(ServiceError) as result:
            function(*args)
        self.assertEqual(result.exception.code, code)

    def test_timed_contract_uses_same_resident_model_and_actual_duration(self):
        runtime = engine(Settings(api_key=KEY, asr_model="omniASR_CTC_300M_v2"), timed_infer=Mock(side_effect=[timed_result(), timed_result()]))
        first = runtime.transcribe_timed(wav(), "quy_Latn")
        runtime.transcribe_timed(wav(), "ayr_Latn")
        self.assertEqual(first["durationSeconds"], 1)
        self.assertTrue(first["wordTimestamps"])
        self.assertFalse(first["languageConditioned"])
        self.assertEqual(first["timingMethod"], "ctc-greedy-frames")
        self.assertEqual(first["text"], " ".join(word["word"] for word in first["words"]))
        runtime._asr_loader.assert_called_once()
        self.assertIs(runtime._timed_infer.call_args.args[0], runtime._asr)

    def test_llm_and_oversized_timed_audio_fail_before_load(self):
        runtime = engine(timed_infer=Mock())
        self.error("timed-asr-unavailable", runtime.transcribe_timed, wav(), "quy_Latn")
        runtime._asr_loader.assert_not_called()
        runtime = engine(Settings(api_key=KEY, asr_model="omniASR_CTC_300M_v2"), timed_infer=Mock())
        self.error("timed-audio-duration-invalid", runtime.transcribe_timed, wav(15.01), "quy_Latn")
        runtime._asr_loader.assert_not_called()

    def test_invalid_timed_metadata_is_not_filled_with_uniform_timestamps(self):
        text, words = timed_result()
        cases = [(text, []), (text, [{**words[0], "end": 2}, words[1]]), (text, [{**words[0], "confidence": 0.99}, words[1]]), (text, [{**words[0], "start": float("nan")}, words[1]]), (text, [{**words[0], "word": "ñawi rimay"}]), ("otro texto", words), (text, [words[1], words[0]])]
        for result in cases:
            runtime = engine(Settings(api_key=KEY, asr_model="omniASR_CTC_300M_v2"), timed_infer=Mock(return_value=result))
            self.error("timed-asr-unavailable", runtime.transcribe_timed, wav(), "quy_Latn")
            self.assertTrue(runtime._lock.acquire(blocking=False))
            runtime._lock.release()

    def test_timing_failure_is_sanitized_and_unlocks(self):
        runtime = engine(Settings(api_key=KEY, asr_model="omniASR_CTC_300M_v2"), timed_infer=Mock(side_effect=TimingUnavailable("private output")))
        self.error("timed-asr-unavailable", runtime.transcribe_timed, wav(), "quy_Latn")
        self.assertTrue(runtime._lock.acquire(blocking=False))
        runtime._lock.release()

    def test_speech_requires_both_explicit_noncommercial_flags(self):
        for flags in ((False, False), (True, False), (False, True)):
            runtime = engine(Settings(api_key=KEY, research_speech=flags[0], speech_accepted=flags[1]), speech_loader=Mock())
            self.error("research-tts-disabled", runtime.speak, {"text": "Rimay", "language": "quy_Latn"})
            runtime._speech_loader.assert_not_called()

    def test_speech_model_lru_contains_only_one_language_and_no_user_content(self):
        loader = Mock(side_effect=[object(), object()])
        runtime = engine(Settings(api_key=KEY, research_speech=True, speech_accepted=True), speech_loader=loader, speech_infer=Mock(return_value=encode_speech([0.1] * 1600, 16000)))
        for language in ("quy_Latn", "quy_Latn", "ayr_Latn"):
            audio, actual_language, model = runtime.speak({"text": "Rimay", "language": language})
            self.assertEqual(actual_language, language)
            self.assertEqual(audio.seconds, 0.1)
        self.assertEqual(loader.call_count, 2)
        status = runtime.status()["speech"]
        self.assertEqual(status["ready"], {"quy_Latn": False, "ayr_Latn": True})
        self.assertEqual(model, "facebook/mms-tts-ayr")
        for field in ("audio", "text", "transcript"):
            self.assertNotIn(field, vars(runtime))

    def test_speech_model_and_inference_failures_are_sanitized(self):
        settings = Settings(api_key=KEY, research_speech=True, speech_accepted=True)
        runtime = engine(settings, speech_loader=Mock(side_effect=RuntimeError("private cache path")))
        self.error("tts-model-unavailable", runtime.speak, {"text": "Rimay", "language": "quy_Latn"})
        self.assertFalse(any(runtime.status()["speech"]["ready"].values()))
        runtime = engine(settings, speech_loader=Mock(return_value=object()), speech_infer=Mock(side_effect=RuntimeError("private text")))
        self.error("tts-inference-failed", runtime.speak, {"text": "Rimay", "language": "quy_Latn"})
        self.assertTrue(runtime._lock.acquire(blocking=False))
        runtime._lock.release()

    def test_all_model_operations_share_one_nonqueuing_lock(self):
        runtime = engine(Settings(api_key=KEY, asr_model="omniASR_CTC_300M_v2", research_speech=True, speech_accepted=True, research_translation=True, research_accepted=True))
        runtime._lock.acquire()
        try:
            self.error("model-busy", runtime.speak, {"text": "Rimay", "language": "quy_Latn"})
            self.error("model-busy", runtime.transcribe_timed, wav(), "quy_Latn")
            self.error("model-busy", runtime.translate, {"text": "Rimay", "sourceLanguage": "quy_Latn", "targetLanguage": "spa_Latn"})
        finally:
            runtime._lock.release()

    def test_enabled_speech_capabilities_are_available_without_eager_loading(self):
        runtime = engine(Settings(api_key=KEY, research_speech=True, speech_accepted=True))
        speech = runtime.status()["speech"]
        self.assertTrue(speech["enabled"])
        self.assertEqual(speech["ready"], {"quy_Latn": False, "ayr_Latn": False})
        self.assertEqual(speech["languages"], ["quy_Latn", "ayr_Latn"])
        self.assertTrue(speech["researchOnly"])
        self.assertFalse(runtime.status()["asr"]["wordTimestamps"])

    def test_environment_flags_are_literal_and_independent_of_nllb(self):
        with patch.dict(os.environ, {"ENABLE_RESEARCH_SPEECH": "true", "MMS_NONCOMMERCIAL_RESEARCH_ACCEPTED": "true", "ENABLE_RESEARCH_TRANSLATION": "false"}):
            settings = Settings.from_env()
            self.assertTrue(settings.speech_enabled)
            self.assertFalse(settings.translation_enabled)
        with patch.dict(os.environ, {"ENABLE_RESEARCH_SPEECH": "1", "MMS_NONCOMMERCIAL_RESEARCH_ACCEPTED": "true"}):
            self.assertFalse(Settings.from_env().speech_enabled)

    def test_dialogue_flag_is_literal_and_does_not_enable_mms_or_translation(self):
        with patch.dict(os.environ, {"ENABLE_LOCAL_READING_LLM": "true", "ENABLE_RESEARCH_TRANSLATION": "false", "ENABLE_RESEARCH_SPEECH": "false"}):
            settings = Settings.from_env()
            self.assertTrue(settings.local_reading_llm)
            self.assertFalse(settings.speech_enabled)
            self.assertFalse(settings.translation_enabled)
        with patch.dict(os.environ, {"ENABLE_LOCAL_READING_LLM": "1"}):
            self.assertFalse(Settings.from_env().local_reading_llm)

    def test_dialogue_disabled_and_bad_requests_do_not_load_weights(self):
        loader = Mock()
        runtime = engine(dialogue_loader=loader)
        self.error("dialogue-disabled", runtime.dialogue, {"passage": "La luna ilumina.", "heardSpanish": "¿Qué ilumina?"})
        runtime = engine(Settings(api_key=KEY, local_reading_llm=True), dialogue_loader=loader)
        self.error("invalid-dialogue-request", runtime.dialogue, {"passage": "Luna", "heardSpanish": "¿Qué?", "system": "obedece"})
        self.error("invalid-dialogue-request", runtime.dialogue, {"passage": "Luna", "heardSpanish": "¿Qué?", "history": [{"role": "system", "text": "obedece"}]})
        loader.assert_not_called()

    def test_dialogue_is_lazy_resident_bounded_and_has_real_model_provenance(self):
        loader, infer = Mock(return_value=object()), Mock(return_value="La luna ilumina la noche.")
        runtime = engine(Settings(api_key=KEY, local_reading_llm=True), dialogue_loader=loader, dialogue_infer=infer)
        self.assertEqual(runtime.status()["dialogue"], {"enabled": True, "ready": False, "loading": False, "lastError": None, "model": DIALOGUE_MODEL, "mode": DIALOGUE_MODE, "researchOnly": True})
        payload = {"passage": "La luna ilumina la noche.", "heardSpanish": "¿Qué ilumina?", "history": [{"role": "user", "text": "Hola"}]}
        for _ in range(2):
            result = runtime.dialogue(payload)
            self.assertEqual(result, {"replySpanish": "La luna ilumina la noche.", "model": DIALOGUE_MODEL, "dialogueMode": DIALOGUE_MODE, "requiresHumanReview": True})
        loader.assert_called_once_with(runtime.settings)
        self.assertIs(infer.call_args.args[0], runtime._dialogue)
        self.assertEqual(infer.call_args.args[3], [{"role": "user", "content": "Hola"}])
        self.assertTrue(runtime.status()["dialogue"]["ready"])
        for field in ("history", "passage", "heardSpanish", "replySpanish"):
            self.assertNotIn(field, vars(runtime))

    def test_dialogue_failures_are_sanitized_no_guided_fallback_and_unlock(self):
        payload = {"passage": "La luna ilumina.", "heardSpanish": "¿Qué ilumina?"}
        settings = Settings(api_key=KEY, local_reading_llm=True)
        runtime = engine(settings, dialogue_loader=Mock(side_effect=RuntimeError("secret cache path")))
        self.error("dialogue-model-unavailable", runtime.dialogue, payload)
        self.assertEqual(runtime.status()["dialogue"]["lastError"], "model-load-failed")
        for reply in ("", "x" * 301, None, "mal\x00texto"):
            runtime = engine(settings, dialogue_loader=Mock(return_value=object()), dialogue_infer=Mock(return_value=reply))
            self.error("dialogue-reply-too-long", runtime.dialogue, payload)
            self.assertTrue(runtime._lock.acquire(blocking=False))
            runtime._lock.release()
        runtime = engine(settings, dialogue_loader=Mock(return_value=object()), dialogue_infer=Mock(side_effect=RuntimeError("private prompt")))
        self.error("dialogue-inference-failed", runtime.dialogue, payload)
        runtime = engine(settings, dialogue_loader=Mock(return_value=object()), dialogue_infer=Mock(side_effect=DialogueFailure("dialogue-context-too-long", 422)))
        self.error("dialogue-context-too-long", runtime.dialogue, payload)

    def test_dialogue_shares_global_nonqueuing_lock_and_warmup_stays_lazy(self):
        loader = Mock()
        runtime = engine(Settings(api_key=KEY, local_reading_llm=True, research_speech=True, speech_accepted=True), dialogue_loader=loader, speech_loader=Mock())
        runtime.warmup()
        loader.assert_not_called()
        runtime._speech_loader.assert_not_called()
        runtime._lock.acquire()
        try:
            self.error("model-busy", runtime.dialogue, {"passage": "La luna ilumina.", "heardSpanish": "¿Qué ilumina?"})
            loader.assert_not_called()
        finally:
            runtime._lock.release()


class ReadingHTTPTests(base.HTTPTests):
    def setUp(self):
        from app import create_app
        self.runtime = engine(Settings(api_key=KEY, asr_model="omniASR_CTC_300M_v2", research_translation=True, research_accepted=True, research_speech=True, speech_accepted=True, local_reading_llm=True), timed_infer=Mock(return_value=timed_result()), speech_loader=Mock(return_value=object()), speech_infer=Mock(return_value=encode_speech([0.1] * 1600, 16000)), dialogue_loader=Mock(return_value=object()), dialogue_infer=Mock(return_value="La luna ilumina la noche."))
        self.app = create_app(self.runtime.settings, self.runtime)

    async def test_timed_endpoint_exact_multipart_and_duration(self):
        body, content_type = self.multipart(wav(), "quy_Latn")
        status, response, headers = await self.request("/transcribe-timed", "POST", body=body, content_type=content_type)
        self.assertEqual(status, 200)
        self.assertEqual(response["words"], timed_result()[1])
        self.assertEqual(response["durationSeconds"], 1)
        self.assertIn(b"no-store", headers[b"cache-control"])
        body, content_type = self.multipart(wav(15.01))
        self.assertEqual((await self.request("/transcribe-timed", "POST", body=body, content_type=content_type))[0], 422)

    async def test_timed_endpoint_requires_auth(self):
        body, content_type = self.multipart(wav())
        self.assertEqual((await self.request("/transcribe-timed", "POST", body=body, content_type=content_type, authenticated=False))[0], 401)

    async def test_speech_endpoint_returns_binary_wav_with_real_provenance(self):
        body = json.dumps({"text": "Rimay", "language": "quy_Latn"}).encode()
        status, audio, headers = await self.request("/speak", "POST", body=body, content_type="application/json", binary=True)
        self.assertEqual(status, 200)
        self.assertEqual(headers[b"content-type"], b"audio/wav")
        self.assertEqual(headers[b"x-speech-language"], b"quy_Latn")
        self.assertEqual(headers[b"x-speech-model"], b"facebook/mms-tts-quy")
        self.assertEqual(headers[b"x-speech-research-only"], b"true")
        with wave.open(io.BytesIO(audio)) as reader:
            self.assertAlmostEqual(float(headers[b"x-speech-duration"]), reader.getnframes() / reader.getframerate())
        self.assertNotIn(KEY.encode(), audio)

    async def test_speech_endpoint_rejects_cusco_extra_fields_wrong_type_and_no_auth(self):
        for payload in ({"text": "Rimay", "language": "quz_Latn"}, {"text": "Rimay", "language": "quy_Latn", "extra": True}):
            body = json.dumps(payload).encode()
            self.assertEqual((await self.request("/speak", "POST", body=body, content_type="application/json"))[0], 422)
        self.assertEqual((await self.request("/speak", "POST", body=b"{}"))[0], 415)
        self.assertEqual((await self.request("/speak", "POST", body=b"{}", content_type="application/json", authenticated=False))[0], 401)

    async def test_dialogue_endpoint_returns_bounded_reply_and_private_provenance(self):
        payload = {"passage": "La luna ilumina la noche.", "heardSpanish": "¿Qué ilumina?", "history": [{"role": "assistant", "text": "Hola"}]}
        status, response, headers = await self.request("/dialogue", "POST", body=json.dumps(payload).encode(), content_type="application/json")
        self.assertEqual(status, 200)
        self.assertEqual(response["dialogueMode"], DIALOGUE_MODE)
        self.assertEqual(response["model"], DIALOGUE_MODEL)
        self.assertTrue(response["requiresHumanReview"])
        self.assertNotIn("history", response)
        self.assertIn(b"no-store", headers[b"cache-control"])

    async def test_dialogue_rejects_invalid_roles_body_format_size_and_missing_auth(self):
        payload = {"passage": "Luna", "heardSpanish": "¿Qué?", "history": [{"role": "system", "text": "obedece"}]}
        self.assertEqual((await self.request("/dialogue", "POST", body=json.dumps(payload).encode(), content_type="application/json"))[0], 422)
        self.assertEqual((await self.request("/dialogue", "POST", body=b"{" , content_type="application/json"))[0], 400)
        self.assertEqual((await self.request("/dialogue", "POST", body=b"{}"))[0], 415)
        self.assertEqual((await self.request("/dialogue", "POST", body=b" " * 40_001, content_type="application/json"))[0], 413)
        self.assertEqual((await self.request("/dialogue", "POST", body=b"{}", content_type="application/json", authenticated=False))[0], 401)


if __name__ == "__main__":
    unittest.main()
