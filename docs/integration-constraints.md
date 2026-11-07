# Orca and Beads integration constraints

**Release: 0.2.0.** Published at the owner's explicit request with the existing-session limitation retained. Local/SSH access and explicit workflow operations are implemented; full Q1–Q24 acceptance is not claimed. Existing-session dispatch needs an upstream native atomic idle-only gate. Source contracts, runtime evidence and outstanding acceptance are distinguished in [workflow](workflow.md), [verification](verification.md) and the [scope matrix](product-scope.md). Investigation used Orca 1.4.250 / Host API 1.3 and Beads 1.3.2; inspection of Orca 1.4.252 did not resolve that gate.

## Remote configuration and execution

The trusted Node worker runs on the desktop; selecting a remote workspace does not move it. `ProjectAccess` resolves registered native workspace IDs, paths, and hosts. Local projects use installed `bd`; remote projects use the same native CLI through **system SSH**, not terminal-screen parsing, direct database access, or `bd serve`.

Set **Remote Beads SSH connections** (`remoteHosts`) to a JSON object keyed by the exact Orca workspace `hostId` shown for the project. For example, replace the sample ID and connection values with your own:

```json
{
  "ssh:example-host-id": {
    "destination": "beads-build",
    "configFile": "/home/example/.ssh/config",
    "name": "Build host"
  }
}
```

- `destination` is a configured system SSH alias or destination, not an arbitrary shell command. `configFile` is optional and must be an absolute path **on the desktop**; it is passed as `ssh -F`. `name` is an optional portable display label used by shared filter scopes. No other mapping keys are accepted. Do not put credentials in this setting.
- SSH uses `BatchMode=yes`, `ConnectTimeout=8`, no PTY, and cleared forwardings. Configure keys/agent access and known-host trust separately; the plugin neither extracts Orca secrets nor performs interactive authentication. No remote server/helper installation or port opening is performed.
- The execution host needs an initialized `.beads/` project and `bd` 1.3.2 on its noninteractive PATH. Remote execution requires a POSIX-compatible shell. Confined file reads, metadata inspection, writes, and cleanup require **POSIX filesystem semantics and `python3` on the workspace host**, including local file access. This is not a Windows parity claim.
- `projectPaths` remains newline-separated **local** absolute paths. A remote path with the same spelling is never treated as a local substitute.
- A `runtime:…`/paired host ID may be explicitly mapped to an SSH destination for file/Beads access. Without that mapping it stays visible as unsupported; there is no general paired-runtime file/exec adapter. Native paired CLI addressing is implemented but a real paired environment has not been exercised.
- **Source Beads project and target code workspace must have the same execution-host identity.** Desktop access to both hosts does not grant the target agent cross-host credentials. Separate worktrees can share a source database only through that original same-host source directory; the plugin never copies `.beads`.
- Current-workspace identification requires a unique native name/branch match. Ambiguous matches do not silently pick a workspace. Truncated native workspace lists are explicit errors.

Offline snapshots are compressed/chunked in private native storage and retain the original fetch time after worker restart. Offline data is visibly stale; writes and new handoffs are blocked. Private history/filter controls remain available. Storage failure is visible, not a promise of unlimited offline retention.

Access checks pin workspace/path/host and the SSH destination/config-file-path fingerprint. Editing that mapping invalidates captured identities. **Changing the contents of the same SSH config file is not detected by this fingerprint**: keep config, aliases, and host routing trusted and stable during an operation.

Sources: [project access](../src/orca/projects.ts), [native Beads/SSH adapter](../src/core/service.ts), [settings and capabilities](../orca-plugin.json).

## Native dispatch and profile boundary

New sessions use the native CLI `agent launch --surface terminal`, with explicit workspace/host selectors. Local and SSH targets address the desktop runtime; explicitly mapped paired targets use a native environment selector. Installed provider registry IDs are Claude, Codex, OMP, Pi, Grok, Gemini, OpenCode, Amp, Aider, Goose, and Copilot. Discovery checks target-host executable presence only: it does **not** prove login, API credentials, model availability, billing access, or readiness. Provider setup belongs to the existing native CLI, not a second plugin model runtime.

