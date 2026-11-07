# Verification evidence

## Large-reply and UI correction — 0.2.1

Environment: Linux x64, Orca 1.4.250, Node 24 and Beads 1.3.2. The user's screenshot established the native `beads answered with more than 1 MiB` failure; a worker-only snapshot check had missed this host boundary.

- Typecheck/build, **78/78 tests**, real-`bd` smoke and packaging passed. After the final responsive-only correction, typecheck/build/packaging passed again; Impeccable returned `[]`.
- Source and built plugin manifests passed native validation. The unchanged native host loaded the source plugin in an isolated headless profile, with the production worker and panel transfer adapter.
- A real local project loaded **1,262 cards with 1,262 unique IDs**, Online status and zero alerts through the actual native bridge. No user issues or database schemas were changed.
- The 349×900 panel kept the project header, main heading and expanded filters within their containers. Only the board canvas required horizontal scrolling. Project choices exposed workspace and full path; End and Escape navigation restored trigger focus.
- A project without `.beads` showed Unavailable, one error/retry surface, collapsed technical diagnostics and no false zero-issue count. Retry retained one error surface; switching to the synthetic project loaded all 12 demo issues.
- The synthetic project's table displayed 12 rows and title sorting. Saved filters, history, worktree and hosts dialogs opened without alerts; dependency details were visible. No model was launched.
- The [current board screenshot](images/native-board-0.2.1.png) is an inspected native `plugin shot` capture, 1279×900, `settled: true`, `errors: []`. It contains synthetic tasks only. Existing catalog images remain historical; this capture is not substituted for the catalog's minimum-width assets.

Limits: native macOS, real paired-runtime transport and actual model execution were not exercised. Existing-session dispatch remains disabled. A stale-schema workspace still needs its own explicit maintenance decision; the plugin does not migrate it or select a different database silently.

## Pre-release integration record — 2026-11-07

This section records checks performed before publication of 0.2.0. The owner subsequently explicitly requested release and installation with the documented existing-session limitation. Historical records below apply only to their named versions; publication does not imply full Q1–Q24 acceptance.

Environment: Linux x64, Node 24.22.1, Beads 1.3.2, Orca 1.4.250. All mutations used isolated synthetic projects and a separate headless Orca profile. Implementation boundaries are linked in [workflow](workflow.md) and [integration constraints](integration-constraints.md).

| Area | Observed evidence | Boundary / remaining acceptance |
| --- | --- | --- |
| Automated checks | Typecheck/build, 65/65 tests, real-`bd` smoke, packaging and source/bundle/archive resource checks passed. The final UI discovery-race fix was separately typechecked, built and exercised in native Orca. Impeccable detector returned `[]` | Automated tests do not prove model execution, native macOS or paired-runtime behavior |
| Native Beads smoke | Built worker with real isolated `bd`: create, dependencies, ready, Claim, reopen, update, comments, document traversal/symlink refusal, personal/project filters | This smoke is not real model execution or a native GUI run |
| SSH / offline | Real isolated localhost sshd, not mocked SSH: snapshot, create, Markdown read, filter write. After stopping sshd and restarting the worker, cached snapshot and original fetch time returned; writes were refused and local access still worked | Fixed remote zsh readonly `status` variable by using `beads_exit_status`. One real SSH fixture is not all-host/macOS/paired parity |
| Native load and panel | Source and built manifests validated. Private-profile native load/approval/open showed three synthetic tasks. Markdown read and `editor.open` in the main editor were observed | No actual model launch; source validation is not public Git installation |
| Blockers / providers | Blocked implementation preview disabled Send; explicit research preview enabled Send and showed long-context path. Installed native CLI providers discovered | Enabled Send/executable presence does not prove authentication, launch, prompt delivery, or agent acceptance |
| Filter publication | Personal filter saved; Escape canceled without publication; explicit confirmation published the project file and retained its personal copy. Confirmation survived the 15-second background refresh; Escape restored the parent dialog without deleting the filter | System `confirm()` closed without a response on the headless fixture; in-panel confirmation is used instead. No automatic commit/push |
| History archive | Export of one entry produced 21,244 characters; explicit deletion and import restored an unverified archive. Imported history exposed no report/publish/cleanup/open-change actions | Archive contents are claims and cannot authorize local operations; export may include private task/document text |
| Native worktree | Real CLI preview/create succeeded on isolated branch `beads/smoke-isolated`, registered under fixture `HOME/orca/workspaces`. Source-Beads to new-target preview enabled Send | No agent launched and no Beads database copied. Worktree creation is not evidence of a model turn |
| Native screenshots | Final genuine 1301×900 [handoff screenshot](images/native-handoff-unreleased.png), inspected after restoring the unmodified built plugin without the launch adapter | Synthetic tasks; source-to-separate-worktree preview, not model launch or release installation |
| Fragments / stale preview | Native UI selected lines 3–4. Exact selected text and full-file hash were observed. An edit outside the excerpt produced `rejected` with document/range details, preserving the original prompt; restoring the file did not permit resend | The guarded test launch adapter was never called during either rejected send |
| Recipient discovery | Native observation recorded disabled group controls while discovery was pending, then enabled controls and available providers. Subsequent target-worktree selection and preview succeeded | Prevents target/recipient edits racing an outstanding discovery or preview |

