# GLOSSARY — Static Site Generation

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**Astro Islands**  
Архитектурный паттерн Astro: страница — статический HTML, интерактивность добавляется точечно через «острова» (компоненты с `client:*` директивами). Остальная страница — 0 KB JavaScript. Позволяет смешивать React, Vue, Svelte, Preact на одной странице.

---

## C

**canonical URL**  
`<link rel="canonical">` тег, указывающий поисковику предпочтительный URL страницы при наличии дублей (с/без trailing slash, параметры сортировки). Защита от пенализации за дублированный контент.

**client:idle**  
Astro hydration директива: компонент гидрируется в `requestIdleCallback` — после завершения critical rendering path. Для некритичных виджетов (analytics, secondary navigation).

**client:load**  
Astro hydration директива: гидрация немедленно при загрузке страницы. Использовать только для above-the-fold компонентов, требующих немедленной интерактивности.

**client:only**  
Astro hydration директива: компонент не рендерится на сервере, только на клиенте. HTML пустой до гидрации — не использовать для SEO-критичного контента.

**client:visible**  
Astro hydration директива: гидрация при появлении компонента в viewport (IntersectionObserver). Оптимальный выбор для контента ниже fold.

**Content Collections**  
Astro механизм для типизированного контента: `defineCollection` + Zod schema. Автоматическая валидация frontmatter при сборке — ошибка типа = ошибка build, не runtime.

---

## D

**dynamicParams**  
Next.js App Router: `export const dynamicParams = true/false`. `true` (default) — запрос к незагенерированному slug → SSR (fallback). `false` — 404. Определяет поведение для страниц вне `generateStaticParams`.

---

## G

**generateStaticParams**  
Next.js App Router аналог `getStaticPaths`. Возвращает массив params для pre-генерации страниц в build time. Для масштаба: возвращать только топ N страниц, остальные — ISR fallback.

---

## I

**ISR (Incremental Static Regeneration)**  
Гибридная стратегия: страница генерируется статически, но периодически перестраивается без full rebuild. `revalidate: N` — время жизни кеша в секундах. При истечении: страница остаётся в кеше (stale) пока фоново генерируется новая версия.

---

## J

**JSON-LD**  
Формат structured data для поисковиков. `<script type="application/ld+json">` в head. Schema.org типы: Article, Product, BreadcrumbList, FAQPage. Влияет на rich snippets в результатах поиска.

---

## L

**Live Content Collections**  
Astro 6 функция: данные загружаются в runtime, не только в build time. Позволяет смешивать статические и динамические коллекции на одной странице.

---

## O

**on-demand revalidation**  
ISR механизм: инвалидация кеша по событию (CMS webhook, API call), не по таймеру. `revalidateTag(tag)` в Next.js. Позволяет обновить конкретные страницы мгновенно без rebuild всего сайта.

---

## R

**revalidate**  
Next.js параметр для fetch и page: время в секундах до следующей перегенерации страницы (ISR). `revalidate: 0` — не кешировать на CDN edge. `revalidate: 3600` — обновлять раз в час.

**revalidateTag**  
Next.js функция: инвалидировать кеш всех fetch-запросов с данным тегом. Вызывается из Route Handler при webhook от CMS. Позволяет точечную инвалидацию без rebuild.

---

## S

**Server Islands**  
Astro (экспериментально): серверный аналог client islands — компонент рендерится на сервере при каждом запросе, вставляется в статическую страницу. Для персонализированных блоков (приветствие, счётчик) без перевода всей страницы в SSR.

**sitemap**  
XML файл со списком URL сайта для поисковиков. `@astrojs/sitemap` генерирует автоматически. Обязателен filter для draft страниц, служебных URL, 404.

**SSG (Static Site Generation)**  
Стратегия: HTML генерируется в build time, раздаётся с CDN. Максимальная производительность (TTFB < 50ms), нулевой server runtime. Данные свежи до следующего деплоя или revalidation.

**stale-while-revalidate**  
HTTP кеш стратегия (и ISR механика): при истёкшем кеше — вернуть stale ответ немедленно и запустить фоновое обновление. Пользователь не ждёт, но видит устаревшие данные на время regeneration.

---

## T

**trailing slash**  
`/blog/post` vs `/blog/post/` — оба варианта одной страницы. Без единой политики поисковик видит дублированный контент. Настраивать глобально: `trailingSlash: 'always'` или `'never'`.

---

*Глоссарий модуля 27. Следующий: [Модуль 28 — Core Web Vitals](../28-core-web-vitals/GLOSSARY.md)*
