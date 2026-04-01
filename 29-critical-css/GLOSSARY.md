# GLOSSARY — Critical CSS Inlining

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**above-the-fold**  
Контент страницы видимый без прокрутки при первой загрузке. Viewport-зависимо: desktop (1440×900), mobile (390×844). Только стили для этого контента должны быть critical — всё остальное может загружаться асинхронно.

---

## B

**Beasties**  
Наследник Critters от Google (2023+). Webpack/standalone инструмент: парсит HTML и CSS, определяет стили используемые above-the-fold, инлайнит их в `<style>`, преобразует `<link>` для async loading. Не требует headless browser — быстрее Penthouse/Critical.

---

## C

**contain-intrinsic-size**  
CSS свойство — hint для браузера о приблизительном размере `content-visibility: auto` элемента до его rendering. Без этого свойства элемент схлопывается до 0px → CLS при скролле. `auto 600px` — использовать последний известный размер, fallback 600px.

**content-visibility**  
CSS свойство: `auto` — браузер пропускает layout/paint для off-screen элементов. Rendering откладывается до приближения к viewport. Дополняет critical CSS: устраняет rendering bottleneck (CPU) для below-fold контента.

**critical CSS**  
Минимальный набор CSS правил, необходимых для отрисовки above-the-fold контента без прокрутки. Должен быть inline в `<head>` для устранения render-blocking. Цель размера: < 14KB gzip.

**Critters**  
Webpack plugin от Google (2018), предшественник Beasties. Автоматически извлекал critical CSS без headless browser. В 2023 заменён Beasties.

**CSSOM (CSS Object Model)**  
Браузерное представление CSS в виде дерева. Строится параллельно с DOM, но render tree создаётся только когда оба готовы. Незавершённый CSSOM блокирует rendering — причина render-blocking.

---

## F

**FOUC (Flash of Unstyled Content)**  
Визуальный эффект: страница появляется без стилей (белая/несверстанная) на долю секунды до загрузки CSS. Происходит при неправильном async loading — стили применяются после initial render.

---

## M

**media print trick**  
Паттерн async CSS loading: `<link rel="stylesheet" media="print" onload="this.media='all'">`. `media="print"` — браузер загружает с низким приоритетом без блокировки render. После загрузки `onload` меняет media на `all` — стили применяются. Требует `<noscript>` fallback.

---

## N

**noscript fallback**  
`<noscript><link rel="stylesheet" href="..."></noscript>` — обычная загрузка CSS для браузеров с отключённым JavaScript. Обязателен при использовании media print trick или preload+onload swap, так как оба паттерна зависят от JS.

---

## P

**Penthouse**  
Оригинальный critical CSS generator (2014). Использует headless Puppeteer: реально загружает страницу и определяет видимые стили. Медленный, но точный. Заменён Beasties для большинства use cases.

**preload (CSS)**  
`<link rel="preload" as="style">` — загрузить ресурс с высоким приоритетом без применения. Используется в паттерне `onload="this.rel='stylesheet'"`. Конкурирует с LCP image за bandwidth — в отличие от media print trick.

**pruneSource**  
Beasties опция: при `true` — удалять inlined стили из оригинального CSS файла, создавая уникальный файл на каждую HTML страницу. Устраняет дублирование, но разрушает cross-page CSS кеш. Рекомендуется `false` для SSG сайтов.

---

## R

**render-blocking**  
Ресурс, блокирующий построение render tree и первый paint. CSS: `<link rel="stylesheet">` в `<head>`. JavaScript: `<script>` без `defer`/`async`. Главная причина медленного LCP и FCP.

**render tree**  
Браузерная структура: объединение DOM и CSSOM. Содержит только видимые элементы с вычисленными стилями. Render tree → Layout → Paint → Compositing → Pixels. Невозможно построить без завершённого CSSOM.

---

## T

**TCP slow start**  
Механизм TCP: новое соединение начинает с ~14KB данных в первом round-trip, постепенно увеличивая. Если HTML + critical CSS умещается в 14KB — приходят в одном round-trip без ожидания. Обоснование для лимита critical CSS.

---

*Глоссарий модуля 29. Следующий: [Модуль 30 — Schema.org / Structured data](../30-schema-org/GLOSSARY.md)*
