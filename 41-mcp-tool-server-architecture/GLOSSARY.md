# GLOSSARY — MCP: Tool Server Architecture

## A

**additionalProperties**  
Разрешение неизвестных полей в JSON-схеме. При `false` любой новый ключ в выходных данных tool ломает жёсткую валидацию клиента. Для backward-compatible эволюции схем — `true` + soft-versioning.

**Approval Policy**  
Правило, определяющее какие MCP tool calls требуют подтверждения человека. Обычно требуется для write/destructive/secrets/email actions.

**Audit Log**  
Аппендикс-только журнал вызовов tool: agentId, userId, toolName, argsHash, resultHash, durationMs, ok. Без него невозможно расследование инцидентов.

---

## C

**Cancellation**  
Отмена `call_tool` на стороне клиента (AbortController). Не отменяет выполнение на сервере — side effects продолжаются. Поэтому write-tools обязаны быть идемпотентными.

**Context Window**  
Ограниченный буфер tokens модели. Tool output — его часть; неограниченный результат tool забивает контекст, увеличивает cost и снижает качество.

**Contract Boundary**  
Граница между агентом и инструментами: schema, версия, лимиты, ошибки. MCP формализует contract boundary, но не заменяет policy layer.

---

## D

**Discovery / Registry**  
Механизм нахождения MCP server'ов: registry, config map, service discovery или versioned manifest. Без discovery remote MCP трудно масштабировать.

---

## G

**Get-Server Manifest**  
JSON-документ с id, url, capabilities, auth, owner, version. Источник для registry и конфигурации клиента.

---

## I

**Idempotency Key**  
Уникальный ключ write-операции. Повторный вызов с тем же ключом возвращает тот же результат без дублирования side effects. Обязателен для write-tools (retry после timeout).

---

## J

**JSON-RPC**  
Протокол обмена MCP: `list_tools`, `call_tool`, `read_resource`, `subscribe`. Каждый вызов — JSON-сообщение с id, method, params.

---

## K

**Kill Switch**  
Механизм немедленного отключения отдельного MCP server/tool при компрометации или инциденте. Должен быть per-server, не глобальный.

---

## M

**MCP Client**  
Компонент, который подключается к MCP server'ам и вызывает tools/resources/prompts от имени агента.

**MCP Host**  
Runtime, который управляет агентом, UI, permissions, approvals и подключёнными MCP clients.

**MCP Registry**  
Community-реестр MCP server'ов для discovery. Для внутренних инструментов — приватный registry.

**MCP Server**  
Сервис, предоставляющий tools/resources/prompts через Model Context Protocol. Хороший MCP server является security boundary, а не просто proxy к API.

---

## O

**OAuth 2.1 / PKCE**  
Рекомендуемая схема авторизации remote MCP: authorization code + PKCE, scopes, refresh tokens. Без неё remote MCP — открытый API.

---

## P

**PKCE**  
Proof Key for Code Exchange — защита authorization code от перехвата в public clients (desktop agents). Обязателен в OAuth 2.1.

**Prompts**  
Шаблоны повторяемых workflow в MCP (`draft_legal_response`, `summarize_incident`). Возвращают готовые messages, не выполняют действия.

---

## R

**Rate Limiting**  
Лимит вызовов по scope/пользователю. Защита от write-abuse (агент создаёт тонны тикетов) и от DoS большими результатами.

**Resource**  
Именованный источник данных в MCP: документ, тикет, CRM-запись или virtual URI (`dms://documents/12345`).

---

## S

**Schema Validation**  
Проверка входных аргументов и выходных данных по JSON Schema на границе server. Валидация на границе — обязательна, иначе ошибки уходят вглубь бизнес-логики.

**Schema Drift**  
Расхождение версий schema между сервером и клиентом. Старые агенты падают при жёсткой валидации. Контроль: версии, `additionalProperties: true`, contract testing.

**Scope**  
Разрешение, выдаваемое агенту/пользователю: `documents:read`, `tickets:resolve`. Минимальный scope = минимальный blast radius.

**Side Effect**  
Внешнее изменение, вызванное tool: создание тикета, отправка email, запись в БД. Противоположность read-операции.

**SSRF**  
Server-Side Request Forgery: tool принимает URL и server ходит по нему. Контроль: URL-allowlist, запрет на внутренние сети.

**STDIO**  
Transport MCP: child process + stdin/stdout JSON-RPC. Локальная разработка, desktop-агенты, нет сетевого surface.

---

## T

**Timeout**  
Ограничение длительности `call_tool`. Без timeout один медленный tool вешает всю сессию агента. Плюс cancellation и обработка AbortError.

**Tool**  
Действие, которое агент может вызвать через MCP. Должно иметь schema, validation, timeout, audit log и понятный результат.

**Tool Result**  
Ответ tool: `{ok, data, warnings, traceId}`. Нормализованный и ограниченный. Не raw HTML/JSON без необходимости — tool output часть context window.

**Transport**  
Способ доставки JSON-RPC: STDIO, HTTP/SSE, WebSocket. Выбор определяет surface attack, multi-user и observability.

---

## W

**WebSocket**  
Transport для realtime-агентов: streaming, bidirectional. Сложнее в эксплуатации, чем HTTP/SSE.

---

*Глоссарий модуля 41. Следующий: [Модуль 42 — A2A Protocol](../42-a2a-protocol/GLOSSARY.md)*