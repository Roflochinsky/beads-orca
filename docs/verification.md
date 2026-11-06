# Проверки Orca

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
GITHUB_REF_NAME=v0.1.1 node scripts/check-version.mjs
(cd release && sha256sum --check SHA256SUMS)
tar -tzf release/beads-orca-0.1.1.tar.gz
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
