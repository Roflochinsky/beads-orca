# Beads for Orca: implementation, acceptance, and approved scope

**Release: v0.2.0.** The owner approved Q1–Q24 and subsequently explicitly requested publication and installation with the documented limitation. Publication is authorized; full product acceptance is not implied. **Native atomic idle-only dispatch to an existing session remains an upstream blocker and is disabled.**

## Implementation / acceptance matrix

This matrix describes 0.2.0. Evidence is recorded in [verification](verification.md), not inferred from implementation. Automated checks passed: 65 tests, real-`bd` smoke, typecheck/build, package/resource checks and the UI detector. Native and real-SSH observations are separated from the synthetic launch boundary. “Implemented” does not mean observed model execution. Historical decisions below are preserved in Russian.

| Approved decisions | Implementation / acceptance criterion | Observed evidence and outstanding acceptance |
| --- | --- | --- |
| Q1–Q3 / first-round decisions | Orca-only delivery, MIT, English-primary/Russian-secondary public copy; explicit existing/new CLI-session scope, filters/history/blockers and remote support retained | Source-preview installation and Ubuntu/macOS CI passed. Owner authorized the 0.2.0 release with the existing-session limitation, not full-scope sign-off |
| Q4, Q14 | Cross-project selection, explicitly split groups with one source Beads project and target workspace/recipient each; no automatic scheduler | Native panel task selection/preview observed. Source and target must share an execution host; no cross-host credentials or database copying |
| Q5 | Internal dependencies remain ordered by live Beads readiness; external blockers block implementation unless tasks change or research is explicitly selected | Native blocked implementation preview disabled Send; research preview enabled Send. No actual dispatch in that observation |
| Q6, Q15, Q24 | Distinct declared actor per handoff, Claim-before-work instructions, preserve ownership and continue only independent ready work | Prompt/contract implemented; real-bd manual Claim exercised. Executor compliance is not enforced or observed with a real model |
| Q7 | Discover existing sessions but prohibit unsafe submission to busy/permission-waiting agents | **Blocked:** no native atomic idle/incarnation/permission check at PTY submission in Orca 1.4.250 or inspected 1.4.252. All existing sessions disabled; no precheck/hook fallback |
| Q8, Q22 | Native workspace/host identity, local and explicitly mapped system-SSH `bd`, unsupported hosts visible | Real isolated localhost sshd snapshot/create/Markdown/filter writes observed. POSIX/Python3 required for file operations; real paired runtime/native macOS unverified |
| Q9 | Timestamped private offline cache; no offline writes or dispatch; ambiguous send stays unknown and is not retried | Real SSH disconnect plus worker restart restored original cached fetch time and refused writes; actual launch interruption unverified |
| Q10, Q18 | Dynamic personal filters; explicit portable `.beads-orca/filters.json` publication/deletion, no commit/push | Personal save, canceled publication, then explicit in-panel publication observed; personal copy retained |
| Q11, Q17 | Full private context/history, selective export/import/delete; no background sync | Native export/delete/import observed. Imported entries remain unverified/inert, with no report/publish/cleanup/navigation actions; storage is bounded |
| Q12 | Linked/manual Markdown read/open; explicit whole file or paired inclusive `startLine`/`endLine`, retained in prompt/history with selected text and full-file hash; no clipping | Native UI selected lines 3–4; returned text matched those lines and its hash matched the full file. Boundary/import/outside-excerpt regressions passed |
| Q13, Q20 | Validated per-task structured reports, explicit reported-file navigation and concise publication, human completion/integration | Test-only launch-adapter smoke read a fixture report, opened a reported file in native editor, and wrote one real concise Beads comment while leaving the task open/unassigned. No real model report round trip; reported checks remain claims |
| Q16 | Draft/history deletion is separate from stopping a session, releasing Claim, reverting files, or cleanup | Native explicit history deletion observed. Session stop stays an Orca action; the plugin does not promise rollback |
| Q19 | Re-read tasks/readiness/docs/provider/native target/access mapping before Send; name changed categories/IDs/paths, persist known mismatch as rejected, preserve approved text and require explicit new preview | Native UI rejected a change outside the excerpt, named the document/range, preserved approved text, and refused reuse after restoration. The guarded test launch boundary was never called. Transport ambiguity stays unknown; sources are not atomically frozen |
| Q21 | Full context above 3,500 JS code units in a visible target-host artifact; exact report identity and every task once; explicit artifact cleanup | Native preview showed the path. Test-only synthetic launch receipt enabled a real context-file hash match and cleanup preserving code/history; not proof of actual agent delivery |
| Q23 | Offer separate native worktrees for parallel changes; preview/create explicitly, skip setup, no requested agent or `.beads` copy | Real native isolated worktree preview/create and source-to-new-target preview observed; no agent launch |
| New-session transport across the approved scope | Native CLI terminal launch, exact `journaled`/`handed-to-terminal` receipts, unknown journal before effects, no automatic resend | Real provider discovery/native identity plus explicitly synthetic launch-adapter smoke. Executable presence is not auth; actual model launch/execution and nondefault-profile dispatch are not proven |

