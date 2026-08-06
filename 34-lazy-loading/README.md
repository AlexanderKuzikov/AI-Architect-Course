# Модуль 34 — Lazy Loading и Code Splitting

> **Для AI-архитектора:** lazy loading — не «добавить `loading="lazy"` на все изображения». Это стратегия: что загружаем eagerly (критично для LCP), что defer (below-fold), что split (редко используется). Code splitting — не «создать как можно больше чанков». Это balance: слишком много чанков = waterfall запросов, слишком мало = большой initial bundle. Архитектурный вопрос: где граница между eager и lazy, и как избежать cumulative waterfall при вложенных lazy imports.
> Один день изучения — нативный `loading="lazy"`, IntersectionObserver паттерны, JS code splitting стратегии, Vite/Rollup конфиг, preloading/prefetching, React.lazy + Suspense.

---

## Содержание

1. [Стратегия: что lazy, что eager](#1-стратегия)
2. [Image lazy loading](#2-images)
3. [IntersectionObserver паттерны](#3-intersectionobserver)
4. [JS Code splitting](#4-code-splitting)
5. [Vite / Rollup конфиг](#5-vite-rollup)
6. [Preload / Prefetch стратегия](#6-preload-prefetch)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Vite | **8.x** | Bundler + dev server |
| Rollup | **4.x** | Bundler (Vite использует под капотом) |
| @vitejs/plugin-react | **4.x** | React + HMR |
| rollup-plugin-visualizer | **5.x** | Bundle analysis |
| vite-bundle-analyzer | актуальный | Bundle analysis (альтернатива) |

---

## 1. Стратегия

### Матрица: что загружать когда

```
Eager (загрузить сразу):
  ✓ LCP element — hero image, главный заголовок
  ✓ Above-fold CSS (из модуля 29)
  ✓ Core application JS (routing, state management)
  ✓ Шрифты для above-fold текста (preload)

Lazy (отложить):
  ✓ Изображения below-the-fold
  ✓ Видео (нет autoplay) — poster eager, src lazy
  ✓ Тяжёлые компоненты: charts, maps, rich editor
  ✓ Модальные окна, dialogs — только при открытии
  ✓ Admin/settings разделы — при навигации
  ✓ Third-party виджеты (chat, reviews)

Split (отдельный chunk):
  ✓ Route-based: каждый маршрут → чанк
  ✓ Vendor libraries: react/react-dom, lodash, chart.js
  ✓ Heavy utils: pdf generator, xlsx parser, QR code
```

### Правило LCP — не lazy load LCP element

```html
<!-- ❌ LCP image с lazy loading → браузер откладывает загрузку
     LCP ухудшается на 500ms–1.5s -->
<img src="hero.jpg" loading="lazy" fetchpriority="low" alt="Hero">

<!-- ✅ LCP image: eager + high priority + preload в <head> -->
<link rel="preload" as="image" href="hero.jpg" fetchpriority="high">
<img src="hero.jpg" loading="eager" fetchpriority="high" alt="Hero">

<!-- Как определить LCP element: DevTools → Performance → LCP
     или web-vitals onLCP callback → entry.element -->
```

---

## 2. Images

### Нативный lazy loading (универсальная поддержка 2026)

```html
<!-- loading="lazy" — universal support в 2026 -->
<!-- Браузер загружает когда изображение близко к viewport -->
<img
  src="product.jpg"
  alt="Product name"
  width="800"
  height="600"
  loading="lazy"
  decoding="async"
/>

<!-- loading="lazy" НЕ использовать для: -->
<!-- - Первых 2-3 изображений на странице (likely above-fold) -->
<!-- - LCP image (обязательно eager + fetchpriority="high") -->
<!-- - Изображений с position: fixed/sticky (всегда видимы) -->
```

### `<picture>` + lazy loading

```html
<!-- lazy работает на <img> внутри <picture> -->
<picture>
  <source
    srcset="image.avif"
    type="image/avif"
  />
  <source
    srcset="image.webp"
    type="image/webp"
  />
  <img
    src="image.jpg"
    alt="Description"
    width="800"
    height="600"
    loading="lazy"
    decoding="async"
  />
</picture>
```

### Responsive images с lazy

```html
<!-- srcset + sizes + lazy = современный стандарт -->
<img
  srcset="
    image-400w.webp  400w,
    image-800w.webp  800w,
    image-1200w.webp 1200w
  "
  sizes="
    (max-width: 600px)  100vw,
    (max-width: 1200px) 50vw,
    33vw
  "
  src="image-800w.webp"
  alt="Description"
  width="800"
  height="600"
  loading="lazy"
  decoding="async"
/>
```

### Граничные случаи — где ломается

**`loading="lazy"` и NoScript/Googlebot**: Googlebot рендерит JavaScript, но поведение `loading="lazy"` может отличаться от user agent. Для SEO-критичных изображений (product images) — убедиться что src доступен без viewport check.

**`loading="lazy"` и CSS background**: атрибут работает только на `<img>` и `<iframe>`. CSS `background-image` — нативно не поддерживается. Нужен IntersectionObserver (раздел 3).

**threshold браузера**: Chrome загружает lazy images когда они примерно в 1250px (LTE) или 2500px (4G) от viewport — не точно на границе. Это намеренно: preload buffer. Нельзя контролировать точный порог.

**Почему это важно архитектору:** нативный `loading="lazy"` без `width`/`height` → CLS. Браузер не знает размер до загрузки → layout shift при появлении изображения. `width` + `height` обязательны.

---

## 3. IntersectionObserver

### Для CSS backgrounds и кастомных компонентов

```typescript
// Lazy load CSS background images
function lazyLoadBackgrounds(selector = '[data-lazy-bg]') {
  const elements = document.querySelectorAll<HTMLElement>(selector)
  if (!elements.length) return

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return

        const el = entry.target as HTMLElement
        const bgUrl = el.dataset.lazyBg

        if (bgUrl) {
          el.style.backgroundImage = `url(${bgUrl})`
          el.removeAttribute('data-lazy-bg')
        }

        obs.unobserve(el)
      })
    },
    {
      rootMargin: '200px 0px',  // preload за 200px до viewport
      threshold: 0,
    }
  )

  elements.forEach(el => observer.observe(el))
}

// HTML:
// <div data-lazy-bg="/images/section-bg.jpg" class="hero-section">
```

### Lazy load компонентов (vanilla JS)

```typescript
// Загрузить тяжёлую библиотеку только когда элемент виден
async function lazyLoadChart(container: HTMLElement) {
  const observer = new IntersectionObserver(
    async (entries, obs) => {
      const entry = entries[0]
      if (!entry.isIntersecting) return

      obs.unobserve(entry.target)

      // Загрузить Chart.js только когда chart container виден
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)

      new Chart(container.querySelector('canvas')!, {
        type: 'line',
        data: { /* ... */ },
      })
    },
    { threshold: 0.1 }
  )

  observer.observe(container)
}
```

### Граничные случаи — где ломается

**rootMargin и cross-origin iframes**: `rootMargin` не работает когда observer используется внутри cross-origin iframe — возвращает `rootMargin: "0px"`. Для embedded виджетов — fallback на scroll event.

**IntersectionObserver и display:none**: элементы с `display: none` или visibility: hidden никогда не пересекают viewport (нет intersection). `isIntersecting` всегда false. Для toggle visibility — использовать `opacity: 0` или `height: 0`.

**Почему это важно архитектору:** IntersectionObserver — не полная замена нативного `loading="lazy"`. Нативный использует browser preloader (сканирует HTML до парсинга DOM). IntersectionObserver — только после DOM ready. Для `<img>` — всегда нативный атрибут.

---

## 4. Code splitting

### Route-based splitting (максимальный ROI)

```typescript
// React Router v7 + React.lazy
import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

// ✅ Каждый маршрут → отдельный chunk
const HomePage    = lazy(() => import('./pages/HomePage'))
const BlogPage    = lazy(() => import('./pages/BlogPage'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
const AdminPage   = lazy(() => import('./pages/AdminPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <HomePage />
      </Suspense>
    ),
  },
  {
    path: '/blog/:slug',
    element: (
      <Suspense fallback={<ArticleSkeleton />}>
        <BlogPage />
      </Suspense>
    ),
  },
  {
    path: '/admin/*',
    element: (
      <Suspense fallback={<AdminSkeleton />}>
        <AdminPage />
      </Suspense>
    ),
  },
])
```

### Component-level splitting для тяжёлых UI

```typescript
// Модальное окно — загрузить только при открытии
import { lazy, Suspense, useState } from 'react'

const HeavyModal = lazy(() => import('./components/HeavyModal'))
const RichEditor  = lazy(() => import('./components/RichEditor'))
const ChartWidget = lazy(() => import('./components/ChartWidget'))

function Dashboard() {
  const [showModal, setShowModal] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  return (
    <div>
      <button onClick={() => setShowModal(true)}>Open Modal</button>

      {/* Render только при открытии — lazy import триггерится */}
      {showModal && (
        <Suspense fallback={<ModalSkeleton />}>
          <HeavyModal onClose={() => setShowModal(false)} />
        </Suspense>
      )}

      {/* ChartWidget всегда в DOM, но Suspense даёт fallback пока грузится */}
      <Suspense fallback={<ChartSkeleton />}>
        <ChartWidget />
      </Suspense>
    </div>
  )
}
```

### Dynamic import с named exports

```typescript
// React.lazy работает только с default exports
// Для named exports — wrapper:

const { DataTable } = await import('./components/DataTable')
// ✅ Прямо:
const DataTable = lazy(() =>
  import('./components/DataTable').then(m => ({ default: m.DataTable }))
)

// Или через re-export файл:
// components/DataTable/index.ts
// export { DataTable as default } from './DataTable'
```

### Граничные случаи — где ломается

**Lazy import waterfall**: компонент A lazy → внутри A импортируется B lazy → внутри B импортируется C lazy. Три sequential network requests при первом рендере. Решение: flatten imports, использовать preload на hover/focus.

**Suspense boundary granularity**: один Suspense на всё приложение — любой lazy chunk показывает fallback для всей страницы. Слишком много Suspense boundaries — много одновременных fallback UI. Правило: Suspense на уровне route + на уровне тяжёлых компонентов, не на каждом `lazy()`.

**React.lazy и SSR**: `React.lazy` не работает в Node.js server-side rendering без специальной обработки. Next.js/Remix имеют собственные `dynamic()` / lazy abstractions с SSR поддержкой.

**Почему это важно архитектору:** lazy import waterfall — самая распространённая performance ошибка после внедрения code splitting. Визуально кажется что «всё lazy» = хорошо. На практике: 3 sequential fetches по 100ms = 300ms задержка вместо 0ms при одном чанке.

---

## 5. Vite / Rollup

### Vite конфиг — manual chunks

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    // Генерирует stats.html для визуализации бандла
    visualizer({
      open: false,
      filename: 'dist/stats.html',
      gzipSize: true,
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        // Manual chunks: разделить vendor libraries
        manualChunks: (id) => {
          // React ecosystem → отдельный chunk (кешируется долго)
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }

          // UI библиотека → отдельный chunk
          if (id.includes('node_modules/@radix-ui') ||
              id.includes('node_modules/class-variance-authority')) {
            return 'ui-vendor'
          }

          // Тяжёлые утилиты → отдельные chunks
          if (id.includes('node_modules/chart.js')) return 'chart'
          if (id.includes('node_modules/date-fns')) return 'date-fns'
          if (id.includes('node_modules/lodash')) return 'lodash'
        },

        // Именование чанков для better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // Предупреждение для чанков > 500KB
    chunkSizeWarningLimit: 500,

    // Минификация: esbuild (fast) или terser (better compression)
    minify: 'esbuild',  // быстрее; для max compression: 'terser'

    // Source maps в production для мониторинга
    sourcemap: 'hidden',  // не открыты публично, но доступны для Sentry
  },
})
```

### Анализ бандла

```bash
# Запустить build с визуализатором
npm run build
# Открыть dist/stats.html — интерактивная treemap

# Найти дублированные зависимости:
npx vite-bundle-analyzer dist

# Или через rollup-plugin-visualizer в CI:
# Если chunk > threshold → fail build
```

### Граничные случаи — где ломается

**`manualChunks` circular dependency**: если chunk A зависит от chunk B который зависит от chunk A → Rollup может создать unexpected bundle. Проверять через `--logLevel=info` для диагностики.

**Слишком гранулярные chunks**: 200 чанков по 2KB каждый — хуже чем 20 чанков по 20KB. HTTP/2 мультиплексирование помогает, но TLS handshake и congestion window применяются к каждому origin. Цель: 10–20 значимых чанков.

**Почему это важно архитектору:** `manualChunks` — не разовая настройка. При каждом крупном добавлении зависимости — проверять `stats.html`. Vendor chunk отдельно от app code = vendor кешируется надолго (содержимое не меняется), app chunk меняется при каждом деплое.

---

## 6. Preload / Prefetch

### `<link rel>` стратегии

```html
<!-- preload: загрузить с высоким приоритетом ДО парсинга
     Для ресурсов нужных немедленно (LCP image, critical font) -->
<link rel="preload" as="image" href="hero.webp" fetchpriority="high">
<link rel="preload" as="font" href="/fonts/inter.woff2"
      type="font/woff2" crossorigin>

<!-- prefetch: загрузить с низким приоритетом для следующей навигации
     Браузер скачивает в idle time -->
<link rel="prefetch" href="/js/admin-chunk.js">

<!-- modulepreload: preload + parse ES module
     Для JS chunks которые точно нужны скоро -->
<link rel="modulepreload" href="/assets/react-vendor-abc123.js">
```

### Programmatic prefetch на hover/focus

```typescript
// Prefetch JS chunk при hover над ссылкой
// Решает lazy import waterfall — chunk уже в кеше при клике

function prefetchOnInteraction() {
  const links = document.querySelectorAll<HTMLAnchorElement>('[data-prefetch]')

  links.forEach(link => {
    const prefetch = () => {
      const chunkPath = link.dataset.prefetch
      if (!chunkPath) return

      // Программный prefetch через dynamic import
      import(/* @vite-ignore */ chunkPath).catch(() => {
        // Игнорировать ошибки prefetch — это оптимизация, не критичный путь
      })
    }

    link.addEventListener('mouseenter', prefetch, { once: true })
    link.addEventListener('focus', prefetch, { once: true })
  })
}

// React Router v7: встроенный prefetch через Link компонент
// <Link to="/dashboard" prefetch="intent">Dashboard</Link>
// intent: prefetch при hover/focus
// render: prefetch при render компонента
// viewport: prefetch при входе в viewport
```

### Vite — динамические import hints

```typescript
// Vite magic comments для Rollup chunk naming + prefetch hints
const AdminModule = lazy(() =>
  import(
    /* webpackChunkName: "admin" */
    /* @vite-prefetch */
    './pages/AdminPage'
  )
)

// Более явный способ через Vite modulepreload:
// vite.config.ts → build.modulePreload: { polyfill: true }
```

---

## 7. Реальный кейс: lazy loading сайта услуг — лента статей и галерея

### Контекст

Корпоративный сайт услуг (модули 30–32): страницы услуг, лента статей с изображениями, галерея объектов. Список статей без lazy — десятки изображений при открытии раздела.

### Задача

Грузить изображения ленты и галереи только при приближении к viewport; не трогать LCP-элементы; не ломать CLS; не создавать «пустоту» при быстром скролле ленты.

### Гипотеза

`loading="lazy"` (нативный) для изображений + IntersectionObserver с `rootMargin` для галереи + подгрузка следующей порции ленты до конца экрана.

### Что получилось

```typescript
// Галерея объектов: корневой маржа 200px — загрузка до появления
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        loadImage(entry.target)   // подмена data-src → src
        io.unobserve(entry.target) // ✅ после загрузки — не наблюдать
      }
    }
  },
  { rootMargin: '200px' }          // без rootMargin — загрузка при появлении, лаг
)
```

- Лента статей: `loading="lazy"` на всех изображениях кроме первого (LCP-карточка — eager + `fetchpriority="high"`, модуль 28);
- галерея: IO с rootMargin 200px — изображения загружаются до того, как пользователь докрутил;
- лента: следующая порция статей подгружается при буфере 3 карточек до конца — нет «пустоты» (антипаттерн №5).

### Грабли, найденные в production

1. **`loading="lazy"` на карточке первого экрана** — первая статья ленты (LCP-элемент) отложена (антипаттерн №1). Класс `.first-card` исключён из lazy.
2. **Изображения без размеров** — карточки «прыгали» при загрузке: CLS на каждой второй карточке. `width`/`height` из данных статьи (размеры известны до рендера).
3. **`rootMargin: 0` давал лаг** — изображение начинало грузиться, когда появлялось в viewport: на медленном канале — пустая карточка на секунды. 200px маржа убрала видимую задержку.
4. **Медленная лента без буфера** — «докрутил до конца, лента думает»: буфер 3 карточки сделал подгрузку незаметной.

### Вывод, противоречащий интуиции

Lazy loading — не «добавить атрибут», а **три независимых решения**: что НЕ ленить (первый экран, LCP), как рано грузить (rootMargin), и как не показать пустоту (буфер). Выигрыш — в разы меньше запросов к серверу на раздел, но главное: CLS-регрессии и лаг скролла ловились именно настройками, а не атрибутом.

**Практический вывод для архитектора:** `loading="lazy"` + IO — минимальная пара для лент; production-настройки: rootMargin, unobserve после загрузки, явные размеры, буфер подгрузки, исключения для above-fold. Ленить изображения без размеров — менять CLS-проблему на CLS-проблему.

---

## Антипаттерны

**1. `loading="lazy"` на LCP image**
```html
<!-- ❌ Браузер откладывает загрузку главного изображения -->
<img src="hero.jpg" loading="lazy">

