"""Emit reviewed, committed build sources for Dokploy file mounts. No network."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

BUILD_FILES = ("Dockerfile", "requirements.txt", "requirements-models.txt", "constraints.txt", "app.py", "core.py", "healthcheck.py")
SERVICE_PATH = "web/services/indigenous"
CONTEXT = re.compile(r"(?m)^ {6}context:[ \t]*\.[ \t]*$")
MAX_SOURCE_BYTES = 2_000_000


def build_payload(compose_id: str, compose_file: str, sources: dict[str, str]) -> dict:
    if not isinstance(compose_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", compose_id):
        raise ValueError("Invalid compose ID")
    if set(sources) != set(BUILD_FILES):
        raise ValueError("Build sources must match the exact seven-file allowlist")
    if len(CONTEXT.findall(compose_file)) != 1:
        raise ValueError("Expected exactly one unquoted build context '.' in the reviewed Compose")
    compose_file = CONTEXT.sub("      context: ../files/indigenous", compose_file, count=1)
    mounts = []
    hashes = {}
    for filename in BUILD_FILES:
        content = sources[filename]
        if not isinstance(content, str) or "\0" in content or len(content.encode("utf-8")) > MAX_SOURCE_BYTES:
            raise ValueError(f"Invalid or oversized source: {filename}")
        mounts.append({
            "type": "file",
            "serviceType": "compose",
            "serviceId": compose_id,
            "mountPath": f"/tmp/build-source/{filename}",
            "filePath": f"indigenous/{filename}",
            "content": content,
        })
        hashes[filename] = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return {"composeFile": compose_file, "mounts": mounts, "sha256s": hashes}


def _git(arguments: list[str], cwd: Path) -> str:
    try:
        result = subprocess.run(["git", *arguments], cwd=cwd, check=True, capture_output=True, encoding="utf-8")
        return result.stdout
    except (OSError, subprocess.CalledProcessError, UnicodeError):
        # Do not forward local Git diagnostics, configuration or private URLs.
        raise ValueError("Cannot read committed deployment sources; commit the complete backend first") from None


def read_snapshot(source_dir: Path | None = None) -> tuple[str, dict[str, str]]:
    source = (source_dir or Path(__file__).resolve().parent).resolve()
    root = Path(_git(["rev-parse", "--show-toplevel"], source).strip()).resolve()
    if not source.is_relative_to(root) or source.relative_to(root).as_posix() != SERVICE_PATH:
        raise ValueError("Run the generator from its reviewed repository service folder")
    revision = _git(["rev-parse", "--verify", "HEAD"], root).strip()
    if not re.fullmatch(r"[0-9a-f]{40,64}", revision):
        raise ValueError("Cannot resolve a committed source revision")
    # Resolve HEAD once, then read only that commit's blobs. Working-tree edits,
    # untracked files, .env files, credential stores and caches are never read.
    compose = _git(["show", f"{revision}:{SERVICE_PATH}/compose.dokploy.yaml"], root)
    sources = {name: _git(["show", f"{revision}:{SERVICE_PATH}/{name}"], root) for name in BUILD_FILES}
    return compose, sources


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compose-id", required=True, help="ID of the NEW Dokploy Compose service")
    arguments = parser.parse_args()
    try:
        compose, sources = read_snapshot()
        payload = build_payload(arguments.compose_id, compose, sources)
    except ValueError as error:
        parser.exit(2, f"{error}\n")
    # ASCII JSON is safe through Windows/SSH pipes; decoded content stays exact.
    # The caller chooses a private, non-versioned output location or API pipe.
    print(json.dumps(payload, ensure_ascii=True))


if __name__ == "__main__":
    main()
