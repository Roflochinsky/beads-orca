# Проверки

Дата: 2026-11-06. Linux x64, Beads 1.3.2, Orca 1.4.250, Tern 0.9.12, Paseo 0.14.0.

## Выполнено

- `npm run typecheck`: оба окружения TypeScript прошли. React Native проверяется отдельно от DOM/Node.
- `npm run build`: собраны Orca, Tern, Paseo, desktop и локальный HTTP-сервер.
- `npm test`: 27 тестов прошли. Проверены границы процессов, разрешённые workspace, MCP schema, HTTP auth/Origin/Host, размер запросов, зависимости и сериализация `bd`.
- `npm run smoke`: настоящий временный Git/Beads-проект. Проверены подавление directory-default фильтров, одиночные внешние зависимости, создание, Claim, Close, Reopen, Update, Link/Unlink, комментарии и переходы Ready/Blocked. Связи сохраняются после закрытия цели.
- Общий интерфейс открыт в headless Chromium с настоящим HTTP backend. Созданы задача и комментарий; сохранены заголовок, приоритет и acceptance criteria. Связывание выявило ошибку формы ответа одиночного `bd dep list`; исправление проверено тестами и native smoke выше.
- Desktop запущен в отдельном Xvfb с sandbox/contextIsolation, без `--no-sandbox`. В основном renderer-контексте `process` и `require` недоступны, разрешённый RPC bridge доступен. Через шторку создана настоящая задача Beads. Проверена ширина Linux-шторки 760 px.
- Omarchy: installer выполнен в отдельной временной директории. Настройки пользовательской панели не менялись. Настоящий Quickshell загрузил QML-виджет через установленный `qs.Ui`; helper прочитал Beads и вернул Ready/Active/Done. Исправлены предупреждения при переходе loading → ready; повторный запуск их не воспроизвёл.
- `orca-ide plugin validate` принял пакет. `plugin check` принял manifest; он не проверяет HTML-панель исполнением. Dev-load запросил штатное подтверждение прав, не обошёл его.
- Paseo: отдельный daemon на loopback, отдельный HOME, relay выключен. Плагин установлен штатным CLI. Глобальный switch изменён только у этого временного daemon. Пользовательский Paseo не изменён.

## Границы доказательств

- Xvfb и offscreen QML не доказывают реальное позиционирование Wayland popup, системный hotkey или отображение значка в пользовательской панели.
- `--ozone-platform=headless` вызвал SIGSEGV внутри GTK до загрузки Electron UI. Проверка выполнена через Xvfb; приложение не получило обхода sandbox.
- Установленный `/usr/bin/paseo` запускает GUI для части команд. Для daemon использован официальный `/opt/Paseo/resources/bin/paseo`. `bd` должен быть в PATH именно daemon, не только интерактивной оболочки.
- macOS UI, подпись Developer ID и notarization локально не проверялись. Apple credentials отсутствуют.
- Плагин не обещает атомарную изоляцию баз при native prefix routing. См. [контракт core](../src/core/README.md).
- Наличие workflow не является доказательством его успешного запуска. Ссылки на завершённые CI/release прогоны фиксируются после выполнения.
