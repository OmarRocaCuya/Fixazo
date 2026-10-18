"""Real local HTTP inference smoke; audio and credentials never leave RAM here.

Use adult speech with permission. This verifies integration, not emotion truth.
No model double is used: HTTP must return the pinned 9-class model contract.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
from pathlib import Path
import re
import secrets
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from emotion import EMOTION_LABELS, EMOTION_MODEL, EMOTION_REVISION


class SmokeError(RuntimeError):
    pass


def http_failure(service: str, status: int, result: dict) -> SmokeError:
    """Expose only a bounded stable error code, never an upstream payload."""
    code = result.get("error")
    suffix = "-" + code if isinstance(code, str) and re.fullmatch(r"[a-z][a-z0-9-]{0,79}", code) else ""
    return SmokeError(f"{service}-inference-http-{status}{suffix}")


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SmokeError("local-http-redirect-refused")


def local_url(value: str, *, allow_localhost: bool = False) -> str:
    """Do not send a test voice or credential to an arbitrary destination."""
    try:
        parsed = urlsplit(value)
        host_allowed = parsed.hostname == "127.0.0.1" or allow_localhost and parsed.hostname == "localhost"
        valid = (parsed.scheme == "http" and host_allowed
                 and parsed.port is not None and 1024 <= parsed.port <= 65535
                 and parsed.path in ("", "/") and not parsed.username
                 and not parsed.password and not parsed.query and not parsed.fragment)
    except ValueError:
        valid = False
    if not valid:
        raise SmokeError("expected-exact-loopback-http-explicit-port")
    return value.rstrip("/")


def request_json(url: str, *, body: bytes | None = None, headers: dict | None = None,
                 timeout: float = 90) -> tuple[int, dict, float]:
    request = Request(url, data=body, headers=headers or {}, method="GET" if body is None else "POST")
    started = time.monotonic()
    try:
        # Ignore OS proxy settings and refuse redirects, including on loopback.
        response = build_opener(ProxyHandler({}), _NoRedirect()).open(request, timeout=timeout)
    except HTTPError as error:
        response = error
    except (OSError, URLError):
        raise SmokeError("local-http-unavailable") from None
    with response:
        raw = response.read(16_385)
        if len(raw) > 16_384:
            raise SmokeError("response-too-large")
        try:
            result = json.loads(raw)
        except (ValueError, UnicodeError):
            raise SmokeError("response-not-json") from None
        if not isinstance(result, dict):
            raise SmokeError("response-not-object")
        return response.status, result, round(time.monotonic() - started, 3)


def read_voice(path: Path) -> bytes:
    with path.open("rb") as stream:
        payload = stream.read(1_000_001)
    if len(payload) > 1_000_000:
        raise SmokeError("wav-too-large")
    try:
        with wave.open(io.BytesIO(payload), "rb") as reader:
            if (reader.getnchannels(), reader.getsampwidth(), reader.getframerate(), reader.getcomptype()) != (1, 2, 16000, "NONE"):
                raise SmokeError("wav-must-be-pcm16-mono-16000hz")
            frames = reader.getnframes()
            if not 16000 <= frames <= 15 * 16000:
                raise SmokeError("wav-must-be-1-to-15-seconds")
            pcm = reader.readframes(frames + 1)
            if len(pcm) != frames * 2 or not any(pcm):
                raise SmokeError("wav-must-contain-nonzero-complete-voice")
    except (wave.Error, EOFError, ValueError):
        raise SmokeError("invalid-wav") from None
    return payload


def silence_wav() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        writer.writeframes(b"\x00\x00" * 16000)
    return buffer.getvalue()


def validate_result(result: dict) -> None:
    if (result.get("model") != EMOTION_MODEL or result.get("revision") != EMOTION_REVISION
            or result.get("experimental") is not True or result.get("requiresHumanReview") is not True):
        raise SmokeError("wrong-model-or-review-contract")
    labels = result.get("labels")
    if not isinstance(labels, list) or len(labels) != 9:
        raise SmokeError("expected-nine-labels")
    if any(not isinstance(item, dict) or item.get("label") not in EMOTION_LABELS
           or type(item.get("score")) not in (int, float)
           or not math.isfinite(item["score"]) or not 0 <= item["score"] <= 1 for item in labels):
        raise SmokeError("invalid-scores")
    if {item["label"] for item in labels} != set(EMOTION_LABELS):
        raise SmokeError("duplicate-or-missing-label")
    if abs(sum(item["score"] for item in labels) - 1) > 0.001:
        raise SmokeError("scores-not-probabilities")
    if labels != sorted(labels, key=lambda item: item["score"], reverse=True) or result.get("top") != labels[0]:
        raise SmokeError("invalid-top-score")


def multipart_voice(payload: bytes, *, consent: bool = True) -> tuple[bytes, str]:
    boundary = "emotion-smoke-" + secrets.token_hex(12)
    parts = []
    fields = {"audience": "adult-demo", "consent": "true", "adultConfirmed": "true", "experimentalEmotion": "true" if consent else "false"}
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="adult-voice.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + payload + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def run_smoke(payload: bytes, backend_url: str, token: str, *, web_url: str | None = None,
              access_code: str | None = None) -> dict:
    backend_url = local_url(backend_url)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "audio/wav"}
    status, result, seconds = request_json(backend_url + "/v1/emotion", body=payload, headers=headers)
    if status != 200:
        raise http_failure("backend", status, result)
    validate_result(result)
    silent_status, _, _ = request_json(backend_url + "/v1/emotion", body=silence_wav(), headers=headers)
    if silent_status not in (400, 422):
        raise SmokeError("backend-did-not-reject-silence")
    unauthorized, _, _ = request_json(backend_url + "/v1/emotion", body=payload, headers={"Content-Type": "audio/wav"})
    if unauthorized != 401:
        raise SmokeError("backend-did-not-reject-unauthorized")
    report = {"model": result["model"], "revision": result["revision"], "experimental": True,
              "requiresHumanReview": True, "backendSeconds": seconds, "labels": result["labels"],
              "backendSilenceRejected": silent_status, "backendUnauthorizedRejected": unauthorized}
    if web_url:
        web_url = local_url(web_url, allow_localhost=True)
        if not access_code:
            raise SmokeError("voice-access-code-required")
        body, content_type = multipart_voice(payload)
        web_headers = {"Origin": web_url, "Sec-Fetch-Site": "same-origin", "x-voice-access-code": access_code, "Content-Type": content_type}
        status, public, seconds = request_json(web_url + "/api/emotion", body=body, headers=web_headers)
        if status != 200:
            raise http_failure("next", status, public)
        validate_result(public)
        # Same utterance through the proxy must use the same model distribution.
        if public["labels"] != result["labels"]:
            raise SmokeError("next-and-backend-results-differ")
        report["nextSeconds"] = seconds
        silent_body, silent_type = multipart_voice(silence_wav())
        silent_headers = {**web_headers, "Content-Type": silent_type}
        silent_status, _, _ = request_json(web_url + "/api/emotion", body=silent_body, headers=silent_headers)
        if silent_status not in (400, 422):
            raise SmokeError("next-did-not-reject-silence")
        no_consent, no_consent_type = multipart_voice(payload, consent=False)
        rejected, _, _ = request_json(web_url + "/api/emotion", body=no_consent, headers={**web_headers, "Content-Type": no_consent_type})
        if rejected != 403:
            raise SmokeError("next-did-not-reject-missing-consent")
        cross_origin, _, _ = request_json(web_url + "/api/emotion", body=body, headers={**web_headers, "Origin": "https://invalid.example", "Sec-Fetch-Site": "cross-site"})
        if cross_origin != 403:
            raise SmokeError("next-did-not-reject-cross-origin")
        report.update(nextSilenceRejected=silent_status, nextConsentRejected=rejected, nextCrossOriginRejected=cross_origin)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--backend-url", default="http://127.0.0.1:8081")
    parser.add_argument("--web-url")
    parser.add_argument("--adult-consent", action="store_true", required=True)
    args = parser.parse_args()
    token = os.environ.get("INDIGENOUS_API_KEY", "")
    if len(token) < 32:
        raise SmokeError("INDIGENOUS_API_KEY-required-in-environment")
    report = run_smoke(read_voice(args.audio), args.backend_url, token, web_url=args.web_url,
                       access_code=os.environ.get("VOICE_ACCESS_CODE"))
    print("EMOTION_SMOKE " + json.dumps(report, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (SmokeError, OSError) as error:
        # Never print exception data from model/network libraries or a WAV path.
        code = str(error) if isinstance(error, SmokeError) else "cannot-read-voice-file"
        print("EMOTION_SMOKE_ERROR " + code, file=sys.stderr)
        raise SystemExit(1)