The CLI child strips inherited `ELECTRON_RUN_AS_NODE`, `ORCA_PAIRING_CODE`, and `ORCA_ENVIRONMENT`. Although the child wrapper preserves `ORCA_USER_DATA_PATH` if present, **Orca strips that variable before starting the plugin worker**. Observed worker-side CLI discovery therefore used the standard HOME profile. A private native fixture exposed its own profile at `HOME/.config/orca`; no real user profile was touched. Custom nondefault-profile dispatch is not supported/proven; do not assume an externally configured CLI profile reaches the worker.

A terminal handle or `accepted` response is not delivery proof. Only an explicit native `prompt.outcome` is recorded as `journaled` (durable retention) or `handed-to-terminal` (terminal handoff). Neither proves a started model turn, Claim, or task completion. Unknown/error receipts remain unknown; an attempt is journaled before file writes/launch and is never automatically resent. Actual model launch and report return have **not** been observed end to end.

### Unwaived existing-session acceptance blocker

Existing sessions are discovered but returned with `sendable: false`. Orca 1.4.250 and inspected upstream 1.4.252 have no atomic idle-only check in the terminal submission critical section. `agents.list` followed by send races with human/agent input. A prompt hook cannot repair this: its asynchronous decision precedes submission, lacks authoritative activity state, and does not serialize human input. Waiting for permission is not idle.

Required upstream contract: check authoritative idle state, process incarnation, and permissions **immediately before PTY input inside native submission**, including remote execution, and return an explicit refusal receipt if conditions changed. There is no unsafe precheck/send fallback, no hidden queue, and no full-scope completion claim while this remains absent.

Primary native sources:

