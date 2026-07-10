# Модуль 29 — Critical CSS Inlining

> **Для AI-архитектора:** critical CSS — это хирургия, не ядерная бомба. Inline весь CSS в `<head>` — плохо (кеш не работает). Не делать ничего — плохо (render-blocking). Правильно: идентифицировать above-the-fold стили, инлайнить их, defer остальное. AI-кодер добавит `<link rel="stylesheet">` в head и посчитает задачу выполненной. Задача архитектора — понять critical path и точно разграничить.
> Один день изучения — механика render-blocking, Beasties автоматизация, async loading паттерны, граничные случаи specificity и кеширования.

---

## Содержание

1. [Механика render-blocking CSS](#1-render-blocking)
2. [Что такое Critical CSS](#2-critical-css)
3. [Beasties — автоматическая экстракция](#3-beasties)
4. [Фреймворки — встроенные решения](#4-фреймворки)
5. [Async loading паттерны](#5-async-loading)
6. [content-visibility как дополнение](#6-content-visibility)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Beasties | **0.2.x** | Автоматическая экстракция critical CSS (наследник Critters) |
| Critical | **5.x** | Penthouse-based экстракция с Puppeteer |
| csso | **5.x** | CSS минификация |
| PostCSS | **8.x** | CSS processing pipeline |

---

## 1. Render-blocking

### Почему CSS блокирует rendering

```
Браузер получает HTML
    │
    ├── Парсит HTML → встречает <link rel="stylesheet">
    │       │
    │       └── СТОП — построение render tree заморожено
    │           (нет CSSOM = нет render tree = нет пикселей)
    │
    ├── Загружает CSS файл (сеть + parsing)
    │
    ├── Строит CSSOM
    │
    └── render tree = DOM + CSSOM → Layout → Paint → LCP

Каждый <link rel="stylesheet"> в <head> = блокировка
```

CSS блокирует намеренно: браузер не знает какой элемент видим до применения стилей. Но пользователю не нужны стили для below-the-fold контента до первого paint.

### Critical Path — что реально блокирует

```
Блокирует render:
  ✗ <link rel="stylesheet" href="styles.css">     в <head>
  ✗ @import url("other.css")                      в CSS файле
  ✗ <style>...</style>                             в <head> — НО уже в DOM, не сеть

Не блокирует:
  ✓ <link rel="stylesheet" media="print">          media mismatch
  ✓ <link rel="preload" as="style">                preload без apply
  ✓ <link rel="stylesheet"> в <body> после контента
```

### Метрика влияния

```
До critical CSS:
  HTML загружен (t=100ms)
  CSS загружен (t=600ms) ← render заморожен 500ms
  FCP = 650ms, LCP = 900ms

После critical CSS inline:
  HTML загружен (t=100ms)
  Inline critical CSS уже в HTML → render не заморожен
  FCP = 150ms, LCP = 400ms ← реальные числа для типичного сайта
```

---

## 2. Critical CSS

### Определение critical

```
Critical CSS = стили необходимые для отрисовки
               above-the-fold контента
               без прокрутки

Above-the-fold = viewport пользователя
               = обычно 1200×800px (desktop), 390×844px (mobile)
```

### Что входит в critical

```
✅ Должно быть critical:
   - CSS reset / normalize (box-sizing, margins)
   - Typography для заголовков и первых параграфов
   - Layout: grid/flex для основной структуры страницы
   - Header / navigation styles
   - Hero section styles
   - Цвета и базовые переменные (custom properties)
   - Font-face declarations для used шрифтов

❌ Не должно быть critical:
   - Стили footer
   - Modal / dialog стили (не в viewport)
   - Carousel / slider стили (если below fold)
   - Print стили
   - Стили для hidden elements
   - Анимации для below-fold контента
```

### Размер critical CSS

```
Цель: < 14KB (gzip) — помещается в первый TCP window
Хорошо: < 10KB gzip
Плохо: > 20KB — inline теряет смысл, лучше preload быстрый CSS файл

14KB — не случайное число:
  TCP slow start: первый round-trip передаёт ~14KB
  Всё что fits = приходит вместе с HTML, без дополнительных round-trips
```

---

## 3. Beasties

### Beasties vs Critters vs Penthouse

```
Penthouse (2014):   Puppeteer-based, медленный, но точный
                    Реально рендерит страницу, знает viewport
Critical (2015):    Penthouse + автоматизация, популярный

Critters (2018):    Google, webpack plugin, CSS parsing без browser
                    Быстрый, но не знает реального viewport

Beasties (2023+):   Форк Critters от Google, активно поддерживается
                    Рекомендован взамен Critters в 2026
```

### Базовое использование Beasties

```typescript
import Beasties from 'beasties'
import fs from 'fs/promises'
import path from 'path'

const beasties = new Beasties({
  path: './dist',              // root для CSS файлов
  publicPath: '/',             // публичный URL prefix

  // Стратегия загрузки non-critical CSS
  preload: 'media',            // media="print" onload trick (рекомендуется)
  // preload: 'swap',          // rel=preload + onload swap
  // preload: 'js',            // JS-based async loading
  // preload: 'js-lazy',       // js + requestIdleCallback

  // Убирать inlined правила из оригинального CSS файла
  // false = дублирование (критичные стили и в inline, и в файле)
  // true = unique файл на каждую страницу → нет cross-page кеша
  pruneSource: false,          // рекомендуется false для SSG

  // Минифицировать inlined CSS
  compress: true,

  // Добавить noscript fallback для CSS
  noscriptFallback: true,      // для браузеров без JS

  // Логировать предупреждения
  logLevel: 'warn',
})

// Обработать HTML файл
const html = await fs.readFile('./dist/index.html', 'utf-8')
const result = await beasties.process(html)
await fs.writeFile('./dist/index.html', result)
```

### Beasties в build pipeline (SSG)

```typescript
// scripts/inline-critical.ts
import Beasties from 'beasties'
import { glob } from 'glob'
import fs from 'fs/promises'

async function inlineCriticalCSS(distDir: string) {
  const beasties = new Beasties({
    path: distDir,
    preload: 'media',
    compress: true,
    noscriptFallback: true,
    pruneSource: false,
  })

  const htmlFiles = await glob(`${distDir}/**/*.html`)
  console.log(`Processing ${htmlFiles.length} HTML files...`)

  await Promise.all(
    htmlFiles.map(async (file) => {
      const html = await fs.readFile(file, 'utf-8')
      const processed = await beasties.process(html)
      await fs.writeFile(file, processed)
    })
  )

  console.log('Critical CSS inlining complete')
}

// package.json script: "postbuild": "tsx scripts/inline-critical.ts"
inlineCriticalCSS('./dist')
```

### Что Beasties делает с HTML

```html
<!-- До Beasties: -->
<head>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <header>...</header>
  <main>...</main>
</body>

<!-- После Beasties (preload: 'media'): -->
<head>
  <!-- Critical CSS inline -->
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:sans-serif}
    header{display:flex;padding:1rem}
    .hero{min-height:100vh}
    /* только above-fold стили */
  </style>

  <!-- Non-critical CSS: media="print" trick — не блокирует -->
  <link
    rel="stylesheet"
    href="/styles/main.css"
    media="print"
    onload="this.media='all'"
  />

  <!-- noscript fallback: обычная загрузка если JS отключён -->
  <noscript>
    <link rel="stylesheet" href="/styles/main.css">
  </noscript>
</head>
```

### Граничные случаи — где ломается

**CSS specificity конфликт**: когда deferred CSS загружается после inline critical — он может переопределить critical стили с более низкой специфичностью. Если critical CSS использует `.hero {}` а в основном файле `.page .hero {}` — после загрузки deferred CSS стили могут измениться.

```css
/* ❌ В critical inline: */
.hero { background: blue; }

/* В main.css (загрузится позже): */
.page-wrapper .hero { background: red; }  /* выше специфичность → override */

/* Результат: кратковременный flash от blue к red при загрузке main.css */
```

**`pruneSource: true` и кеш**: при `pruneSource: true` Beasties создаёт уникальный CSS файл для каждой HTML страницы (без уже инлайненных правил). Это разрушает cross-page CSS кеш — браузер получает разный файл для каждой страницы. Для SSG сайтов с общим CSS — `pruneSource: false` (допустить дублирование, выиграть кеш).

**Critical CSS > 14KB**: если extracted critical CSS > 14KB — это сигнал что в critical попало слишком много. Либо ограничить viewport dimensions в конфиге, либо пересмотреть архитектуру CSS (много глобальных стилей vs компонентные).

**Почему это важно архитектору:** `pruneSource` — главный trade-off Beasties. Выбор зависит от паттерна навигации: SPA-подобный SSG (переходы через JS, нет full page reload) → `pruneSource: false` (кеш важен). Классический multi-page → тоже `false`, но по другой причине: одинаковый main.css кешируется между страницами.

---

## 4. Фреймворки

### Astro — автоматический inline

Astro автоматически инлайнит `<style>` из `.astro` компонентов и скоупирует их:

```astro
---
// Header.astro
---
<header class="site-header">
  <nav>...</nav>
</header>

<!-- Эти стили автоматически инлайнятся в HTML output -->
<style>
  .site-header {
    display: flex;
    padding: 1rem 2rem;
    background: var(--color-bg);
    /* Astro добавит scoped class: .site-header.astro-hash */
  }
</style>
```

**Astro + глобальный CSS**: компонентные стили инлайнятся, глобальный CSS (`import './global.css'`) — остаётся как `<link>`. Для критичных глобальных стилей — `<style is:global>` или вынести в `<head>` напрямую.

### Next.js — ручной pipeline

Next.js не делает critical CSS автоматически. Варианты:

```typescript
// 1. CSS-in-JS (styled-components, Emotion) — автоматически critical
//    Плюс: только используемые стили
//    Минус: runtime overhead, увеличивает JS bundle

// 2. Beasties в postbuild для static export
// next.config.ts → output: 'export' → Beasties на ./out

// 3. Tailwind + PurgeCSS → маленький CSS → весь inline
//    Если финальный CSS < 10KB — можно inline весь через _document.tsx

// _document.tsx — inline весь CSS если он достаточно мал
import fs from 'fs'
import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class MyDocument extends Document {
  render() {
    const criticalCSS = fs.readFileSync('./public/critical.css', 'utf-8')

    return (
      <Html>
        <Head>
          <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
        </Head>
        <body><Main /><NextScript /></body>
      </Html>
    )
  }
}
```

### Eleventy — postbuild transform

```javascript
// .eleventy.js
const Beasties = require('beasties')

module.exports = function(eleventyConfig) {
  // Transform на каждый HTML output
  eleventyConfig.addTransform('critical-css', async function(content, outputPath) {
    if (!outputPath?.endsWith('.html')) return content

    const beasties = new Beasties({
      path: '_site',
      preload: 'media',
      compress: true,
    })

    return beasties.process(content)
  })
}
```

---

## 5. Async loading

### Media print trick — наиболее надёжный

```html
<!--
  media="print" → браузер загружает файл с низким приоритетом (не блокирует)
  onload="this.media='all'" → после загрузки применить ко всем медиа
  noscript → fallback если JS отключён
-->
<link
  rel="stylesheet"
  href="/styles/non-critical.css"
  media="print"
  onload="this.media='all'"
/>
<noscript><link rel="stylesheet" href="/styles/non-critical.css"></noscript>
```

### Preload + onload swap

```html
<!--
  rel="preload" → загрузить с высоким приоритетом, но не применять
  onload → после загрузки изменить rel на stylesheet
-->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.rel='stylesheet'"
/>
<noscript><link rel="stylesheet" href="/styles/non-critical.css"></noscript>
```

**Trade-off**: preload имеет более высокий приоритет → загружается быстрее, но конкурирует с LCP image за bandwidth. Media print trick — ниже приоритет → меньше конкуренция.

### Google Fonts как render-blocking

```html
<!-- ❌ Render-blocking: два round-trips до загрузки шрифта -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700" rel="stylesheet">

<!-- ✅ Preconnect + display=optional -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=optional"
  rel="stylesheet"
/>

<!-- ✅✅ Лучше: self-hosted шрифты — нет cross-origin round-trip -->
<style>
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-400.woff2') format('woff2');
    font-weight: 400;
    font-display: optional;
  }
</style>
```

---

## 6. content-visibility

### Дополнение к critical CSS для below-fold

После того как CSS загружен, браузер должен layout и paint весь документ. `content-visibility: auto` откладывает rendering для off-screen секций:

```css
/* Применять к крупным секциям ниже fold */
.blog-feed,
.product-grid,
.comments-section {
  content-visibility: auto;

  /* contain-intrinsic-size: приблизительный размер до rendering
     предотвращает CLS при скролле к секции */
  contain-intrinsic-size: auto 600px;
}

/* НЕ применять к:
   - above-fold контенту (нет смысла)
   - Элементам с position: sticky (не работает корректно)
   - Секциям с видео/canvas (могут не загружаться)
*/
```

**Эффект**: на странице с 10 секциями — браузер rendering только 1-2 видимые. Остальные — skip до scroll. Экономия CPU на layout/paint: 3–8× для длинных страниц.

### Граничные случаи content-visibility

**`contain-intrinsic-size` и CLS**: без `contain-intrinsic-size` — секция схлопывается до 0 высоты (содержимое не рендерено → нет размера). При scroll к ней — layout shift. `contain-intrinsic-size: auto 600px` — эвристический placeholder.

**`content-visibility` и `position: sticky`**: sticky элементы внутри `content-visibility: auto` контейнера не работают корректно. Sticky требует участия в layout — а `content-visibility` его пропускает.

**Почему это важно архитектору:** critical CSS устраняет сетевой bottleneck (render-blocking), `content-visibility` устраняет rendering bottleneck (CPU). Вместе: максимально быстрый first paint и минимальная работа браузера до взаимодействия.

---

## Антипаттерны

**1. Inline весь CSS**
```html
<!-- ❌ 150KB CSS inline → раздутый HTML, нет кеширования, каждый запрос качает CSS заново -->
<style>/* весь main.css */</style>
```
Critical CSS работает только если inline < 14KB, остальное — в кешируемом файле.

**2. `@import` в CSS файлах**
```css
/* ❌ Каждый @import = дополнительный round-trip, cascade блокировки */
@import url('fonts.css');
@import url('components.css');

/* ✅ Объединять через PostCSS/bundler, один CSS файл */
```

**3. `pruneSource: true` для SSG**
Уникальный CSS файл на каждую страницу → браузер не может кешировать между страницами. Для SSG с общим дизайном — `pruneSource: false`, принять дублирование в exchange на кеш.

**4. Critical CSS без noscript fallback**
Media print trick требует JS. Без `<noscript>` — браузеры с JS disabled не получают CSS вообще. Googlebot иногда рендерит без JS.

**5. Не учитывать mobile viewport**
Beasties по умолчанию использует один viewport. Hero на мобильном (390×844) отличается от desktop (1440×900). Для SEO-важных страниц — запускать с несколькими viewport размерами.

**6. Применять `content-visibility` к above-fold**
```css
/* ❌ Браузер будет пропускать layout/paint для видимого контента */
.hero { content-visibility: auto; }

/* ✅ Только below-fold секции */
.recommendations { content-visibility: auto; contain-intrinsic-size: auto 400px; }
```

---

## Anti-checklist ☠️

- [ ] Inline весь CSS в critical — >20KB теряет ROI, лучше оптимизировать bundle
- [ ] Critical CSS без :root variables — external CSS загружается, переменные меняются → layout shift
- [ ] @import внутри CSS — sequential fetch, каждый @import = дополнительный RTT
- [ ] Отключать render-blocking CSS для above-fold — FOUC (Flash Of Unstyled Content)
- [ ] Critical CSS extraction без учёта JS-рендера — critters не увидит динамические классы
- [ ] Полагаться на один инструмент extraction — penthouse и critters дают разные результаты

## Задачи AI-кодеру

**Плохая формулировка:**
> «Добавь critical CSS»

**Хорошая формулировка:**
> «Добавь Beasties 0.2.x в postbuild script для SSG output в `./dist`.
> Конфиг: `preload: 'media'`, `compress: true`, `noscriptFallback: true`, `pruneSource: false`.
> Обработать все `.html` файлы в dist через `glob('dist/**/*.html')` параллельно через `Promise.all`.
> Добавить как npm postbuild script: `"postbuild": "tsx scripts/inline-critical.ts"`.
> Логировать количество обработанных файлов и время выполнения.»

---

**Плохая формулировка:**
> «Убери render-blocking CSS»

**Хорошая формулировка:**
> «Для `<link rel="stylesheet">` в `<head>` не являющихся critical:
> 1. Заменить на `media="print" onload="this.media='all'"` pattern.
> 2. Добавить `<noscript>` fallback с обычным `<link>`.
> 3. Google Fonts: добавить `<link rel="preconnect">` и изменить на `display=optional`.
> 4. Self-hosted шрифты: добавить `<link rel="preload" as="font" crossorigin>` для woff2.
> Не трогать inline `<style>` теги — они не блокируют.»

---

## Чеклист архитектора

**Анализ**
- [ ] Render-blocking CSS файлы идентифицированы (DevTools → Coverage)
- [ ] Размер потенциального critical CSS оценён (цель < 14KB gzip)
- [ ] Above-fold контент определён для desktop и mobile viewport

**Экстракция**
- [ ] Beasties настроен в postbuild pipeline
- [ ] `pruneSource: false` (для SSG — кеш важнее дедупликации)
- [ ] `noscriptFallback: true` для браузеров без JS
- [ ] Multiple viewports для mobile-critical страниц

**Async loading**
- [ ] Non-critical CSS: media print trick + noscript fallback
- [ ] Google Fonts: preconnect + display=optional или self-hosted
- [ ] CSS `@import` заменены на bundler-merged файлы

**content-visibility**
- [ ] `content-visibility: auto` на крупных below-fold секциях
- [ ] `contain-intrinsic-size` задан для предотвращения CLS при скролле
- [ ] Не применяется к above-fold и sticky элементам

**Валидация**
- [ ] Нет FOUC (Flash of Unstyled Content) при загрузке страницы
- [ ] LCP улучшился в Lighthouse после инлайна
- [ ] Inline critical CSS < 14KB (DevTools → Sources)
- [ ] noscript fallback работает при `javascript:void(0)` в браузере

---

*Модуль 29 завершён.*
*Следующий: [Модуль 30 — Schema.org / Structured data](../30-schema-org/README.md)*
