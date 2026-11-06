# Changelog

## 0.1.0 — 2026-11-06

- Added Beads integrations for Orca, Tern and Paseo, plus desktop tray/menu-bar applications for Linux and macOS.
- Added a native Omarchy Quickshell widget and an optional Waybar adapter.
- Implemented real Beads create, update, claim, close, reopen, reclaim, dependency and comment operations through the installed CLI.
- Added board/table views, native readiness filters, dependency details, keyboard actions and guarded close undo using the supplied warm monochrome design.
- Preserved native dependency edges for singleton queries and suppressed directory-default list filtering without changing project configuration.
- Preserved unrelated concurrent issue changes in edited-field updates; pending native-host actions retain their selected issue.
- Added bounded authenticated loopback development transport and constrained desktop IPC.
- Added Linux/macOS CI packaging, version-tagged releases, checksum verification and optional Apple signing/notarization through Actions secrets.
- Verified packaged Linux and macOS renderer startup, isolated real database writes and popup dimensions in CI.
- Fixed search focus during synchronous input/change events and kept close undo above the detail drawer.
- Fixed native Tern surface painting by leaving its overlay transparent; enabled scrolling to clipped details.
- Rendered native Paseo comments as author, timestamp and text.

Known runtime limits and exercised checks are recorded in [docs/verification.md](docs/verification.md).
