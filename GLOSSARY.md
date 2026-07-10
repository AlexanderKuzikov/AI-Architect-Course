# GLOSSARY — Master Glossary

## Alphabetical Index

[A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [H](#h) · [I](#i) · [J](#j) · [K](#k) · [L](#l) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [Q](#q) · [R](#r) · [S](#s) · [T](#t) · [U](#u) · [V](#v) · [W](#w) · [X](#x) · [Y](#y) · [Z](#z) 
[А](#а) · [Б](#б) · [В](#в) · [Г](#г) · [Д](#д) · [Е](#е) · [Ж](#ж) · [З](#з) · [И](#и) · [Й](#й) · [К](#к) · [Л](#л) · [М](#м) · [Н](#н) · [О](#о) · [П](#п) · [Р](#р) · [С](#с) · [Т](#т) · [У](#у) · [Ф](#ф) · [Х](#х) · [Ц](#ц) · [Ч](#ч) · [Ш](#ш) · [Щ](#щ) · [Э](#э) · [Ю](#ю) · [Я](#я)

---

## A

**A2A (Agent-to-Agent)** ([Модуль 42](../42-a2a-protocol/README.md))
Протокол коммуникации между агентами. Решает task submission, status, streaming, cancellation и artifact exchange.

**above-the-fold** ([Модуль 29](../29-critical-css/README.md))
Контент страницы видимый без прокрутки при первой загрузке. Viewport-зависимо: desktop (1440×900), mobile (390×844). Только стили для этого контента должны быть critical — всё остальное может загружаться асинхронно.

**Action Schema** ([Модуль 44](../44-browser-use-computer-use/README.md))
Typed contract допустимых действий браузера: goto, fill, click, wait, extract, screenshot. Нужен для validation и policy enforcement.

**Agent Loop** ([Модуль 06](../06-prompt-engineering/README.md))
Архитектурный паттерн: LLM в цикле — генерирует действие → получает результат → генерирует следующее действие. Цикл продолжается до цели или лимита шагов. Базовая форма: `while not done: action = llm(history); result = execute(action); history.append(result)`. На слабых моделях ломается бесконечными петлями — нужен hard limit шагов и fallback.

**Agent Security Boundary** ([Модуль 47](../47-ai-security-agents/README.md))
Комбинация prompt, authz, sandbox, approvals, audit и guardrails. Один system prompt boundary не является security boundary.

**Agentic RAG** ([Модуль 12](../12-rag/README.md), [Модуль 45](../45-agentic-rag-graph-rag/README.md))
RAG-система, где retrieval управляется агентным loop: planning, multi-step retrieval, gap detection, verification.

**AgentOps** ([Модуль 46](../46-agentops/README.md))
Набор практик для observability, tracing, evaluation, guardrails, cost control и incident response в LLM/agent systems.

**AgentOps Evals** ([Модуль 09](../09-evaluator-benchmark/README.md))
Набор метрик для оценки agent workflows: success rate, tool accuracy, forbidden tool rate, fallback rate, cost per task, latency, hallucination rate.

**Alpaca format** ([Модуль 13](../13-fine-tuning/README.md))
Формат датасета для instruction fine-tuning: три поля — `instruction` (задача), `input` (контекст), `output` (ожидаемый ответ). Стандартный выбор для single-turn задач. При форматировании оборачивается в chat template модели.

**ANN (Approximate Nearest Neighbor)** ([Модуль 12](../12-rag/README.md))
Алгоритм поиска ближайших соседей в векторном пространстве, жертвующий точностью ради скорости. Возвращает не гарантированно точный top-k, а приближённый. Recall ANN-индекса нужно измерять явно — он не гарантирован алгоритмом.

**Annotation (аннотация типа)** ([Модуль 04](../04-python/README.md))
Подсказка типа для параметров и возвращаемых значений функций. С Python 3.14 (PEP 649) аннотации вычисляются **лениво** (deferred) — не при определении функции, а только при явном обращении. Устраняет проблему forward references без кавычек.

**AppArmor** ([Модуль 24](../24-docker/README.md))
Linux security module: мандатный контроль доступа на уровне процессов. Docker автоматически применяет дефолтный AppArmor профиль `docker-default` к контейнерам. Для критичных сервисов — явные кастомные профили.

**Approval Policy** ([Модуль 41](../41-mcp-tool-server-architecture/README.md))
Правило, определяющее какие MCP tool calls требуют подтверждения человека. Обычно требуется для write/destructive/secrets/email actions.

**aria-describedby** ([Модуль 32](../32-accessibility/README.md))
ARIA атрибут: связывает элемент с его описанием через `id`. Screen reader объявляет описание после label. Использовать для подсказок, требований формата, контекстной информации.

**artifact** ([Модуль 25](../25-cicd/README.md), [Модуль 42](../42-a2a-protocol/README.md))
Файл или директория, загруженные из job через `actions/upload-artifact`. Доступны для download в последующих jobs (`actions/download-artifact`) или для ручного скачивания. Хранятся N дней (`retention-days`). Не предназначены для Docker образов — использовать registry.

**Astro Islands** ([Модуль 27](../27-static-site/README.md))
Архитектурный паттерн Astro: страница — статический HTML, интерактивность добавляется точечно через «острова» (компоненты с `client:*` директивами). Остальная страница — 0 KB JavaScript. Позволяет смешивать React, Vue, Svelte, Preact на одной странице.

**async/await** ([Модуль 01](../01-javascript-nodejs/README.md), [Модуль 04](../04-python/README.md))
Синтаксис для определения и вызова корутин. `async def` — корутина. `await` — приостанавливает корутину до получения результата, не блокируя Event Loop. Только внутри `async def`.

**AsyncDisposable** ([Модуль 21](../21-testing/README.md))
Интерфейс TypeScript 5.2+: `await using container = ...`. Автоматически вызывает `[Symbol.asyncDispose]()` при выходе из блока. Используется в testcontainers для гарантированной остановки контейнеров без явного `afterAll`.

**AsyncGenerator** ([Модуль 16](../16-pdfium-wasm/README.md))
TypeScript/JavaScript генератор возвращающий значения асинхронно через `yield`. Используется для batch pipeline: обрабатывать документы и отдавать страницы по мере готовности без накопления всех результатов в памяти. Потребитель итерирует через `for await...of`.

**asyncio** ([Модуль 04](../04-python/README.md))
Стандартная библиотека для асинхронного программирования на основе событийного цикла. Использует корутины (`async def`) и примитивы синхронизации (`asyncio.Lock`, `asyncio.Queue`, `asyncio.Semaphore`). Не про параллелизм — про конкурентность в одном потоке.

**at-least-once** ([Модуль 18](../18-task-queues/README.md))
Гарантия доставки: задача будет выполнена минимум один раз. При падении воркера до завершения — задача возвращается в очередь и обрабатывается повторно. Требует идемпотентного processor. BullMQ работает в режиме at-least-once.

**at-most-once** ([Модуль 18](../18-task-queues/README.md))
Гарантия доставки: задача выполнится не более одного раза, но может быть потеряна. Подходит для некритичных операций (аналитика, метрики). В Node.js — `EventEmitter` или прямой вызов без персистентности.

**Atomics** ([Модуль 22](../22-worker-threads/README.md), [Модуль 37](../37-js-performance/README.md))
Namespace глобальных атомарных операций для SharedArrayBuffer: `add`, `sub`, `load`, `store`, `wait`, `notify`. Гарантируют неделимость read-modify-write — предотвращают race condition при конкурентной записи из нескольких потоков.

**Atomics.wait()** ([Модуль 22](../22-worker-threads/README.md))
Блокирует текущий поток до получения уведомления через `Atomics.notify()`. Допустимо только в Worker Threads — блокирует event loop при вызове в main thread. Механизм синхронизации между потоками без busy-loop.

**Auto-rotate** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Pre-processing шаг: определение ориентации документа через pytesseract OSD и коррекция поворота перед подачей в VLM. Отсутствие auto-rotate — причина деградации до 38% точности на ротированных сканах.

**Autoloading** ([Модуль 03](../03-php/README.md))
Механизм автоматической загрузки классов по требованию без явных `require`/`include`. Стандарт PSR-4 определяет соответствие пространства имён структуре директорий. Управляется через Composer и его `vendor/autoload.php`.

**AVIF (AV1 Image File Format)** ([Модуль 35](../35-image-optimization/README.md))
Формат изображений основанный на AV1 video codec. 45–60% меньше JPEG при том же визуальном качестве. Поддерживает HDR (10-bit/12-bit), прозрачность, анимацию. Browser support ≈95% в 2026. Primary формат для фотографий.

## B

**backoff** (Модули 18–19)
Стратегия задержки между retry попытками. Типы: `exponential` — задержка удваивается (`delay * factor^attemptNumber`), cap рекомендован ≤30s; `fixed` — постоянная задержка; `linear` — линейный рост. Без jitter в multi-instance деплое приводит к thundering herd.

**Backpressure** ([Модуль 01](../01-javascript-nodejs/README.md), [Модуль 18](../18-task-queues/README.md), [Модуль 22](../22-worker-threads/README.md))
Механизм сдерживания producer когда consumer не успевает обрабатывать. В контексте очередей: проверять `queue.getWaitingCount()` перед добавлением задач, ждать если очередь превышает порог. Без backpressure — Redis заполняется быстрее чем воркеры обрабатывают.

**Baseline** ([Модуль 09](../09-evaluator-benchmark/README.md), [Модуль 13](../13-fine-tuning/README.md))
Зафиксированные метрики качества pipeline в конкретный момент времени. Содержит: mean score, p10/p90, failure rate, версию модели, hash промпта, версию датасета. Хранится в git. Без baseline quality gate не имеет смысла — нет точки отсчёта.

**beforeAll / afterAll** ([Модуль 21](../21-testing/README.md))
Хуки жизненного цикла suite в Vitest/Jest. Выполняются один раз на весь `describe`-блок. Стандартное место для запуска testcontainers: поднять контейнер один раз, не на каждый тест.

**beforeEach / afterEach** ([Модуль 21](../21-testing/README.md))
Хуки, выполняемые перед/после каждого теста. Используются для изоляции данных: `TRUNCATE`, `ROLLBACK`, сброс моков. Поднимать Docker-контейнеры в `beforeEach` — антипаттерн: 50 тестов × 3s startup = 2.5 минуты.

**BERTScore** ([Модуль 09](../09-evaluator-benchmark/README.md))
Метрика семантического сходства текстов через контекстные эмбеддинги BERT. Не требует LLM-судью, работает локально. Не измеряет фактическую точность — только текстовое сходство. Применение: summarization, перефразирование.

**Bitmap (raw RGBA)** ([Модуль 16](../16-pdfium-wasm/README.md))
Несжатый растр: последовательность пикселей в формате Red-Green-Blue-Alpha, 4 байта на пиксель. PDFium отдаёт результат рендеринга именно в этом формате. Размер: `width × height × 4` байт. A4 @ 200dpi = 1240×1754 = ≈8.7 МБ.

**Blast Radius** ([Модуль 47](../47-ai-security-agents/README.md))
Максимальный ущерб, который может нанести compromised agent/tool/session.

**blockingDuration** ([Модуль 33](../33-web-performance-api/README.md))
Свойство `PerformanceLongAnimationFrameEntry`: время в ms когда main thread не мог обработать пользовательские input события из-за long animation frame. Ненулевое значение — прямая причина плохого INP. Отличается от `duration` (общего времени frame).

**BM25 (Best Match 25)** ([Модуль 12](../12-rag/README.md))
Алгоритм ранжирования документов на основе TF-IDF с нормализацией по длине. Sparse retrieval: хорошо находит точные совпадения по терминам (коды, имена, даты), плохо — семантические вариации. Используется в hybrid search совместно с dense retrieval.

**Bounding Box (нормализованный)** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Координаты региона изображения в формате [x1, y1, x2, y2] от 0 до 1000. Используется в grounding запросах к CURRENT_VLM_MODEL. Конвертация в пиксели: `coord / 1000 × img_dimension`.

**Branded Types** ([Модуль 02](../02-typescript/README.md))
паттерн для различения примитивов одного типа (например, `string`), добавляющий фиктивное поле `__brand`. Позволяет компилятору отличать `CourtId` от `RegionId` на уровне типов.

**Browser Context** ([Модуль 44](../44-browser-use-computer-use/README.md))
Изолированная сессия браузера: cookies, localStorage, viewport, permissions. Для agent run должен быть отдельный context.

**Build Tags (Build Constraints)** ([Модуль 05](../05-go/README.md))
Директивы `//go:build` в начале файла для условной компиляции. `//go:build linux && amd64` — файл включается только на Linux x86-64. Используется для платформо-специфичного кода, тестовых помощников, флагов сборки.

**BundleMon** ([Модуль 40](../40-performance-budget/README.md))
Инструмент (версия 2.x) мониторинга bundle size в CI. Сравнивает размер файлов текущего PR с base branch, публикует PR comment с таблицей delta, создаёт GitHub Check. Поддерживает glob паттерны для файлов с хешами.

## C

**cache (actions/cache)** ([Модуль 25](../25-cicd/README.md))
Механизм сохранения директорий между runs для ускорения jobs. Ключ (`key`) — строка, определяющая версию кэша. При совпадении — restore, при отсутствии — создаётся новый после job. Cache-miss: `restore-keys` используется как fallback по префиксу.

**Cache First** ([Модуль 38](../38-http-service-worker-caching/README.md))
Service Worker стратегия: сначала проверить SW cache, при отсутствии — network. Для статических ассетов (JS, CSS, fonts, images). Риск: устаревший контент без явной инвалидации.

**cache mount** ([Модуль 24](../24-docker/README.md))
BuildKit `--mount=type=cache,target=PATH`: persistent volume между сборками для кэша пакетных менеджеров. Не попадает в финальный образ. Ускоряет повторные сборки при изменении зависимостей: npm скачивает только новые пакеты, остальные из кэша.

**Cache-Aside (Lazy Loading)** ([Модуль 20](../20-backend-caching/README.md))
Паттерн кэширования: приложение самостоятельно управляет кэшем. Чтение: check cache → miss → read DB → set cache. Запись: write DB → invalidate cache. Самый распространённый паттерн. Риск: thundering herd при первом промахе после инвалидации.

**Cache-Control** ([Модуль 20](../20-backend-caching/README.md), [Модуль 38](../38-http-service-worker-caching/README.md))
HTTP заголовок управляющий кэшированием. Директивы: `max-age` (секунды свежести), `public`/`private` (CDN vs только браузер), `no-store` (не кэшировать вообще), `no-cache` (кэшировать но ревалидировать), `immutable` (не ревалидировать до истечения max-age), `stale-while-revalidate` (отдавать stale пока обновляется).

**calculatedSize** ([Модуль 20](../20-backend-caching/README.md))
Свойство LRUCache: текущий суммарный размер кэша по `sizeCalculation`. Доступно только если задан `maxSize`. Используется в метриках: отношение `calculatedSize / maxSize` = memory pressure.

**Calibration (калибровка судьи)** ([Модуль 09](../09-evaluator-benchmark/README.md))
Валидация корреляции оценок LLM-судьи с human labels на репрезентативной выборке. Метрика: Spearman ρ > 0.7 — приемлемый порог. Минимальный объём для калибровки: 50 кейсов с human labels.

**Call Stack** ([Модуль 01](../01-javascript-nodejs/README.md))
Стек вызовов — структура данных, в которой JS отслеживает выполняемые функции. Работает по принципу LIFO (последний вошёл — первый вышел). Когда стек пуст — Event Loop берёт следующую задачу из очереди.

**Callback** ([Модуль 01](../01-javascript-nodejs/README.md))
Функция, переданная как аргумент другой функции, для вызова после завершения асинхронной операции. Первое поколение асинхронности в Node.js. Проблема — «Callback Hell» при вложенности.

**Callback Hell** ([Модуль 01](../01-javascript-nodejs/README.md))
Антипаттерн: глубокая вложенность callback-функций, делающая код нечитаемым и неподдерживаемым. Решается через Promises или async/await.

**canonical URL** ([Модуль 27](../27-static-site/README.md))
`<link rel="canonical">` тег, указывающий поисковику предпочтительный URL страницы при наличии дублей (с/без trailing slash, параметры сортировки). Защита от пенализации за дублированный контент.

**Cascade Filter** ([Модуль 11](../11-multi-model-orchestration/README.md))
Архитектурный паттерн: первая (gate) модель выполняет классификацию/детекцию, вторая (main) обрабатывает только объекты, прошедшие порог. Снижает число вызовов дорогой модели до `p × N`, где `p` — доля объектов прошедших gate.

**cascade layer (@layer)** ([Модуль 31](../31-mobile-first-css/README.md))
CSS механизм (2022): позволяет явно задавать приоритет групп стилей независимо от specificity и порядка в файле. `@layer base, components, overrides` — overrides всегда выигрывает у base. Упрощает mobile-first override management.

**CCITTFax** ([Модуль 15](../15-pdf-internals/README.md))
Формат сжатия растровых изображений в PDF. Используется для чёрно-белых сканов (факс-стандарт). Наличие CCITTFax stream в PDF — признак сканированного документа (class 2, image-only).

**cellDates** ([Модуль 17](../17-xlsx-internals/README.md))
Опция SheetJS при чтении: `{ cellDates: true }`. Автоматически конвертирует числовые ячейки с датовыми форматами в JavaScript `Date` объекты. Без этой опции — возвращаются сырые serial numbers.

**cgo** ([Модуль 05](../05-go/README.md))
Механизм вызова C-кода из Go. Позволяет использовать нативные C-библиотеки. Серьёзные ограничения: замедляет сборку, усложняет кросс-компиляцию, отключает некоторые оптимизации. Используй только когда нет альтернативы.

**Chain-of-Thought (CoT)** ([Модуль 06](../06-prompt-engineering/README.md))
Техника промптинга: модель генерирует промежуточные рассуждения перед финальным ответом. Явный триггер (`«Let's think step by step»`) или few-shot примеры с цепочкой рассуждений повышают точность на многошаговых задачах. Увеличивает latency и расход токенов — оправдан только там, где точность важнее скорости.

**Channel** ([Модуль 05](../05-go/README.md))
Типизированный канал для передачи данных между горутинами. `make(chan int)` — небуферизованный (блокирует до получателя), `make(chan int, 100)` — буферизованный (блокирует при полном буфере). Философия: *«Don't communicate by sharing memory; share memory by communicating»*.

**Chat Template** ([Модуль 08](../08-local-inference/README.md), [Модуль 13](../13-fine-tuning/README.md))
Шаблон форматирования диалога, встроенный в токенизатор модели (`tokenizer_config.json`). Определяет специальные токены ролей (`<|im_start|>`, `[INST]`, `<|user|>` и др.). Критично: разные inference backend (LM Studio, Ollama, llama.cpp напрямую) могут применять chat template одной модели по-разному — поведение не гарантировано идентичным.

**Child Process** ([Модуль 01](../01-javascript-nodejs/README.md))
Отдельный OS-процесс, запущенный из Node.js через модуль `child_process`. В отличие от Worker Threads — полностью изолированный процесс с собственной памятью. Используется для запуска внешних бинарников.

**Chunking** ([Модуль 12](../12-rag/README.md))
Разбиение документа на фрагменты фиксированного или семантического размера для последующей векторизации. Определяет гранулярность поиска. Изменение стратегии chunking инвалидирует весь индекс.

**CI/CD Quality Gate** ([Модуль 09](../09-evaluator-benchmark/README.md))
Автоматическая проверка метрик качества в pipeline CI/CD. Два условия фейла: регрессия > порога И абсолютный score < минимума. Только один критерий — недостаточно: пропускает системно плохие или системно хорошие состояния.

**circuit breaker** ([Модуль 19](../19-http-clients/README.md))
Паттерн устойчивости: автоматически отклоняет запросы к нестабильному сервису без ожидания таймаута. Три состояния: CLOSED (нормальная работа), OPEN (fail fast), HALF-OPEN (пробный запрос). npm: `opossum` 8.x. Обязателен в сочетании с fallback.

**Circular Dependency** ([Модуль 01](../01-javascript-nodejs/README.md))
Циклическая зависимость: модуль A импортирует B, B импортирует A. В CommonJS приводит к получению пустого объекта вместо экспорта. Является архитектурным запахом независимо от платформы.

**CLOUD_VLM_MODEL** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Текущая cloud VLM/reasoning model, выбранная после проверки evals/backend/license. Vision support зависит от backend: GGUF/llama.cpp может не поддерживать projector, vLLM может требовать отдельной конфигурации.

**CLS (Cumulative Layout Shift)** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Core Web Vital: сумма неожиданных смещений layout за время жизни страницы. Формула: impact_fraction × distance_fraction для каждого shift. Порог: ≤ 0.1 (Good). Не включает смещения, инициированные пользователем (scroll, click).

**code splitting** ([Модуль 34](../34-lazy-loading/README.md))
Стратегия bundling: разбиение JavaScript на несколько чанков вместо одного bundle. Каждый чанк загружается по требованию. Реализуется через dynamic `import()` и конфиг bundler.

**Compiler API** ([Модуль 02](../02-typescript/README.md))
Программный интерфейс TypeScript для анализа и трансформации TS-кода. Используется для написания инструментов: линтеров, кодогенераторов, миграций. Открывает AST дерево программы.

**Composer** ([Модуль 03](../03-php/README.md))
Менеджер зависимостей PHP. Управляет пакетами, autoloading, скриптами сборки. `composer.json` — манифест проекта, `composer.lock` — зафиксированные версии для воспроизводимости.

**Concurrency** ([Модуль 16](../16-pdfium-wasm/README.md), [Модуль 18](../18-task-queues/README.md), [Модуль 25](../25-cicd/README.md))
Число одновременно обрабатываемых задач. Для PDFium WASM — одновременное число активных `loadDocument` операций. Выше concurrency → выше нагрузка на WASM heap. Рекомендуемый потолок: `Math.max(2, os.cpus().length / 2)`.

**Confidence** ([Модуль 21](../21-testing/README.md))
Степень уверенности, что тест обнаружит реальный баг в продакшне. Мок снижает confidence (проверяет двойника, не систему); реальная зависимость повышает. Coverage — метрика объёма, confidence — метрика качества.

**Confidence Anchoring** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Техника VLM промптинга: запрос у модели оценки читаемости каждого поля (`"high"/"medium"/"low"`). Позволяет фильтровать ненадёжные extractions в downstream и направлять на повторный запрос.

**Config-driven Design** ([Модуль 01](../01-javascript-nodejs/README.md))
Архитектурный паттерн, при котором поведение системы определяется конфигурационным файлом, а не кодом. Позволяет менять поведение без перекомпиляции и деплоя.

**connection pooling** ([Модуль 19](../19-http-clients/README.md))
Переиспользование TCP/TLS соединений между запросами к одному origin. Устраняет 80–350ms overhead на DNS lookup + TCP connect + TLS handshake для каждого запроса. undici: `Pool`. Без пула при 100 req/s к AI API = десятки секунд потерянного времени.

**Constrained Decoding** (Модули 06–08)
Механизм ограничения вывода модели на уровне токенов: только токены, допустимые текущей грамматикой или JSON Schema, получают ненулевую вероятность. Гарантирует валидный структурированный вывод без постпроцессинга и retry-петель. Реализован в llama.cpp (grammar sampling), vLLM, Outlines, а также нативно у всех крупных API-провайдеров. Отличие от JSON mode: там модель штрафуется за невалидный вывод через logit bias, здесь физически невозможно сгенерировать невалидный токен.

**container query** ([Модуль 31](../31-mobile-first-css/README.md))
CSS механизм: стили применяются на основе размера (или style properties) ближайшего containment context. Компонент адаптируется к своему контейнеру, не к viewport. Baseline 2023, safe to use в 2026.

**container style query** ([Модуль 31](../31-mobile-first-css/README.md))
CSS механизм (2024+): стили применяются на основе CSS custom property значения родителя. `@container style(--theme: dark)`. Компонент знает «тему» контейнера без JS или class передачи.

**Content Collections** ([Модуль 27](../27-static-site/README.md))
Astro механизм для типизированного контента: `defineCollection` + Zod schema. Автоматическая валидация frontmatter при сборке — ошибка типа = ошибка build, не runtime.

**Content stream** ([Модуль 15](../15-pdf-internals/README.md))
Поток байт описывающий содержимое страницы PDF: PostScript-подобные операторы рисования, позиционирования текста и изображений. Ссылается из объекта страницы через `/Contents`. Текст в content stream — не Unicode строки, а последовательности байтовых кодов глифов.

**Context (context.Context)** ([Модуль 05](../05-go/README.md))
Стандартный механизм для распространения: дедлайнов, таймаутов, сигналов отмены и пользовательских значений через дерево вызовов. `context.WithCancel`, `context.WithTimeout`, `context.WithDeadline`. Первый аргумент каждой I/O функции в Go.

**Context Assembly** ([Модуль 12](../12-rag/README.md))
Этап RAG-pipeline: формирование финального промпта из retrieved чанков. Включает отбор по token budget, переупорядочивание (lost in the middle mitigation), форматирование с метками источников.

**Context Manager** ([Модуль 04](../04-python/README.md))
Объект, реализующий `__enter__` и `__exit__` (или `__aenter__` / `__aexit__` для async). Используется с `with` / `async with`. Гарантирует выполнение cleanup-кода даже при исключениях.

**Context Precision** ([Модуль 09](../09-evaluator-benchmark/README.md))
Ragas метрика: доля релевантных фрагментов среди всех извлечённых контекстов. Измеряет точность retrieval. Низкий context precision → LLM получает лишний шум.

**Context Recall** ([Модуль 09](../09-evaluator-benchmark/README.md))
Ragas метрика: доля ground truth информации покрытой извлечёнными контекстами. Измеряет полноту retrieval. Низкий context recall → LLM не получила нужные факты.

**Context Window** ([Модуль 06](../06-prompt-engineering/README.md), [Модуль 12](../12-rag/README.md))
Максимальный объём токенов за один вызов: system prompt + история + ввод + генерируемый вывод. Диапазон варьируется от 32K у малых локальных моделей до единиц миллионов у флагманов. Большое окно ≠ надёжное использование данных в середине контекста: «lost in the middle» деградация хорошо задокументирована — критичный контент ближе к началу или концу промпта.

**Conv3d (DeepStack)** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Трёхмерная свёртка в vision encoder CURRENT_VLM_MODEL для нативной обработки видео. Обрабатывает пространственные (H, W) и временные (T) измерения совместно. Устраняет необходимость во внешнем frame sampler.

**copy-on-write** ([Модуль 24](../24-docker/README.md))
Механизм файловой системы контейнера: слои образа read-only. При записи файл копируется в writable layer контейнера. Исходный слой неизменён. Позволяет нескольким контейнерам делить одни слои образа.

**Coroutine (корутина)** ([Модуль 04](../04-python/README.md))
Функция, объявленная через `async def`. При вызове возвращает объект корутины, а не выполняет код. Код запускается только при `await` или через `asyncio.run()`. Основа asyncio-модели.

**Correlation ID** ([Модуль 42](../42-a2a-protocol/README.md))
Идентификатор, связывающий все вызовы одного workflow across agents. Нужен для tracing и incident investigation.

**Cosine Similarity** ([Модуль 12](../12-rag/README.md))
Мера близости двух векторов: косинус угла между ними. Диапазон от -1 до 1, для нормализованных векторов — от 0 до 1. В pgvector: `1 - (embedding <=> query_vector)`. Не зависит от длины (нормы) вектора, только от направления.

**Counter** ([Модуль 26](../26-logging/README.md))
OTel metric: монотонно возрастающее значение. Никогда не убывает. Примеры: количество запросов, ошибок, обработанных задач. `meter.createCounter()`.

**Coverage** ([Модуль 21](../21-testing/README.md))
Процент строк/ветвей кода, выполненных тестами. `hits / total lines`. Метрика отсутствия: < 60% — явная проблема, > 80% — проверяй качество assertions, а не процент. 100% coverage достижимо без единого значимого проверки.

**critical CSS** ([Модуль 29](../29-critical-css/README.md), [Модуль 36](../36-critical-rendering-path/README.md))
CSS необходимый для рендера above-fold контента: reset, :root variables, header, hero секция. Inline в `<style>` в `<head>`. Цель: < 14KB. Позволяет рендер без ожидания внешних CSS файлов.

**Cross-encoder** ([Модуль 12](../12-rag/README.md))
Архитектура reranker: обрабатывает пару (запрос, документ) совместно, выдаёт скор релевантности. Точнее bi-encoder (embedding similarity), но в N раз медленнее — требует N inference вызовов для N кандидатов.

**Cross-reference table (xref)** ([Модуль 15](../15-pdf-internals/README.md))
Таблица байтовых смещений всех объектов в PDF файле. Позволяет парсеру получить любой объект без линейного чтения. Расположена перед `%%EOF`. В incremental update — каждое обновление добавляет новый xref в конец файла.

**CrUX (Chrome User Experience Report)** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 33](../33-web-performance-api/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Google база данных: field data от реальных Chrome пользователей с opted-in sharing. 28-дневное скользящее окно, p75. Отличается от RUM: только Chrome, не включает Safari/Firefox. Используется для Page Experience Rankings.

**CSSOM (CSS Object Model)** ([Модуль 29](../29-critical-css/README.md))
Браузерное представление CSS в виде дерева. Строится параллельно с DOM, но render tree создаётся только когда оба готовы. Незавершённый CSSOM блокирует rendering — причина render-blocking.

## D

**Dataclass** ([Модуль 04](../04-python/README.md))
Декоратор `@dataclass` из модуля `dataclasses`. Автогенерирует `__init__`, `__repr__`, `__eq__` по аннотированным полям. `@dataclass(frozen=True)` — неизменяемый объект, хэшируемый. Аналог readonly class в PHP или readonly record в других языках.

**dead letter queue (DLQ)** ([Модуль 18](../18-task-queues/README.md))
Очередь для задач исчерпавших все попытки retry. BullMQ не имеет встроенного DLQ — реализуется через `worker.on('failed')` с проверкой `attemptsMade >= attempts`. Используется для анализа системных сбоев и ручного replay.

**Decode Phase** ([Модуль 08](../08-local-inference/README.md))
Вторая фаза инференса: авторегрессионная генерация токенов по одному. Скорость — TPS (tokens per second), определяется memory bandwidth GPU. На consumer GPU decode-фаза ограничена bandwidth, не FLOPS — поэтому ускорение от квантизации весомее, чем от более быстрого GPU по TFLOPS.

**Decorator** ([Модуль 02](../02-typescript/README.md))
Синтаксис `@DecoratorName` для добавления метаданных или изменения поведения класса, метода, свойства или параметра. Статус: Stage 3 TC39, в TypeScript 5.0 реализованы стандартные декораторы.

**DeepEval** ([Модуль 09](../09-evaluator-benchmark/README.md))
Python-фреймворк для LLM evaluation с pytest-совместимым API. Версия 3.9.2 (март 2026). Apache 2.0. 50+ метрик, G-Eval, поддержка локальных моделей через `DeepEvalBaseLLM`.

**DeepStack ViT** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Иерархический Vision Transformer в CURRENT_VLM_MODEL. Несколько масштабов: крупные патчи захватывают контекст, мелкие — детали. Обеспечивает лучшее OCR качества на документах со смешанными размерами шрифтов.

**defer** ([Модуль 05](../05-go/README.md))
Откладывает выполнение функции до возврата из текущей функции. Выполняется в порядке LIFO. Гарантирует cleanup даже при панике. `defer file.Close()` сразу после `Open()` — стандартный идиом. С Go 1.21 — оптимизирован, почти без overhead.

**DEFLATE** ([Модуль 14](../14-ooxml/README.md))
Алгоритм сжатия используемый в ZIP при генерации DOCX через PizZip. Параметр `compressionOptions: { level: 6 }` — баланс скорости и степени сжатия. Без явного указания PizZip может использовать `STORE` (без сжатия) — файл в 3–5× больше.

**Dense Retrieval** ([Модуль 12](../12-rag/README.md))
Поиск на основе dense-векторов (embeddings). Хорошо находит семантически близкое, плохо — точные лексические совпадения. Противопоставляется sparse retrieval (BM25).

**deoptimization (bailout)** ([Модуль 37](../37-js-performance/README.md))
V8 операция: отмена TurboFan оптимизации при нарушении предположений (изменился тип аргументов, shape объекта). Код возвращается в интерпретатор Ignition. Дороже чем никогда не оптимизировать.

**Detail Level** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Параметр OpenAI-compatible API для VLM: `"low"` / `"high"` / `"auto"`. `"high"` ≈ max_pixels высокого разрешения — для OCR и сложных документов. `"low"` ≈ экономный режим — для pre-screening и классификации.

**Difficulty Level** ([Модуль 09](../09-evaluator-benchmark/README.md))
Категоризация тест-кейсов по сложности: easy, medium, hard, edge. Используется для анализа провалов по категориям и обеспечения репрезентативности датасета. Минимум 30 кейсов на категорию для статистически значимых метрик.

**Discriminated Union** ([Модуль 02](../02-typescript/README.md))
Паттерн объединения типов с общим полем-дискриминатором. `type Shape = | { kind: 'circle'; radius: number } | { kind: 'rect'; width: number; height: number }` TypeScript автоматически сужает тип внутри `switch/if` по `kind`.

**Discriminator** ([Модуль 07](../07-json-schema/README.md))
Поле-маркер для однозначного определения типа в `oneOf`/`anyOf` схемах. Позволяет парсеру и constrained decoder выбрать нужную ветку без перебора всех вариантов.

**Document Intelligence** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Комплексный pipeline из OCR, layout detection, VLM, parsers и structured output для извлечения данных из документов, таблиц и форм.

**DOM Grounding** ([Модуль 44](../44-browser-use-computer-use/README.md))
Привязка действий агента к конкретным элементам DOM: selectors, accessibility tree, ARIA labels, screenshots.

**DOMHighResTimeStamp** ([Модуль 33](../33-web-performance-api/README.md))
Тип timestamp в Performance API: микросекундная точность, относительно `timeOrigin` страницы. `performance.now()` возвращает этот тип. Значительно точнее `Date.now()` (только миллисекунды).

**dominant color placeholder** ([Модуль 35](../35-image-optimization/README.md))
Техника placeholder: один цвет извлечённый из изображения через resize до 1×1 пикселя. Показывается как `background-color` до загрузки полного изображения. ≈50 bytes CSS. Эффективнее LQIP при большом количестве изображений (галереи).

**DrawingML** ([Модуль 14](../14-ooxml/README.md))
Современный XML-формат OOXML для векторной графики и изображений. Namespace `a:` (drawingml/2006/main). Заменил устаревший VML. Используется для вставки изображений (`a:blip`), фигур, диаграмм. Корректно поддерживается в Word, LibreOffice, Google Docs.

**Duplex Stream** ([Модуль 01](../01-javascript-nodejs/README.md))
Поток, который является одновременно Readable и Writable. Пример: TCP socket — можно читать входящие данные и писать исходящие.

**dynamic import** ([Модуль 34](../34-lazy-loading/README.md), [Модуль 40](../40-performance-budget/README.md))
ES модульный синтаксис: `import('./module')` — асинхронная загрузка модуля по требованию. Разбивает bundle на chunks. Chunk загружается только при вызове import(). Уменьшает initial bundle size.

## E

**E2E (end-to-end)** ([Модуль 21](../21-testing/README.md))
Тест, проверяющий систему целиком через внешний интерфейс (браузер, HTTP). Медленный (≈3–10s/тест), реалистичный, дорогой в поддержке. Применять только для critical user paths, не для CRUD-деталей.

**Eager init** ([Модуль 16](../16-pdfium-wasm/README.md))
Стратегия инициализации: `PDFiumLibrary.init()` вызывается при старте сервера до первого запроса. Противопоставляется lazy init. Устраняет cold start на первый запрос. Добавляет 500ms–1s к startup time приложения.

**Early Fusion** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Архитектурный подход: мультимодальные токены присутствуют с первого шага обучения. Противоположность late fusion где vision encoder и LLM обучались отдельно. В CURRENT_VLM_MODEL early fusion устраняет «шов» между визуальным и текстовым пониманием.

**Edge Inference** ([Модуль 08](../08-local-inference/README.md))
Запуск модели на устройстве пользователя или edge hardware: CPU, NPU, browser/WebGPU или локальный server. Обычно требует smaller models и строгого quality routing.

**effort (AVIF)** ([Модуль 35](../35-image-optimization/README.md))
Параметр Sharp: уровень усилий кодирования AVIF (0–9). Выше = меньше файл + медленнее кодирование. `effort: 6` — production баланс. `effort: 9` — offline batch. `effort: 4` — CI pipeline для скорости.

**Embedding** ([Модуль 12](../12-rag/README.md))
Представление текста в виде вектора фиксированной размерности в непрерывном пространстве. Семантически близкие тексты имеют близкие векторы. Размерность зависит от модели: 768, 1024, 1536, 3072 dims.

**Embedding (встраивание)** ([Модуль 05](../05-go/README.md))
Включение одного типа в другой без явного поля: `type Logger struct{ *log.Logger }` Все методы `log.Logger` доступны на `Logger` напрямую. Это **не** наследование — это делегирование. Нет иерархий классов, нет `super`, нет ромбовидного наследования.

**enable_thinking** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Параметр в `chat_template_kwargs` для LM Studio / vLLM API. `false` — эквивалент `/no_think` для управления reasoning через API. Для extraction pipeline всегда `false`.

**entity disambiguation** ([Модуль 30](../30-schema-org/README.md))
Задача: однозначно идентифицировать сущность (Person, Organization, Product) среди множества одноимённых. Инструменты: `@id` URI + `sameAs` ссылки на авторитетные источники (Wikipedia, LinkedIn, GitHub).

**Enum** ([Модуль 02](../02-typescript/README.md), [Модуль 07](../07-json-schema/README.md))
Ключевое слово JSON Schema: ограничивает значение поля списком допустимых вариантов. В constrained decoding — один из самых эффективных инструментов: grammar тривиальна, вероятность невалидного значения физически равна нулю. Предпочтительнее `string` с описанием допустимых значений в тексте промпта.

**Episodic Memory** ([Модуль 43](../43-agent-memory-knowledge-graphs/README.md))
Память событий: что произошло, когда, в каком контексте. Обычно хранится с timestamps, sourceId и session/user scope.

**Error (ошибка в Go)** ([Модуль 05](../05-go/README.md))
Встроенный интерфейс `error` с одним методом `Error() string`. Ошибки — это обычные значения, не исключения. Возвращаются явно как последнее возвращаемое значение функции. `errors.Is` — проверить тип/значение в цепочке, `errors.As` — извлечь.

**Error Handling** ([Модуль 03](../03-php/README.md))
PHP имеет два механизма: старые `E_*` ошибки (trigger_error) и современные исключения (Exception/Error). С PHP 7+ фатальные ошибки тоже можно перехватывать через `set_error_handler` и `register_shutdown_function`.

**ETag** ([Модуль 20](../20-backend-caching/README.md), [Модуль 38](../38-http-service-worker-caching/README.md))
HTTP заголовок: хэш или версия ресурса. Используется в `If-None-Match` для conditional GET. Генерировать из содержимого (SHA1/MD5 среза) или версии объекта. Сильный ETag (`"abc123"`) = byte-identical; слабый (`W/"abc123"`) = семантически эквивалентный.

**Evaluation Tier** ([Модуль 09](../09-evaluator-benchmark/README.md), [Модуль 46](../46-agentops/README.md))
Уровень evaluation pipeline с разным соотношением стоимость/качество: Tier 1 — exact metrics (каждый PR, секунды, $0); Tier 2 — LLM-as-Judge (ночной прогон, минуты, копейки при локальном судье); Tier 3 — human evaluation (pre-release, часы, дорого).

**Event Loop** ([Модуль 01](../01-javascript-nodejs/README.md), [Модуль 04](../04-python/README.md), [Модуль 16](../16-pdfium-wasm/README.md))
Однопоточный цикл обработки событий Node.js. CPU-intensive операции (рендеринг PDF) блокируют event loop — все другие запросы ждут. Worker threads выполняются параллельно без блокировки event loop.

**EventEmitter** ([Модуль 01](../01-javascript-nodejs/README.md))
Базовый класс Node.js для реализации паттерна publish/subscribe. Большинство встроенных модулей (fs, http, stream) наследуют от него. Основные методы: `.on()`, `.once()`, `.emit()`, `.off()`.

**eviction** ([Модуль 20](../20-backend-caching/README.md))
Вытеснение записей из кэша при превышении лимита (`max` или `maxSize`). LRUCache: вытесняет наименее недавно использованную запись. Redis: по политике `maxmemory-policy`. Метрика `evicted_keys` в Redis — признак недостаточного `maxmemory`.

**Exact Match** ([Модуль 09](../09-evaluator-benchmark/README.md), [Модуль 13](../13-fine-tuning/README.md))
Детерминированная метрика: 1.0 если predicted == expected (после strip()), иначе 0.0. Применима только когда ожидаемый вывод однозначен. Не требует LLM-вызовов. Основа Tier 1 evaluation — запускается на каждый коммит.

**exactly-once** ([Модуль 18](../18-task-queues/README.md))
Гарантия доставки: задача выполнится ровно один раз. Требует транзакционной атомарности между созданием задачи и бизнес-операцией. Реализуется через pg-boss с `{ tx: client }`. Redis-based очереди не поддерживают exactly-once нативно.

## F

**f-string** ([Модуль 04](../04-python/README.md))
Строковые шаблоны с встроенными выражениями: `f"Hello, {name}!"`. С Python 3.12 — поддержка многострочных выражений и вложенных кавычек внутри `{}`. С Python 3.14 — добавлены **t-strings** (template strings) как расширение f-strings для кастомных форматтеров.

**fail closed** ([Модуль 23](../23-rate-limiting/README.md))
Стратегия поведения при недоступности Redis: блокировать все запросы. Максимальная безопасность, минимальная доступность. Применимо для аутентификации и финансовых операций — не для публичного API.

**fail open** ([Модуль 23](../23-rate-limiting/README.md))
Стратегия поведения при недоступности Redis: пропускать все запросы. Сервис работает, но без защиты. Компромисс — insurance limiter: in-memory fallback с теми же ограничениями.

**Failover** ([Модуль 11](../11-multi-model-orchestration/README.md))
Переключение на резервный ресурс при отказе основного. В контексте LLM-pipeline — переключение на другой API key или модель при HTTP 429 / исчерпании квоты.

**Failure Rate** ([Модуль 09](../09-evaluator-benchmark/README.md))
Доля тест-кейсов с score ниже установленного порога (например, < 0.5). Более информативен чем mean score для обнаружения системных провалов. Модель с mean 0.85 и failure rate 15% неприемлема для production.

**Faithful Hallucination** ([Модуль 12](../12-rag/README.md))
Тип ошибки LLM в RAG: модель генерирует ответ внешне согласованный с контекстом, но содержащий факты отсутствующие в retrieved чанках. Диагностируется LLM-judge — отдельным вызовом LLM для верификации.

**Faithfulness** ([Модуль 09](../09-evaluator-benchmark/README.md))
Ragas метрика: степень поддержки ответа извлечёнными контекстами. Значение 1.0 означает что каждый факт в ответе поддерживается контекстом. Не измеряет правильность контекста — только консистентность ответа с ним.

**fetchMethod** ([Модуль 20](../20-backend-caching/README.md))
Опция LRUCache: async функция вызываемая при `cache.fetch()` когда ключ отсутствует или устарел. Гарантирует что конкурентные `fetch()` на один ключ выполняют один реальный вызов. Основной механизм stampede protection в in-process кэше.

**fetchpriority** (Модули 28, 34–35, 39)
HTML атрибут (`high`/`low`/`auto`): подсказка браузеру о приоритете загрузки ресурса. Baseline 2023. Один `fetchpriority="high"` на LCP image улучшает LCP на 20-30%. Нельзя ставить на несколько элементов — конкурируют.

**Few-shot Prompting** ([Модуль 06](../06-prompt-engineering/README.md))
Передача 2–10 примеров вход/выход в промпте для демонстрации ожидаемого паттерна. Обучает модель формату без fine-tuning. Токены примеров входят в context window. Качество примеров критично: один неудачный пример портит поведение сильнее, чем их отсутствие.

**field data** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 33](../33-web-performance-api/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Данные от реальных пользователей в реальных условиях (устройства, сети, локации). Источник: CrUX. Отличается от lab data: включает third-party scripts, кеш, медленные устройства. Только field data влияет на Google Rankings.

**Field-Level Accuracy** ([Модуль 09](../09-evaluator-benchmark/README.md))
Метрика для extraction задач: точность по каждому полю схемы отдельно. Позволяет обнаружить что конкретное поле (например, адрес) всегда ошибается при общем высоком mean score. Основная метрика для structured extraction pipeline.

**Fine-tuning** ([Модуль 13](../13-fine-tuning/README.md))
Дообучение предобученной модели на специализированном датасете для адаптации поведения к конкретной задаче или домену. Изменяет веса модели. Три варианта: full fine-tuning (все веса), PEFT (подмножество параметров), LoRA/QLoRA (адаптеры низкого ранга).

**Fixed Window** ([Модуль 23](../23-rate-limiting/README.md))
Алгоритм rate limiting: счётчик сбрасывается по фиксированному таймеру. O(1) память. Уязвим к window boundary attack: злоумышленник делает burst в конце одного окна и начале следующего — реальный burst = 2× лимита.

**Flash Attention** ([Модуль 08](../08-local-inference/README.md))
Оптимизированная реализация механизма attention: IO-aware алгоритм, снижающий потребление VRAM и ускоряющий prefill-фазу. В llama.cpp включается флагом `-fa` / `--flash-attn`. Поддерживается не всеми архитектурами моделей и не всеми версиями CUDA/Metal. Даёт наибольший эффект при длинных контекстах (>8K токенов). На Turing GPU (GTX 1660) эффект меньше чем на Ampere/Ada.

**focus trap** ([Модуль 32](../32-accessibility/README.md))
Механизм: Tab навигация «захвачена» внутри контейнера (modal, dialog). Пользователь Tab-ает внутри, не выходит за границы. Обязателен для modal окон. `<dialog>.showModal()` реализует нативно.

**FOUC (Flash of Unstyled Content)** ([Модуль 29](../29-critical-css/README.md), [Модуль 36](../36-critical-rendering-path/README.md))
Визуальный эффект: страница появляется без стилей (белая/несверстанная) на долю секунды до загрузки CSS. Происходит при неправильном async loading — стили применяются после initial render.

**FPM (FastCGI Process Manager)** ([Модуль 03](../03-php/README.md))
Менеджер PHP-процессов для продакшн веб-сервинга. Управляет пулами процессов, их количеством, таймаутами. Nginx + PHP-FPM — стандартная связка для PHP-сайтов.

**Frame Sampling** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Стратегия выбора кадров видео для подачи в VLM. Параметр `fps` определяет частоту сэмплинга. Формула токен-бюджета: `fps × duration_sec × tokens_per_frame`.

**Free-threaded mode (No-GIL)** ([Модуль 04](../04-python/README.md))
Экспериментальный режим Python 3.13 (PEP 703), официальная поддержка в Python 3.14 (PEP 779) — запуск без GIL. Позволяет потокам выполняться по-настоящему параллельно на разных ядрах CPU. Включается сборкой Python с флагом `--disable-gil`.

**Function Calling (Tool Use)** ([Модуль 06](../06-prompt-engineering/README.md))
Механизм, при котором модель генерирует структурированный вызов инструмента вместо текста. Runtime исполняет функцию, результат возвращается в контекст следующим сообщением. Стандартизирован у всех крупных провайдеров; для локальных моделей реализуется через chat template с `<tool_call>` тегами или JSON Schema grammar. Не гарантирует валидность аргументов — валидация на стороне вызывающего кода обязательна.

**Functools** ([Модуль 04](../04-python/README.md))
Стандартный модуль с утилитами для работы с функциями: `functools.lru_cache` — мемоизация, `functools.partial` — частичное применение, `functools.reduce` — свёртка, `functools.wraps` — сохранение метаданных декорируемой функции.

## G

**G-Eval** ([Модуль 09](../09-evaluator-benchmark/README.md))
Паттерн LLM-оценки с явным chain-of-thought: судья описывает шаги оценки перед выставлением итоговой оценки. Снижает variance по сравнению с прямым scoring. Реализован нативно в DeepEval 3.9.2.

**Garbage Collection (GC)** ([Модуль 01](../01-javascript-nodejs/README.md))
автоматическое управление памятью в V8. Освобождает объекты, на которые нет ссылок. В Node.js — поколенческий GC, который может вызывать паузы (STW). Утечки памяти = объекты, на которые остаётся ссылка дольше нужного.

**Gate model** ([Модуль 11](../11-multi-model-orchestration/README.md))
Первая модель в Cascade Filter. Критерии выбора: минимальная latency, достаточный recall для целевого признака, низкая стоимость вызова (локальная, маленькая). Качество gate определяет полноту данных в output pipeline.

**Gated DeltaNet** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Линейный attention механизм в CURRENT_VLM_MODEL (часть Hybrid Attention). Сложность O(n) против O(n²) у стандартного attention. Обеспечивает эффективную обработку длинных контекстов (262K+).

**GBNF (GGML BNF)** (Модули 07–08)
Формат описания грамматики для llama.cpp — расширение EBNF под нужды LLM inference. Используется для grammar sampling: генерации по произвольным грамматикам, не только JSON Schema. Позволяет описать любой формат вывода: CSV, XML, кастомный DSL. JSON Schema транслируется в GBNF автоматически библиотеками типа llama-cpp-python и LM Studio.

**Generator** ([Модуль 03](../03-php/README.md))
Функция с `yield`, возвращающая значения по одному без загрузки всего набора в память. Аналог Streams в Node.js для итерации по большим данным. Реализует `Iterator` интерфейс.

**Generic (Обобщение)** ([Модуль 02](../02-typescript/README.md))
Параметризованный тип, работающий с разными типами данных без потери информации о типах. `Array<T>`, `Promise<T>` — примеры встроенных дженериков. Основа переиспользуемых компонентов.

**Generics** ([Модуль 05](../05-go/README.md))
параметризованные типы в Go 1.18+. Позволяют писать функции и типы с произвольным типом: `func Fn[T any](arg T) T`. Go 1.24 добавил generic type aliases.

**Glyph ID** ([Модуль 15](../15-pdf-internals/README.md))
Числовой идентификатор символа в шрифте. PDF хранит текст как последовательность Glyph ID, не Unicode. Маппинг Glyph ID → Unicode выполняется через ToUnicode CMap или стандартные кодировки. Отсутствие корректного маппинга = text extraction возвращает мусор.

**Goroutine** ([Модуль 05](../05-go/README.md))
Легковесный поток управляемый Go runtime. Стартовый стек ≈2KB (против ≈1MB у OS-потоков). Runtime мультиплексирует тысячи горутин на небольшое число OS-потоков. `go func()` — запустить горутину. Стоимость создания настолько мала, что одна горутина на запрос — стандартная архитектура.

**GPU Offloading (n_gpu_layers)** ([Модуль 08](../08-local-inference/README.md))
Параметр llama.cpp: количество слоёв трансформера, загруженных в VRAM. `-ngl -1` или `--n-gpu-layers 999` — загрузить всё что помещается. Слои сверх VRAM остаются в RAM и обрабатываются CPU — резко снижая TPS. Правило: частичный offload с CPU fallback даёт ≈5-20x меньше TPS чем полный GPU. Для GTX 1660 6 Гб: compact Q4_K_M model может помещаться полностью, local-mid model — часто частично.

**Graceful Shutdown** ([Модуль 01](../01-javascript-nodejs/README.md), [Модуль 18](../18-task-queues/README.md))
Корректное завершение процесса: дать воркерам закончить текущие задачи, затем закрыть соединения. В BullMQ: `worker.close()` ждёт завершения активных задач. Без graceful shutdown — активные задачи становятся stalled и перезапускаются.

**Gradient checkpointing** ([Модуль 13](../13-fine-tuning/README.md))
Техника снижения потребления VRAM: активации не сохраняются между слоями, а перевычисляются при backprop. Режим `"unsloth"` в Unsloth даёт ≈30% экономию VRAM при ≈20% росте времени обучения.

**Grammar Sampling** ([Модуль 07](../07-json-schema/README.md))
Механизм constrained decoding в llama.cpp: на каждом шаге генерации применяется конечный автомат грамматики, маскируя недопустимые токены. Производительность зависит от сложности грамматики: простой `enum` — минимальный overhead, глубоко вложенные `anyOf` со `$ref` — заметное замедление из-за размера автомата.

**Graph RAG** ([Модуль 12](../12-rag/README.md), [Модуль 45](../45-agentic-rag-graph-rag/README.md))
RAG, использующий knowledge graph: entities, relations, communities, paths. Полезен для multi-hop вопросов и объяснимости.

**Grounding** ([Модуль 06](../06-prompt-engineering/README.md), [Модуль 10](../10-prompt-engineering-vlm/README.md))
Привязка ответа модели к конкретным источникам: документам, БД, API. Снижает hallucination за счёт того, что модель отвечает на основе переданного контекста, а не параметрических знаний. RAG — основная архитектурная реализация grounding.

**Guardrail** ([Модуль 46](../46-agentops/README.md))
Policy check перед или после agent action: schema, PII, secrets, forbidden tools, cost, prompt injection.

## H

**HALF-OPEN state** ([Модуль 19](../19-http-clients/README.md))
Промежуточное состояние circuit breaker: после `resetTimeout` пропускается один пробный запрос. Успех → CLOSED. Сбой → OPEN снова. Механизм автоматического восстановления без ручного вмешательства.

**Hallucination** ([Модуль 06](../06-prompt-engineering/README.md))
Генерация фактически неверной информации с уверенным тоном. Механизм: модель предсказывает наиболее вероятный токен в контексте, а не «правду». Системно снижается через grounding, CoT с верификацией, low temperature. Полностью не устраняется никакими техниками промптинга — только измеряется и контролируется.

**Hallucination Cascade** ([Модуль 45](../45-agentic-rag-graph-rag/README.md))
Цепочка ошибок, когда неверный результат одного шага приводит к новым неверным retrieval/generation шагам.

**header row** ([Модуль 17](../17-xlsx-internals/README.md))
Первая строка листа используемая как ключи при `XLSX.utils.sheet_to_json()` (SheetJS) и при ручном парсинге. При multiple header rows (2–3 строки заголовков как в 1С) — стандартные API не справляются, нужен кастомный парсер.

**Headless Daemon** ([Модуль 08](../08-local-inference/README.md))
Серверный процесс без GUI. В контексте LM Studio 0.4.x — `llmster`, устанавливаемый отдельно от GUI через `curl -fsSL https://lmstudio.ai/install.sh | bash`. Позволяет использовать LM Studio в server-side окружении без графического интерфейса.

**healthcheck** ([Модуль 24](../24-docker/README.md))
Инструкция Dockerfile / директива Compose: команда проверки готовности сервиса. Параметры: `interval`, `timeout`, `retries`, `start_period`. Используется `depends_on: condition: service_healthy`. Без healthcheck Compose считает сервис готовым сразу после запуска.

**Heap** ([Модуль 01](../01-javascript-nodejs/README.md))
Область памяти V8 для хранения объектов. Управляется сборщиком мусора. Утечки памяти — это объекты в Heap, на которые сохраняются ненужные ссылки (глобальные переменные, незакрытые подписки EventEmitter).

**Histogram** ([Модуль 26](../26-logging/README.md))
OTel metric: распределение значений по bucket boundaries. Используется для latency, размеров файлов. Позволяет вычислять p50/p95/p99. `advice.explicitBucketBoundaries` — явно задать границы для точности.

**HNSW (Hierarchical Navigable Small World)** ([Модуль 12](../12-rag/README.md))
Алгоритм построения ANN-индекса на основе многоуровневого графа близости. Быстрый поиск O(log N), высокий recall (≈0.95+), высокое потребление памяти при построении. Параметры: `m` (число связей), `ef_construction`, `ef_search`.

**Hybrid Attention** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Архитектура attention в CURRENT_VLM_MODEL: комбинация Gated DeltaNet (линейный) и Gated Attention (стандартный). Линейный — для длинных последовательностей, стандартный — для задач требующих точного matching. Позволяет одновременно обрабатывать длинный контекст и сложные визуальные паттерны.

**Hybrid Reasoning Mode** ([Модуль 06](../06-prompt-engineering/README.md))
Режим работы модели с переключением между thinking и non-thinking на лету. Позволяет экономить токены на простых задачах и включать глубокое рассуждение только когда это оправдано. Реализуется через параметры генерации (`enable_thinking=True/False`) или специальные теги в промпте (`/think`, `/no_think`). В thinking mode оптимальны низкие значения temperature и top_p; в non-thinking — стандартные. Конкретные значения зависят от модели — см. раздел «Актуальные версии».

**Hybrid Search** ([Модуль 12](../12-rag/README.md))
Комбинация dense retrieval (embeddings) и sparse retrieval (BM25). Результаты объединяются через RRF или взвешенную сумму скоров. Необходим когда корпус содержит точные идентификаторы: коды, номера договоров, даты.

**HyDE (Hypothetical Document Embedding)** ([Модуль 12](../12-rag/README.md))
Техника улучшения retrieval: LLM генерирует гипотетический документ-ответ на запрос, его вектор используется для поиска вместо вектора самого запроса. Устраняет query-document mismatch для коротких запросов.

## I

**idempotency key** ([Модуль 23](../23-rate-limiting/README.md))
Заголовок (`Idempotency-Key`) позволяющий клиенту безопасно повторить запрос. Сервер хранит результат по ключу: повторный запрос возвращает сохранённый результат, не выполняет операцию заново. Связан с rate limiting: ретрай не должен тратить дополнительные токены.

**idempotent processor** ([Модуль 18](../18-task-queues/README.md))
Processor который можно выполнить несколько раз с одними данными без побочных эффектов. Обязателен при at-least-once семантике: при retry одна и та же задача выполняется повторно. Техника: проверять `documentId` в БД перед обработкой, использовать `jobId` как идемпотентный ключ.

**Image-only PDF** ([Модуль 15](../15-pdf-internals/README.md))
PDF где страницы — растровые изображения без текстового слоя. Text extraction возвращает пустую строку. Требует рендер → OCR или рендер → VLM pipeline. Источник: сканер без OCR, фотография документа.

**immutable** ([Модуль 38](../38-http-service-worker-caching/README.md))
`Cache-Control` директива: браузер никогда не revalidate ресурс. Безопасно только для ресурсов с content hash в URL. При изменении контента без смены URL — пользователи получают stale навсегда.

**In-context Learning (ICL)** ([Модуль 06](../06-prompt-engineering/README.md))
Способность модели адаптировать поведение на основе примеров в текущем промпте без изменения весов. Few-shot — частный случай ICL. Механизм до конца не изучен; эмпирически: качество примеров важнее количества, убывающая отдача после ≈10 примеров.

**Incremental Re-indexing** ([Модуль 12](../12-rag/README.md))
Стратегия обновления индекса: переиндексация только изменённых документов по `updated_at`. Противопоставляется full re-indexing. Требует версионирования документов и детекции изменений.

**Incremental update** ([Модуль 15](../15-pdf-internals/README.md))
Механизм добавления изменений в PDF путём дописывания в конец файла без перезаписи. Каждое обновление добавляет новые объекты и xref. PDF с многими incremental updates может содержать устаревшие объекты. Число обновлений = число `%%EOF` минус один.

**Indirect Prompt Injection** ([Модуль 47](../47-ai-security-agents/README.md))
Вредная инструкция, попавшая в модель через retrieved document, website, email или другой untrusted source.

**Inference (Вывод типов)** ([Модуль 02](../02-typescript/README.md))
Автоматическое определение типа компилятором без явной аннотации. `const x = 42` → TypeScript выводит тип `number`. Хороший код использует inference там, где тип очевиден.

**Inference Backend** ([Модуль 08](../08-local-inference/README.md))
Программный стек, выполняющий forward pass модели: llama.cpp, vLLM, ExLlamaV2, MLC LLM. LM Studio и Ollama — надстройки над llama.cpp (преимущественно). Поведение модели на одном backend не гарантирует идентичное поведение на другом — различается применение chat template, обработка параметров, KV-cache стратегия.

**INP (Interaction to Next Paint)** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Core Web Vital с марта 2024 (заменил FID): время от user interaction до следующего paint. Порог «хорошо»: ≤ 200ms. Измеряет worst-case interaction за сессию (75-я перцентиль). Три компонента: input delay + processing time + presentation delay.

**Instruction Following** ([Модуль 06](../06-prompt-engineering/README.md))
Способность модели выполнять инструкции из system prompt. Определяется качеством RLHF/RLAIF при обучении. Модели со слабым instruction following игнорируют ограничения при длинных промптах или при конфликте system/user инструкций.

**Instruction tuning** ([Модуль 13](../13-fine-tuning/README.md))
Тип fine-tuning: обучение модели следовать явным инструкциям в специфичном домене или формате. Датасет: пары (инструкция, ожидаемый ответ). Результат: модель предсказуемо следует инструкциям там где базовая модель вариативна.

**insurance limiter** ([Модуль 23](../23-rate-limiting/README.md))
Паттерн rate-limiter-flexible: RateLimiterMemory как fallback при недоступности Redis. Активируется при `instanceof Error` в `catch` блоке. Разные инстанции приложения не синхронизируются между собой — лимит применяется per-process, не globally.

**Integration test** ([Модуль 21](../21-testing/README.md))
Тест, проверяющий взаимодействие нескольких компонентов с реальными зависимостями (БД, HTTP, файловая система). Оптимальное соотношение confidence/cost для большинства Node.js сервисов.

**Interface** ([Модуль 02](../02-typescript/README.md), [Модуль 05](../05-go/README.md))
Набор методов, неявно реализуемый любым типом. Структурная типизация — нет ключевого слова `implements`. Маленькие интерфейсы лучше больших: `io.Reader` (1 метод), `io.Writer` (1 метод), `io.Closer` (1 метод). Философия Go: *«Accept interfaces, return structs»*.

**Interface (PHP)** ([Модуль 03](../03-php/README.md))
Контракт, определяющий набор методов без реализации. Класс может реализовывать несколько интерфейсов (`implements`). В отличие от TypeScript — номинальная типизация: класс должен явно объявить `implements InterfaceName`.

**IntersectionObserver** ([Модуль 34](../34-lazy-loading/README.md))
Web API: асинхронное наблюдение за пересечением элементов с viewport или указанным контейнером. Основа для lazy loading CSS backgrounds и кастомных компонентов. Не блокирует main thread в отличие от scroll событий.

**invalidatePattern** ([Модуль 20](../20-backend-caching/README.md))
Инвалидация ключей по паттерну через `SCAN` + `DEL`. Не использовать `KEYS` — блокирует Redis. Паттерн: `prefix:*`. Итеративный обход с `COUNT 100` за итерацию — не блокирует event loop Redis.

**IPC (Inter-Process Communication)** ([Модуль 22](../22-worker-threads/README.md))
Механизм передачи данных между `child_process` и родительским процессом: `process.send()` / `child.on('message')`. Данные сериализуются через JSON или fd. В отличие от worker_threads — разные OS процессы без общей памяти.

**ISR (Incremental Static Regeneration)** ([Модуль 27](../27-static-site/README.md))
Гибридная стратегия: страница генерируется статически, но периодически перестраивается без full rebuild. `revalidate: N` — время жизни кеша в секундах. При истечении: страница остаётся в кеше (stale) пока фоново генерируется новая версия.

**Iterator Protocol** ([Модуль 04](../04-python/README.md))
Объект, реализующий `__iter__()` и `__next__()`. `__iter__` возвращает сам объект, `__next__` возвращает следующее значение или бросает `StopIteration`. Основа всех циклов `for` в Python.

**IVFFlat** ([Модуль 12](../12-rag/README.md))
Альтернативный ANN-алгоритм: кластеризует векторы, поиск ограничивается `probes` кластерами. Быстрое построение, меньше памяти, ниже recall чем HNSW. Требует предварительного обучения (VACUUM ANALYZE в pgvector).

## J

**JBIG2** ([Модуль 15](../15-pdf-internals/README.md))
Формат сжатия бинарных изображений в PDF. Высокая степень сжатия для чёрно-белых сканов. Как CCITTFax — признак сканированного документа.

**JIT (Just-In-Time Compiler)** ([Модуль 03](../03-php/README.md))
компилятор в PHP 8+, транслирующий байткод в машинный код во время выполнения. Улучшен в PHP 8.4. Даёт прирост для CPU-интенсивных операций. Включается через `opcache.jit=tracing`.

**job** ([Модуль 25](../25-cicd/README.md))
Единица выполнения в GitHub Actions: набор steps, запускаемых на одном runner. Каждый job — изолированная VM. Данные между jobs — только через artifacts или outputs. Параллелен с другими jobs если нет `needs` зависимостей.

**JPEG XL (JXL)** ([Модуль 35](../35-image-optimization/README.md))
Новый формат с ≈40–60% преимуществом над JPEG. Safari поддерживает с 2022, Chrome — нет (2026). Рекомендуется только для архивного хранения и high-end photography. Не использовать для web delivery в 2026.

**JSON Mode** (Модули 06–07)
Режим генерации, ограничивающий вывод валидным JSON через logit bias. Реализован у большинства API-провайдеров: `response_format: {type: "json_object"}`. Гарантирует валидный JSON, не соответствие конкретной схеме. Менее надёжен, чем constrained decoding — модель всё ещё может добавить неожиданные поля или изменить типы. Для строгого соответствия схеме — использовать `json_schema` тип.

**JSON Schema** ([Модуль 07](../07-json-schema/README.md))
Словарь для описания и валидации структуры JSON-документов (спецификация IETF). Актуальные версии: Draft 7, Draft 2019-09, Draft 2020-12. Провайдеры LLM API чаще всего ориентируются на Draft 7 с частичной поддержкой 2020-12. Ключевое ограничение в контексте structured output: не все ключевые слова поддерживаются при constrained decoding — проверяй совместимость с конкретным backend.

**JSON-LD** ([Модуль 27](../27-static-site/README.md))
Формат structured data для поисковиков. `<script type="application/ld+json">` в head. Schema.org типы: Article, Product, BreadcrumbList, FAQPage. Влияет на rich snippets в результатах поиска.

**JSON-LD (JSON for Linked Data)** ([Модуль 30](../30-schema-org/README.md))
Формат structured data: JSON расширенный механизмом `@context` для связывания данных с онтологиями. Предпочтительный формат Google. Единственный формат разрешённый в `<body>` (у остальных только `<head>`).

## K

**Key Rotation** ([Модуль 11](../11-multi-model-orchestration/README.md))
Паттерн последовательного перебора API ключей с отслеживанием остатка квоты каждого. Используется когда поведение API идентично для всех ключей, различается только quota state. Требует timezone-aware сброс счётчиков.

**keyboard navigation** ([Модуль 32](../32-accessibility/README.md))
Управление интерфейсом только клавиатурой без мыши. Требование для пользователей с motor disabilities и многих screen reader пользователей. WCAG требует доступность всего интерфейса через keyboard.

**keyPrefix** ([Модуль 23](../23-rate-limiting/README.md))
Namespace для Redis-ключей в rate-limiter-flexible. Формат: `rl:{service}:{limiterName}`. Обязателен при shared Redis между сервисами — предотвращает коллизии счётчиков.

**keyspace_hits / keyspace_misses** ([Модуль 20](../20-backend-caching/README.md))
Метрики Redis INFO: суммарное число попаданий и промахов с момента запуска (или последнего `CONFIG RESETSTAT`). Используются для расчёта hit rate. Сбрасываются командой `CONFIG RESETSTAT`.

**Knowledge Graph** ([Модуль 30](../30-schema-org/README.md), [Модуль 43](../43-agent-memory-knowledge-graphs/README.md))
База знаний Google об объектах реального мира и их связях. Наполняется из structured data, Wikipedia, официальных источников. Влияет на Knowledge Panel, rich results, AI Overview ответы.

**KV-Cache** ([Модуль 08](../08-local-inference/README.md))
Кэш key-value пар attention механизма для уже обработанных токенов. Позволяет не пересчитывать attention для prefix промпта при каждом запросе. В llama.cpp: `--cache-prompt` включает переиспользование KV-cache между запросами с общим prefix. Размер: `2 × n_layers × n_kv_heads × head_dim × n_ctx × bytes_per_element`. Flash Attention снижает пиковое потребление памяти KV-cache во время prefill.

## L

**lab data** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 33](../33-web-performance-api/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Данные из контролируемой тестовой среды (Lighthouse, PageSpeed Insights): фиксированное устройство, сеть, без extensions. Воспроизводимо. Не отражает реальный опыт пользователей, не влияет на Rankings напрямую.

**Late Fusion** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Архитектурный подход предшественников CURRENT_VLM_MODEL: vision encoder и LLM обучались раздельно, затем стыковались через проекционный слой. Источник галлюцинаций на нестандартных изображениях из-за несоответствия пространств.

**layout thrashing** (Модули 36–37)
Антипаттерн: чередование DOM read (offsetWidth, getBoundingClientRect) и DOM write (style изменения) в одном sync block. Каждое read после write вызывает принудительный synchronous layout. Решение: batch reads отдельно от writes.

**lazy import waterfall** ([Модуль 34](../34-lazy-loading/README.md))
Антипаттерн: цепочка вложенных dynamic import — модуль A загружает модуль B который загружает модуль C. Три sequential network requests вместо одного. Критично при медленном соединении.

**Lazy init** ([Модуль 16](../16-pdfium-wasm/README.md))
Стратегия инициализации: `PDFiumLibrary.init()` откладывается до первого реального запроса. Реализуется через кэширование Promise: повторные вызовы получают тот же Promise без повторной инициализации. Первый запрос ощущает cold start.

**LCP (Largest Contentful Paint)** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Core Web Vital: время до рендера наибольшего visible элемента в viewport. Порог «хорошо»: ≤ 2.5s. Subparts: TTFB + resource load delay + resource load duration + element render delay.

**Leaky Bucket** ([Модуль 23](../23-rate-limiting/README.md))
Алгоритм rate limiting: входящие запросы накапливаются в очереди, обрабатываются с фиксированной скоростью. Гарантирует равномерный выходной поток. Burst легитимных запросов отклоняется при заполненной очереди. Применим для защиты downstream сервисов.

**Letterbox Resize** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Resize изображения с сохранением aspect ratio и добавлением padding до целевого размера. Стандартный pre-processing для VLM: предотвращает distortion символов. Padding цвет для документов: белый (255, 255, 255).

**LLM-as-Judge** ([Модуль 09](../09-evaluator-benchmark/README.md))
Паттерн evaluation: отдельная LLM оценивает качество вывода основной модели. Три схемы: absolute scoring, pairwise comparison, reference-based scoring. Требует калибровки против human labels перед использованием в CI/CD.

**LoAF (Long Animation Frame)** ([Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Performance API entry type (Baseline 2024): событие когда rendering frame занял > 50ms. Содержит `scripts[]` с `sourceURL`, `invokerType`, `sourceFunctionName`. Заменил Long Tasks API для INP диагностики.

**Logit Bias** (Модули 06–07)
Прямое добавление значений к логитам конкретных токенов перед softmax. Положительное значение — увеличивает вероятность токена, отрицательное — снижает. `-100` физически запрещает токен. Используется в JSON mode, для фильтрации нежелательного вывода, управления форматом. В большинстве API: `{"token_id": bias_value}`.

**Long Task** ([Модуль 28](../28-core-web-vitals-intro/README.md))
Задача на main thread > 50ms. Блокирует браузер от обработки пользовательских взаимодействий. Главная причина плохого INP. Видны в DevTools Performance → Long Tasks секция.

**LoRA (Low-Rank Adaptation)** ([Модуль 13](../13-fine-tuning/README.md))
PEFT метод: обновление весов аппроксимируется произведением двух малых матриц \Delta W = BA где ранг r \ll \min(d,k). Обучаются только матрицы A и B. Базовые веса заморожены. После обучения адаптер может быть смержен с базовой моделью без оверхеда при инференсе.

**LRU (Least Recently Used)** ([Модуль 20](../20-backend-caching/README.md))
Алгоритм вытеснения: при превышении лимита удаляется запись к которой дольше всего не обращались. Эффективен для рабочих множеств (working set): часто используемые данные остаются, редкие вытесняются.

## M

**Maglev** ([Модуль 37](../37-js-performance/README.md))
V8 mid-tier JIT компилятор (добавлен 2023): быстрая компиляция горячего кода (≈100 вызовов). Между Ignition и TurboFan. Значительно ускоряет числовые операции без ожидания полной TurboFan оптимизации.

**manualChunks** ([Модуль 34](../34-lazy-loading/README.md), [Модуль 40](../40-performance-budget/README.md))
Vite/Rollup конфиг: явное управление разбивкой bundle на chunks. Позволяет вынести vendor библиотеки в отдельные файлы с долгим кешем. Риск: circular dependencies между chunks → runtime error.

**Map** ([Модуль 05](../05-go/README.md))
Встроенная хэш-таблица. С Go 1.24 — новая реализация на основе Swiss Tables: быстрее итерация и поиск, меньше памяти. Не потокобезопасна — для конкурентного доступа используй `sync.Map` или мьютекс. Нулевое значение — `nil`, запись в nil map — паника.

**matrix strategy** ([Модуль 25](../25-cicd/README.md))
Параметризованный запуск одного job с разными значениями. `matrix: { node: [20, 22, 24] }` создаёт 3 параллельных job. Поддерживает несколько измерений: OS × Node версия.

**MCP Server** ([Модуль 41](../41-mcp-tool-server-architecture/README.md))
Сервис, предоставляющий tools/resources/prompts через Model Context Protocol. Хороший MCP server является security boundary, а не просто proxy к API.

**media print trick** ([Модуль 29](../29-critical-css/README.md))
Паттерн async CSS loading: `<link rel="stylesheet" media="print" onload="this.media='all'">`. `media="print"` — браузер загружает с низким приоритетом без блокировки render. После загрузки `onload` меняет media на `all` — стили применяются. Требует `<noscript>` fallback.

**media query** ([Модуль 31](../31-mobile-first-css/README.md))
CSS механизм: стили применяются на основе характеристик viewport (ширина, высота, orientation, prefers-*). В mobile-first — только `min-width`. Для компонентов предпочтительнее container queries.

**media="print" trick** ([Модуль 36](../36-critical-rendering-path/README.md))
Паттерн async CSS loading: `<link rel="stylesheet" media="print" onload="this.media='all'">`. Браузер загружает CSS с низким приоритетом (не блокирует рендер), onload переключает на `all` — стили применяются.

**Memory Controller** ([Модуль 43](../43-agent-memory-knowledge-graphs/README.md))
Архитектурный слой между агентом и memory stores. Отвечает за write/retrieve/update/forget/explain.

**Memory Poisoning** ([Модуль 47](../47-ai-security-agents/README.md))
Запись ложного или вредного факта в долгосрочную память агента.

**Merge (LoRA merge)** ([Модуль 13](../13-fine-tuning/README.md))
Операция слияния обученного LoRA адаптера с базовой моделью: `W_merged = W + B×A×(alpha/r)`. Результат — полная модель без необходимости загружать адаптер отдельно. Обязателен перед экспортом в GGUF.

**MessagePack / CBOR** ([Модуль 20](../20-backend-caching/README.md))
Бинарные форматы сериализации. Компактнее JSON на 20–40%, быстрее сериализации/десериализации на 30–50%. Альтернатива JSON для больших объектов в Redis. npm: `msgpackr` (MessagePack), `cbor-x` (CBOR).

**Metaclass** ([Модуль 04](../04-python/README.md))
Класс классов — определяет поведение при создании нового класса. `type` — стандартная метаклассовая фабрика. Используется в ORMах (Django, SQLAlchemy) для магии декларативных моделей. Инструмент для фреймворков, не для бизнес-кода.

**Microdata** ([Модуль 30](../30-schema-org/README.md))
Формат structured data: атрибуты (`itemscope`, `itemtype`, `itemprop`) встроены в HTML теги. Поддерживается Google, но не рекомендован — смешивает структуру и контент.

**MMR (Maximum Marginal Relevance)** ([Модуль 12](../12-rag/README.md))
Алгоритм отбора чанков: максимизирует релевантность запросу и минимизирует сходство с уже выбранными. Параметр `lambda` (0–1): 0 = максимальное разнообразие, 1 = максимальная релевантность. Снижает дублирование в контексте.

**mobile-first** ([Модуль 31](../31-mobile-first-css/README.md))
CSS методология: базовые стили для минимального экрана, `min-width` media queries добавляют сложность для больших экранов. Соответствует progressive enhancement принципу.

**Model Gateway** ([Модуль 11](../11-multi-model-orchestration/README.md))
Централизованный слой routing между application/agent и LLM providers. Отвечает за выбор модели, fallback pools, rate limits, output normalization, cost/latency/quality monitoring.

**Model Rotation** ([Модуль 11](../11-multi-model-orchestration/README.md))
Паттерн переключения между моделями при исчерпании квоты или ошибке. Сложнее Key Rotation: поведение, качество и формат ответа могут отличаться между моделями. Требует `outputNormalizer` и логирования переключений.

**Model Routing** ([Модуль 11](../11-multi-model-orchestration/README.md))
Статическое направление запросов к разным моделям по типу задачи (текст → модель A, vision → модель B). Не предполагает fallback. Простейший случай multi-model, не требует quota management.

**Model Version (embedding)** ([Модуль 12](../12-rag/README.md))
Идентификатор версии embedding модели, сохраняемый вместе с каждым вектором. Необходим при обновлении модели: векторы разных моделей несовместимы, поиск по смешанному индексу даёт некорректные результаты.

**Modelfile** ([Модуль 08](../08-local-inference/README.md))
Конфигурационный файл Ollama: декларативное описание модели. Содержит базовую модель (`FROM`), system prompt (`SYSTEM`), параметры (`PARAMETER`), кастомный chat template (`TEMPLATE`). Аналог Dockerfile для LLM.

**Module** ([Модуль 05](../05-go/README.md))
Единица дистрибуции и версионирования Go-кода. Набор пакетов с общим `go.mod`. Семантическое версионирование: модули v2+ должны иметь `/v2` суффикс в пути импорта.

**modulepreload** ([Модуль 34](../34-lazy-loading/README.md))
`<link rel="modulepreload">`: загрузка ES модуля с parse/compile на ранней стадии. Эффективнее чем `prefetch` для JS чанков — браузер сразу парсит, не только скачивает.

**Multiprocessing** ([Модуль 04](../04-python/README.md))
Стандартный модуль для запуска кода в отдельных OS-процессах. Каждый процесс — отдельный Python интерпретатор с отдельной памятью. Обходит GIL. Данные передаются через `Queue`, `Pipe` или shared memory (`multiprocessing.shared_memory`).

**Mutex (sync.Mutex)** ([Модуль 05](../05-go/README.md))
Мьютекс для защиты разделяемых данных. `mu.Lock()` / `mu.Unlock()` или `defer mu.Unlock()`. `sync.RWMutex` — для сценариев «много читателей, один писатель». Встроен в `sync` — без внешних зависимостей.

**Mypy** ([Модуль 04](../04-python/README.md))
статический анализатор типов для Python. Проверяет аннотации без выполнения кода. Запуск: `mypy --strict src/`. Альтернатива: pyright (быстрее), basedpyright (строже).

## N

**Namespace** ([Модуль 03](../03-php/README.md))
Пространство имён — механизм организации кода и предотвращения конфликтов имён. `namespace App\Core\Parser` соответствует директории `src/Core/Parser/` при PSR-4 autoloading.

**Native text PDF** ([Модуль 15](../15-pdf-internals/README.md))
PDF с корректным текстовым слоем и ToUnicode маппингом. Text extraction возвращает точный Unicode текст. Источник: Word → PDF, Google Docs → PDF, LaTeX → PDF. Надёжный для автоматизированной обработки.

**Navigation Timing L2** ([Модуль 33](../33-web-performance-api/README.md))
Спецификация W3C: `PerformanceNavigationTiming` interface — детальный timing загрузки страницы (DNS, TCP, TLS, TTFB, DOM processing). Заменяет deprecated L1 (`performance.timing`, `performance.navigation`).

**needs** ([Модуль 25](../25-cicd/README.md))
Зависимость между jobs: `needs: [lint, test]` — запустить job только после успешного завершения всех указанных. Формирует DAG pipeline. `needs` без `if: success()` — job запустится даже если зависимый упал при `if: always()`.

**Network First** ([Модуль 38](../38-http-service-worker-caching/README.md))
Service Worker стратегия: сначала network, при ошибке — SW cache fallback. Для HTML навигации и API данных требующих freshness. Медленнее Cache First на плохой сети.

**Network Only** ([Модуль 38](../38-http-service-worker-caching/README.md))
Service Worker стратегия: только network, кеш не используется. Обязательно для POST/PUT/PATCH/DELETE mutations.

**never** ([Модуль 02](../02-typescript/README.md))
Тип, который никогда не имеет значения. Возвращается функцией, которая всегда бросает ошибку или бесконечно выполняется. Используется для проверки exhaustiveness в discriminated unions.

**no_think / think** ([Модуль 08](../08-local-inference/README.md))
Теги `/no_think` и `/think` в начале user message для управления reasoning у совместимых reasoning-capable моделей. Работают на уровне chat template токенизации — наиболее надёжный способ управления. API параметры (`reasoning_effort`) могут игнорироваться если модель их не поддерживает.

**no-new-privileges** ([Модуль 24](../24-docker/README.md))
Флаг безопасности `--security-opt no-new-privileges`: запрещает процессу контейнера повысить привилегии через setuid/setgid. Предотвращает privilege escalation атаки.

**noscript fallback** ([Модуль 29](../29-critical-css/README.md))
`<noscript><link rel="stylesheet" href="..."></noscript>` — обычная загрузка CSS для браузеров с отключённым JavaScript. Обязателен при использовании media print trick или preload+onload swap, так как оба паттерна зависят от JS.

**num_predict / max_tokens** ([Модуль 08](../08-local-inference/README.md))
Максимальное количество генерируемых токенов за один запрос. В Ollama: `num_predict`. В llama.cpp / OpenAI API: `max_tokens`. Всегда устанавливай явно: без ограничения модель может генерировать до EOS или n_ctx — что приводит к runaway generation при сбое grammar или неправильном промпте.

**numFmt / numFmtId** ([Модуль 17](../17-xlsx-internals/README.md))
Числовой формат ячейки. `numFmtId` 0–163 — встроенные форматы Excel (зарезервированы). ID ≥164 — кастомные форматы из `<numFmts>` в styles.xml. Ключевой для детекции дат: форматы с `d`, `m`, `y` в `formatCode` — датовые.

## O

**observability** ([Модуль 26](../26-logging/README.md))
Способность понять внутреннее состояние системы по внешним выходам. Три столпа: logs (что произошло), traces (где и как долго), metrics (агрегированное состояние). Система observable если на вопрос «что произошло с запросом X?» можно ответить без изменения кода.

**OIDC (OpenID Connect)** ([Модуль 25](../25-cicd/README.md))
Протокол получения временных cloud credentials без хранения долгоживущих secrets. GitHub выдаёт JWT, cloud provider (AWS, GCP, Azure) верифицирует его и выдаёт временный token. Требует `permissions: id-token: write`. Заменяет хранение AWS_ACCESS_KEY_ID в secrets.

**Ollama** ([Модуль 08](../08-local-inference/README.md))
CLI-first инструмент для локального запуска LLM с OpenAI-совместимым REST API. Управляет загрузкой/выгрузкой моделей, хранит их в `~/.ollama/models`. Использует llama.cpp как backend. Modelfile — механизм конфигурации. В отличие от LM Studio: headless-режим, легче интегрируется в Docker и CI. GGUF/VLM может быть несовместим с Ollama из-за split weights, vision projector или неподдерживаемого tokenizer.

**on-demand revalidation** ([Модуль 27](../27-static-site/README.md))
ISR механизм: инвалидация кеша по событию (CMS webhook, API call), не по таймеру. `revalidateTag(tag)` в Next.js. Позволяет обновить конкретные страницы мгновенно без rebuild всего сайта.

**on-the-fly transformation** ([Модуль 35](../35-image-optimization/README.md))
Архитектурная модель image pipeline: изображения трансформируются при первом запросе на CDN edge, затем кешируются. Инструменты: Cloudflare Images, Imgix. Нет предварительной обработки, но стоимость per-transform запроса.

**One-shot Prompting** ([Модуль 06](../06-prompt-engineering/README.md))
Передача одного примера вход/выход в промпте. Компромисс между zero-shot и few-shot: эффективен когда формат нетривиален, но токенный бюджет ограничен.

**OOXML (Office Open XML)** ([Модуль 14](../14-ooxml/README.md), [Модуль 17](../17-xlsx-internals/README.md))
Семейство форматов файлов Microsoft Office: DOCX (Word), XLSX (Excel), PPTX (PowerPoint). Каждый файл — ZIP-архив с иерархией XML частей. Стандартизован ECMA-376. Два профиля: Strict (строгое соответствие) и Transitional (обратная совместимость). Большинство реальных документов — Transitional.

**OPcache** ([Модуль 03](../03-php/README.md))
Встроенное расширение PHP, кэширующее скомпилированный байткод. При первом запросе PHP компилирует файл → байткод сохраняется в памяти → следующие запросы не перекомпилируют. Ускорение production PHP в 2-5 раз. Критично правильно настроить при деплое (сброс кэша).

**OpenAI-Compatible API** ([Модуль 08](../08-local-inference/README.md))
HTTP API, реализующий эндпоинты `/v1/chat/completions`, `/v1/completions`, `/v1/models` с форматом совместимым с OpenAI. Реализован в llama-server, LM Studio, Ollama, vLLM. «Совместимость» неполная: extension параметры, streaming behavior, error codes различаются между провайдерами. Проверяй конкретные параметры перед использованием.

**OpenTelemetry (OTel)** ([Модуль 26](../26-logging/README.md))
Vendor-neutral стандарт для instrumentation: API + SDK + протокол OTLP. SDK 2.0 (2025): минимум Node.js 18.19+, TypeScript 5.0+, ES2022. Экспортирует в любой backend (Jaeger, Grafana Tempo, Datadog, Honeycomb).

**Optional Chaining (?.)** ([Модуль 02](../02-typescript/README.md))
Безопасный доступ к свойствам потенциально `null`/`undefined` объектов. `user?.address?.city` — вернёт `undefined` вместо ошибки если любое звено цепочки `null`/`undefined`.

**OTLP (OpenTelemetry Protocol)** ([Модуль 26](../26-logging/README.md))
Протокол передачи telemetry данных. HTTP/JSON (`/v1/traces`, `/v1/metrics`, `/v1/logs`) или gRPC. Стандартный порт: 4318 (HTTP), 4317 (gRPC).

**Outlines** (Модули 07–08)
Библиотека structured generation. Реализует токен-уровневые маски через FSM поверх HuggingFace transformers или llama.cpp. Версия зависит от релиза; перед запуском проверять current package. Поддерживает сложные схемы, regex, CFG. Overhead инициализации FSM ≈100–500ms на первый запрос, последующие — без задержки.

**outputNormalizer** ([Модуль 11](../11-multi-model-orchestration/README.md))
Функция постобработки ответа модели для приведения к единому формату. Необходима при ротации между моделями с разным поведением — например, удаление `<think>...</think>` блоков у reasoning моделей перед парсингом JSON.

**Overfitting (переобучение)** ([Модуль 13](../13-fine-tuning/README.md))
Состояние модели: train_loss падает, eval_loss растёт. Модель запоминает тренировочные примеры вместо обобщения паттерна. При малых датасетах наступает на 3–7 эпохе. Митигация: early stopping, dropout, меньший rank, больше данных.

**Overloading** ([Модуль 02](../02-typescript/README.md))
Определение нескольких сигнатур функции для разных типов аргументов. TypeScript выбирает нужную сигнатуру на основе переданных аргументов. Реальная реализация — одна, с общей сигнатурой.

## P

**Panic** ([Модуль 05](../05-go/README.md))
Аналог неперехваченного исключения. Вызывает раскрутку стека и завершение горутины (и всего процесса если не перехвачен). Легитимен для: инициализационных ошибок, нарушения инвариантов, ошибок программиста (не пользователя). В бизнес-логике — не использовать.

**Parent-Child Chunking** ([Модуль 12](../12-rag/README.md))
Иерархическая стратегия: документ делится на крупные parent-чанки, каждый — на мелкие child-чанки. Индексируются child-чанки (точный embedding), retrieval возвращает parent-чанк (полный контекст). Решает конфликт между точностью поиска и полнотой контекста.

**PasswordException** ([Модуль 15](../15-pdf-internals/README.md))
Исключение pdfjs-dist при работе с зашифрованным PDF. Два кода: `NEED_PASSWORD (1)` — пароль требуется, `INCORRECT_PASSWORD (2)` — пароль неверен. Обязательно обрабатывать явно в production pipeline.

**Patch** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Фрагмент изображения фиксированного размера (в CURRENT_VLM_MODEL: 32×32 пикселя). Каждый патч → один visual token после проекции. Количество патчей = (width / patch_size) × (height / patch_size).

**PDF/A** ([Модуль 15](../15-pdf-internals/README.md))
ISO 19005 стандарт архивного PDF. Запрещает внешние зависимости, шифрование, JavaScript. Требует встроенных шрифтов с ToUnicode — text extraction надёжнее. Детектируется по XMP метаданным (`pdfaid:conformance`).

**PDF/UA** ([Модуль 15](../15-pdf-internals/README.md))
ISO 14289 стандарт доступного PDF (Tagged PDF). Требует структурных тегов: заголовки, параграфы, таблицы, alt text для изображений. Открывает структурированное извлечение данных недоступное для неразмеченных PDF.

**performance budget** ([Модуль 40](../40-performance-budget/README.md))
Лимиты на метрики и размеры ресурсов. Типы: ресурсные (JS < 300KB gzip), метрические (LCP ≤ 2500ms), timing (TBT ≤ 200ms), score (Performance ≥ 80). Ценен только при CI enforcement.

**PerformanceObserver** ([Модуль 33](../33-web-performance-api/README.md))
Web API: асинхронная подписка на новые performance entries. Не блокирует main thread. Поддерживает `buffered: true` для получения ранних entries. Правильный способ мониторинга CWV в production.

**PeriodicExportingMetricReader** ([Модуль 26](../26-logging/README.md))
OTel компонент: собирает метрики с заданным интервалом (`exportIntervalMillis`) и отправляет в exporter. Заменяет устаревший `metricReader` (singular) — использовать `metricReaders: []` (массив).

**Perplexity (PPL)** (Модули 08–09)
Метрика качества языковой модели: среднегеометрическое обратных вероятностей предсказания токенов на тестовом корпусе. Ниже = лучше. Используется для оценки деградации качества при квантизации: Q8_0 ≈ fp16 по PPL, Q4_K_M — умеренная деградация (≈1–3%), Q2_K — значительная. PPL не коррелирует напрямую с качеством на конкретных задачах — измеряй на своём датасете.

**PHP-FIG** ([Модуль 03](../03-php/README.md))
PHP Framework Interop Group — организация, разрабатывающая PSR стандарты для PHP-экосистемы.

**Pipeline** ([Модуль 01](../01-javascript-nodejs/README.md))
Архитектурный паттерн последовательной обработки данных через независимые шаги. Каждый шаг — чистая функция с одним входом и одним выходом. Шаги можно отключать, заменять и тестировать изолированно.

**pipeline (ioredis)** ([Модуль 20](../20-backend-caching/README.md))
Пакетная отправка нескольких Redis команд в одном round-trip. `redis.pipeline()` + несколько команд + `.exec()`. Снижает latency при batch операциях: N команд = 1 round-trip вместо N.

**Playwright Test Agents** ([Модуль 21](../21-testing/README.md))
Функция Playwright 1.56+: planner/generator/healer цикл для AI-assisted создания и восстановления тестов. Генерирует рабочие тесты, но с хрупкими CSS-селекторами — требует архитектурного решения по стратегии локаторов до начала работы AI-кодера.

**plugin collision** ([Модуль 30](../30-schema-org/README.md))
Ситуация: несколько плагинов (Yoast, Rank Math, WooCommerce) генерируют конфликтующие JSON-LD блоки для одной сущности (Organization, WebSite). Google получает противоречивые данные → игнорирует или выбирает произвольный. Решение: один источник structured data.

**Pool (Vitest)** ([Модуль 21](../21-testing/README.md))
Стратегия изоляции тест-файлов. `threads` (default 4.x) — Worker Threads, быстро, изолированы. `forks` — child processes, медленнее, полная изоляция памяти. `vmForks` — VM context, для legacy кода с глобальным состоянием. Параллельный запуск выявляет temporal coupling, скрытый в Jest.

**POUR** ([Модуль 32](../32-accessibility/README.md))
Четыре принципа WCAG: Perceivable (воспринимаемый), Operable (управляемый), Understandable (понятный), Robust (надёжный). Организационный framework для 87 success criteria.

**prefetch** ([Модуль 34](../34-lazy-loading/README.md))
`<link rel="prefetch">`: низкоприоритетная загрузка ресурса в idle time для следующей навигации. Не блокирует текущую страницу. В React Router — `prefetch="intent"` триггерится на hover/focus.

**Prefill Phase** ([Модуль 08](../08-local-inference/README.md))
Первая фаза инференса: параллельная обработка всего входного промпта. Определяет TTFT (Time To First Token). Compute-bound: зависит от FLOPS GPU. Длинный system prompt увеличивает TTFT, не TPS. KV-cache устраняет повторный prefill для неизменного prefix между запросами.

**preload** ([Модуль 34](../34-lazy-loading/README.md))
`<link rel="preload">`: высокоприоритетная загрузка ресурса нужного текущей странице. Используется для LCP image, критичных шрифтов. Без использования ресурса вызывает console warning.

**preload (CSS)** ([Модуль 29](../29-critical-css/README.md))
`<link rel="preload" as="style">` — загрузить ресурс с высоким приоритетом без применения. Используется в паттерне `onload="this.rel='stylesheet'"`. Конкурирует с LCP image за bandwidth — в отличие от media print trick.

**Procedural Memory** ([Модуль 43](../43-agent-memory-knowledge-graphs/README.md))
Тип долгосрочной памяти агента, хранящий правила, навыки и процедуры выполнения задач. Lifetime: months/years. Пример: «перед отправкой договора проверять реквизиты».

**processing time** ([Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Компонент INP: время выполнения event handlers. Причина: CPU-bound логика в handler. Fix: Web Worker для heavy computation, `scheduler.yield()` для chunking DOM updates.

**Profile (pprof)** ([Модуль 05](../05-go/README.md))
Встроенный профилировщик. `net/http/pprof` — HTTP эндпоинт для CPU, memory, goroutine профилей. `go tool pprof` — анализ. Без внешних зависимостей. Запускается в production не нагружая систему.

**progressive enhancement** ([Модуль 31](../31-mobile-first-css/README.md))
Принцип: базовый опыт работает везде, дополнительные возможности добавляются для более capable environments. Mobile-first CSS — реализация этого принципа для responsive design.

**Project References** ([Модуль 02](../02-typescript/README.md))
Механизм разделения большого TypeScript проекта на независимые подпроекты с инкрементальной компиляцией. Каждый подпроект имеет свой `tsconfig.json`.

**Promise** ([Модуль 01](../01-javascript-nodejs/README.md))
Объект, представляющий результат асинхронной операции. Три состояния: `pending` (ожидание), `fulfilled` (успех), `rejected` (ошибка). Основа современной асинхронности в JS.

**Prompt** ([Модуль 06](../06-prompt-engineering/README.md))
Полный входной текст для LLM: система + история + текущий ввод. Не только «вопрос пользователя». Архитектурно: `prompt = f(system_prompt, few_shot_examples, retrieved_context, chat_history, user_input)`. Управление составом промпта и токенным бюджетом — основная задача на уровне архитектуры pipeline.

**Prompt Caching** ([Модуль 06](../06-prompt-engineering/README.md))
Механизм провайдера: стабильный prefix промпта (обычно system prompt + few-shot) кэшируется между вызовами — повторная обработка не тарифицируется или выполняется быстрее. Для локальных моделей — KV-cache на уровне llama.cpp через `--cache-prompt`. Длинный статичный system prompt выгоднее коротких повторяющихся вызовов именно за счёт кэширования.

**Prompt Injection** ([Модуль 06](../06-prompt-engineering/README.md), [Модуль 47](../47-ai-security-agents/README.md))
Атака: пользователь или внешние данные (документ, веб-страница) содержат инструкции, переопределяющие system prompt. Полной защиты не существует. Архитектурное решение: модель не должна принимать решения с высокими привилегиями на основе user-controlled данных без явной валидации вне контекста модели.

**Prompts** ([Модуль 41](../41-mcp-tool-server-architecture/README.md))
шаблоны повторяемых workflow в MCP. Позволяют агенту вызывать стандартизированные последовательности действий (draft_legal_response, summarize_incident) через единый контракт.

**Protocol** ([Модуль 04](../04-python/README.md))
Механизм структурной типизации (PEP 544). Класс, унаследованный от `typing.Protocol`, задаёт набор методов. Любой класс, реализующий эти методы, считается совместимым — без явного `implements`. Аналог интерфейсов TypeScript.

**Provenance** ([Модуль 43](../43-agent-memory-knowledge-graphs/README.md))
Происхождение факта: source, timestamp, user/tenant, confidence. Без provenance memory нельзя безопасно использовать.

**PSR (PHP Standard Recommendation)** ([Модуль 03](../03-php/README.md))
Стандарты совместимости PHP-кода: - PSR-4: Autoloading (namespace → директории) - PSR-7: HTTP Message Interface - PSR-11: Container Interface - PSR-12: Extended Coding Style.

**Pydantic** ([Модуль 04](../04-python/README.md), [Модуль 07](../07-json-schema/README.md))
Python-библиотека для валидации данных через type annotations. В контексте structured output — стандарт де-факто для описания схем: автоматически генерирует JSON Schema из моделей, валидирует вывод LLM. `model.model_json_schema()` — JSON Schema совместимая с Draft 7. Версия Pydantic V2 (актуальная) меняет поведение ряда аннотаций по сравнению с V1.

## Q

**QLoRA (Quantized LoRA)** ([Модуль 13](../13-fine-tuning/README.md))
Fine-tuning метод: базовая модель загружается в 4-bit (NF4), LoRA адаптер обучается в 16-bit поверх замороженных квантованных весов. Позволяет обучать 4B модели на GPU с 6 ГБ VRAM.

**Quantization** ([Модуль 08](../08-local-inference/README.md))
Снижение точности представления весов модели для уменьшения размера и ускорения inference. Основные форматы llama.cpp.

## R

**Race Condition** (Модули 01, 21–22)
Состояние, когда результат операции зависит от порядка выполнения двух потоков. При конкурентной записи в SharedArrayBuffer без Atomics: thread A читает значение, thread B читает то же значение, оба инкрементируют, один перезаписывает другого.

**RAG (Retrieval-Augmented Generation)** ([Модуль 06](../06-prompt-engineering/README.md), [Модуль 12](../12-rag/README.md))
Архитектура: перед генерацией выполняется поиск релевантных фрагментов из внешнего хранилища, они добавляются в контекст. Решает проблему устаревших знаний и hallucination на фактах. Качество зависит от качества retrieval: плохой поиск хуже, чем его отсутствие.

**Ragas** ([Модуль 09](../09-evaluator-benchmark/README.md))
Python-фреймворк для RAG-специфичной evaluation. Версия 0.4.3 (январь 2026). Apache 2.0. Метрики: faithfulness, answer relevancy, context precision, context recall. Synthetic test generation из реальных документов через `TestsetGenerator`.

**RDFa (Resource Description Framework in Attributes)** ([Модуль 30](../30-schema-org/README.md))
Формат structured data: расширение HTML атрибутов для семантической разметки. Мощный, но высокий порог вхождения. Google поддерживает, но не рекомендует.

**ReAct (Reasoning + Acting)** ([Модуль 06](../06-prompt-engineering/README.md))
Паттерн промптинга: модель чередует `Thought:` (рассуждение) и `Action:` (вызов инструмента). Обеспечивает трассируемость решений в agent loop. На слабых моделях ломается: путаница фаз Thought/Action или бесконечные петли без прогресса.

**React.lazy** ([Модуль 34](../34-lazy-loading/README.md))
React API: lazy loading компонента через dynamic import. Возвращает компонент который загружается при первом рендере. Требует Suspense boundary. Не работает с named exports напрямую.

**read-only filesystem** ([Модуль 24](../24-docker/README.md))
`docker run --read-only` или `read_only: true` в Compose: запрещает запись в файловую систему контейнера за пределами tmpfs mount. Ограничивает возможности при компрометации. Требует явного `tmpfs` для временных файлов.

**Readable Stream** ([Модуль 01](../01-javascript-nodejs/README.md))
Поток, из которого можно только читать. Пример: `fs.createReadStream()`, HTTP response. Генерирует события `data`, `end`, `error`.

**Reasoning Mode (VLM)** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Управление chain-of-thought в CURRENT_VLM_MODEL для визуальных задач. `/think` — CoT активирован: медленнее, лучше для сложного visual reasoning. `/no_think` — CoT отключён: быстрее, оптимально для structured extraction.

**Reasoning Model** ([Модуль 06](../06-prompt-engineering/README.md))
Класс моделей, генерирующих внутреннюю «цепочку рассуждений» (thinking tokens) перед финальным ответом. Отличительная черта: фаза рассуждения и финальный ответ — физически разделены. Это позволяет применять разные стратегии к каждой фазе: свободная генерация в thinking, constrained decoding — только для финального вывода. Thinking-токены потребляют context window и увеличивают TTFT, но не входят в финальный вывод. Актуальные представители — см. раздел «Актуальные версии» в README.

**Recall (gate)** ([Модуль 11](../11-multi-model-orchestration/README.md))
Доля реально релевантных объектов, которые gate корректно пропустил. `recall = TP / (TP + FN)`. Для gate в extraction-pipeline recall важнее precision — пропущенный объект теряется, лишний вызов только стоит денег.

**Recall@k** ([Модуль 12](../12-rag/README.md))
Метрика качества retrieval: доля запросов для которых правильный ответ содержится хотя бы в одном из top-k retrieved чанков. Основная метрика для оценки retrieval phase. Не гарантируется ANN-индексом, требует явного измерения.

**redact** ([Модуль 26](../26-logging/README.md))
Pino механизм маскирования чувствительных данных по JSON path. `paths: ['req.headers.authorization']` → значение заменяется на `[REDACTED]`. Работает до сериализации — безопасен по умолчанию.

**RedisCache** ([Модуль 20](../20-backend-caching/README.md))
Типизированная обёртка над ioredis. Паттерн: prefix + key → полный Redis ключ, JSON сериализация/десериализация, TTL через `SETEX`. Экспонировать domain-specific инстанции (`documentCache`, `embeddingCache`) как синглтоны.

**Reflection API** ([Модуль 03](../03-php/README.md))
Встроенный PHP API для интроспекции классов, методов, свойств и параметров в runtime. Используется DI-контейнерами, ORM, тестовыми фреймворками. Медленнее прямых вызовов — результаты нужно кэшировать.

**Regression** ([Модуль 09](../09-evaluator-benchmark/README.md))
Снижение метрики качества относительно зафиксированного baseline. В quality gate: `regression = baseline_score - current_score`. Допустимый порог: 2–3% для production pipeline.

**Relationship (связь)** ([Модуль 14](../14-ooxml/README.md))
Механизм OOXML для ссылок между частями документа и внешними ресурсами. Определяется в `.rels` файлах. Каждая связь имеет уникальный `Id` (rId1, rId2...) в пределах одной части. В XML ссылка через `r:embed="rId2"` или `r:id="rId3"`.

**removeOnComplete** ([Модуль 18](../18-task-queues/README.md))
Опция BullMQ задачи: автоматически удалять из Redis после завершения. Форматы: `true` (удалить сразу), `{ count: N }` (хранить последние N), `{ age: seconds }` (хранить N секунд). Без этой опции — completed задачи накапливаются в Redis бесконечно.

**removeOnFail** ([Модуль 18](../18-task-queues/README.md))
Опция BullMQ задачи: автоматически удалять из Redis после финального сбоя. Аналог `removeOnComplete`. Для DLQ паттерна — `removeOnFail: false` или `{ count: N }` большой.

**render tree** ([Модуль 29](../29-critical-css/README.md), [Модуль 36](../36-critical-rendering-path/README.md))
Браузерная структура: объединение DOM и CSSOM. Содержит только видимые элементы с вычисленными стилями. Render tree → Layout → Paint → Compositing → Pixels. Невозможно построить без завершённого CSSOM.

**render-blocking** (Модули 28–29, 36)
Ресурс блокирующий рендер страницы: браузер не показывает ничего пока ресурс не загружен и не обработан. CSS `<link>` в `<head>` — render-blocking по умолчанию. `<script>` без defer/async — render-blocking.

**replay** ([Модуль 18](../18-task-queues/README.md))
Повторный запуск задачи из DLQ. Паттерн: создать новую задачу с теми же данными что и упавшая, удалить из DLQ. Возможен через Bull Board UI или программно.

**Reranker** ([Модуль 12](../12-rag/README.md))
Модель постобработки retrieved чанков: переупорядочивает top-k результатов по точной релевантности. Cross-encoder реранкер точнее embedding similarity, но требует N дополнительных inference вызовов.

**Resource (OTel)** ([Модуль 26](../26-logging/README.md))
Набор атрибутов, описывающих источник telemetry данных: `service.name`, `service.version`, `deployment.environment`. Прикрепляется ко всем spans и metrics от процесса.

**response timeout** ([Модуль 19](../19-http-clients/README.md))
Таймаут от отправки запроса до получения первого байта тела ответа. В got: `timeout.response`. Для AI inference — самый критичный таймаут: модель может начать отвечать через 30–60s. Не путать с общим временем получения ответа.

**Retention Policy** ([Модуль 43](../43-agent-memory-knowledge-graphs/README.md))
Правило хранения памяти: TTL, legal hold, deletion policy, privacy scope.

**retry** ([Модуль 18](../18-task-queues/README.md), [Модуль 21](../21-testing/README.md))
Повторный запуск упавшего теста при CI. `retries: 2` в Playwright — допустимо в CI для сетевых артефактов. Локально `retries: 0` — flaky тест должен быть исправлен, не перезапущен.

**Retry-After** ([Модуль 19](../19-http-clients/README.md), [Модуль 23](../23-rate-limiting/README.md))
HTTP заголовок: указывает клиенту сколько ждать перед повторным запросом. Форматы: числовые секунды (`Retry-After: 30`) или HTTP дата (`Retry-After: Wed, 01 Apr 2026 12:00:00 GMT`). Обязателен к уважению при 429 ответах от AI API.

**reusable workflow** ([Модуль 25](../25-cicd/README.md))
Переиспользуемый полный workflow с `on: workflow_call`. Содержит полные jobs с изоляцией, не просто steps. Может принимать `inputs` и `secrets`. Вызывается через `uses: ./.github/workflows/name.yml`. `secrets: inherit` — передать все secrets вызывающего.

**RGBA** ([Модуль 16](../16-pdfium-wasm/README.md))
Формат пикселя: Red (0-255), Green (0-255), Blue (0-255), Alpha (0-255). 4 байта на пиксель. PDFium нативно рендерит в RGBA. Sharp принимает raw RGBA через `{ raw: { width, height, channels: 4 } }`.

**rich result** ([Модуль 30](../30-schema-org/README.md))
Визуально расширенный результат в Google SERP: звёздочки, цены, изображения, FAQ dropdown, breadcrumbs. Требует валидного structured data соответствующего Google Search Gallery. ≈30 поддерживаемых типов в 2026.

**RichText** ([Модуль 17](../17-xlsx-internals/README.md))
Ячейка XLSX с несколькими runs разного форматирования. В XML shared strings: `<si><r><rPr><b/></rPr><t>жирный</t></r><r><t> обычный</t></r></si>`. ExcelJS возвращает как `CellRichTextValue` с массивом `richText`. При нормализации — конкатенировать `.text` из всех runs.

**Role (System / User / Assistant)** ([Модуль 06](../06-prompt-engineering/README.md))
Три роли в стандартном chat-формате. `system` — инструкции и контекст, один раз в начале. `user` — входящее сообщение. `assistant` — ответ модели. Порядок и разделение ролей влияет на instruction following: модели обучены на конкретных паттернах чередования, отклонение от них деградирует качество.

**rootMargin** ([Модуль 34](../34-lazy-loading/README.md))
Параметр IntersectionObserver: отступ от viewport для определения пересечения. `rootMargin: "200px"` — начать загрузку за 200px до входа в viewport. Аналог browser preload buffer для нативного `loading="lazy"`.

**RoPE Scaling** ([Модуль 08](../08-local-inference/README.md))
Техника масштабирования позиционных эмбеддингов для расширения контекстного окна за пределы тренировочного максимума. Типы: linear, dynamic, YaRN. YaRN — наиболее распространён для современных моделей. При использовании n_ctx > тренировочного окна модели — деградация качества вероятна, но контролируема через RoPE scaling. Проверяй метаданные GGUF файла.

**ROUGE** ([Модуль 09](../09-evaluator-benchmark/README.md))
Семейство метрик overlap n-gram между prediction и reference. ROUGE-L (longest common subsequence) — основная метрика для summarization. Ограничение: копирование исходного текста даёт высокий score без реального понимания.

**Routing (по размеру модели)** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Паттерн: edge SLM классифицирует сложность задачи, результат направляется к модели нужного класса. На слабом локальном GPU может снижать median latency без потери качества на сложных кейсах.

**row (r attribute)** ([Модуль 17](../17-xlsx-internals/README.md))
Атрибут XML элемента `<row r="5">` — номер строки (1-indexed). Атрибут `spans` — диапазон колонок в строке для оптимизации парсинга: `spans="1:4"`.

**RRF (Reciprocal Rank Fusion)** ([Модуль 12](../12-rag/README.md))
Алгоритм объединения ранговых списков: `score = Σ 1/(k + rank_i)`. Используется в hybrid search для нормализации и комбинации dense и sparse результатов. Параметр `k=60` — стандартный сглаживающий коэффициент.

**RUM (Real User Monitoring)** ([Модуль 33](../33-web-performance-api/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Практика: сбор performance метрик от реальных пользователей в production. Инфраструктура: PerformanceObserver в браузере → sendBeacon → backend → analytics. Единственный способ измерить реальный опыт.

## S

**sameAs** ([Модуль 30](../30-schema-org/README.md))
Schema.org свойство: URL авторитетного источника о той же сущности (Wikipedia, Wikidata, LinkedIn, GitHub). Позволяет Google однозначно идентифицировать сущность и добавить в Knowledge Graph.

**sampling** ([Модуль 26](../26-logging/README.md), [Модуль 33](../33-web-performance-api/README.md))
Выборочная запись/экспорт данных для контроля объёма. Head sampling: решение на входе span. Tail sampling: решение после завершения trace (позволяет сохранить ошибочные traces). Log sampling: логировать только N% успешных запросов.

**Sandboxing** ([Модуль 47](../47-ai-security-agents/README.md))
Ограничение runtime/tool/browser environment агента для снижения blast radius.

**SCAN** ([Модуль 20](../20-backend-caching/README.md))
Redis команда для итеративного обхода ключей. `SCAN cursor MATCH pattern COUNT count`. Не блокирует Redis — возвращает порцию ключей за итерацию. В отличие от `KEYS`: O(1) за вызов, безопасен в production.

**schedule** ([Модуль 18](../18-task-queues/README.md))
pg-boss метод для Cron задач: `boss.schedule('name', '0 9 * * *', data)`. Хранит расписание в `pgboss.schedule` таблице. BullMQ аналог: `queue.add('name', data, { repeat: { pattern: '0 9 * * *' } })`.

**Schema.org** ([Модуль 30](../30-schema-org/README.md))
Collaborative vocabulary (Google, Microsoft, Yahoo, Yandex): 800+ типов для semantic web. Полная онтология. Google поддерживает только subset (≈30 типов) для rich results.

**screen reader** ([Модуль 32](../32-accessibility/README.md))
Assistive technology: программа для синтеза речи из содержимого экрана. Пользователи с нарушениями зрения. Основные: NVDA (Windows, бесплатный), JAWS (Windows, платный), VoiceOver (macOS/iOS встроенный), TalkBack (Android).

**Screenshot Grounding** ([Модуль 44](../44-browser-use-computer-use/README.md))
техника получения контекста страницы через скриншот. Комбинируется с DOM snapshot для надёжных selectors. Screenshot-only недостаточен — не даёт accessibility tree и точных координат элементов.

**seccomp** ([Модуль 24](../24-docker/README.md))
Механизм ограничения syscalls для процессов. Docker применяет default seccomp profile (≈300 разрешённых syscalls, ≈44 заблокированных). Кастомный профиль позволяет минимизировать доступные syscalls для конкретного приложения.

**secret mount** ([Модуль 24](../24-docker/README.md))
BuildKit `--mount=type=secret,id=NAME,target=PATH`: файл с секретом доступен только во время выполнения `RUN` команды. Не попадает в слои образа, не виден в `docker history`. Передаётся через `docker build --secret id=NAME,src=FILE`.

**Secret Redaction** ([Модуль 47](../47-ai-security-agents/README.md))
Удаление или маскирование secrets из logs/traces/output перед сохранением.

**Select** ([Модуль 05](../05-go/README.md))
Множественный выбор по каналам — как `switch` но для операций с каналами. Блокирует до готовности одного из case. `default` case — неблокирующий select. Основа timeout-паттернов: `select { case <-ch: ... case <-ctx.Done(): ... }`.

**Self-Consistency** ([Модуль 06](../06-prompt-engineering/README.md))
Техника: один промпт запускается N раз с ненулевой температурой, финальный ответ выбирается большинством голосов (majority voting). Улучшает точность на задачах с однозначным ответом за счёт N-кратного увеличения стоимости. Применимо там, где latency некритична.

**Self-Enhancement Bias** ([Модуль 09](../09-evaluator-benchmark/README.md))
Тенденция LLM-судьи завышать оценки текстов сгенерированных моделью того же семейства. Митигация: использовать модель другого семейства или провайдера в качестве судьи.

**Semantic Chunking** ([Модуль 12](../12-rag/README.md))
Стратегия chunking: граница чанка определяется по резкому падению cosine similarity между соседними предложениями. Дорого при индексации (N embedding вызовов), точнее fixed-size для документов с явными смысловыми переходами.

**Semantic Memory** ([Модуль 43](../43-agent-memory-knowledge-graphs/README.md))
Тип долгосрочной памяти агента, хранящий устойчивые факты о мире и пользователе. Lifetime: months/years. Пример: «клиент использует MSK timezone».

**sendBeacon** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 33](../33-web-performance-api/README.md))
Web API: асинхронная отправка данных без блокировки страницы. Работает при `visibilitychange` и `unload`. Предпочтительный способ отправки RUM данных. Ограничение: только POST, без кастомных заголовков.

**Session Isolation** ([Модуль 44](../44-browser-use-computer-use/README.md))
Разделение browser sessions по user/run/tenant. Предотвращает leakage cookies и cross-user actions.

**SFT (Supervised Fine-Tuning)** ([Модуль 13](../13-fine-tuning/README.md))
Тип fine-tuning на размеченных парах (вход, ожидаемый выход). Противопоставляется RLHF (Reinforcement Learning from Human Feedback). `SFTTrainer` из TRL библиотеки — стандартный инструмент для SFT в связке с PEFT/Unsloth.

**SharedArrayBuffer** ([Модуль 37](../37-js-performance/README.md))
API: фиксированный массив памяти доступный из нескольких Workers одновременно. Zero-copy sharing. Требует Cross-Origin Isolation (`COOP: same-origin` + `COEP: require-corp`). Использовать с Atomics для thread-safety.

**sharedStrings.xml** ([Модуль 17](../17-xlsx-internals/README.md))
Централизованный реестр строковых значений XLSX. Все текстовые ячейки с `t="s"` хранят индекс в этот файл, не сам текст. Эффективен при повторяющихся строках. Узкое место производительности при загрузке больших файлов с уникальными значениями.

**ShareGPT format** ([Модуль 13](../13-fine-tuning/README.md))
Формат датасета для multi-turn fine-tuning: поле `conversations` — массив объектов `{from: "human"|"gpt", value: "..."}`. Используется когда нужно обучить модель поддерживать диалог, а не только single-turn instruction following.

**side effects** ([Модуль 40](../40-performance-budget/README.md))
Свойство `"sideEffects"` в `package.json`: сигнал bundler что файлы без явного импорта можно удалить при tree-shaking. `"sideEffects": false` — агрессивный tree-shaking. Отсутствие свойства → bundler не удаляет unused exports.

**SIGTERM** ([Модуль 01](../01-javascript-nodejs/README.md), [Модуль 18](../18-task-queues/README.md))
Unix сигнал запрашивающий корректное завершение процесса. Kubernetes и Docker посылают SIGTERM перед остановкой контейнера. Обработчик должен вызывать `worker.close()` / `boss.stop()` и завершать процесс после очистки.

**Singleton** ([Модуль 16](../16-pdfium-wasm/README.md))
Паттерн: один экземпляр объекта на процесс. Для `PDFiumLibrary` — критичен: повторная инициализация дорогостоящая. Реализуется через модульную переменную или кэшированный Promise.

**sitemap** ([Модуль 27](../27-static-site/README.md))
XML файл со списком URL сайта для поисковиков. `@astrojs/sitemap` генерирует автоматически. Обязателен filter для draft страниц, служебных URL, 404.

**SKIP LOCKED** ([Модуль 18](../18-task-queues/README.md))
PostgreSQL расширение для `SELECT ... FOR UPDATE SKIP LOCKED`. Позволяет нескольким воркерам конкурентно брать задачи из таблицы без блокировки друг друга. Основной механизм pg-boss для параллельной обработки.

**skipWaiting()** ([Модуль 38](../38-http-service-worker-caching/README.md))
Service Worker API: новый SW активируется немедленно, не дожидаясь закрытия старых вкладок. Безопасно только для backwards-compatible изменений.

**Slice** ([Модуль 05](../05-go/README.md))
Заголовок `{pointer, length, capacity}` над массивом. Не копирует данные при передаче в функции — передаётся заголовок. `append()` может создать новый массив если capacity исчерпан. Срез среза (`s[1:3]`) — разделяет память с оригиналом.

**Sliding Window Counter** ([Модуль 23](../23-rate-limiting/README.md))
Алгоритм rate limiting: взвешенная комбинация двух соседних fixed window. `count = prev × (1 - elapsed/window) + curr`. Аппроксимация скользящего окна. O(1) память. Погрешность ≤ 10% — достаточно для production.

**Sliding Window Log** ([Модуль 23](../23-rate-limiting/README.md))
Точный алгоритм rate limiting: sorted set с timestamp каждого запроса. O(N) память. Нет window boundary attack. Не масштабируется при высоком трафике (> 1000 req/min/user) из-за роста sorted set.

**SLM (Small Language Model)** ([Модуль 08](../08-local-inference/README.md))
Малая языковая модель, обычно 1B–8B параметров. Используется для routing, classification, pre-screening и простых extraction-задач, где важны privacy, latency и cost.

**Slot (`__slots__`)** ([Модуль 04](../04-python/README.md))
Явное определение допустимых атрибутов объекта вместо динамического `__dict__`. Снижает потребление памяти (≈40-60%) и ускоряет доступ к атрибутам. Полезно для объектов, создаваемых миллионами (строки данных, точки координат).

**span** ([Модуль 26](../26-logging/README.md), [Модуль 46](../46-agentops/README.md))
Единица работы в OTel tracing: имеет start/end время, атрибуты, события, статус. Spans образуют trace дерево через parent span ID. `span.end()` обязателен — незакрытый span не экспортируется.

**Sparse Retrieval** ([Модуль 12](../12-rag/README.md))
Поиск на основе разреженных (sparse) векторов — TF-IDF или BM25. Ненулевые компоненты только для слов, встречающихся в документе. Хорошо для точных лексических совпадений, плохо для семантических вариаций.

**Spatial Anchoring** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Техника VLM промптинга: явные пространственные референсы на расположение элементов. Работает буквально благодаря M-RoPE 2D координатам. Примеры: «в верхней правой части», «под основным текстом», «рядом с подписью».

**Spearman ρ (ранговая корреляция)** ([Модуль 09](../09-evaluator-benchmark/README.md))
Метрика монотонной корреляции между двумя ранжированиями. Устойчивее к выбросам чем Pearson r. Используется для калибровки судьи: ρ > 0.7 — приемлемый уровень согласованности с human labels.

**specificity** ([Модуль 36](../36-critical-rendering-path/README.md))
CSS механизм определения приоритета правил: id > class > element. `@layer` решает specificity wars между слоями — более поздний слой побеждает независимо от specificity внутри.

**SPL (Standard PHP Library)** ([Модуль 03](../03-php/README.md))
Набор встроенных структур данных и итераторов: `SplStack`, `SplQueue`, `SplMinHeap`, `SplFileObject`, `DirectoryIterator`, `RecursiveIteratorIterator`. Эффективнее массивов для специфических задач.

**SpreadsheetML** ([Модуль 17](../17-xlsx-internals/README.md))
XML схема Microsoft для XLSX (`http://schemas.openxmlformats.org/spreadsheetml/2006/main`). Определяет структуру workbook.xml, sheet XML, styles.xml и sharedStrings.xml.

**SSE (Server-Sent Events)** ([Модуль 19](../19-http-clients/README.md))
HTTP механизм для однонаправленного стриминга от сервера к клиенту. Content-Type: `text/event-stream`. Формат: `data: {json}\n\n`. AI API (OpenAI, Anthropic) используют SSE для streaming completion. Терминальное событие: `data: [DONE]\n\n`.

**SSG (Static Site Generation)** ([Модуль 27](../27-static-site/README.md))
Стратегия: HTML генерируется в build time, раздаётся с CDN. Максимальная производительность (TTFB < 50ms), нулевой server runtime. Данные свежи до следующего деплоя или revalidation.

**Stale While Revalidate (SW стратегия)** ([Модуль 38](../38-http-service-worker-caching/README.md))
Service Worker стратегия: отвечать из кеша мгновенно + параллельно обновлять кеш из network. Баланс speed vs freshness. Для часто меняющегося но не critical контента.

**stale-while-revalidate** ([Модуль 20](../20-backend-caching/README.md), [Модуль 27](../27-static-site/README.md), [Модуль 38](../38-http-service-worker-caching/README.md))
Паттерн кэширования: отдавать устаревшие данные пока фоново обновляются. HTTP директива: `Cache-Control: stale-while-revalidate=3600`. LRUCache: `allowStale: true` + `fetchMethod`. Снижает perceived latency при обновлении кэша.

**Static Analysis** ([Модуль 03](../03-php/README.md))
Анализ кода без его выполнения. Инструменты: PHPStan, Psalm. Находят ошибки типов, необработанные nullable значения, недостижимый код. Уровни строгости (0-9 в PHPStan). Аналог TypeScript-компилятора для PHP.

**step** ([Модуль 25](../25-cicd/README.md))
Минимальная единица выполнения внутри job. Либо `run:` (shell команда), либо `uses:` (action). Steps одного job выполняются последовательно на одном runner. Разделяют файловую систему и переменные окружения в рамках job.

**Stream** ([Модуль 01](../01-javascript-nodejs/README.md))
Абстракция для работы с последовательными данными по частям (chunks) без загрузки всего объёма в память. Критично для обработки больших файлов и медиаданных.

**Strict Mode** ([Модуль 02](../02-typescript/README.md), [Модуль 07](../07-json-schema/README.md))
Режим JSON Schema в LLM API (OpenAI, LM Studio и совместимые): усиленные ограничения для повышения надёжности constrained decoding. Требования: все поля в `required`, `additionalProperties: false`, только поддерживаемые типы. В llama.cpp — аналог через полный GBNF с явными ограничениями.

**Struct Tags** ([Модуль 05](../05-go/README.md))
строковые метаданные к полям struct в Go. Используются для сериализации (json, xml), валидации, ORM. Формат: `Field type 'json:"field_name,omitempty"'`. Пробелы в tag — частый источник багов.

**Structural Diff** ([Модуль 07](../07-json-schema/README.md))
Побайтовое сравнение двух JSON-выводов на уровне значений полей. Основной инструмент валидации LLM pipeline: выявляет семантические расхождения между прогонами с разными параметрами (thinking on/off, разные модели, версии промпта). Реализуется через `deepdiff` (Python) или кастомную рекурсивную функцию сравнения.

**Structural error rate** ([Модуль 13](../13-fine-tuning/README.md))
Метрика оценки: доля ответов модели которые не парсятся как валидный JSON (или другой ожидаемый формат). Отдельная от accuracy метрика — структурная ошибка хуже семантической: данные нельзя использовать вообще.

**Structural Typing** ([Модуль 02](../02-typescript/README.md))
Система типов TypeScript, при которой совместимость типов определяется **структурой** (набором полей и методов), а не именем типа. Объект подходит под интерфейс, если имеет все нужные поля — явная реализация не нужна.

**structured clone algorithm** ([Модуль 22](../22-worker-threads/README.md))
Алгоритм сериализации данных при `postMessage`. Поддерживает: примитивы, ArrayBuffer, Map, Set, Date, RegExp, Error. Не поддерживает: функции, классы с методами, Symbol, WeakMap, DOM nodes. Создаёт глубокую копию.

**structured logging** ([Модуль 26](../26-logging/README.md))
Логирование в машиночитаемом формате (JSON) вместо произвольных строк. Каждое поле — отдельный ключ, доступный для фильтрации. Противоположность: `"User 123 logged in at 14:32"` vs `{"userId":123,"event":"login","ts":"14:32"}`.

**Structured Output** (Модули 06–07)
Генерация вывода LLM в заранее определённом формате (JSON, XML, CSV и др.). Иерархия надёжности: postprocessing с retry → JSON mode → Function Calling → Constrained Decoding. В production extraction pipeline — только constrained decoding. Структурная валидность ≠ семантическая корректность содержимого.

**styles.xml** ([Модуль 17](../17-xlsx-internals/README.md))
Файл XLSX хранящий все стили ячеек. Структура: `numFmts` (числовые форматы) + `fonts` + `fills` + `borders` + `cellXfs` (комбинации). Индекс стиля ячейки — атрибут `s` в `<c s="2">`. Для детекции дат — обязателен lookup numFmtId из cellXfs.

**Success Rate** ([Модуль 46](../46-agentops/README.md))
Доля успешных agent workflows. Должна измеряться per agent и per task type.

**Suspense** ([Модуль 34](../34-lazy-loading/README.md))
React компонент: показывает fallback UI пока lazy компонент загружается. Граница для обработки loading состояния. Несколько Suspense boundaries — независимые fallback для разных частей UI.

**System Prompt** ([Модуль 06](../06-prompt-engineering/README.md))
Привилегированные инструкции, задающие роль, ограничения и контекст модели. Технически — первое сообщение с ролью `system` в chat-формате. Кэшируется у провайдеров — снижает стоимость и TTFT при повторных вызовах. Не является абсолютным барьером: см. Prompt Injection, Prompt Leaking.

## T

**T-string (Template String)** ([Модуль 04](../04-python/README.md))
Новый тип строк в Python 3.14 (PEP 750): `t"Hello, {name}!"`. В отличие от f-strings, не производит строку немедленно — возвращает объект `Template`, который можно передать в кастомный форматтер. Позволяет безопасную обработку (SQL-инъекции, HTML-экранирование) на уровне синтаксиса.

**Table-driven Tests** ([Модуль 05](../05-go/README.md))
Стандартный паттерн тестирования в Go: `tests := []struct{ input string; want int }{ ... }; t.Run(...)` Встроен в `testing` — никаких фреймворков не нужно.

**Tagged PDF** ([Модуль 15](../15-pdf-internals/README.md))
PDF с логической структурной разметкой: иерархия тегов (Document, Sect, P, H1–H6, Table, TR, TD и др.). Требование PDF/UA. Позволяет извлекать документ как структурированные данные, не просто поток текстовых позиций.

**TBT (Total Blocking Time)** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Lab метрика: сумма blocking time всех long tasks между FCP и Time to Interactive. Proxy для INP в lab условиях. TBT хороший при плохом INP = event handlers тяжёлые (не load-time проблема).

**TCP slow start** ([Модуль 29](../29-critical-css/README.md))
Механизм TCP: новое соединение начинает с ≈14KB данных в первом round-trip, постепенно увеличивая. Если HTML + critical CSS умещается в 14KB — приходят в одном round-trip без ожидания. Обоснование для лимита critical CSS.

**Temperature** ([Модуль 06](../06-prompt-engineering/README.md))
Скалярный множитель логитов перед softmax. `0` — всегда наиболее вероятный токен. `1` — вероятности без изменений. `temperature=0` не гарантирует полный детерминизм при параллельном GPU-инференсе из-за нестабильности floating point операций.

**Temporal RAG** ([Модуль 12](../12-rag/README.md), [Модуль 45](../45-agentic-rag-graph-rag/README.md))
RAG, учитывающий версии документов, valid_from/valid_to, superseded_by и as-of date запроса.

**Test Honeycomb** ([Модуль 21](../21-testing/README.md))
Стратегия тестирования Spotify: акцент на service integration tests, минимум unit и e2e. Оптимальна для микросервисной архитектуры, где контракт между сервисами важнее unit-деталей реализации.

**Test Pyramid** ([Модуль 21](../21-testing/README.md))
Классическая стратегия: много unit, меньше integration, мало e2e. Оптимальна для систем с богатой бизнес-логикой, чистыми функциями и дорогой инфраструктурой. В 2026 с testcontainers инфраструктура перестала быть дорогой.

**Test Trophy** ([Модуль 21](../21-testing/README.md))
Стратегия Kent C. Dodds: акцент на integration tests как наиболее эффективных по confidence/cost. Unit tests — только для чистой бизнес-логики. E2E — только critical paths. Де-факто стандарт для Node.js API сервисов.

**Test-Train Leakage** ([Модуль 09](../09-evaluator-benchmark/README.md))
Использование тест-кейсов из eval датасета при разработке промпта. Результат: завышенные метрики, не коррелирующие с production качеством. Митигация: строгое разделение dev_examples и eval_dataset с первого дня.

**Thinking Tokens** ([Модуль 06](../06-prompt-engineering/README.md), [Модуль 08](../08-local-inference/README.md))
Токены внутренней цепочки рассуждений reasoning модели при локальном инференсе. Управление через chat template: `/no_think` / `/think` в начале user message — единственный надёжный способ для моделей с hardcoded chat template токенами. Несовместимы с grammar sampling в текущей реализации llama.cpp. Верификация — через `reasoning_tokens` в usage или парсинг `<think>` тегов из content.

**thundering herd** ([Модуль 19](../19-http-clients/README.md))
Эффект одновременного шторма retry запросов. Возникает когда N инстанций сервиса одновременно переходят в retry с одинаковым backoff. Решение: jitter в backoff стратегии.

**Tile Processing** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Стратегия нарезки документа на фрагменты для обработки с высоким разрешением. Каждый тайл — отдельный VLM запрос, результаты объединяются в post-processing. Альтернатива повышению max_pixels: позволяет OCR мелкого шрифта без превышения n_ctx.

**Token** ([Модуль 06](../06-prompt-engineering/README.md))
Базовая единица обработки LLM — не символ и не слово. Зависит от токенизатора. Для большинства современных моделей: ≈4 символа/токен для английского, ≈2–3 для русского. Стоимость API, context window, скорость — всё измеряется в токенах. Правило оценки: 1000 токенов ≈ 750 английских слов ≈ 500–600 русских слов.

**Token Bucket** ([Модуль 23](../23-rate-limiting/README.md))
Алгоритм rate limiting: bucket наполняется токенами со скоростью R/sec до максимума B. Каждый запрос потребляет токен. Разрешает burst до B запросов. Сложнее реализовать атомарно в Redis, чем Fixed Window.

**Token Healing** ([Модуль 07](../07-json-schema/README.md))
Техника коррекции токенизации на стыке prefix и генерируемого суффикса. При constrained decoding граница между prompt и generated частью может попасть в середину мультисимвольного токена — token healing откатывает последний токен prefix и перегенерирует его как часть constrained последовательности. Реализован в llama.cpp; важен при генерации кода и строго форматированных данных.

**Tool Abuse** ([Модуль 47](../47-ai-security-agents/README.md))
Сценарий, где agent вызывает разрешённый инструмент не по назначению или под влиянием вредного input.

**ToUnicode CMap** ([Модуль 15](../15-pdf-internals/README.md))
Таблица маппинга байтовых кодов глифов на Unicode codepoints, встроенная в объект шрифта PDF. Критична для корректного text extraction. Отсутствие или некорректность ToUnicode → извлечённый текст содержит мусор или символы из Private Use Area.

**TPS (Tokens Per Second)** ([Модуль 08](../08-local-inference/README.md))
Скорость генерации токенов в decode-фазе. Определяется memory bandwidth GPU, не FLOPS. На GTX 1660 (192 GB/s): Compact Q4_K_M model ≈ 30–40 TPS при полном GPU offload; Q8_0 compact model ≈ 15–20 TPS. CPU fallback (частичный offload) даёт 5–10x падение TPS.

**trace** ([Модуль 26](../26-logging/README.md), [Модуль 46](../46-agentops/README.md))
Полное дерево spans, описывающее путь одного запроса через систему. Идентифицируется через `traceId` (16 байт hex). Позволяет увидеть весь путь запроса, включая вызовы в другие сервисы.

**traceId** ([Модуль 26](../26-logging/README.md))
16-байтный hex идентификатор trace. Одинаков для всех spans в пределах одного запроса, включая downstream сервисы. Должен пробрасываться в лог-записи для корреляции logs+traces.

**Tracked Changes** ([Модуль 14](../14-ooxml/README.md))
Механизм отслеживания изменений в DOCX. Удалённый текст — в `w:del/w:delText`, добавленный — в `w:ins/w:t`. Документ с незакрытыми правками содержит одновременно старый и новый текст. При парсинге — явно выбирать какую версию использовать.

**Train/Test Split** ([Модуль 09](../09-evaluator-benchmark/README.md))
Разделение датасета на dev_examples (для разработки промпта) и eval_dataset (для измерения). Строгое разделение обязательно — пересечение инвалидирует метрики.

**Trait** ([Модуль 03](../03-php/README.md))
Механизм горизонтального переиспользования кода в PHP. Trait — это набор методов, который можно подключить в любой класс через `use TraitName`. Решает проблему множественного наследования. При конфликте методов нужна явная резолюция.

**transferable** ([Модуль 37](../37-js-performance/README.md))
Web Worker механизм: передача ownership ArrayBuffer без копирования. `worker.postMessage(buffer, [buffer])` — buffer мгновенно доступен в Worker, в main thread становится detached. Для передачи > 1MB данных.

**transferList** ([Модуль 01](../01-javascript-nodejs/README.md), [Модуль 16](../16-pdfium-wasm/README.md), [Модуль 22](../22-worker-threads/README.md))
Третий аргумент `worker.postMessage(msg, transferList)` в Node.js Worker Threads. Массив `ArrayBuffer` объектов передаваемых в Worker без копирования (zero-copy transfer). После transfer ownership переходит к Worker, оригинальный Buffer становится пустым. Критично для больших bitmap (8+ МБ).

**Transform Stream** ([Модуль 01](../01-javascript-nodejs/README.md))
Duplex поток, преобразующий входные данные в выходные. Пример: gzip-компрессия, шифрование, парсинг CSV.

**tree-shaking** ([Модуль 40](../40-performance-budget/README.md))
Bundler оптимизация: удаление неиспользуемого кода на основе статического анализа ES module imports/exports. Работает только с именованными импортами из ESM пакетов. `import _ from 'lodash'` тянет всё; `import { debounce } from 'lodash-es'` — только debounce.

**TTFB (Time to First Byte)** ([Модуль 28](../28-core-web-vitals-intro/README.md), [Модуль 39](../39-core-web-vitals-diagnostics-rum/README.md))
Время до получения первого байта HTML ответа. Влияет на LCP: медленный TTFB = поздний старт загрузки всего. Оптимизировать через CDN, edge caching, fast server response.

**TurboFan** ([Модуль 37](../37-js-performance/README.md))
V8 optimizing JIT компилятор: максимальная оптимизация для очень горячего кода (≈1000+ вызовов). Assumes стабильные типы. При нарушении — deoptimization.

**Two-Pass Pipeline** ([Модуль 08](../08-local-inference/README.md))
Архитектурный паттерн batch extraction: первый проход — быстрая обработка всего датасета без thinking, второй проход — только объекты с низкой уверенностью или пустыми полями с включённым thinking. Оптимальный баланс скорость/качество.

**Two-Stage Pipeline** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Архитектурный паттерн для VLM extraction: Stage 1 — grounding (низкое разрешение, найти регионы), Stage 2 — extraction (высокое разрешение, только найденные регионы). Снижает суммарный visual token cost при высоком OCR качестве.

**Type Alias (type)** ([Модуль 02](../02-typescript/README.md))
Псевдоним для любого типа — примитива, объекта, union, intersection. В отличие от Interface — не поддерживает declaration merging, но поддерживает сложные вычисляемые типы (conditional, mapped).

**Type Coercion** ([Модуль 07](../07-json-schema/README.md))
Автоматическое приведение типов при валидации: строка `"42"` принимается как число `42`. В Pydantic V2 включён по умолчанию для многих типов — поведение отличается от JSON Schema Draft 7. В LLM extraction pipeline coercion маскирует ошибки модели: явные типы + строгая валидация предпочтительнее.

**Type Declarations** ([Модуль 03](../03-php/README.md))
Явное указание типов параметров и возвращаемых значений функций. Включает скалярные типы (`int`, `string`, `float`, `bool`), классы, интерфейсы, `array`, `callable`, `iterable`, `mixed`, `never`, `void`. При `declare(strict_types=1)` — строгая проверка.

**Type3 font** ([Модуль 15](../15-pdf-internals/README.md))
Тип шрифта PDF где глифы определены как произвольные векторные программы. Стандартного ToUnicode маппинга нет. Text extraction из Type3 шрифтов — ненадёжен. Встречается в корпоративных системах и старых PostScript-генераторах.

## U

**Underfitting (недообучение)** ([Модуль 13](../13-fine-tuning/README.md))
Состояние модели: train_loss и eval_loss падают медленно или не падают. Модель не улавливает паттерн датасета. Причины: слишком малый rank, слишком малый lr, слишком мало данных, слишком мало эпох.

**Union Type** ([Модуль 02](../02-typescript/README.md), [Модуль 07](../07-json-schema/README.md))
Поле, допускающее несколько типов значений: `{"type": ["string", "null"]}`. В Pydantic — `Optional[str]` или `str | None`. При constrained decoding union types увеличивают размер grammar — модель должна выбрать между несколькими допустимыми путями генерации. Для производительности: ограничивай union до 2–3 вариантов, избегай `anyOf` с более чем 5 схемами.

**Unit test** ([Модуль 21](../21-testing/README.md))
Тест изолированного «юнита» в отрыве от внешних зависимостей. Быстрый (< 1ms), но ограниченный по confidence при наличии I/O. Ключевой вопрос архитектора: что считается юнитом в данной системе — функция, модуль или HTTP-эндпоинт?

**unknown** ([Модуль 02](../02-typescript/README.md))
Безопасная альтернатива `any`. Значение типа `unknown` нельзя использовать без явной проверки типа. Правильный тип для данных из внешних источников (API, JSON, пользовательский ввод).

**Unsloth** ([Модуль 13](../13-fine-tuning/README.md))
Python библиотека для ускоренного fine-tuning LLM: 2–3× быстрее стандартного HuggingFace обучения, лучшая VRAM эффективность. Поддерживает QLoRA, VLM fine-tuning (включая CURRENT_LOCAL_MODEL). Версия 2026.3.x актуальна на март 2026.

**UpDownCounter** ([Модуль 26](../26-logging/README.md))
OTel metric: значение может возрастать и убывать. Для текущего состояния: количество активных соединений, размер очереди. `meter.createUpDownCounter()`.

**URL Allowlist** ([Модуль 44](../44-browser-use-computer-use/README.md))
Список разрешённых origins/domains для browser-use agent. Всё вне allowlist запрещено.

**UV** ([Модуль 04](../04-python/README.md))
Современный быстрый пакетный менеджер и инструмент управления виртуальными окружениями для Python, написанный на Rust. Замена `pip` + `venv` + `pyenv`. Установка пакетов в 10-100x быстрее pip. Управляет версиями Python без pyenv. Де-факто стандарт в новых проектах 2025+.

## V

**Value Object** ([Модуль 03](../03-php/README.md))
Неизменяемый объект, определяемый своими значениями, а не идентичностью. Два Value Object с одинаковыми полями — равны. Пример: `Money`, `Email`, `CourtCode`. В PHP реализуется через `readonly` классы (PHP 8.2) или `readonly` свойства (PHP 8.1).

**Vary** ([Модуль 20](../20-backend-caching/README.md), [Модуль 38](../38-http-service-worker-caching/README.md))
HTTP заголовок: указывает по каким заголовкам запроса CDN/браузер должен различать кэшированные варианты. `Vary: Accept-Encoding` = разные кэши для gzip и не-gzip. `Vary: Accept-Language` = разные кэши для разных языков. Злоупотребление `Vary: *` = отключить кэш.

**Verifier** ([Модуль 45](../45-agentic-rag-graph-rag/README.md))
Компонент, который проверяет claims against evidence. Может быть deterministic, LLM-based или hybrid.

**Vision encoder** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Модуль CLOUD_VLM_MODEL/CURRENT_VLM_MODEL, преобразующий image/video в visual tokens. Архитектура и patch size зависят от модели; в production их нужно проверять по выбранной VLM.

**Vitest** ([Модуль 21](../21-testing/README.md))
Test runner от команды Vite. Версия 4.1 (апрель 2026). Нативный ESM, Worker Threads изоляция, совместимый с Jest API. Требует Node.js ≥ 20. Параллельный запуск файлов выявляет temporal coupling, скрытый в однопоточном Jest.

**vLLM** ([Модуль 08](../08-local-inference/README.md))
Production inference сервер с PagedAttention — эффективное управление KV-cache памятью. Оптимален для multi-user, высоконагруженных сценариев. Требует NVIDIA GPU с CUDA. В отличие от llama.cpp: нет GGUF поддержки (только HuggingFace форматы), нет CPU fallback, требует значительно больше VRAM для serving.

**VLM Autocorrect** ([Модуль 10](../10-prompt-engineering-vlm/README.md))
Артефакт VLM: модель «исправляет» опечатки и нестандартные символы при extraction. Специфичен для мультимодальных моделей — в text-only LLM отсутствует. Митигация: явный запрет в system prompt с инструкцией использовать `[?]` для неразличимых символов.

**VML (Vector Markup Language)** ([Модуль 14](../14-ooxml/README.md))
Устаревший формат векторной графики в OOXML (`v:` namespace). Использовался до DrawingML. LibreOffice поддерживает плохо. Не использовать в новых документах — только DrawingML.

## W

**WaitGroup (sync.WaitGroup)** ([Модуль 05](../05-go/README.md))
Примитив ожидания завершения группы горутин. `wg.Add(n)` — добавить счётчик, `wg.Done()` — уменьшить, `wg.Wait()` — блокировать до нуля. Стандартный паттерн параллельной обработки без каналов.

**waiting-children** ([Модуль 18](../18-task-queues/README.md))
Состояние родительской задачи FlowProducer: ждёт завершения всех дочерних задач. Переходит в `waiting` когда последний child завершился. Остаётся в `waiting-children` навсегда если child исчерпал попытки — критическая метрика для мониторинга.

**waitUntilFinished** ([Модуль 18](../18-task-queues/README.md))
Метод `job.waitUntilFinished(queueEvents, timeoutMs)`: блокирует до получения `completed` или `failed` события. Реализует request-reply паттерн поверх очереди. Не использовать для задач с длительным временем обработки в синхронных HTTP endpoint.

**WASM (WebAssembly)** ([Модуль 16](../16-pdfium-wasm/README.md))
Бинарный формат исполняемого кода для веб-платформ и Node.js. Позволяет запускать C/C++ код (PDFium написан на C++) в JavaScript окружении. WASM код работает в изолированной linear memory — отдельно от JS heap.

**WASM linear memory** ([Модуль 16](../16-pdfium-wasm/README.md))
Непрерывный буфер памяти выделяемый WASM модулю. Не управляется JavaScript GC. Размер может расти динамически. PDFium аллоцирует документы и bitmap в WASM linear memory. Утечки в WASM heap не отображаются в стандартных Node.js heap метриках.

**WCAG (Web Content Accessibility Guidelines)** ([Модуль 32](../32-accessibility/README.md))
W3C стандарт web accessibility. WCAG 2.2 (октябрь 2023) — текущий baseline. 87 success criteria, три уровня: A, AA, AAA. Level AA — legal compliance target (EAA, ADA, Section 508).

**WeakReference / WeakMap** ([Модуль 03](../03-php/README.md))
Ссылки, не препятствующие сборке мусора. `WeakMap` (PHP 8.0) позволяет хранить данные, привязанные к объектам, без утечек памяти — когда объект уничтожается, запись в WeakMap исчезает. Полезно для кэшей в долгоживущих процессах.

**WebP** ([Модуль 35](../35-image-optimization/README.md))
Формат Google основанный на VP8 codec. 25–35% меньше JPEG. ≈99% browser support. Поддерживает прозрачность и анимацию. Recommended fallback для AVIF. Быстрее декодируется на low-power devices чем AVIF.

**withoutEnlargement** ([Модуль 11](../11-multi-model-orchestration/README.md), [Модуль 35](../35-image-optimization/README.md))
Параметр Sharp: запрет увеличения изображений меньше целевого размера. При `maxDimension: 1000` и входном изображении 400px — не масштабирует вверх, оставляет как есть. Предотвращает деградацию качества и раздувание файла.

**Word ML** ([Модуль 14](../14-ooxml/README.md))
Неформальное название XML диалекта используемого в `word/document.xml`. Основной namespace: `http://schemas.openxmlformats.org/wordprocessingml/2006/main`, префикс `w:`.

**Workbox** ([Модуль 38](../38-http-service-worker-caching/README.md))
Google библиотека (версия 7.x): набор модулей для Service Worker. Стратегии (CacheFirst, NetworkFirst, StaleWhileRevalidate), плагины (ExpirationPlugin, BackgroundSyncPlugin), precaching. Интегрируется через vite-plugin-pwa.

**Worker pool** ([Модуль 16](../16-pdfium-wasm/README.md))
Пул заранее инициализированных Worker thread'ов. Каждый воркер держит инициализированный `PDFiumLibrary` singleton. Входящие задачи распределяются по свободным воркерам. Краш одного воркера не затрагивает пул — воркер перезапускается.

**Worker Threads** ([Модуль 01](../01-javascript-nodejs/README.md))
Встроенный модуль Node.js для создания потоков с отдельным Event Loop и отдельной памятью. Решает проблему CPU-bound задач в Node.js. Данные между потоками передаются через `postMessage`.

**workflow** ([Модуль 25](../25-cicd/README.md))
YAML файл в `.github/workflows/`. Определяет: events (`on:`), jobs, условия. Может быть вызван вручную (`workflow_dispatch`), по расписанию (`schedule`), или другим workflow (`workflow_call`). Несколько workflow в репозитории — независимы.

**Writable Stream** ([Модуль 01](../01-javascript-nodejs/README.md))
Поток, в который можно только писать. Пример: `fs.createWriteStream()`, HTTP request. Основные методы: `.write()`, `.end()`.

**Write-Behind (Write-Back)** ([Модуль 20](../20-backend-caching/README.md))
Паттерн записи: данные пишутся в кэш немедленно, в DB — асинхронно через буфер. Минимальный write latency. Риск потери данных при падении до flush. Оправдан для некритичных счётчиков, аналитики.

**Write-Through** ([Модуль 20](../20-backend-caching/README.md))
Паттерн записи: данные пишутся в кэш и DB одновременно. Кэш всегда консистентен. Write latency = max(DB, cache). Подходит для read-heavy данных с редкими записями.

## X

**XMP (Extensible Metadata Platform)** ([Модуль 15](../15-pdf-internals/README.md))
XML-формат метаданных встроенный в PDF как stream. Современная замена Info Dictionary. Содержит Dublin Core, PDF, XMP схемы. Более полные метаданные включая историю версий документа.

## Z

**Zero Value** ([Модуль 05](../05-go/README.md))
Каждый тип в Go имеет нулевое значение без явной инициализации: `0` для числовых, `""` для строк, `false` для bool, `nil` для указателей/слайсов/map/каналов/функций. Это не null — zero value часто является полностью рабочим значением. `sync.Mutex{}` — рабочий мьютекс без инициализации.

**Zero-copy** ([Модуль 01](../01-javascript-nodejs/README.md))
Техника передачи данных между потоками без физического копирования в памяти. В Node.js реализуется через `transferList` в `postMessage`. Критично для производительности при работе с большими бинарными данными.

**Zero-shot Prompting** ([Модуль 06](../06-prompt-engineering/README.md))
Запрос без примеров — только инструкция и задача. Работает на сильных instruction-tuned моделях. Baseline для измерения: проверь zero-shot первым, только потом усложняй few-shot или CoT. Для структурированного вывода на слабых или квантизированных локальных моделях — ненадёжно.

## В

**Векторное пространство** ([Модуль 12](../12-rag/README.md))
Многомерное пространство (сотни или тысячи измерений) в котором embedding модель размещает тексты. Семантически близкие тексты — в близких точках пространства. Каждая embedding модель создаёт своё несовместимое пространство.

## К

**Квота** ([Модуль 11](../11-multi-model-orchestration/README.md))
Лимит использования API за период (сутки, минута). Виды: RPD, RPM, TPD, TPM. Тип квоты определяет архитектуру ротатора: daily quota → счётчик с timezone-reset, rate limit → throttling с rolling window.

## М

**монотипизированная функция** ([Модуль 37](../37-js-performance/README.md))
Функция вызываемая всегда с одним типом аргументов. V8 оптимизирует такие функции через inline caching. Полиморфная функция (разные типы) — деоптимизация при смене типа.

## П

**Паттерн оркестрации** ([Модуль 11](../11-multi-model-orchestration/README.md))
Архитектурный шаблон управления несколькими моделями или API. Три базовых класса: Key Rotation (quota management по ключам), Model Rotation (quota management + fallback по моделям), Cascade Filter (оптимизация стоимости через фильтрацию).

**Постраничная обработка** ([Модуль 15](../15-pdf-internals/README.md))
Паттерн обработки больших PDF: загрузить документ один раз, обрабатывать страницы последовательно или батчами, вызывать `page.cleanup()` после каждой. Противопоставляется загрузке всего текста сразу — критично для PDF от 50+ страниц.


