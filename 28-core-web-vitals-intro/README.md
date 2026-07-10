# Модуль 28 — Core Web Vitals: intro

> **Для AI-архитектора:** Core Web Vitals — это не SEO-чеклист. Это сигналы о том, как пользователь воспринимает скорость и стабильность страницы. AI-кодер получит 95 в Lighthouse и скажет «готово» — но Lighthouse это lab data. Для Google Rankings важен CrUX (field data от реальных пользователей), и он может кардинально отличаться. 47% сайтов не проходят пороги в 2026 году.
> Один день изучения — механика LCP/INP/CLS, field vs lab разница, измерение в production, Lighthouse CI gates.

---

## Содержание

1. [Три метрики — механика](#1-метрики)
2. [LCP — оптимизация](#2-lcp)
3. [INP — реактивность](#3-inp)
4. [CLS — визуальная стабильность](#4-cls)
5. [Field data vs Lab data](#5-field-vs-lab)
6. [Измерение в production](#6-измерение)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Lighthouse | **13.4.0** | Lab performance audit |
| web-vitals (npm) | **5.3.0** | Field measurement library (~2KB brotli) |
| Lighthouse CI (`@lhci/cli`) | **0.15.1** | CI gates для performance |
| CrUX API | v1 | Field data от Chrome пользователей |

### Пороговые значения 2026

| Метрика | Good | Needs Improvement | Poor |
| :-- | :-- | :-- | :-- |
| LCP | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| INP | ≤ 200ms | 200–500ms | > 500ms |
| CLS | ≤ 0.1 | 0.1–0.25 | > 0.25 |

> INP заменил FID (First Input Delay) в марте 2024. INP строже: измеряет **все** взаимодействия, не только первое.

---

## 1. Метрики

### Что каждая метрика измеряет

```
LCP (Largest Contentful Paint)
  │
  └─ Время до отрисовки наибольшего видимого элемента
     (обычно hero image, h1, или блок текста)
     Вопрос: «Когда страница выглядит загруженной?»

INP (Interaction to Next Paint)
  │
  └─ Худшее время от взаимодействия (click, tap, keypress)
     до следующей отрисовки браузером
     Вопрос: «Насколько отзывчива страница?»
     Percentile: 98-й по всем взаимодействиям за сессию

CLS (Cumulative Layout Shift)
  │
  └─ Сумма неожиданных смещений layout за время жизни страницы
     Вопрос: «Стабильна ли страница визуально?»
     Формула: impact fraction × distance fraction
```

### Связь с бизнес-метриками

```
LCP +0.1s  →  -1% конверсий (e-commerce, Google research)
INP >500ms →  bounce rate +x% — пользователь считает сайт «лагающим»
CLS >0.1   →  случайные клики по неправильным элементам → отказы
```

---

## 2. LCP

### Что является LCP элементом

Браузер отслеживает наибольший видимый элемент по мере загрузки. LCP элемент может **меняться** в процессе загрузки:

```
t=0.1s: текст заголовка (LCP = 0.1s)
t=0.8s: изображение загрузилось, стало больше (LCP = 0.8s) ← финальный LCP
```

Кандидаты: `<img>`, `<image>` в SVG, `<video poster>`, элементы с `background-image`, блоки текста (`<p>`, `<h1>`, etc.).

### Критический путь LCP

```
HTML parsing
    │
    ├── Preload scanner обнаружил <img> или preload hint
    │       ↓
    │   fetch image (параллельно с parsing)
    │
    ├── CSS загружен и применён (render-blocking)
    │
    └── LCP элемент отрисован
            ↑
            Это и есть LCP timestamp
```

### Оптимизация — по приоритету

```html
<!-- 1. fetchpriority="high" для LCP image — без задержки браузерного приоритизатора -->
<img
  src="/hero.avif"
  alt="Hero"
  width="1200"
  height="600"
  fetchpriority="high"
  decoding="async"
/>

<!-- 2. Preload — если LCP в CSS background или через JS -->
<link
  rel="preload"
  as="image"
  href="/hero.avif"
  imagesrcset="/hero-400.avif 400w, /hero-800.avif 800w, /hero.avif 1200w"
  imagesizes="100vw"
/>

<!-- 3. НЕ использовать loading="lazy" для LCP элемента -->
<!-- lazy откладывает загрузку — прямо противоположное нужному -->
```

```typescript
// Next.js: priority prop = fetchpriority="high" + preload
<Image
  src="/hero.avif"
  alt="Hero"
  width={1200}
  height={600}
  priority          // ← обязательно для above-fold images
/>
```

### Форматы изображений и размеры

```html
<!-- AVIF: лучшее сжатие (30-50% меньше WebP), поддержка 95%+ браузеров -->
<!-- WebP: fallback, широкая поддержка -->
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" width="1200" height="600" fetchpriority="high" />
</picture>
```

### Граничные случаи — где ломается

**Font render blocking и LCP**: если LCP элемент — текст, а шрифт не загружен — браузер показывает FOIT (invisible text) или FOUT (system font → swap). Оба случая ломают «визуальную загрузку».

```css
/* font-display: optional — не показывать swap, использовать только если шрифт уже в кеше */
/* Лучший вариант для LCP текста — нет layout shift от swap */
@font-face {
  font-family: 'MyFont';
  src: url('/fonts/my-font.woff2') format('woff2');
  font-display: optional;  /* или swap — но тогда CLS риск */
}
```

**LCP внутри iframe**: браузер не отслеживает LCP внутри cross-origin iframe. Если hero — embed (карта, видео) — LCP будет измеряться по placeholder, не по embed контенту.

**Почему это важно архитектору:** `loading="lazy"` на all images — стандартный AI-шаблон. Для above-fold images это прямо ухудшает LCP. `fetchpriority="high"` + `loading="eager"` (default) для hero.

---

## 3. INP

### Механика: от взаимодействия до paint

```
User click
    │
    ├── Event handlers (JS) ← Input Delay
    │   └── JavaScript задачи в очереди
    │
    ├── Rendering work ← Processing Time
    │   ├── Style recalculation
    │   ├── Layout
    │   └── Paint
    │
    └── Next frame displayed ← Presentation Delay
            ↑
            Время от click до здесь = INP contribution
```

INP = 98-й перцентиль по **всем** взаимодействиям за сессию. Одна тяжёлая операция при клике — плохой INP.

### Long Tasks — главный враг INP

```typescript
// ❌ Long task — блокирует main thread, INP страдает
function processLargeList(items: Item[]) {
  return items.map(item => expensiveTransform(item))  // 500ms+ на main thread
}

// ✅ Разбить на chunks через scheduler API (Chrome 115+)
async function processLargeListChunked(items: Item[]) {
  const results: Result[] = []

  for (const item of items) {
    results.push(expensiveTransform(item))

    // Уступить управление браузеру каждые ~50 items
    if (results.length % 50 === 0) {
      await scheduler.yield()  // scheduler.yield() → Chrome 115+
      // fallback: await new Promise(r => setTimeout(r, 0))
    }
  }

  return results
}
```

### React и INP

React 19 с concurrent rendering улучшает INP через time-slicing. Но hydration при первом взаимодействии — известная проблема:

```typescript
// ❌ Тяжёлый обработчик блокирует Paint
function handleFilter(query: string) {
  const filtered = expensiveFilter(largeList, query)  // 200ms
  setItems(filtered)
}

// ✅ startTransition — пометить update как non-urgent
import { startTransition, useState } from 'react'

function handleFilter(query: string) {
  setQuery(query)  // urgent — немедленно обновить input

  startTransition(() => {
    const filtered = expensiveFilter(largeList, query)
    setItems(filtered)  // deferred — может быть прерван
  })
}

// ✅ useDeferredValue — для дорогих re-renders
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => search(deferredQuery),  // обновляется не на каждый keystroke
    [deferredQuery]
  )
  return <ResultList items={results} />
}
```

### Граничные случаи — где ломается

**Third-party scripts и INP**: Google Tag Manager, чат-виджеты, analytics — все занимают main thread. Один плохой third-party = весь сайт с плохим INP в CrUX.

```html
<!-- Загружать third-party после LCP через requestIdleCallback -->
<script>
  window.addEventListener('load', () => {
    requestIdleCallback(() => {
      // Инициализировать analytics, chat widget только здесь
      initAnalytics()
    })
  })
</script>
```

**`scheduler.yield()` совместимость**: Chrome 115+, Firefox — нет. Для cross-browser: `await new Promise(r => setTimeout(r, 0))` как fallback.

**Почему это важно архитектору:** INP значительно строже FID который он заменил — сайты, легко проходившие FID, теперь могут провалить INP. React-приложения с тяжёлыми event handlers — зона риска.

---

## 4. CLS

### Формула и причины

```
CLS score = Σ (impact_fraction × distance_fraction)

impact_fraction: доля viewport, затронутая смещением
distance_fraction: максимальное расстояние смещения / viewport height

Пример:
  Баннер 50% viewport сдвинулся вниз на 25% viewport:
  0.5 × 0.25 = 0.125  → Needs Improvement
```

### Основные причины и исправления

**1. Изображения без размеров**

```html
<!-- ❌ Браузер не знает размер до загрузки → layout shift при загрузке -->
<img src="/photo.jpg" alt="Photo" />

<!-- ✅ Явные width/height → браузер резервирует место -->
<img src="/photo.jpg" alt="Photo" width="800" height="600" />

<!-- ✅ CSS aspect-ratio как альтернатива -->
<style>
  .img-container {
    aspect-ratio: 4 / 3;  /* резервирует место */
    overflow: hidden;
  }
</style>
```

**2. Динамически вставляемый контент**

```typescript
// ❌ Баннер вставляется после рендера → всё ниже смещается
useEffect(() => {
  if (showBanner) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="banner">...</div>')
  }
}, [showBanner])

// ✅ Резервировать место в layout заранее
<div className={styles.bannerSlot} aria-hidden={!showBanner}>
  {showBanner && <Banner />}
</div>
```

**3. Web Fonts и FOUT**

```css
/* font-display: swap → текст сначала системным шрифтом, потом swap → CLS */
/* font-display: optional → использовать шрифт только если уже в кеше → 0 CLS */
/* font-display: block → invisible text → плохой LCP */

/* Для контентных шрифтов (заголовки) — optional лучше */
/* Для UI шрифтов (кнопки, навигация) — swap приемлем */
@font-face {
  font-display: optional;
}
```

**4. Ads и embeds**

```css
/* Резервировать место для рекламного блока до его загрузки */
.ad-slot {
  min-height: 250px;   /* стандартный размер Medium Rectangle */
  width: 300px;
  background: var(--color-surface-offset);
}
```

### Граничные случаи — где ломается

**CLS и анимации**: `transform` и `opacity` анимации не вызывают CLS — они не меняют layout. `top`, `left`, `width`, `height` — вызывают. Для смещений использовать `transform: translateY()`.

**CLS window**: Google измеряет CLS как максимальное значение среди всех «session windows» (группа смещений с паузами < 1s, максимум 5s). Долгая страница с несколькими scroll depths — несколько windows.

**Почему это важно архитектору:** `aspect-ratio` в CSS — самый недооценённый инструмент для CLS. Один `aspect-ratio: 16/9` на контейнер изображения решает проблему без JS.

---

## 5. Field vs Lab

### Принципиальная разница

```
Lab data (Lighthouse, PageSpeed Insights):
  ├── Контролируемая среда: Chrome Canary, 4G throttling, no extensions
  ├── Один тестовый запуск
  ├── Воспроизводимо, подходит для CI gates
  └── НЕ влияет на Google Rankings напрямую

Field data (CrUX — Chrome User Experience Report):
  ├── Реальные пользователи Chrome за последние 28 дней
  ├── Разные устройства, сети, локации
  ├── p75 (75-й перцентиль) — порог оценки
  ├── Влияет на Page Experience сигнал в Google Rankings
  └── 28-дневное скользящее окно — изменения видны медленно
```

### Расхождения между Lab и Field

```
Ситуация → Lab хороший, Field плохой:

1. Third-party scripts не загружаются в Lighthouse
   → GTM/Intercom → INP ухудшается только у реальных пользователей

2. CDN кеш — в Lighthouse uncached запрос
   → LCP лучше у реальных пользователей (кеш работает)

3. Пользователи на медленных Android устройствах
   → 4G throttling в Lighthouse ≠ Xiaomi Redmi на 3G

4. Реальные взаимодействия пользователей
   → INP невозможно измерить в Lighthouse (нет реальных кликов)
```

### CrUX API — программный доступ

```typescript
// Получить field data для URL
const response = await fetch(
  `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://example.com/blog/post',
      metrics: ['largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift'],
      formFactor: 'PHONE',  // DESKTOP, TABLET, или ALL
    }),
  }
)

const data = await response.json()
const lcp = data.record.metrics.largest_contentful_paint
// lcp.percentiles.p75 → значение на 75-м перцентиле
// lcp.histogram → распределение Good/Needs Improvement/Poor
```

---

## 6. Измерение в production

### web-vitals library

```typescript
// analytics.ts — отправлять метрики в GA4 или кастомный endpoint
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals'

type MetricReport = {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  id: string
  navigationType: string
}

function sendToAnalytics(metric: MetricReport) {
  // GA4
  if (typeof gtag !== 'undefined') {
    gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      metric_rating: metric.rating,
      metric_id: metric.id,
      non_interaction: true,
    })
  }

  // Кастомный endpoint
  navigator.sendBeacon('/api/metrics', JSON.stringify({
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    url: location.href,
    userAgent: navigator.userAgent,
  }))
}

