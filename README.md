# AI Architect Course

> Курс по современному технологическому стеку для AI-архитекторов.  
> Архитектурное мышление, глубина технологий, работа с LLM-кодерами.

**Автор:** [Alexander Kuzikov](https://github.com/AlexanderKuzikov)  
**Статус:** В активной разработке · 40 из 40 модулей готовы

---

## Для кого этот курс

Этот курс **не для джунов**, которые учатся писать код.

Он для тех, кто:

- Проектирует системы и принимает архитектурные решения
- Использует LLM как инструмент реализации, сохраняя контроль над решениями
- Хочет понимать технологии глубоко — не синтаксис, а механику и trade-offs
- Работает на пересечении AI, автоматизации и разработки

---

## Философия курса

Мир изменился. AI-кодеры пишут код быстрее любого человека.  
Но они не умеют **думать системами**, **выбирать архитектуру** и  
**принимать решения в условиях неопределённости**.

Это работа архитектора.

Архитектор нового времени должен:

- Понимать **что** происходит внутри технологии, а не **как** её писать
- Знать **граничные случаи** — где технология ломается и почему
- Уметь **правильно поставить задачу** LLM-кодеру
- Читать и верифицировать результат, а не просто запускать

---

## Формат каждого модуля

Каждый модуль построен по одной схеме и рассчитан на **один день изучения**:

1. **Актуальные версии** — инструменты и библиотеки на момент написания
2. **Механика** — как технология работает внутри
3. **Архитектурные решения** — когда применять, trade-offs
4. **Граничные случаи** — где ломается, что AI не предупредит
5. **Реальный кейс** — входные данные → гипотеза → вывод
6. **Антипаттерны** — решения которые кажутся правильными но являются ошибкой
7. **Задачи AI-кодеру** — как правильно формулировать
8. **Чеклист архитектора** — что проверить перед принятием решений
9. **Глоссарий** — справочник терминов модуля

---

## Структура курса

### Языки программирования


| #   | Модуль                                                   | Глоссарий                                       | Статус  |
| --- | -------------------------------------------------------- | ----------------------------------------------- | ------- |
| 01  | [JavaScript / Node.js](./01-javascript-nodejs/README.md) | [Глоссарий](./01-javascript-nodejs/GLOSSARY.md) | ✅ Готов |
| 02  | [TypeScript](./02-typescript/README.md)                  | [Глоссарий](./02-typescript/GLOSSARY.md)        | ✅ Готов |
| 03  | [PHP](./03-php/README.md)                                | [Глоссарий](./03-php/GLOSSARY.md)               | ✅ Готов |
| 04  | [Python](./04-python/README.md)                          | [Глоссарий](./04-python/GLOSSARY.md)            | ✅ Готов |
| 05  | [Go](./05-go/README.md)                                  | [Глоссарий](./05-go/GLOSSARY.md)                | ✅ Готов |


### AI / ML


| #   | Модуль                                                                 | Глоссарий                                            | Статус  |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| 06  | [Prompt Engineering (text)](./06-prompt-engineering/README.md)         | [Глоссарий](./06-prompt-engineering/GLOSSARY.md)     | ✅ Готов |
| 07  | [JSON Schema / structured output](./07-json-schema/README.md)          | [Глоссарий](./07-json-schema/GLOSSARY.md)            | ✅ Готов |
| 08  | [Local Inference (LM Studio / Ollama)](./08-local-inference/README.md) | [Глоссарий](./08-local-inference/GLOSSARY.md)        | ✅ Готов |
| 09  | [Evaluator / Benchmark Design](./09-evaluator-benchmark/README.md)     | [Глоссарий](./09-evaluator-benchmark/GLOSSARY.md)    | ✅ Готов |
| 10  | [Prompt Engineering (VLM)](./10-prompt-engineering-vlm/README.md)      | [Глоссарий](./10-prompt-engineering-vlm/GLOSSARY.md) | ✅ Готов |


### Обработка документов


| #   | Модуль                                                      | Глоссарий                                    | Статус  |
| --- | ----------------------------------------------------------- | -------------------------------------------- | ------- |
| 11  | [OOXML — raw XML внутри DOCX](./11-ooxml-docx/README.md)    | [Глоссарий](./11-ooxml-docx/GLOSSARY.md)     | ✅ Готов |
| 12  | [PDF internals](./12-pdf-internals/README.md)               | [Глоссарий](./12-pdf-internals/GLOSSARY.md)  | ✅ Готов |
| 13  | [PDFium (WASM)](./13-pdfium-wasm/README.md)                 | [Глоссарий](./13-pdfium-wasm/GLOSSARY.md)    | ✅ Готов |
| 14  | [Sharp / libvips](./14-sharp-libvips/README.md)             | [Глоссарий](./14-sharp-libvips/GLOSSARY.md)  | ✅ Готов |
| 15  | [Image formats (WebP / AVIF)](./15-image-formats/README.md) | [Глоссарий](./15-image-formats/GLOSSARY.md)  | ✅ Готов |
| 16  | [VLM document pipeline](./16-vlm-pipeline/README.md)        | [Глоссарий](./16-vlm-pipeline/GLOSSARY.md)   | ✅ Готов |
| 17  | [Excel / XLSX internals](./17-xlsx-internals/README.md)     | [Глоссарий](./17-xlsx-internals/GLOSSARY.md) | ✅ Готов |


### Инфраструктура и DevOps


| #   | Модуль                                                         | Глоссарий                                    | Статус  |
| --- | -------------------------------------------------------------- | -------------------------------------------- | ------- |
| 18  | [Очереди задач (BullMQ / pg-boss)](./18-task-queues/README.md) | [Глоссарий](./18-task-queues/GLOSSARY.md)    | ✅ Готов |
| 19  | [HTTP клиенты и retry стратегии](./19-http-clients/README.md)  | [Глоссарий](./19-http-clients/GLOSSARY.md)   | ✅ Готов |
| 20  | [Кэширование: Redis, in-memory, CDN](./20-caching/README.md)   | [Глоссарий](./20-caching/GLOSSARY.md)        | ✅ Готов |
| 21  | [Тестирование: unit, integration, e2e](./21-testing/README.md) | [Глоссарий](./21-testing/GLOSSARY.md)        | ✅ Готов |
| 22  | [Worker Threads / Piscina](./22-worker-threads/README.md)      | [Глоссарий](./22-worker-threads/GLOSSARY.md) | ✅ Готов |
| 23  | [Rate limiting паттерны](./23-rate-limiting/README.md)         | [Глоссарий](./23-rate-limiting/GLOSSARY.md)  | ✅ Готов |
| 24  | [Docker](./24-docker/README.md)                                | [Глоссарий](./24-docker/GLOSSARY.md)         | ✅ Готов |
| 25  | [CI/CD (GitHub Actions)](./25-cicd/README.md)                  | [Глоссарий](./25-cicd/GLOSSARY.md)           | ✅ Готов |
| 26  | [Logging / observability](./26-logging/README.md)              | [Глоссарий](./26-logging/GLOSSARY.md)        | ✅ Готов |


### Веб и SEO


| #   | Модуль                                                                                 | Глоссарий                                             | Статус  |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------- |
| 27  | [Static site generation](./27-static-site/README.md)                                   | [Глоссарий](./27-static-site/GLOSSARY.md)             | ✅ Готов |
| 28  | [Core Web Vitals — метрики и инструменты](./28-core-web-vitals/README.md)              | [Глоссарий](./28-core-web-vitals/GLOSSARY.md)         | ✅ Готов |
| 29  | [Critical CSS inlining](./29-critical-css/README.md)                                   | [Глоссарий](./29-critical-css/GLOSSARY.md)            | ✅ Готов |
| 30  | [Schema.org / structured data](./30-schema-org/README.md)                              | [Глоссарий](./30-schema-org/GLOSSARY.md)              | ✅ Готов |
| 31  | [Mobile-First CSS](./31-mobile-first-css/README.md)                                    | [Глоссарий](./31-mobile-first-css/GLOSSARY.md)        | ✅ Готов |
| 32  | [Доступность (Accessibility / WCAG)](./32-accessibility/README.md)                     | [Глоссарий](./32-accessibility/GLOSSARY.md)           | ✅ Готов |
| 33  | [Web Performance API](./33-web-performance-api/README.md)                              | [Глоссарий](./33-web-performance-api/GLOSSARY.md)     | ✅ Готов |
| 34  | [Lazy loading и Intersection Observer](./34-lazy-loading/README.md)                    | [Глоссарий](./34-lazy-loading/GLOSSARY.md)            | ✅ Готов |
| 35  | [Оптимизация изображений](./35-image-optimization/README.md)                           | [Глоссарий](./35-image-optimization/GLOSSARY.md)      | ✅ Готов |
| 36  | [Critical Rendering Path и CSS оптимизация](./36-critical-rendering-path/README.md)    | [Глоссарий](./36-critical-rendering-path/GLOSSARY.md) | ✅ Готов |
| 37  | [JavaScript Performance и Memory Management](./37-js-performance/README.md)            | [Глоссарий](./37-js-performance/GLOSSARY.md)          | ✅ Готов |
| 38  | [Caching стратегии: HTTP, Service Worker, CDN](./38-caching/README.md)                 | [Глоссарий](./38-caching/GLOSSARY.md)                 | ✅ Готов |
| 39  | [Core Web Vitals: LCP, INP, CLS от измерения до фикса](./39-core-web-vitals/README.md) | [Глоссарий](./39-core-web-vitals/GLOSSARY.md)         | ✅ Готов |
| 40  | [Performance Budget и CI регрессии](./40-performance-budget/README.md)                 | [Глоссарий](./40-performance-budget/GLOSSARY.md)      | ✅ Готов |


---

## Прогресс

```
████████████████████████████████████████ 40 / 40 (100%)
```

---

## Актуальный стек

> Обновлено: апрель 2026. Использовать как отправную точку — проверять перед каждым модулем.


| Инструмент | Версия     | Примечание                                              |
| ---------- | ---------- | ------------------------------------------------------- |
| Node.js    | **24 LTS** | v22 — Maintenance LTS, v26 выходит апрель 2026 (не LTS) |
| TypeScript | **5.9**    | TS 6.0 ожидается                                        |
| PHP        | **8.5+**   | 8.5.4 вышел март 2026                                   |
| Python     | **3.14+**  | 3.14.3 — февраль 2026                                   |
| Go         | **1.26**   | февраль 2026                                            |
| LM Studio  | **0.4.8**  |                                                         |
| vLLM       | **0.8.x**  |                                                         |


---

## Open-source LLM топ

> Обновлено: апрель 2026. Перед AI/ML модулями — проверять актуальный leaderboard.


| Модель                      | ELO   | Ctx  | Особенность                 |
| --------------------------- | ----- | ---- | --------------------------- |
| GLM-5 (Zhipu)               | ~1454 | 200K | Лидер overall               |
| Qwen3.5-397B-A17B (Alibaba) | ~1450 | 262K | VLM native, hybrid thinking |
| Kimi K2.5 (Moonshot)        | ~1438 | 262K | ~1T MoE, VLM vLLM only      |
| DeepSeek V3.2 (DeepSeek)    | ~1423 | 130K | MIT, text-only              |


**Preview (ELO уточняется):**


| Модель                         | Доступность                  | Особенность                                  |
| ------------------------------ | ---------------------------- | -------------------------------------------- |
| Qwen3.6 Plus Preview (Alibaba) | OpenRouter free, апрель 2026 | Cloud-only, hybrid arch, усиленный reasoning |


**Локальный VLM — только Qwen3.5:** 0.8B / 2B / 4B / 9B / 35B-A3B / 122B-A10B. Vision + Reasoning нативно.

---

## Структура репозитория

```
AI-Architect-Course/
├── README.md
├── Prompt.md                              # System prompt курса
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
├── 11-ooxml-docx/
├── 12-pdf-internals/
├── 13-pdfium-wasm/
├── 14-sharp-libvips/
├── 15-image-formats/
├── 16-vlm-pipeline/
├── 17-xlsx-internals/
├── 18-task-queues/
├── 19-http-clients/
├── 20-caching/
├── 21-testing/
├── 22-worker-threads/
├── 23-rate-limiting/
├── 24-docker/
├── 25-cicd/
├── 26-logging/
├── 27-static-site/
├── 28-core-web-vitals/
├── 29-critical-css/
├── 30-schema-org/
├── 31-mobile-first-css/
├── 32-accessibility/
├── 33-web-performance-api/
├── 34-lazy-loading/
├── 35-image-optimization/
├── 36-critical-rendering-path/
├── 37-js-performance/
├── 38-caching/
├── 39-core-web-vitals/
└── 40-performance-budget/
```

---

> *«AI пишет код. Архитектор решает — какой.»*