"""Container readiness probe: authenticated state only, never model inference."""

import json
from urllib.request import HTTPRedirectHandler, Request, build_opener

from core import Settings


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        return None


def is_ready(payload) -> bool:
    if not isinstance(payload, dict) or payload.get("configured") is not True:
        return False
    asr, translation = payload.get("asr"), payload.get("translation")
    if not isinstance(asr, dict) or asr.get("ready") is not True or not isinstance(translation, dict):
        return False
    return translation.get("enabled") is False or (translation.get("enabled") is True and translation.get("ready") is True)


def check(opener=None) -> bool:
    try:
        settings = Settings.from_env()
        if not settings.configured:
            return False
        request = Request("http://127.0.0.1:8080/health", headers={"Authorization": f"Bearer {settings.api_key}"})
        client = opener or build_opener(NoRedirect())
        with client.open(request, timeout=3) as response:
            if response.status != 200:
                return False
            raw = response.read(64_001)
            return len(raw) <= 64_000 and is_ready(json.loads(raw))
    except Exception:
        # Health output is recorded by Docker. Never print a key, server body,
        # filesystem path or a raw exception (including upstream diagnostics).
        return False


if __name__ == "__main__":
    raise SystemExit(0 if check() else 1)
