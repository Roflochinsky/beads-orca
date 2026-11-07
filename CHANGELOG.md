# Changelog

## 0.2.1 — 2026-11-07

- Fixed large snapshots rejected by Orca's 1 MiB native reply limit. A bounded, identity-checked transfer protocol reconstructs complete replies without truncation or automatic application retries.
- Added transfer expiry, cancellation and cleanup, plus regression coverage for large Unicode/escaped replies, concurrent panels, invalid chunks, capacity limits and mutation failures.
- Replaced ambiguous project names with a keyboard-accessible picker showing project, workspace, host and path. Prefer an unambiguous current workspace on first load.
- Separated loading, unavailable, stale and live data. Removed false zero counts and duplicate load errors; technical diagnostics are expandable.
- Grouped secondary workflows, preserved keyboard focus across renders and improved compact-panel controls without changing the existing visual language.
- Preserved read-only data loading, database configuration and all existing-session/remote-access limitations. No automatic migration or fallback to a different checkout.

## 0.2.0 — 2026-11-07

Published at the owner's explicit request with the known existing-session limitation retained. This release is not full Q1–Q24 acceptance. Install from `https://github.com/Roflochinsky/beads-orca#v0.2.0`; runtime source is unchanged from the tested preview.

- Added native workspace/host identities, explicit `remoteHosts` SSH configuration, same-host source/target checks, and timestamped offline snapshot caching with writes disabled. Unsupported paired hosts remain visible; SSH access does not inherit Orca credentials.
- Added cross-project task selection and explicit handoff groups, blocker-aware implementation/research previews, actionable stale-preview rejection with changed categories/IDs/paths, and a distinct declared Claim actor per handoff. Rejected previews require explicit renewal; Claim instructions do not enforce agent behavior.
- Added native new-CLI-session launch handling with exact receipt states, unknown-outcome journaling before side effects, and no automatic resend. Provider discovery checks executables, not authentication. Actual model launch/execution has not been observed.
- Added linked/manual Markdown read/open and explicit whole-file or inclusive line-range context with full-file hash revalidation, personal filters and explicit `.beads-orca/filters.json` publication, private chunked history with export/import/delete, and inert unverified imported archives.
- Added native worktree preview/create with setup skipped, full-context artifacts for long prompts, validated per-task report loading, reported-file navigation, explicit concise Beads publication, and separate artifact cleanup. No automatic task close, merge, push, or worktree deletion.
- Kept existing-session dispatch disabled: Orca 1.4.250 and inspected upstream 1.4.252 lack an atomic native idle-only submission gate. This remains an unwaived full-acceptance blocker.
- Passed Ubuntu/macOS CI, Linux real-SSH/offline and native panel/worktree/fragment/stale-preview checks. Verified public Git installation of source commit `035d4a2a2448439a6127f2a5ad03cc6b36fd8963`. Kept synthetic launch-adapter evidence separate from actual model execution. Native Orca UI on macOS, real paired runtime and nondefault-profile dispatch remain unverified. See [acceptance status](docs/product-scope.md), [constraints](docs/integration-constraints.md), and [verification](docs/verification.md).
- Fixed non-JSON optional snapshot fields, opaque native CLI refusal messages, headless browser confirmations, and handoff controls changing while recipient discovery or preview was in progress.

## 0.1.2 — 2026-11-06

- Added a root format-2 manifest and native TypeScript source loading for installation through Orca's Git URL flow, without a build or development link.
- Added MIT licensing, preserved third-party notices, and prepared public discovery metadata with screenshots.
- Published bilingual repository documentation separating current task-board capabilities from the approved agent-handoff, remote-workspace, history and filter roadmap.
- Kept the plugin-only archive and added CI checks for source resources, bundled resources and archive checksums. No editor, Electron runtime or other host implementation is included.
- Tern now has its own repository, [beads-tern](https://github.com/Roflochinsky/beads-tern); the remaining native hosts stay in beads-hud.
- Fixed discovery of local workspaces reported by Orca with `hostId: "local"`; remote-host paths remain excluded from the local adapter.

## 0.1.1 — 2026-11-06

- Made this repository exclusively the Orca plugin. Other integrations, native desktop delivery and the synthetic design reference belong to [beads-hud/native](https://github.com/Roflochinsky/beads-hud/tree/main/native); the original browser HUD remains at the repository root there.
- Removed non-Orca hosts, desktop/tray and HTTP transports, options, actions, styles, assets, tests and build dependencies rather than retaining dormant implementations.
- Preserved `dist/orca`, `local.beads` and the minimal `workspace:read` / `settings:own` permissions.
- Kept the installed-bd core, board/table behavior, search-focus correction, dependency spotlight, drag operations, edited-field updates, comments and guarded close undo.
- Changed real-bd smoke to exercise the built Orca worker panel handler, independent of another host's build output. Core regression tests remain unchanged.
- Simplified Node 24 build/test/CI dependencies and lockfile. Tags `v*` now release only the current Orca tarball and SHA256SUMS; desktop/native releases belong to HUD's `native-v*` workflow.
- Verified typechecking, build, 11 core tests, real-bd worker smoke, the actual Orca panel and Claim/Close/Reopen through the installed worker. Both the release workflow and main CI passed; the published Orca archive checksum was verified after download.

## 0.1.0 — 2026-11-06

Initial combined release, before repository ownership was separated. Orca included real Beads create, update, claim, close, reopen, reclaim, dependency and comment operations, board/table views, native readiness filters, keyboard actions and guarded close undo. Singleton native dependency edges, directory-default filtering suppression and search focus fixes are retained in 0.1.1. Historical non-Orca delivery and its documentation now belong to [beads-hud/native](https://github.com/Roflochinsky/beads-hud/tree/main/native).

Known runtime limits and the distinction between pre-migration evidence and current verification are recorded in [docs/verification.md](docs/verification.md).