### Outstanding acceptance, not new product decisions

- Obtain upstream native atomic idle-only send with refusal receipts and remote support, then verify existing-session delivery. This requirement is not waived and prevents claiming Q1–Q24 complete.
- Integrated checks passed on Ubuntu and macOS CI; Linux public Git installation and the plugin-only archive are recorded in verification. This does not establish real model execution, native Orca UI on macOS or real paired-runtime behavior.
- Observe actual new-session delivery/report return before claiming end-to-end agent execution. Standard HOME native-profile discovery is the implemented limitation; `ORCA_USER_DATA_PATH` is stripped before worker launch.
- Keep SSH configuration, native workspace bindings, and project routing trusted. Mapping fingerprints do not detect changed SSH-config contents; native path-only editor opening retains inspect/open TOCTOU. See [integration constraints](integration-constraints.md).

## Preserved approved decisions and discussion history

The following recommendations remain accepted; historical proposal wording is not a statement that the corresponding implementation is still absent. No new product scope or waiver is introduced by the matrix.

## Что уже поручил владелец

- Сделать репозиторий публичным и настроить штатную публичную установку Orca-плагина.
- Оставить в этом репозитории только Orca-плагин; desktop-приложения и остальные хосты принадлежат beads-hud.
- Оформить README по принципам примера Zed: понятное позиционирование, установка, возможности, реальные скриншоты, разработка и лицензия.
- Предложить выбор нескольких задач и передачу работы агентам Orca.
- Предложить открытие связанных Markdown-документов внутри Orca.
- Согласовать новый scope до реализации. Не представлять roadmap как уже работающие возможности.

## Принятые решения первого раунда

- Лицензия публичного проекта — MIT; отдельные лицензии сторонних материалов сохраняются.
- Основной README — английский, дополнительный `README.ru.md` — русский.
- Передача поддерживает существующие адресуемые CLI-сессии и запуск новых CLI-сессий через Orca. Поддержка всех встроенных чатов не обещается.
- Сохранённые фильтры входят в продуктовый scope.
- История передач входит в продуктовый scope.
- Предупреждения о блокерах входят в продуктовый scope.
- Удалённые workspace входят в продуктовый scope и являются приоритетным сценарием, а не необязательной будущей идеей.

Ни одно из этих решений не утверждает автономный диспетчер, автоматическое закрытие задач, конкретную модель хранения или способ удалённого исполнения.

## Исходное предложение ценности

Исторический рабочий вариант для обсуждения, не новый текст README:

> **Your Beads board. Inside Orca.**
> See what's ready, follow dependencies, and update tasks without leaving your workspace.

Версия 0.2.0 сохраняет доску и таблицу Beads внутри Orca: поиск, фильтры, зависимости, редактирование задач, комментарии, Claim/Close/Reopen и guarded Close → Undo. Данные и правила готовности остаются в Beads. Это плагин, не отдельный редактор и не Electron-приложение.

В 0.2.0 добавлены handoff/remote/context/history-сценарии. Их реализация и оставшиеся критерии приёмки перечислены в матрице выше; безопасная передача существующей сессии заблокирована upstream.

## Публичная поставка и README

