# Модуль 33 — Web Performance API

> **Для AI-архитектора:** `performance.now()` и `console.time()` — инструменты отладки, не мониторинга. Реальная картина производительности — PerformanceObserver в production у реальных пользователей. Архитектурный вопрос: какие метрики собираем, как отправляем без блокировки, и как LoAF заменяет Long Tasks API для диагностики INP. Большинство команд измеряют только lab data (Lighthouse) — field data от реальных пользователей принципиально отличается.
> Один день изучения — Navigation Timing L2, Resource Timing, PerformanceObserver, web-vitals library, LoAF API, memory measurement, RUM pipeline.

---

## Содержание

1. [Performance API ландшафт](#1-ландшафт)
2. [Navigation Timing L2](#2-navigation-timing)
3. [Resource Timing](#3-resource-timing)
4. [PerformanceObserver](#4-performanceobserver)
5. [Long Animation Frames (LoAF)](#5-loaf)
6. [RUM pipeline — сбор и отправка](#6-rum)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| API / инструмент | Статус | Поддержка |
| :-- | :-- | :-- |
| Navigation Timing L2 | **Текущий** | Все major browsers |
| Resource Timing L2 | **Текущий** | Все major browsers |
| Long Animation Frames (LoAF) | **Baseline 2024** | Chrome 123+, FF 127+ |
| Long Tasks API | **Deprecated** | Chrome 58+ (заменён LoAF) |
| web-vitals | **5.x** | npm, 2026 |
| `performance.measureUserAgentSpecificMemory()` | **Stable** | Chrome 89+, requires cross-origin isolation |

> **Navigation Timing L1** (`performance.navigation`, `performance.timing`) — deprecated. Использовать `PerformanceNavigationTiming` из L2.

---

## 1. Ландшафт

### Виды измерений

```
Lab data (синтетические):
  Lighthouse, WebPageTest, PageSpeed Insights
  Контролируемые условия: фиксированный CPU throttle, сеть, без extensions
  Воспроизводимо. НЕ отражает реальный опыт.

Field data (реальные пользователи, RUM):
  PerformanceObserver в браузере пользователя
  Реальные устройства, сети, extensions, кеш
  Не воспроизводимо. Только это влияет на Google Rankings (CrUX).
```

### Иерархия Performance API

```
window.performance
  │
  ├── performance.now()              — высокоточный timestamp (DOMHighResTimeStamp)
  ├── performance.mark()             — пользовательские маркеры
  ├── performance.measure()          — интервалы между маркерами
  │
  ├── getEntriesByType('navigation')  → PerformanceNavigationTiming
  ├── getEntriesByType('resource')    → PerformanceResourceTiming[]
  ├── getEntriesByType('paint')       → PerformancePaintTiming (FP, FCP)
  ├── getEntriesByType('largest-contentful-paint')
  ├── getEntriesByType('layout-shift')
  ├── getEntriesByType('longtask')    → deprecated
  ├── getEntriesByType('long-animation-frame') → LoAF (2024+)
  │
  └── PerformanceObserver             — подписка на новые entries
```

---

## 2. Navigation Timing

### PerformanceNavigationTiming (L2)

```typescript
// L1 deprecated:
// performance.timing.domContentLoadedEventEnd — НЕ использовать

// L2 — правильно:
const navEntry = performance.getEntriesByType('navigation')[0] as
  PerformanceNavigationTiming

// Ключевые timestamps (все в ms от navigationStart = 0):
const metrics = {
  // DNS
  dnsLookup: navEntry.domainLookupEnd - navEntry.domainLookupStart,

  // TCP + TLS
  tcpConnect: navEntry.connectEnd - navEntry.connectStart,
  tlsNegotiation: navEntry.requestStart - navEntry.secureConnectionStart,

  // Server response
  ttfb: navEntry.responseStart - navEntry.requestStart,

  // Transfer
  download: navEntry.responseEnd - navEntry.responseStart,

  // HTML processing
  domInteractive: navEntry.domInteractive,
  domContentLoaded: navEntry.domContentLoadedEventEnd,
  domComplete: navEntry.domComplete,

  // Total
  loadEvent: navEntry.loadEventEnd,

  // Размер ответа (сжатый / несжатый)
  transferSize: navEntry.transferSize,
  encodedBodySize: navEntry.encodedBodySize,
  decodedBodySize: navEntry.decodedBodySize,
}
```

### Полная timeline navigation

```
0ms                                                          load
│                                                               │
fetchStart                                                      │
│──DNS──│──TCP──│──TLS──│──Request──│──Response──│──DOM──│──Load│
        │       │        │           │            │       │
   domainLookup connectEnd requestStart responseEnd domInteractive
   Start/End              responseStart            domComplete
```

### Граничные случаи — где ломается

**Service Worker intercept**: если SW перехватывает запрос и отвечает из кеша — `domainLookupStart === fetchStart`, `connectStart === connectEnd`. TTFB будет близко к 0ms. Это не ошибка — это SW кеш.

**Cross-origin redirect**: если сайт делает redirect на другой origin — `redirectStart`/`redirectEnd` могут быть 0 из-за same-origin policy. Timing не раскрывается для cross-origin без `Timing-Allow-Origin` заголовка.

**Почему это важно архитектору:** `Timing-Allow-Origin: *` заголовок от third-party CDN — единственный способ получить resource timing для cross-origin ресурсов. Без него все cross-origin entries имеют 0 для timing полей.

---

## 3. Resource Timing

### PerformanceResourceTiming

```typescript
// Все загруженные ресурсы на странице
const resources = performance.getEntriesByType('resource') as
  PerformanceResourceTiming[]

// Анализ по типам
const byInitiator = resources.reduce((acc, r) => {
  const type = r.initiatorType  // 'script', 'css', 'img', 'fetch', 'xmlhttprequest'
  acc[type] = acc[type] ?? []
  acc[type].push({
    name: r.name,
    duration: r.duration,          // общее время загрузки
    ttfb: r.responseStart - r.requestStart,
    size: r.transferSize,          // 0 если из кеша
    cached: r.transferSize === 0,
  })
  return acc
}, {} as Record<string, any[]>)

// Найти медленные ресурсы
const slowResources = resources
  .filter(r => r.duration > 1000)  // > 1 секунды
  .sort((a, b) => b.duration - a.duration)
  .slice(0, 10)
  .map(r => ({ name: r.name, duration: r.duration }))
```

### Resource buffer overflow

```typescript
// По умолчанию browser хранит 250 resource entries
// Для сайтов со многими ресурсами — буфер переполняется

// Увеличить буфер ДО загрузки страницы:
performance.setResourceTimingBufferSize(1000)

// Слушать переполнение:
performance.addEventListener('resourcetimingbufferfull', () => {
  // Сохранить накопленные данные и очистить буфер
  collectAndSendResourceMetrics()
  performance.clearResourceTimings()
})
```

---

## 4. PerformanceObserver

### Базовая подписка

```typescript
// PerformanceObserver — асинхронный, не блокирует main thread
// Получает entries по мере их появления

const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.entryType, entry.name, entry.startTime, entry.duration)
  }
})

// buffered: true — получить entries возникшие ДО создания observer
observer.observe({
  type: 'largest-contentful-paint',
  buffered: true
})

// Несколько типов — несколько observer или entryTypes массив:
const multiObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      handleLCP(entry as LargestContentfulPaint)
    } else if (entry.entryType === 'layout-shift') {
      handleCLS(entry as LayoutShift)
    }
  }
})

multiObserver.observe({
  entryTypes: ['largest-contentful-paint', 'layout-shift']
})
```

### Core Web Vitals через PerformanceObserver

```typescript
// LCP — Largest Contentful Paint
// Последний LCP entry — финальный
let lcpValue = 0
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries()
  const last = entries[entries.length - 1] as LargestContentfulPaint
  lcpValue = last.startTime
})
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

// Финализация LCP: при user interaction или visibilitychange
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    lcpObserver.disconnect()
    sendMetric('LCP', lcpValue)
  }
}, { once: true })

// CLS — Cumulative Layout Shift
// Суммировать session windows
let clsValue = 0
let sessionValue = 0
let sessionEntries: LayoutShift[] = []

const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as LayoutShift[]) {
    if (!entry.hadRecentInput) {
      // Проверить session window (< 1s пауза, < 5s длительность)
      const firstEntry = sessionEntries[0]
      const lastEntry = sessionEntries[sessionEntries.length - 1]

      if (sessionEntries.length === 0 ||
          entry.startTime - lastEntry.startTime < 1000 &&
          entry.startTime - firstEntry.startTime < 5000) {
        sessionValue += entry.value
        sessionEntries.push(entry)
      } else {
        // Новый session window
        sessionValue = entry.value
        sessionEntries = [entry]
      }

      clsValue = Math.max(clsValue, sessionValue)
    }
  }
})
clsObserver.observe({ type: 'layout-shift', buffered: true })
```

### Пользовательские маркеры

```typescript
// Измерение произвольных операций
performance.mark('checkout:start')
await processPayment()
performance.mark('checkout:end')

const measure = performance.measure(
  'checkout:duration',   // имя
  'checkout:start',      // start mark
  'checkout:end'         // end mark
)
console.log(`Payment: ${measure.duration.toFixed(2)}ms`)

// Маркеры видны в DevTools Performance timeline
// Полезны для профилирования конкретных операций
```

---

## 5. LoAF

### Long Tasks API — почему заменили

```
Long Tasks API (deprecated):
  Сообщает: задача > 50ms на main thread
  НЕ сообщает: какой скрипт вызвал, какой URL, детали frame

LoAF — Long Animation Frames API (Baseline 2024):
  Сообщает: frame > 50ms включая rendering
  Сообщает: какие скрипты выполнялись, их URL, duration каждого
  Атрибуция источника проблемы INP
```

### LoAF в production

```typescript
// Long Animation Frame > 50ms
const loafObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as PerformanceLongAnimationFrameEntry[]) {
    const frame = {
      duration: entry.duration,                    // общее время frame
      blockingDuration: entry.blockingDuration,    // время блокировки input
      scripts: entry.scripts.map(script => ({
        duration: script.duration,
        sourceURL: script.sourceURL,               // URL скрипта-источника
        sourceCharPosition: script.sourceCharPosition,
        invoker: script.invoker,                   // что вызвало (event handler, promise, etc.)
      }))
    }

    // Логировать для диагностики
    if (entry.blockingDuration > 0) {
      console.warn('Long Animation Frame:', frame)
      sendToRUM('loaf', frame)
    }
  }
})

loafObserver.observe({ type: 'long-animation-frame', buffered: true })
```

### Диагностика INP через LoAF

```typescript
// Связать LoAF с INP: какой скрипт блокировал interaction

// Собрать LoAF entries за последнюю секунду при каждом interaction
const recentLoAFs: PerformanceLongAnimationFrameEntry[] = []

const loafCollector = new PerformanceObserver((list) => {
  for (const entry of list.getEntries() as PerformanceLongAnimationFrameEntry[]) {
    recentLoAFs.push(entry)
    // Хранить только последние 30 секунд
    const cutoff = performance.now() - 30000
    recentLoAFs.splice(0, recentLoAFs.findIndex(e => e.startTime > cutoff))
  }
})
loafCollector.observe({ type: 'long-animation-frame', buffered: true })

// При плохом INP: найти overlapping LoAF entries
function findCulpritScripts(interactionStart: number, interactionEnd: number) {
  return recentLoAFs
    .filter(e =>
      e.startTime < interactionEnd &&
      e.startTime + e.duration > interactionStart
    )
    .flatMap(e => e.scripts)
    .sort((a, b) => b.duration - a.duration)
}
```

### Граничные случаи — где ломается

**LoAF vs Long Tasks в CI**: в Playwright/Puppeteer `long-animation-frame` entries могут быть недоступны в headless режиме. Для lab testing — использовать DevTools Performance API напрямую.

**Third-party scripts и LoAF**: по данным 2026, third-party скрипты в LoAF — 60–70% сайтов. Tag manager (GTM) появляется в LoAF ~45% случаев. Если `sourceURL` — внешний домен → delay load до первого user interaction. 

**`blockingDuration` vs `duration`**: `duration` > 50ms не всегда означает проблему INP. `blockingDuration` — время непосредственной блокировки input обработки. Только `blockingDuration > 0` — прямая причина плохого INP.

**Почему это важно архитектору:** LoAF — единственный инструмент для атрибуции INP проблем к конкретному скрипту в production. DevTools показывает это только в lab. В field data без LoAF — нет атрибуции, только симптом.

---

## 6. RUM pipeline

### web-vitals library (рекомендован)

```typescript
// npm install web-vitals@5
import {
  onLCP, onINP, onCLS, onFCP, onTTFB,
  type Metric
} from 'web-vitals'

function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,  // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,    // изменение с последнего отчёта
    id: metric.id,          // уникальный ID для deduplicate
    navigationType: metric.navigationType,
  })

  // sendBeacon — не блокирует, работает при закрытии вкладки
  navigator.sendBeacon('/api/vitals', body)
}

onLCP(sendToAnalytics)
onINP(sendToAnalytics)
onCLS(sendToAnalytics)
onFCP(sendToAnalytics)
onTTFB(sendToAnalytics)
```

### Отправка без блокировки

```typescript
// Три варианта, приоритет по порядку:

// 1. sendBeacon — лучший выбор
// Асинхронный, работает при visibilitychange и unload
navigator.sendBeacon('/api/metrics', JSON.stringify(data))

// 2. fetch с keepalive — альтернатива если нужен JSON Content-Type
fetch('/api/metrics', {
  method: 'POST',
  body: JSON.stringify(data),
  headers: { 'Content-Type': 'application/json' },
  keepalive: true,  // работает при unload
})

// 3. Image beacon — крайний случай (CORS-free, GET only)
new Image().src = `/beacon?data=${encodeURIComponent(JSON.stringify(data))}`

// ❌ НЕ использовать:
// XMLHttpRequest synchronous — блокирует main thread
// fetch без keepalive при unload — запрос может не завершиться
```

### Batching и sampling

```typescript
// Не отправлять каждый metric отдельно на высокотрафикных сайтах

class MetricsBuffer {
  private buffer: Metric[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  add(metric: Metric) {
    this.buffer.push(metric)

    // Sampling: отправлять только 10% сессий
    if (Math.random() > 0.1) return

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 3000)
    }
  }

  flush() {
    if (this.buffer.length === 0) return
    navigator.sendBeacon('/api/vitals', JSON.stringify(this.buffer))
    this.buffer = []
    this.flushTimer = null
  }
}

const buffer = new MetricsBuffer()

// Flush при скрытии вкладки
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    buffer.flush()
  }
})
```

### Memory measurement

```typescript
// Только при cross-origin isolation (COOP + COEP headers)
// chrome 89+

async function measureMemory() {
  if (!performance.measureUserAgentSpecificMemory) return

  try {
    const result = await performance.measureUserAgentSpecificMemory()
    // result.bytes — total heap size
    // result.breakdown — по типам объектов

    const heapMB = result.bytes / 1024 / 1024
    if (heapMB > 50) {
      console.warn(`High memory usage: ${heapMB.toFixed(1)}MB`)
    }
  } catch (e) {
    // SecurityError если нет cross-origin isolation
  }
}
```

### Граничные случаи — где ломается

**INP финализация**: INP — 98-й перцентиль, finalizes при `visibilitychange` (скрытие вкладки). Если пользователь не скрывает вкладку — `onINP` обновляется во время сессии, каждый раз отправляя `delta`. На сервере: deduplicate по `metric.id`, использовать последнее значение.

**CrUX vs RUM расхождение**: RUM собирает 100% (или sampled) трафика сайта. CrUX — только Chrome пользователи с opted-in usage sharing. RUM может показывать лучше — Safari и Firefox не в CrUX. Google Rankings по CrUX, не по RUM.

**Navigation type и CWV**: back/forward cache (`navigationType: 'back-forward-cache'`) даёт LCP ~0ms — страница восстановлена из памяти. Не смешивать с обычными навигациями при анализе.

**Почему это важно архитектору:** RUM pipeline — это архитектурное решение с персистентными last effects. Sampling rate, batching strategy, и куда отправлять данные определяют стоимость и точность. Нет RUM → нет видимости в production.

---

## Антипаттерны

**1. `performance.timing` (L1 deprecated)**
```typescript
// ❌ Deprecated API
const ttfb = performance.timing.responseStart - performance.timing.navigationStart

// ✅ Navigation Timing L2
const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
const ttfb = nav.responseStart
```

**2. Long Tasks вместо LoAF**
```typescript
// ❌ Long Tasks — нет атрибуции источника
observer.observe({ type: 'longtask' })

// ✅ Long Animation Frames — есть URLs скриптов
observer.observe({ type: 'long-animation-frame', buffered: true })
```

**3. Синхронная отправка метрик**
```typescript
// ❌ Блокирует main thread при unload
window.addEventListener('unload', () => {
  fetch('/api/metrics', { method: 'POST', body: data })
})

// ✅ sendBeacon или fetch + keepalive
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    navigator.sendBeacon('/api/metrics', data)
  }
})
```

**4. Отправка каждого metric event отдельно**
На сайте с 100K посещений в день — каждый LCP, CLS, INP отдельным запросом = 300K+ requests. Batching обязателен.

**5. Без sampling на высоком трафике**
RUM данные с 100% трафика — дорого. 10% sampling с правильным stratification (по device, geography) даёт достаточную точность.

**6. Игнорировать `navigationType`**
BFCache restores дают аномально низкий LCP (~0ms). Prefetch navigations — тоже. Фильтровать при анализе: только `navigationType: 'navigate'` для baseline метрик.

---

## Anti-checklist ☠️

- [ ] PerformanceObserver без buffered: true — теряешь события, произошедшие до подписки
- [ ] Собирать RUM без выборки — каждое событие = лишний запрос, влияет на performance
- [ ] Полагаться на single-threaded LCP — LCP может быть вычислен позже после загрузки шрифтов
- [ ] Игнорировать cross-origin LCP — изображения с CDN не дают информацию о загрузке
- [ ] TTFB как единственная метрика — быстрый сервер не спасает от медленного JS
- [ ] Не деградировать сбор RUM при ошибке — потеря всех данных одного пользователя

## Задачи AI-кодеру

**Плохая формулировка:**
> «Добавь сбор Web Vitals»

**Хорошая формулировка:**
> «Добавить RUM pipeline:
> 1. `npm install web-vitals@5`.
> 2. Файл `src/analytics/vitals.ts`: подписаться на `onLCP`, `onINP`, `onCLS`, `onFCP`, `onTTFB`.
> 3. Отправка через `navigator.sendBeacon('/api/vitals', JSON.stringify({name, value, rating, id, navigationType}))`.
> 4. Sampling 10%: `if (Math.random() > 0.1) return` до отправки.
> 5. Flush при `visibilitychange → hidden`.
> 6. Импортировать и вызывать `initVitals()` в entry point после first paint (не в head).»

---

**Плохая формулировка:**
> «Найди что тормозит страницу»

**Хорошая формулировка:**
> «Добавить LoAF observer в `src/diagnostics/loaf.ts`:
> 1. `PerformanceObserver` на `long-animation-frame` с `buffered: true`.
> 2. Для каждого entry: если `blockingDuration > 0` — отправить `{duration, blockingDuration, scripts: [{sourceURL, duration, invoker}]}` через `sendBeacon('/api/loaf', ...)`.
> 3. Фильтр: отправлять только entries с `blockingDuration > 50ms`.
> 4. Только если `'long-animation-frame' in PerformanceObserver.supportedEntryTypes` (feature detect).
> 5. Подключить только на production (`import.meta.env.PROD`).»

---

## Чеклист архитектора

**Measurement**
- [ ] Navigation Timing L2 (`PerformanceNavigationTiming`), не L1 deprecated
- [ ] Resource Timing buffer увеличен до 1000 для больших страниц
- [ ] LoAF observer вместо Long Tasks observer
- [ ] Custom marks для бизнес-критичных операций (checkout, search)

**Core Web Vitals**
- [ ] web-vitals 5.x: `onLCP`, `onINP`, `onCLS`, `onFCP`, `onTTFB`
- [ ] Финализация при `visibilitychange → hidden`
- [ ] Deduplicate по `metric.id` на бэкенде

**RUM pipeline**
- [ ] Отправка через `sendBeacon` или `fetch + keepalive`
- [ ] Sampling для высокотрафикных сайтов (10-20%)
- [ ] Batching: не отправлять каждый metric отдельно
- [ ] `navigationType` сохраняется для фильтрации BFCache

**LoAF диагностика**
- [ ] Feature detect перед подключением LoAF observer
- [ ] `blockingDuration` — основной сигнал, не просто `duration`
- [ ] `sourceURL` сохраняется для атрибуции third-party скриптов

---

*Модуль 33 завершён.*
*Следующий: [Модуль 34 — Lazy loading и code splitting](../34-lazy-loading/README.md)*
