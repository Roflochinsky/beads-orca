# Ограничения интеграции Orca и Beads

Статус: исследование для согласованного продуктового scope, не описание уже реализованной интеграции. Проверялись первичные источники Orca 1.4.250 / Host API 1.3 и Beads 1.3.2. Во время исследования агенты не запускались, пользовательские базы не изменялись.

## Доставка поручений

- `agent.launch` возвращает `terminalId`. Отправка первого prompt продолжается отдельно; результат запуска не является квитанцией получения поручения.
- Поле `agent.launch.prompt` ограничено `TEXT_MAX = 4096` по длине JS-строки. В схеме нет параметров `env`, `model` или `effort`. Большой контекст нельзя молча обрезать или выдавать за полностью доставленный.
- `terminal.sendText` возвращает `accepted`, но не предоставляет плагину durable request ID, ожидание начала хода или replay. Binding установленной версии проверяет принадлежность терминала сфокусированному workspace.
- Предварительный `agents.list` и последующая отправка не являются атомарной проверкой занятости. Для строгого требования не вмешиваться в занятый агент нужен поддерживаемый путь с проверкой на стороне отправки, а не только отключённая кнопка по старому снимку.
- Статусы и необязательный outcome агентского хода не содержат идентификатора поручения Beads. Они не доказывают завершение конкретного пула задач.

Источники:

- [Параметры workspace-методов, включая TEXT_MAX и agent.launch](https://github.com/stablyai/orca/blob/v1.4.250/src/shared/plugins/workers/plugin-host-api-workspace-methods.ts).
- [Binding запуска и отложенной отправки](https://github.com/stablyai/orca/blob/v1.4.250/src/main/plugins/workers/plugin-host-workspace-method-bindings.ts).
- [Binding terminal.sendText](https://github.com/stablyai/orca/blob/v1.4.250/src/main/plugins/workers/plugin-host-method-bindings.ts).
- [Ожидание готовности первого prompt](https://github.com/stablyai/orca/blob/v1.4.250/src/main/runtime/rpc/methods/agent-launch-terminal-prompt.ts).
- [Структура событий](https://github.com/stablyai/orca/blob/v1.4.250/src/shared/plugins/events/plugin-events.ts).

## Claim и идентичность

- Native Claim использует actor вызывающего процесса. Чужой assignee отклоняется с учётом явно настроенных claim pools; повторный Claim того же actor для уже принадлежащей ему задачи может быть идемпотентным успехом.
- Actor — заявленная строка, не аутентифицированная личность. Одно общее имя `codex` для параллельных сессий не даёт им разных владельцев задач.
- Текущий RPC плагина принимает для Claim только ID и наследует окружение. Он не назначает идентичность выбранной агентской сессии.
- Claim выбранного ID не является атомарной проверкой всего графа готовности. Предварительное чтение snapshot/ready не устраняет гонки.
- Heartbeat, окончание lease, освобождение Claim и остановка процесса — разные события. Истечение lease не доказывает остановку агента.

Источники:

- [Native Claim](https://github.com/gastownhall/beads/blob/v1.3.2/internal/storage/issueops/claim.go).
- [Сравнение actor](https://github.com/gastownhall/beads/blob/v1.3.2/internal/storage/issueops/identity.go).
- [Native lease](https://github.com/gastownhall/beads/blob/v1.3.2/internal/storage/issueops/lease.go).
- [Текущий Beads-адаптер](../src/core/service.ts).

## Документы и результат

`editor.open` принимает путь внутри workspace, не произвольный абсолютный путь. Для отчёта о задачах нужен согласованный канал с идентификаторами поручения и задач: обычный текст терминала и событие done не являются таким отчётом. Конкретный формат и место отчёта пока не выбраны; публикация общего отчёта в Beads остаётся явным действием пользователя.

## Remote и worktree

Host API не предоставляет структурированный remote exec или произвольное чтение/запись файлов. Собственный worker плагина не перемещается на хост выбранного workspace. `terminal.read` — ограниченный текст экрана, не контракт stdout/stderr/exit code. Текущий адаптер запускает локальный `bd`; удаление фильтра remote-workspace не сделает его удалённым.

CLI Orca поддерживает создание worktree на настроенном SSH-хосте или paired runtime. Это отдельная зависимость и разрешение project/host через CLI, а не отсутствующий метод `workspace.create` в Host API.

Кандидат `bd serve` через SSH-forward требует отдельного процесса и настройки endpoint. В Beads 1.3.2 он отказывает embedded Dolt; HTTP-записи не воспроизводят CLI hooks и обычный per-command auto-commit. Поэтому такой путь нельзя обещать как прозрачную замену CLI. Самостоятельный системный SSH сохраняет возможность вызова CLI, но не получает автоматически секреты и авторизацию Orca.

Paired runtime и SSH-workspace — разные случаи. Полноту списка paired-workspace, доступ к их процессам и размещение plugin worker нельзя выводить из наличия pairing. Remote runtime, HTTP-сервер и port forward в этом исследовании не запускались.

Источники:

- [Host API](https://github.com/stablyai/orca/blob/v1.4.250/docs/reference/plugin-host-api.md).
- [Запрос remote worker](https://github.com/stablyai/orca/issues/37788) и [сообщения о неполном paired workspace.list](https://github.com/stablyai/orca/issues/30852): upstream-проблемы, не воспроизведённые здесь.
- [bd serve установленного коммита](https://github.com/gastownhall/beads/blob/9b65b9e198acbcc98e7fd3a87a5d55baa065a572/cmd/bd/serve.go).
- [HTTP API того же коммита](https://github.com/gastownhall/beads/blob/9b65b9e198acbcc98e7fd3a87a5d55baa065a572/internal/httpapi/spec/openapi.v0.yaml).

## Технические вопросы до реализации

- Поддерживаемый транспорт bd для remote без парсинга терминального экрана и без подмены удалённой базы локальным каталогом.
- Путь безопасной отправки существующему агенту и наблюдаемое подтверждение доставки.
- Связь идентичности Claim с конкретным исполнителем, включая повторное использование и потерю сессии.
- Способ передачи большого контекста и получения структурированного результата без утечки всей личной истории.

Нельзя ослаблять утверждённые требования до возможностей простого `terminal.sendText` без отдельного решения владельца.
