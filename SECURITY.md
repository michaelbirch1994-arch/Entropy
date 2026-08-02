# Security

Entropy is a desktop app that reads your local Guild Wars 2 combat logs and
uploads them to dps.report for parsing. It does not collect telemetry, does
not talk to any server other than dps.report and GitHub (for update checks),
and only reads files you explicitly pick via the native folder/file dialog.

## Reporting a vulnerability

If you find a security issue - anything from a bug that could let a
malicious combat log or dps.report response execute code, to a flaw in how
releases are signed or distributed - please open a GitHub issue on this
repo, or a private security advisory via GitHub's "Report a vulnerability"
button under the Security tab, rather than a public issue if the report
involves an exploitable bug. There is currently no dedicated security email
- GitHub is the single point of contact for this project.

## How releases are protected

- **Updater signing**: every desktop build is signed with an Ed25519
  private key that never leaves GitHub Actions secrets. The app verifies
  this signature before installing any update - a compromised or tampered
  update file will be rejected, not installed.
- **Build provenance**: each release's installers are attested via GitHub's
  build provenance (`actions/attest-build-provenance`), which cryptographically
  ties a given binary back to the exact commit, workflow, and Actions run
  that produced it. Verify any downloaded installer with:
  ```
  gh attestation verify <downloaded-file> --owner michaelbirch1994-arch
  ```
- **Checksums**: a `checksums-<platform>.txt` file (SHA-256) is attached to
  each release alongside the installers, for anyone who wants to verify a
  download's integrity independent of the updater or GitHub's own TLS.
- **Least-privilege desktop permissions**: the desktop app only requests the
  specific OS-level capabilities it needs (native folder/file picker, read
  access to a folder you explicitly connect, and update-check/install) -
  see `src-tauri/capabilities/default.json`. It does not have broad
  filesystem, network, or shell access.
- **Source availability**: this project is GPL-3.0 licensed and this repo is
  public specifically so anyone can audit exactly what the app does before
  running it, rather than trusting a closed binary.

## Known limitations

- Windows and macOS builds are **not** signed with a paid code-signing
  certificate (Microsoft Authenticode / Apple Developer ID), so you will see
  an "unknown publisher" warning on Windows and may need to approve the app
  once in macOS's Privacy & Security settings on first launch. This does not
  affect the update-signing described above - it only affects the OS's own
  "who published this" check, not whether the binary has been tampered with.