1. Проверить текущие файлы и доступную Git-историю на секреты и приватные данные до изменения видимости.
2. Подготовить discovery/installation metadata по официальному контракту Orca; проверить установку опубликованной версии, а не только dev load.
3. Показать в начале README одну ценность, реальный screenshot и основной путь установки. Не смешивать установку пользователя со сборкой разработчика.
4. Добавить компактные сценарии: найти готовую задачу, понять блокировку, обновить задачу и вернуться к работе.
5. Снять настоящие board/table/detail поверхности на демонстрационном Beads-проекте. Пометить демонстрационные данные; не публиковать пользовательские задачи или приватные пути.
6. Указать требования к Orca и bd, разрешения trusted worker, реальные ограничения и ссылку на проверенный release.
7. Применить согласованную MIT-лицензию с сохранением лицензий сторонних материалов. Репозиторий открыт; публичная установка проверяется отдельно от смены видимости.
8. Разделять опубликованные возможности и оставшиеся критерии приёмки; выпуск сам по себе не означает полное выполнение Q1–Q24.

## Согласованный сценарий: передача выбранных задач

Цель: превратить выбранные задачи в проверяемое поручение агенту без ручного копирования контекста.

- Чекбоксы в списке/таблице и видимый счётчик выбранных задач.
- Предпросмотр поручения: задачи, критерии приёмки, зависимости, целевой workspace, адресат и явно выбранные документы.
- Явная кнопка отправки после предпросмотра; содержимое задачи само по себе не запускает агента.
- Поддержать пул одному агенту и ручное разделение на несколько поручений. Каждое поручение имеет явного адресата и целевой workspace. Автоматического распределения нет; для параллельных изменений кода отдельные worktree предлагаются по умолчанию по Q23.
- Выбор между существующей адресуемой CLI-сессией и запуском новой CLI-сессии. Встроенные чаты нельзя обещать без подтверждённого API.
- Отдельные результаты передачи: отправка не означает, что агент принял задачу или выполнил её.
- Ошибки и неоднозначный исход не должны молча приводить к повторному запуску или повторной отправке.

Проверяемый результат предлагаемого среза: пользователь выбирает задачи, проверяет контекст и адресата, отправляет поручение и видит подтверждённый результат транспорта. Статусы Beads не объявляются выполненными по факту отправки.

Правила Q4–Q24 приняты: обработка блокеров, Claim конкретным исполнителем перед работой, запрет вмешательства в занятую сессию, обзор хостов, offline-поведение, конфликты владения, изоляция, отмена и человеческая проверка частичных результатов. Разделение доставки и жизненного цикла задачи закреплено в [ADR-0001](adr/0001-beads-task-authority.md).

## Согласованный сценарий: контекст задачи рядом с кодом

- Раздел связанных документов в деталях задачи.
- Показывать явные Markdown-ссылки из карточки задачи и позволять вручную выбирать документы; связанные файлы открываются в правильном workspace.
- Проверка существования файла и принадлежности workspace; ошибка вместо открытия непредусмотренного пути.
- Выбор документов, которые включаются в поручение агенту, с предпросмотром содержимого.
- Не сканировать весь домашний каталог и не выполнять команды из документов.

Проверяемый результат предлагаемого среза: связанный существующий Markdown-файл открывается в нужном workspace; отсутствующая или недопустимая ссылка объясняется пользователю.

## Согласованные направления

Блокеры, шаблон поручения, история, фильтры, Claim/проверка результатов, remote и worktree остаются частью принятого scope. Актуальный статус реализации и наблюдений указан в матрице выше; подробные контракты — в [workflow](workflow.md) и [integration constraints](integration-constraints.md). Переход к файлу в native editor не означает подтверждённый API фокуса любой агентской сессии.

## Не включать без отдельного решения

- Автономный диспетчер, который сам распределяет и перезапускает работу.
- Автоматическое закрытие задачи по состоянию done у агента.
- Собственные API-ключи моделей, биллинг или второй runtime агентов.
- Автоматический запуск команд из описаний задач и Markdown.
- Единое поручение для нескольких несвязанных проектов и создание worktree без предпросмотра и явного действия: Q14 и Q23 разрешают разделённые поручения и согласованное создание изолированных рабочих деревьев.
- Замену Beads или встроенного Tasks Orca.

