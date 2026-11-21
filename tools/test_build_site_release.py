"""Targeted regressions for stable site distribution inputs."""
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from build_site_release import make_archive, verify_source


class SiteReleaseInputs(unittest.TestCase):
    def test_backend_coverage_is_not_source_but_untracked_core_is(self):
        with TemporaryDirectory(prefix="hp-site-input-test-") as folder:
            root = Path(folder)

            def git(*arguments):
                return subprocess.check_output(["git", *arguments], cwd=root, text=True).strip()

            git("init", "-q")
            git("config", "user.name", "Site fixture")
            git("config", "user.email", "fixture@example.test")
            git("config", "core.excludesFile", str(root / "empty-excludes"))
            (root / "tracked").write_text("candidate\n")
            git("add", "tracked")
            git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture")
            head = git("rev-parse", "HEAD")
            coverage = root / ".coverage"
            coverage.write_bytes(b"untracked output")
            self.assertIn("?? .coverage", git("status", "--porcelain"))
            # No excludesFile is builtin to this source; the release operator need
            # not set their workstation's local git excludes to get a valid build.
            verify_source(root, head, "1.86.0")
            core = root / "custom_components/houseplan/core"
            core.mkdir(parents=True)
            (core / "unstaged.py").write_text("# not included in the stable tag\n")
            with self.assertRaisesRegex(ValueError, "Untracked source"):
                verify_source(root, head, "1.86.0")
            (core / "unstaged.py").unlink()
            git("tag", "v1.86.0", head)
            verify_source(root, head, "1.86.0")
            git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-qm", "next candidate")
            next_head = git("rev-parse", "HEAD")
            with self.assertRaisesRegex(ValueError, "different commit"):
                verify_source(root, next_head, "1.86.0")

    def test_editor_archive_bytes_are_independent_of_file_order(self):
        with TemporaryDirectory(prefix="hp-site-zip-test-") as folder:
            root = Path(folder)
            first, second = root / "first.zip", root / "second.zip"
            make_archive(first, {"b.js": b"other", "font/font.ttf": b"font", "a.js": b"bytes"})
            make_archive(second, {"a.js": b"bytes", "b.js": b"other", "font/font.ttf": b"font"})
            self.assertEqual(first.read_bytes(), second.read_bytes())
