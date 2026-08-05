# Модуль 41 — MCP: Tool Server Architecture

> **Для AI-архитектора:** MCP — это слой подключения агента к инструментам, данным и UI через стандартизированный protocol boundary. Архитектор проектирует security, authorization, sandbox, observability и lifecycle tool server'ов.
>
> Один день изучения — от protocol boundary до production tool server: transport, authz, idempotency, audit, kill switch.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Security boundaries и failure modes](#3-security-boundaries-и-failure-modes)
4. [Реальный кейс](#реальный-кейс)
5. [Антипаттерны](#5-антипаттерны)
6. [Anti-checklist ☠️](#anti-checklist-️)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Проверено: август 2026

| Инструмент | Версия | Назначение |
|:--|:--|:--|
| `@modelcontextprotocol/sdk` | 1.x | основной SDK для MCP clients/servers |
| MCP Registry | community | discovery MCP servers |
| Playwright MCP | active | browser automation как MCP server |
| Claude Code / opencode | active | MCP clients в production-агентах |
| OAuth 2.1 / PKCE | recommended | remote MCP authorization pattern |

Источник: [modelcontextprotocol.io](https://modelcontextprotocol.io), SDK на [npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk).

---

## 1. Введение и актуальность

### 1.1. Что такое MCP и зачем он нужен

MCP (Model Context Protocol) разделяет **MCP client**, **MCP host**, **MCP server**, **tools**, **resources** и **prompts**. Без MCP каждый agent framework изобретает свой способ описания tools, schema, ошибок, streaming и lifecycle.

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

Логика:

- **MCP host** — приложение, в котором живёт агент (desktop app, IDE, сервер).
- **MCP client** — компонент host, который говорит по протоколу: `list_tools`, `call_tool`, `read_resource`, `subscribe`.
- **MCP server** — удалённый процесс, который предоставляет tools/resources/prompts. Один server может обслуживать много clients.
- **Tool** — действие с schema и side effects.
- **Resource** — источник данных по виртуальному URI (`dms://documents/12345`).
- **Prompt** — шаблон workflow, который можно дёрнуть из client.

| Когда MCP нужен | Когда не нужен |
|:--|:--|
| Один агент вызывает 10+ инструментов | Один локальный скрипт без пользователя |
| Инструменты переиспользуются разными агентами | Прямой SDK дешевле, чем protocol overhead |
| Нужны user-scoped permissions (OAuth/scopes/approvals) | Нет user, инструменты системные |
| Инструменты живут в разных сервисах/командах | Инструменты — внутренности одного monolith |

**Практический вывод для архитектора:** MCP — это decision boundary между «агентом как продуктом» и «инструментами как сервисом». Если инструменты переживут агента (CRM, DMS, ticketing) — выноси их в MCP. Если инструмент существует только ради одного сценария агента — оставь прямой вызов.

### 1.2. Что решает MCP, а что нет

| Слой | Решает | Не решает |
|:--|:--|:--|
| MCP | контракт инструмента, discovery, streaming | авторизацию бизнес-уровня, rate limiting |
| Model Gateway | доступ к LLM-провайдерам | бизнес-логику tools |
| AgentOps | трассировку, evals, cost | выполнение действий |
| A2A | коммуникацию агент↔агент | доступ к данным |

MCP — только transport и контракт. Вся security-политика (кто каким tool может пользоваться) — это слой поверх протокола, который ты строишь сам.

### Граничные случаи — где ломается

**MCP как «серебряная пуля»**: если команда внедряет MCP ради MCP, не имея ни одного реального клиента, — появляется лишний слой latency и дебаггинга. MCP оправдан, когда есть минимум два независимых consumer'а.

**Внутренний MCP vs прямой вызов**: если MCP server — обёртка над `internalService.call()`, а весь трафик — один клиент, то каждый вызов платит: JSON-RPC сериализацию + HTTP + auth + rate limiting + observability. Это 10–50ms overhead на вызов. Для локального desktop-агента незаметно, для pipeline на 100k вызовов/день — заметно.

**Почему это важно архитектору:** MCP — архитектурный boundary, а не библиотека. Он даёт развязку клиента и сервера ценой latency и сложности. Решение «выносим в MCP» должно быть осознанным trade-off.

---

## 2. Архитектурная механика

### 2.1. Tools, resources, prompts

**Tool** — действие, которое агент может вызвать. У tool должны быть: schema, validation, timeout, audit log, idempotency для write-операций.

```typescript
// Минимальная декларация tool на сервере
server.registerTool(
  'search_documents',
  {
    title: 'Поиск документов',
    description: 'Полнотекстовый поиск по DMS. Возвращает нормализованные результаты.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 3, description: 'Поисковый запрос' },
        limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
      },
      required: ['query'],
    },
  },
  async ({ query, limit = 10 }) => {
    const started = Date.now();
    try {
      const rows = await search(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(normalize(rows)) }],
        structuredContent: { ok: true, data: normalize(rows) },
      };
    } finally {
      auditLog('search_documents', { query, limit, durationMs: Date.now() - started });
    }
  }
);
```

**Resource** — источник данных: документ, тикет, CRM-запись, лог инцидента. Resource не обязан быть файлом, это может быть virtual URI: `dms://documents/12345`.

```typescript
server.registerResource(
  'dms://documents/{id}',
  {
    title: 'Документ DMS',
    mimeType: 'application/json',
    description: 'Метаданные документа. Содержимое — через tool get_document.',
  },
  async (uri) => {
    const id = uri.pathname.split('/').pop();
    const meta = await getDocumentMeta(id);
    return { text: JSON.stringify(meta) };
  }
);
```

**Prompt** в MCP — шаблон для повторяемого workflow, например `draft_legal_response` или `summarize_incident`. Prompt — это не tool: он не выполняет действие, он возвращает готовые messages для LLM.

**Практический вывод для архитектора:** MCP server — это не тонкий proxy к API, а архитектурный boundary с policy layer. Каждый tool = контракт: входная schema, допустимые side effects, лимиты, аудит.

### 2.2. Transport: STDIO vs HTTP/SSE vs WebSocket

| Transport | Плюсы | Минусы | Когда использовать |
|:--|:--|:--|:--|
| STDIO | простой, локальный, нет сетевого surface | только один host, нет multi-user | desktop agents, локальная разработка |
| HTTP/SSE | remote server, multi-user, observability | нужен auth/rate limiting | production tool servers |
| WebSocket | streaming, bidirectional | сложнее эксплуатация | realtime agents, subscriptions |

STDIO подходит для локальной разработки и desktop-агентов: MCP server запускается как child process, общается через stdin/stdout JSON-RPC. Никакой сети, никакого auth — граница это сам процесс.

HTTP/SSE — production вариант. Server живёт отдельно, доступен нескольким клиентам, поднимается в Kubernetes. Здесь вступают в силу: auth, rate limiting, TLS, observability.

```text
STDIO:  Agent ──stdin/stdout── MCP Server (child process)
HTTP:   Agent ──HTTPS/SSE────── MCP Server (deploy) ── authn/authz/ratelimit
```

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

### 2.3. Authorization: OAuth 2.1, PKCE, scopes, approvals

Remote MCP должен иметь user-scoped authorization. Агент не должен получать «бога в системе».

| Scope | Пример | Риск при выдаче всем |
|:--|:--|:--|
| `documents:read` | читать документы | data leakage |
| `documents:write` | редактировать документы | data corruption |
| `tickets:create` | создавать тикеты | spam/duplicate |
| `tickets:resolve` | закрывать тикеты | business impact |
| `secrets:read` | читать секреты | critical risk — обычно запрещено |

Паттерн OAuth 2.1 + PKCE для MCP:

```text
1. Agent показывает authorization URL пользователю
2. Пользователь логинится, видит запрашиваемые scopes
3. Auth server выдаёт token + refresh token
4. MCP client шлёт token в Authorization header
5. Server проверяет scopes на каждый call_tool
```

Human approval обязателен для: destructive actions, external payments, sending emails, production config changes, fixes в production, access to secrets.

```typescript
// Проверка scope на границе server
function authorizeTool(user: User, toolName: string, requiredScope: string): { allowed: boolean; reason?: string } {
  if (toolName === 'documents:write' && !user.approvalTicket) {
    return { allowed: false, reason: 'documents:write требует human approval ticket' };
  }
  if (!user.scopes.includes(requiredScope)) {
    return { allowed: false, reason: `scope ${requiredScope} не выдан` };
  }
  return { allowed: true };
}
```

**Практический вывод для архитектора:** scope — это не «для красоты», это единственный механизм сдержать blast radius. Компрометированный агент с `documents:write` — это утечка, с `secrets:read` — это катастрофа. Выдавай минимум, требуй approval на write.

### 2.4. Production-интеграция MCP server

Production checklist:

- versioned API server;
- authn/authz;
- rate limiting под каждый scope;
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

```typescript
// ❌ Возвращаем весь документ в ответ tool
return { content: [{ type: 'text', text: fullDocument }] };

// ✅ Нормализуем и ограничиваем
function normalizeSnippet(doc: Document, maxChars = 12_000) {
  const text = doc.text.slice(0, maxChars);
  return {
    documentId: doc.id,
    title: doc.title,
    updatedAt: doc.updatedAt,
    snippet: text,
    truncated: doc.text.length > maxChars,
    confidence: doc.confidence,
  };
}
```

### 2.5. Timeout, cancellation и idempotency

Каждый `call_tool` должен иметь timeout. LLM-инструменты могут висеть: внешний API не отвечает, DB заблокирована, пайплайн медленный.

```typescript
// В клиенте: таймаут + отмена
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30_000);

try {
  await client.callTool('search_documents', { query }, { signal: controller.signal });
} catch (err) {
  if (controller.signal.aborted) {
    // tool может продолжать выполнение на сервере!
    // Нужен idempotency key, чтобы повторный вызов не продублировал side effect
  }
} finally {
  clearTimeout(timer);
}
```

Критично: **отмена вызова на клиенте не отменяет выполнение на сервере**. Если tool создал тикет, а клиент отменил запрос — тикет создан. Поэтому write-tools обязаны иметь idempotency key:

```text
POST /call_tool { tool: "create_ticket", args: {...}, idempotencyKey: "run-42" }
→ повторный вызов с тем же key возвращает тот же результат, не создавая дубль
```

### Граничные случаи — где ломается

**Tool вернул ошибку vs LLM сломался**: если tool вернул `{ok: false}`, это не error — это валидный результат, который LLM должна осмыслить. Если tool упал с исключением — это error, который надо логировать и ретраить. Смешивание этих двух случаев ломает ретри-логику агента.

**Идемпотентность не бесплатна**: хранение idempotency keys требует хранилище (Redis TTL или табличка). Если забыть TTL — табличка растёт бесконечно. Если забыть сам key — retry после timeout дублирует side effects.

**Schema validation на границе**: agent может прислать мусор в аргументы. Валидация на границе server — обязательна, иначе ошибки уходят вглубь бизнес-логики и становятся неуловимыми.

**Размер результата**: tool вернул 2MB JSON → context window агента забит, cost вырос, качество упало. Каждый tool обязан иметь budget на output.

**Почему это важно архитектору:** из пяти пунктов production checklist ровно три (timeout, idempotency, schema validation) всплывают только при первом инциденте. Их дешевле спроектировать заранее, чем чинить после «дубль тикетов в проде».

---

## 3. Security boundaries и failure modes

### 3.1. Threat model для MCP server

Активы: документы, тикеты, CRM-записи, конфигурация, секреты. Угрозы: compromised agent, prompt injection через retrieved content, перехват токена, SSRF (server сходит на внутренний URL), abusing write-tools, DoS через большие результаты.

| Угроза | Механизм | Контроль |
|:--|:--|:--|
| Compromised agent | агент украден → зовёт tools от имени пользователя | scoped tokens, короткий TTL, audit |
| Prompt injection | зловредный документ говорит «вызови email:send» | tool allowlist, retrieved content = untrusted |
| SSRF | tool принимает URL и server ходит по нему | URL-allowlist, запрет на внутренние сети |
| Token theft | токен утёк из логов | PKCE, short-lived, redaction в логах |
| Write abuse | агент создаёт тонны тикетов | rate limit по scope, approval, budget |
| DoS | огромный output или бесконечный стриминг | output budget, timeout, cancellation |

### 3.2. Failure modes

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| MCP server down | все агенты ломаются | health check, circuit breaker, kill switch |
| Slow tool | вся агентская сессия висит | per-tool timeout, cancellation |
| Schema drift | server обновил schema, старые агенты падают | versioned schemas, backward compat |
| Token expiry | OAuth-токен протух посреди сессии | refresh handling, 401 → re-auth |
| Rate limit hit | агент сыпет 429 | respect Retry-After, backoff |
| Audit log gap | нет записи по tool call | синхронный audit до side effect |

**Практический вывод для архитектора:** MCP server — это сервис, а не скрипт. К нему применяются те же правила, что к любому production API: SLO, alerts, on-call, versioning. Разница только в контракте.

---

## Реальный кейс

### Входные данные

Агент обработки входящих документов: должен найти договор в DMS, извлечь стороны/сумму/срок, проверить подпись и создать тикет юристу, если подпись отсутствует. 2000 документов/день, 3 независимых потребителя MCP-инструментов (агент, веб-UI, 1С-интеграция).

### Гипотеза

Вынести операции с DMS и тикетами в два MCP server'а с policy layer. Read-инструменты работают без approval, write — только с human approval для `documents:write`, `tickets:create` — с idempotency key.

### Что получилось

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

**Что неожиданно:** первый прод-инцидент был не про security, а про **игнорирование idempotency**. Агент дважды вызвал `tickets:create` из-за network timeout на стороне клиента — юрист получил дубль тикета. Протокол отработал, но контракт tool'а не требовал idempotency key обязательным полем. Стало `idempotencyKey: required` в schema.

**Второй инцидент:** обновление schema `documents:read` (добавили `confidence`) уронило старый агент, который валидировал ответ строго. Решение: `additionalProperties: true` в выходной схеме + soft-versioning.

### Вывод, противоречащий интуиции

Самый частый сбой MCP-интеграции — не «сервер недоступен», а **контрактные проблемы**: schema drift, потерянный idempotency, не ограниченный output. Security-край (compromised agent) — редкий, но дорогой; контрактные грабли — частые и дешёвые. Архитектор MCP должен настраивать contract testing и versioning раньше, чем думать о threat model.

---

## 5. Антипаттерны

### «MCP server = тонкий wrapper над API»

**Выглядит правильно:** просто прокинуть API в agent.

**Почему ошибка:** агент получает raw API, включая unsafe actions, огромный output и отсутствие policy layer. Wrapper не решает ни одну архитектурную задачу, но добавляет latency и поддержку.

---

### «Все инструменты доступны всем агентам»

**Выглядит правильно:** один MCP server, все tools, один ключ.

**Почему ошибка:** это максимальный blast radius. Один compromised агент получает `emails:send`, `secrets:read`, `tickets:resolve`. Инструменты должны выдаваться по задаче, роли пользователя и risk level.

---

### «Remote MCP без auth»

**Выглядит правильно:** внутренняя сеть защитит.

**Почему ошибка:** внутренняя сеть не является security boundary. Любой SSRF внутри сети добирается до MCP. Remote MCP требует OAuth/scopes/audit.

---

### «Tool output без лимита»

**Выглядит правильно:** вернуть всё, пусть агент разберётся.

**Почему ошибка:** context window агента забивается, cost растёт, качество падает. Tool output — часть контекста, а не приложение.

---

### «Audit log без agentId»

**Выглядит правильно:** логировать вызовы.

**Почему ошибка:** без agentId, userId и resultHash невозможно расследовать инцидент. Лог «кто-то вызвал tickets:resolve» бесполезен.

---

## Anti-checklist ☠️

- [ ] MCP server = тонкий wrapper над API — агент получает raw API без policy layer
- [ ] Все инструменты доступны всем агентам — максимальный blast radius
- [ ] Remote MCP без auth — внутренняя сеть не является security boundary
- [ ] Tool output без ограничения размера — context window агента забивается
- [ ] Schema без version — при изменении формата старые агенты падают
- [ ] Write-tool без idempotency key — retry после timeout создаёт дубликаты
- [ ] Kill switch не добавлен — нет способа отключить скомпрометированный tool
- [ ] Audit log без agentId/userId/resultHash — невозможно расследовать инцидент

---

## Задачи AI-кодеру

Плохая формулировка: > «Сделай MCP server для документов»

Хорошая формулировка: > «Реализуй MCP server на TypeScript/Node.js 24. Tools: `searchDocuments(query: string, limit: number)`, `getDocument(id: string)`, `getDocumentMetadata(id: string)`. Все инструменты возвращают нормализованный JSON с `documentId`, `title`, `updatedAt`, `snippet`, `confidence`. `getDocument` ограничивает raw text до 12K chars и добавляет `truncated: boolean`. Добавь validation через Zod, structured logs, timeout 10s и unit-тесты на truncation.»

Формула: конкретные tools + контракт результата + ограничения + библиотеки + версия платформы.

---

**Задача 1 — MCP Tool Server для документов**

> Реализуй MCP server на TypeScript/Node.js 24. Tools: `searchDocuments(query: string, limit: number)`, `getDocument(id: string)`, `getDocumentMetadata(id: string)`. Все инструменты возвращают нормализованный JSON с `documentId`, `title`, `updatedAt`, `snippet`, `confidence`. `getDocument` ограничивает raw text до 12K chars и добавляет `truncated: boolean`. Добавь validation через Zod, structured logs, timeout 10s и unit-тесты на truncation.

---

**Задача 2 — Approval policy**

> Реализуй `ApprovalPolicy.evaluate(toolName, args, userRole, riskLevel)` на TypeScript. Risk levels: low/medium/high/critical. `documents:write`, `tickets:resolve`, `emails:send`, `secrets:read` требуют approval. `documents:read` не требует. Верни `{allowed: boolean, reason: string, approvalRequired: boolean}`. Добавь тесты: `secrets:read` для роли `support` запрещён даже с approval.

---

**Задача 3 — Audit logger**

> Реализуй `auditLogMcpCall({agentId, userId, toolName, argsHash, resultHash, durationMs, ok})` на TypeScript. Логи JSON Lines, без raw secrets. `argsHash` и `resultHash` считаются SHA-256. Добавь redaction для полей `token`, `secret`, `authorization`, `cookie`. Тест: поле `cookie` в args не попадает в лог.

---

## Чеклист архитектора

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
- [ ] URL allowlist для tool'ов, принимающих URL (SSRF)

### Production
- [ ] Rate limits настроены под каждый scope
- [ ] Timeouts и cancellation реализованы
- [ ] Idempotency keys обязательны для write operations
- [ ] Health checks и circuit breaker есть
- [ ] Kill switch доступен для каждого MCP server
- [ ] Contract testing на schema drift

---

*Модуль 41 завершён.*
*Следующий: [Модуль 42 — A2A Protocol и Multi-Agent Systems](../42-a2a-protocol/README.md)*