Local archive: `release/beads-orca-0.2.0.tar.gz`, **344972 bytes**, containing only plugin resources, not Orca/Electron. SHA256 verification passed:

```text
3b08ee9856962b19cadc824a75c551574b981ba8158cc404a46621379731ec04
```

The first resource-closure check refused untracked runtime files; staging the owned sources resolved it without weakening the gate. Source manifest validation also rejected the initial 971-pixel-wide screenshot; a new native 1301×900 capture satisfied the required minimum.

### Test-only launch-adapter smoke, not native agent dispatch

The integration owner then used a **copy of the built plugin in a private profile**, with an `ORCA_CLI_COMMAND` wrapper intercepting **only `agent launch`** and returning an explicitly synthetic `journaled` receipt. No actual agent, model, or terminal was launched. Worktree discovery and all other native CLI calls remained real. This is distinct from the unmodified native observations and screenshot above.

- UI Send recorded `journaled` once from that synthetic receipt. The actual written `context.md` SHA256 matched the complete 10,108-byte preview; no context was truncated.
- An actual fixture `report.json` was read, and its reported `docs/result.md` opened in the native editor.
- Explicit selected-task publication produced exactly one actual `bd` comment without full document text. The task remained open and unassigned.
- Explicit cleanup removed only context/report artifacts, preserving `docs/result.md` and private history.

These observations exercise downstream file/report/editor/publication/cleanup behavior with a synthetic launch boundary. They do not establish native receipt correctness, provider authentication, prompt delivery or model execution. After verification, the temporary adapter, SSH keys, synthetic repositories and private profile were removed; only the owned Orca/SSH services were stopped. The real user profile was not modified.

### Explicitly not verified or accepted

- **Existing-session native idle-only dispatch remains blocked and unwaived.** Installed Orca 1.4.250 and inspected 1.4.252 lack an atomic idle check in the actual submission critical section. Discovery leaves existing sessions disabled; a precheck or asynchronous hook is not sufficient. Full Q1–Q24 completion/release is not claimed.
- No paid/real model launch or actual agent execution was performed. New-session receipt interpretation and reports have unit coverage plus the explicitly synthetic launch-adapter smoke above, not observed end-to-end model/report return. A report, `journaled`, or `handed-to-terminal` status never proves task completion.
- No native Orca UI run on macOS or real paired-runtime run. Successful macOS CI verifies its build/tests/real-`bd` smoke, not the application UI or paired transport.
- No v0.2.0 tag or release existed during this pre-release pass. The owner subsequently authorized release; the observations below still identify the exact commits they exercised.
- Custom nondefault-profile dispatch is not supported/proven: native worker startup strips `ORCA_USER_DATA_PATH`. The fixture exposed its own profile at `HOME/.config/orca`, not a real user profile.

