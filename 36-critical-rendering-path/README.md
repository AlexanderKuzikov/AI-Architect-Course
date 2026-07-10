# Модуль 36 — Critical Rendering Path и CSS Optimization

> **Для AI-архитектора:** render-blocking CSS — причина №1 медленного FCP после медленного TTFB. Браузер не рендерит ничего пока не загрузил и распарсил весь CSS в `<head>`. Стратегия: inline critical CSS (above-fold, ~8KB) + async load остального. Но «critical CSS» — не то что думает большинство. 90% проектов inline слишком мало (без шрифтов, layout reset) или слишком много (весь bundle). Второй вопрос: `@layer` и архитектура каскада — как перестать бороться со specificity и начать управлять ею декларативно.
> Один день изучения — Critical Rendering Path механика, render-blocking resources, critical CSS extraction, async CSS loading, CSS `@layer`, `@property`, container queries, `content-visibility`.

---

## Содержание

1. [Critical Rendering Path механика](#1-механика)
2. [Render-blocking resources](#2-render-blocking)
3. [Critical CSS: extraction и inline](#3-critical-css)
4. [CSS @layer — архитектура каскада](#4-layer)
5. [Modern CSS performance API](#5-modern-css)
6. [CSS selector performance](#6-selector-performance)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| API / инструмент | Статус | Поддержка |
| :-- | :-- | :-- |
| CSS `@layer` | **Baseline 2022** | Chrome 99+, FF 97+, Safari 15.4+ |
| CSS `@property` | **Baseline 2024** | Chrome 85+, FF 128+, Safari 16.4+ |
| Container Queries | **Baseline 2023** | Chrome 105+, FF 110+, Safari 16+ |
| `content-visibility: auto` | **Широкая поддержка** | Chrome 85+, FF 125+, Safari 18+ |
| `critters` (inline critical CSS) | **актуален** | Vite/Webpack plugin |
| `penthouse` | **актуален** | CLI/Node critical CSS extractor |

---

## 1. Механика

### Путь от HTML до первого пикселя

```
Browser получает HTML
    │
    ▼
HTML Parser строит DOM
    │
    ├──► Встречает <link rel="stylesheet"> → СТОП
    │    Запрос CSS → ждём загрузки → строим CSSOM
    │    Без CSSOM браузер НЕ рендерит ничего
    │
    ├──► Встречает <script> (без defer/async) → СТОП
    │    Выполняем JS → продолжаем парсинг
    │
    ▼
DOM + CSSOM → Render Tree (только visible nodes)
    │
    ▼
Layout (geometry: positions, sizes)
    │
    ▼
Paint (pixels: colors, shadows, borders)
    │
    ▼
Composite (GPU layers: transforms, opacity)
    │
    ▼
First Contentful Paint (FCP) ✓
```

### Критический путь — что блокирует

```
Блокирует рендер:
  ✗ <link rel="stylesheet"> в <head>
  ✗ <script> без defer/async перед </head>
  ✗ @import внутри CSS файла (создаёт chain: CSS→@import→CSS→@import)

НЕ блокирует рендер:
  ✓ <script defer> — выполнение после DOM парсинга
  ✓ <script async> — выполнение как только загружен
  ✓ <script type="module"> — defer по умолчанию
  ✓ <link rel="preload"> — загружает, но не блокирует
  ✓ <link rel="stylesheet" media="print"> — не блокирует visual рендер
```

---

## 2. Render-blocking resources

### Async CSS loading паттерн

```html
<!-- Единственный надёжный паттерн для async CSS loading в 2026 -->
<!-- media="print" trick: браузер грузит с низким приоритетом,
     onload меняет media="all" → стили применяются -->
<link
  rel="stylesheet"
  href="/styles/non-critical.css"
  media="print"
  onload="this.media='all'"
>
<noscript>
  <link rel="stylesheet" href="/styles/non-critical.css">
</noscript>

<!-- Или через rel="preload" + onload -->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.rel='stylesheet'"
>
<noscript>
  <link rel="stylesheet" href="/styles/non-critical.css">
</noscript>
```

### @import — всегда антипаттерн

```css
/* ❌ @import создаёт sequential fetches:
   browser.css загружается → парсится → находит @import → запрашивает base.css
   Каждый @import = дополнительный RTT */
@import url('base.css');
@import url('components.css');
@import url('utilities.css');

/* ✅ Параллельные <link> теги в HTML */
/* или bundler (Vite) разрешает @import при build — тогда окей */
```

### Script loading: defer vs async vs module

```html
<!-- defer: загружается параллельно, выполняется после HTML парсинга,
     в порядке в документе. Правильный default для app scripts. -->
<script defer src="/main.js"></script>

<!-- async: загружается параллельно, выполняется сразу как загружен,
     порядок не гарантирован. Для независимых скриптов (analytics). -->
<script async src="/analytics.js"></script>

<!-- type="module": defer по умолчанию + strict mode + ESM.
     Для современных app entry points. -->
<script type="module" src="/app.js"></script>

<!-- ❌ blocking: парсинг HTML стоп пока script не выполнен -->
<script src="/jquery.js"></script>
```

### Граничные случаи — где ломается

**Preload + async CSS FOUC**: при async loading non-critical CSS может произойти FOUC (Flash Of Unstyled Content) — элементы briefly показываются без стилей. Решение: critical CSS должен покрывать весь above-fold layout, не только typography.

**`defer` и DOMContentLoaded**: defer скрипты выполняются до DOMContentLoaded. Если есть код который слушает `DOMContentLoaded` — он сработает после defer скриптов, не параллельно.

**Почему это важно архитектору:** каждый `<link rel="stylesheet">` в `<head>` без критичности — это налог в 50–300ms FCP в зависимости от размера файла и latency. Три CSS файла вместо одного инлайн = три последовательных RTT блокирующих рендер.

---

## 3. Critical CSS

### Что входит в critical CSS

```
Обязательно (иначе layout shift или FOUC):
  ✓ CSS reset / normalize
  ✓ :root variables (цвета, шрифты, spacing)
  ✓ <html>, <body> базовые стили
  ✓ Header / navigation (всегда above-fold)
  ✓ Hero section layout
  ✓ LCP element стили (размеры, позиционирование)
  ✓ Font-face declarations для above-fold шрифтов
  ✓ Анимации начинающиеся при load

Не включать (below-fold):
  ✗ Стили для accordion, modal, tabs
  ✗ Footer стили
  ✗ Стили для страниц кроме текущей
  ✗ Vendor library стили если ниже fold
```

### Critical CSS — размер

```
Цель: < 14KB (один TCP congestion window)
Рекомендация: < 8KB gzipped
Максимум: < 20KB (выше — теряем ROI inlining)

Если critical CSS > 20KB:
  → Слишком широко определён "above-fold"
  → Скорее всего inline весь bundle
  → Лучше оптимизировать bundle размер целиком
```

### Автоматическая extraction — Vite + critters

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { critters } from 'vite-plugin-critters'  // или 'critters' напрямую

export default defineConfig({
  plugins: [
    critters({
      // Inline critical CSS + async load остального автоматически
      strategy: 'critical',  // только above-fold
      preload: 'media',      // async pattern через media="print" trick
      pruneSource: true,     // удалять inlined стили из внешнего файла
    }),
  ],
})
```

### Ручная extraction через penthouse (Node.js)

```typescript
// scripts/extract-critical.ts
// Полезно для SSG где нет автоматического инструмента

import penthouse from 'penthouse'
import { readFileSync, writeFileSync } from 'fs'

async function extractCritical(url: string, cssPath: string): Promise<void> {
  const criticalCSS = await penthouse({
    url,                         // URL страницы (нужен running server)
    cssString: readFileSync(cssPath, 'utf8'),
    width: 1280,
    height: 900,
    forceInclude: [
      // Принудительно включить даже если not in viewport:
      ':root',
      'html',
      'body',
      '.header',
      /^\.font-/,               // regex паттерны
    ],
    renderWaitTime: 100,        // ждать JS рендер
  })

  writeFileSync('./src/critical.css', criticalCSS)
  console.log(`Critical CSS: ${criticalCSS.length} bytes`)
}
```

### HTML шаблон с inline critical CSS

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- 1. Critical CSS inline: рендер без network request -->
  <style>
    /* === CRITICAL CSS: ~8KB === */
    :root { --color-bg: #f7f6f2; --font-body: 'Satoshi', sans-serif; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-family: var(--font-body); background: var(--color-bg); }
    body { min-height: 100dvh; }
    .header { /* ... */ }
    .hero { /* ... */ }
    /* === END CRITICAL CSS === */
  </style>

  <!-- 2. LCP image preload -->
  <link rel="preload" as="image" href="/images/hero-1200w.avif"
        imagesrcset="/images/hero-400w.avif 400w, /images/hero-1200w.avif 1200w"
        imagesizes="(max-width: 600px) 100vw, 1200px"
        fetchpriority="high">

  <!-- 3. Font preload (только для above-fold шрифтов) -->
  <link rel="preload" as="font" type="font/woff2"
        href="/fonts/satoshi-regular.woff2" crossorigin>

  <!-- 4. Non-critical CSS: async load через media trick -->
  <link rel="stylesheet" href="/styles/main.css"
        media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="/styles/main.css"></noscript>
</head>
```

### Граничные случаи — где ломается

**critters и dynamic classes**: critters анализирует статический HTML. Классы добавляемые JS при runtime (модальные окна, drawer) не попадают в critical. Для динамических компонентов — `forceInclude` список.

**penthouse и SPA**: penthouse открывает страницу headlessly. Если React SPA рендерит при JS — penthouse увидит пустую страницу без SSR. Использовать только с SSR или SSG.

**Почему это важно архитектору:** critical CSS extraction — это компромисс: дублирование стилей (inline + external file) vs более быстрый FCP. При `pruneSource: true` — нет дублирования, но external CSS файл меньше → лучше cache hit.

---

## 4. CSS @layer

### Проблема которую решает @layer

```
Классическая проблема specificity:

.btn { background: blue; }          /* specificity: 0,1,0 */
.sidebar .btn { background: gray; } /* specificity: 0,2,0 — побеждает */

Решение без @layer:
  !important, вложенные селекторы, inline стили — хаос

Решение с @layer:
  Явный порядок слоёв. Слой объявленный ПОЗЖЕ побеждает,
  независимо от specificity внутри слоя.
```

### Базовая архитектура @layer

```css
/* Объявить порядок слоёв в самом начале:
   последний слой = самый высокий приоритет */
@layer reset, base, components, utilities, overrides;

/* reset: normalize */
@layer reset {
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  img { display: block; max-width: 100%; }
}

/* base: глобальные стили */
@layer base {
  :root {
    --color-primary: oklch(0.48 0.12 192);
    --font-body: 'Satoshi', sans-serif;
  }
  body { font-family: var(--font-body); }
  h1, h2, h3 { line-height: 1.2; }
}

/* components: переиспользуемые компоненты */
@layer components {
  .btn {
    display: inline-flex;
    padding: 0.5rem 1rem;
    background: var(--color-primary);
  }
  /* specificity .btn = 0,1,0 */
}

/* utilities: atomic классы */
@layer utilities {
  .mt-4 { margin-top: 1rem; }
  .text-sm { font-size: 0.875rem; }
  /* Даже .text-sm с specificity 0,1,0 побеждает .btn из components
     потому что utilities слой объявлен позже */
}

/* overrides: page-specific, exceptions */
@layer overrides {
  /* Любой стиль здесь побеждает всё выше — без !important */
  .hero .btn { background: var(--color-secondary); }
}
```

### @layer с третьими сторонами

```css
/* Помещаем vendor CSS в нижний слой — он не может перебить наши стили */
@layer vendor, reset, base, components, utilities, overrides;

@layer vendor {
  @import url('https://cdn.example.com/some-library.css');
  /* ВСЕ стили библиотеки — низкий приоритет */
}

/* Теперь любой наш стиль побеждает vendor без !important */
```

### @layer и Tailwind v4

```css
/* Tailwind v4 (2026) — нативная @layer архитектура */
@import "tailwindcss";

/* Tailwind регистрирует: @layer theme, base, components, utilities */
/* Можно расширять каждый слой: */

@layer components {
  .btn-primary {
    @apply bg-blue-600 text-white px-4 py-2 rounded-md;
    /* @apply работает внутри @layer */
  }
}

/* overrides поверх Tailwind: */
@layer overrides {
  .card { /* побеждает все Tailwind utilities */ }
}
```

### Граничные случаи — где ломается

**@layer и specificity внутри слоя**: внутри одного слоя specificity работает как обычно. `@layer utilities { #header { color: red } }` победит `.text-blue` внутри того же слоя из-за specificity id. Ошибка думать что @layer полностью убирает specificity — убирает только между слоями.

**@layer и критический CSS**: если inline critical CSS не использует @layer, а внешний файл использует — порядок применения непредсказуем. Либо весь CSS через @layer, либо ничего.

**Почему это важно архитектору:** @layer — решение проблемы которую раньше решали через CSS-in-JS, BEM или CSS Modules. В 2026 с Baseline 2022 поддержкой — нет причин не использовать. Архитектурная победа над specificity wars без runtime overhead.

---

## 5. Modern CSS performance API

### @property — типизированные custom properties

```css
/* @property: браузер знает тип переменной
   → можно анимировать → hardware acceleration */

@property --gradient-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@property --progress {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

/* Теперь можно анимировать custom property: */
.animated-gradient {
  background: conic-gradient(
    from var(--gradient-angle),
    oklch(0.7 0.15 240),
    oklch(0.7 0.15 180)
  );
  animation: rotate 4s linear infinite;
}

@keyframes rotate {
  to { --gradient-angle: 360deg; }
}

/* Прогресс-бар через @property: */
.progress-bar {
  --progress: 0;
  width: calc(var(--progress) * 1%);
  transition: --progress 0.3s ease;
}
/* JS: element.style.setProperty('--progress', '75') */
```

### Container Queries — component-level responsive

```css
/* container-type: inline-size → элемент становится container */
.card-wrapper {
  container-type: inline-size;
  container-name: card;  /* опционально: именованный */
}

/* Стили компонента зависят от размера его контейнера,
   не viewport — переиспользуемость без медиа-запросов */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

### `content-visibility: auto`

```css
/* Браузер пропускает layout и paint для off-screen элементов
   Значительное ускорение initial render для длинных страниц */

.article-list > article {
  content-visibility: auto;
  /* contain-intrinsic-size: подсказка браузеру для scrollbar */
  contain-intrinsic-size: auto 300px;  /* auto: кешировать реальный размер */
}

/* Где применять: длинные списки, бесконечный скролл,
   article cards, comment sections */

/* Где НЕ применять: above-fold контент, sticky элементы,
   элементы с position: fixed */
```

### Граничные случаи — где ломается

**`content-visibility: auto` и поиск на странице**: Ctrl+F. Браузер не ищет в skipped content. Safari 18 fixed это частично, но полная поддержка Find-in-Page — всё ещё нестабильна. Не применять к контенту где важен browser search. [web:267]

**@property и SSR**: `@property` работает в CSS. При SSR — рендерится на сервере без проблем. Но TypeScript типы CSS custom properties — отдельная тема, нет автокомплита без дополнительных инструментов.

**Container Queries и вложенность**: нельзя сделать query к собственному размеру — только к родителю-контейнеру. `container-type: inline-size` добавляет layout containment — элемент не может зависеть от своих children для определения размера (prevent infinite loops). [web:267]

**Почему это важно архитектору:** `content-visibility: auto` — единственная CSS-оптимизация дающая измеримый Lighthouse score improvement без изменения HTML. На страницах с 100+ card элементами — 200–500ms improvement в initial render.

---

## 6. CSS selector performance

### Что реально влияет (и что нет)

```css
/* Браузеры читают CSS селекторы справа налево */

/* ❌ Медленный — много элементов matching last part */
.container div p span { color: red; }
/* Браузер: найти все <span> → проверить <p> → проверить <div> → проверить .container */

/* ✅ Быстрый — последняя часть специфична */
.article-text { color: red; }

/* Практический вывод: глубокая вложенность (>3 уровня) — performance issue
   при большом DOM. Flat селекторы — лучше. */
```

### Что реально влияет на CSS performance в 2026

```
1. Reflows (layout thrashing):
   - Чтение layout свойств (offsetWidth, getBoundingClientRect)
     после записи styles в одном frame
   - Решение: batch reads отдельно от writes

2. Paint-heavy properties:
   - box-shadow с большим blur radius
   - filter: blur() на большой области
   - border-radius на positioned элементах с overflow: hidden
   Решение: will-change: transform + GPU layer

3. Анимации вне compositor:
   - Анимировать left, top, width, height → layout → reflow
   Решение: только transform и opacity для анимаций

4. Слишком много @layer → незначительно
5. Сложные :has() селекторы на большом DOM → измеримо
6. Универсальный * селектор → незначительно в modern engines
```

### will-change и GPU слои

```css
/* will-change: подсказка браузеру создать GPU layer заранее */

/* ✅ Использовать для: */
.animated-element {
  will-change: transform;  /* для transform анимаций */
}
.modal-overlay {
  will-change: opacity;    /* для fade in/out */
}

/* ❌ НЕ использовать на всём подряд: */
/* * { will-change: transform; } — создаёт GPU layer для каждого элемента
   → увеличивает GPU memory → хуже на мобильных */

/* Правило: will-change только на элементах которые ТОЧНО анимируются */
/* Убирать will-change после анимации если она не бесконечная */
```

---

## Антипаттерны

**1. @import в CSS**
```css
/* ❌ Sequential loading: каждый @import = дополнительный RTT */
@import 'reset.css';
@import 'base.css';
@import 'components.css';

/* ✅ Параллельные <link> или bundler */
```

**2. render-blocking `<link>` для below-fold стилей**
```html
<!-- ❌ Весь CSS bundle в head — блокирует FCP -->
<link rel="stylesheet" href="/styles/all-20kb.css">

<!-- ✅ Critical inline + async для остального -->
<style>/* 8KB critical */</style>
<link rel="stylesheet" href="/styles/rest.css"
      media="print" onload="this.media='all'">
```

**3. Анимация layout-triggering свойств**
```css
/* ❌ Вызывает reflow на каждом frame — janky animation */
@keyframes slide { from { left: -100px } to { left: 0 } }

/* ✅ transform — только composite, нет reflow */
@keyframes slide { from { transform: translateX(-100px) } to { transform: translateX(0) } }
```

**4. `will-change` на всём**
```css
/* ❌ GPU memory leak на mobile */
* { will-change: transform; }

/* ✅ Только на анимируемых элементах */
.carousel-item { will-change: transform; }
```

**5. Critical CSS без :root variables**
```css
/* ❌ Critical CSS без переменных:
   external CSS загружается → переменные меняются → layout shift */
<style>
  body { font-family: 'Satoshi', sans-serif; }
</style>

/* ✅ :root variables в critical CSS */
<style>
  :root { --font-body: 'Satoshi', sans-serif; --color-bg: #f7f6f2; }
  body { font-family: var(--font-body); background: var(--color-bg); }
</style>
```

**6. Container Queries без `container-type`**
```css
/* ❌ @container не работает без объявления container на родителе */
@container (min-width: 400px) {
  .card { display: grid; }
}
/* .card никогда не получит эти стили */

/* ✅ container-type на родителе */
.card-wrapper { container-type: inline-size; }
@container (min-width: 400px) { .card { display: grid; } }
```

---

## Anti-checklist ☠️

- [ ] @import в CSS — sequential loading, каждый @import = дополнительный RTT
- [ ] render-blocking `<link>` для below-fold стилей — блокирует FCP без причины
- [ ] Анимация layout-triggering свойств (left, top) — вызывает reflow на каждом frame
- [ ] `will-change` на всём подряд — GPU memory leak на мобильных
- [ ] Critical CSS без :root variables — external CSS меняет переменные → layout shift
- [ ] Container Queries без container-type на родителе — @container никогда не сработает

## Задачи AI-кодеру

**Плохая формулировка:**
> «Оптимизируй CSS для производительности»

**Хорошая формулировка:**
> «В `index.html`:
> 1. Переместить содержимое `src/styles/critical.css` в inline `<style>` тег в `<head>`.
> 2. Изменить `<link rel="stylesheet" href="main.css">` на async pattern: `media="print" onload="this.media='all'"` + `<noscript>` fallback.
> 3. Убедиться что inline critical CSS содержит: `:root` variables, reset, html/body базовые стили, `.header` стили, `.hero` стили. Всё что ниже first viewport — убрать из critical.
> 4. Проверить через Lighthouse: FCP должен улучшиться. Если critical CSS > 20KB — вернуться и сократить.»

---

**Плохая формулировка:**
> «Добавь CSS @layer»

**Хорошая формулировка:**
> «Реструктурировать `src/styles/main.css` с CSS @layer:
> 1. Первая строка файла: `@layer reset, base, components, utilities, overrides;`
> 2. Обернуть reset стили в `@layer reset { }`.
> 3. Обернуть `:root` variables и body/typography в `@layer base { }`.
> 4. Обернуть компоненты (.btn, .card, .input) в `@layer components { }`.
> 5. Если есть utility классы (mt-*, text-*) → `@layer utilities { }`.
> 6. Все `!important` убрать — заменить на стили в `@layer overrides { }`.»

---

## Чеклист архитектора

**Critical Rendering Path**
- [ ] Нет `@import` в CSS файлах (только bundler разрешённые)
- [ ] Все `<script>` в head имеют `defer` или `async` или `type="module"`
- [ ] Нет render-blocking `<link rel="stylesheet">` для below-fold стилей

**Critical CSS**
- [ ] Inline critical CSS в `<head>` для above-fold контент
- [ ] Critical CSS содержит `:root` variables
- [ ] Critical CSS < 14KB (ideal < 8KB)
- [ ] Non-critical CSS через async pattern: `media="print" onload`

**@layer архитектура**
- [ ] Порядок слоёв объявлен в начале: `@layer reset, base, components, utilities`
- [ ] Vendor CSS в нижнем слое
- [ ] Нет `!important` (заменено `@layer overrides`)

**Modern CSS**
- [ ] `content-visibility: auto` для длинных off-screen списков
- [ ] `@property` для анимируемых custom properties
- [ ] Container Queries для responsive компонентов (не медиа-запросы на компоненте)
- [ ] `will-change` только на конкретных анимируемых элементах

**Animations**
- [ ] Анимации только через `transform` и `opacity` (compositor properties)
- [ ] `will-change` убирается после завершения анимации

---

*Модуль 36 завершён.*
*Следующий: [Модуль 37 — JavaScript performance и memory management](../37-js-performance/README.md)*