## Историческое исследование Host API и текущая граница

Первичный источник исходного исследования: документация установленного Orca, полученная командами:

```sh
orca-ide skills get orca-cli --reference references/plugins.md
orca-ide skills get orca-plugin-authoring --reference host-api
```

Host API 1.3, pluginApi 1:

- `agents.list` показывает агентов только сфокусированного workspace. `terminalId` может отсутствовать. Это не каталог всех установленных провайдеров и не подтверждение возможности отправить сообщение каждому чату.
- `agent.launch` принимает workspaceId, agent и prompt; запускает CLI в новом терминале. Описанный контракт не обещает structured chat и не принимает model/effort.
- `terminal.sendText` возвращает accepted. Это не доказательство выполнения поручения.
- `editor.open` открывает файл workspace; `workspace.open` показывает workspace. Для этих методов требуется workspace:write.
- Версия 0.2.0 запрашивает расширенные host-capabilities, включая private storage, workspace/editor и agent/terminal operations; точный список — в [manifest](../orca-plugin.json). Исторический v0.1.2 имел только workspace:read и settings:own. Trusted worker в обоих случаях не является песочницей.
- Публичный discovery требует корректного репозитория и metadata. Историческая Git-установка v0.1.2 проверена отдельно; dev load 0.2.0 не подтверждает новую публичную установку.
- Фильтр только локальных workspace относился к v0.1.2. Сейчас `ProjectAccess` исполняет native bd локально или через явно настроенный системный SSH, не подменяя remote-путь локальным. Открытие remote workspace или запуск там агента по-прежнему не доказывают доступ к его базе без этого транспорта.

## Принятые решения второго раунда

Владелец согласился с рекомендациями Q4–Q13. Отдельное «да» после Q6 интерпретировано как ответ на Q7 и явно отражено в ответе владельцу; при уточнении эта запись корректируется. Формулировки ниже сохраняют исходные варианты для истории обсуждения, но не делают отвергнутые альтернативы частью scope.

### Q4. Один пул — один агент или ручное распределение?

Сценарий: пользователь выбрал восемь задач для Codex и Claude.

Рекомендация: основной режим отправляет пул одному агенту. Дополнительный режим позволяет вручную разделить задачи на поручения и назначить каждому адресата. Не добавлять автоматический планировщик. Параллельные изменения одного checkout требуют явного предупреждения; раздельные workspace не означают автоматически раздельные или одинаковые Beads-базы.

### Q5. Что делать с заблокированной задачей в выбранном пуле?

Сценарий: B зависит от A. Пользователь может выбрать обе задачи либо только B.

Рекомендация: если блокер входит в пул, показать зависимость и передать цепочку одному исполнителю с требованием соблюдать готовность Beads. Если блокер снаружи, предложить добавить его, убрать B или явно сменить поручение с реализации на исследование. Не добавлять задачи и не снимать блокировку молча.

### Q6. Когда происходит Claim?

Принято: отправка поручения сама по себе не меняет статус задачи. Агент должен выполнить Claim перед работой; плагин показывает факт отправки отдельно от подтверждённого Claim. Пока Claim не выполнен, задача не зарезервирована и может быть взята другим исполнителем. Резервирование плагином до передачи не выбрано.

### Q7. Можно ли отправлять работу занятому агенту?

Рекомендация: не внедрять новое поручение в работающий агент и не считать ожидание разрешения признаком готовности принять задачу. Предложить другого адресата, новую сессию или сохранение черновика. Отложенная очередь с автоматической отправкой — отдельное решение, не скрытое поведение кнопки Send.

### Q8. Какой рабочий обзор нужен для нескольких хостов?

Рекомендация: иметь обзор подключённых проектов с группировкой по хосту и отдельный режим текущего workspace. Везде явно показывать проект, хост и доступность данных. Читать и изменять Beads на хосте соответствующего проекта; совпадающий локальный путь не является заменой удалённого проекта.

Это продуктовый контракт. В 0.2.0 есть явный SSH-транспорт; observed evidence и неподтверждённый paired/macOS UI parity разделены в матрице выше.

### Q9. Что показывать после обрыва связи?

