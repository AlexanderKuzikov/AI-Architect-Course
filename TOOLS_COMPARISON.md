# Сравнительная таблица инструментов

> Когда что выбирать. Единый reference по всем технологиям курса.

---

## Очереди задач

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **BullMQ** | >1K задач/с, нужен DAG (FlowProducer), Redis уже в стеке | Нет Redis, нужен exactly-once | 18 |
| **pg-boss** | Есть Postgres, финансовые гарантии, exactly-once | >5K задач/с, нужен DAG | 18 |
| **In-process queue** (p-queue) | <100 задач, один процесс, простые сценарии | >100 задач, multi-process, нужна persistence | 18 |

## HTTP клиенты

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **undici** (встроенный fetch) | Zero deps, Node.js 24, контроль connection pool | Нужны middleware/retry (got проще) | 19 |
| **got** | Node.js only, богатый retry, hooks, ESM | Нужен browser + Node.js (ky) | 19 |
| **ky** | Единый код browser + Node.js | Нужен контроль connection pool (undici) | 19 |
| **axios** | Legacy codebase, browser + Node.js (только `"axios": "1.14.0"`) | Новые проекты (supply chain risk) | 19 |

## Кэширование

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **LRUCache** (lru-cache) | In-process кэш, нужен TTL + maxSize + fetchMethod | Нужен distributed cache | 20 |
| **Map** | Иммутабельные данные, без TTL, без роста | Любой кэш с потенциальным ростом | 20 |
| **Redis** | Distributed cache, multi-process, сессии | Данные одного процесса, простой кэш | 20 |

## Document Processing

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **pdf-parse** | Быстрый прототип, не-critical data | Production pipeline, >50 страниц | 15 |
| **pdfjs-dist** | Node.js, нужен контроль над extraction, canvas уже есть | Нужен рендеринг без нативных deps (PDFium) | 15 |
| **PDFium WASM** | Docker, zero native deps, Chrome-grade рендеринг | Нужен cold start < 100ms, serverless | 16 |
| **ExcelJS** | XLSX только, streaming, форматирование | Нужны другие форматы (XLS, ODS) | 17 |
| **SheetJS (CDN)** | XLS/XLSB/ODS, чтение из браузера | Новый проект npm install xlsx (stale package) | 17 |
| **docxtemplater** | Шаблоны Word (юристы, дизайнеры), разделение шаблон/код | Документы с нуля (docx npm) | 14 |
| **docx (npm)** | Генерация DOCX с нуля, TypeScript API | Редактирование существующих DOCX | 14 |

## Inference / LLM

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **LM Studio** | Desktop dev + headless server, OpenAI-compatible, VLM | Docker-only, низкий overhead (Ollama) | 08 |
| **Ollama** | Docker, CI, простота запуска | Кастомные GGUF-модели, сложные конфигурации | 08 |
| **vLLM** | Production serving, multi-GPU, batching, enterprise | Одна consumer GPU, прототип | 08 |
| **llama.cpp** | Прямой контроль, batch pipeline без HTTP overhead | Multi-tenant, параллельные клиенты | 08 |
| **Pydantic** (Python) | Python pipeline, JSON Schema generation, validation | TypeScript pipeline (zod) | 07 |
| **zod** (TypeScript) | TypeScript pipeline, structured output | Python pipeline | 07 |

## Testing

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **Vitest** | Новые проекты, Vite-based, ESNext, быстрее Jest | Legacy CJS проект с Jest ecosystem | 21 |
| **Jest** | Существующий CJS проект, большая codebase | Новый проект (ESM-first) | 21 |
| **Playwright** | E2E, cross-browser, visual regression | Unit/integration тесты | 21 |
| **Supertest** | HTTP integration без порта | E2E требует браузер | 21 |
| **testcontainers** | Интеграционные тесты с реальной БД/Redis | Unit-тесты (overhead) | 21 |
| **DeepEval** | LLM evaluation, pytest-style, Python, CI/CD | Не LLM testing (обычные тесты) | 09 |
| **Promptfoo** | Сравнение промптов без кода, YAML config | Python pipeline, нужна интеграция с кодом | 09 |

## Monitoring

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **Pino** | Node.js structured logs, JSON, high throughput | Winston ecosystem, Browser logging | 26 |
| **OpenTelemetry** | Traces + metrics, vendor-agnostic, production | Dev-only, быстрый прототип | 26 |
| **Bull Board** | BullMQ UI мониторинг | pg-boss очередь | 18 |
| **Grafana Loki** | Log aggregation, self-hosted | Cloud-only (Datadog) | 26 |

