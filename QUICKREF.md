# Quick Reference — шпаргалка по курсу

> 50 модулей. Одна строка на ключевой концепт.

---

## Languages (01–05)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 01 JS/Node.js | Event Loop: microtask queue очищается полностью, macrotask — одна за тик |
| 02 TypeScript | Structural typing + `satisfies` для конфигов + branded types |
| 03 PHP | Native templates через `ob_start()`/`ob_get_clean()` + Property Hooks 8.4 |
| 04 Python | GIL стал optional в 3.14; asyncio.Semaphore для rate limiting |
| 05 Go | Goroutine ≠ thread; context.Context — первый аргумент всех I/O функций |

## AI Foundation (06–10)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 06 Prompt | Техники: Zero-shot → Few-shot → CoT → Self-Consistency → ReAct |
| 07 JSON Schema | Constrained decoding гарантирует структуру, не семантику |
| 08 Local Inference | VRAM = model_weights + kv_cache + overhead; Q4_K_M — баланс |
| 09 Evaluator | Три уровня: exact metrics (PR) → LLM Judge (release) → Human (pre-prod) |
| 10 VLM | visual tokens = (w/32)×(h/32); `max_pixels` обязателен |

## AI Systems (11–13)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 11 Multi-model | Key Rotation (один API) ≠ Model Rotation (меняется поведение) |
| 12 RAG | Chunking → Embedding → Vector Store → Retrieval → Context → LLM |
| 13 Fine-tuning | QLoRA: NF4 + LoRA rank 16; 80% времени на датасет |

## Documents (14–17)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 14 OOXML/DOCX | ZIP с XML: `[Content_Types].xml` + `.rels` + `document.xml` = три файла |
| 15 PDF | Три класса: native-text / image-only / hybrid. ToUnicode — главная боль |
| 16 PDFium WASM | PDFiumLibrary singleton; `document.destroy()` в finally — обязательно |
| 17 XLSX | Shared strings ≠ inline strings; streaming для >30MB |

## Infrastructure (18–26)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 18 Queues | BullMQ (Redis) vs pg-boss (Postgres); DLQ обязателен |
| 19 HTTP | Три таймаута: connect / send / response. Retry с jitter. CB + retry |
| 20 Caching | L1 (in-memory) + L2 (Redis); fetchMethod для stampede protection |
| 21 Testing | testcontainers > mocks; AI output → schema validation + golden dataset |
| 22 Worker Threads | transferList для zero-copy; Piscina для пула |
| 23 Rate Limiting | Token bucket vs leaky; per-user vs per-model vs global |
| 24 Docker | Multi-stage + `USER node` + BuildKit cache mounts |
| 25 CI/CD | OIDC вместо PAT; quality gates в пайплайн |
| 26 Logging | Pino + OpenTelemetry; stdout как единственный транспорт |

## Web Performance (27–40)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 27 SSG | Build-time vs Runtime спектр; Astro Islands |
| 28 CWV | LCP < 2.5s, INP < 200ms, CLS < 0.1 |
| 29 Critical CSS | < 14KB inline; media="print" onload trick |
| 30 Schema.org | JSON-LD в `<head>` для SEO |
| 31 Mobile-first | `@container` queries вместо `@media` |
| 32 A11y | WCAG 2.2 AA минимум; `aria-label` + focus management |
| 33 Web Perf API | PerformanceObserver для RUM |
| 34 Lazy Loading | IntersectionObserver + `loading="lazy"` |
| 35 Image Optimization | WebP + srcset + Sharp resize |
| 36 CRP | Render-blocking CSS — причина №1 медленного FCP |
| 37 JS Perf | will-change только на анимируемых элементах |
| 38 HTTP Caching | `stale-while-revalidate` для CDN |
| 39 CWV Diagnostics | Lighthouse + RUM; lab data ≠ field data |
| 40 Perf Budget | 14KB CSS, 100KB JS, 1MB images |

## Agent Systems (41–47)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 41 MCP | Tool server ≠ API proxy; STDIO vs HTTP/SSE vs WebSocket |
| 42 A2A | Agent Card → Task → Artifact; orchestrator vs peer vs pipeline |
| 43 Agent Memory | Episodic vs procedural vs semantic; provenance обязателен |
| 44 Browser Use | Адаптер/скрипт надёжнее агента; URL allowlist, капча, WAF-backoff |
| 45 Agentic RAG | Multi-step retrieval: plan → search → verify → answer |
| 46 AgentOps | Per-agent traces, cost, quality evals |
| 47 AI Security | Retrieved content = untrusted; tool allowlist, не blocklist |

## Desktop / Data / Cost (48–50)

| Модуль | Ключевая концепция |
|--------|-------------------|
| 48 Go+WebView | Bind только функции; loopback-сервер не SetHtml; `-H windowsgui`; без `-s -w` в release |
| 49 SQL | Схема по семантике (TEXT номера, NUMERIC деньги); индекс по EXPLAIN; миграции append-only |
| 50 Cost | Cascade по pass rate; cost per task KPI; fallback помечать; кэш embeddings |

## Cross-cutting

| Концепция | Где искать |
|-----------|-----------|
| ADR template | [`ADR_TEMPLATE.md`](ADR_TEMPLATE.md) |
| Tools comparison | [`TOOLS_COMPARISON.md`](TOOLS_COMPARISON.md) |
| Architecture map | [`ARCHITECTURE_LANDSCAPE.md`](ARCHITECTURE_LANDSCAPE.md) |

## Команды для AI-кодера

```text
Формула хорошей задачи:
  что делает + входные/выходные типы + метод + concurrency +
  error handling + observability + версии зависимостей
```

---

*Последнее обновление: август 2026*
