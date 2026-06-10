# Модуль 41 — MCP: Tool Server Architecture

> **Для AI-архитектора:** MCP — это слой подключения агента к инструментам, данным и UI через стандартизированный protocol boundary. Архитектор проектирует security, authorization, sandbox, observability и lifecycle tool server'ов.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Security и failure modes](#4-security-и-failure-modes)
5. [Реальный кейс](#5-реальный-кейс)
6. [Антипаттерны](#6-антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## 1. Введение и актуальность

### 1.1. Что такое MCP и зачем он нужен

MCP разделяет **MCP client**, **MCP host**, **MCP server**, **tools**, **resources** и **prompts**. Без MCP каждый agent framework изобретает свой способ описания tools, schema, ошибок, streaming и lifecycle.

```text
Agent / LLM
   │
   ▼
MCP Client
   │  list_tools / call_tool / read_resource
   ▼
MCP Server
   ├── Tool: search_documents(query)
   ├── Tool: create_ticket(payload)
   ├── Resource: doc://12345
   └── Prompt: ticket_reply_template
```

| Когда MCP нужен | Почему |
|:--|:--|
| Один агент вызывает 10+ инструментов | единый contract и discovery |
| Инструменты переиспользуются разными агентами | server можно подключить к разным clients |
| Нужны user-scoped permissions | OAuth/scopes/approvals |
| Один локальный скрипт без пользователя | не всегда нужен MCP, проще прямой SDK |



## Актуальные версии и сигналы

| `@modelcontextprotocol/sdk` | 1.29.0 | июнь 2026 | основной SDK для MCP clients/servers |
| MCP Registry | community registry | июнь 2026 | discovery MCP servers |
| Playwright MCP | active | июнь 2026 | browser automation as MCP server |
| OAuth 2.1 / PKCE | recommended | июнь 2026 | remote MCP authorization pattern |

---

## 2. Архитектурная механика



## 2. Архитектура: tools, resources, prompts

**Tool** — действие, которое агент может вызвать. У tool должны быть: schema, validation, timeout, audit log, idempotency для write-операций.

**Resource** — источник данных: документ, тикет, CRM-запись, лог инцидента. Resource не обязан быть файлом, это может быть virtual URI: `dms://documents/12345`.

**Prompt** в MCP — шаблон для повторяемого workflow, например `draft_legal_response` или `summarize_incident`.

Практический вывод: MCP server — это не тонкий proxy к API, а архитектурный boundary с policy layer.



## 3. Remote MCP: transport, discovery, registry

| Transport | Плюсы | Минусы | Когда использовать |
|:--|:--|:--|:--|
| STDIO | простой, локальный, нет сетевого surface | только один host | desktop agents, локальная разработка |
| HTTP/SSE | remote server, multi-user, observability | нужен auth/rate limiting | production tool servers |
| WebSocket | streaming, bidirectional | сложнее эксплуатация | realtime agents |

Для production нужен discovery: registry, config map, service discovery или versioned manifest.

```json
{
  "id": "dms-documents",
  "name": "DMS Documents MCP",
  "url": "https://mcp.dms.internal",
  "capabilities": ["tools", "resources"],
  "auth": "oauth2:pkce",
  "owner": "platform-team",
  "version": "2026.06"
}
```



## 4. Authorization: OAuth 2.1, PKCE, scopes, approvals

Remote MCP должен иметь user-scoped authorization. Агент не должен получать «бога в системе».

| Scope | Пример | Риск |
|:--|:--|:--|
| `documents:read` | читать документы | data leakage |
| `documents:write` | редактировать документы | data corruption |
| `tickets:create` | создавать тикеты | spam/duplicate |
| `tickets:resolve` | закрывать тикеты | business impact |
| `secrets:read` | читать секреты | critical risk |

Human approval обязателен для destructive actions, external payments, sending emails, production config changes и access to secrets.



## 5. Production-интеграция MCP server

Production checklist:

- versioned API server;
- authn/authz;
- rate limiting;
- structured logs;
- traces для каждого `call_tool`;
- schema validation входных аргументов;
- timeout и cancellation;
- idempotency keys для write operations;
- audit log: кто, какой агент, какой tool, какой результат;
- kill switch для каждого MCP server.

Tool result должен быть машиночитаемым и ограниченным:

```json
{
  "ok": true,
  "data": {"documentId": "DOC-123"},
  "warnings": ["document has no signature"],
  "traceId": "01J..."
}
```

Не возвращай агенту огромный raw HTML/JSON, если он не нужен. Tool output — часть context window.



## 6. Security boundaries и failure modes

MCP расширяет attack surface:

```text
User input / retrieved document
        │
        ▼
Indirect prompt injection
        │
        ▼
Agent вызывает MCP tool
        │
        ├── exfiltrates data
        ├── modifies state
        ├── calls external API
        └── escalates permissions
```

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Tool output too large | context overflow, stale state | truncation + summary |
| No approval | risky action выполнена без человека | policy engine |
| No audit | невозможно расследовать инцидент | immutable audit log |
| Remote MCP down | agent continues blind | health checks + circuit breaker |
| Schema drift | tool call fails | contract tests |
| Credential blast radius | compromised agent ломает систему | least privilege + short-lived tokens |



### 7.1. Реальный кейс: MCP для документооборота

Агент должен найти договор, извлечь стороны/сумму/срок, проверить подпись и создать тикет юристу, если подпись отсутствует.

```text
Agent
 ├── MCP DMS: documents:read
 ├── MCP OCR/VLM: extract_contract_fields
 ├── MCP Contract Policy: validate_contract
 └── MCP Tickets: tickets:create
```

Policy:

- `documents:read` без approval;
- `tickets:create` без approval, но с idempotency key;
- `documents:write` только после human approval;
- все tool calls логируются;
- retrieved documents помечаются как untrusted content.


---

## 3. Production trade-offs

| Решение | Выигрыш | Цена | Когда выбирать |
|:--|:--|:--|:--|
| Простая интеграция | быстро стартует | fragile, мало контроля | prototype only |
| Protocol boundary | стандартизация, reuse | больше upfront design | production agents |
| Strict approvals | безопасность | больше latency/friction | write/destructive/secrets actions |
| Full autonomy | скорость | высокий blast radius | только low-risk read-only tasks |
| Observability by default | detectable degradation | extra instrumentation | любой production agent |

---

## 4. Security и failure modes

Главные failure modes для этой темы:\ policy bypass, stale state, context explosion, credential leakage, no audit trail, unbounded retry/delegation, silent quality degradation.

Архитектор должен заранее определить: что считается risky action, где проходит security boundary, какие данные нельзя передавать модели, какие tool calls требуют approval и как восстанавливать состояние после сбоя.

---

## 5. Реальный кейс

Реальный кейс: MCP для документооборота

Агент должен найти договор, извлечь стороны/сумму/срок, проверить подпись и создать тикет юристу, если подпись отсутствует.

```text
Agent
 ├── MCP DMS: documents:read
 ├── MCP OCR/VLM: extract_contract_fields
 ├── MCP Contract Policy: validate_contract
 └── MCP Tickets: tickets:create
```

Policy:

- `documents:read` без approval;
- `tickets:create` без approval, но с idempotency key;
- `documents:write` только после human approval;
- все tool calls логируются;
- retrieved documents помечаются как untrusted content.

---

## 6. Антипаттерны

### «MCP server = тонкий wrapper над API»

**Выглядит правильно:** просто прокинуть API в agent.

**Почему ошибка:** агент получает raw API, включая unsafe actions, огромный output и отсутствие policy layer.

---

### «Все инструменты доступны всем агентам»

**Почему ошибка:** это максимальный blast radius. Инструменты должны выдаваться по задаче, роли пользователя и risk level.

---

### «Remote MCP без auth»

**Почему ошибка:** внутренняя сеть не является security boundary. Remote MCP требует OAuth/scopes/audit.

---

## 7. Задачи AI-кодеру

**Задача 1 — MCP Tool Server для документов**

> Реализуй MCP server на TypeScript/Node.js 24. Tools: `searchDocuments(query: string, limit: number)`, `getDocument(id: string)`, `getDocumentMetadata(id: string)`. Все инструменты возвращают нормализованный JSON с `documentId`, `title`, `updatedAt`, `snippet`, `confidence`. `getDocument` ограничивает raw text до 12K chars и добавляет `truncated: boolean`. Добавь validation через Zod, structured logs, timeout 10s и unit-тесты на truncation.

---

**Задача 2 — Approval policy**

> Реализуй `ApprovalPolicy.evaluate(toolName, args, userRole, riskLevel)`. Risk levels: low/medium/high/critical. `documents:write`, `tickets:resolve`, `emails:send`, `secrets:read` требуют approval. `documents:read` не требует. Верни `{allowed: boolean, reason: string, approvalRequired: boolean}`.

---

**Задача 3 — Audit logger**

> Реализуй `auditLogMcpCall({agentId, userId, toolName, argsHash, resultHash, durationMs, ok})`. Логи JSON Lines, без raw secrets. `argsHash` и `resultHash` считаются SHA-256. Добавь redaction для полей `token`, `secret`, `authorization`, `cookie`.


## 8. Чеклист архитектора

### Protocol
- [ ] MCP client/server contract описан явно
- [ ] Tools/resources/prompts имеют owner и version
- [ ] Schema validation включена на границе server
- [ ] Tool output нормализован и ограничен

### Security
- [ ] Remote MCP использует OAuth 2.1 / PKCE
- [ ] Scopes соответствуют бизнес-ролям
- [ ] Human approval есть для write/destructive/secrets/email actions
- [ ] Audit log включает agentId, userId, toolName, resultHash
- [ ] Retrieved content считается untrusted input

### Production
- [ ] Rate limits настроены
- [ ] Timeouts и cancellation реализованы
- [ ] Health checks и circuit breaker есть
- [ ] Idempotency keys есть для write operations
- [ ] Kill switch доступен для каждого MCP server

---

*Модуль 41 завершён.*
*Следующий: [Модуль 42 — A2A Protocol и Multi-Agent Systems](../42-a2a-protocol/README.md)