### Published source, CI and native Git installation

Implementation commit: [`035d4a2a2448439a6127f2a5ad03cc6b36fd8963`](https://github.com/Roflochinsky/beads-orca/commit/035d4a2a2448439a6127f2a5ad03cc6b36fd8963), branch [`feat/approved-orca-workflows`](https://github.com/Roflochinsky/beads-orca/tree/feat/approved-orca-workflows). Stable `main`/v0.1.2 was not replaced.

- [Actions run 42369795828](https://github.com/Roflochinsky/beads-orca/actions/runs/42369795828) passed both `ubuntu-24.04` and `macos-15` build jobs. They ran typecheck/build, 65 tests, real-`bd` smoke, packaging and resource checks. Release was skipped because this was not a tag.
- Before source publication, Gitleaks scanned the staged change with redaction and found no matches. This is evidence under its rules, not proof that every possible secret is absent.
- Installed `https://github.com/Roflochinsky/beads-orca#feat/approved-orca-workflows` through Orca's native Git-URL UI in the isolated profile. The UI resolved commit `035d4a2`; publisher trust and the requested trusted-worker/capability access were approved.
- `plugin list` then reported `roflochinsky.beads`, version `0.2.0`, `status: running`, `isDev: false`, `needsReconsent: false`, `restarts: 0`.
- Native source provenance: `kind: git`, `resolvedCommit: 035d4a2a2448439a6127f2a5ad03cc6b36fd8963`, `contentHash: cda17d61406311cd4233ec7aa5c165bd90cc7b58939854bb917be9c548ab07f9`.
- The installed source panel showed three synthetic tasks, discovered providers and produced an enabled new-session handoff preview. No Send/model execution was performed in this public-installation pass.
- Native `plugin shot` reported 1301×900, `settled: true`, `errors: []`. The [public Git-installation screenshot](images/public-git-preview.png) was inspected and retained. `themeApplied: false`: this does not prove dark-theme parity.

Later documentation-only commits record this evidence; they do not change the tested runtime source. README offers the exact tested commit as a source-preview installation, not an accepted full-scope release.

## Historical public delivery — 0.1.2

На Linux x64, Node 24.22.1, Beads 1.3.2 и Orca 1.4.250 выполнены для выпуска 0.1.2:

- TypeScript, сборка, 12 регрессионных тестов и smoke собранного worker с настоящим изолированным bd — успешно.
- Регрессия `hostId: "local"` сначала воспроизвела исчезновение локального проекта, затем прошла после исправления. SSH, WSL и paired-пути остаются исключёнными из локального адаптера.
- Source/bundle/archive closure и SHA256 проверены. Локальный архив содержит только плагин, размер 233112 байт.
- `plugin validate` принял корневой source-манифест и собранный манифест.
- Исходный TypeScript worker и панель загружены в отдельный headless-профиль Orca. Плагин обнаружил демопроект; настоящая панель показала задачи и зависимости. `plugin shot`: `settled: true`, `errors: []`.
- Gitleaks 8.30.1 проверил всю доступную Git-историю (8 коммитов до выпуска) и текущее дерево: совпадений не найдено. Это проверка по правилам сканера, не доказательство отсутствия любых чувствительных данных.

README-скриншоты сняты с существующей панели 0.1.1 в headless Chromium с реальным изолированным demo worker; путь в отображении обезличен. Это исторические изображения board/table/detail, не доказательство новых workflow или Git-установки 0.1.2.

### Историческая нативная публичная Git-установка v0.1.2

2026-11-06 завершена штатная установка `https://github.com/Roflochinsky/beads-orca#v0.1.2` в уже запущенный Orca 1.4.250 с отдельным профилем `/tmp/beads-orca-install-profile`. Использовались существующий CDP и CLI с `ORCA_USER_DATA_PATH` этого профиля; обычный пользовательский профиль не затрагивался.

- Причина наблюдаемого «Установка…» — ожидавшее подтверждения отдельное окно **«Убедитесь, что доверяете Roflochinsky»** поверх установщика. Чтение только первого `[role=dialog]` показывало нижний диалог, но снимок всей нативной страницы выявил запрос доверия. Повторная установка, изменение пакета или установленного Orca не потребовались: подтверждён уже открытый запрос для `github.com/roflochinsky/beads-orca`.
- После подтверждения плагин был установлен, но ещё не разрешён к исполнению: `status: "pending"`, `isDev: false`. Отдельно просмотрены и подтверждены **полный доступ `trusted-worker`**, `workspace:read` и `settings:own`, затем нажато **«Включить плагин»**. Полный доступ означает возможность читать файлы, обращаться к сети и запускать программы; два host-capability не являются песочницей для Node worker. Это соответствует [официальному контракту Orca v1.4.250](https://github.com/stablyai/orca/blob/v1.4.250/docs/reference/plugin-authoring.md#1-write).
- После открытия панели `plugin list --json` вернул `pluginKey: "roflochinsky.beads"`, `publisher: "roflochinsky"`, `version: "0.1.2"`, `status: "running"`, `isDev: false`, `official: false`, `bundled: false`, `needsReconsent: false`, `restarts: 0`. Плагин публичный, но не является официальным плагином Stably.
- Источник: `kind: "git"`, `reference: "https://github.com/Roflochinsky/beads-orca"`, `resolvedCommit: "9e2633e7318b03566b49945f8d2800a80f233f28"`, `contentHash: "f00ec6ffbbfcad816749c67d250d5af3b7b6017e935199ae703000e46acd60a5"`. Это установленная Git-копия, не `local.beads` и не dev load.
- `plugin open roflochinsky.beads --panel beads --json` успешно открыл настоящую панель. Отдельный native webview `orca-plugin-frame://f49673abef4e9ec8/integrations/orca/panel.html?rev=f00ec6ffbbfcad81` показал 9 synthetic issues, включая `demo-sd0` / Handle expired payment sessions и `demo-1fw` / Polish the checkout experience. В этом проходе задачи не изменялись.
- `plugin shot roflochinsky.beads --panel beads --out /tmp/beads-orca-publish-audit/public-git-v0.1.2-native.png --json` вернул `settled: true`, `errors: []`, размер 349×900. Снимок прочитан: видны настоящие карточки в узкой боковой панели. `theme: "dark"`, но `themeApplied: false`; снимок не доказывает применение тёмной темы к содержимому плагина. `plugin logs roflochinsky.beads --json` вернул `lines: []`.
- Локальные свидетельства: итоговая панель `/tmp/beads-orca-publish-audit/public-git-v0.1.2-native.png`; исходный запрос доверия `/tmp/omp-sshots-15c3ed194195ef99.webp`; обзор разрешений `/tmp/omp-sshots-15c3ed425615ef9a.webp`; панель внутри окна Orca `/tmp/omp-sshots-15c3ed55c8d5ef9b.webp`. Диагностические журналы сохранены в `/tmp/beads-orca-install-profile/logs/{main.trace.ndjson,daemon.log}` и `/tmp/beads-orca-install-profile/plugins-data/audit.log`. Это локальные артефакты стенда, не файлы релиза.

По переданному release-handoff владельца публикации: [main CI](https://github.com/Roflochinsky/beads-orca/actions/runs/42285647534) и [release CI](https://github.com/Roflochinsky/beads-orca/actions/runs/42285647996) завершились успешно; опубликованный архив [v0.1.2](https://github.com/Roflochinsky/beads-orca/releases/tag/v0.1.2) имеет размер **235551 байт**, его SHA256 уже проверен в `/tmp/beads-orca-publish-audit/release-0.1.2`. Это не прежний локальный архив размером 233112 байт. CI, сборка, тесты, линтеры и форматтеры в проходе Git-установки повторно не запускались.

Community discovery не является условием нативной установки по Git URL. Эта проверка подтверждает установку, согласие на доступ и чтение демозадач настоящей панелью; она не повторяет mutation/lifecycle и все исторические UI-сценарии.

## Историческое разделение репозиториев — 0.1.1

Версия 0.1.1 выделена из исходного коммита `06fbecacae1537851886f7c9a6708751dee9c6e5`. После разделения на Linux x64 выполнены:

- `npm ci`, TypeScript, сборка и 11 core-тестов: успешно.
- `npm run smoke`: собранный Orca worker выполнил операции с настоящим изолированным Beads 1.3.2; все проверки прошли.
- Упаковка Orca и проверка соответствия тега `v0.1.1`: успешно. `orca-ide plugin validate` принял манифест.
- Проверочная копия загружена в Orca 1.4.250 с `workspace:read` и `settings:own`. Настоящий worker прочитал проекты и snapshot; Claim → Close → Reopen независимо подтверждены через `bd` как `in_progress` → `closed` → `open`.
- `plugin shot` снял настоящую HTML-панель: `settled: true`, `errors: []`. На снимке видна задача из изолированного проекта.

Эти проверки не повторяют все исторические UI-сценарии ниже. CI каждого выпуска отдельно проверяет сборку, core-тесты, real-Beads smoke и контрольную сумму Orca-архива.

## Историческое доказательство до миграции

Исходная запись от 2026-11-06 относится к смешанному репозиторию, Linux x64, Beads 1.3.2 и Orca 1.4.250:

- Orca принимал манифест с `workspace:read` и `settings:own`; загрузка использовала штатное подтверждение fingerprint.
- Отдельная тестовая копия с временным project path читала snapshot и создавала задачу через настоящий worker RPC; запись независимо подтверждалась `bd`.
- `plugin shot` снимал настоящую HTML-панель с `settled: true`, без ошибок.
- Core smoke проверял native create/claim/close/reopen/update, зависимости, комментарии, Ready/Blocked, подавление directory-default фильтра и сохранение одиночных внешних и закрытых зависимостей.
- Поиск, drag-to-claim и Close → Undo проверялись в общем DOM-интерфейсе до разделения; поиск сохранял фокус, Undo оставался доступным над drawer.

Это **не** доказательство работоспособности версии после разделения. Исторические проверки других хостов и их ограничения принадлежат [beads-hud/native](https://github.com/Roflochinsky/beads-hud/tree/main/native).

## Reproducing the integration checks

Use Node 24 and `bd` 1.3.2 in an isolated checkout. The observations above identify what was actually run; the following is a reproduction procedure, not an instruction to create a release/tag:

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run smoke
npm run package:plugins
(cd release && sha256sum --check SHA256SUMS)
tar -tzf release/beads-orca-0.2.0.tar.gz
orca-ide plugin validate ./dist/orca --json
orca-ide plugin dev load ./dist/orca --json
```

После проверки разрешений выполните точную команду подтверждения, возвращённую Orca, затем:

```sh
orca-ide plugin open local.beads --panel beads --json
```

Use only isolated fixtures to check the final native panel, Q12 full/fragment context, Q19 actionable stale-preview refusal, report/import trust boundaries, confirmation dialogs, SSH/offline recovery, and native worktree behavior. Record the exact test count and package size/hash from that final tree, and run the repository's secret detector before any public delivery. Actual model launch, macOS, paired runtime, and installation require their own explicit evidence; do not infer them from unit tests or fixture previews. Never use user databases for mutation smoke.

## Evidence boundaries across versions

- Automated smoke uses the built worker and a minimal host harness with real `bd`; it does not itself launch Orca GUI.
- v0.1.2 excluded remote paths. Version 0.2.0 accesses explicitly mapped SSH projects through remote native `bd`, not the local CLI; same-host source/target and POSIX/Python3 prerequisites apply.
- The plugin does not atomically isolate prefix routing from external deletion between ID precheck and mutation. See the [core contract](../src/core/README.md). Descriptor-confined file operations also do not make path-only native editor opening atomic.
- Source tests, configured CI, historical passes, and upstream inspection are different evidence classes; none implies a successful final integration run.
