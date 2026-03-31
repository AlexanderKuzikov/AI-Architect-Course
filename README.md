# AI Architect Course


> Курс по современному технологическому стеку для AI-архитекторов.
> Архитектурное мышление, глубина технологий, работа с LLM-кодерами.


**Автор:** [Alexander Kuzikov](https://github.com/AlexanderKuzikov)
**Статус:** В активной разработке · 10 из 40 модулей готовы


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


1. **Механика** — как технология работает внутри
2. **Архитектурные решения** — когда применять, trade-offs
3. **Граничные случаи** — где ломается, что AI не предупредит
4. **Задачи AI-кодеру** — как правильно формулировать
5. **Чеклист архитектора** — что проверить перед принятием решений
6. **Глоссарий** — справочник терминов модуля


---


## Структура репозитория


```

AI-Architect-Course/
├── README.md                              \# Этот файл
├── Prompt.md                              \# System prompt курса
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
├── 06-prompt-engineering/                 \# ✅ Готов
│   ├── README.md
│   └── GLOSSARY.md
├── 07-json-schema/                        \# ✅ Готов
│   ├── README.md
│   └── GLOSSARY.md
├── 08-local-inference/                    \# ✅ Готов
│   ├── README.md
│   └── GLOSSARY.md
├── 09-evaluator-benchmark/                \# ✅ Готов
│   ├── README.md
│   └── GLOSSARY.md
├── 10-prompt-engineering-vlm/             \# ✅ Готов
│   ├── README.md
│   └── GLOSSARY.md
└── [11..40]-название/                     \# ⏳ В разработке

```


---


## Структура курса


### Языки программирования


| # | Модуль | Глоссарий | Статус |
|---|--------|-----------|--------|
| 01 | [JavaScript / Node.js](./01-javascript-nodejs/README.md) | [Глоссарий](./01-javascript-nodejs/GLOSSARY.md) | ✅ Готов |
| 02 | [TypeScript](./02-typescript/README.md) | [Глоссарий](./02-typescript/GLOSSARY.md) | ✅ Готов |
| 03 | [PHP](./03-php/README.md) | [Глоссарий](./03-php/GLOSSARY.md) | ✅ Готов |
| 04 | [Python](./04-python/README.md) | [Глоссарий](./04-python/GLOSSARY.md) | ✅ Готов |
| 05 | [Go](./05-go/README.md) | [Глоссарий](./05-go/GLOSSARY.md) | ✅ Готов |


### AI / ML


| # | Модуль | Глоссарий | Статус |
|---|--------|-----------|--------|
| 06 | [Prompt Engineering (text)](./06-prompt-engineering/README.md) | [Глоссарий](./06-prompt-engineering/GLOSSARY.md) | ✅ Готов |
| 07 | [JSON Schema / structured output](./07-json-schema/README.md) | [Глоссарий](./07-json-schema/GLOSSARY.md) | ✅ Готов |
| 08 | [Local Inference (LM Studio / Ollama)](./08-local-inference/README.md) | [Глоссарий](./08-local-inference/GLOSSARY.md) | ✅ Готов |
| 09 | [Evaluator / Benchmark Design](./09-evaluator-benchmark/README.md) | [Глоссарий](./09-evaluator-benchmark/GLOSSARY.md) | ✅ Готов |
| 10 | [Prompt Engineering (VLM)](./10-prompt-engineering-vlm/README.md) | [Глоссарий](./10-prompt-engineering-vlm/GLOSSARY.md) | ✅ Готов |
| 11 | Multi-model Orchestration | — | 🔄 Следующий |
| 12 | RAG — архитектура и паттерны | — | ⏳ |
| 13 | Fine-tuning / LoRA | — | ⏳ |


### Обработка документов


| # | Модуль | Глоссарий | Статус |
|---|--------|-----------|--------|
| 14 | OOXML — raw XML внутри DOCX | — | ⏳ |
| 15 | PDF internals | — | ⏳ |
| 16 | PDFium (WASM) | — | ⏳ |
| 17 | Sharp / libvips | — | ⏳ |
| 18 | Image formats (WebP / AVIF) | — | ⏳ |
| 19 | Resolution pyramid / DPI theory | — | ⏳ |
| 20 | SAX streaming XML | — | ⏳ |


### Веб и SEO


| # | Модуль | Глоссарий | Статус |
|---|--------|-----------|--------|
| 21 | Static site generation | — | ⏳ |
| 22 | Core Web Vitals | — | ⏳ |
| 23 | Critical CSS inlining | — | ⏳ |
| 24 | Schema.org / structured data | — | ⏳ |
| 25 | Mobile-First CSS | — | ⏳ |
| 26 | SEO — технические аспекты | — | ⏳ |
| 27 | HTTP/2, кэширование | — | ⏳ |


### Системное программирование и инфраструктура


| # | Модуль | Глоссарий | Статус |
|---|--------|-----------|--------|
| 28 | Worker Threads / Piscina | — | ⏳ |
| 29 | Rate limiting паттерны | — | ⏳ |
| 30 | Retry / resilience паттерны | — | ⏳ |
| 31 | Docker | — | ⏳ |
| 32 | CI/CD (GitHub Actions) | — | ⏳ |
| 33 | Logging / observability | — | ⏳ |


### Данные и интеграции


| # | Модуль | Глоссарий | Статус |
|---|--------|-----------|--------|
| 34 | REST API design | — | ⏳ |
| 35 | WooCommerce REST API | — | ⏳ |
| 36 | Google Sheets API | — | ⏳ |
| 37 | Telegram API (Telethon / MTProto) | — | ⏳ |
| 38 | SQL / реляционные БД | — | ⏳ |
| 39 | JSON как source of truth | — | ⏳ |
| 40 | VLM internals | — | ⏳ |


---


## Прогресс


```

██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 10 / 40 (25%)

```


---


> *«AI пишет код. Архитектор решает — какой.»*
