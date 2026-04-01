# Модуль 22 — Worker Threads / Piscina

> **Для AI-архитектора:** worker_threads — это не про «сделать быстрее», а про выбор: когда Node.js event loop является узким местом, а когда нет. AI-кодер создаст пул для любой медленной операции — задача архитектора остановить это там, где overhead съест весь профит.
> Один день изучения — механика V8 isolates, SharedArrayBuffer, Piscina pool management.

---

## Содержание

1. [Worker Threads — механика под капотом](#1-worker-threads-механика)
2. [Worker Threads vs child_process vs cluster](#2-worker-threads-vs-childprocess-vs-cluster)
3. [SharedArrayBuffer и Atomics](#3-sharedarraybuffer-и-atomics)
4. [Piscina — pool management](#4-piscina)
5. [Архитектурные паттерны применения](#5-архитектурные-паттерны)
6. [Антипаттерны](#антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Node.js | **24 LTS** | worker_threads встроен |
| Piscina | **5.1.4** | Production worker pool |
| tinypool | **2.1.0** | Минималистичный pool (используется внутри Vitest) |
| @napi-rs/nice | **2.x** | Опциональный аддон для приоритетов потоков в Linux |

---

## 1. Worker Threads — механика

### V8 Isolates и модель памяти

Каждый Worker Thread — это отдельный V8 Isolate внутри одного OS-процесса. В отличие от `child_process`, воркеры разделяют память процесса, но не разделяют JavaScript heap — у каждого isolate своя куча, свой GC, свой event loop.

```
OS Process (Node.js)
├── Main Thread
│   ├── V8 Isolate (heap: 200MB)
│   ├── libuv event loop
│   └── Node.js APIs
│
├── Worker Thread 1
│   ├── V8 Isolate (heap: отдельный)
│   ├── libuv event loop (отдельный)
│   └── Node.js APIs (subset)
│
└── Worker Thread 2
    ├── V8 Isolate (heap: отдельный)
    └── ...

    Общее: OS memory space, SharedArrayBuffer, native addons
```

Следствие: данные между потоками передаются **сериализацией** (structured clone algorithm) или **transfer** (zero-copy для ArrayBuffer). Объекты с методами, замыкания, функции — не передаются.

### Structured Clone vs Transfer

```typescript
import { Worker, workerData, parentPort } from 'worker_threads'

// ❌ Structured clone — копирование. 100MB Buffer = 100MB copy overhead
worker.postMessage({ buffer: largeBuffer })

// ✅ Transfer — zero-copy. Buffer передаётся, в main thread становится detached
worker.postMessage({ buffer: largeBuffer }, [largeBuffer.buffer])
// После transfer: largeBuffer.byteLength === 0 в main thread

// ✅ SharedArrayBuffer — без копирования, оба потока читают/пишут одну память
const shared = new SharedArrayBuffer(1024 * 1024) // 1MB
worker.postMessage({ shared }) // shared — не в transferList, он и так shared
```

### workerData — инициализация воркера

`workerData` передаётся при создании воркера, до старта event loop. Structured clone, не transfer. Подходит для конфигурации, не для больших данных.

```typescript
// main.ts
import { Worker } from 'worker_threads'

const worker = new Worker('./worker.js', {
  workerData: {
    dbUrl: process.env.DATABASE_URL,   // ✅ конфигурация
    modelPath: '/models/qwen3.5-4b',   // ✅ пути
    // ❌ нельзя: функции, классы с методами, Promises, WeakMap
  }
})

// worker.ts
import { workerData, parentPort } from 'worker_threads'

const { dbUrl, modelPath } = workerData
// Инициализировать тяжёлые ресурсы один раз при старте воркера
const db = await initDb(dbUrl)

parentPort!.on('message', async (task) => {
  const result = await processWithDb(db, task)
  parentPort!.postMessage(result)
})
```

### Граничные случаи — где ломается

**ESM воркеры в Node.js 24**: `filename` должен быть абсолютным URL, не path-строкой.

```typescript
// ❌ Падает при ESM
new Worker('./worker.js')

// ✅ ESM-совместимо
new Worker(new URL('./worker.js', import.meta.url))
// или
import { fileURLToPath } from 'url'
new Worker(fileURLToPath(new URL('./worker.js', import.meta.url)))
```

**Piscina + TypeScript**: `.ts` файлы нельзя передать напрямую в `filename`. Нужен workerWrapper.

```typescript
// workerWrapper.js (CommonJS-совместимый runtime wrapper)
const { workerData } = require('worker_threads')
require('tsx/cjs') // или ts-node/register
require(workerData.fullpath)

// main.ts
const piscina = new Piscina({
  filename: resolve(__dirname, './workerWrapper.js'),
  workerData: { fullpath: resolve(__dirname, './worker.ts') },
})
```

**Почему это важно архитектору:** AI-кодер создаст воркер с `.ts` напрямую — это не упадёт при запуске, упадёт при первом `piscina.run()`. Шаблон workerWrapper нужно закрепить в проекте до начала работы.

---

## 2. Worker Threads vs child_process vs cluster

### Матрица выбора

```
Критерий              | worker_threads    | child_process     | cluster
----------------------|-------------------|-------------------|------------------
Изоляция памяти       | Нет (SAB доступен)| Полная            | Полная
Общая память (SAB)    | ✅                | ❌                | ❌
Языки                 | Только JS/WASM    | Любой             | Только JS
Передача данных       | Structured clone  | IPC / stdin/pipe  | IPC
Overhead создания     | ~50ms             | ~100ms            | ~100ms
Подходит для          | CPU-bound JS      | Native CLI tools  | HTTP load balance
```

### Когда worker_threads НЕ поможет

Node.js event loop блокируется только CPU-bound операциями. Для I/O Node.js использует libuv thread pool (по умолчанию 4 потока) — он уже параллелен без дополнительного кода.

```
Проблема              | Решение              | НЕ решение
----------------------|----------------------|------------------
Медленный SQL-запрос  | Индекс, connection   | Worker Threads
                      | pool                 |
Медленный HTTP-запрос | Retry, CDN, кэш      | Worker Threads
Медленный fs.readFile | Нормально, libuv     | Worker Threads
CPU: парсинг 50MB CSV | ✅ Worker Threads    |
CPU: bcrypt с 12 cost | ✅ Worker Threads    |
CPU: Sharp resize     | ✅ Worker Threads    |
CPU: PDF rendering    | ✅ Worker Threads    |
```

**Практический вывод для архитектора:** профилируй сначала. `node --prof` или `clinic.js flame` покажет, где реально застрял event loop. Добавление воркера к I/O-bound задаче увеличит latency из-за serialization overhead.

### Граничные случаи — где ломается

**libuv thread pool и Worker Threads**: native addons (Sharp, bcrypt, Argon2) используют libuv thread pool, не V8 worker threads. По умолчанию libuv pool = 4 потока. При запуске 8 Piscina воркеров с Sharp каждый воркер конкурирует за libuv потоки — throughput не растёт линейно.

```bash
# Увеличить libuv thread pool до числа физических ядер
UV_THREADPOOL_SIZE=8 node server.js
```

**Почему это важно архитектору:** добавление Piscina поверх Sharp без `UV_THREADPOOL_SIZE` — классический пример, когда воркеры не дают прироста производительности и непонятно почему.

---

## 3. SharedArrayBuffer и Atomics

### Механика SharedArrayBuffer

SharedArrayBuffer — единственный способ разделить память между потоками без копирования. В отличие от обычного ArrayBuffer, после передачи в воркер оба потока читают и пишут одни и те же байты.

```typescript
// main.ts — создание разделяемого буфера
const sharedBuffer = new SharedArrayBuffer(
  Int32Array.BYTES_PER_ELEMENT * 1000  // 4000 байт
)
const sharedArray = new Int32Array(sharedBuffer)

// Заполнить данными в main thread
for (let i = 0; i < 1000; i++) sharedArray[i] = i

// Передать воркерам — не через transferList, SAB не передаётся, а разделяется
worker1.postMessage({ sharedBuffer, range: [0, 499] })
worker2.postMessage({ sharedBuffer, range: [500, 999] })

// worker.ts — оба воркера пишут в одну память
const { sharedBuffer, range } = workerData
const shared = new Int32Array(sharedBuffer)
const [start, end] = range
for (let i = start; i <= end; i++) shared[i] *= 2
```

### Atomics — thread-safe операции

Конкурентная запись без Atomics создаёт race condition: два потока читают значение, оба инкрементируют, один перезаписывает другого.

```typescript
const counter = new Int32Array(new SharedArrayBuffer(4))

// ❌ Race condition
counter[0]++ // read → increment → write: не атомарно

// ✅ Атомарная операция — read-modify-write нельзя прервать
Atomics.add(counter, 0, 1)
Atomics.sub(counter, 0, 1)
Atomics.load(counter, 0)       // атомарное чтение
Atomics.store(counter, 0, 42)  // атомарная запись

// ✅ Синхронизация потоков через wait/notify
// В воркере — ждать сигнала от main:
Atomics.wait(sharedInt32, 0, 0)  // блокировать пока index 0 === 0

// В main thread — разбудить воркер:
Atomics.store(sharedInt32, 0, 1)
Atomics.notify(sharedInt32, 0, 1) // разбудить 1 поток
```

**Важно**: `Atomics.wait()` **блокирует поток**. В main thread использовать нельзя — заблокирует event loop. Только в воркерах.

### Граничные случаи — где ломается

**COOP/COEP в браузере**: SharedArrayBuffer требует заголовков `Cross-Origin-Opener-Policy: same-origin` и `Cross-Origin-Embedder-Policy: require-corp`. В Node.js это ограничение отсутствует — код работает. При портировании логики в browser context — упадёт.

**TypedArray views**: SharedArrayBuffer — это сырая память. TypedArray (Int32Array, Float64Array, Uint8Array) — это view поверх неё с разным размером элемента. Запись через Int32Array и чтение через Float64Array того же буфера — undefined behavior.

**Почему это важно архитектору:** SharedArrayBuffer оправдан только при передаче данных > 10MB между потоками в tight loop. Для обычных задач с Piscina — structured clone достаточен и безопаснее.

---

## 4. Piscina

### Pool management — механика

Piscina управляет пулом воркеров: распределяет задачи, контролирует размер очереди, собирает статистику. Воркер — это файл с default export функцией.

```typescript
// worker.ts
export default async function processDocument(
  task: { content: string; options: ProcessOptions }
): Promise<ProcessResult> {
  // Этот код выполняется в отдельном V8 Isolate
  return await heavyCpuWork(task.content, task.options)
}

// pool.ts
import Piscina from 'piscina'
import { resolve } from 'path'

export const documentPool = new Piscina({
  filename: resolve(__dirname, './worker.js'),

  // Число воркеров: default = Math.min(cpus, 4)
  minThreads: 2,
  maxThreads: 8,

  // Защита от memory exhaustion при burst нагрузке
  maxQueue: 100,            // очередь max 100 задач
  // При переполнении: piscina.run() бросает ошибку
  // Альтернатива: maxQueue: 'auto' = maxThreads * 10

  // Ограничение памяти воркера (Node.js 12.19+)
  resourceLimits: {
    maxOldGenerationSizeMb: 256,
    maxYoungGenerationSizeMb: 64,
  },
})

// Использование
const result = await documentPool.run(
  { content: largeText, options: { format: 'json' } },
  { signal: AbortSignal.timeout(5000) } // таймаут через AbortController
)
```

### Статистика и мониторинг

```typescript
// Метрики пула — важны для capacity planning
console.log({
  threads: documentPool.threads.length,    // активные воркеры
  queueSize: documentPool.queueSize,       // задач в очереди
  utilization: documentPool.utilization,  // 0–1, насколько загружены воркеры
  runTime: documentPool.runTime,           // { average, mean, stddev, p50, p99 }
  waitTime: documentPool.waitTime,         // время ожидания в очереди
})

// Utilization > 0.8 постоянно → увеличить maxThreads
// waitTime.p99 > 1000ms → maxQueue слишком большой или maxThreads мал
// Frequent maxQueue errors → backpressure нужен на уровень выше
```

### Named exports для multi-task воркера

Один воркер может выполнять разные функции:

```typescript
// worker.ts — несколько экспортов
export async function resize(task: ResizeTask) { ... }
export async function convert(task: ConvertTask) { ... }
export async function thumbnail(task: ThumbnailTask) { ... }

// main.ts — указать name при вызове
await imagePool.run(task, { name: 'resize' })
await imagePool.run(task, { name: 'thumbnail' })
```

### Граничные случаи — где ломается

**Warm vs cold workers**: при `minThreads: 0` первые задачи медленнее — время старта воркера (~50ms). При `minThreads: 2` два воркера всегда живы и прогреты. Для latency-sensitive систем — всегда `minThreads > 0`.

**maxQueue: 'auto' в production**: `maxQueue: 'auto'` = `maxThreads * 10`. При `maxThreads: 8` и 100ms задачах — очередь может вырасти до 80 задач × 100ms = 8 секунд latency для последней задачи. Явный лимит + graceful rejection лучше.

**Cancellation**: `AbortSignal` отменяет ожидание в очереди, но не прерывает уже запущенный воркер. Если нужна отмена внутри воркера — передавать SharedArrayBuffer с флагом прерывания.

**Почему это важно архитектору:** Piscina без `maxQueue` в burst-нагрузке накапливает очередь в памяти до OOM. Это не баг Piscina — это ответственность архитектора задать backpressure.

---

## 5. Архитектурные паттерны

### Dedicated pools per task type

Один shared pool для разных задач создаёт приоритетные инверсии: медленный PDF-рендер занимает воркер, быстрый bcrypt ждёт очереди.

```typescript
// ✅ Отдельные пулы с разными параметрами
export const imagePool = new Piscina({
  filename: resolve(__dirname, './workers/image.js'),
  maxThreads: 4,   // CPU-intensive, ограничен числом ядер
  maxQueue: 50,
})

export const hashPool = new Piscina({
  filename: resolve(__dirname, './workers/hash.js'),
  maxThreads: 8,   // bcrypt с libuv, больше потоков = больше throughput
  maxQueue: 200,
})

export const pdfPool = new Piscina({
  filename: resolve(__dirname, './workers/pdf.js'),
  maxThreads: 2,   // memory-heavy, мало воркеров но большой лимит памяти
  maxQueue: 20,
  resourceLimits: { maxOldGenerationSizeMb: 512 },
})
```

### Backpressure через maxQueue

При переполнении очереди Piscina бросает `Error: queue is full`. Правильная обработка — signal upstream, не retry:

```typescript
async function enqueueDocument(task: Task): Promise<Result> {
  try {
    return await documentPool.run(task)
  } catch (err) {
    if (err.message.includes('queue is full')) {
      // Вернуть 429 или поместить в BullMQ для отложенной обработки
      throw new ServiceUnavailableError('Processing queue is full, retry later')
    }
    throw err
  }
}
```

### Инициализация тяжёлых ресурсов в воркере

Загружать ML-модель или открывать DB-соединение один раз при старте воркера, не при каждой задаче:

```typescript
// worker.ts — инициализация на уровне модуля (выполняется один раз)
import { workerData } from 'worker_threads'

// Top-level await в ESM воркере — работает в Node.js 24
const model = await loadModel(workerData.modelPath) // ~2s, один раз
const db = await createConnection(workerData.dbUrl)  // один раз

// Эта функция вызывается Piscina для каждой задачи
export default async function process(task: Task): Promise<Result> {
  // model и db уже инициализированы — только inference/query
  return await model.run(task.input)
}
```

### Граничные случаи — где ломается

**Worker recreation при OOM**: при превышении `resourceLimits.maxOldGenerationSizeMb` Node.js убивает воркер. Piscina автоматически создаёт новый — но инициализация (загрузка модели, открытие соединения) выполняется заново. Время рекавери = время cold start воркера.

**Почему это важно архитектору:** если воркер падает регулярно по OOM — увеличение `resourceLimits` не решение. Нужно профилировать утечки внутри воркера отдельно от main thread.

---

## Антипаттерны

**1. Worker Threads для I/O-bound задач**
Медленный Redis-запрос решается пулом соединений, не воркером. Worker добавит ~1ms serialization overhead к каждому запросу. Профилируй перед добавлением воркеров.

**2. Создавать воркер на каждый запрос**
```typescript
// ❌ Новый воркер на каждый HTTP-запрос: ~50ms overhead, утечка при burst
app.post('/process', async (req, res) => {
  const worker = new Worker('./worker.js', { workerData: req.body })
  const result = await new Promise((resolve) => worker.on('message', resolve))
  res.json(result)
})

// ✅ Переиспользовать пул
app.post('/process', async (req, res) => {
  const result = await pool.run(req.body)
  res.json(result)
})
```

**3. Atomics.wait() в main thread**
Блокирует event loop полностью. Node.js не обработает ни одного запроса пока wait не завершится. Используй только в воркерах.

**4. Передавать большие объекты через postMessage без transfer**
100MB JSON через structured clone = 100MB копирование + GC pressure. Для больших бинарных данных — всегда transferList или SharedArrayBuffer.

**5. Один пул для задач с разным временем выполнения**
Задача 5s блокирует воркер. Если в пуле 4 воркера и 4 медленных задачи — быстрые задачи ждут в очереди. Разделяй пулы по времени выполнения (fast/slow lanes).

---

## Задачи AI-кодеру

**Плохая формулировка:**
> «Перенеси обработку изображений в worker threads»

**Хорошая формулировка:**
> «Создай Piscina 5.1.4 пул для обработки изображений через Sharp.
> Файл воркера: `workers/image.worker.ts`, обёртка для TypeScript: `workers/workerWrapper.js`.
> Экспорты воркера: `resize(task: ResizeTask)`, `thumbnail(task: ThumbnailTask)`.
> Конфиг пула: `maxThreads: 4`, `maxQueue: 50`, `resourceLimits.maxOldGenerationSizeMb: 256`.
> В main — экспортировать синглтон `imagePool`. При `queue is full` — бросать `ServiceUnavailableError`.
> UV_THREADPOOL_SIZE выставить в README к модулю.»

---

**Плохая формулировка:**
> «Добавь счётчик обработанных документов через SharedArrayBuffer»

**Хорошая формулировка:**
> «Создай `SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2)` для счётчиков: index 0 — processed, index 1 — errors.
> В воркере инкрементировать через `Atomics.add`, не через прямое присваивание.
> В main thread читать через `Atomics.load`. `Atomics.wait()` не использовать — только в воркерах.
> Передавать буфер через `workerData` при создании Piscina пула.»

---

## Чеклист архитектора

**Принятие решения**
- [ ] Измерен event loop lag (`--prof` или `clinic.js`) — подтверждено что узкое место CPU, не I/O
- [ ] Оценён serialization overhead (размер данных × время сериализации)
- [ ] Выбрана стратегия: worker_threads / child_process / cluster — обоснована

**Конфигурация пула**
- [ ] Отдельные пулы для задач с разным временем выполнения
- [ ] `maxQueue` задан явно — не `'auto'` в production
- [ ] `resourceLimits` задан для memory-heavy воркеров
- [ ] `minThreads > 0` для latency-sensitive задач

**Worker файл**
- [ ] TypeScript воркеры используют workerWrapper паттерн
- [ ] Тяжёлые ресурсы (модели, соединения) инициализированы на уровне модуля, не в функции-обработчике
- [ ] ESM filename через `new URL('./worker.js', import.meta.url)`

**Memoria и безопасность**
- [ ] `UV_THREADPOOL_SIZE` задан если воркеры используют native addons (Sharp, bcrypt)
- [ ] `Atomics.wait()` присутствует только в воркерах, не в main thread
- [ ] Переполнение `maxQueue` обрабатывается с backpressure, не retry

---

*Модуль 22 завершён.*
*Следующий: [Модуль 23 — Rate limiting паттерны](../23-rate-limiting/README.md)*