Рекомендация: последний полученный снимок с временем и отметкой offline, если он существует. Пока хост недоступен, отключить изменения и отправку новых поручений. Если связь оборвалась во время передачи, показать неопределённый исход, а не успех или гарантированный отказ. Не повторять запуск автоматически; после восстановления проверить доступные факты и дать осознанное действие пользователю.

### Q10. Что именно сохраняет фильтр?

Рекомендация: условия, область проектов/хостов, сортировку и представление, а не фиксированный список ID. «Готовые на AWS» остаётся динамическим видом, не автономной очередью. Различать личные и явно опубликованные проектные фильтры. Текущий выбор задач остаётся отдельным от фильтра и виден пользователю при смене представления.

### Q11. Насколько подробной и общей должна быть история?

Рекомендация: личная полная история поручений с точным отправленным контекстом, задачами, адресатом, workspace/хостом и подтверждёнными событиями. Общий отчёт в Beads публиковать отдельным явным действием, без автоматического помещения полного prompt и содержимого документов в Git или комментарии. Синхронизация полной истории между устройствами и командой — отдельное решение после выбора модели доступа.

Повторная передача начинается с нового предпросмотра актуальных задач, а не слепого воспроизведения старого поручения.

### Q12. Как связывать документы с задачей и поручением?

Рекомендация: показывать явные ссылки из карточки задачи и позволять вручную выбирать документы. Открывать их в правильном workspace. По умолчанию передавать описание, критерии приёмки, зависимости и ссылки на документы; содержимое выбранных фрагментов добавлять явно. Показывать итоговый контекст до отправки, без скрытого включения всего репозитория и обрезания текста.

### Q13. Как выглядит возвращение результата?

Рекомендация: агент предоставляет резюме, связанные изменения и результаты проверок; пользователь проверяет результат и решает, закрывать ли задачи. Состояние done у агента не закрывает Beads-задачи автоматически. Отсутствующий отчёт нельзя выдавать за успешную проверку. Принятый Q21 уточняет получение отдельного структурированного файла отчёта.

## Граница реализации

Продуктовые ветви согласованы. Local/SSH transport, native worktree и workflow реализованы в 0.2.0, но полный scope нельзя объявлять принятым без native idle-only gate и оставшихся проверок из матрицы.

Наличие метода запуска агента не доказывает доставку поручения, а наличие удалённого терминала не доказывает корректный транспорт Beads. Неподтверждённые возможности не превращаются в обещания README.

## Принятые решения третьего раунда

Статус: все рекомендации Q14–Q24 приняты владельцем. Историческое техническое исследование и актуальные ограничения записаны в [integration-constraints.md](integration-constraints.md); реализация и runtime-свидетельства учитываются отдельно в матрице выше.

### Q14. Смешанный выбор разделяется на явные поручения?

Рекомендация: в общем обзоре разрешить выбирать задачи разных проектов и хостов, но перед отправкой разбивать выбор на группы по исходному Beads-проекту и целевому workspace. У каждой группы свой адресат и предпросмотр. Не передавать несвязанные проекты одним неразличимым prompt и не копировать задачи между базами.

### Q15. При конфликте Claim сохраняем чужое владение и продолжаем только независимую работу?

Сценарий: задачу успел взять другой исполнитель после отправки поручения.

Рекомендация: не перехватывать задачу и не использовать принудительный Reclaim. Показать конфликт; агент может продолжить остальные независимо готовые задачи поручения. Зависимые задачи не считать разблокированными. Если доступной работы не осталось, остановиться с объяснением. Правило в поручении не выдаётся за программную гарантию соблюдения агентом.

### Q16. Отмену черновика отличаем от остановки уже работающего агента?

Рекомендация: до отправки черновик можно удалить. После отправки нельзя обещать «отменить» уже выполненные изменения: остановка сессии остаётся явным штатным действием Orca, а запись о поручении сохраняется. Плагин не освобождает Claim, не удаляет ветки и не откатывает файлы автоматически. Отдельная кнопка запроса остановки требует подтверждённого API и отдельного решения, а не имитации успешной отмены.

### Q17. Полная история остаётся личной, без фоновой синхронизации, с явным экспортом и удалением?

