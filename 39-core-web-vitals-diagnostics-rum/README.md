# Модуль 39 — Core Web Vitals: диагностика, RUM и fixes

> **Для AI-архитектора:** CWV — не просто метрики для SEO. Это прямая связь «latency → revenue»: redBus улучшили INP → +7% продаж, Trendyol снизили INP на 50% → +1% CTR. Архитектурное понимание: три метрики = три разных проблемы (загрузка / отзывчивость / стабильность). Ошибка большинства: оптимизируют Lighthouse lab score вместо field data (CrUX). Google ранжирует по 75-й перцентили реальных пользователей, не по Lighthouse.
> Один день изучения — пороги и измерение (CrUX vs Lab), LCP диагностика + fetchpriority, INP анатомия + LoAF, CLS причины + fixes, attribution API для RUM.

---

## Содержание

1. [Пороги и измерение](#1-пороги)
2. [LCP — диагностика и оптимизация](#2-lcp)
3. [INP — анатомия и оптимизация](#3-inp)
4. [CLS — причины и фиксы](#4-cls)
5. [Attribution API и RUM](#5-attribution)
6. [Реальный кейс](#реальный-кейс)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Метрика / инструмент | Версия / статус |
| :-- | :-- |
| LCP порог «хорошо» | **≤ 2.5s** |
| INP порог «хорошо» | **≤ 200ms** (заменил FID в марте 2024) |
| CLS порог «хорошо» | **≤ 0.1** |
| web-vitals (npm) | **5.3.0** |
| Chrome User Experience Report (CrUX) | Обновляется ежедневно |
| LoAF API | **Baseline 2024** (Chrome 123+) |
| `fetchpriority` | **Baseline 2023** — все браузеры |

---

## 1. Пороги

### Таблица порогов и что означает «хорошо»

| Метрика | Хорошо | Требует улучшения | Плохо |
| :-- | :-- | :-- | :-- |
| LCP | ≤ 2.5s | 2.5s – 4.0s | > 4.0s |
| INP | ≤ 200ms | 200ms – 500ms | > 500ms |
| CLS | ≤ 0.1 | 0.1 – 0.25 | > 0.25 |

**Критерий Google**: 75-я перцентиль реальных пользователей из CrUX должна попадать в «хорошо». 

### Field data vs Lab data — принципиальная разница

```
Lab data (Lighthouse, WebPageTest):
  ✓ Воспроизводимо, детерминировано
  ✓ Подходит для CI/CD регрессий
  ✗ НЕ учитывается для SEO rankings
  ✗ Синтетическое устройство и сеть
  ✗ TBT ≠ INP (proxy метрика, не точная)

Field data (CrUX, RUM):
  ✓ Реальные пользователи, реальные устройства
  ✓ Google ранжирует именно по этому
  ✓ Показывает 75-ю перцентиль
  ✗ Обновляется с задержкой (28-дневное скользящее окно)
  ✗ Нужен минимальный трафик для данных

Стратегия: Lab → для разработки и CI регрессий.
           Field → для приоритизации работ и SEO.
```

### Инструменты измерения

```
Field data:
  Google Search Console → Core Web Vitals report (бесплатно)
  PageSpeed Insights → показывает CrUX данные по URL
  CrUX API → programmatic доступ к данным

Lab data:
  Lighthouse CI → в pipeline (github-actions/lighthouse-ci)
  WebPageTest → детальный waterfall
  Chrome DevTools → Performance panel

RUM (Real User Monitoring):
  web-vitals npm → самостоятельный сбор
  Vercel Speed Insights, Sentry Performance → hosted решения
```

---

## 2. LCP

### Что такое LCP элемент

```
LCP = время до рендера largest element in viewport:
  - <img> элементы
  - <image> в SVG
  - <video> с poster attribute
  - Элемент с background-image (CSS url())
  - Блочный элемент с текстом (h1, p)

Обычно LCP элемент — hero image или главный заголовок.
Chrome DevTools → Performance → Timings → LCP marker.
```

### LCP subparts: где теряется время

```
Total LCP = TTFB + Resource load delay + Resource load duration + Element render delay

TTFB (Time to First Byte):
  → Медленный сервер / CDN miss
  → Fix: CDN, Edge computing, DB оптимизация

Resource load delay (discovery → request start):
  → LCP ресурс обнаружен поздно (в CSS, в JS)
  → Fix: fetchpriority="high" на LCP image в HTML

Resource load duration (request start → load end):
  → Большой файл изображения
  → Fix: AVIF/WebP, правильный srcset, размер

Element render delay (load end → paint):
  → Рендер блокирован (шрифты, CSS)
  → Fix: font-display: swap, inline critical CSS
```

### fetchpriority — главный инструмент LCP

```html
<!-- ❌ Браузер не знает что это LCP — обнаруживает поздно -->
<img src="hero.avif" alt="Hero" width="1200" height="600" loading="lazy">

<!-- ✅ Явный высокий приоритет + eager loading -->
<img
  src="hero.avif"
  alt="Hero"
  width="1200"
  height="600"
  loading="eager"
  fetchpriority="high"
  decoding="async"
>
<!-- Google: fetchpriority="high" улучшает LCP на 20-30% в реальных тестах -->

<!-- Только ОДИН элемент fetchpriority="high" — иначе они конкурируют -->
<!-- Остальные изображения: fetchpriority="low" или дефолт -->

<!-- ✅ Hero как CSS background: preload с fetchpriority -->
<link
  rel="preload"
  as="image"
  href="hero.avif"
  fetchpriority="high"
>
<!-- Google не поддерживает fetchpriority на CSS background напрямую — только через preload -->
```

### Responsive LCP image

```html
<!-- ✅ srcset для разных размеров + fetchpriority -->
<img
  src="hero-800.avif"
  srcset="
    hero-400.avif  400w,
    hero-800.avif  800w,
    hero-1200.avif 1200w,
    hero-1600.avif 1600w
  "
  sizes="(max-width: 768px) 100vw, 1200px"
  alt="Hero"
  width="1200"
  height="600"
  loading="eager"
  fetchpriority="high"
>

<!-- ✅ <picture> для AVIF с WebP fallback -->
<picture>
  <source
    srcset="hero-800.avif 800w, hero-1200.avif 1200w"
    type="image/avif"
    sizes="(max-width: 768px) 100vw, 1200px"
  >
  <source
    srcset="hero-800.webp 800w, hero-1200.webp 1200w"
    type="image/webp"
    sizes="(max-width: 768px) 100vw, 1200px"
  >
  <img src="hero-800.jpg" alt="Hero" width="1200" height="600"
       loading="eager" fetchpriority="high">
</picture>
```

### Граничные случаи — где ломается

**LCP через JS-рендер**: если LCP элемент рендерится через React/Vue после hydration — браузер не видит его в HTML, discovery delay огромный. Решение: SSR/SSG + наличие в initial HTML.

**Несколько `fetchpriority="high"`**: если поставить на 5 изображений — все конкурируют за bandwidth с одинаковым приоритетом, итог = никакого прироста. Ровно один `fetchpriority="high"` — на LCP элемент.

**`loading="lazy"` на LCP**: lazy loading добавляет intersection observer delay. LCP элемент должен быть `loading="eager"` (дефолт) или явно `loading="eager"`. 

**Почему это важно архитектору:** LCP = первое впечатление пользователя. Архитектурное решение: LCP image должен быть в initial HTML (не JS), с правильным форматом (AVIF), srcset и одним `fetchpriority="high"`.

---

## 3. INP

### INP subparts: анатомия interaction

```
Полная модель взаимодействия:

User action (click/keypress/tap)
    │
    ▼
┌─────────────────┐
│  Input delay    │ — Время до начала обработки
│                 │   Причина: main thread занят (long task)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Processing time │ — Выполнение event handlers
│                 │   Причина: тяжёлая логика в handler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Presentation     │ — Браузер рендерит новый frame
│delay            │   Причина: много DOM mutations, forced layout
└─────────────────┘
    │
    ▼
Next Paint = INP записан

INP = max из всех взаимодействий за сессию (на 75-й перцентили)
```

### Диагностика через LoAF

```typescript
// LoAF — Long Animation Frame API (Baseline 2024)
// Более точный чем Long Tasks API для INP диагностики

const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      // Найти interaction-связанные scripts
      const scripts = entry.scripts || []
      const interactionScript = scripts.find(s => s.invokerType === 'event-listener')

      if (interactionScript) {
        console.group(`LoAF: ${entry.duration.toFixed(0)}ms`)
        console.log('Source:', interactionScript.sourceURL)
        console.log('Function:', interactionScript.sourceFunctionName)
        console.log('Invoker:', interactionScript.invoker)
        console.groupEnd()
      }
    }
  }
})
observer.observe({ type: 'long-animation-frame', buffered: true })
```

### Оптимизация input delay

```typescript
// Проблема: main thread занят в момент клика → input delay

// ❌ Тяжёлая инициализация блокирует main thread
window.addEventListener('load', () => {
  initHeavyAnalytics()     // 200ms
  buildSearchIndex()        // 150ms
  processUserHistory()      // 100ms
  // Итого: 450ms main thread блокировки
  // Любой клик в это время → input delay 450ms
})

// ✅ Defer non-critical инициализацию
window.addEventListener('load', async () => {
  // Первый кадр: critical only
  initCriticalFeatures()

  // Background: использовать scheduler.postTask
  await scheduler.postTask(() => initHeavyAnalytics(), { priority: 'background' })
  await scheduler.postTask(() => buildSearchIndex(), { priority: 'background' })
  await scheduler.postTask(() => processUserHistory(), { priority: 'background' })
})
```

### Оптимизация processing time

```typescript
// ❌ Тяжёлая синхронная логика в event handler
button.addEventListener('click', async (e) => {
  const data = await fetchLargeDataset()  // OK — async
  processAllItems(data)                    // ❌ синхронно, 200ms CPU
  updateDOM(data)
})

// ✅ Web Worker для CPU-bound части
button.addEventListener('click', async (e) => {
  const data = await fetchLargeDataset()
  const processed = await workerApi.processAllItems(data)  // Worker
  updateDOM(processed)  // Только DOM update на main thread
})

// ✅ Chunking через scheduler.yield() для длинных обновлений DOM
async function updateDOM(items: Item[]) {
  const fragment = document.createDocumentFragment()

  for (let i = 0; i < items.length; i++) {
    fragment.appendChild(renderItem(items[i]))

    if (i % 50 === 0) {
      await scheduler.yield()  // Отдать управление после каждых 50 элементов
    }
  }

  container.appendChild(fragment)
}
```

### Оптимизация presentation delay

```typescript
// Presentation delay = время браузера на рендер после handler

// ❌ Вызвать forced layout в handler → дополнительный reflow
button.addEventListener('click', () => {
  items.forEach(item => {
    item.style.height = item.offsetHeight + 10 + 'px'  // read + write в цикле
    // offsetHeight = forced synchronous layout каждую итерацию
  })
})

// ✅ Batch reads отдельно от writes
button.addEventListener('click', () => {
  // Сначала все reads
  const heights = items.map(item => item.offsetHeight)
  // Затем все writes
  items.forEach((item, i) => {
    item.style.height = heights[i] + 10 + 'px'
  })
})

// ✅ CSS вместо JS для visual updates
// transform/opacity — compositor thread, не вызывают layout
button.addEventListener('click', () => {
  element.classList.add('expanded')  // CSS transition/animation
  // Вместо JS animation через requestAnimationFrame с layout свойствами
})
```

### Граничные случаи — где ломается

**TBT хороший, INP плохой**: Total Blocking Time — lab метрика, измеряет blocking time при загрузке. INP измеряет отзывчивость после загрузки. Можно иметь TBT < 200ms и INP 500ms если event handlers тяжёлые. 

**Third-party scripts и INP**: Google Tag Manager, чат-виджеты, A/B testing скрипты регулярно занимают main thread в произвольные моменты → input delay. Диагноз через LoAF: `entry.scripts[].sourceURL` покажет vendor файлы. Решение: `type="module"` + defer для third-party, или Web Worker если возможно.

**Почему это важно архитектору:** INP — самая сложная из трёх метрик для fix. Требует понимания всей цепочки: long tasks → input delay, event handlers → processing time, DOM mutations → presentation delay. Архитектурное решение: CPU-bound работа → Workers, DOM updates → batch, third-party → defer/Worker.

---

## 4. CLS

### Что считается layout shift

```
Layout shift = неожиданное смещение visible элемента
CLS = сумма weighted impact fractions за сессию

impact fraction = затронутая area / viewport area
distance fraction = максимальное смещение / viewport dimension
shift score = impact fraction × distance fraction

CLS = sum всех shift score (кроме вызванных user interaction)
```

### Топ причин CLS и фиксы

```html
<!-- ❌ Изображения без размеров → layout shift при загрузке -->
<img src="hero.avif" alt="Hero">
<!-- Браузер не знает размер → резервирует 0px → загрузка → сдвиг -->

<!-- ✅ Явные width и height = браузер резервирует правильное место -->
<img src="hero.avif" alt="Hero" width="1200" height="600">
<!-- aspect-ratio автоматически из width/height в modern browsers -->
```

```css
/* ✅ CSS aspect-ratio для динамических изображений */
.card-image {
  aspect-ratio: 16 / 9;
  width: 100%;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

```typescript
// ❌ Вставка баннеров/ads/контента выше существующего контента
function showBanner(banner: HTMLElement) {
  document.body.prepend(banner)  // Сдвигает весь контент вниз
}

// ✅ Резервировать место заранее
// CSS:
// .banner-slot { min-height: 90px; }  /* Зарезервировано для banner */

// ✅ Или вставлять только ниже fold (не в viewport)
function showBanner(banner: HTMLElement) {
  const viewportBottom = window.scrollY + window.innerHeight
  const insertPoint = document.querySelector('.below-fold')
  if (insertPoint && insertPoint.getBoundingClientRect().top > viewportBottom) {
    insertPoint.before(banner)  // Ниже viewport — не вызывает visible shift
  }
}
```

```css
/* ❌ Web fonts без size-adjust → FOUT вызывает layout shift */
@font-face {
  font-family: 'Custom Font';
  src: url('font.woff2');
  font-display: swap;  /* Swap = FOUT */
}

/* ✅ size-adjust компенсирует разницу метрик с fallback */
@font-face {
  font-family: 'Custom Font Fallback';
  src: local('Arial');
  size-adjust: 105%;        /* Подобрать под конкретный font */
  ascent-override: 90%;
  descent-override: 20%;
}

/* f-mods (Font Metric Override) инструменты:
   https://screenspan.net/fallback — генератор значений */
```

```typescript
// ❌ Анимация top/left/margin → layout shift + reflow
element.animate([
  { marginTop: '0px' },
  { marginTop: '20px' },
], { duration: 300 })

// ✅ Только transform/opacity — compositor thread, нет layout shift
element.animate([
  { transform: 'translateY(0px)' },
  { transform: 'translateY(20px)' },
], { duration: 300 })
```

### Граничные случаи — где ломается

**Skeleton loaders и CLS**: skeleton правильно резервирует место только если его размер точно совпадает с реальным контентом. Если текст в карточке переполняет скелетон → layout shift при замене. Решение: skeleton с `min-height` или точные размеры от API.

**`font-display: optional`**: не вызывает FOUT/FOIT (не отображает пока font не загружен в первый render). CLS = 0 для шрифтов. Но если шрифт не загружен достаточно быстро — отображается fallback навсегда. Компромисс: `optional` для некритичных шрифтов, `swap` + size-adjust для display шрифтов.

**Почему это важно архитектору:** CLS — единственная метрика которую можно полностью контролировать на уровне вёрстки. Явные размеры на изображениях + резервирование места для динамического контента = CLS ≈ 0.

---

## 5. Attribution API и RUM

### web-vitals npm — полный setup

```typescript
// npm install web-vitals@4
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals/attribution'

type Metric = {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  attribution: Record<string, unknown>
}

function sendToAnalytics(metric: Metric): void {
  // Отправить в свой RUM endpoint
  const payload = {
    metric: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating,
    // Attribution: причина плохого показателя
    attribution: metric.attribution,
    // Контекст
    url: location.href,
    connection: (navigator as Navigator & { connection?: { effectiveType: string } })
      .connection?.effectiveType,
    timestamp: Date.now(),
  }

  // Использовать sendBeacon для надёжной отправки при unload
  navigator.sendBeacon('/api/vitals', JSON.stringify(payload))
}

// Attribution содержит диагностику:

onLCP(metric => {
  // metric.attribution.lcpEntry — PerformanceEntry LCP элемента
  // metric.attribution.url — URL LCP ресурса
  // metric.attribution.timeToFirstByte, loadDelay, loadTime, renderDelay
  sendToAnalytics(metric)
})

onINP(metric => {
  // metric.attribution.interactionTarget — CSS selector элемента
  // metric.attribution.inputDelay, processingDuration, presentationDelay
  // metric.attribution.longAnimationFrameEntries — LoAF entries
  sendToAnalytics(metric)
})

onCLS(metric => {
  // metric.attribution.largestShiftTarget — элемент вызвавший shift
  // metric.attribution.largestShiftValue — score
  sendToAnalytics(metric)
})

onFCP(sendToAnalytics)
onTTFB(sendToAnalytics)
```

### Мониторинг в production

```typescript
// Aggregation по 75-й перцентили (как Google)
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

// Алерт если 75-я перцентиль выходит за пороги
function checkVitals(lcpValues: number[], inpValues: number[], clsValues: number[]) {
  const lcp75 = percentile(lcpValues, 75)
  const inp75 = percentile(inpValues, 75)
  const cls75 = percentile(clsValues, 75)

  if (lcp75 > 2500) console.error(`LCP degraded: ${lcp75}ms`)
  if (inp75 > 200)  console.error(`INP degraded: ${inp75}ms`)
  if (cls75 > 0.1)  console.error(`CLS degraded: ${cls75}`)
}
```

---

## Реальный кейс

**Входные данные:** E-commerce каталог. CrUX: LCP 4.2s (poor), INP 380ms (needs improvement), CLS 0.18 (needs improvement). Lighthouse lab: LCP 2.1s (good). Разрыв между field и lab — красный флаг.

**Гипотеза:**
- LCP разрыв field/lab → проблема не в базовой загрузке, а в реальных условиях (медленные мобильные устройства, cache miss)
- INP 380ms → event handlers тяжёлые или main thread занят при взаимодействии
- CLS → динамический контент (баннеры, «в наличии» бейджи) вставляется без резервирования места

**Результат диагностики через web-vitals attribution:**
- LCP attribution: `loadDelay: 800ms` — изображение открыто поздно, `fetchpriority` не был выставлен
- INP attribution: `interactionTarget: '.add-to-cart'`, `inputDelay: 220ms`, LoAF показал Google Tag Manager в момент click
- CLS attribution: `largestShiftTarget: '.promo-banner'` — баннер вставлялся в top после загрузки без зарезервированного места

**Фиксы:**
1. LCP: добавить `fetchpriority="high"` на hero product image + AVIF формат
2. INP: GTM перенесён на `defer`, `.add-to-cart` handler облегчён (тяжёлый analytics в `scheduler.postTask`)
3. CLS: `.promo-banner-slot { min-height: 60px }` в initial HTML, баннер fill in place

**Вывод, противоречащий интуиции:** Lighthouse показывал LCP 2.1s (good) — казалось, проблем нет. CrUX field data: 4.2s (poor). Lighthouse работает на условном «быстром» устройстве и кешированных ресурсах. Реальные пользователи — mid-range Android, первый визит, cache miss. Оптимизировать надо по field data, а Lighthouse использовать как debugger, не как KPI.

---

## Антипаттерны

**1. Оптимизировать Lighthouse score вместо CrUX**
```
❌ Цель: 100/100 в Lighthouse
   Lighthouse работает в lab условиях, не учитывается Google

✅ Цель: 75-я перцентиль CrUX попадает в "хорошо"
   Google Search Console → Core Web Vitals → field data
```

**2. `fetchpriority="high"` на несколько изображений**
```html
❌ <img fetchpriority="high"> <!-- hero -->
   <img fetchpriority="high"> <!-- второе изображение -->
   <!-- Оба конкурируют — прироста нет -->

✅ Ровно один fetchpriority="high" — на LCP элемент
   Остальные: fetchpriority="low" или без атрибута
```

**3. `loading="lazy"` на LCP элемент**
```html
❌ <img src="hero.avif" loading="lazy" fetchpriority="high">
   <!-- lazy + high = противоречие, lazy выигрывает -->

✅ <img src="hero.avif" loading="eager" fetchpriority="high">
```

**4. Изображения без width и height**
```html
❌ <img src="photo.avif" alt="Photo">
   <!-- Браузер резервирует 0px → CLS при загрузке -->

✅ <img src="photo.avif" alt="Photo" width="800" height="600">
```

**5. Анимировать layout свойства**
```css
❌ .slide { animation: slideIn 0.3s; }
   @keyframes slideIn { from { margin-top: -100px; } }
   /* margin-top → layout shift + reflow */

✅ .slide { animation: slideIn 0.3s; }
   @keyframes slideIn { from { transform: translateY(-100px); } }
   /* transform → compositor thread, нет CLS */
```

**6. Игнорировать third-party scripts как причину INP**
```
❌ Оптимизировать собственный код, GTM не трогать
   GTM + чат виджет часто = 300-500ms main thread в момент взаимодействия

✅ LoAF attribution → sourceURL → определить vendor
   Перенести на defer / загружать после первого interaction
```

---

## Anti-checklist ☠️

- [ ] Интерпретировать single CrUX report как истину — данные за 28 дней усреднены
- [ ] RUM без фильтрации ботов — боты искажают реальные метрики пользователей
- [ ] Лечить полевое значение по лабораторному — Lighthouse simulate ≠ реальное устройство
- [ ] Фокусироваться на p50, игнорируя p95 — половина пользователей страдает
- [ ] Одна метрика диагностики — LCP высокий из-за TTFB, лечить не изображение а сервер
- [ ] Не сегментировать RUM по устройству — десктоп и мобиль имеют разные лимиты

---

## Задачи AI-кодеру

**Плохая формулировка:**
> «Улучши Core Web Vitals»

**Хорошая формулировка:**
> «Добавить RUM мониторинг Core Web Vitals:
> 1. `npm install web-vitals@4`.
> 2. В `src/analytics/vitals.ts`: импортировать `onLCP, onINP, onCLS, onFCP, onTTFB` из `web-vitals/attribution`.
> 3. Каждый callback: отправлять через `navigator.sendBeacon('/api/vitals', JSON.stringify({ metric, value, rating, attribution, url }))`.
> 4. В `src/main.ts`: вызвать все пять функций после DOMContentLoaded.
> 5. В Express/Next.js: POST `/api/vitals` → логировать в structured log (JSON).
> 6. Не отправлять в development (`if (import.meta.env.PROD)`).»

---

**Плохая формулировка:**
> «Исправь LCP»

**Хорошая формулировка:**
> «Оптимизировать LCP hero изображение:
> 1. Найти LCP элемент: Chrome DevTools → Performance → клик на LCP marker.
> 2. Если `<img>`: добавить `loading="eager" fetchpriority="high" decoding="async"`.
> 3. Если CSS background: добавить `<link rel="preload" as="image" href="..." fetchpriority="high">` в `<head>`.
> 4. Конвертировать в AVIF (если ещё не): `sharp input.jpg -o hero.avif`.
> 5. Добавить `srcset` с размерами 400w, 800w, 1200w и соответствующий `sizes`.
> 6. Убедиться что элемент присутствует в initial HTML (не рендерится JS после hydration).
> 7. Измерить: PageSpeed Insights → LCP subparts → `loadDelay` должен уменьшиться.»

---

## Чеклист архитектора

**Измерение**
- [ ] Google Search Console → CWV report подключён
- [ ] web-vitals@4 с attribution установлен, отправляет в RUM
- [ ] Алерт при деградации 75-й перцентили

**LCP**
- [ ] LCP элемент в initial HTML (не JS-рендер)
- [ ] Ровно один `fetchpriority="high"` на LCP image
- [ ] `loading="eager"` на LCP image
- [ ] AVIF + srcset + sizes
- [ ] LCP image в hero: `preload` если CSS background

**INP**
- [ ] Event handlers: CPU-bound работа → Web Worker
- [ ] DOM updates > 100 элементов → chunking через `scheduler.yield()`
- [ ] Third-party scripts → `defer` + LoAF мониторинг
- [ ] Forced layout (offsetWidth в цикле) устранён

**CLS**
- [ ] Все `<img>` имеют `width` и `height`
- [ ] Динамический контент (баннеры, ads) → зарезервированное место
- [ ] Анимации используют только `transform`/`opacity`
- [ ] Web fonts: `size-adjust` + `font-display: swap` или `optional`

---

*Модуль 39 завершён.*
*Следующий: [Модуль 40 — Performance budget и CI регрессии](../40-performance-budget/README.md)*
