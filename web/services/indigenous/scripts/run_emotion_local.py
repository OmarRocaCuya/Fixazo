"""Supervise an isolated, opt-in adult emotion demo on loopback only.

Only processes started here are stopped. No .env file is read or written by
this launcher; Next can still read its usual files, with our process settings
taking precedence. The backend credential is random and never printed.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time

from smoke_emotion import SmokeError, read_voice, request_json, run_smoke

SERVICE = Path(__file__).resolve().parents[1]
WEB = SERVICE.parents[1]


def free_port(port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            raise SmokeError(f"port-{port}-already-in-use-no-process-was-stopped") from None


def backend_environment(token: str) -> dict[str, str]:
    env = dict(os.environ)
    env.pop("INDIGENOUS_API_KEY_FILE", None)
    env.update(INDIGENOUS_API_KEY=token, INDIGENOUS_DEVICE="cpu", INDIGENOUS_WARMUP="false",
               EMOTION_WARMUP="true", ENABLE_EXPERIMENTAL_EMOTION="true", EMOTION2VEC_LICENSE_ACCEPTED="true",
               ENABLE_RESEARCH_TRANSLATION="false", ENABLE_RESEARCH_SPEECH="false", ENABLE_LOCAL_READING_LLM="false",
               HF_HOME=str(SERVICE / ".cache/huggingface"), XDG_CACHE_HOME=str(SERVICE / ".cache"),
               TORCH_HOME=str(SERVICE / ".cache/torch"), MODELSCOPE_CACHE=str(SERVICE / ".cache/modelscope"),
               TEMP=str(SERVICE / ".cache/tmp"), TMP=str(SERVICE / ".cache/tmp"),
               HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1", PYTHONDONTWRITEBYTECODE="1", PYTHONUNBUFFERED="1")
    return env


def web_environment(token: str, access_code: str, backend_url: str) -> dict[str, str]:
    env = dict(os.environ)
    env.update(NODE_ENV="development", VOICE_CLOUD_MODE="adult-demo", VOICE_ACCESS_CODE=access_code,
               INDIGENOUS_BACKEND_URL=backend_url + "/", INDIGENOUS_BACKEND_TOKEN=token,
               INDIGENOUS_ALLOW_LOOPBACK="true", NEXT_TELEMETRY_DISABLED="1", NAWINCHAY_EMOTION_LOCAL="true")
    return env


def start_process(command: list[str], cwd: Path, env: dict) -> subprocess.Popen:
    options = {"cwd": cwd, "env": env}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        options["start_new_session"] = True
    return subprocess.Popen(command, **options)


def stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        # Next has a child worker. Limit termination to our own tracked PID tree.
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW, check=False)
    else:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def wait_backend(process: subprocess.Popen, base: str, token: str, timeout: float) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise SmokeError("backend-process-exited-before-ready")
        try:
            status, result, _ = request_json(base + "/health", headers={"Authorization": "Bearer " + token}, timeout=3)
            emotion = result.get("emotion", {})
            if status == 200 and emotion.get("ready") is True and emotion.get("inferenceVerified") is True:
                return
            if status == 200 and emotion.get("lastError") and not emotion.get("loading"):
                raise SmokeError("emotion-warmup-failed-check-environment-or-model-cache")
            if status in (401, 403):
                raise SmokeError("backend-health-authorization-failed")
        except SmokeError as error:
            if str(error) != "local-http-unavailable":
                raise
        time.sleep(1)
    raise SmokeError("emotion-ready-timeout-model-download-may-still-be-incomplete")


def wait_web(process: subprocess.Popen, base: str, timeout: float = 120) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise SmokeError("next-process-exited-check-port-and-existing-dev-lock")
        try:
            status, result, _ = request_json(base + "/api/emotion", timeout=10)
            if status == 200 and result.get("ready") is True and result.get("inferenceVerified") is True:
                return
        except SmokeError:
            pass
        time.sleep(1)
    raise SmokeError("next-emotion-capabilities-not-ready")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adult-consent", action="store_true", required=True)
    parser.add_argument("--accept-model-license", action="store_true", required=True)
    parser.add_argument("--backend-port", type=int, choices=range(1024, 65536), default=8081, metavar="PORT")
    parser.add_argument("--web-port", type=int, choices=range(1024, 65536), default=3001, metavar="PORT")
    parser.add_argument("--ready-timeout", type=int, default=900)
    parser.add_argument("--no-web", action="store_true")
    parser.add_argument("--smoke-audio", type=Path)
    parser.add_argument("--smoke-only", action="store_true")
    args = parser.parse_args()
    if args.ready_timeout < 1 or args.smoke_only and not args.smoke_audio:
        parser.error("positive ready timeout required; --smoke-only also needs --smoke-audio")
    if not args.no_web and args.backend_port == args.web_port:
        parser.error("backend and web ports must differ")
    payload = read_voice(args.smoke_audio) if args.smoke_audio else None
    free_port(args.backend_port)
    node = None
    code = ""
    if not args.no_web:
        free_port(args.web_port)
        # Next authoritatively acquires .next-emotion/dev/lock. Do not inspect,
        # delete or block on another user-owned session's .next/dev/lock.
        node = shutil.which("node")
        if not node or not (WEB / "node_modules/next/dist/bin/next").is_file():
            raise SmokeError("node-and-web-npm-ci-required")
        code = os.environ.get("VOICE_ACCESS_CODE", "")
        if not code and sys.stdin.isatty():
            code = getpass.getpass("Adult demo access code (16-256 characters): ")
        if not 16 <= len(code.strip()) <= 256 or any(ord(char) < 32 for char in code):
            raise SmokeError("VOICE_ACCESS_CODE-must-be-16-to-256-characters")
    token = secrets.token_urlsafe(48)
    backend_url = f"http://127.0.0.1:{args.backend_port}"
    # Next canonicalizes Request.url to localhost even when its socket binds
    # 127.0.0.1. Match that public origin instead of weakening same-origin policy.
    web_url = f"http://localhost:{args.web_port}"
    processes = []
    try:
        (SERVICE / ".cache/tmp").mkdir(parents=True, exist_ok=True)
        backend = start_process([sys.executable, "-B", "-m", "uvicorn", "app:app", "--host", "127.0.0.1",
                                 "--port", str(args.backend_port), "--workers", "1", "--no-access-log", "--log-level", "warning"],
                                SERVICE, backend_environment(token))
        processes.append(backend)
        print("Loading pinned emotion2vec+ CPU model (first run downloads weights); ASR warmup is disabled.", flush=True)
        wait_backend(backend, backend_url, token, args.ready_timeout)
        print("Emotion model ready: real synthetic warmup forward verified; this is not an accuracy test.", flush=True)
        if not args.no_web:
            web = start_process([node, str(WEB / "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1",
                                 "--port", str(args.web_port)], WEB, web_environment(token, code, backend_url))
            processes.append(web)
            wait_web(web, web_url)
            print(f"Adult demo: {web_url}. Enter your access code and explicitly opt into experimental voice emotion.", flush=True)
        if payload is not None:
            report = run_smoke(payload, backend_url, token, web_url=None if args.no_web else web_url, access_code=code)
            print("EMOTION_SMOKE " + json.dumps(report, ensure_ascii=True), flush=True)
        if args.smoke_only:
            return 0
        print("Ctrl+C stops only the processes created by this launcher.", flush=True)
        while True:
            if any(process.poll() is not None for process in processes):
                raise SmokeError("local-child-process-exited")
            time.sleep(1)
    finally:
        for process in reversed(processes):
            stop_process(process)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Local emotion session stopped.")
    except (SmokeError, OSError):
        # No raw network/model exceptions, environment values or file paths.
        error = sys.exc_info()[1]
        print("EMOTION_LOCAL_ERROR " + (str(error) if isinstance(error, SmokeError) else "cannot-start-local-process"), file=sys.stderr)
        raise SystemExit(1)
