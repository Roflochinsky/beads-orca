# Проверки

Дата: 2026-11-06. Linux x64, Beads 1.3.2, Orca 1.4.250, Tern 0.9.12, Paseo 0.14.0.

## Выполнено

- `npm run typecheck`: оба окружения TypeScript прошли. React Native проверяется отдельно от DOM/Node.
- `npm run build`: собраны Orca, Tern, Paseo, desktop и локальный HTTP-сервер.
- `npm test`: 27 тестов прошли. Проверены границы процессов, разрешённые workspace, MCP schema, HTTP auth/Origin/Host, размер запросов, зависимости и сериализация `bd`.
- `npm run smoke`: настоящий временный Git/Beads-проект. Проверены подавление directory-default фильтров, одиночные внешние зависимости, создание, Claim, Close, Reopen, Update, Link/Unlink, комментарии и переходы Ready/Blocked. Связи сохраняются после закрытия цели.
- Общий интерфейс открыт в headless Chromium с настоящим HTTP backend. Проверены создание, редактирование, комментарии, зависимости, сортировка таблицы в обе стороны, поиск, drag-to-claim и Close → Undo. Проверены явный `blocked`, приоритет native blockers перед In progress и отсутствие ложной блокировки от связи с `pinned`.
- Ввод поиска выявил повторный `change` при замене DOM и потерю фокуса. Исправление проверено настоящим вводом и добавлено в packaged smoke. Undo оставался под drawer; после исправления кнопка доступна при открытых деталях и действительно переоткрывает задачу.
- Desktop запущен в отдельном Xvfb с sandbox/contextIsolation, без `--no-sandbox`. В основном renderer-контексте `process` и `require` недоступны. Через настоящий IPC создана задача, затем независимо прочитана через `bd`. `npm run smoke:desktop` прошёл на упакованном Linux x64 приложении; поверхность занимает всё окно 760 × 560 px.
- Omarchy: installer выполнен в отдельной временной директории. Настройки пользовательской панели не менялись. Настоящий Quickshell загрузил QML-виджет через установленный `qs.Ui`; helper прочитал Beads и вернул Ready/Active/Done. Исправлены предупреждения при переходе loading → ready.
- Orca: пакет принят валидатором и загружен с минимальными правами `workspace:read` и `settings:own`. Штатное подтверждение использовало fingerprint хоста. Отдельная тестовая копия с явным временным project path прочитала snapshot и создала задачу через настоящий worker RPC; запись независимо подтверждена `bd`. `plugin shot` снял настоящую HTML-панель с `settled: true`, без ошибок.
- Tern: настоящий `--control` window, отдельные config/daemon/HOME и реальный Beads. Пройдены создание, Claim, Close, Reopen, Link/Unlink, комментарии выбранной задачи, title-only edit при параллельном Claim другого actor, неизменённое сохранение, custom/pinned/hooked статусы и `j`/`k`. Все десять строк таблицы сверены с `bd list`; Ready и Blocked — с native командами.
- Tern: снимки выявили непрозрачный пустой `.sf-layer`, созданный слишком широким CSS-селектором. Фон ограничен main/dock. Настоящий снимок теперь показывает интерфейс. `overflow: auto` позволяет колесом открыть ранее обрезанную кнопку зависимости; её нажатие выбрало зависимую задачу без изменения размера окна.
- Paseo: отдельный loopback daemon с выключенным relay. Пройдены sidebar, workspace panel, Command Center, `/beads`, CRUD, зависимости, комментарии, поиск/таблица, сохранение concurrent Claim и защита выбора при pending mutation. Проверены background workspace и сохранение draft после его архивации. После исправления комментарии показывают автора, дату и текст вместо JSON; это проверено в настоящем React Native UI.
- [CI 42256373580](https://github.com/Roflochinsky/beads-orca/actions/runs/42256373580), commit `396a775`: Linux и macOS завершились успешно, включая 27 тестов, real-Beads smoke, упаковку и запуск упакованных приложений. macOS arm64 renderer создал настоящую задачу; скриншот подтвердил popover 400 × 640 px. macOS x64 также упакован, но отдельно не запускался.

## Границы доказательств

- Xvfb и offscreen QML не доказывают реальное позиционирование Wayland popup, системный hotkey или отображение значка в пользовательской панели.
- `--ozone-platform=headless` вызвал SIGSEGV внутри GTK до загрузки Electron UI. Проверка выполнена через Xvfb; приложение не получило обхода sandbox.
- Установленный `/usr/bin/paseo` запускает GUI для части команд. Для daemon использован официальный `/opt/Paseo/resources/bin/paseo`. `bd` должен быть в PATH именно daemon, не только интерактивной оболочки.
- macOS arm64 startup/renderer/IPC проверены в CI. Позиционирование у системного menu bar и глобальный hotkey не проверены вручную. Apple credentials отсутствуют; Developer ID signing и notarization не выполнялись.
- Плагин не обещает атомарную изоляцию баз при native prefix routing. См. [контракт core](../src/core/README.md).
- Живая агентская MCP-сессия Paseo не запускалась: схема и серверный контракт проверены тестами, но платные model calls не выполнялись.
- Tern control сериализует команды. Попытка переключить задачу строго во время короткого comments RPC не воспроизведена; переключение до/после и принадлежность комментариев проверены.
- Смена активности workspace через агентский вызов Paseo не проверялась; сохранение выбранного workspace при изменении порядка списка проверено переименованием.
