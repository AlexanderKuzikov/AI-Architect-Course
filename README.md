# AI Architect Course

> Курс по современному технологическому стеку для AI-архитекторов.  
> Архитектурное мышление, глубина технологий, работа с LLM-кодерами.

**Автор:** [Alexander Kuzikov](https://github.com/AlexanderKuzikov)  
**Формат:** 47 модулей: 40 базовых + 7 агентных/production-расширений

---

## Для кого этот курс

Этот курс **не для джунов**, которые только учатся писать код.

Он для тех, кто:

- проектирует системы и принимает архитектурные решения;
- использует LLM как инструмент реализации, сохраняя контроль над архитектурой;
- хочет понимать технологии глубоко — не синтаксис, а механику, ограничения и trade-offs;
- работает на пересечении AI, автоматизации, платформенной разработки и production-систем.

---

## Философия курса

Мир изменился. AI-кодеры пишут код быстрее любого человека.  
Но они не умеют:

- мыслить системами;
- выбирать архитектуру;
- учитывать ограничения, стоимость и риски;
- отвечать за последствия решений в production.

Это работа архитектора.

Архитектор нового времени должен:

- понимать, **что происходит внутри технологий**;
- знать, **где они ломаются**;
- уметь **ставить задачи LLM корректно**;
- проверять, валидировать и ограничивать результат;
- проектировать не только happy path, но и поведение системы под нагрузкой, при сбоях и атаках.

---

## Формат каждого модуля

Каждый модуль рассчитан примерно на **1 день изучения** и собран по одной схеме:

1. Актуальные версии и стек
2. Механика: как технология работает внутри
3. Архитектурные решения и trade-offs
4. Граничные случаи и ограничения
5. Реальный кейс
6. Антипаттерны
7. Задачи AI-кодеру
8. Чеклист архитектора
9. Глоссарий

---

## Как читать этот курс

Курс можно проходить тремя способами:

### 1. Последовательно

Если нужно собрать полную системную картину — идти от `01` к `47`.

### 2. По архитектурным трекам

Если задача прикладная, можно идти по трекам:

- **AI foundation:** 06–10
- **AI systems:** 11–13, 41–47
- **Document processing:** 14–17
- **Infrastructure / DevOps:** 18–26
- **Web performance:** 27–40

### 3. По задаче

Если нужна конкретная технология, можно читать модуль отдельно как reference-документ.

---

## Структура курса

### Языки программирования


| #   | Модуль                                                   | Глоссарий                                       |
| --- | -------------------------------------------------------- | ----------------------------------------------- |
| 01  | [JavaScript / Node.js](./01-javascript-nodejs/README.md) | [Глоссарий](./01-javascript-nodejs/GLOSSARY.md) |
| 02  | [TypeScript](./02-typescript/README.md)                  | [Глоссарий](./02-typescript/GLOSSARY.md)        |
| 03  | [PHP](./03-php/README.md)                                | [Глоссарий](./03-php/GLOSSARY.md)               |
| 04  | [Python](./04-python/README.md)                          | [Глоссарий](./04-python/GLOSSARY.md)            |
| 05  | [Go](./05-go/README.md)                                  | [Глоссарий](./05-go/GLOSSARY.md)                |


### AI / ML (foundation)


| #   | Модуль                                                                 | Глоссарий                                            |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| 06  | [Prompt Engineering (text)](./06-prompt-engineering/README.md)         | [Глоссарий](./06-prompt-engineering/GLOSSARY.md)     |
| 07  | [JSON Schema / structured output](./07-json-schema/README.md)          | [Глоссарий](./07-json-schema/GLOSSARY.md)            |
| 08  | [Local Inference (LM Studio / Ollama)](./08-local-inference/README.md) | [Глоссарий](./08-local-inference/GLOSSARY.md)        |
| 09  | [Evaluator / Benchmark Design](./09-evaluator-benchmark/README.md)     | [Глоссарий](./09-evaluator-benchmark/GLOSSARY.md)    |
| 10  | [Prompt Engineering (VLM)](./10-prompt-engineering-vlm/README.md)      | [Глоссарий](./10-prompt-engineering-vlm/GLOSSARY.md) |


### AI / ML (systems)


| #   | Модуль                                                                | Глоссарий                                               |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 11  | [Multi-model orchestration](./11-multi-model-orchestration/README.md) | [Глоссарий](./11-multi-model-orchestration/GLOSSARY.md) |
| 12  | [RAG](./12-rag/README.md)                                             | [Глоссарий](./12-rag/GLOSSARY.md)                       |
| 13  | [Fine-tuning](./13-fine-tuning/README.md)                             | [Глоссарий](./13-fine-tuning/GLOSSARY.md)               |


### Обработка документов


| #   | Модуль                                                  | Глоссарий                                    |
| --- | ------------------------------------------------------- | -------------------------------------------- |
| 14  | [OOXML (DOCX internals)](./14-ooxml/README.md)          | [Глоссарий](./14-ooxml/GLOSSARY.md)          |
| 15  | [PDF internals](./15-pdf-internals/README.md)           | [Глоссарий](./15-pdf-internals/GLOSSARY.md)  |
| 16  | [PDFium (WASM)](./16-pdfium-wasm/README.md)             | [Глоссарий](./16-pdfium-wasm/GLOSSARY.md)    |
| 17  | [Excel / XLSX internals](./17-xlsx-internals/README.md) | [Глоссарий](./17-xlsx-internals/GLOSSARY.md) |


### Инфраструктура и DevOps


| #   | Модуль                                                         | Глоссарий                                    |
| --- | -------------------------------------------------------------- | -------------------------------------------- |
| 18  | [Task queues](./18-task-queues/README.md)                      | [Глоссарий](./18-task-queues/GLOSSARY.md)    |
| 19  | [HTTP clients / retry strategies](./19-http-clients/README.md) | [Глоссарий](./19-http-clients/GLOSSARY.md)   |
| 20  | [Backend caching](./20-backend-caching/README.md)                              | [Глоссарий](./20-backend-caching/GLOSSARY.md)        |
| 21  | [Testing](./21-testing/README.md)                              | [Глоссарий](./21-testing/GLOSSARY.md)        |
| 22  | [Worker Threads / Piscina](./22-worker-threads/README.md)      | [Глоссарий](./22-worker-threads/GLOSSARY.md) |
| 23  | [Rate limiting](./23-rate-limiting/README.md)                  | [Глоссарий](./23-rate-limiting/GLOSSARY.md)  |
| 24  | [Docker](./24-docker/README.md)                                | [Глоссарий](./24-docker/GLOSSARY.md)         |
| 25  | [CI/CD](./25-cicd/README.md)                                   | [Глоссарий](./25-cicd/GLOSSARY.md)           |
| 26  | [Logging / observability](./26-logging/README.md)              | [Глоссарий](./26-logging/GLOSSARY.md)        |


### Веб и производительность


| #   | Модуль                                                              | Глоссарий                                             |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| 27  | [Static site generation](./27-static-site/README.md)                | [Глоссарий](./27-static-site/GLOSSARY.md)             |
| 28  | [Core Web Vitals: intro](./28-core-web-vitals-intro/README.md)                   | [Глоссарий](./28-core-web-vitals-intro/GLOSSARY.md)         |
| 29  | [Critical CSS](./29-critical-css/README.md)                         | [Глоссарий](./29-critical-css/GLOSSARY.md)            |
| 30  | [Schema.org / structured data](./30-schema-org/README.md)           | [Глоссарий](./30-schema-org/GLOSSARY.md)              |
| 31  | [Mobile-first CSS](./31-mobile-first-css/README.md)                 | [Глоссарий](./31-mobile-first-css/GLOSSARY.md)        |
| 32  | [Accessibility / WCAG](./32-accessibility/README.md)                | [Глоссарий](./32-accessibility/GLOSSARY.md)           |
| 33  | [Web Performance API](./33-web-performance-api/README.md)           | [Глоссарий](./33-web-performance-api/GLOSSARY.md)     |
| 34  | [Lazy loading / Intersection Observer](./34-lazy-loading/README.md) | [Глоссарий](./34-lazy-loading/GLOSSARY.md)            |
| 35  | [Image optimization](./35-image-optimization/README.md)             | [Глоссарий](./35-image-optimization/GLOSSARY.md)      |
| 36  | [Critical Rendering Path](./36-critical-rendering-path/README.md)   | [Глоссарий](./36-critical-rendering-path/GLOSSARY.md) |
| 37  | [JavaScript performance / memory](./37-js-performance/README.md)    | [Глоссарий](./37-js-performance/GLOSSARY.md)          |
| 38  | [HTTP / Service Worker caching](./38-http-service-worker-caching/README.md)                        | [Глоссарий](./38-http-service-worker-caching/GLOSSARY.md)                 |
| 39  | [Core Web Vitals: диагностика, RUM и fixes](./39-core-web-vitals-diagnostics-rum/README.md)  | [Глоссарий](./39-core-web-vitals-diagnostics-rum/GLOSSARY.md)         |
| 40  | [Performance budget](./40-performance-budget/README.md)             | [Глоссарий](./40-performance-budget/GLOSSARY.md)      |



### AI systems / agents (2026 expansion)

Новые модули по production AI-архитектуре: agents, tool servers, protocols, memory, browser automation, agentic RAG, AgentOps и AI security.

|| #   | Модуль                                                                 | Глоссарий                                           |
|| --- | ---------------------------------------------------------------------- | --------------------------------------------------- |
|| 41  | [MCP: Tool Server Architecture](./41-mcp-tool-server-architecture/README.md) | [Глоссарий](./41-mcp-tool-server-architecture/GLOSSARY.md) |
|| 42  | [A2A Protocol и Multi-Agent Systems](./42-a2a-protocol/README.md)      | [Глоссарий](./42-a2a-protocol/GLOSSARY.md)          |
|| 43  | [Agent Memory и Knowledge Graphs](./43-agent-memory-knowledge-graphs/README.md) | [Глоссарий](./43-agent-memory-knowledge-graphs/GLOSSARY.md) |
|| 44  | [Browser Use и Computer Use Agents](./44-browser-use-computer-use/README.md) | [Глоссарий](./44-browser-use-computer-use/GLOSSARY.md) |
|| 45  | [Agentic RAG и Graph RAG](./45-agentic-rag-graph-rag/README.md)        | [Глоссарий](./45-agentic-rag-graph-rag/GLOSSARY.md) |
|| 46  | [AgentOps](./46-agentops/README.md)                                    | [Глоссарий](./46-agentops/GLOSSARY.md)              |
|| 47  | [AI Security для агентов](./47-ai-security-agents/README.md)           | [Глоссарий](./47-ai-security-agents/GLOSSARY.md)    |

---

## Security

> Безопасность — не отдельная опция, а обязательный архитектурный слой. Особенно для AI-систем, интеграций, агентных пайплайнов и production-автоматизации.

В курс должен быть встроен security mindset:

- prompt injection и jailbreak-атаки;
- data leakage и exfiltration через LLM;
- sandbox / isolation для инструментов и агентов;
- secrets management;
- dependency и supply-chain security;
- валидация structured output;
- безопасная работа с файлами и document pipelines;
- threat modeling для AI-систем;
- observability, audit trail и разбор инцидентов.

Этот блок расширен модулями 41–47: MCP/tool servers, A2A/multi-agent, agent memory, browser-use, agentic RAG, AgentOps и AI security для агентов.

---

## Прогресс курса

**Базовое ядро курса:** 40 модулей.  
**Полный курс:** 47 модулей с agent/production-расширениями.

```text
███████████████████████████████████████████████ 47 / 47
```

---

## Актуальный стек

> Проверять перед использованием: стек меняется быстрее, чем документация курса.


| Инструмент | Рекомендуемая версия | Комментарий                                       |
| ---------- | -------------------- | ------------------------------------------------- |
| Node.js    | **24 LTS**           | для production-бэкенда и современных инструментов |
| TypeScript | **6.0.3**            | npm latest, апрель 2026; базовая целевая ветка |
| PHP        | **8.5**              | ориентироваться на актуальную стабильную ветку    |
| Python     | **3.14.3**           | актуальная стабильная ветка Python 3              |
| Go         | **1.26**             | актуальная стабильная ветка                       |
| vLLM       | **0.16.x+**          | проверять точный релиз перед внедрением           |


---

## Что дальше будет добавляться

Следующий слой развития репозитория:

- implementation notes внутри модулей;
- практические production-patterns;
- security-разделы;
- agent/protocol integration playbooks;
- anti-failure checklists;
- шаблоны задач для LLM-кодеров;
- архитектурные decision guides.

---

## Структура репозитория

```text
AI-Architect-Course/
├── README.md
├── Prompt.md
├── 01-javascript-nodejs/
├── 02-typescript/
├── 03-php/
├── 04-python/
├── 05-go/
├── 06-prompt-engineering/
├── 07-json-schema/
├── 08-local-inference/
├── 09-evaluator-benchmark/
├── 10-prompt-engineering-vlm/
├── 11-multi-model-orchestration/
├── 12-rag/
├── 13-fine-tuning/
├── 14-ooxml/
├── 15-pdf-internals/
├── 16-pdfium-wasm/
├── 17-xlsx-internals/
├── 18-task-queues/
├── 19-http-clients/
├── 20-backend-caching/
├── 21-testing/
├── 22-worker-threads/
├── 23-rate-limiting/
├── 24-docker/
├── 25-cicd/
├── 26-logging/
├── 27-static-site/
├── 28-core-web-vitals-intro/
├── 29-critical-css/
├── 30-schema-org/
├── 31-mobile-first-css/
├── 32-accessibility/
├── 33-web-performance-api/
├── 34-lazy-loading/
├── 35-image-optimization/
├── 36-critical-rendering-path/
├── 37-js-performance/
├── 38-http-service-worker-caching/
├── 39-core-web-vitals-diagnostics-rum/
├── 40-performance-budget/
├── 41-mcp-tool-server-architecture/
├── 42-a2a-protocol/
├── 43-agent-memory-knowledge-graphs/
├── 44-browser-use-computer-use/
├── 45-agentic-rag-graph-rag/
├── 46-agentops/
└── 47-ai-security-agents/
```

---

> **Архитектор пишет правила. AI пишет код.**