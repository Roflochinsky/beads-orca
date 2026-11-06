# Changelog

## 0.1.1 — 2026-11-06

- Made this repository exclusively the Orca plugin. Other integrations, native desktop delivery and the synthetic design reference belong to [beads-hud/native](https://github.com/Roflochinsky/beads-hud/tree/main/native); the original browser HUD remains at the repository root there.
- Removed non-Orca hosts, desktop/tray and HTTP transports, options, actions, styles, assets, tests and build dependencies rather than retaining dormant implementations.
- Preserved `dist/orca`, `local.beads` and the minimal `workspace:read` / `settings:own` permissions.
- Kept the installed-bd core, board/table behavior, search-focus correction, dependency spotlight, drag operations, edited-field updates, comments and guarded close undo.
- Changed real-bd smoke to exercise the built Orca worker panel handler, independent of another host's build output. Core regression tests remain unchanged.
- Simplified Node 24 build/test/CI dependencies and lockfile. Tags `v*` now release only the current Orca tarball and SHA256SUMS; desktop/native releases belong to HUD's `native-v*` workflow.
- Repository-split verification is pending; no build, test or runtime check was run during this migration.

## 0.1.0 — 2026-11-06

Initial combined release, before repository ownership was separated. Orca included real Beads create, update, claim, close, reopen, reclaim, dependency and comment operations, board/table views, native readiness filters, keyboard actions and guarded close undo. Singleton native dependency edges, directory-default filtering suppression and search focus fixes are retained in 0.1.1. Historical non-Orca delivery and its documentation now belong to [beads-hud/native](https://github.com/Roflochinsky/beads-hud/tree/main/native).

Known runtime limits and the distinction between pre-migration evidence and current verification are recorded in [docs/verification.md](docs/verification.md).
