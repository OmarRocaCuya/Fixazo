"""Lightweight build-contract checks; native imports run in Docker, not here."""

import ast
from pathlib import Path
import unittest


HERE = Path(__file__).resolve().parents[1]


class DependencyContractTests(unittest.TestCase):
    def test_numpy_and_arrow_are_pinned_to_a_compatible_pair(self):
        requirements = (HERE / "constraints.txt").read_text(encoding="utf-8").splitlines()
        self.assertIn("numpy==1.26.4", requirements)
        self.assertIn("pyarrow==21.0.0", requirements)
        # Every dependency-install stage must consume the same constraints.
        docker = (HERE / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("-c constraints.txt fairseq2[arrow]", docker)
        self.assertIn("-c constraints.txt", (HERE / "requirements-models.txt").read_text(encoding="utf-8"))

    def test_docker_checks_dependency_metadata_after_the_complete_install(self):
        docker = (HERE / "Dockerfile").read_text(encoding="utf-8")
        self.assertGreater(docker.index("RUN pip check"), docker.index("-r requirements.txt -r requirements-models.txt"))

    def test_docker_imports_native_pipeline_offline_without_loading_models(self):
        docker = (HERE / "Dockerfile").read_text(encoding="utf-8")
        prefix = 'RUN HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python -B -c "'
        checks = [line for line in docker.splitlines() if line.startswith(prefix)]
        self.assertEqual(len(checks), 1)
        self.assertGreater(docker.index(checks[0]), docker.index("RUN pip check"))
        source = checks[0][len(prefix):-1]
        parsed = ast.parse(source)
        imports = {alias.name for node in ast.walk(parsed) if isinstance(node, ast.Import) for alias in node.names}
        self.assertTrue({"numpy", "pyarrow", "torch", "torchaudio", "fairseq2"}.issubset(imports))
        from_imports = {(node.module, alias.name) for node in ast.walk(parsed) if isinstance(node, ast.ImportFrom) for alias in node.names}
        self.assertIn(("omnilingual_asr.models.inference.pipeline", "ASRInferencePipeline"), from_imports)
        self.assertIn(("transformers", "AutoTokenizer"), from_imports)
        self.assertIn(("transformers", "AutoModelForSeq2SeqLM"), from_imports)
        # Imports catch NumPy/Arrow and Torch/fairseq2 ABI failures. They must
        # never become a model constructor, from_pretrained or weight download.
        calls = [node for node in ast.walk(parsed) if isinstance(node, ast.Call)]
        self.assertTrue(all(isinstance(call.func, ast.Name) and call.func.id == "print" for call in calls))


if __name__ == "__main__":
    unittest.main()
