# Проверки Orca

## Публичная поставка 0.1.2

На Linux x64, Node 24.22.1, Beads 1.3.2 и Orca 1.4.250 выполнены:

- TypeScript, сборка, 12 регрессионных тестов и smoke собранного worker с настоящим изолированным bd — успешно.
- Регрессия `hostId: "local"` сначала воспроизвела исчезновение локального проекта, затем прошла после исправления. SSH, WSL и paired-пути остаются исключёнными из локального адаптера.
- Source/bundle/archive closure и SHA256 проверены. Локальный архив содержит только плагин, размер 233112 байт.
- `plugin validate` принял корневой source-манифест и собранный манифест.
- Исходный TypeScript worker и панель загружены в отдельный headless-профиль Orca. Плагин обнаружил демопроект; настоящая панель показала задачи и зависимости. `plugin shot`: `settled: true`, `errors: []`.
- Gitleaks 8.30.1 проверил всю доступную Git-историю (8 коммитов до выпуска) и текущее дерево: совпадений не найдено. Это проверка по правилам сканера, не доказательство отсутствия любых чувствительных данных.

README-скриншоты сняты с существующей панели 0.1.1 в headless Chromium с реальным изолированным demo worker; путь в отображении обезличен. Они показывают текущий интерфейс, но не служат доказательством Git-установки 0.1.2.

### Нативная публичная Git-установка

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

## Статус разделения репозиториев

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

## Команды после интеграции

В чистом checkout с Node 24 и установленным `bd` 1.3.2:

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run smoke
npm run package:plugins
GITHUB_REF_NAME=v0.1.2 node scripts/check-version.mjs
(cd release && sha256sum --check SHA256SUMS)
tar -tzf release/beads-orca-0.1.2.tar.gz
orca-ide plugin validate ./dist/orca --json
orca-ide plugin dev load ./dist/orca --json
```

После проверки разрешений выполните точную команду подтверждения, возвращённую Orca, затем:

```sh
orca-ide plugin open local.beads --panel beads --json
```

На отдельно инициализированном временном Beads-проекте проверить snapshot, создание и изменение через настоящую панель, затем независимо прочитать результат установленным `bd`. Повторить поиск без потери фокуса, board/table, сортировку, зависимости, drag-to-claim и Close → Undo. Не использовать пользовательские базы для mutation smoke. Сохранить вывод команд и host proof отдельно; только после этого обновлять статус проверок.

## Границы

- Автоматический smoke использует собранный worker с минимальным host harness и настоящим `bd`, но не запускает GUI Orca.
- Не проверяется удалённый workspace через локальный CLI. Дополнительные пути должны быть абсолютными и содержать доступную `.beads/`.
- Плагин не обеспечивает атомарную изоляцию от prefix routing при внешнем удалении ID между precheck и mutation. См. [контракт core](../src/core/README.md).
- Наличие workflow, исходных тестов или pre-migration proof само по себе не означает успешную новую проверку.
