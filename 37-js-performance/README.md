# Модуль 37 — JavaScript Performance и Memory Management

> **Для AI-архитектора:** JS performance — не про микрооптимизации синтаксиса. Это три уровня: main thread (не блокировать > 50ms), memory (не создавать leaks в long-lived приложениях), V8 JIT (не деоптимизировать горячий код). Ошибка большинства команд: оптимизируют синтаксис (избегают `forEach`, используют `for` loops) вместо архитектурных решений: Web Workers для CPU-bound работы, `WeakRef` для кешей без memory leak, правильные data structures для V8 inline caching.
> Один день изучения — main thread budget, V8 JIT/deoptimization, memory leaks паттерны, WeakRef/FinalizationRegistry, Web Workers + transferables + SharedArrayBuffer, scheduling API.

---

## Содержание

1. [Main thread budget](#1-main-thread-budget)
2. [V8 JIT — что помогает и что деоптимизирует](#2-v8-jit)
3. [Memory leaks — паттерны и диагностика](#3-memory-leaks)
4. [WeakRef и FinalizationRegistry](#4-weakref)
5. [Web Workers и офлоад](#5-web-workers)
6. [Scheduling API](#6-scheduling)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| API / инструмент | Статус | Поддержка |
| :-- | :-- | :-- |
| WeakRef + FinalizationRegistry | **ES2021, Baseline 2021** | Все major browsers |
| Web Workers | **Stable** | Все browsers |
| SharedArrayBuffer | **Требует COOP+COEP** | Chrome 68+, FF 79+, Safari 15.2+ |
| Atomics | **ES2017** | Все major browsers |
| `scheduler.postTask()` | **Baseline 2024** | Chrome 94+, FF 101+, Safari 17+ |
| `scheduler.yield()` | **Baseline 2024** | Chrome 115+, FF 131+, Safari 17.4+ |
| Comlink | **4.x** | Web Worker abstraction |

---

## 1. Main thread budget

### 50ms правило и INP

```
Main thread бюджет:
  50ms — максимальное время задачи без отдачи управления
  (RAIL модель: Response < 100ms, Animation < 16ms frame)

Если задача > 50ms:
  → Long Animation Frame (LoAF) entry (см. Модуль 33)
  → blockingDuration > 0 → плохой INP
  → jank (пропущенные frames)

Что блокирует main thread:
  ✗ Синхронный JSON.parse() большого файла (>100KB)
  ✗ Синхронный sort/filter массива >10K элементов
  ✗ DOM batch updates в одном frame (>1000 элементов)
  ✗ Синхронный import (не dynamic)
  ✗ Layout thrashing (offsetWidth в цикле)
```

### Измерение — что и как

```typescript
// Профилирование горячего пути: performance.mark
performance.mark('sort:start')
const sorted = largeArray.sort(compareFn)
performance.mark('sort:end')
const measure = performance.measure('sort', 'sort:start', 'sort:end')
console.log(`Sort: ${measure.duration.toFixed(2)}ms`)

// Если > 50ms → кандидат для Web Worker или chunking

// Обнаружение long tasks в development:
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.warn(`Long task: ${entry.duration.toFixed(0)}ms`, entry)
    }
  }
})
observer.observe({ type: 'long-animation-frame', buffered: true })
```

---

## 2. V8 JIT

### Ignition → Maglev → TurboFan pipeline

```
Код выполняется впервые:
  Ignition (интерпретатор) — медленно, собирает type feedback

Горячий код (~100 вызовов):
  Maglev (mid-tier JIT, V8 2023+) — быстрая компиляция

Очень горячий код (~1000+ вызовов):
  TurboFan (optimizing JIT) — максимальная оптимизация
  Assumption: типы аргументов стабильны (monomorphic)

При нарушении assumption:
  Deoptimization (bailout) → назад в Ignition
  Дорогостоящая операция — хуже чем никогда не оптимизировать
```

### Что деоптимизирует TurboFan

```typescript
// ❌ Полиморфные функции — разные типы аргументов → деоптимизация
function add(a, b) { return a + b }

add(1, 2)        // V8: оптимизирует для numbers
add("a", "b")    // V8: деоптимизирует! другой тип
add(1, 2)        // Снова в интерпретаторе

// ✅ Монопорфные — один тип всегда
function addNumbers(a: number, b: number): number {
  return a + b
}

// ❌ Изменение shape объекта после создания
const obj = {}
obj.x = 1   // shape: { x }
obj.y = 2   // shape: { x, y } → V8 создаёт новый hidden class

// ✅ Инициализировать все свойства в конструкторе
const obj = { x: 1, y: 2 }  // shape стабилен сразу

// ❌ Разные shapes одного "типа" → мегаморфный inline cache
function processUser(user) {
  return user.name + user.age
}
processUser({ name: 'A', age: 1 })              // shape 1
processUser({ name: 'B', age: 2, role: 'admin' }) // shape 2 — другой!

// ✅ Консистентная структура объектов
interface User { name: string; age: number; role?: string }
// Все объекты одной формы — V8 один hidden class
```

### Inline caches — практические правила

```typescript
// Hidden class — V8 внутреннее представление shape объекта
// Объекты с одинаковым порядком инициализации → один hidden class

// ❌ delete operator → деградация в slow properties
const obj = { x: 1, y: 2 }
delete obj.x  // V8: объект переходит в hash table mode (медленно)
// Вместо delete: установить в null/undefined
obj.x = undefined  // shape сохраняется, hidden class тот же

// ❌ Dynamic property names → мегаморфный
const key = computedKey()
obj[key] = value  // V8 не может предсказать

// ✅ Map для dynamic keys
const map = new Map<string, number>()
map.set(computedKey(), value)  // Map оптимизирован для dynamic keys
```

### Граничные случаи — где ломается

**Deoptimization в production незаметна без профилировщика**: TurboFan может деоптимизировать функцию вызываемую миллион раз в день из-за одного вызова с другим типом. Симптом: внезапный 3x regression без изменений в логике. Диагностика: `--trace-deopt` флаг V8 или Chrome DevTools → Performance → bottom-up.

**Maglev и числовые операции**: Maglev (V8 2023+) значительно ускорил числовые операции без ожидания TurboFan. Для большинства кода Maglev достаточно — TurboFan применяется к действительно горячим циклам. [web:280][web:284]

**Почему это важно архитектору:** V8 оптимизации — не про микрооптимизации синтаксиса. Ключевое: монотипизированные функции и стабильные object shapes. Это архитектурное решение уровня data modeling, не уровня кода.

---

## 3. Memory leaks

### Топ паттернов утечек памяти

```typescript
// ❌ 1. Event listeners без cleanup
class SearchComponent {
  constructor() {
    // Listener добавлен, но никогда не удалён
    window.addEventListener('resize', this.handleResize.bind(this))
    document.addEventListener('click', this.handleClick.bind(this))
  }
  // GC не может собрать SearchComponent пока window держит ссылку
}

// ✅ Cleanup при unmount / destroy
class SearchComponent {
  private boundHandleResize = this.handleResize.bind(this)

  mount() {
    window.addEventListener('resize', this.boundHandleResize)
  }

  destroy() {
    window.removeEventListener('resize', this.boundHandleResize)
  }
}

// React: useEffect cleanup
useEffect(() => {
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

```typescript
// ❌ 2. Closures holding large data
function createProcessor(largeData: Buffer) {
  // largeData (100MB) захвачен в closure
  return {
    process: () => { /* использует только часть largeData */ },
    getSize: () => largeData.length,  // держит весь 100MB
  }
}

// ✅ Держать только нужное
function createProcessor(largeData: Buffer) {
  const size = largeData.length  // извлечь нужное
  // largeData теперь может быть собран GC
  return {
    process: () => { /* ... */ },
    getSize: () => size,
  }
}
```

```typescript
// ❌ 3. Timers без clearInterval
class PollingService {
  start() {
    setInterval(() => this.poll(), 5000)
    // interval ID потерян → нельзя очистить → PollingService не собирается GC
  }
}

// ✅ Хранить и очищать
class PollingService {
  private intervalId: ReturnType<typeof setInterval> | null = null

  start() {
    this.intervalId = setInterval(() => this.poll(), 5000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
```

```typescript
// ❌ 4. Map/Set без очистки (сильные ссылки)
const cache = new Map<string, HeavyObject>()
// Записи никогда не удаляются → Map растёт вечно
cache.set(key, createHeavyObject())

// ✅ WeakMap для object keys — GC собирает автоматически
const cache = new WeakMap<object, ComputedData>()
// Если key объект собран GC → entry исчезает

// ✅ Или явный LRU с размером
import { LRUCache } from 'lru-cache'
const cache = new LRUCache<string, HeavyObject>({ max: 100 })
```

### Диагностика через Chrome DevTools

```
1. DevTools → Memory → Heap Snapshot
   Сделать snapshot → выполнить действие → второй snapshot
   Сравнить: "Objects allocated between snapshots"
   Искать: объекты с неожиданно высоким retained size

2. DevTools → Memory → Allocation instrumentation on timeline
   Запустить → выполнить действие → остановить
   Видны allocations во времени

3. Retainers panel:
   Нажать на объект → Retainers вкладка
   Показывает что держит объект в памяти
   Прокручивать цепочку до root → найти leak source

4. performance.measureUserAgentSpecificMemory() для production:
   (см. Модуль 33 — Memory measurement)
```

---

## 4. WeakRef и FinalizationRegistry

### WeakRef — cache без memory leak

```typescript
// WeakRef: ссылка которая не предотвращает GC
// deref() возвращает объект или undefined (если собран GC)

// Паттерн: WeakRef cache + FinalizationRegistry для cleanup Map
const cache = new Map<string, WeakRef<ExpensiveObject>>()

const registry = new FinalizationRegistry((key: string) => {
  // Вызывается когда объект собран GC — убираем dead entry из Map
  cache.delete(key)
  console.log(`Cache entry "${key}" collected by GC`)
})

function getExpensive(key: string): ExpensiveObject {
  const ref = cache.get(key)
  const cached = ref?.deref()

  if (cached !== undefined) {
    return cached  // ещё жив
  }

  // Создать новый
  const obj = createExpensive(key)
  cache.set(key, new WeakRef(obj))
  registry.register(obj, key)  // key — cleanup token для FinalizationRegistry
  return obj
}
```

### Важные ограничения WeakRef

```typescript
// ❌ НИКОГДА не полагаться на timing GC
const ref = new WeakRef(largeObj)
largeObj = null  // потенциально eligible for GC

// Это может вернуть объект или undefined — НЕПРЕДСКАЗУЕМО
// даже в следующей строке кода
const obj = ref.deref()

// ✅ Всегда проверять deref() и иметь fallback
function getFromCache(key: string): HeavyObject {
  const cached = cache.get(key)?.deref()
  if (cached !== undefined) return cached

  // Fallback: пересоздать
  return recreate(key)
}

// ❌ FinalizationRegistry для prompt resource cleanup
// GC timing непредсказуем — может не вызваться вовремя
// Для prompt cleanup: явный try/finally или Disposable pattern (ES2025)

// ✅ FinalizationRegistry только как safety net
// Основная очистка — явная; registry — backup
```

### ES2025 Explicit Resource Management (using)

```typescript
// using — детерминированная очистка (Baseline 2025)
// Не зависит от GC

class DatabaseConnection implements Disposable {
  [Symbol.dispose]() {
    this.close()
    console.log('Connection closed deterministically')
  }
}

// using: cleanup при выходе из scope (не при GC)
{
  using conn = new DatabaseConnection()
  await conn.query('SELECT ...')
}  // conn[Symbol.dispose]() вызывается здесь автоматически
// FinalizationRegistry — backup; using — primary cleanup
```

### Граничные случаи — где ломается

**WeakRef и microtask queue**: даже если объект eligible for GC, он может оставаться живым пока выполняется текущая microtask queue. `deref()` в том же synchronous block скорее всего вернёт объект — но это не гарантия.

**FinalizationRegistry в Node.js**: в Node.js GC callbacks из FinalizationRegistry выполняются в отдельном потоке (libuv). Нельзя трогать JS объекты из callback напрямую — только через `process.nextTick` / `setImmediate`. [web:276]

**Почему это важно архитектору:** WeakRef не замена явным lifecycle паттернам. Это safety net для кешей. Если SPA держит в памяти 50 закрытых модальных компонентов — проблема не в отсутствии WeakRef, а в том что компоненты не unmount.

---

## 5. Web Workers

### Когда нужны Workers

```
Workers нужны (CPU-bound, блокирует main thread > 50ms):
  ✓ Парсинг JSON > 1MB
  ✓ Обработка изображений (canvas pixel manipulation)
  ✓ Криптография (хеширование больших данных)
  ✓ Поиск по большому индексу (Fuse.js с 50K записей)
  ✓ Сортировка/фильтрация 100K+ строк
  ✓ Компиляция (WASM, шаблоны)
  ✓ Парсинг CSV/Excel

Workers НЕ нужны (I/O-bound, уже async):
  ✗ fetch() запросы
  ✗ IndexedDB операции
  ✗ Database queries
  ✗ setTimeout/setInterval
```

### Comlink — Worker без boilerplate

```typescript
// worker.ts
import { expose } from 'comlink'

const api = {
  async parseCSV(csvText: string): Promise<ParsedRow[]> {
    // Тяжёлый парсинг — выполняется в Worker, не в main thread
    return heavyCSVParser(csvText)
  },

  async buildSearchIndex(data: Item[]): Promise<void> {
    searchIndex = new Fuse(data, { keys: ['name', 'description'] })
  },

  async search(query: string): Promise<Item[]> {
    return searchIndex.search(query).map(r => r.item)
  },
}

expose(api)
```

```typescript
// main.ts
import { wrap } from 'comlink'

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
})
const workerApi = wrap<typeof api>(worker)

// Вызов выглядит как обычный async — Comlink скрывает postMessage
const rows = await workerApi.parseCSV(csvText)
await workerApi.buildSearchIndex(items)
const results = await workerApi.search('query')
```

### Transferables — zero-copy передача данных

```typescript
// По умолчанию postMessage копирует данные — медленно для больших буферов

// ❌ Копирование 50MB ArrayBuffer
const buffer = new ArrayBuffer(50 * 1024 * 1024)
worker.postMessage({ buffer })  // Копирует 50MB

// ✅ Transfer ownership — zero-copy, мгновенно
worker.postMessage({ buffer }, [buffer])
// buffer в main thread становится detached (byteLength === 0)
// Worker получает данные без копирования

// ✅ SharedArrayBuffer — оба потока читают/пишут ОДНУ память
// Требует Cross-Origin Isolation (COOP + COEP headers)
const shared = new SharedArrayBuffer(1024)
const arr = new Int32Array(shared)

worker.postMessage({ shared })
arr[0] = 42  // Видно Worker немедленно (нет копирования)

// Atomics для thread-safe операций:
Atomics.add(arr, 0, 1)          // Атомарный increment
Atomics.compareExchange(arr, 0, expected, desired)  // CAS операция
```

### Граничные случаи — где ломается

**Worker и DOM**: Workers не имеют доступа к DOM, `window`, `document`. Нельзя вызвать `querySelector` из Worker. Только чистые вычисления + fetch (в dedicated worker) + IndexedDB.

**SharedArrayBuffer и Spectre mitigation**: SharedArrayBuffer требует `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` на ответе сервера. Без этих заголовков — `SharedArrayBuffer` недоступен (security mitigation). Нарушает некоторые third-party iframes. [web:62][web:281]

**Transfer после использования**: после передачи buffer через transferable — он detached в source thread. Любое обращение к нему бросает `TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer`. [web:62]

**Почему это важно архитектору:** Web Workers — единственный способ избежать main thread блокировки для CPU-bound кода. Comlink убирает boilerplate до уровня обычного async/await. Transferables решают проблему копирования больших данных. Это не преждевременная оптимизация — это правильный инструмент для CPU-bound задач.

---

## 6. Scheduling API

### `scheduler.postTask()` — приоритизация задач

```typescript
// Проблема: setTimeout(fn, 0) — не гарантирует порядок,
// нет приоритетов, нельзя отменить

// scheduler.postTask() — управляемое планирование задач

// user-blocking: задачи влияющие на UI прямо сейчас (highest priority)
await scheduler.postTask(() => updateUI(), {
  priority: 'user-blocking'
})

// user-visible: задачи видимые пользователю, но не blocking
await scheduler.postTask(() => loadAdditionalContent(), {
  priority: 'user-visible'
})

// background: низкоприоритетные (analytics, precompute)
await scheduler.postTask(() => prefetchNextPage(), {
  priority: 'background'
})

// Отмена:
const controller = new TaskController()
const task = scheduler.postTask(() => expensiveWork(), {
  signal: controller.signal,
  priority: 'background',
})
controller.abort()  // Отменить задачу
```

### `scheduler.yield()` — chunking long tasks

```typescript
// Разбить длинную задачу на chunks с отдачей управления браузеру
// Между chunks браузер может обработать user input → хороший INP

async function processLargeArray(items: Item[]): Promise<Result[]> {
  const results: Result[] = []
  const CHUNK_SIZE = 100

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE)
    results.push(...chunk.map(processItem))

    // Отдать управление браузеру после каждого chunk
    // Браузер обрабатывает input, paint, другие задачи
    await scheduler.yield()
  }

  return results
}

// Без scheduler.yield() — если items 10K и processItem медленный,
// функция блокирует main thread на всё время
// С scheduler.yield() — main thread свободен между chunks
```

### Граничные случаи — где ломается

**`scheduler.yield()` и priority inheritance**: yield возобновляет задачу с тем же приоритетом. Но если между chunks появится более приоритетная задача — она выполнится первой. Для UI-критичного кода использовать `user-blocking` priority чтобы не быть вытесненным.

**`scheduler.postTask()` и Safari < 17**: Baseline 2024 означает Safari 17.4+. Для более старых — полифил через `MessageChannel` или `setTimeout`. [web:62][web:281]

**Почему это важно архитектору:** `scheduler.yield()` — правильная замена `setTimeout(fn, 0)` для chunking. setTimeout добавляет минимум 4ms задержку. yield — немедленное продолжение после обработки приоритетных задач.

---

## Антипаттерны

**1. Синхронный парсинг больших данных на main thread**
```typescript
// ❌ Блокирует main thread на 200-500ms
const data = JSON.parse(largeFetchedString)

// ✅ Web Worker для > 100KB JSON
const result = await workerApi.parseJSON(largeFetchedString)
```

**2. Event listeners без cleanup**
```typescript
// ❌ Memory leak: listener держит closure, closure держит компонент
useEffect(() => {
  document.addEventListener('keydown', handler)
  // Нет cleanup!
})

// ✅
useEffect(() => {
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [])
```

**3. Полиморфные функции в hot path**
```typescript
// ❌ TurboFan деоптимизирует при разных типах
function format(value) {
  return String(value)
}
format(123)        // number
format('text')     // string — деоптимизация!
format(new Date()) // object — деоптимизация!

// ✅ Отдельные типизированные функции
function formatNumber(n: number): string { return String(n) }
function formatString(s: string): string { return s }
```

**4. `delete` вместо `= undefined`**
```typescript
// ❌ delete переводит объект в hash table mode
delete obj.tempProp

// ✅ Сохраняет hidden class
obj.tempProp = undefined
```

**5. setInterval без clearInterval**
```typescript
// ❌ Утечка при unmount компонента
onMount(() => {
  setInterval(tick, 1000)
})

// ✅ Cleanup
onMount(() => {
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
})
```

**6. Polling в main thread вместо Worker**
```typescript
// ❌ Heavy polling блокирует main thread
setInterval(async () => {
  const data = await fetch('/api/updates')
  const parsed = await data.json()
  processHeavyData(parsed)  // CPU-bound
}, 2000)

// ✅ Worker + postMessage результата
// Worker делает fetch + heavy processing, postMessage только diff
```

---

## Задачи AI-кодеру

**Плохая формулировка:**
> «Оптимизируй производительность поиска»

**Хорошая формулировка:**
> «Перенести поиск по индексу в Web Worker:
> 1. Создать `src/workers/search.worker.ts`.
> 2. Внутри: `import { expose } from 'comlink'`, импортировать Fuse.js.
> 3. Expose объект с методами: `buildIndex(data: Item[]): void`, `search(query: string): Item[]`.
> 4. В main: `wrap<SearchWorker>(new Worker(new URL('./workers/search.worker.ts', import.meta.url), { type: 'module' }))`.
> 5. При инициализации приложения: вызвать `workerApi.buildIndex(items)`.
> 6. При поисковом запросе: `const results = await workerApi.search(query)`.
> 7. Проверить: поиск по 50K записей не должен создавать LoAF entry.»

---

**Плохая формулировка:**
> «Исправь memory leaks»

**Хорошая формулировка:**
> «Аудит memory leaks в `src/components/`:
> 1. Найти все `addEventListener` без `removeEventListener` в cleanup функциях.
> 2. Найти все `setInterval`/`setTimeout` без `clearInterval`/`clearTimeout` при unmount.
> 3. Найти все `useEffect` без return cleanup function если внутри есть subscriptions.
> 4. Найти Map/Set используемые как cache без явного ограничения размера — предложить `lru-cache` или WeakMap.
> 5. Для каждой найденной проблемы: предложить fix с кодом. Не исправлять автоматически — показать список для ревью.»

---

## Чеклист архитектора

**Main thread**
- [ ] CPU-bound задачи > 50ms → Web Worker
- [ ] Long loops с chunking через `scheduler.yield()`
- [ ] Нет `JSON.parse()` синхронно для данных > 100KB

**V8 оптимизация**
- [ ] Функции в hot path — монотипизированные (один тип аргументов)
- [ ] Object shapes стабильны: все свойства инициализированы в конструкторе
- [ ] `delete` заменён на `= undefined` для hot path объектов
- [ ] Map для dynamic keys вместо plain objects

**Memory**
- [ ] Все event listeners имеют cleanup (removeEventListener)
- [ ] setInterval/setTimeout: intervalId хранится, clearInterval при destroy
- [ ] Cache с ограниченным размером (LRU) или WeakMap/WeakRef
- [ ] Closures не захватывают large buffers без необходимости

**Workers**
- [ ] Web Worker для парсинга/обработки данных > 100KB
- [ ] Comlink для Worker API без boilerplate
- [ ] Transferables для передачи ArrayBuffer > 1MB
- [ ] SharedArrayBuffer только с COOP+COEP заголовками

**Scheduling**
- [ ] `scheduler.postTask()` для приоритизации background задач
- [ ] `scheduler.yield()` вместо `setTimeout(fn, 0)` для chunking

---

*Модуль 37 завершён.*
*Следующий: [Модуль 38 — Caching стратегии: HTTP, Service Worker, CDN](../38-caching/README.md)*
