"""Build, prove and stage the separate website assets for one stable commit."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from email import message_from_bytes
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as installed_version
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

TOOLS = Path(__file__).resolve().parent
CORE_PATH = "custom_components/houseplan/core"
FRONT_META = "houseplan-standalone-manifest.json"
SHA = re.compile(r"[0-9a-f]{64}")
ASSET_PATH = re.compile(r"[A-Za-z0-9_./-]+")


def run(command, cwd, *, capture=False, env=None):
    return subprocess.run(command, cwd=cwd, check=True, text=True, capture_output=capture, env=env).stdout


def git(root, *arguments):
    return run(["git", *arguments], root, capture=True).strip()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def hash_bytes(content):
    return hashlib.sha256(content).hexdigest()


def asset(path):
    content = path.read_bytes()
    return {"name": path.name, "bytes": len(content), "sha256": hash_bytes(content)}


def literal(path, name):
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == name for target in node.targets
        ):
            return ast.literal_eval(node.value)
    raise ValueError(f"No literal {name} in {path.name}")


def compatibility(root, python_requirement):
    constants = root / CORE_PATH / "constants.py"
    document = root / CORE_PATH / "house_document.py"
    tree = ast.parse(document.read_text(encoding="utf-8"))
    optional = [ast.literal_eval(node) for node in ast.walk(tree) if isinstance(node, ast.Dict)
                and len(node.keys) == 1 and isinstance(node.keys[0], ast.Constant)
                and node.keys[0].value == "furniture_workstation_api"]
    require(len(optional) == 1, "Missing or ambiguous conditional house API in the exporter")
    return {
        "modelVersion": literal(constants, "PLAN_MODEL_VERSION"),
        "spaceExportVersion": literal(constants, "EXPORT_VERSION"),
        "houseExportVersion": literal(document, "EXPORT_VERSION"),
        "houseRequiredApi": literal(document, "REQUIRED_API"),
        "houseOptionalApi": optional[0],
        "firstStableWithHouseImport": "1.86.0",
        "python": python_requirement,
    }


def verify_wheel(root, wheel, version):
    tracked = git(root, "ls-files", "--", CORE_PATH).splitlines()
    prefix = CORE_PATH + "/"
    files = {name[len(prefix):]: (root / name).read_bytes() for name in tracked if name.endswith(".py")}
    with ZipFile(wheel) as package:
        names = package.namelist()
        require(len(set(names)) == len(names), "Duplicate wheel member")
        source = json.loads(package.read("houseplan_core/distribution.json"))
        require(source["product_version"] == source["version"] == version, "Wheel version differs")
        expected = {name: hash_bytes(content) for name, content in files.items()}
        require(source["sources_sha256"] == expected, "Wheel source manifest differs from the candidate")
        entries = {name for name in names if name.startswith("houseplan_core/") and name.endswith(".py")}
        require(entries == {"houseplan_core/" + name for name in files}, "Wheel source set differs")
        for name, content in files.items():
            require(package.read("houseplan_core/" + name) == content, f"Wheel source differs: {name}")
        metadata, = (name for name in names if name.endswith(".dist-info/METADATA"))
        fields = message_from_bytes(package.read(metadata))
        require(fields["Version"] == version and fields["Name"] == "houseplan-core", "Wrong wheel metadata")
        require(fields["Requires-Python"] and fields["Requires-Python"].startswith(">=3.14"),
                "Unrecognized core runtime")
        return fields["Requires-Python"]


def frontend_files(directory, version, commit, fingerprint):
    manifest_path = directory / FRONT_META
    manifest = json.loads(manifest_path.read_bytes())
    require(manifest["product"] == "houseplan-standalone" and manifest["schema"] == 1,
            "Not a standalone editor build")
    require(manifest["version"] == version and manifest["source"]["commit"] == commit
            and manifest["source"]["fingerprint"] == fingerprint and not manifest["source"]["dirty"],
            "Standalone editor does not match the released candidate or HACS fingerprint")
    files = {FRONT_META: manifest_path.read_bytes()}
    for item in manifest["files"]:
        name = item["path"]
        require(ASSET_PATH.fullmatch(name) and not any(part in ("", ".", "..") for part in name.split("/"))
                and name not in files, "Invalid or duplicate standalone archive member")
        path = PurePosixPath(name)
        require(not any((directory / parent).is_symlink() for parent in (path, *path.parents)),
                "Linked standalone asset")
        content = (directory / path).read_bytes()
        require(item["bytes"] == len(content) and item["sha256"] == hash_bytes(content),
                f"Standalone file differs: {name}")
        files[name] = content
    require(all(manifest[key] in files for key in ("entry", "stylesheet", "font")), "Incomplete editor")
    for module in manifest["modules"]:
        require(all(path in files for path in (module["path"], *module["imports"], *module["dynamicImports"])),
                "Missing dependency from the editor archive")
    return files


def make_archive(path, files):
    with ZipFile(path, "w") as archive:
        for name, content in sorted(files.items()):
            entry = ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content, ZIP_DEFLATED, compresslevel=9)


def validate_hacs(path, version, expected_hash):
    require(SHA.fullmatch(expected_hash) and asset(path)["sha256"] == expected_hash, "Unverified HACS ZIP")
    with ZipFile(path) as archive:
        require(json.loads(archive.read("manifest.json"))["version"] == version, "Wrong HACS ZIP version")
        fingerprint = json.loads(archive.read("frontend/houseplan-assets.json"))["fingerprint"]
        require(SHA.fullmatch(fingerprint), "Invalid HACS frontend fingerprint")
        return fingerprint


def ensure_toolchain():
    for file in ("site-release-build.txt", "site-release-runtime.txt"):
        for line in (TOOLS / file).read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            name, expected = line.split("==", 1)
            try:
                found = installed_version(name)
            except PackageNotFoundError:
                found = None
            require(found == expected, f"Prepare the standalone release venv: {name}=={expected} is required")


def verify_source(root, commit, version):
    require(git(root, "rev-parse", "HEAD") == commit and
            not git(root, "status", "--porcelain", "--untracked-files=no"),
            "Build only an exact source checkout with no tracked changes")
    untracked_sources = git(root, "ls-files", "--others", "--exclude-standard", "--",
                            CORE_PATH, "src", "assets", "scripts", "demo/fixtures")
    require(not untracked_sources, "Untracked source inputs are not part of the release commit")
    tag = f"refs/tags/v{version}"
    if git(root, "tag", "-l", f"v{version}"):
        require(git(root, "rev-parse", tag + "^{commit}") == commit,
                "Existing release tag points to a different commit")


def prepare(source, output, hacs, hacs_hash, commit, version):
    ensure_toolchain()
    require(re.fullmatch(r"\d+\.\d+\.\d+", version), "Expected an ordinary stable version")
    verify_source(source, commit, version)
    require(json.loads((source / "package.json").read_text(encoding="utf-8"))["version"] == version,
            "Source version differs from the tag")
    fingerprint = validate_hacs(hacs, version, hacs_hash)
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hp-site-release-", dir=output) as temp:
        stage = Path(temp)
        native_env = {**os.environ, "SOURCE_DATE_EPOCH": git(source, "log", "-1", "--format=%ct"),
                      "PIP_CONSTRAINT": str(TOOLS / "site-release-runtime.txt")}
        run(["npm", "run", "build:standalone"], source)
        core = stage / "core"
        run([sys.executable, str(source / "tools/build_core_package.py"), "--no-isolation", "--out", str(core)],
            source, env=native_env)
        wheel = core / f"houseplan_core-{version}-py3-none-any.whl"
        python_requirement = verify_wheel(source, wheel, version)
        files = frontend_files(source / "dist-standalone", version, commit, fingerprint)
        frontend = stage / f"houseplan-standalone-{version}.zip"
        make_archive(frontend, files)
        extracted = stage / "editor"
        with ZipFile(frontend) as archive:
            # Read the bytes back from the actual artifact, not from the build directory.
            require(archive.namelist() == sorted(files) and archive.testzip() is None, "Corrupt standalone ZIP")
            for name in archive.namelist():
                target = extracted / PurePosixPath(name)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(name))
        require(frontend_files(extracted, version, commit, fingerprint) == files, "Incomplete unpacked distribution")
        run([sys.executable, str(TOOLS / "smoke_core_package.py"), "--dist", str(core),
             "--wheel-only", "--external-adapter"], stage, env=native_env)
        run(["node", str(TOOLS.parent / "process-next/catalog/site-release-browser.mjs"),
             str(source), str(extracted)], TOOLS.parent,
            env={**os.environ, "HP_STANDALONE_PYTHON": sys.executable})
        verify_source(source, commit, version)
        require(asset(hacs)["sha256"] == hacs_hash, "HACS ZIP changed during verification")
        receipt = stage / f"houseplan-site-{version}.json"
        receipt.write_text(json.dumps({"schema": 1, "tag": f"v{version}", "version": version,
                                      "sourceSha": commit, "sourceFingerprint": fingerprint,
                                      "compatibility": compatibility(source, python_requirement),
                                      "assets": [asset(wheel), asset(frontend), {**asset(hacs), "name": "houseplan.zip"}]},
                                     indent=2) + "\n", encoding="utf-8")
        frozen = (wheel, frontend, receipt)
        for path in frozen:
            destination = output / path.name
            require(not destination.is_symlink() and (
                not destination.exists() or asset(destination) == asset(path)), f"Conflicting output: {path.name}")
        for path in frozen:
            destination = output / path.name
            if not destination.exists():
                with path.open("rb") as content, destination.open("xb") as target:
                    shutil.copyfileobj(content, target)
        return output / receipt.name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--hacs", type=Path, required=True)
    parser.add_argument("--hacs-sha256", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    print(prepare(args.source.resolve(), args.out.resolve(), args.hacs.resolve(),
                  args.hacs_sha256, args.sha, args.version))


if __name__ == "__main__":
    main()
