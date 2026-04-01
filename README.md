# AI Architect Course

> Курс по современному технологическому стеку для AI-архитекторов.
> Архитектурное мышление, глубина технологий, работа с LLM-кодерами.

**Автор:** [Alexander Kuzikov](https://github.com/AlexanderKuzikov)
**Статус:** В активной разработке · 20 из 40 модулей готовы

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

| # | Модуль | Глоссарий | Статус |
|:--|:--|:--|:--|
| 01 | [JavaScript / Node.js](./01-javascript-nodejs/README.md) | [Глоссарий](./01-javascript-nodejs/GLOSSARY.md) | ✅ Готов |
| 02 | [TypeScript](./02-typescript/README.md) | [Глоссарий](./02-typescript/GLOSSARY.md) | ✅ Готов |
| 03 | [PHP](./03-php/README.md) | [Глоссарий](./03-php/GLOSSARY.md) | ✅ Готов |
| 04 | [Python](./04-python/README.md) | [Глоссарий](./04-python/GLOSSARY.md) | ✅ Готов |
| 05 | [Go](./05-go/README.md) | [Глоссарий](./05-go/GLOSSARY.md) | ✅ Готов |

### AI / ML

| # | Модуль | Глоссарий | Статус |
|:--|:--|:--|:--|
| 06 | [Prompt Engineering (text)](./06-prompt-engineering/README.md) | [Глоссарий](./06-prompt-engineering/GLOSSARY.md) | ✅ Готов |
| 07 | [JSON Schema / structured output](./07-json-schema/README.md) | [Глоссарий](./07-json-schema/GLOSSARY.md) | ✅ Готов |
| 08 | [Local Inference (LM Studio / Ollama)](./08-local-inference/README.md) | [Глоссарий](./08-local-inference/GLOSSARY.md) | ✅ Готов |
| 09 | [Evaluator / Benchmark Design](./09-evaluator-benchmark/README.md) | [Глоссарий](./09-evaluator-benchmark/GLOSSARY.md) | ✅ Готов |
| 10 | [Prompt Engineering (VLM)](./10-prompt-engineering-vlm/README.md) | [Глоссарий](./10-prompt-engineering-vlm/GLOSSARY.md) | ✅ Готов |

### Обработка документов

| # | Модуль | Глоссарий | Статус |
|:--|:--|:--|:--|
| 11 | [OOXML — raw XML внутри DOCX](./11-ooxml-docx/README.md) | [Глоссарий](./11-ooxml-docx/GLOSSARY.md) | ✅ Готов |
| 12 | [PDF internals](./12-pdf-internals/README.md) | [Глоссарий](./12-pdf-internals/GLOSSARY.md) | ✅ Готов |
| 13 | [PDFium (WASM)](./13-pdfium-wasm/README.md) | [Глоссарий](./13-pdfium-wasm/GLOSSARY.md) | ✅ Готов |
| 14 | [Sharp / libvips](./14-sharp-libvips/README.md) | [Глоссарий](./14-sharp-libvips/GLOSSARY.md) | ✅ Готов |
| 15 | [Image formats (WebP / AVIF)](./15-image-formats/README.md) | [Глоссарий](./15-image-formats/GLOSSARY.md) | ✅ Готов |
| 16 | [VLM document pipeline](./16-vlm-pipeline/README.md) | [Глоссарий](./16-vlm-pipeline/GLOSSARY.md) | ✅ Готов |
| 17 | [Excel / XLSX internals](./17-xlsx-internals/README.md) | [Глоссарий](./17-xlsx-internals/GLOSSARY.md) | ✅ Готов |

### Инфраструктура и сервисы

| # | Модуль | Глоссарий | Статус |
|:--|:--|:--|:--|
| 18 | [Очереди задач (BullMQ / pg-boss)](./18-task-queues/README.md) | [Глоссарий](./18-task-queues/GLOSSARY.md) | ✅ Готов |
| 19 | [HTTP клиенты и retry стратегии](./19-http-clients/README.md) | [Глоссарий](./19-http-clients/GLOSSARY.md) | ✅ Готов |
| 20 | [Кэширование: Redis, in-memory, CDN](./20-caching/README.md) | [Глоссарий](./20-caching/GLOSSARY.md) | ✅ Готов |
| 21 | Тестирование: unit, integration, e2e | — | 🔄 Следующий |
| 22 | Worker Threads / Piscina | — | ⏳ |
| 23 | Rate limiting паттерны | — | ⏳ |
| 24 | Docker | — | ⏳ |
| 25 | CI/CD (GitHub Actions) | — | ⏳ |
| 26 | Logging / observability | — | ⏳ |

### Веб и SEO

| # | Модуль | Глоссарий | Статус |
|:--|:--|:--|:--|
| 27 | Static site generation | — | ⏳ |
| 28 | Core Web Vitals | — | ⏳ |
| 29 | Critical CSS inlining | — | ⏳ |
| 30 | Schema.org / structured data | — | ⏳ |
| 31 | Mobile-First CSS | — | ⏳ |
| 32 | SEO — технические аспекты | — | ⏳ |
| 33 | HTTP/2, кэширование на уровне CDN | — | ⏳ |

### Данные и интеграции

| # | Модуль | Глоссарий | Статус |
|:--|:--|:--|:--|
| 34 | REST API design | — | ⏳ |
| 35 | WooCommerce REST API | — | ⏳ |
| 36 | Google Sheets API | — | ⏳ |
| 37 | Telegram API (MTProto) | — | ⏳ |
| 38 | SQL / реляционные БД | — | ⏳ |
| 39 | JSON как source of truth | — | ⏳ |
| 40 | Multi-model Orchestration / RAG | — | ⏳ |

---

## Прогресс

```
████████████████████░░░░░░░░░░░░░░░░░░░░ 20 / 40 (50%)
```

---

## Актуальный стек

> Обновлено: апрель 2026. Использовать как отправную точку — проверять перед каждым модулем.

| Инструмент | Версия | Примечание |
| :-- | :-- | :-- |
| Node.js | **24 LTS** | v22 — Maintenance LTS, v26 выходит апрель 2026 (не LTS) |
| TypeScript | **5.9** | TS 6.0 ожидается |
| PHP | **8.5+** | 8.5.4 вышел март 2026 |
| Python | **3.14+** | 3.14.3 — февраль 2026 |
| Go | **1.26** | февраль 2026 |
| LM Studio | **0.4.8** | |
| vLLM | **0.8.x** | |

---

## Open-source LLM топ

> Обновлено: апрель 2026. Перед AI/ML модулями — проверять актуальный leaderboard.

| Модель | ELO | Ctx | Особенность |
| :-- | :-- | :-- | :-- |
| GLM-5 (Zhipu) | ~1454 | 200K | Лидер overall |
| Qwen3.5-397B-A17B (Alibaba) | ~1450 | 262K | VLM native, hybrid thinking |
| Kimi K2.5 (Moonshot) | ~1438 | 262K | ~1T MoE, VLM vLLM only |
| DeepSeek V3.2 (DeepSeek) | ~1423 | 130K | MIT, text-only |

**Preview (ELO уточняется):**

| Модель | Доступность | Особенность |
| :-- | :-- | :-- |
| Qwen3.6 Plus Preview (Alibaba) | OpenRouter free, апрель 2026 | Cloud-only, hybrid arch, усиленный reasoning |

**Локальный VLM — только Qwen3.5:** 0.8B / 2B / 4B / 9B / 35B-A3B / 122B-A10B. Vision + Reasoning нативно.

---

## Структура репозитория

```
AI-Architect-Course/
├── README.md
├── Prompt.md                              # System prompt курса
│
├── 01-javascript-nodejs/
│   ├── README.md
│   └── GLOSSARY.md
├── 02-typescript/
│   ├── README.md
│   └── GLOSSARY.md
├── 03-php/
│   ├── README.md
│   └── GLOSSARY.md
├── 04-python/
│   ├── README.md
│   └── GLOSSARY.md
├── 05-go/
│   ├── README.md
│   └── GLOSSARY.md
├── 06-prompt-engineering/
│   ├── README.md
│   └── GLOSSARY.md
├── 07-json-schema/
│   ├── README.md
│   └── GLOSSARY.md
├── 08-local-inference/
│   ├── README.md
│   └── GLOSSARY.md
├── 09-evaluator-benchmark/
│   ├── README.md
│   └── GLOSSARY.md
├── 10-prompt-engineering-vlm/
│   ├── README.md
│   └── GLOSSARY.md
├── 11-ooxml-docx/
│   ├── README.md
│   └── GLOSSARY.md
├── 12-pdf-internals/
│   ├── README.md
│   └── GLOSSARY.md
├── 13-pdfium-wasm/
│   ├── README.md
│   └── GLOSSARY.md
├── 14-sharp-libvips/
│   ├── README.md
│   └── GLOSSARY.md
├── 15-image-formats/
│   ├── README.md
│   └── GLOSSARY.md
├── 16-vlm-pipeline/
│   ├── README.md
│   └── GLOSSARY.md
├── 17-xlsx-internals/
│   ├── README.md
│   └── GLOSSARY.md
├── 18-task-queues/
│   ├── README.md
│   └── GLOSSARY.md
├── 19-http-clients/
│   ├── README.md
│   └── GLOSSARY.md
├── 20-caching/
│   ├── README.md
│   └── GLOSSARY.md
└── [21..40]-название/                     # ⏳ В разработке
```

---

> *«AI пишет код. Архитектор решает — какой.»*
