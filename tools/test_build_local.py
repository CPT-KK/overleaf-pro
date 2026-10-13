"""Exercise build-local.sh without Docker, network access, or image publishing.

Run with: python tools/test_build_local.py
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
GIT_BASH = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git/bin/bash.exe"
BASH = str(GIT_BASH) if os.name == "nt" and GIT_BASH.exists() else shutil.which("bash")


@unittest.skipUnless(BASH, "Bash is required")
class LocalBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="overleaf-build-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copyfile(ROOT / "build-local.sh", self.root / "build-local.sh")
        server = self.root / "server-ce"
        server.mkdir()
        for name in ["Dockerfile", "Dockerfile-base", ".dockerignore"]:
            (server / name).write_text("# fixture\n", encoding="utf-8")
        locales = self.root / "services/web/locales"
        for version in ["v6.2.0", "v6.3.0"]:
            patch = locales / "locales_patches" / version
            patch.mkdir(parents=True)
            (patch / "zh-CN.json").write_text(json.dumps({"version": version}), encoding="utf-8")
        self.bin = self.root / "bin"
        self.bin.mkdir()
        scripts = {
            "git": '''#!/usr/bin/env bash
if [[ "$*" == "rev-parse --abbrev-ref HEAD" ]]; then
    echo server-pro
else
    echo 1234567890abcdef
fi
''',
            "docker": '''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$BUILD_TEST_LOG"
if [[ "$1" == push && "${FAIL_PUSH:-}" == 1 ]]; then exit 1; fi
if [[ "${FAIL_TRANSLATIONS:-}" == 1 && ( "$1" == image || "$1" == pull ) ]]; then exit 1; fi
if [[ "$1" == run ]]; then
    while [[ $# -gt 0 ]]; do
        if [[ "$1" == node ]]; then shift; exec node "$@"; fi
        shift
    done
fi
''',
        }
        for name, content in scripts.items():
            target = self.bin / name
            target.write_text(content, encoding="utf-8")
            target.chmod(0o755)
        self.log = self.root / "docker.log"

    def run_build(self, *args, **overrides):
        env = os.environ.copy()
        env.update(
            PATH=str(self.bin) + os.pathsep + env.get("PATH", ""),
            BUILD_TEST_LOG=self.log.as_posix(),
            REGISTRY_IMAGE="example/overleaf-pro",
            PLATFORM="linux/amd64",
            NODE_IMAGE="node:24.18.1",
            WEBPACK_DEV_IMAGE="example/webpack:test",
        )
        env.update(overrides)
        return subprocess.run(
            [
                BASH,
                "-c",
                'export PATH="$PWD/bin:$PATH"; exec bash build-local.sh "$@"',
                "build-local-test",
                *args,
            ],
            cwd=self.root,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
        )

    def test_help_does_not_invoke_docker(self):
        result = self.run_build("--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("yarn.lock", result.stdout)
        self.assertFalse(self.log.exists())

    def test_invalid_arguments_fail_before_building(self):
        for args in [("--unknown",), ("--tag",), ("--tag", "--push")]:
            with self.subTest(args=args):
                self.assertNotEqual(self.run_build(*args).returncode, 0)
                self.assertFalse(self.log.exists())

    def test_build_uses_yarn_and_latest_locale_patch(self):
        result = self.run_build("--tag", "test")
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text(encoding="utf-8")
        self.assertIn("corepack enable && yarn install --mode=update-lockfile", commands)
        self.assertIn("node:24.18.1", commands)
        self.assertIn("yarn run extract-translations", commands)
        self.assertEqual(sum(line.startswith("build ") for line in commands.splitlines()), 2)
        self.assertNotIn("push ", commands)
        self.assertIn("example/overleaf-pro:test-amd64", commands)
        self.assertEqual(
            json.loads((self.root / "services/web/locales/zh-CN.json").read_text(encoding="utf-8")),
            {"version": "v6.3.0"},
        )

    @unittest.skipUnless(shutil.which("node"), "Node is required for the locale merge smoke test")
    def test_additional_translations_merge_after_version_overlay(self):
        added = self.root / "services/web/locales/locales_patches/added"
        added.mkdir()
        (added / "zh-CN.json").write_text('{"gitlab": "GitLab", "version": "extra"}', encoding="utf-8")
        (added / "added-translations.json").write_text('{"gitlab": ""}', encoding="utf-8")
        result = self.run_build("--skip-sync-lock", "--skip-translations")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            json.loads((self.root / "services/web/locales/zh-CN.json").read_text(encoding="utf-8")),
            {"version": "extra", "gitlab": "GitLab"},
        )
        self.assertFalse((self.root / "services/web/locales/added-translations.json").exists())

    def test_skip_flags_and_arm64(self):
        result = self.run_build("--skip-sync-lock", "--skip-translations", PLATFORM="linux/arm64")
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.log.read_text(encoding="utf-8")
        self.assertNotIn("run --rm", commands)
        self.assertIn("--platform linux/arm64", commands)
        self.assertIn("example/overleaf-pro:latest-arm64", commands)

    def test_push_failure_is_reported(self):
        result = self.run_build("--skip-sync-lock", "--skip-translations", "--push", FAIL_PUSH="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("Images pushed", result.stdout)
        self.assertNotIn("Build Complete!", result.stdout)

    def test_unavailable_translation_image_fails_explicitly(self):
        result = self.run_build("--skip-sync-lock", FAIL_TRANSLATIONS="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--skip-translations", result.stdout)
        commands = self.log.read_text(encoding="utf-8")
        self.assertFalse(any(line.startswith("build ") for line in commands.splitlines()))


if __name__ == "__main__":
    unittest.main()
