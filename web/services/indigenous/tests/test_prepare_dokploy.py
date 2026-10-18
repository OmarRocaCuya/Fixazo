import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from prepare_dokploy import BUILD_FILES, SERVICE_PATH, _git, build_payload, read_snapshot

COMPOSE = "services:\n  meta:\n    build:\n      context: .\n      dockerfile: Dockerfile\n    environment:\n      INDIGENOUS_API_KEY: ${INDIGENOUS_API_KEY:?Set a secret in Dokploy}\n"


def sources():
    return {name: f"# committed source: {name}\n# ñawinchay\n" for name in BUILD_FILES}


class DokployPreparationTests(unittest.TestCase):
    def test_allowlist_covers_every_file_the_dockerfile_copies(self):
        dockerfile = (HERE / "Dockerfile").read_text(encoding="utf-8")
        copied = set()
        for line in dockerfile.splitlines():
            if line.startswith("COPY "):
                parts = [p for p in line.split()[1:-1] if not p.startswith("--")]
                for part in parts:
                    copied.update(p.name for p in HERE.glob(part)) if "*" in part else copied.add(part)
        self.assertTrue(copied)
        self.assertEqual(copied - set(BUILD_FILES), set())

    def test_exact_allowlist_and_paths_and_sha256s(self):
        files = sources()
        result = build_payload("new-compose-id", COMPOSE, files)
        self.assertEqual(set(result), {"composeFile", "mounts", "sha256s"})
        self.assertEqual(len(result["mounts"]), 13)
        self.assertEqual(set(result["sha256s"]), set(BUILD_FILES))
        for mount in result["mounts"]:
            filename = mount["filePath"].removeprefix("indigenous/")
            self.assertIn(filename, BUILD_FILES)
            self.assertEqual(mount, {"type": "file", "serviceType": "compose", "serviceId": "new-compose-id", "mountPath": f"/tmp/build-source/{filename}", "filePath": f"indigenous/{filename}", "content": files[filename]})
            self.assertNotIn("..", mount["filePath"])
            self.assertEqual(result["sha256s"][filename], hashlib.sha256(files[filename].encode("utf-8")).hexdigest())

    def test_changes_only_one_build_context_not_credentials_or_source_content(self):
        result = build_payload("new-id", COMPOSE, sources())
        self.assertEqual(result["composeFile"], COMPOSE.replace("      context: .\n", "      context: ../files/indigenous\n"))
        self.assertIn("${INDIGENOUS_API_KEY:?Set a secret in Dokploy}", result["composeFile"])
        self.assertEqual({mount["filePath"].split("/")[1]: mount["content"] for mount in result["mounts"]}, sources())

    def test_refuses_unsafe_ids_missing_sources_or_extra_environment_files(self):
        for identifier in ("", "../other-service", "new service", "https://example.invalid", "x" * 129):
            with self.assertRaises(ValueError):
                build_payload(identifier, COMPOSE, sources())
        for files in ({}, {**sources(), ".env": "do not read"}):
            with self.assertRaises(ValueError):
                build_payload("new-id", COMPOSE, files)

    def test_refuses_missing_or_ambiguous_context(self):
        for compose in ("services: {}", COMPOSE + "      context: .\n", COMPOSE.replace("context: .", "context: ../other")):
            with self.assertRaises(ValueError):
                build_payload("new-id", compose, sources())

    def test_refuses_binary_or_oversized_source(self):
        for content in ("binary\0content", "x" * 2_000_001):
            with self.assertRaises(ValueError):
                build_payload("new-id", COMPOSE, {**sources(), "core.py": content})

    def test_builder_does_not_read_environment_or_interpolate_a_secret(self):
        with patch.dict(os.environ, {"INDIGENOUS_API_KEY": "DUMMY_VALUE_NEVER_TO_BE_READ", "DOKPLOY_API_KEY": "DUMMY_MANAGER_TOKEN_NOT_READ"}), patch("os.getenv", side_effect=AssertionError("no environment reads")):
            result = build_payload("new-id", COMPOSE, sources())
        serialized = json.dumps(result)
        self.assertNotIn("DUMMY_VALUE_NEVER_TO_BE_READ", serialized)
        self.assertNotIn("DUMMY_MANAGER_TOKEN_NOT_READ", serialized)

    def test_snapshot_resolves_head_once_and_reads_only_committed_allowlist(self):
        revision = "a" * 40
        root = HERE.parents[2]
        calls = []
        def git(arguments, cwd):
            calls.append(arguments)
            if arguments == ["rev-parse", "--show-toplevel"]:
                return str(root)
            if arguments == ["rev-parse", "--verify", "HEAD"]:
                return revision
            spec = arguments[1]
            self.assertTrue(spec.startswith(f"{revision}:{SERVICE_PATH}/"))
            filename = spec.rsplit("/", 1)[1]
            return COMPOSE if filename == "compose.dokploy.yaml" else sources()[filename]
        with patch("prepare_dokploy._git", side_effect=git), patch.object(Path, "read_text", side_effect=AssertionError("must not read working tree")):
            compose, files = read_snapshot(HERE)
        self.assertEqual(compose, COMPOSE)
        self.assertEqual(files, sources())
        self.assertEqual(len(calls), 3 + len(BUILD_FILES))
        self.assertEqual(sum(command == ["rev-parse", "--verify", "HEAD"] for command in calls), 1)

    def test_git_failure_never_prints_raw_diagnostics(self):
        error = subprocess.CalledProcessError(1, ["git", "show"], stderr="sensitive diagnostic do not expose")
        with patch("prepare_dokploy.subprocess.run", side_effect=error):
            with self.assertRaises(ValueError) as caught:
                _git(["show", "HEAD:missing"], HERE)
        self.assertNotIn("sensitive diagnostic", str(caught.exception))
        self.assertIn("commit the complete backend first", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
