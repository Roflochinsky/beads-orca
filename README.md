# Beads Board for Orca

Плагин Beads для Orca: HTML-панель и trusted TypeScript worker. Версия пакета — **0.1.1**, локальная identity — **local.beads**, результат сборки — **dist/orca**.

Данные читает и изменяет установленный `bd`. Плагин не создаёт вторую базу задач, не инициализирует пользовательские проекты, не запускает агентов и не закрывает задачи по состоянию агентской сессии.

## Владение репозиториями

Этот приватный репозиторий содержит только Orca. Tern, Paseo, Omarchy, Linux/macOS desktop и демонстрационный дизайн принадлежат [beads-hud/native](https://github.com/Roflochinsky/beads-hud/tree/main/native). Исходный браузерный HUD остаётся в [beads-hud](https://github.com/Roflochinsky/beads-hud). Репозитории независимы: общих runtime-импортов и зависимостей между ними нет.

Рабочий интерфейс Orca находится в `src/ui`; все задачи приходят из Beads. Сохраняются board/table, поиск и фильтры, сортировка, подсветка зависимостей, drag-to-claim/close/reopen, редактирование изменённых полей, комментарии и guarded Close → Undo. Ready берётся из `bd ready`; Blocked объединяет явный статус и `bd blocked`, раньше In progress. Интерфейс не вычисляет собственные правила блокировки. Onest и Material Symbols поставляются с [лицензиями](src/ui/THIRD-PARTY.md).

## Требования

- Orca ≥1.4.248 с поддержкой trusted-worker и HTML-панелей.
- Node.js 24 или новее для сборки и проверок; runtime worker предоставляет Orca.
- Установленный `bd` **1.3.2** в PATH процесса Orca, не только интерактивной оболочки. Проверки закреплены на этой версии.
- Уже инициализированный локальный Beads-проект.

Нет зависимостей Electron, React Native или других хостов, отдельного HTTP-сервера и desktop launcher. Ошибки CLI показываются пользователю; отсутствие базы не превращается в пустую очередь. Команды исполняются массивом аргументов без shell.

Это не песочница базы данных: плагин доверяет конфигурации выбранного проекта. В `bd` 1.3.2 проверка локального ID и последующая запись не атомарны. Внешний процесс может удалить задачу между ними, после чего CLI применит настроенный prefix route. Плагин не меняет маршруты и не обещает защиту от этой гонки; подробности — в [контракте адаптера](src/core/README.md).

## Сборка и проверки

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run smoke
npm run package:plugins
```

Сборка выпускает только `dist/orca`. Тесты проверяют публичный core RPC через отдельный fake `bd` процесс. Smoke загружает **собранный Orca worker**, регистрирует его panel handler в минимальном host harness и проверяет операции через настоящий `bd` во временном Git/Beads-проекте; пользовательские базы не используются. Это не заменяет проверку панели в реальном Orca. Команды выше — инструкция, не заявление об успешном прогоне: статус в [docs/verification.md](docs/verification.md).

## Установка в Orca

В Linux вне терминалов Orca используйте `orca-ide`: команда `orca` может означать системный экранный диктор.

```sh
orca-ide plugin validate ./dist/orca --json
orca-ide plugin dev load ./dist/orca --json
```

Вторая команда возвращает точную команду подтверждения. Проверьте fingerprint и разрешения, затем выполните подтверждение только для этого плагина. Манифест сохраняет ровно `workspace:read` и `settings:own`. Trusted worker при этом действительно может читать и изменять Beads через локальный CLI.

```sh
orca-ide plugin open local.beads --panel beads --json
```

Панель использует локальные workspace Orca. Дополнительные пути задаются в **Additional local Beads project paths**, по одному абсолютному пути в строке. Удалённые workspace не исполняются через локальный `bd`; для них требуется установка на соответствующий хост. Orca пока не открывает `taskSources`: плагин добавляет свою панель, не подменяя встроенный Tasks.

## Упаковка и CI/CD

`npm run package:plugins` создаёт только `release/beads-orca-0.1.1.tar.gz` и `release/SHA256SUMS`. Архив содержит каталог `orca/`; после распаковки его можно передать тем же командам validate/dev load. Суммы включают только архив текущей версии, не старые файлы из локального release.

Workflow `.github/workflows/build.yml` на Linux выполняет npm ci, TypeScript, сборку, тесты, установку Beads 1.3.2 с закреплённым SHA256, real-bd worker smoke и упаковку. Push тега `v<package.json version>` (сейчас `v0.1.1`) публикует только Orca tarball и SHA256SUMS после успешных проверок. Actions закреплены на commit SHA, Node — 24; перед публикацией проверяются контрольные суммы. Репозиторий остаётся приватным; публикации в npm или публичный каталог Orca нет. Native-релизы других хостов выпускает beads-hud под тегами `native-v*`.

## Структура

- `src/core` — адаптер установленного Beads CLI.
- `src/shared.ts` — модель данных и RPC панели.
- `src/ui` — board/table, шрифты, иконки и лицензии.
- `src/orca`, `integrations/orca` — worker и манифест Orca.
- `tests`, `scripts` — core regressions, сборка, worker smoke и выпуск.
