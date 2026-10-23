# Guarded DiagramCloud private package publisher

Prepared for source `130c70744ec8fdeefebb784c56afb53c182f8dfa`, product `1.33.1`, new immutable package version `1.33.1-130c707`. The only destination is private GitLab project `87564954`, `juliandatapass-group/galaxy-release-vault`, generic package `diagramcloud`.

The script uses the existing authenticated `glab` CLI. It never reads token values, changes authentication, modifies project settings, deletes packages, or retries a write. `glab api --help` confirms `--input` sends a raw request body and supports explicit `--method` and `--header`. Uploads use PUT with `Content-Type: application/octet-stream`; downloads capture raw subprocess bytes.

Run from the DiagramCloud workspace with Python 3.11 or newer. The bundled runtime is `C:\Users\julia\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.

```powershell
$publisherPython = 'C:\Users\julia\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $publisherPython .local/continuation/publish-private-package.py --self-check
```

This read-only check verifies CLI capabilities, destination identity/privacy/packages/permission and that the version is absent. It does not qualify an unbuilt package or exercise upload permissions.

After exact-source main CI succeeds and the integrator has completed the eight qualification checks, create a new candidate directory with `npm run package:candidate`. Do not reuse any existing package directory. Then validate the actual package without uploading:

```powershell
& $publisherPython .local/continuation/publish-private-package.py --package-dir .local/integration/DIAGRAM/130c70744ec8fdeefebb784c56afb53c182f8dfa
```

The directory must have the exact 14 upload files: the 11 READY artifacts, READY.json, SHA256SUMS.txt and source-members.txt. Only the packager's local cli directory is allowed alongside them. Validation checks all 12 SHA entries, every READY artifact hash and size, exact source/version/CI/check identities, every tracked source Git blob in the source archive, both archived build handshakes, and the source-members path list. The eight required PASS checks are typecheck, unit, build, browser, real-atlas-quality, pptx-zip, pptx-visual and bundled-cli.

When the integrator is ready to publish the reviewed package, the explicit write command is:

```powershell
& $publisherPython .local/continuation/publish-private-package.py --package-dir .local/integration/DIAGRAM/130c70744ec8fdeefebb784c56afb53c182f8dfa --publish --receipt-dir .local/continuation/private-publication-1.33.1-130c707
```

The script rechecks the destination and absent version, creates an exclusive local lock, uploads sequentially, and checks the remote package ID plus the exact accumulated file inventory before and after each write. Version discovery checks all six GitLab package states (default, deprecated, error, hidden, processing and pending_destruction), deduplicated by package ID; a hidden or incomplete version still blocks publication. These independent inventory reads run in parallel; uploads stay sequential. It then independently re-downloads all 14 files with authentication and compares raw-byte SHA256 and size. Every file must separately refuse an anonymous, nonredirected GET with HTTP 401, 403 or 404. The final receipt records counts, identities, hashes, upload responses and anonymous statuses without credentials or tokenized URLs.

The GitLab generic API has no atomic create-version reservation in this tool. The local lock and repeated remote collision checks protect against ordinary duplicate/competing runs, but cannot eliminate a separate writer racing between a remote check and PUT. Keep the release lane single-writer. The script refuses any existing version before publication and never resumes or overwrites it.

If any write or readback fails, stop. The receipt status is FAILED_OR_PARTIAL; the exclusive lock remains. Inspect the recorded package ID and remote files read-only. Do not rerun publication, remove a remote file, or label the package verified based on partial success. A recovery policy must be reviewed separately; this tool intentionally provides no overwrite, delete or resume switch.

Preparation validation: live read-only self-check only. No upload, fake write test, token read, authentication change or tracked source edit is part of preparing this tool.
