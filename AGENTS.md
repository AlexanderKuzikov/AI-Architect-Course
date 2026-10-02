# AI-Architect-Course — Instructions for AI Agents

## Commands
- build + audit: `npm run check` (из корня: сборка + аудит, ненулевой код при замечаниях)
- build: `npm run build`
- audit: `npm run audit` (без пересборки)

## Git
- **Коммить, пуши и собирай сам, без напоминаний.** После каждой завершённой
  правки: `npm run check` → `git add -A` → `git commit` → `git push origin main`.
  Не спрашивай разрешения на коммит и пуш.
- Перед коммитом проверь, что в staged нет секретов и нет артефактов сборки.
  `course.html` и `index.html` — в `.gitignore`, коммитить их нельзя.

## Conventions
- Multi-language курс (JS/TS/PHP/Python/Go)
- 52 модуля: от основ до RAG, MCP, A2A, agent memory, desktop, cost, API design, resilience
- Node.js scripts для сборки HTML
- Стиль коммитов: по-русски, с большой буквы, без точки в конце, коротко о сути

## Структура
- `NN-<slug>/README.md` + `NN-<slug>/GLOSSARY.md` — модуль (52 шт.)
- `GLOSSARY.md` — корневой глоссарий
- `scripts/modules.mjs` — реестр модулей (номер → папка, название)
- `scripts/build-html.mjs` — сборка `course.html`
- `scripts/glossary-links.mjs` — «(Модуль NN)» → ссылки в корневом глоссарии
- `scripts/audit.mjs` — аудит исходников и собранного HTML

## Do NOT touch
- `node_modules/`

## Правила содержания
- Оглавления модулей **генерируются при сборке** из фактических заголовков —
  ручные списки «Содержание» не редактировать, они перезаписываются.
- Версии сверять по официальным release notes перед правкой раздела версий.
- Числа в прозе — цифрами. Не оставлять несуществующих слов и смесей
  алфавитов внутри слова.

## Documentation rules
- После работы — обнови `docs/CONTEXT.md` (статус + журнал)
- НЕ создавай новых файлов документации без разрешения
