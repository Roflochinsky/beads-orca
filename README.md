# Beads Board for Orca

**Your Beads board, inside Orca.** See what is ready, follow dependencies, and update issues without leaving your workspace. Beads remains the source of truth; the panel works with your existing `bd` CLI and project.

[Русский](README.ru.md)

![Beads Board showing a demo project](docs/images/board.png)

*Screenshots show the actual plugin panel in a headless browser, backed by an isolated Beads demo project. Tasks are synthetic and the displayed project path is sanitized; these are not screenshots of the Orca window.*

## Install the stable release

The public stable release is **v0.1.2**. The **0.2.0 source preview is UNRELEASED**; the new workflows below are not included in the stable installation. Install the native stable plugin directly from Git; no source build or development link is needed. Community-catalog discovery is separate and may require review.

In Orca, open **Settings → Plugins → Add plugin → From Git URL** and enter:

```text
https://github.com/Roflochinsky/beads-orca#v0.1.2
```

Alternatively, use the [Orca community catalog](https://onorca.dev/plugins/roflochinsky.beads?catalog=community) once listed. Check the [listing status](https://www.onorca.dev/plugins/roflochinsky/beads-orca) if it is not available there; Git installation does not require a community listing.

For v0.1.2 you will need:

- Orca **1.4.248 or newer**.
- Beads CLI **1.3.2** on the Orca process's `PATH`, and an already initialized local Beads project.

Review the publisher and access request during installation, approve only if you trust the plugin, and open the **Beads Board** panel in Orca. Local Orca workspaces are listed automatically. To add another local project, use **Additional local Beads project paths** in the plugin settings, one absolute project path per line.

> **Trust matters.** This is a trusted worker, not a sandboxed panel. It runs with the full access of your user account and invokes the local `bd` CLI to read and change tasks. Install it only if you trust the plugin and the selected projects. Review the requested Orca capabilities before approval.

## Work with your tasks (stable)

- **Find the next issue.** Switch between board and sortable table, search by title, ID, description, assignee or label, and filter by view, type, priority and assignee.
- **Understand dependencies.** See relationships in the board and issue details; highlight a task's blockers and dependents. Ready and blocked membership comes from Beads, not a separate rules engine.
- **Keep work moving.** Create and edit issues, manage dependencies and comments, and Claim, Close or Reopen from the panel. Closing offers a guarded Undo: it reopens only if the issue has not changed since it was closed.

| Table | Issue details |
| --- | --- |
| [![Sortable table of demo issues](docs/images/table.png)](docs/images/table.png) | [![Demo issue details and dependencies](docs/images/detail.png)](docs/images/detail.png) |

## Stable release limits

**v0.1.2** operates on local projects through the locally installed `bd`. It does not access remote Beads databases or launch/handoff to agents. Both stable and unreleased source add a panel rather than replace Orca's built-in Tasks; neither closes tasks based on agent session state.

Project configuration and routing are trusted. In Beads 1.3.2, the local-ID precheck and a subsequent write are not atomic: an external deletion between them can allow native prefix routing to another configured store. This plugin is not a database sandbox. See the [adapter contract](src/core/README.md) for details.

This repository is for Orca only. For Tern, see [beads-tern](https://github.com/Roflochinsky/beads-tern); for other hosts and the original browser HUD, see [beads-hud](https://github.com/Roflochinsky/beads-hud) and its [native integrations](https://github.com/Roflochinsky/beads-hud/tree/main/native).

## Unreleased 0.2.0 source

The working source implements these approved Q1–Q24 features, with acceptance limits recorded separately:

- **Prepare explicit handoffs:** select tasks across projects, split them into source/target groups, review blockers and explicitly selected whole-file or line-range Markdown context, and choose implementation or research. Changed context rejects Send with details and requires a new preview. New CLI-session launch uses native Orca receipts; sending is not Claim, agent acceptance, or completion.
- **Work across hosts:** local and explicitly mapped SSH projects, host availability, and timestamped offline snapshots. The Beads source and target code workspace must share an execution host. Unmapped paired hosts stay visible but unsupported.
- **Keep context and review explicit:** linked Markdown read/open, personal filters and explicit project-filter publication, private handoff history with export/import/delete, native worktree preview/create, structured per-task reports, and explicit artifact cleanup. No automatic resend, task close, merge, push, or worktree deletion.

**Existing-session handoff remains blocked.** Orca lacks an atomic native idle-only send gate; discovered existing sessions are disabled rather than risk interrupting work. This is an unwaived Q1–Q24 acceptance blocker, not a completed feature.

Development requires Orca **1.4.250+**, Node **24+**, and `bd` **1.3.2** on the execution host. File access requires POSIX semantics and `python3`; remote access also requires system SSH and an explicit `remoteHosts` mapping. See [configuration and trust limits](docs/integration-constraints.md), including the standard native-profile restriction, editor-open race, and SSH-config caveat.

**65 tests**, real-`bd` smoke and package checks passed in [Ubuntu/macOS CI](https://github.com/Roflochinsky/beads-orca/actions/runs/42369795828). Linux native-panel, real isolated SSH/offline and public Git-installation checks also passed. **Actual model execution, Orca's native macOS UI and real paired-runtime behavior remain unverified.** Provider discovery does not prove authentication; imported history and reported results remain unverified claims for human review.

See the [implementation/acceptance matrix and preserved decisions](docs/product-scope.md), [workflow contract](docs/workflow.md), and [verification record](docs/verification.md).

To try the tested **source preview**, use the same Git URL installation flow with this pinned commit. This is not the stable release or full Q1–Q24 acceptance; existing-session handoff remains disabled.

```text
https://github.com/Roflochinsky/beads-orca#035d4a2a2448439a6127f2a5ad03cc6b36fd8963
```

[View the unreleased handoff preview in native Orca](docs/images/native-handoff-unreleased.png). This genuine 1301×900 capture uses synthetic tasks and the unmodified final bundle, without the test-only launch adapter; it does not show an agent launch.

## Development

From the repository root, with Node.js **24 or newer** and `bd` 1.3.2 installed:

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run smoke
npm run package:plugins
```

The build produces `dist/orca`. The smoke uses a disposable Beads project and the built worker, not the real Orca UI. See [verification](docs/verification.md) for recorded evidence and limits.

For a local development load, inspect the request and follow the exact approval command returned by Orca:

```sh
orca-ide plugin validate ./dist/orca --json
orca-ide plugin dev load ./dist/orca --json
orca-ide plugin open local.beads --panel beads --json
```

On Linux outside an Orca terminal, use `orca-ide`: bare `orca` can refer to the system screen reader. The `local.beads` identity is for a development load, not the community catalog identity.

## License

[MIT](LICENSE). Third-party UI assets retain their own licenses; see the [asset notices](src/ui/THIRD-PARTY.md).