onLCP(sendToAnalytics)
onINP(sendToAnalytics)
onCLS(sendToAnalytics)
onFCP(sendToAnalytics)    // дополнительно
onTTFB(sendToAnalytics)   // дополнительно
```

### Lighthouse CI в GitHub Actions

```yaml
# .github/workflows/ci.yml
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            https://staging.example.com/
            https://staging.example.com/blog/sample-post
            https://staging.example.com/products/featured
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
          temporaryPublicStorage: true
```

```json
// lighthouse-budget.json — performance gates
[
  {
    "path": "/*",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "total-blocking-time", "budget": 300 }
    ],
    "sizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "image", "budget": 500 }
    ],
    "scores": [
      { "category": "performance", "minScore": 85 },
      { "category": "accessibility", "minScore": 90 }
    ]
  }
]
```

---

## Антипаттерны

**1. `loading="lazy"` на LCP image**
Самый распространённый. `lazy` откладывает загрузку до приближения к viewport — именно hero image всегда в viewport → намеренно задерживает LCP. Только `loading="lazy"` для below-fold images.

**2. Доверять только Lighthouse score**
Lab 95 ≠ хороший Field score. CrUX может показывать Poor LCP на мобильных пользователях при отличном Lighthouse. Настраивать измерение через web-vitals library + реальный трафик.

**3. Внедрять third-party scripts в `<head>` без defer**
```html
<!-- ❌ Блокирует parsing, занимает main thread при загрузке -->
<script src="https://cdn.analytics.com/script.js"></script>

