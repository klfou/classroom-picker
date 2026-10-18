#!/usr/bin/env python3
"""Exercise the exact privileged workflow validator with synthetic, local ZIPs.

Only the marked inline Python is extracted. No GitHub command, network request,
application code, real EXE, or release publication runs in these tests.
"""

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
import warnings
import zipfile

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / ".github/workflows/release.yml").read_text(encoding="utf-8")
MATCHES = re.findall(
    r"^          python3 -I -S - <<'PY'\n(.*?)^          PY$",
    WORKFLOW,
    re.MULTILINE | re.DOTALL,
)
if len(MATCHES) != 1:
    raise AssertionError("Expected exactly one isolated inline Python release gate")
GATE = textwrap.dedent(MATCHES[0])
if "# BEGIN INLINE RELEASE GATE" not in GATE or "# END INLINE RELEASE GATE" not in GATE:
    raise AssertionError("Missing release gate boundaries")
SHELL_GATE = textwrap.dedent(WORKFLOW.split("  publish:\n", 1)[1].split("        run: |\n", 1)[1].split("          # Refuse a tag moved", 1)[0])
COMMIT = "1" * 40
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
WINDOWS = "SunlitClassroom-" + VERSION + "-windows-x64.zip"
WEB = "SunlitClassroom-" + VERSION + "-web.zip"
ENV = {"BUILD_SHA": COMMIT, "RELEASE_TAG": "v" + VERSION, "BUILD_RUN_ID": "12345", "BUILD_RUN_ATTEMPT": "1"}


def verify_delivery(directory):
    """Check real CI output using only the isolated inline gate, never the shell."""
    identity = {"BUILD_SHA": "GITHUB_SHA", "BUILD_RUN_ID": "GITHUB_RUN_ID", "BUILD_RUN_ATTEMPT": "GITHUB_RUN_ATTEMPT"}
    missing = [name for name in identity.values() if not os.environ.get(name)]
    if missing:
        print("Release gate: --verify-delivery requires GitHub identity: " + ", ".join(missing), file=sys.stderr)
        return 2
    if not directory.is_dir():
        print("Release gate: delivery directory does not exist: " + str(directory), file=sys.stderr)
        return 2
    # Preserve OS essentials (including SystemRoot on Windows), but always take
    # provenance from this job's GitHub identity, never caller-supplied BUILD_*.
    environment = {**os.environ, **{target: os.environ[source] for target, source in identity.items()},
                   "RELEASE_TAG": "v" + VERSION}
    return subprocess.run([sys.executable, "-I", "-S", "-c", GATE], cwd=directory.resolve(), env=environment).returncode


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def records(files):
    return [{"path": name, "size": len(data), "sha256": digest(data)} for name, data in sorted(files.items())]


def write_zip(path, files):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)


