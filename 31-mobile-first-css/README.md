# Модуль 31 — Mobile-First CSS

> **Для AI-архитектора:** mobile-first — это не «напишем для десктопа, потом добавим `max-width: 768px`». Это инвертированный порядок приоритетов: базовые стили = наименьший контекст, media queries расширяют вверх. Архитектурный выбор определяет CSS specificity, cascade и поддерживаемость всего проекта. Container queries меняют парадигму дальше: компонент адаптируется к своему контексту, не к viewport.
> Один день изучения — `min-width` vs `max-width`, container queries, логические свойства, новые viewport units, `:has()` в адаптивных паттернах.

---

## Содержание

1. [Mobile-first vs Desktop-first](#1-mobile-vs-desktop)
2. [Breakpoint архитектура](#2-breakpoints)
3. [Container Queries](#3-container-queries)
4. [Логические свойства CSS](#4-логические-свойства)
5. [Новые viewport units](#5-viewport-units)
6. [:has() в адаптивных паттернах](#6-has)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Фича | Baseline | Поддержка |
| :-- | :-- | :-- |
| Container Size Queries | 2023 | Chrome 105+, Safari 16+, FF 110+ — **safe to use** |
| Container Style Queries | 2024 | Chrome 111+, Safari 18+, FF 129+ |
| `svh` / `lvh` / `dvh` | 2023 | Chrome 108+, Safari 15.4+, FF 101+ — **safe to use** |
| `:has()` | 2023 | Chrome 105+, Safari 15.4+, FF 121+ — **safe to use** |
| CSS Nesting (native) | 2024 | Chrome 120+, Safari 17.2+, FF 117+ — **safe to use** |
| `@layer` | 2022 | Chrome 99+, Safari 15.4+, FF 97+ — **safe to use** |

---

## 1. Mobile vs Desktop

### Принципиальная разница в cascade

```css
/* ❌ Desktop-first: базовые стили для широкого экрана,
   override через max-width вниз */
.card {
  display: grid;
  grid-template-columns: 200px 1fr;  /* широкий layout */
  gap: 2rem;
}

@media (max-width: 768px) {          /* override для мобильного */
  .card {
    grid-template-columns: 1fr;      /* одна колонка */
    gap: 1rem;
  }
}

/* ✅ Mobile-first: базовые стили минимальны,
   media queries добавляют сложность вверх */
.card {
  display: grid;
  grid-template-columns: 1fr;        /* мобильный layout — база */
  gap: 1rem;
}

@media (min-width: 768px) {          /* расширение для широкого */
  .card {
    grid-template-columns: 200px 1fr;
    gap: 2rem;
  }
}
```

### Почему mobile-first — это не только стиль кода

```
Desktop-first проблемы:
  1. Override cascade: каждый `max-width` добавляет specificity
     и увеличивает шансы неожиданного поведения
  2. Браузер загружает все стили включая desktop-only
     (нет механизма conditional loading для CSS в одном файле)
  3. Логика «по умолчанию = сложный layout» противоречит
     принципу progressive enhancement

Mobile-first преимущества:
  1. Базовые стили — минимальный CSS → меньше parse time
  2. Сложность добавляется поверх простоты (не наоборот)
  3. Соответствует браузерной модели: неизвестная ширина = мобильная
  4. Проще рассуждать о cascade: добавляем, не переопределяем
```

### Mobile-first и performance

```css
/* Для мобильного не нужен этот CSS — но он всё равно парсится:
   CSS не имеет conditional loading кроме media attribute на <link>

   Оптимизация: CSS splitting по media */

/* mobile.css — всегда загружается */
.grid { display: grid; grid-template-columns: 1fr; }

/* desktop.css — загружается но не блокирует на mobile */
```
```html
<link rel="stylesheet" href="mobile.css">
<link rel="stylesheet" href="desktop.css" media="(min-width: 1024px)">
<!-- media не совпадает с viewport → не render-blocking,
     но браузер всё равно загружает с низким приоритетом -->
```

---

## 2. Breakpoints

### Semantic breakpoints вместо device-based

```css
/* ❌ Device-based: привязка к конкретным устройствам
   Устройства меняются, breakpoints устаревают */
@media (max-width: 320px)  { /* iPhone SE */ }
@media (max-width: 375px)  { /* iPhone 12 */ }
@media (max-width: 768px)  { /* iPad */ }
@media (max-width: 1024px) { /* iPad Pro */ }

/* ✅ Content-based: breakpoints там, где контент ломается */
/* Типичный content-based набор */
:root {
  --bp-sm:  480px;   /* 2 колонки вместо 1 */
  --bp-md:  768px;   /* sidebar появляется */
  --bp-lg:  1024px;  /* full layout */
  --bp-xl:  1280px;  /* wide content */
}

/* Использование через custom media (PostCSS): */
@custom-media --mobile  (width < 480px);
@custom-media --tablet  (480px <= width < 1024px);
@custom-media --desktop (width >= 1024px);

@media (--desktop) {
  .sidebar { display: block; }
}
```

### Breakpoints через CSS custom properties

```css
/* Custom properties НЕ работают в media queries напрямую:
   @media (min-width: var(--bp-md)) — невалидно */

/* Варианты: */

/* 1. PostCSS + postcss-custom-media → compile-time замена */

/* 2. Sass/CSS preprocessor → переменные в @media */

/* 3. Семантические классы breakpoints (BEM-like): */
.layout-sidebar {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .layout-sidebar {
    grid-template-columns: 280px 1fr;  /* --sidebar-width */
  }
}
```

### `@layer` и mobile-first cascade

```css
/* @layer позволяет контролировать specificity независимо от порядка */
@layer base, layout, components, overrides;

@layer base {
  /* Reset, custom properties, typography */
  .card { display: block; }
}

@layer components {
  /* Mobile-first компонентные стили */
  .card {
    padding: var(--space-4);
    background: var(--color-surface);
  }
}

@layer overrides {
  /* Media queries — в отдельном layer,
     порядок важности: overrides > components > base */
  @media (min-width: 768px) {
    .card { padding: var(--space-8); }
  }
}
```

### Граничные случаи breakpoints

**Breakpoint gap**: контент ломается между определёнными breakpoints. Решение: не задавать breakpoints заранее, а добавлять когда контент требует. Открыть страницу, медленно тянуть за край браузера — точка поломки = breakpoint.

**Landscape mobile**: `(orientation: landscape)` + маленькая высота. iPhone в landscape: ширина 844px — попадёт в `min-width: 768px` tablet стили, но высота 390px. Добавлять `(min-height: 600px)` для layout-heavy компонентов:
```css
@media (min-width: 768px) and (min-height: 600px) {
  .hero { min-height: 80vh; }
}
```

**Почему это важно архитектору:** mobile landscape — типичный слепой spot. Разработчики тестируют portrait mobile и desktop, пропускают landscape. Навигационные паттерны особенно страдают.

---

## 3. Container Queries

### Viewport queries vs Container queries

```
Media query (viewport):                Container query:
  .card адаптируется к ширине           .card адаптируется к ширине
  СТРАНИЦЫ                              своего КОНТЕЙНЕРА

Проблема media query для компонентов:
  Sidebar layout: .card в narrow sidebar
  Main layout: та же .card в wide main area
  Viewport одинаковый → media query не может различить!

Container query решает:
  .card знает свой контейнер → адаптируется к нему
```

### Базовый синтаксис

```css
/* 1. Объявить containment context на родителе */
.card-container {
  container-type: inline-size;  /* query по ширине */
  /* container-type: size;      query по ширине И высоте */
  /* container-name: card;      именованный контейнер */
}

/* Или shorthand: */
.card-container {
  container: card / inline-size;  /* name / type */
}

/* 2. Использовать @container в дочерних элементах */
@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 120px 1fr;
  }
}

@container card (min-width: 600px) {
  /* именованный контейнер — более точный таргетинг */
  .card__image {
    height: 200px;
  }
}
```

### Container queries в реальных компонентах

```css
/* Sidebar vs Main — один компонент, разные контексты */

/* Контейнеры */
.sidebar    { container: sidebar / inline-size; }
.main-area  { container: main / inline-size; }

/* Компонент ProductCard адаптируется сам */
.product-card {
  /* мобильный layout — база */
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

/* В sidebar — узкий контейнер, стопка */
/* При расширении sidebar: */
@container sidebar (min-width: 240px) {
  .product-card {
    grid-template-columns: 80px 1fr;
  }
}

/* В main area — широкий контейнер */
@container main (min-width: 300px) {
  .product-card {
    grid-template-columns: 160px 1fr;
    gap: var(--space-6);
  }
}
```

### Container Style Queries (2024+)

```css
/* Style queries: адаптация к CSS custom property родителя */
.theme-container {
  --theme: dark;
  container-type: style;
}

@container style(--theme: dark) {
  .card {
    background: var(--color-surface);
    color: var(--color-text);
  }
}

/* Практический кейс: компонент знает тему своего контейнера
   без передачи класса через props */
```

### Граничные случаи — где ломается

**container-type и layout**: `container-type: size` (не `inline-size`) требует явной высоты контейнера — иначе блок схлопывается до 0. Почти всегда нужен `inline-size`.

**container-type и position: sticky**: sticky внутри `container-type: size` контейнера не работает (containment нарушает stacking context). Аналогично `overflow: hidden` на контейнере.

**`container-type` на флексовом дочернем**: если контейнер сам является flex item без явной ширины — он не имеет собственного inline size для query. Нужно `flex: 1 1 0` или явный `width`.

**Почему это важно архитектору:** container queries фундаментально меняют где живёт responsiveness — в компоненте, не на уровне страницы. Это architectural decision: design system компоненты, которые «знают» свою адаптацию, vs layout-level coordination.

---

## 4. Логические свойства

### Physical vs Logical

```css
/* Physical — привязаны к left/right/top/bottom */
margin-left: 1rem;
padding-right: 2rem;
border-top: 1px solid;
text-align: left;

/* Logical — привязаны к writing mode */
margin-inline-start: 1rem;   /* = margin-left в LTR, margin-right в RTL */
padding-inline-end: 2rem;    /* = padding-right в LTR, padding-left в RTL */
border-block-start: 1px solid; /* = border-top в горизонтальном writing mode */
text-align: start;           /* = left в LTR, right в RTL */
```

### Логические shorthand

```css
/* Physical → Logical */
margin: top right bottom left;  →  margin-block: top bottom; margin-inline: left right;
padding: 1rem 2rem;             →  padding-block: 1rem; padding-inline: 2rem;
width / height                  →  inline-size / block-size
max-width / max-height          →  max-inline-size / max-block-size
left / right                    →  inset-inline-start / inset-inline-end
top / bottom                    →  inset-block-start / inset-block-end

/* Полный inset shorthand */
inset: 0;                 /* = top: 0; right: 0; bottom: 0; left: 0 */
inset-block: 0;           /* = top: 0; bottom: 0 */
inset-inline: auto 1rem;  /* = left: auto; right: 1rem (LTR) */
```

### Когда использовать

```css
/* ✅ Всегда логические: компоненты, которые могут быть */
/* в RTL контексте или вертикальном writing mode */
.button {
  padding-block: var(--space-2);
  padding-inline: var(--space-4);
  border-inline-start: 3px solid var(--color-primary);
}

/* Граничный случай: border-radius ещё НЕ имеет полного
   логического эквивалента в 2026 */
/* border-start-start-radius, border-start-end-radius — есть,
   но поддержка проверять */

/* ⚠️ Осторожно: смешивание physical и logical может
   создать конфликты в RTL */
.card {
  margin-left: 1rem;           /* physical */
  margin-inline-end: 2rem;     /* logical */
  /* В RTL: margin-left применится к "wrong" стороне */
}
```

---

## 5. Viewport units

### Проблема классического vh

```
Мобильный браузер (Chrome, Safari):
  Адресная строка видима:  viewport = 600px высоты
  Адресная строка скрыта:  viewport = 660px высоты (при прокрутке)

100vh = 660px (large viewport — когда адресная строка скрыта)

Элемент с height: 100vh на загрузке страницы:
  Реальный viewport: 600px
  Элемент: 660px → контент обрезан за адресной строкой
```

### Три новых единицы (2023+, safe to use 2026)

```css
/* svh — Small Viewport Height: минимальный viewport
   (адресная строка видима, все UI элементы присутствуют) */
.hero {
  height: 100svh;  /* гарантированно всё помещается */
}

/* lvh — Large Viewport Height: максимальный viewport
   (адресная строка скрыта при прокрутке) */
.fullscreen-modal {
  height: 100lvh;  /* использует максимальное пространство */
}

/* dvh — Dynamic Viewport Height: текущий viewport
   Меняется при скролле → вызывает перерасчёт layout */
.sticky-panel {
  height: 100dvh;  /* всегда точно, но с performance cost */
}

/* svw / lvw / dvw — аналоги для ширины */
/* svi / lvi / dvi — inline axis */
/* svb / lvb / dvb — block axis */
```

### Рекомендации по выбору

```css
/* Hero section: svh — надёжно, контент не обрезан */
.hero-section {
  min-height: 100svh;
}

/* Fallback для старых браузеров: */
.hero-section {
  min-height: 100vh;   /* fallback */
  min-height: 100svh;  /* override где поддерживается */
}

/* dvh: использовать осторожно */
/* Частые пересчёты при scroll = jank на слабых устройствах */
/* Только для элементов где точность важнее performance */

/* Sidebar высота: используй svh, не dvh */
.sidebar {
  height: 100svh;      /* ✅ стабильно */
  /* height: 100dvh;   ❌ будет "прыгать" при скролле */
}
```

---

## 6. :has()

### :has() как «parent selector»

```css
/* Традиционная проблема: нельзя выбрать родителя */
/* ❌ Не существует: .form:has-error {} */

/* ✅ :has() решает */
/* Форма содержащая невалидный input */
.form:has(input:invalid) {
  border: 1px solid var(--color-error);
}

/* Card с изображением — другой layout */
.card:has(img) {
  grid-template-rows: auto 1fr;
}

/* Navigation с открытым dropdown */
.nav:has(.dropdown[open]) {
  z-index: 100;
}
```

### :has() в адаптивных паттернах

```css
/* Адаптация layout в зависимости от количества дочерних */
/* Grid — разное количество колонок в зависимости от количества items */

/* 1 элемент — по центру */
.grid:has(> :nth-child(1):last-child) {
  justify-items: center;
}

/* 2 элемента — две колонки */
.grid:has(> :nth-child(2):last-child) {
  grid-template-columns: 1fr 1fr;
}

/* 3+ элементов — три колонки */
.grid:has(> :nth-child(3)) {
  grid-template-columns: repeat(3, 1fr);
}
```

### Связка :has() + container queries

```css
/* "Has Me" паттерн: контейнер автоматически определяется
   для элементов требующих container queries */

/* Вместо ручного добавления container-type: */
/* Автоматически: любой родитель элемента с data-container */
:has(> [data-container]) {
  container-type: inline-size;
}

/* Компонент использует container query */
@container (min-width: 400px) {
  [data-container] {
    grid-template-columns: 1fr 1fr;
  }
}
```

### Граничные случаи — где ломается

**`:has()` и performance**: `:has()` с широкими селекторами пересчитывается при каждом DOM изменении. `:has(input:invalid)` на форме — ОК. `:has(*)` на body — catastrophic performance.

**`:has()` и `:not()` комбинации**: `a:has(> img):not(:has(> span))` — валидно в 2026, но сложность читаемости. Тест: если нужно объяснять больше 10 секунд — рефакторить через CSS class.

**Firefox `:has()` в 2022 был conditional**: до FF 121 (декабрь 2023) `:has()` требовал флаг. В 2026 все major browsers поддерживают. Старые mobile browsers (WebView based на старых Chrome) — возможны проблемы.

**Почему это важно архитектору:** `:has()` меняет где живёт условная логика — из JS в CSS. Но performance бюджет не бесконечен. Правило: `:has()` на конкретных контейнерах, не на document root.

---

## Антипаттерны

**1. Desktop-first + один `max-width: 480px`**
```css
/* ❌ Весь сайт — desktop, один breakpoint для "мобильного" */
/* Реально: мобильный опыт — afterthought, не первый класс */
@media (max-width: 480px) {
  /* hide everything */
  .sidebar { display: none; }
  .header-nav { display: none; }
}
```

**2. Фиксированные pixel размеры для шрифтов и spacing на мобильном**
```css
/* ❌ Шрифт не масштабируется при zoom → fail WCAG */
.body { font-size: 14px; }

/* ✅ rem + fluid type (clamp) */
.body { font-size: var(--text-base); }  /* clamp(1rem, ...) */
```

**3. `container-type: size` вместо `inline-size`**
```css
/* ❌ size требует явной высоты — блок схлопывается */
.card-wrapper { container-type: size; }

/* ✅ inline-size для 99% случаев */
.card-wrapper { container-type: inline-size; }
```

**4. `dvh` для стабильных элементов**
```css
/* ❌ Sidebar прыгает при скролле на мобильном */
.sidebar { height: 100dvh; }

/* ✅ svh для стабильных элементов */
.sidebar { height: 100svh; }
```

**5. Смешивание physical и logical свойств**
```css
/* ❌ RTL конфликт */
.element {
  margin-left: 1rem;
  padding-inline-end: 1rem;
}
/* В RTL: margin-left будет с "неправильной" стороны */
```

**6. `@media` без `min-width` fallback для container queries**
```css
/* Браузеры без container query support не получают layout */
.card { display: block; }  /* ✅ базовый layout всегда */
@container (min-width: 400px) {
  .card { display: grid; grid-template-columns: 1fr 1fr; }
}
```

---

## 7. Реальный кейс: каталог на 50k товаров — мобильный first-class

### Контекст

Тот же каталог WooCommerce (модуль 30): 50 000 товаров из 1С, трафик на мобильных — ~60%. Вёрстка — desktop-first с одним `@media (max-width: 480px)`: антипаттерн №1 в чистом виде.

### Задача

Мобильный опыт — не «урезанный desktop», а первый класс: карточки товара, фильтры, корзина должны работать на 390px. Контент карточек разный (цена, артикул из 1С, кнопки) — вёрстка не по viewport, а по доступному месту.

### Гипотеза

Mobile-first cascade (базовый layout под мобильный, `min-width`-расширения) + container queries для карточек: карточка адаптируется к месту в сетке, а не к экрану.

### Что получилось

```css
/* Базовый layout — мобильный, работает везде */
.product-card { display: block; }
.product-card__price { font-size: clamp(1rem, 0.9rem + 1vw, 1.25rem); }

/* Расширение по контейнеру, а не по экрану */
@container (min-width: 340px) {
  .product-card { display: grid; grid-template-columns: 96px 1fr; }
}
@container (min-width: 560px) {
  .product-card { display: grid; grid-template-columns: 140px 1fr; }
  .product-card__actions { display: flex; }
}
```

- Сетка каталога: карточки считаются по контейнеру — в корзине (узкая колонка) карточка сворачивается сама, без отдельных правил;
- шрифты через `clamp()` — масштабируются, WCAG-зум работает (антипаттерн №2);
- дефолт без CQ-поддержки — `display: block` (fallback из антипаттерна №6).

### Грабли, найденные в production

1. **Desktop-first legacy в контенте**: витрина с `grid-template-columns: repeat(4, 1fr)` на мобильном давала 4 карточки по 90px. Базовый layout карточек переписан с нуля — патчи в media-запросах не помогали.
2. **`100dvh`-шапка**: на мобильном адресная строка схлопывалась/раскрывалась — шапка прыгала. `100svh` для стабильных элементов (антипаттерн №4).
3. **RTL-локали**: артикулы и названия с «физическими» `margin-left` ломались — логические свойства (модуль §4) в карточке.

### Вывод, противоречащий интуиции

Переход на mobile-first дал не «лучше на мобильном», а **меньше CSS**: базовый layout один, расширения по контейнерам, никаких каскадов `max-width`-переопределений. Desktop-first вёрстка каталога требовала больше правил, чем мобильно-первая — патчи «скрыть/переложить» умножались с каждым новым блоком.

**Практический вывод для архитектора:** mobile-first — контракт приоритетов: базовый слой под наименьший экран, расширения только по факту доступного места. Container queries снимают класс проблем «этот блок в другом контексте», который media-запросами решается копипастом правил.

---

## Anti-checklist ☠️

- [ ] Desktop-first media queries — mobile users платят за загрузку desktop-стилей
- [ ] `max-width: 0` пиксели вместо `rem` — ломается при изменении базового шрифта
- [ ] `@media (min-width: 1200px)` без mobile defaults — desktop стили не наследуются от mobile
- [ ] `touch-action: manipulation` не добавлен на кнопки — 300ms задержка на iOS
- [ ] `input[type="text"]` без `font-size: 16px` на iOS — авто-зум при фокусе
- [ ] Тестировать только на desktop DevTools mobile view — эмуляция ≠ реальное устройство

## Задачи AI-кодеру

**Плохая формулировка:**
> «Сделай компонент адаптивным»

**Хорошая формулировка:**
> «Для компонента ProductCard сделать container-based responsive:
> 1. На родительском элементе `.product-list` добавить `container: product-list / inline-size`.
> 2. Базовый layout `.product-card`: `display: grid; grid-template-columns: 1fr; gap: var(--space-3)`.
> 3. `@container product-list (min-width: 300px)` → `grid-template-columns: 80px 1fr`.
> 4. `@container product-list (min-width: 500px)` → `grid-template-columns: 160px 1fr; gap: var(--space-6)`.
> 5. Для изображения: `aspect-ratio: 1; object-fit: cover; inline-size: 100%`.
> Не использовать media queries для этого компонента — только container queries.»

---

**Плохая формулировка:**
> «Исправь высоту hero на мобильном»

**Хорошая формулировка:**
> «Для `.hero-section`:
> 1. Заменить `height: 100vh` на `min-height: 100svh` (не height — контент должен растягивать).
> 2. Добавить fallback выше: `min-height: 100vh; min-height: 100svh`.
> 3. Для `.hero-content` добавить `padding-block: var(--space-8)` чтобы контент не упирался в UI браузера.
> Проверить в Chrome DevTools с симуляцией iPhone 14 Pro (393×852, Safari style).»

---

## Чеклист архитектора

**Методология**
- [ ] Base стили — мобильный layout без media queries
- [ ] Media queries только `min-width` (не `max-width`) — редкие исключения задокументированы
- [ ] Breakpoints выведены из контента, не из размеров устройств
- [ ] `@layer` используется для контроля cascade specificity

**Container Queries**
- [ ] Переиспользуемые компоненты — container queries (не media)
- [ ] `container-type: inline-size` (не `size`) без необходимости
- [ ] Базовый layout определён ДО `@container` блоков (fallback)
- [ ] Нет `container-type` на flex items без явной ширины

**Viewport и единицы**
- [ ] Hero и full-height секции: `min-height: 100svh` (с `vh` fallback)
- [ ] Sidebar и sticky: `svh`, не `dvh`
- [ ] Логические свойства для всех padding/margin/border
- [ ] Нет смешивания physical и logical в одном компоненте

**:has() и современный CSS**
- [ ] `:has()` только на конкретных контейнерах (не document root)
- [ ] Нет `:has(*)` или широких `:has()` на живых DOM элементах
- [ ] CSS Nesting используется для media/container queries внутри компонента

**Тестирование**
- [ ] Проверка в portrait И landscape mobile
- [ ] Тест `min-width` breakpoints при медленном ресайзе окна
- [ ] Компоненты протестированы в разных контейнерах (sidebar vs main)

---

*Модуль 31 завершён.*
*Следующий: [Модуль 32 — Accessibility (a11y)](../32-accessibility/README.md)*