<!-- ✅ defer + загрузка после LCP -->
<script src="https://cdn.analytics.com/script.js" defer></script>
```

**4. `font-display: swap` для контентных шрифтов**
`swap` → FOUT → CLS. Для шрифтов заголовков, где текст — LCP элемент: `optional` исключает layout shift.

**5. Вставлять баннеры/уведомления без резервирования места**
Cookie banner, notification bar — вставляются динамически и смещают контент. Резервировать `min-height` в layout или показывать поверх контента (fixed/absolute).

**6. Оптимизировать только homepage для Lighthouse**
CrUX работает на уровне URL. Плохой INP на /checkout или /product может держать весь origin в Poor статусе. Проверять критические conversion страницы.

---

## Anti-checklist ☠️

- [ ] Оптимизировать Lighthouse score вместо field data — lab ≠ реальные пользователи
- [ ] Фокусироваться только на одной метрике — LCP без CLS = быстрая загрузка с прыжками
- [ ] Игнорировать мобильные устройства — CWV считаются по мобильным данным
- [ ] Ставить performance budget без измерения baseline — непонятно достижима ли цель
- [ ] Оптимизировать до первого измерения — 80% проблем видны в Chrome DevTools за 5 минут
- [ ] Использовать `loading="lazy"` для LCP-элемента — откладывает загрузку самого важного

## Задачи AI-кодеру

**Плохая формулировка:**
> «Оптимизируй страницу для Core Web Vitals»

**Хорошая формулировка:**
> «Исправь LCP проблемы в компоненте Hero.
> 1. Hero `<img>`: добавить `fetchpriority="high"`, `loading="eager"` (убрать lazy если есть), `width` и `height` атрибуты.
> 2. Добавить `<link rel="preload" as="image">` в `<head>` для hero image.
> 3. Если Next.js — заменить `<img>` на `<Image priority />`.
> 4. Конвертировать hero в AVIF через sharp с fallback WebP в `<picture>`.
> Не трогать images ниже fold — там lazy нужен.»

---

**Плохая формулировка:**
> «Исправь CLS на сайте»

**Хорошая формулировка:**
> «Найди все `<img>` без `width` и `height` атрибутов в компонентах. Добавить атрибуты либо CSS `aspect-ratio` на контейнер. Для элементов с `font-display: swap` в @font-face — изменить на `optional` если это заголовочный шрифт. Для динамических блоков (banner, cookie notice) добавить `min-height` в родительский контейнер чтобы зарезервировать место до загрузки.»

---

## Чеклист архитектора

**LCP**
- [ ] Hero image: `fetchpriority="high"`, нет `loading="lazy"`, явные `width`/`height`
- [ ] `<link rel="preload">` для LCP image если она в CSS background
- [ ] Изображения в AVIF (primary) + WebP (fallback) через `<picture>`
- [ ] Шрифты: `font-display: optional` для контентных, `swap` только для UI
- [ ] Render-blocking CSS минимизирован / critical CSS inline

**INP**
- [ ] Тяжёлые вычисления разбиты через `scheduler.yield()` или setTimeout chunks
- [ ] React: `startTransition` для deferred state updates
- [ ] Third-party scripts загружаются через `requestIdleCallback` после load
- [ ] Long Tasks в DevTools Performance profiler проверены (< 50ms задачи)

**CLS**
- [ ] Все `<img>` имеют `width`/`height` или CSS `aspect-ratio`
- [ ] Динамический контент (ads, banners) с резервированным `min-height`
- [ ] Анимации только через `transform`/`opacity`, не `top`/`left`
- [ ] Шрифты: `font-display: optional` для заголовочных

**Измерение**
- [ ] `web-vitals` library установлена, метрики отправляются в analytics
- [ ] Lighthouse CI с budget gates в pipeline (LCP < 2500ms, TBT < 300ms)
- [ ] CrUX данные проверяются (Search Console → Core Web Vitals report)
- [ ] Мобильные пользователи измеряются отдельно от desktop

---

*Модуль 28 завершён.*
*Следующий: [Модуль 29 — Critical CSS inlining](../29-critical-css/README.md)*