class Delivery:
    def __init__(self, root):
        self.root = root
        self.info = {
            "format": 1,
            "version": VERSION,
            "sourceCommit": COMMIT,
            "sourceTree": "2" * 40,
            "baseCommit": COMMIT,
            "dirty": False,
            "assetManifestSha256": "3" * 64,
            "sourceManifestSha256": "4" * 64,
        }
        self.rehash_info()
        # 83 assets and two generated files, just like the current production
        # build. Bytes are deliberately synthetic and never executable.
        self.web = {"index.html": b"synthetic classroom", "orbit-preview/index.html": b"synthetic independent preview"}
        self.web.update({f"assets/asset-{n:03d}.js": b"synthetic asset " + str(n).encode() for n in range(81)})
        self.web["version.html"] = b"synthetic version page"
        self.web["build-info.json"] = pretty(self.info)
        self.windows = {"SunlitClassroom.exe": b"synthetic EXE, never executed", "resources/app.asar": b"synthetic ASAR, never executed", "build-info.json": pretty(self.info)}
        self.manifest = {
            "version": VERSION,
            "electron": "42.0.1",
            "sourceCommit": COMMIT,
            "buildInfo": self.info,
            "webFiles": [],
            "assetManifestSha256": self.info["assetManifestSha256"],
            "assetCount": 83,
            "asarSha256": digest(self.windows["resources/app.asar"]),
            "exeSha256": digest(self.windows["SunlitClassroom.exe"]),
            "files": [],
            "signed": False,
            "windowsRunVerified": False,
        }
        self.smoke = {
            "format": 1,
            "passed": True,
            "status": "passed",
            "version": VERSION,
            "electron": self.manifest["electron"],
            "platform": "win32",
            "arch": "x64",
            "archive": WINDOWS,
            "webArchive": WEB,
            "buildId": self.info["buildId"],
            "buildInfoSha256": digest(pretty(self.info)),
            "exeSha256": self.manifest["exeSha256"],
            "asarSha256": self.manifest["asarSha256"],
            "runId": ENV["BUILD_RUN_ID"],
            "runAttempt": ENV["BUILD_RUN_ATTEMPT"],
            "commit": COMMIT,
        }
        self.notes = "# 晴窗教室 " + VERSION + "\n\n" + "\n".join([
            "Source commit: " + COMMIT,
            "Build ID: " + self.info["buildId"],
            "Build info SHA-256: " + digest(pretty(self.info)),
            "Web archive: " + WEB,
        ]) + "\n"
        self.write()

    def rehash_info(self):
        self.info.pop("buildId", None)
        self.info["buildId"] = digest(pretty(self.info))

    def write(self):
        self.manifest["webFiles"] = records(self.web)
        self.manifest["files"] = records(self.windows)
        manifest_bytes = pretty(self.manifest)
        (self.root / "build-manifest.json").write_bytes(manifest_bytes)
        windows = {"SunlitClassroom/" + name: data for name, data in self.windows.items()}
        windows["SunlitClassroom/build-manifest.json"] = manifest_bytes
        write_zip(self.root / WINDOWS, windows)
        write_zip(self.root / WEB, self.web)
        (self.root / "RELEASE-NOTES.md").write_text(self.notes, encoding="utf-8")
        self.refresh_archive_hashes()

    def refresh_archive_hashes(self):
        windows_hash = digest((self.root / WINDOWS).read_bytes())
        web_hash = digest((self.root / WEB).read_bytes())
        (self.root / "SHA256SUMS.txt").write_text(f"{windows_hash}  {WINDOWS}\n{web_hash}  {WEB}\n", encoding="ascii")
        self.smoke["zipSha256"] = windows_hash
        self.smoke["webZipSha256"] = web_hash
        self.write_smoke()

    def write_smoke(self):
        (self.root / "smoke-report.json").write_bytes(pretty(self.smoke))

    def change_archive(self, name, change):
        with zipfile.ZipFile(self.root / name) as archive:
            files = {entry.filename: archive.read(entry) for entry in archive.infolist()}
        change(files)
        write_zip(self.root / name, files)
        # Keep both outer ZIP digests valid to exercise the inner checks.
        self.refresh_archive_hashes()


class ReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="sunlit-release-gate-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "release"
        self.root.mkdir()
        self.delivery = Delivery(self.root)

    def check_gate(self, passed=False, message=None, **environment):
        result = subprocess.run([sys.executable, "-I", "-S", "-"], input=GATE, text=True, cwd=self.root,
                                env={**ENV, **environment}, capture_output=True, timeout=15)
        if passed:
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("Verified both archives", result.stdout)
        else:
            self.assertNotEqual(result.returncode, 0, "Tampered delivery was accepted")
            if message:
                self.assertIn(message, result.stderr)

    def test_accepts_matching_delivery(self):
        self.check_gate(passed=True)

    def run_delivery_cli(self, environment):
        return subprocess.run([sys.executable, "-I", "-S", str(Path(__file__).resolve()), "--verify-delivery", str(self.root)],
                              env=environment, text=True, capture_output=True, timeout=15)

    def test_real_delivery_cli_uses_current_github_identity(self):
        result = self.run_delivery_cli({**os.environ, "GITHUB_SHA": COMMIT, "GITHUB_RUN_ID": ENV["BUILD_RUN_ID"],
                                       "GITHUB_RUN_ATTEMPT": ENV["BUILD_RUN_ATTEMPT"], "BUILD_SHA": "9" * 40,
                                       "BUILD_RUN_ID": "wrong", "BUILD_RUN_ATTEMPT": "wrong", "RELEASE_TAG": "v9.9.9"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Verified both archives", result.stdout)
        self.assertNotRegex(result.stderr, r"\bRan \d+ tests?\b")

    def test_real_delivery_cli_rejects_missing_github_identity(self):
        identity = {"GITHUB_SHA": COMMIT, "GITHUB_RUN_ID": ENV["BUILD_RUN_ID"], "GITHUB_RUN_ATTEMPT": ENV["BUILD_RUN_ATTEMPT"]}
        for name in identity:
            with self.subTest(name=name):
                environment = {**os.environ, **identity}
                del environment[name]
                result = self.run_delivery_cli(environment)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("requires GitHub identity: " + name, result.stderr)

    def test_real_delivery_cli_rejects_changed_web_bytes(self):
        self.delivery.change_archive(WEB, lambda files: files.__setitem__("index.html", b"tampered"))
        result = self.run_delivery_cli({**os.environ, "GITHUB_SHA": COMMIT, "GITHUB_RUN_ID": ENV["BUILD_RUN_ID"],
                                       "GITHUB_RUN_ATTEMPT": ENV["BUILD_RUN_ATTEMPT"]})
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("ZIP", result.stderr)

    @unittest.skipUnless(os.name == "posix", "shell gate runs on Ubuntu CI")
    def test_full_shell_prepublication_gate(self):
        # Deliberately stop before the moved-tag check and gh release command.
        self.assertNotRegex(SHELL_GATE, r"(?m)^gh ")
        result = subprocess.run(["/bin/bash", "-c", SHELL_GATE], cwd=self.root.parent,
                                env={**ENV, "PATH": os.defpath}, capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Verified both archives", result.stdout)

    def test_accepts_windows_parent_directory_entries(self):
        with zipfile.ZipFile(self.root / WINDOWS, "a") as archive:
            archive.writestr("SunlitClassroom/", b"")
            archive.writestr("SunlitClassroom/resources/", b"")
        self.delivery.refresh_archive_hashes()
        self.check_gate(passed=True)

    def test_rejects_web_directory_entry(self):
        with zipfile.ZipFile(self.root / WEB, "a") as archive:
            archive.writestr("assets/", b"")
        self.delivery.refresh_archive_hashes()
        self.check_gate(message="unexpected ZIP directory")

    def test_asset_count_is_manifest_driven(self):
        self.delivery.web["future-reviewed-resource.js"] = b"synthetic future reviewed asset"
        self.delivery.manifest["assetCount"] += 1
        self.delivery.write()
        self.check_gate(passed=True)

    def test_rejects_extra_delivery_file(self):
        (self.root / "unexpected.txt").write_text("extra")
        self.check_gate(message="exactly six")

    def test_rejects_delivery_directory(self):
        (self.root / "RELEASE-NOTES.md").unlink()
        (self.root / "RELEASE-NOTES.md").mkdir()
        self.check_gate(message="directory or link")

    @unittest.skipUnless(os.name == "posix", "symlink fixtures run on Ubuntu CI")
    def test_rejects_delivery_symlink(self):
        (self.root / "RELEASE-NOTES.md").unlink()
        (self.root / "RELEASE-NOTES.md").symlink_to("SHA256SUMS.txt")
        self.check_gate(message="directory or link")

    def test_rejects_changed_build_metadata(self):
        self.delivery.info["sourceManifestSha256"] = "5" * 64
        self.delivery.write()
        self.check_gate(message="build ID mismatch")

    def test_rejects_dirty_build_even_with_valid_build_id(self):
        self.delivery.info["dirty"] = True
        self.delivery.rehash_info()
        self.delivery.write()
        self.check_gate(message="unclean")

    def test_rejects_wrong_version(self):
        self.delivery.manifest["version"] = "9.9.9"
        self.delivery.write()
        self.check_gate(message="version mismatch")

    def test_rejects_wrong_build_info_version(self):
        self.delivery.info["version"] = "9.9.9"
        self.delivery.rehash_info()
        self.delivery.write()
        self.check_gate(message="buildInfo identity mismatch")

    def test_rejects_wrong_workflow_commit(self):
        self.check_gate(BUILD_SHA="9" * 40, message="workflow commit mismatch")

    def test_rejects_wrong_build_info_commit(self):
        self.delivery.info["sourceCommit"] = "9" * 40
        self.delivery.rehash_info()
        self.delivery.write()
        self.check_gate(message="buildInfo identity mismatch")

    def test_rejects_wrong_base_commit(self):
        self.delivery.info["baseCommit"] = "9" * 40
        self.delivery.rehash_info()
        self.delivery.write()
        self.check_gate(message="buildInfo identity mismatch")

    def test_rejects_wrong_smoke_commit(self):
        self.delivery.smoke["commit"] = "9" * 40
        self.delivery.write_smoke()
        self.check_gate(message="workflow commit mismatch")

    def test_rejects_wrong_smoke_run(self):
        self.delivery.smoke["runId"] = "99999"
        self.delivery.write_smoke()
        self.check_gate(message="smoke workflow run mismatch")

    def test_rejects_wrong_smoke_attempt(self):
        self.check_gate(BUILD_RUN_ATTEMPT="2", message="smoke workflow run mismatch")

    def test_rejects_invalid_tag(self):
        for tag in ["v01.8.2", "1.8.2", "v1.8.2-preview", "v1.8.2\n"]:
            with self.subTest(tag=tag):
                self.check_gate(RELEASE_TAG=tag, message="invalid release tag")

    def test_rejects_non_boolean_smoke_pass(self):
        self.delivery.smoke["passed"] = "true"
        self.delivery.write_smoke()
        self.check_gate(message="did not pass")

    def test_rejects_wrong_build_info_digest(self):
        self.delivery.smoke["buildInfoSha256"] = "f" * 64
        self.delivery.write_smoke()
        self.check_gate(message="smoke build identity mismatch")

    def test_rejects_wrong_smoke_web_archive_digest(self):
        self.delivery.smoke["webZipSha256"] = "f" * 64
        self.delivery.write_smoke()
        self.check_gate(message="smoke archive digest mismatch")

    def test_rejects_wrong_smoke_windows_digest(self):
        self.delivery.smoke["zipSha256"] = "f" * 64
        self.delivery.write_smoke()
        self.check_gate(message="smoke archive digest mismatch")

    def test_rejects_checksum_tampering(self):
        checksum_file = self.root / "SHA256SUMS.txt"
        original = checksum_file.read_bytes()
        cases = [original.upper(), original.replace(b"  ", b" "), original.replace(b"\n", b"\r\n"),
                 original.splitlines(keepends=True)[0], original + b"\n", original[::-1]]
        for value in cases:
            with self.subTest(value=value[:30]):
                checksum_file.write_bytes(value)
                self.check_gate(message="invalid checksums")

    def test_rejects_notes_identity_tampering(self):
        original = self.delivery.notes
        for label in ["Source commit", "Build ID", "Build info SHA-256", "Web archive"]:
            with self.subTest(label=label):
                line = next(line for line in original.splitlines() if line.startswith(label + ":"))
                (self.root / "RELEASE-NOTES.md").write_text(original.replace(line, line + "-changed"), encoding="utf-8")
                self.check_gate(message="release notes identity mismatch")

    def test_rejects_wrong_notes_version_heading(self):
        (self.root / "RELEASE-NOTES.md").write_text(self.delivery.notes.replace("# 晴窗教室 " + VERSION, "# 晴窗教室 9.9.9"), encoding="utf-8")
        self.check_gate(message="release notes version heading mismatch")

    def test_rejects_missing_notes_heading(self):
        (self.root / "RELEASE-NOTES.md").write_text(self.delivery.notes.split("\n", 1)[1], encoding="utf-8")
        self.check_gate(message="release notes version heading mismatch")

    def test_rejects_duplicate_notes_identity(self):
        (self.root / "RELEASE-NOTES.md").write_text(self.delivery.notes + "Source commit: " + COMMIT + "\n", encoding="utf-8")
        self.check_gate(message="release notes identity mismatch")

    def test_rejects_changed_web_byte_with_valid_outer_hashes(self):
        self.delivery.change_archive(WEB, lambda files: files.__setitem__("index.html", b"changed web classroom"))
        self.check_gate(message="ZIP")

    def test_rejects_unlisted_web_member(self):
        self.delivery.change_archive(WEB, lambda files: files.__setitem__("extra.js", b"extra"))
        self.check_gate(message="unexpected ZIP member")

    def test_rejects_missing_web_member(self):
        self.delivery.change_archive(WEB, lambda files: files.pop("version.html"))
        self.check_gate(message="ZIP file list differs")

    def test_rejects_duplicate_web_member(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(self.root / WEB, "a") as archive:
                archive.writestr("index.html", self.delivery.web["index.html"])
        self.delivery.refresh_archive_hashes()
        self.check_gate(message="duplicate ZIP path")

    def test_rejects_unsafe_and_private_zip_members(self):
        for name in ["Data/roster.json", "../escape", "/absolute", "C:/drive", "nested\\file", ".git/config", "class.csv", "class.xlsx", "sunlit-classes-private.json", "aux.txt", "assets/trailing."]:
            with self.subTest(name=name):
                self.delivery.write()
                self.delivery.change_archive(WEB, lambda files: files.__setitem__(name, b"bad"))
                self.check_gate()

    def test_rejects_private_file_even_when_listed_and_hashed(self):
        del self.delivery.web["assets/asset-000.js"]
        self.delivery.web["Data/roster.json"] = b"synthetic private-data fixture"
        self.delivery.write()
        self.check_gate(message="private/build path")

    def test_rejects_hidden_member_even_when_listed_and_hashed(self):
        for name in [".hidden", "assets/.hidden/file.js"]:
            with self.subTest(name=name):
                original = self.delivery.web.pop("assets/asset-000.js")
                self.delivery.web[name] = b"synthetic hidden fixture"
                self.delivery.write()
                self.check_gate(message="hidden archive path")
                del self.delivery.web[name]
                self.delivery.web["assets/asset-000.js"] = original

    def test_rejects_zip_symlink(self):
        with zipfile.ZipFile(self.root / WEB) as archive:
            files = {entry.filename: archive.read(entry) for entry in archive.infolist()}
        with zipfile.ZipFile(self.root / WEB, "w") as archive:
            for name, data in files.items():
                if name == "index.html":
                    entry = zipfile.ZipInfo(name)
                    entry.create_system = 3
                    entry.external_attr = (stat.S_IFLNK | 0o777) << 16
                    archive.writestr(entry, data)
                else:
                    archive.writestr(name, data)
        self.delivery.refresh_archive_hashes()
        self.check_gate(message="non-regular ZIP member")

    def test_rejects_noncanonical_web_build_info_even_when_hashed(self):
        self.delivery.web["build-info.json"] = json.dumps(self.delivery.info).encode()
        self.delivery.write()
        self.check_gate(message="web build-info bytes mismatch")

    def test_rejects_noncanonical_windows_build_info_even_when_hashed(self):
        self.delivery.windows["build-info.json"] = json.dumps(self.delivery.info).encode()
        self.delivery.write()
        self.check_gate(message="Windows build-info bytes mismatch")

    def test_rejects_changed_windows_exe_with_valid_outer_hashes(self):
        self.delivery.change_archive(WINDOWS, lambda files: files.__setitem__("SunlitClassroom/SunlitClassroom.exe", b"tampered EXE"))
        self.check_gate(message="ZIP")

    def test_rejects_windows_asar_smoke_digest_mismatch(self):
        self.delivery.smoke["asarSha256"] = "f" * 64
        self.delivery.write_smoke()
        self.check_gate(message="Windows application digest mismatch")

    def test_rejects_windows_private_data(self):
        self.delivery.change_archive(WINDOWS, lambda files: files.__setitem__("SunlitClassroom/Data/roster.json", b"synthetic"))
        self.check_gate(message="private/build path")

    def test_rejects_changed_embedded_windows_manifest(self):
        self.delivery.change_archive(WINDOWS, lambda files: files.__setitem__("SunlitClassroom/build-manifest.json", b"{}"))
        self.check_gate(message="ZIP")

    def test_rejects_duplicate_json_keys(self):
        filename = self.root / "build-manifest.json"
        filename.write_bytes(filename.read_bytes().replace(b'{\n', b'{\n  "version": "1.8.2",\n', 1))
        self.check_gate(message="duplicate JSON key")

    def test_rejects_duplicate_manifest_paths(self):
        manifest = copy.deepcopy(self.delivery.manifest)
        manifest["webFiles"].append(manifest["webFiles"][0])
        (self.root / "build-manifest.json").write_bytes(pretty(manifest))
        self.check_gate(message="duplicate webFiles path")

    def test_rejects_wrong_asset_manifest_identity(self):
        self.delivery.manifest["assetManifestSha256"] = "f" * 64
        self.delivery.write()
        self.check_gate(message="asset manifest identity mismatch")

    def test_rejects_wrong_asset_count(self):
        self.delivery.manifest["assetCount"] += 1
        self.delivery.write()
        self.check_gate(message="expected approved assets")

    def test_publish_permission_boundary(self):
        publish = WORKFLOW.split("  publish:\n", 1)[1]
        self.assertNotRegex(publish, r"actions/checkout|\bnpm\b(?!,)|\bnode\s")
        self.assertNotIn("run-id:", publish)
        self.assertNotIn("repository:", publish)
        self.assertIn("digest-mismatch: error", publish)
        self.assertIn('gh api "repos/$REPOSITORY/commits/$RELEASE_TAG"', publish)
        self.assertIn('"$archive" "$web_archive" SHA256SUMS.txt', publish)
        self.assertNotIn("--clobber", publish)
        self.assertNotIn("pull_request_target:", WORKFLOW)
        self.assertEqual(WORKFLOW.count("contents: write"), 1)
        self.assertIn("workflow_dispatch is always artifact-only", publish)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-delivery", type=Path, metavar="DIRECTORY", help="validate real CI delivery with the same inline gate; never publish")
    arguments, test_arguments = parser.parse_known_args()
    if arguments.verify_delivery is not None:
        if test_arguments:
            parser.error("unexpected arguments with --verify-delivery: " + " ".join(test_arguments))
        sys.exit(verify_delivery(arguments.verify_delivery))
    unittest.main(argv=[sys.argv[0], *test_arguments], verbosity=2)
