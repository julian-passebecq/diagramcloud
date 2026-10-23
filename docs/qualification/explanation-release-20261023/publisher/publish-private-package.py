#!/usr/bin/env python3
"""One-source private package publication. Default and --self-check are read-only.

Uses glab's configured authentication without reading token values. Never retries
writes, overwrites a version, deletes remote files, or changes authentication.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError
from urllib.request import Request, HTTPRedirectHandler, build_opener

PROJECT_ID = 87564954
NAMESPACE = "juliandatapass-group/galaxy-release-vault"
PACKAGE = "diagramcloud"
VERSION = "1.33.1-130c707"
PRODUCT_VERSION = "1.33.1"
SOURCE = "130c70744ec8fdeefebb784c56afb53c182f8dfa"
HOST = "gitlab.com"
API = f"https://{HOST}/api/v4"
PACKAGE_STATUSES = ("default", "deprecated", "error", "hidden", "processing", "pending_destruction")
CHECKS = {"typecheck", "unit", "build", "browser", "real-atlas-quality",
          "pptx-zip", "pptx-visual", "bundled-cli"}
ARTIFACTS = (
    "diagramcloud-source-and-build.tar.gz", "diagramcloud-web-build.tar.gz",
    "diagramcloud-cli.tar.gz", "diagramcloud-synthetic-examples.tar.gz",
    "outcome.json", "SHIP-REPORT.md", "RESUME.md", "delivery-receipt.json",
    "SOURCE_COMMIT.txt", "PACKAGE-README.md", "archive-listing.txt",
)
HASHED = ARTIFACTS + ("READY.json",)
FILES = HASHED + ("SHA256SUMS.txt", "source-members.txt")
WORKSPACE = Path(__file__).resolve().parents[2]
LOCAL = WORKSPACE / ".local"
CONTINUATION = LOCAL / "continuation"


class Refusal(RuntimeError):
    pass


def require(ok, message):
    if not ok:
        raise Refusal(message)


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def execute(argv, *, timeout=300):
    env = os.environ.copy()
    # Never enable HTTP debug output, which can contain authentication headers.
    env.pop("GLAB_DEBUG_HTTP", None)
    env.pop("GITLAB_DEBUG_HTTP", None)
    try:
        result = subprocess.run(argv, cwd=WORKSPACE, env=env, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Refusal(f"CLI execution failed ({type(error).__name__}); no write retry") from None
    if result.returncode:
        # Do not print or persist raw CLI diagnostics, credentials, or URLs.
        status = re.search(rb"HTTP (\d{3})", result.stderr)
        suffix = f", HTTP {status.group(1).decode()}" if status else ""
        raise Refusal(f"CLI request failed (exit {result.returncode}{suffix}); no write retry")
    return result.stdout


def glab_api(endpoint, *, method="GET", input_file=None):
    glab = shutil.which("glab")
    require(glab is not None, "glab is not available")
    args = [glab, "api", "--hostname", HOST, "--method", method]
    if input_file is not None:
        require(method == "PUT", "Only the explicit publication path accepts a body")
        args += ["--header", "Content-Type: application/octet-stream", "--input", str(input_file)]
    args.append(endpoint)
    return execute(args)


def api_json(endpoint):
    return json.loads(glab_api(endpoint))


def pages(endpoint):
    result = []
    for page in range(1, 21):
        separator = "&" if "?" in endpoint else "?"
        rows = api_json(f"{endpoint}{separator}per_page=100&page={page}")
        require(isinstance(rows, list), "Unexpected GitLab list response")
        result.extend(rows)
        if len(rows) < 100:
            return result
    raise Refusal("GitLab pagination exceeded the bounded inventory")


def project_check():
    row = api_json(f"projects/{PROJECT_ID}")
    require(row.get("id") == PROJECT_ID and row.get("path_with_namespace") == NAMESPACE,
            "GitLab destination identity changed")
    require(row.get("visibility") == "private" and row.get("archived") is False
            and row.get("packages_enabled") is True,
            "Destination must be private, unarchived, with packages enabled")
    permissions = row.get("permissions") or {}
    access = max(((permissions.get(kind) or {}).get("access_level", 0)
                  for kind in ("project_access", "group_access")), default=0)
    require(access >= 40, "Maintainer or owner-level destination permission is required")
    return {"id": PROJECT_ID, "path_with_namespace": NAMESPACE,
            "visibility": "private", "archived": False, "packages_enabled": True,
            "access_level": access}


def selected_packages():
    # The unfiltered endpoint hides some states. An existing hidden, processing,
    # or pending-destruction version is also an immutable collision.
    endpoint = (f"projects/{PROJECT_ID}/packages?package_type=generic"
                f"&package_name={PACKAGE}&package_version={VERSION}&status=")
    with ThreadPoolExecutor(max_workers=len(PACKAGE_STATUSES)) as pool:
        groups = list(pool.map(lambda status: pages(endpoint + status), PACKAGE_STATUSES))
    found = {}
    for rows in groups:
        for row in rows:
            if row.get("name") == PACKAGE and row.get("version") == VERSION:
                require(isinstance(row.get("id"), int), "GitLab package has no numeric identity")
                found[row["id"]] = row
    return list(found.values())


def require_absent():
    require(not selected_packages(), f"Immutable version {VERSION} already exists; refusing all writes")


def handshake_check(row):
    require(row.get("schema_version") == 1 and row.get("app_id") == PACKAGE
            and row.get("product_version") == PRODUCT_VERSION
            and row.get("source_revision") == SOURCE
            and row.get("galaxy_level") == "G0" and row.get("standalone") is True,
            "Archive build handshake does not identify the exact standalone source")


def source_archive_check(path):
    tree = execute(["git", "ls-tree", "-r", "--full-tree", "-z", SOURCE])
    tracked = {}
    for entry in tree.split(b"\0"):
        if not entry:
            continue
        header, name = entry.split(b"\t", 1)
        mode, kind, oid = header.split()
        require(kind == b"blob" and mode in (b"100644", b"100755"),
                "Unexpected non-file tracked source entry")
        tracked[name.decode("utf-8")] = oid.decode("ascii")
    seen, handshake = set(), None
    with tarfile.open(path, "r|gz") as archive:
        for member in archive:
            name = member.name.removeprefix("./")
            parts = PurePosixPath(name).parts
            require(not name.startswith("/") and ".." not in parts and "\\" not in name,
                    "Unsafe source archive member")
            require(not member.issym() and not member.islnk(), "Source archive contains a link")
            require(not any(part in (".git", ".local", "node_modules") for part in parts),
                    "Forbidden source archive member")
            if not member.isfile():
                continue
            if name in tracked or name in ("dist/galaxy/version-handshake.json", "package.json"):
                stream = archive.extractfile(member)
                require(stream is not None, "Archive source file is unreadable")
                data = stream.read()
                if name in tracked:
                    oid = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
                    require(oid == tracked[name], f"Tracked source blob mismatch: {name}")
                    seen.add(name)
                if name == "package.json":
                    require(json.loads(data).get("version") == PRODUCT_VERSION,
                            "Archive product version mismatch")
                if name == "dist/galaxy/version-handshake.json":
                    handshake = json.loads(data)
    require(seen == set(tracked), "Source archive omits tracked source files")
    require(handshake is not None, "Source archive omits the build handshake")
    handshake_check(handshake)
    return {"tracked_files_compared": len(tracked), "tracked_blob_mismatches": 0,
            "built_source_revision": handshake["source_revision"]}


def validate_package(package_dir):
    package_dir = package_dir.resolve(strict=True)
    require(package_dir.is_dir() and package_dir.is_relative_to(LOCAL.resolve()),
            "Package directory must be inside this workspace's .local directory")
    require({p.name for p in package_dir.iterdir() if p.is_file()} == set(FILES),
            "Package must contain exactly the 14 allowlisted top-level files")
    require(all(p.name == "cli" and p.is_dir() and not p.is_symlink()
                for p in package_dir.iterdir() if not p.is_file()),
            "Unexpected package directory entry")
    metadata = {}
    for name in FILES:
        path = package_dir / name
        require(path.is_file() and not path.is_symlink(), "Package file is absent or is a symlink")
        require(0 < path.stat().st_size < 1024 ** 3, "Package file size is outside the allowed range")
        metadata[name] = {"bytes": path.stat().st_size, "sha256": file_hash(path)}
    sums = {}
    for line in (package_dir / "SHA256SUMS.txt").read_text(encoding="utf-8-sig").splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  ([A-Za-z0-9._-]+)", line)
        require(match is not None, "Malformed SHA256SUMS entry")
        sha, name = match.groups()
        require(name not in sums, "Duplicate SHA256SUMS entry")
        sums[name] = sha
    require(set(sums) == set(HASHED), "SHA256SUMS must contain exactly the 12 expected entries")
    require(all(sums[name] == metadata[name]["sha256"] for name in HASHED), "Package checksum mismatch")
    require((package_dir / "SOURCE_COMMIT.txt").read_text(encoding="utf-8").strip() == SOURCE,
            "SOURCE_COMMIT identity mismatch")
    ready = read_json(package_dir / "READY.json")
    require(ready.get("schema") == "galaxy.component-ready/1"
            and ready.get("componentId") == PACKAGE and ready.get("componentVersion") == PRODUCT_VERSION
            and ready.get("sourceSha") == SOURCE and "synthetic" not in ready,
            "READY identity mismatch")
    rows = ready.get("artifacts", [])
    require(len(rows) == len(ARTIFACTS) and {r.get("relativePath") for r in rows} == set(ARTIFACTS),
            "READY artifact allowlist mismatch")
    for row in rows:
        expected = metadata[row["relativePath"]]
        require(row.get("sha256") == expected["sha256"] and row.get("bytes") == expected["bytes"],
                "READY artifact checksum or size mismatch")
    evidence = read_json(package_dir / "delivery-receipt.json")
    ci = evidence.get("ci", {})
    require("synthetic" not in evidence and evidence.get("sourceSha") == SOURCE
            and ci.get("sourceSha") == SOURCE and ci.get("conclusion") == "success"
            and re.fullmatch(r"https://github\.com/julian-passebecq/diagramcloud/actions/runs/\d+", ci.get("url", "")),
            "Exact-source successful CI evidence is required")
    require(ready.get("checks") == evidence.get("checks"), "READY and delivery check records differ")
    passed = {row.get("id") for row in evidence.get("checks", [])
              if row.get("status") == "PASS" and row.get("evidenceRefs")}
    require(CHECKS <= passed, "A required package qualification check is missing")
    for line in (package_dir / "source-members.txt").read_text(encoding="utf-8-sig").splitlines():
        parts = PurePosixPath(line).parts
        require(line and not line.startswith(("/", "-")) and "\\" not in line
                and ".." not in parts and not any(p in (".git", ".local", "node_modules") for p in parts),
                "Unsafe source-members entry")
    source_audit = source_archive_check(package_dir / ARTIFACTS[0])
    with tarfile.open(package_dir / "diagramcloud-web-build.tar.gz", "r:gz") as archive:
        matches = [m for m in archive.getmembers()
                   if m.name.removeprefix("./") == "galaxy/version-handshake.json" and m.isfile()]
        require(len(matches) == 1, "Web archive must contain one build handshake")
        handshake_check(json.load(archive.extractfile(matches[0])))
    return package_dir, metadata, {"files": len(FILES), "checksum_entries": len(HASHED),
                                   "source_audit": source_audit, "ci": ci}


def remote_inventory(package_id, expected):
    rows = selected_packages()
    require(len(rows) == 1 and rows[0].get("id") == package_id,
            "Remote package identity changed during publication")
    files = pages(f"projects/{PROJECT_ID}/packages/{package_id}/package_files")
    require(len(files) == len(expected) and {r.get("file_name") for r in files} == set(expected),
            "Unexpected or duplicate remote package files; refusing further writes")
    for row in files:
        local = expected[row["file_name"]]
        require(row.get("file_sha256") == local["sha256"] and row.get("size") == local["bytes"],
                "Remote package file metadata differs from the uploaded bytes")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def anonymous_refusal(endpoint):
    # No cookies, tokens, auth handlers, or redirect following.
    opener = build_opener(NoRedirect())
    request = Request(f"{API}/{endpoint}", method="GET", headers={"User-Agent": "DiagramCloud-package-audit"})
    try:
        with opener.open(request, timeout=60) as response:
            status = response.status
    except HTTPError as error:
        status = error.code
    require(status in (401, 403, 404), f"Anonymous request did not refuse access (HTTP {status})")
    return status


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true", help="Read-only CLI/project/version checks; no package required")
    parser.add_argument("--package-dir", type=Path)
    parser.add_argument("--receipt-dir", type=Path)
    parser.add_argument("--publish", action="store_true", help="Actually upload the validated new package, then read it back")
    args = parser.parse_args()
    require(not (args.self_check and args.publish), "--self-check cannot publish")
    require(args.self_check or args.package_dir is not None, "--package-dir is required outside --self-check")
    require(not args.self_check or args.package_dir is None, "Use package preflight separately from --self-check")
    require(not args.receipt_dir or args.publish, "--receipt-dir is only used by explicit publication")
    glab = shutil.which("glab")
    require(glab is not None, "glab is not available")
    help_text = execute([glab, "api", "--help"]).decode("utf-8", errors="replace")
    require("--input" in help_text and "--method" in help_text and "--header" in help_text,
            "Configured glab lacks raw upload flags")
    project = project_check()
    require_absent()
    report = {"schema": "diagramcloud.private-publication/1", "captured_at": now(),
              "mode": "self-check" if args.self_check else "publish" if args.publish else "preflight",
              "source_sha": SOURCE, "package_name": PACKAGE, "package_version": VERSION,
              "project": project, "version_absent_at_start": True,
              "checked_package_statuses": list(PACKAGE_STATUSES),
              "publisher_sha256": file_hash(Path(__file__)), "writes_attempted": 0,
              "uploads": [], "readbacks": [], "status": "PASS"}
    if args.self_check:
        print(json.dumps(report, indent=2))
        return
    package_dir, metadata, audit = validate_package(args.package_dir)
    report["local_validation"] = audit
    report["files"] = metadata
    if not args.publish:
        print(json.dumps(report, indent=2))
        return
    receipt_dir = (args.receipt_dir or CONTINUATION / f"private-publication-{VERSION}").resolve()
    require(receipt_dir.is_relative_to(CONTINUATION.resolve()) and not receipt_dir.exists(),
            "Receipt directory must be new and inside .local/continuation")
    lock = CONTINUATION / f"private-publication-{VERSION}.lock"
    try:
        lock_fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise Refusal("Publication lock already exists; inspect the prior result before any continuation") from None
    os.write(lock_fd, json.dumps({"pid": os.getpid(), "source": SOURCE, "at": now()}).encode())
    os.close(lock_fd)
    receipt_dir.mkdir()
    receipt = receipt_dir / "publication-receipt.json"

    def save():
        receipt.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    succeeded = False
    try:
        project_check()
        require_absent()
        uploaded = {}
        package_id = None
        for name in FILES:
            project_check()
            if package_id is None:
                require_absent()
            else:
                remote_inventory(package_id, uploaded)
            require(file_hash(package_dir / name) == metadata[name]["sha256"], "Local package changed before upload")
            endpoint = f"projects/{PROJECT_ID}/packages/generic/{PACKAGE}/{VERSION}/{name}"
            report["status"] = "IN_PROGRESS"
            report["writes_attempted"] += 1
            report["pending_file"] = name
            save()
            response = json.loads(glab_api(endpoint, method="PUT", input_file=package_dir / name))
            require(response.get("message") == "201 Created", "Unexpected upload response; outcome requires read-only inspection")
            report["uploads"].append({"file": name, "response": "201 Created", **metadata[name]})
            uploaded[name] = metadata[name]
            rows = selected_packages()
            require(len(rows) == 1, "Remote version must resolve to exactly one package")
            if package_id is None:
                package_id = rows[0]["id"]
                report["package_id"] = package_id
            remote_inventory(package_id, uploaded)
            report.pop("pending_file", None)
            save()
        project_check()
        remote_inventory(package_id, metadata)
        for name in FILES:
            endpoint = f"projects/{PROJECT_ID}/packages/generic/{PACKAGE}/{VERSION}/{name}"
            # subprocess stdout is bytes: no PowerShell text redirection/encoding.
            data = glab_api(endpoint)
            require(len(data) == metadata[name]["bytes"] and digest(data) == metadata[name]["sha256"],
                    "Fresh authenticated readback differs from local bytes")
            status = anonymous_refusal(endpoint)
            report["readbacks"].append({"file": name, "bytes": len(data), "sha256": digest(data),
                                         "authenticated_match": True, "anonymous_status": status})
            save()
        require(all(file_hash(package_dir / name) == metadata[name]["sha256"] for name in FILES),
                "Local package changed during publication")
        project_check()
        remote_inventory(package_id, metadata)
        report["status"] = "PASS"
        report["finished_at"] = now()
        save()
        succeeded = True
        print(json.dumps({"status": "PASS", "package_id": package_id, "version": VERSION,
                          "uploads": len(report["uploads"]), "verified_readbacks": len(report["readbacks"]),
                          "receipt": str(receipt)}, indent=2))
    except Exception as error:
        report["status"] = "FAILED_OR_PARTIAL"
        report["failure"] = str(error) if isinstance(error, Refusal) else type(error).__name__
        report["finished_at"] = now()
        save()
        raise
    finally:
        if succeeded:
            lock.unlink()
        # A failed/uncertain write leaves the lock and receipt for read-only recovery.


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        message = str(error) if isinstance(error, Refusal) else type(error).__name__
        print(json.dumps({"status": "REFUSED_OR_FAILED", "reason": message}), file=sys.stderr)
        sys.exit(1)