Рекомендация: хранить историю в профиле пользователя до явного удаления, поддержать выборочный экспорт/импорт и предупредить о содержимом документов в экспорте. Не отправлять историю автоматически в GitHub, на рабочий сервер или другому участнику команды. Другой компьютер не получает полную историю сам; это осознанный компромисс. Удаление истории не меняет задачи Beads и не удаляет результаты работы агента.

### Q18. Общие проектные фильтры публикуются как проверяемое изменение проекта?

Рекомендация: личные фильтры остаются в пользовательских настройках. Публикация проектного фильтра явно создаёт или меняет переносимые настройки в проекте, доступные обычному Git-review. Не делать автоматические commit/push и не включать секреты, пользовательские абсолютные пути или персональные идентификаторы подключений.

### Q19. Существенное изменение контекста требует обновить предпросмотр перед отправкой?

Сценарий: после выбора задач изменились критерии приёмки, документ или выбранный адресат.

Рекомендация: показать существенные изменения и предложить обновить поручение, не подменять уже просмотренный текст молча. В истории остаётся фактически отправленный контекст. Это не обещает атомарно заморозить все источники: агент должен проверять актуальное состояние перед работой.

### Q20. Интеграция кода остаётся отдельным человеческим действием?

Рекомендация: результат поручения содержит сведения по каждой задаче, связанные изменения и подтверждённые проверки; частично выполненный пул не объявляется успешным целиком. Плагин помогает перейти к изменениям в Orca, но не выполняет автоматические merge, rebase, push или закрытие всего пула. Чужие изменения не приписываются агенту; при неизвестной точке сравнения это явно обозначается.

### Q21. Большой контекст и отчёт передаются через явные артефакты поручения?

Рекомендация: при превышении ограничения prompt использовать отдельный файл контекста на целевом хосте и короткую инструкцию агенту прочитать его. До отправки показать состав и расположение. Получать отчёт с идентификаторами поручения и задач в отдельный файл, а не угадывать его по терминальному тексту. Эти файлы не коммитятся автоматически и не копируют всю личную историю. Их жизненный цикл и явное удаление должны быть видимыми; очистка не удаляет рабочие изменения агента. Транспорт реализован в 0.2.0; реальный model/report round trip ещё не подтверждён.

### Q22. Допускается явная настройка remote-доступа вне авторизации Orca?

Рекомендация: remote остаётся обязательным; для SSH-хостов предпочесть структурированный вызов штатного bd через системный SSH с явным сопоставлением проекта и подключения. Не извлекать секреты Orca и не менять backend Beads. Пользователь видит, какой доступ требуется и проверен ли он. Для paired runtime без SSH нужен отдельный подтверждённый адаптер; такой хост показывается неподдерживаемым или недоступным, а не исчезает из обзора. Это нерешённая часть реализации, не отмена remote scope. Не устанавливать серверы/helper и не открывать порты без отдельного явного действия.

Альтернатива: требовать только существующую авторизацию Orca без дополнительной настройки. В текущей поверхности API универсальный путь не подтверждён; этот вариант зависит от расширения Orca. `bd serve` не выбран по умолчанию из-за отличий от CLI и ограничения embedded Dolt.

### Q23. Параллельным исполнителям предлагаем отдельные worktree по умолчанию?

Рекомендация: для параллельных поручений с изменением кода предлагать отдельные worktree, создаваемые штатным CLI Orca после предпросмотра ветки, хоста и исходного проекта. Существующий workspace можно выбрать явно; совместную запись в один checkout обозначать предупреждением, а не скрывать. Исследование без правок не требует новой ветки. Не копировать базу Beads и не удалять worktree автоматически после завершения агента.

### Q24. Владельцем агентской задачи становится конкретный исполнитель, а не общий тип агента?

Рекомендация: различать параллельные сессии Codex/Claude при Claim. В интерфейсе показывать понятное имя исполнителя и сессию; в Beads использовать различимую идентичность, связанную с поручением. Не выдавать её за аутентифицированную личность. Потеря сессии не разрешает автоматически перехватить её задачи. Это позволяет обнаруживать конфликт двух исполнителей вместо ложного идемпотентного Claim под общим именем `codex`.