<!-- ✅ LCP всегда eager + preload в <head> -->
<img src="hero.jpg" loading="eager" fetchpriority="high">
```

**2. `loading="lazy"` без width/height**
```html
<!-- ❌ CLS: браузер не знает размер до загрузки -->
<img src="product.jpg" loading="lazy" alt="Product">

<!-- ✅ Всегда указывать размеры -->
<img src="product.jpg" loading="lazy" alt="Product" width="400" height="300">
```

**3. Lazy import waterfall**
```typescript
// ❌ Три sequential requests при первом рендере
const A = lazy(() => import('./A'))  // A imports B
// ./A.tsx:
const B = lazy(() => import('./B'))  // B imports C

// ✅ Flatten или preload при hover
```

**4. `React.lazy` на каждом компоненте**
```typescript
// ❌ 50 чанков по 2KB = плохо
const Button = lazy(() => import('./Button'))
const Input  = lazy(() => import('./Input'))
const Label  = lazy(() => import('./Label'))

// ✅ Lazy только для тяжёлых / редко используемых
const RichTextEditor = lazy(() => import('./RichTextEditor'))  // 200KB
const DataGrid       = lazy(() => import('./DataGrid'))        // 150KB
```

**5. Vendor chunk без cache headers**
```
// Vendor chunk с hash в имени → долгий cache (1 год)
// Но без правильного Cache-Control → браузер не кеширует