## CI/CD

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **GitHub Actions** | GitHub репо, малый/средний проект | Self-hosted GitLab, нужен on-prem | 25 |
| **Docker BuildKit** | Всегда (встроен в Docker 24+) | — | 24 |

## Vector Stores

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **pgvector** | Есть Postgres, N < 5M векторов, нужны JOIN | N > 10M, нужен scale-out | 12 |
| **Qdrant** | N > 5M, hybrid search, multi-tenancy, нет Postgres | Postgres уже есть, N < 5M | 12 |

## Worker Threads

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **Piscina** | Пул однотипных CPU-bound задач | Долгоживущий поток с постоянным обменом (raw Worker) | 22 |
| **Worker Threads (raw)** | Двусторонний канал, сложный протокол | Простые задачи (Piscina проще) | 22 |

## MCP (41)

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **MCP SDK (`@modelcontextprotocol/sdk`)** | 10+ инструментов, несколько клиентов, нужен contract | Один клиент, один инструмент (прямой SDK) | 41 |
| **MCP STDIO** | Локальный desktop-агент, dev | Remote multi-user server | 41 |
| **MCP HTTP/SSE** | Production tool server, multi-user | Локальный агент (STDIO проще) | 41 |
| **Playwright MCP** | Browser как MCP tool server | Скрипт без агента | 41, 44 |
| **OAuth 2.1 + PKCE** | Remote MCP, user-scoped permissions | Локальный STDIO без пользователей | 41 |

## A2A / Multi-Agent (42)

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **A2A SDK (`a2a-js`)** | Агент вызывает агентов, нужен контракт | Один агент, прямая интеграция | 42 |
| **Orchestrator + specialists** | Сложный доменный pipeline, accountability | Простые линейные задачи | 42 |
| **Конкурентный ансамбль** | Юридические/финансовые решения, верификация | Задачи с однозначным ответом | 42 |
| **SSE streaming** | Realtime-агенты, низкая latency | Долгие batch-задачи (poll достаточен) | 42 |

## Agent Memory (43)

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **Vector store + metadata** | Semantic memory, FAQ | Нужны связи и multi-hop | 43 |
| **Neo4j / Graphiti** | Knowledge graph, multi-hop, explainability | Простая память без связей | 43 |
| **Graph + vector hybrid** | Entities + семантика, production | Прототип | 43 |

## Browser Use (44)

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **Playwright** | Browser automation, cross-browser, trace | Только Chrome (Puppeteer) | 44 |
| **Browser-use agent** | Нет API, legacy, нестандартные страницы | Есть API (script/API надёжнее) | 44 |
| **Playwright script** | Стабильный UI, известные селекторы | Нестабильный UI (агент) | 44 |
| **Computer Use / CUA** | Desktop-приложения без API | Есть браузер (browser-use надёжнее) | 44 |

## Agentic / Graph RAG (45)

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **Standard RAG** | FAQ, «что в документах?» | Multi-hop, противоречия | 45 |
| **Agentic RAG** | Юридические/финансовые, верификация | Простые запросы (дорого) | 45 |
| **Graph RAG** | Entity-heavy KB, multi-hop | Нет связей между фактами | 45 |
| **Temporal RAG** | Контракты, политики, версии законов | Нет версионности | 45 |

## AgentOps (46)

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **OpenTelemetry** | Traces + metrics, vendor-agnostic, `gen_ai.*` | Dev-only прототип | 46 |
| **Langfuse** | Traces, evals, playground | Нужен только сбор (OTel) | 46 |
| **Promptfoo** | Evals, YAML config, CI gates | Python pytest-пайплайн (DeepEval) | 09, 46 |
| **DeepEval** | pytest-compatible evals, Python | TypeScript stack | 09, 46 |

## AI Security (47)

| Инструмент | Когда брать | Когда не брать | Модуль |
|-----------|-------------|----------------|--------|
| **Tool allowlist** | Всегда | — | 47 |
| **OPA / Rego** | Policy-as-code, audit trail | Прототип (конфиг достаточно) | 47 |
| **Trivy** | Dependencies, secrets, SBOM | — | 24, 47 |
| **Guardrails-библиотеки** | Injection detection, output validation | Не взамен sandbox/approvals | 47 |

---

## Легенда

- **Zero deps:** нет внешних зависимостей (кроме Node.js/Python stdlib)
- **ESM-only:** не поддерживает CommonJS `require()`
- **Ссылки на модули:** полный разбор инструмента в соответствующем модуле курса