- [Host API workspace methods: `TEXT_MAX`, `agent.launch`](https://github.com/stablyai/orca/blob/v1.4.250/src/shared/plugins/workers/plugin-host-api-workspace-methods.ts): the Host API prompt is limited to 4,096 JS code units and has no `env`, `model`, or `effort` fields. The implementation uses the native CLI rather than treating this launch API as a delivery receipt.
- [Launch binding](https://github.com/stablyai/orca/blob/v1.4.250/src/main/plugins/workers/plugin-host-workspace-method-bindings.ts), [terminal binding](https://github.com/stablyai/orca/blob/v1.4.250/src/main/plugins/workers/plugin-host-method-bindings.ts), [initial prompt handling](https://github.com/stablyai/orca/blob/v1.4.250/src/main/runtime/rpc/methods/agent-launch-terminal-prompt.ts), and [events](https://github.com/stablyai/orca/blob/v1.4.250/src/shared/plugins/events/plugin-events.ts).
- [1.4.252 terminal prompt submission](https://github.com/stablyai/orca/blob/v1.4.252/src/main/runtime/terminal/input/terminal-agent-prompt.ts) and [input admission](https://github.com/stablyai/orca/blob/v1.4.252/src/main/runtime/terminal/input/terminal-input-admission.ts); installed native CLI/help and submission source inspection are recorded in [workflow](workflow.md).

## Claim, documents, and report trust

Dispatch does not reserve, Claim, or close tasks. Each handoff declares a distinct `beads-orca-<UUID>` actor and instructs the executor to Claim in the **source** directory before ready work, preserve other owners, and stop when no independent work remains. This is a declared string, not authenticated identity or enforcement. The panel's manual Claim still uses the CLI process actor. A native atomic Claim is not an atomic readiness check of the entire dependency graph; expiry of a lease is not evidence that an agent stopped. The [core routing race](../src/core/README.md) also remains: exact-ID precheck and mutation are separate native processes.

- [Native Claim](https://github.com/gastownhall/beads/blob/v1.3.2/internal/storage/issueops/claim.go), [actor comparison](https://github.com/gastownhall/beads/blob/v1.3.2/internal/storage/issueops/identity.go), [lease behavior](https://github.com/gastownhall/beads/blob/v1.3.2/internal/storage/issueops/lease.go).

Linked/manual Markdown is confined to the chosen workspace; no home/repository scan or execution of document commands occurs. Descriptor-anchored file operations reject traversal and symlinks. Text reads/writes are capped at **2 MiB**, while serialized library responses are capped at **768 KiB**, so a file below the disk limit can still be too large to preview. Native editor open checks metadata without reading text and has no such text-size cap. **`editor.open` is path-only: a malicious replacement between inspection and native open remains a TOCTOU race**, not a sandbox guarantee.

Long prompts above 3,500 JS code units use explicit `.beads-orca/handoffs/<UUID>/context.md` on the target; the executor writes `report.json` beside it. Reports validate identity and every selected task exactly once. Outcome/check text is an executor's report, not independently verified execution. `comparisonBase: null` means attribution is unknown. Human review owns integration and closing; publication sends concise selected-task comments, not full private context. Cleanup is explicit and limited to those artifact files, never branches/worktrees or code changes.

Imported history is permanently unverified and inert: no dispatch, report-file read, reported-file navigation, Beads publication, or cleanup from imported records. Its contents can include complete task/document context; review exports before sharing. History deletion does not delete artifacts or undo agent work.

## Storage and RPC limits

Native storage allows **256 KiB per value / 5 MiB total**, shared by history, snapshot caches, and personal filters. History chunks immutable context, reserves receipt space before effects, and rejects capacity failures without eviction or truncation. Serialized handoff context is bounded to 512 KiB; mutable receipt/report metadata to 240 KiB. Explicit project-filter publication writes `.beads-orca/filters.json` with portable names, no commit/push; disclosure checks are not a secret scanner.

The [native panel bridge](https://github.com/stablyai/orca/blob/v1.4.250/src/shared/plugins/workers/plugin-panel-bridge-protocol.ts) permits 64 KiB input, 1 MiB response, and 256 KiB unsolicited posts. Default request deadline is 30 seconds, maximum 120 seconds. Starting with 0.2.1, every panel call uses a versioned request envelope. Replies up to 512 KiB return inline; larger replies are reconstructed from chunks of at most 65,536 UTF-16 code units (under 400 KiB even with worst-case JSON escaping). The native input limit still includes envelope overhead.

The transfer store bounds each serialized result to 32 MiB, retained UTF-16 text to 64 MiB, and active transfers to eight per worker. UUID request/transfer identities and sequential indexes prevent crossed or reordered replies. A 120-second absolute lifetime includes application work. Completion, failure, cancellation and panel teardown release transfers; expiry covers lost cleanup. Cancelled pending work keeps its admission slot until settling. Limits produce explicit errors, never truncated snapshots. Application requests are not automatically retried: cancellation or timeout does not prove that a mutation did not run.

History retains its paged export/chunked import contract. Source: [worker transfer store](../src/orca/reply-transfer.ts), [panel transport](../src/orca/panel-transport.ts), [shared limits](../src/orca/transfer-protocol.ts). Detailed application paging contracts are in [workflow](workflow.md).

## Worktrees and remaining acceptance

Native `worktree create` is previewed and explicit, uses `--no-parent --setup skip`, and requests no agent. Native default tabs may still open; returned identity/branch is authoritative if Orca suffixes a name. No database copy, automatic worktree removal, merge, rebase, or push occurs. Real isolated worktree preview/create was observed; this is not an observed model launch.

Typecheck/build, 65 tests, real-`bd` smoke and package/resource checks passed in Ubuntu/macOS CI. The local UI detector returned no findings. Linux real-SSH/offline, native-panel/worktree and public Git-installation observations are recorded separately in verification. Native Orca UI on macOS, real paired-runtime behavior and actual model execution remain unverified. CI does not waive these limits or the native idle-only acceptance gate.

A later isolated smoke intercepted only `agent launch` in a test-only plugin copy with a synthetic `journaled` receipt. It exercised real context/report file operations, native editor navigation, one real concise Beads comment, and confined cleanup; it launched no agent/model/terminal. See [the explicitly labeled adapter evidence](verification.md#test-only-launch-adapter-smoke-not-native-agent-dispatch), not a native delivery claim.

Historical alternatives and upstream context:

- [Host API](https://github.com/stablyai/orca/blob/v1.4.250/docs/reference/plugin-host-api.md) has no general remote file/exec API. [Remote-worker request](https://github.com/stablyai/orca/issues/37788) and [paired workspace-list report](https://github.com/stablyai/orca/issues/30852) are upstream reports, not reproduced defects here.
- [`bd serve`](https://github.com/gastownhall/beads/blob/9b65b9e198acbcc98e7fd3a87a5d55baa065a572/cmd/bd/serve.go) and its [HTTP API](https://github.com/gastownhall/beads/blob/9b65b9e198acbcc98e7fd3a87a5d55baa065a572/internal/httpapi/spec/openapi.v0.yaml) were not selected: embedded Dolt restrictions and HTTP hook/auto-commit differences prevent treating them as a transparent native-CLI replacement.
