# Модуль 11 — Multi-model Orchestration

> **Для AI-архитектора:** Одиночная модель — частный случай. Реальные pipeline работают с несколькими моделями, каждая из которых может отказать, исчерпать лимит или дать деградацию качества. Оркестрация — это управление этим хаосом на уровне архитектуры, а не костыли в `catch`.
> Один день изучения — три паттерна, два реальных кейса, готовые шаблоны для production.

## Содержание

1. [Типология паттернов оркестрации](#1-типология-паттернов-оркестрации)
2. [Key Rotation — управление квотами](#2-key-rotation--управление-квотами)
3. [Model Rotation Failover](#3-model-rotation-failover)
4. [Cascade Filter — дешёвая модель как gate](#4-cascade-filter--дешёвая-модель-как-gate)
5. [Image Preprocessing — обязательный этап pipeline](#5-image-preprocessing--обязательный-этап-pipeline)
6. [Model Gateway 2026: routing, fallback pools, latency/cost/quality](#6-model-gateway-2026-routing-fallback-pools-latencycostquality)
7. [Реальный кейс: Telegram price detection pipeline](#7-реальный-кейс-telegram-price-detection-pipeline)
8. [Антипаттерны](#8-антипаттерны)
9. [Задачи AI-кодеру](#задачи-ai-кодеру)
10. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

| Инструмент / Сервис | Версия / Лимит | Дата проверки |
|:--|:--|:--|
| Node.js Active LTS | 24.x | март 2026 |
| LM Studio | 0.4.8 | март 2026 |
| Groq free tier — CURRENT_REASONING_MODEL large | 30 RPM / 1 000 RPD / 100K TPD | март 2026 |
| Groq free tier — CURRENT_LOCAL_TEXT_MODEL compact | 30 RPM / 14 400 RPD / 500K TPD | март 2026 |
| Groq free tier — CURRENT_TEXT_MODEL mid | 60 RPM / 1 000 RPD / 500K TPD | март 2026 |
| DaData API free tier | 10 000 запросов/сутки на ключ | март 2026 |
| Sharp | 0.34.x | март 2026 |

---

## 1. Типология паттернов оркестрации

### Три архитектурных класса

Все паттерны multi-model сводятся к трём архетипам с разными осями изменения:

```
┌─────────────────────────────────────────────────────────┐
│                  Multi-model паттерны                   │
├─────────────────┬───────────────────┬───────────────────┤
│  Key Rotation   │  Model Rotation   │  Cascade Filter   │
│                 │                   │                   │
│ Что ротируется: │ Что ротируется:   │ Что ротируется:   │
│ API key         │ Модель/провайдер  │ Ничего — фильтр   │
│                 │                   │                   │
│ Поведение API:  │ Поведение API:    │ Поведение API:    │
│ идентичное      │ может отличаться  │ разное намеренно  │
│                 │                   │                   │
│ Триггер:        │ Триггер:          │ Логика:           │
│ quota/rate      │ quota/error       │ предусловие       │
└─────────────────┴───────────────────┴───────────────────┘
```

### Когда применять

| Задача | Паттерн | Обоснование |
|:--|:--|:--|
| Исчерпание суточной квоты одного API key | Key Rotation | Поведение идентично, нужен только state |
| Исчерпание free tier одной модели на Groq | Model Rotation | Смена модели требует нормализации output |
| Сортировка входных данных перед дорогим вызовом | Cascade Filter | Снижение N вызовов дорогой модели |
| Разные типы задач (текст / vision) | Model Routing | Статический routing без fallback |

**Практический вывод для архитектора:** Model Routing (разные модели для разных задач статически) — простейший случай и не требует особой архитектуры. Key Rotation и Model Rotation — это quota management. Cascade Filter — это оптимизация стоимости и latency. Не путать эти задачи.

---

## 2. Key Rotation — управление квотами

### Механика

Key Rotation решает одну проблему: у тебя N ключей с квотой Q каждый, суммарная пропускная способность N×Q. Нужно равномерно или последовательно распределять запросы так, чтобы не исчерпать один ключ раньше сброса счётчика.

Критичный момент: у разных провайдеров счётчики сбрасываются по-разному.

| Провайдер | Сброс квоты | Timezone |
|:--|:--|:--|
| DaData | UTC+3 midnight (московское время) | MSK |
| Groq | Rolling window (60 сек для RPM) / UTC midnight для RPD | UTC |
| OpenAI | Rolling window | UTC |

Ошибка «проспать» сброс = потеря до 24 часов квоты при неверном расчёте window.

### Реализация: KeyRotator

```typescript
interface ApiKey {
  key: string;
  usedToday: number;
  dailyLimit: number;
  lastResetDate: string; // YYYY-MM-DD в timezone провайдера
}

class KeyRotator {
  private keys: ApiKey[];
  private currentIndex = 0;
  private timezone: string;

  constructor(keys: string[], dailyLimit: number, timezone = 'UTC') {
    this.timezone = timezone;
    this.keys = keys.map(key => ({
      key,
      usedToday: 0,
      dailyLimit,
      lastResetDate: this.getTodayDate(),
    }));
  }

  private getTodayDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: this.timezone });
  }

  private resetIfNewDay(apiKey: ApiKey): void {
    const today = this.getTodayDate();
    if (apiKey.lastResetDate !== today) {
      apiKey.usedToday = 0;
      apiKey.lastResetDate = today;
    }
  }

  getKey(): string | null {
    // ✅ Round-robin с проверкой квоты
    const startIndex = this.currentIndex;
    do {
      const apiKey = this.keys[this.currentIndex];
      this.resetIfNewDay(apiKey);

      if (apiKey.usedToday < apiKey.dailyLimit) {
        apiKey.usedToday++;
        return apiKey.key;
      }

      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    } while (this.currentIndex !== startIndex);

    return null; // все ключи исчерпаны
  }

  // Вызывать при HTTP 429 — не доверяй только счётчику
  markExhausted(key: string): void {
    const apiKey = this.keys.find(k => k.key === key);
    if (apiKey) apiKey.usedToday = apiKey.dailyLimit;
  }
}

// Использование с DaData (MSK timezone)
const rotator = new KeyRotator(
  [process.env.DADATA_KEY_1!, process.env.DADATA_KEY_2!],
  10_000,
  'Europe/Moscow'
);

async function callDaData(address: string) {
  const key = rotator.getKey();
  if (!key) throw new Error('Все ключи DaData исчерпаны на сегодня');

  try {
    return await dadataRequest(address, key);
  } catch (err: any) {
    if (err.status === 429) {
      rotator.markExhausted(key);
      // ❌ Не рекурсия — можно уйти в петлю
      // ✅ Явный retry с новым ключом
      const nextKey = rotator.getKey();
      if (!nextKey) throw new Error('Все ключи исчерпаны');
      return await dadataRequest(address, nextKey);
    }
    throw err;
  }
}
```

### Граничные случаи — где ломается

**Race condition при параллельных запросах.** `getKey()` не thread-safe при параллельных вызовах — можно выдать один ключ дважды и превысить лимит. В Node.js event loop это реальная проблема при `Promise.all`.

```typescript
// ❌ Race condition при параллельных вызовах
const results = await Promise.all(items.map(item => callDaData(item)));

// ✅ Конкурентность через очередь с concurrency limit
import PQueue from 'p-queue';
const queue = new PQueue({ concurrency: 5 }); // не больше 5 одновременных
const results = await Promise.all(items.map(item => queue.add(() => callDaData(item))));
```

**Счётчик в памяти не переживает рестарт.** При падении процесса `usedToday` сбрасывается — можно перерасходовать квоту. Для production: персистентность в Redis или файл.

**Почему это важно архитектору:** Потеря ключа из-за превышения лимита в DaData означает блокировку на сутки. При работе с юридическими адресами и batch-обработкой тысяч записей один race condition = остановка пайплайна на 24 часа.

**Практический вывод для архитектора:** `markExhausted()` при HTTP 429 — обязателен. Не доверяй только локальному счётчику: сервис может иметь другую точку отсчёта window. Всегда обрабатывай 429 как сигнал, а не как исключение.

---

## 3. Model Rotation Failover

### Механика

Model Rotation отличается от Key Rotation одним принципиальным фактором: **поведение модели меняется**. При переключении с `CURRENT_REASONING_MODEL large` на `CURRENT_LOCAL_TEXT_MODEL compact` ты получаешь другой уровень рассуждений, другую длину ответов, возможно другой формат при structured output.

Это значит: нельзя просто подставить новую модель и считать задачу решённой.

```
Groq free tier (перед публикацией проверить актуальные лимиты):
┌──────────────────────────────┬──────┬───────┬─────────┐
│ Модель                       │ RPM  │ RPD   │ TPD     │
├──────────────────────────────┼──────┼───────┼─────────┤
│ CURRENT_REASONING_MODEL large      │ 30   │ 1 000 │ 100K    │
│ CURRENT_TEXT_MODEL mid               │ 60   │ 1 000 │ 500K    │
│ moonshotai/kimi-k2-instruct  │ 60   │ 1 000 │ 300K    │
│ CURRENT_LOCAL_TEXT_MODEL compact         │ 30   │14 400 │ 500K    │
└──────────────────────────────┴──────┴───────┴─────────┘
RPD = requests per day, TPD = tokens per day
```

### Уровни совместимости при ротации

```
Уровень 1: Идентичный API endpoint
  → меняется только поле "model" в запросе
  → выходной формат совместим (стандартный OpenAI)
  → РИСК: качество ответа снижается

Уровень 2: Другой провайдер, совместимый API
  → OpenAI-compatible endpoint (Groq, Together, Ollama)
  → нужно сменить baseURL и key
  → РИСК: специфичные параметры (reasoning, etc.) игнорируются

Уровень 3: Принципиально другой API
  → Anthropic, Gemini — другой формат сообщений
  → нужен adapter layer
  → РИСК: падение без graceful handling
```

### Реализация: ModelRotator

```typescript
interface ModelConfig {
  model: string;
  baseURL: string;
  apiKey: string;
  dailyLimit: number;
  usedToday: number;
  lastResetDate: string;
  // Нормализация вывода если модель даёт другой формат
  outputNormalizer?: (raw: string) => string;
}

class ModelRotator {
  private configs: ModelConfig[];
  private currentIndex = 0;

  constructor(configs: ModelConfig[]) {
    this.configs = configs;
  }

  private getTodayUTC(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private resetIfNewDay(config: ModelConfig): void {
    const today = this.getTodayUTC();
    if (config.lastResetDate !== today) {
      config.usedToday = 0;
      config.lastResetDate = today;
    }
  }

  getConfig(): ModelConfig | null {
    const startIndex = this.currentIndex;
    do {
      const config = this.configs[this.currentIndex];
      this.resetIfNewDay(config);

      if (config.usedToday < config.dailyLimit) {
        config.usedToday++;
        return config;
      }

      this.currentIndex = (this.currentIndex + 1) % this.configs.length;
    } while (this.currentIndex !== startIndex);

    return null;
  }

  markExhausted(model: string): void {
    const config = this.configs.find(c => c.model === model);
    if (config) config.usedToday = config.dailyLimit;
  }
}

const rotator = new ModelRotator([
  {
    model: process.env.CURRENT_REASONING_MODEL || "current-reasoning-model",
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY!,
    dailyLimit: 1_000,
    usedToday: 0,
    lastResetDate: '',
  },
  {
    model: 'CURRENT_TEXT_MODEL mid',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY!,
    dailyLimit: 1_000,
    usedToday: 0,
    lastResetDate: '',
    // ✅ qwen3 в thinking режиме может обернуть ответ в <think>...</think>
    outputNormalizer: (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
  },
  {
    // ✅ Fallback: высокий RPD, низкое качество — для некритичных задач
    model: process.env.CURRENT_LOCAL_TEXT_MODEL || "current-local-text-model",
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY!,
    dailyLimit: 14_400,
    usedToday: 0,
    lastResetDate: '',
  },
]);

async function callWithRotation(prompt: string): Promise<string> {
  const config = rotator.getConfig();
  if (!config) throw new Error('Все модели исчерпали суточный лимит');

  const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.choices.message.content ?? '';
    return config.outputNormalizer ? config.outputNormalizer(raw) : raw;
  } catch (err: any) {
    if (err.status === 429) {
      rotator.markExhausted(config.model);
      return callWithRotation(prompt); // ✅ рекурсия безопасна: стек ограничен числом моделей
    }
    throw err;
  }
}
```

### Граничные случаи — где ломается

**Деградация качества без уведомления.** Когда ротатор переключился на менее мощную модель, pipeline продолжает работать — но качество ответов падает незаметно. В structured output это может означать частичную потерю данных.

```typescript
// ✅ Логировать переключения модели — они должны быть заметны
config.usedToday++;
if (this.currentIndex !== 0) {
  console.warn(`[ModelRotator] Переключение на fallback: ${config.model}`);
}
```

**thinking-токены в ответе.** Модели с reasoning при включённом thinking режиме возвращают `<think>...</think>` блок перед ответом. Это ломает JSON-парсинг и structured output.

**Почему это важно архитектору:** В production нужно знать, на какой модели был обработан каждый запрос. Без этого невозможно отследить деградацию качества после ротации.

**Практический вывод для архитектора:** Выстраивай fallback-цепочку осознанно: 70B → 32B → 8B — это не просто «меньше параметров», это другой уровень рассуждений. Для задач с неоднозначными входными данными fallback на 8B может давать систематически неверные результаты — лучше упасть с ошибкой, чем молча деградировать.

---

## 4. Cascade Filter — дешёвая модель как gate

### Механика

Cascade Filter — паттерн, при котором первая (дешёвая/быстрая) модель выполняет классификацию или детекцию, и только объекты, прошедшие порог, передаются второй (дорогой/медленной) модели.

```
N входных объектов
        │
        ▼
┌───────────────┐
│  Gate Model   │  — быстрая, локальная, дешёвая
│  (classifier) │  — бинарное решение: pass / skip
└───────┬───────┘
        │
    pass (k < N)
        │
        ▼
┌───────────────┐
│  Main Model   │  — мощная, облачная, дорогая
│  (extractor)  │  — работает только с релевантными данными
└───────────────┘
```

Экономика паттерна: если gate пропускает долю `p` от N объектов, стоимость Main Model = `p × cost_main` вместо `N × cost_main`. Паттерн выгоден когда `cost_gate × N + cost_main × p×N < cost_main × N`, то есть когда `cost_gate < cost_main × (1-p)`.

Для локальной gate модели `cost_gate ≈ 0` (только electricity + время). Паттерн выгоден при любом `p < 1`.

### Два подвида паттерна

**Detector Gate** — gate определяет наличие/отсутствие объекта интереса:
```
Вход: изображение из Telegram-поста
Gate: «Есть ли на изображении цена?» → yes/no
Main: «Извлеки название товара и цену» → structured data
```

**Classifier Gate** — gate предварительно классифицирует документ для выбора промпта:
```
Вход: скан документа
Gate: «Тип документа» → [договор, акт, накладная, счёт]
Main: специфичный промпт для каждого типа → structured extraction
```

### Реализация: CascadeFilter

```typescript
interface CascadeItem<T> {
  input: T;
  gateResult?: string;
  mainResult?: string;
  passedGate: boolean;
}

class CascadeFilter<T> {
  constructor(
    private gateModel: (input: T) => Promise<boolean>,
    private mainModel: (input: T, gateContext?: string) => Promise<string>,
    private concurrency = 5
  ) {}

  async process(items: T[]): Promise<CascadeItem<T>[]> {
    const results: CascadeItem<T>[] = [];

    // ✅ Gate — параллельно с ограничением concurrency
    const gateResults = await this.runConcurrent(
      items,
      async (item) => ({ item, passed: await this.gateModel(item) }),
      this.concurrency
    );

    const passed = gateResults.filter(r => r.passed);
    const skipped = gateResults.filter(r => !r.passed);

    console.log(
      `[CascadeFilter] Gate: ${passed.length}/${items.length} прошли (${Math.round(passed.length/items.length*100)}%)`
    );

    // ✅ Main — только прошедшие gate
    const mainResults = await this.runConcurrent(
      passed,
      async ({ item }) => ({ item, result: await this.mainModel(item) }),
      this.concurrency
    );

    for (const { item, passed } of gateResults) {
      const mainResult = mainResults.find(r => r.item === item);
      results.push({
        input: item,
        passedGate: passed,
        mainResult: mainResult?.result,
      });
    }

    return results;
  }

  private async runConcurrent<I, O>(
    items: I[],
    fn: (item: I) => Promise<O>,
    concurrency: number
  ): Promise<O[]> {
    const results: O[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(fn));
      results.push(...batchResults);
    }
    return results;
  }
}
```

### Граничные случаи — где ломается

**False negative на gate уничтожает данные.** Если gate ошибочно отфильтровал объект (сказал «нет цены», а цена была), Main модель его никогда не увидит — ошибка необратима. Gate должен быть настроен на высокий recall, а не precision.

```typescript
// ✅ Gate prompt с bias к false positive — лучше лишний вызов Main, чем пропущенные данные
const gatePrompt = `На изображении есть цена, число со знаком валюты или числовое обозначение стоимости?
Отвечай только "yes" или "no". При любом сомнении — "yes".`;
```

**Gate и Main используют одну GPU очередь.** При локальном запуске gate и main на одной GPU (LM Studio/Ollama) нельзя истинно параллелить — они выстраиваются в очередь. Параллельность возможна только при разных inference backends или cloud/local split.

**Почему это важно архитектору:** Экономика паттерна зависит от качества gate. Gate с recall=0.95 теряет 5% данных безвозвратно. Нужен валидационный прогон на размеченной выборке перед production.

**Практический вывод для архитектора:** Gate — не умная модель с точным решением, а быстрый фильтр с высоким recall. Ошибка gate в сторону «пропусти» — стоит дороже. Ошибка в сторону «отфильтруй» — теряет данные.

---

## 5. Image Preprocessing — обязательный этап pipeline

### Механика

Перед отправкой изображения в любую модель — локальную или облачную — обязателен resize. Это не оптимизация производительности, это архитектурное требование:

- Облачные API тарифицируют по tile-системе (OpenAI: 512×512 tiles). Изображение 3000×4000 = 24 tiles = 24× стоимость против 1000px версии
- Локальные модели имеют фиксированный vision token budget. Превышение → обрезка изображения токенизатором, а не downscale
- Latency растёт нелинейно с размером: 4000px может быть в 10× медленнее 1000px при той же смысловой нагрузке

### Правила размера

| Задача | Максимальный размер | Обоснование |
|:--|:--|:--|
| Цены, короткий текст, логотипы | 1000px по длинной стороне | Достаточно для чёткого текста |
| Документы, мелкий шрифт, таблицы | 1536px по длинной стороне | Максимум для плотных текстовых документов |
| Схемы, чертежи с деталями | 1536px | То же |
| Выше 1536px | ❌ Не отправлять | Нет задач где это даёт прирост качества |

### Реализация: imageOptimize

```typescript
import sharp from 'sharp';
import path from 'path';

interface OptimizeOptions {
  maxDimension?: number; // 1000 | 1536
  quality?: number;      // 80-90 для WebP
  format?: 'webp' | 'jpeg' | 'png';
}

async function optimizeForVLM(
  inputPath: string,
  options: OptimizeOptions = {}
): Promise<Buffer> {
  const {
    maxDimension = 1000,
    quality = 85,
    format = 'webp',
  } = options;

  const pipeline = sharp(inputPath)
    .resize(maxDimension, maxDimension, {
      fit: 'inside',        // ✅ Сохраняет пропорции, не кропает
      withoutEnlargement: true, // ✅ Не увеличивает маленькие изображения
    });

  if (format === 'webp') return pipeline.webp({ quality }).toBuffer();
  if (format === 'jpeg') return pipeline.jpeg({ quality }).toBuffer();
  return pipeline.png().toBuffer();
}

// В pipeline перед отправкой в VLM
async function processImage(imagePath: string): Promise<string> {
  const buffer = await optimizeForVLM(imagePath, {
    maxDimension: 1000,
    format: 'webp',
    quality: 85,
  });

  // base64 для OpenAI-compatible API
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}
```

**Практический вывод для архитектора:** 1000px — дефолт для всего. 1536px — только для документов с плотным текстом, и только если 1000px даёт деградацию качества (проверяется на тестовой выборке, не наугад).

## 6. Model Gateway 2026: routing, fallback pools, latency/cost/quality

Model Gateway — это следующий уровень после простой Model Rotation. Это централизованный слой, который принимает запрос от application/agent и решает:

- какую модель выбрать;
- какой provider использовать;
- нужен ли fallback pool;
- какие latency/cost/quality budgets применить;
- как обработать rate limits;
- как нормализовать output разных моделей;
- как логировать переключения и деградацию качества.

```text
Application / Agent
   │
   ▼
Model Gateway
   │  route_by(task_type, budget, provider_state)
   ▼
Provider Pool
   ├── primary: quality model
   ├── fallback: cheaper model
   ├── local: SLM for simple tasks
   └── emergency: degraded mode
```

### Routing dimensions

| Dimension | Пример |
|:--|:--|
| task type | extraction, summarization, reasoning, vision |
| risk level | low/medium/high/critical |
| latency budget | < 2s, < 10s, async |
| cost budget | $0.001, $0.01, $0.10 |
| data policy | no external provider for secrets/PII |
| quality target | schema valid, hallucination rate, judge score |

### Fallback pools

Fallback pool должен быть не «любая модель», а заранее проверенная цепочка:

```text
primary → fallback quality → fallback cheap → local SLM → degraded deterministic response
```

Для каждого fallback нужно знать:

- output schema compatibility;
- required normalizer;
- quality delta;
- cost delta;
- latency delta;
- provider risk.

### Rate-limit strategy

Rate limits обрабатываются на уровне gateway:

- retry-after;
- circuit breaker;
- per-provider quotas;
- per-model quotas;
- token budget;
- request shedding;
- fallback switch.

Главное правило: gateway должен быть observability-first. Если fallback сработал, команда должна увидеть не только факт fallback, но и причину, модель, latency, cost и качество.

---

## 7. Реальный кейс: Telegram price detection pipeline

### Контекст

**Входные данные:** 2–3 тысячи изображений, извлечённых из папок Telegram-постов после парсинга канала. Большинство изображений — фото товаров, инфографика, скриншоты. Часть содержит цены (кириллические ценники, рукописные прайсы, скриншоты сайтов), часть — нет.

**Цель:** Для изображений с ценами — сгенерировать описание товара. Для остальных — пропустить.

**Железо:** GTX 1660 6 ГБ, Ryzen 5 3600, 64 ГБ RAM.

### Гипотеза

Интуиция: маленькие модели (0.8B, 2B) не справятся с детекцией кириллического текста на фото с разным освещением, сложным шрифтом, рукописью. Нужно сразу отправлять всё в облачную модель.

### Результат

SLM gate и 2B на GTX 1660:
- Детекция цен на ценниках с кириллицей — корректно
- Рукописный курсив на ценниках — корректно
- Latency: менее 2 секунд на изображение
- Вывод строго «yes»/«no» при правильном промпте

Промпт определил результат, а не размер модели.

### Вывод, противоречащий интуиции

0.8B на локальном железе оказалась достаточной для детекции — задача, которую интуитивно требовала облачной модели. Детекция (есть/нет) принципиально проще экстракции (что именно написано). Малые модели справляются с детекцией при качественном промпте.

Реальная граница: не «маленькая vs большая модель», а «детекция vs экстракция». Gate может быть минимальной моделью. Main модель получает только отфильтрованное подмножество.

### Архитектура pipeline

```
Telegram posts folder
        │
        ▼
  Image extraction
  (fs.readdir + filter by extension)
        │
        ▼
  ┌─────────────┐
  │  Sharp      │  resize → 1000px, webp
  │  preprocess │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Gate VLM   │  SLM gate локально
  │  LM Studio  │  «Есть ли цена на изображении?»
  └──────┬──────┘
         │
    yes (~X%)    ← статистика будет добавлена после завершения проекта
         │
         ▼
  ┌─────────────┐
  │  Main VLM   │  облачная модель
  │  (cloud)    │  «Опиши товар и укажи цену»
  └─────────────┘
```

> **Статистика фильтрации** (процент изображений прошедших gate, breakdown по категориям) будет добавлена после завершения проекта.

**Практический вывод для архитектора:** Прежде чем выбирать модель — определи класс задачи. Detection и extraction — разные задачи с разными требованиями к размеру модели. Cascade позволяет использовать дешёвое локальное железо там, где это достаточно, и платить за облако только там, где это необходимо.

---

## 8. Антипаттерны

### «Универсальная мощная модель для всего»

**Выглядит правильно:** одна большая модель, один API, простой код.

**Почему ошибка:** стоимость растёт линейно с N запросов. При 2000 изображений и $0.01/запрос cloud = $20. С Cascade Filter при 30% pass rate = $6. На больших объёмах разница принципиальная.

---

### «Добавить fallback = решить проблему качества»

**Выглядит правильно:** при ошибке переключаемся на другую модель.

**Почему ошибка:** fallback решает проблему доступности, не качества. Если 70B возвращает ошибку из-за превышения квоты и мы переключаемся на 8B — мы продолжаем работу, но с другим уровнем качества. Без логирования и метрик это необнаруживаемая деградация.

---

### «Ротировать без state»

**Выглядит правильно:** простой round-robin без счётчиков.

**Почему ошибка:** без state ротатор не знает, что ключ исчерпан. После первого 429 он продолжает пробовать тот же ключ. Результат: каскад 429 ошибок вместо переключения.

---

### «Gate с высокой precision вместо recall»

**Выглядит правильно:** меньше ложных срабатываний = меньше лишних вызовов Main.

**Почему ошибка:** false negative на gate — потеря данных. False positive — лишний вызов Main. В большинстве extraction-задач потеря данных дороже лишнего вызова. Gate должен ошибаться в сторону «пропусти».

---

### «Оптимизировать latency до валидации gate quality»

**Выглядит правильно:** pipeline работает, можно ускорить.

**Почему ошибка:** если gate пропускает 5% false negatives — это невидимая потеря данных. Оптимизированный быстрый pipeline с плохим gate работает быстро и неправильно. Сначала — recall на размеченной выборке, потом — оптимизация скорости.

---

## Anti-checklist ☠️

- [ ] «Универсальная мощная модель для всего» — стоимость растёт линейно с N запросов
- [ ] «Добавить fallback = решить проблему качества» — fallback решает доступность, не качество
- [ ] Ротировать без state — после первого 429 продолжает пробовать тот же ключ
- [ ] Gate с высокой precision вместо recall — false negative теряет данные безвозвратно
- [ ] Gate и Main на одной GPU в одном pipeline — не параллельны, выстраиваются в очередь
- [ ] Оптимизировать latency до валидации gate quality — быстрый pipeline с плохим gate работает быстро и неправильно

## Задачи AI-кодеру

**Задача 1 — Key Rotation**

Плохая формулировка:
> «Напиши ротацию API ключей»

Хорошая формулировка:
> «Реализуй `KeyRotator` на TypeScript. Конструктор принимает массив ключей, суточный лимит и IANA timezone (например `"Europe/Moscow"`). Метод `getKey()` возвращает ключ с остатком квоты или `null` если все исчерпаны. Метод `markExhausted(key)` принудительно обнуляет остаток. Счётчики сбрасываются при смене даты в указанной timezone. Добавь unit-тест на кейс где все ключи исчерпаны в один день и сбрасываются на следующий.»

Формула: что делает + timezone-aware reset + конкретные методы + edge case тест.

---

**Задача 2 — Model Rotation с нормализацией**

Плохая формулировка:
> «Добавь fallback на другую модель при ошибке»

Хорошая формулировка:
> «Реализуй `ModelRotator` для Groq API (OpenAI-compatible). Порядок моделей: `CURRENT_REASONING_MODEL large` (лимит 1000 RPD) → `CURRENT_TEXT_MODEL mid` (лимит 1000 RPD) → `CURRENT_LOCAL_TEXT_MODEL compact` (лимит 14400 RPD). Переключение при HTTP 429 и при исчерпании суточного счётчика. Для `CURRENT_TEXT_MODEL mid` добавь `outputNormalizer` который удаляет `<think>...</think>` блоки из ответа. Логируй каждое переключение модели с именем модели и причиной переключения.»

Формула: конкретные модели + лимиты из документации + normalizer + observability.

---

**Задача 3 — Cascade Filter для изображений**

Плохая формулировка:
> «Сделай фильтрацию изображений перед отправкой в GPT»

Хорошая формулировка:
> «Реализуй двухэтапный pipeline обработки изображений на Node.js 24. Этап 1 (gate): локальная VLM через LM Studio OpenAI-compatible API, промпт на детекцию цен, ответ `yes`/`no`. Этап 2 (main): облачный API, промпт на извлечение названия товара и цены в JSON `{name: string, price: string, currency: string}`. Перед каждым этапом — resize через Sharp до 1000px (fit: inside, withoutEnlargement: true, format: webp). Concurrency: максимум 3 параллельных запроса к gate (одна локальная GPU), максимум 5 к main. Логируй процент прошедших gate.»

Формула: конкретный стек + конкретные параметры resize + concurrency ограничения + формат вывода.

---

## Чеклист архитектора

### Quota management
- [ ] Определён тип лимита: RPM, RPD, TPM, TPD — разные окна сброса
- [ ] Timezone провайдера учтена при расчёте сброса счётчика
- [ ] HTTP 429 обрабатывается как сигнал к `markExhausted`, а не просто retry
- [ ] State счётчиков переживает рестарт процесса (Redis / файл)
- [ ] Race condition при `Promise.all` устранён через concurrency limit

### Model Rotation
- [ ] Порядок fallback-цепочки осознан: качество снижается при каждом шаге
- [ ] Переключения модели логируются с причиной
- [ ] `outputNormalizer` добавлен для моделей с thinking-блоками
- [ ] Есть метрика «сколько запросов прошло через fallback» — невидимая деградация обнаруживаема

### Cascade Filter
- [ ] Gate настроен на recall, а не precision — false negative дороже false positive
- [ ] Gate валидирован на размеченной выборке до запуска full pipeline
- [ ] Логируется процент прошедших gate — аномалии обнаруживаемы
- [ ] GPU конкуренция учтена: gate и main на одном железе не параллельны

### Image preprocessing
- [ ] Все изображения проходят resize перед отправкой в VLM
- [ ] Дефолт: 1000px. 1536px — только для плотного текста, проверено на выборке
- [ ] Формат: WebP quality 85 — баланс размера и качества

---

*Модуль 11 завершён.*
*Следующий: [Модуль 12 — RAG — архитектура и паттерны](../12-rag/README.md)*