// Сервер/CDN должен отдавать:
// Cache-Control: public, max-age=31536000, immutable
// для всех файлов с hash в имени (assets/*.js, assets/*.css)
```

**6. IntersectionObserver без отписки**
```typescript
// ❌ Memory leak: observer продолжает работать после загрузки
const observer = new IntersectionObserver(callback)
images.forEach(img => observer.observe(img))

// ✅ unobserve после загрузки
if (entry.isIntersecting) {
  loadImage(entry.target)
  observer.unobserve(entry.target)  // ← обязательно
}
```

---

## Anti-checklist ☠️

- [ ] `loading="lazy"` для above-fold изображений — откладывает LCP на время прокрутки
- [ ] IntersectionObserver без rootMargin — изображение начинает загружаться только при появлении
- [ ] lazy-load для `<img>` без `width`/`height` — CLS при загрузке каждого изображения
- [ ] `loading="lazy"` на LCP image — браузер загружает его с низким приоритетом
- [ ] Бесконечный скролл без buffer — пользователь видит пустоту до загрузки следующей партии
- [ ] `loading="lazy"` на первом экране галереи — первый же слайд отложен

## Задачи AI-кодеру

**Плохая формулировка:**
> «Добавь lazy loading для изображений»

**Хорошая формулировка:**
> «Для всех `<img>` компонентов в проекте:
> 1. Добавить `loading="lazy" decoding="async"` для всех изображений кроме: hero секции (первый экран) и любых изображений с `fetchpriority="high"`.
> 2. LCP изображение: `loading="eager" fetchpriority="high"` + `<link rel="preload" as="image">` в `<head>`.
> 3. Убедиться что у всех `<img>` есть атрибуты `width` и `height` (в px или dimensionless) для предотвращения CLS.
> 4. CSS background-image секции ниже fold: заменить на `data-lazy-bg` атрибут + IntersectionObserver с `rootMargin: "200px"`.»

Формула: нативный loading (кроме above-fold) + IO (rootMargin/unobserve) + width/height + data-lazy-bg для CSS-фонов.

---

**Плохая формулировка:**
> «Настрой code splitting в Vite»

**Хорошая формулировка:**
> «В `vite.config.ts` добавить `build.rollupOptions.output.manualChunks`:
> - `react-vendor`: `node_modules/react`, `react-dom`, `react-router-dom`
> - `ui-vendor`: `node_modules/@radix-ui/*`, `node_modules/class-variance-authority`
> - Отдельные chunks для `chart.js`, `date-fns` если есть в зависимостях
> - `chunkSizeWarningLimit: 500`
> - `sourcemap: 'hidden'`
> Добавить `rollup-plugin-visualizer` с `filename: 'dist/stats.html', gzipSize: true`.
> Запустить build и показать топ-5 largest chunks по gzip size из stats.html.»

Формула: Vite manualChunks + lazy() + динамический import + анализ stats (топ-5 чанков).

---

## Чеклист архитектора

**Images**
- [ ] LCP image: `loading="eager"`, `fetchpriority="high"`, `<link rel="preload">` в head
- [ ] Below-fold images: `loading="lazy" decoding="async"`
- [ ] Все `<img>` имеют `width` и `height` (предотвращение CLS)
- [ ] CSS backgrounds below-fold: `data-lazy-bg` + IntersectionObserver

**Code splitting**
- [ ] Route-based splitting через `React.lazy` + `Suspense` (или framework equivalent)
- [ ] Тяжёлые компоненты (>50KB): lazy import при открытии/взаимодействии
- [ ] `React.lazy` НЕ на мелких (<10KB) компонентах
- [ ] Нет вложенного lazy waterfall (A→B→C все lazy)

**Bundler конфиг**
- [ ] `manualChunks`: vendor libraries отдельно от app code
- [ ] `chunkSizeWarningLimit` установлен (500KB рекомендуется)
- [ ] `sourcemap: 'hidden'` для production monitoring
- [ ] Bundle analyzer запускается при крупных изменениях зависимостей

**Prefetch**
- [ ] Критичные следующие маршруты: `prefetch` при hover/focus на ссылке
- [ ] Framework-level prefetch настроен (React Router `prefetch="intent"`)
- [ ] Vendor chunks: `Cache-Control: immutable` на CDN/сервере

---

*Модуль 34 завершён.*
*Следующий: [Модуль 35 — Image optimization pipeline](../35-image-optimization/README.md)*
