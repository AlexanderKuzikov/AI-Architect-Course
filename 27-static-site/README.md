# Модуль 27 — Static Site Generation

> **Для AI-архитектора:** SSG — это не «сделать сайт без сервера». Это архитектурное решение: где проходит граница между build time и runtime, как управлять свежестью данных без полного rebuild, и сколько страниц пережёвывает CI перед деплоем. AI-кодер выберет Next.js по умолчанию. Задача архитектора — понять, когда Astro Islands экономит 95% JS, а когда ISR превращается в источник stale контента.
> Один день изучения — build vs runtime спектр, Astro 6 Island architecture, ISR механика, граничные случаи при тысячах страниц.

---

## Содержание

1. [Build-time vs Runtime — спектр](#1-спектр-рендеринга)
2. [Astro — Island architecture](#2-astro)
3. [ISR — Incremental Static Regeneration](#3-isr)
4. [Работа с большим числом страниц](#4-масштаб)
5. [SEO-first подход](#5-seo)
6. [Антипаттерны](#антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Astro | **6.1** (stable) | Island architecture SSG/SSR |
| Eleventy | **3.1.5** (stable) / 4.0.0-alpha | Zero-JS SSG, максимальная гибкость |
| Next.js | **15.x** | SSG + ISR + hybrid rendering |
| Vite | **6.x** | Build tooling под Astro |
| sharp | **0.34+** | Image optimization в build pipeline |

> Astro 6.x: workerd dev server, Live Content Collections, auto CSP.

---

## 1. Спектр рендеринга

### Где принимать решения о данных

```
Static (SSG)       ISR                SSR              CSR
────────────────────────────────────────────────────────────
Build time         Build + revalidate  Request time     Client
│                  │                   │                │
Максимум           Свежесть без        Персонализация,  Дашборды,
перфоманса,        full rebuild        авторизация,     интерактивность
нет свежести                           real-time
data staleness
до следующего
деплоя
```

**Правило для архитектора:** вопрос не «SSG или SSR?» — вопрос «какой части страницы нужна какая свежесть данных?» Astro Islands дают ответ на уровне компонента.

### Когда SSG не подходит

```
✅ SSG подходит:
   - Контент меняется реже чем деплои (блог, docs, маркетинг)
   - Данные одинаковы для всех пользователей
   - SEO критичен — поисковик получает готовый HTML

❌ SSG не подходит:
   - Персонализированный контент (корзина, профиль)
   - Real-time данные (live цены, чат)
   - > 100k страниц без ISR — build time растёт линейно
   - Авторизованный контент — нельзя кешировать на CDN
```

---

## 2. Astro

### Island architecture — механика

Astro генерирует zero-JS HTML по умолчанию. JavaScript добавляется только для явно помеченных компонентов («islands»):

```
Страница Astro:
┌─────────────────────────────────────────────┐
│  Header (static HTML — 0 KB JS)             │
│                                             │
│  Article (static HTML — 0 KB JS)            │
│                                             │
│  ┌─ Island: CommentSection ─────────────┐   │
│  │  client:visible                      │   │
│  │  Загружается только когда в viewport │   │
│  │  React: 45 KB                        │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Island: SearchWidget ────────────────┐  │
│  │  client:idle                          │  │
│  │  Загружается в idle браузера          │  │
│  │  Preact: 8 KB                         │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

Традиционный Next.js: весь JS гидрируется при загрузке
```

### Директивы гидрации

```astro
---
// Компонент без директивы — только HTML, 0 JS
import StaticHeader from './StaticHeader.astro'

// Компоненты с директивами — island с JS
import ReactSearch from './Search.tsx'
import VueCart from './Cart.vue'
import SvelteChart from './Chart.svelte'
---

<!-- 0 KB JS — просто HTML -->
<StaticHeader />

<!-- client:load — немедленно при загрузке страницы -->
<!-- Использовать только для above-the-fold критичных UI -->
<ReactSearch client:load />

<!-- client:idle — после load event, в requestIdleCallback -->
<!-- Некритичные виджеты: analytics, chat, secondary nav -->
<VueCart client:idle />

<!-- client:visible — при появлении в viewport (IntersectionObserver) -->
<!-- Контент ниже fold: комментарии, рекомендации -->
<SvelteChart client:visible />

<!-- client:media — при совпадении media query -->
<MobileMenu client:media="(max-width: 768px)" />

<!-- client:only — не рендерить на сервере совсем (pure client) -->
<!-- Для компонентов с window/document в конструкторе -->
<BrowserOnlyWidget client:only="react" />
```

**Практический вывод:** `client:load` — только для компонентов в первом экране, требующих немедленной интерактивности. Всё остальное — `client:idle` или `client:visible`. Разница в LCP и TTI — ощутимая.

### Content Collections — типизированный контент

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  type: 'content',  // Markdown/MDX файлы
  schema: z.object({
    title: z.string(),
    publishDate: z.date(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    author: z.string(),
    // Автоматическая валидация — ошибка сборки при несовпадении
  }),
})

const products = defineCollection({
  type: 'data',    // JSON/YAML файлы
  schema: z.object({
    name: z.string(),
    price: z.number().positive(),
    sku: z.string(),
  }),
})

export const collections = { blog, products }
```

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, getEntry } from 'astro:content'

// Все опубликованные посты
export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post },
  }))
}

const { post } = Astro.props
const { Content } = await post.render()
---

<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

### Граничные случаи — где ломается

**`client:only` и SSR гидрация**: компонент с `client:only` не рендерится на сервере — его HTML пустой до гидрации. Если поисковик не выполняет JS — контент невидим. Не использовать для SEO-критичного содержимого.

**Import ordering в `.astro`**: frontmatter (между `---`) выполняется на сервере в build time. Любой код с `window`, `document`, `localStorage` в frontmatter — crash сборки. Изолировать в `client:*` islands.

**Live Content Collections (Astro 6)**: новый режим — данные загружаются в runtime, не только в build. Ломает предположение «SSG = всё статично»: нужно явно объявлять что live, что static, иначе смешанный кэш.

**Почему это важно архитектору:** `client:load` везде — это не island architecture, это просто медленный React app с лишним шагом. Профилировать bundle по `astro build --verbose` перед деплоем.

---

## 3. ISR

### Механика revalidation в Next.js

```typescript
// Next.js App Router — fetch с revalidate
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`, {
    next: {
      revalidate: 3600,  // секунды — stale-while-revalidate
      tags: ['products', `product-${id}`],  // для on-demand revalidation
    },
  })
  return res.json()
}

// Страница с ISR
export default async function ProductPage({ params }) {
  const product = await getProduct(params.id)
  return <Product data={product} />
}

export async function generateStaticParams() {
  // Только топ-1000 страниц в build time
  const products = await getTopProducts(1000)
  return products.map(p => ({ id: p.id }))
}
// Остальные страницы: fallback к SSR при первом запросе → потом кешируются
```

### On-demand revalidation — по событию

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret')

  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tag } = await request.json()
  revalidateTag(tag)  // инвалидировать все страницы с этим тегом

  return Response.json({ revalidated: true, timestamp: Date.now() })
}

// CMS webhook → POST /api/revalidate { tag: 'product-42' }
// → только страница product/42 перестраивается, не весь сайт
```

### Stale-While-Revalidate семантика

```
Запрос 1 (t=0):   страница не существует → SSR → кеш записан
Запрос 2 (t=30):  из кеша (свежий)
...
Запрос N (t=3600+): из кеша (STALE) → фоновый rebuild запущен
Запрос N+1:       из кеша (может быть ещё stale, пока rebuild идёт)
Запрос N+K:       новая версия из кеша

Критично: пользователь может видеть stale контент даже после revalidate.
Для e-commerce цен или акций — ISR с коротким TTL или on-demand revalidation.
```

### Граничные случаи — где ломается

**ISR + personalization ловушка**: ISR кешируется на CDN — это публичный кеш. Страница с `cookie`-зависимым контентом + ISR = все пользователи получают чужой контент. ISR только для полностью публичных страниц.

**`revalidate: 0` ≠ SSR**: в Next.js `revalidate: 0` означает «не кешировать на CDN edge», но страница всё равно может кешироваться на уровне ноды. Для настоящего SSR — убирать `revalidate` совсем или использовать `no-store`.

**Почему это важно архитектору:** ISR + CDN = отличная связка для публичного контента с редкими обновлениями. ISR + авторизация = потенциальная утечка данных между пользователями.

---

## 4. Масштаб

### Проблема build time при тысячах страниц

```
10 страниц:    build = 5s     ✅ комфортно
1,000 страниц: build = 45s    ✅ приемлемо
10,000 страниц: build = 8min  ⚠️ slow CI
100,000 страниц: build = 80min ❌ неприемлемо
```

### Стратегия: генерировать только часть в build

```typescript
// Next.js: generateStaticParams с лимитом
export async function generateStaticParams() {
  // В build — только топ страницы
  // Остальные — ISR fallback при первом запросе
  const posts = await db.posts.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { views: 'desc' },
    take: process.env.CI ? 1000 : 100,  // меньше в CI для быстрой сборки
  })
  return posts.map(p => ({ slug: p.slug }))
}

// Fallback для незагенерированных страниц
export const dynamicParams = true  // (default) — SSR для unknown params
// export const dynamicParams = false — 404 для unknown params
```

### Параллельная генерация (Next.js 15)

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    staticGenerationMaxConcurrency: 8,      // параллельных workers
    staticGenerationMinPagesPerWorker: 25,  // минимум страниц на worker
  },
}
```

### Astro: parallel builds через workerThreads

```javascript
// astro.config.mjs
export default defineConfig({
  build: {
    concurrency: 4,  // параллельных потоков сборки
  },
})
```

### Граничные случаи — где ломается

**Memory в build process**: при генерации 50k+ страниц Node.js build process может hit heap limit. `NODE_OPTIONS=--max-old-space-size=8192` для больших сайтов в CI. Astro 6 с workerd dev server снижает footprint.

**Частичный rebuild**: большинство SSG фреймворков не поддерживают настоящий incremental rebuild из коробки — при изменении layout все страницы перестраиваются. Eleventy 3.x с `--incremental` флагом — исключение.

**Почему это важно архитектору:** при 10k+ страниц первое архитектурное решение — не «какой фреймворк», а «что генерировать в build, что откладывать на ISR/SSR». Это решение определяет CI pipeline и стоимость деплоя.

---

## 5. SEO

### Что SSG даёт SEO

```
SSG → HTML на CDN → поисковик получает готовый контент
SSR → HTML генерируется при запросе → потенциально медленнее
CSR → пустой HTML + JS → поисковик может не выполнить JS

Core Web Vitals с SSG:
  LCP: < 1s (HTML с CDN, нет server round-trip)
  CLS: 0 (нет layout shift от JS-рендеринга)
  INP: зависит от island hydration
```

### Sitemap и canonical

```typescript
// Astro: @astrojs/sitemap
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://example.com',  // обязательно для sitemap
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/draft/'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      // Кастомизация по URL паттерну
      customPages: ['https://example.com/custom-page'],
    }),
  ],
})
```

```astro
---
// Canonical URL — защита от дублирования контента
const canonicalURL = new URL(Astro.url.pathname, Astro.site)
---
<head>
  <link rel="canonical" href={canonicalURL} />
  <meta property="og:url" content={canonicalURL} />
</head>
```

### Structured data (JSON-LD)

```astro
---
const article = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": post.data.title,
  "datePublished": post.data.publishDate.toISOString(),
  "author": { "@type": "Person", "name": post.data.author },
  "image": post.data.coverImage,
}
---
<script type="application/ld+json" set:html={JSON.stringify(article)} />
```

### Граничные случаи — где ломается

**Trailing slash непоследовательность**: `/blog/post` vs `/blog/post/` — дублированный контент. Настроить явно и глобально:
```typescript
// Astro
export default defineConfig({ trailingSlash: 'always' })  // или 'never'
```

**OG-изображения и robots**: динамические OG-изображения через Edge Function (Vercel/Cloudflare) vs build-time генерация (satori). Build-time надёжнее, но медленнее при тысячах страниц.

**Почему это важно архитектору:** SSG + CDN = идеально для LCP и TTFB. Но canonical, sitemap и structured data — это не «добавить потом». Ошибки индексируются быстро, исправляются медленно.

---

## Антипаттерны

**1. `client:load` для всех компонентов**
Нивелирует island architecture — получается медленный React SPA. Анализировать каждый компонент: нужна ли немедленная гидрация или достаточно `client:visible`?

**2. Генерировать все страницы в build time без лимита**
```typescript
// ❌ Все 500k продуктов в build — 2 часа CI
export async function generateStaticParams() {
  return await getAllProducts()  // 500k записей
}

// ✅ Топ-1000 в build, остальные — ISR
export async function generateStaticParams() {
  return await getTopProducts(1000)
}
```

**3. ISR для персонализированного контента**
ISR хранится в публичном CDN кеше. Любая страница с пользовательскими данными (имя, история заказов) через ISR — утечка между пользователями.

**4. Забыть `revalidate` тег для on-demand invalidation**
Без тегов `revalidateTag()` инвалидирует всё или ничего. Теги на каждый fetch — обязательная практика для e-commerce и CMS.

**5. Sitemap без фильтра draft/private страниц**
Draft посты, служебные страницы, 404 — в sitemap не должны попасть. `filter` обязателен.

**6. Смешивать ISR и авторизацию на одном route**
```typescript
// ❌ ISR + auth check — первый авторизованный пользователь кеширует страницу для всех
export const revalidate = 3600
export default async function Page() {
  const session = await getSession()  // персональные данные
  return <Dashboard user={session.user} />
}
```

---

## Anti-checklist ☠️

- [ ] `client:load` для всех компонентов в Astro — нивелирует island architecture
- [ ] Генерировать все страницы в build без лимита — 500k страниц = 2 часа CI
- [ ] ISR для персонализированного контента — публичный CDN кеш, утечка между пользователями
- [ ] Забыть `revalidate` тег для on-demand invalidation — инвалидирует всё или ничего
- [ ] Sitemap без фильтра draft/private — служебные страницы попадают в поиск
- [ ] Смешивать ISR и авторизацию на одном route — первый пользователь кеширует для всех

## Задачи AI-кодеру

**Плохая формулировка:**
> «Сделай блог на Astro»

**Хорошая формулировка:**
> «Создай Astro 6.1 блог. Content Collection `blog` с schema: title (string), publishDate (date), tags (string[]), draft (boolean, default: false).
> Страница `/blog/[slug].astro` через `getStaticPaths` + `getCollection('blog', p => !p.data.draft)`.
> Island `SearchWidget` с `client:idle`, компонент Preact.
> Комментарии `client:visible`.
> Sitemap через `@astrojs/sitemap`, `trailingSlash: 'never'`, canonical URL в head.
> JSON-LD Article schema для каждого поста.»

---

**Плохая формулировка:**
> «Добавь ISR для каталога товаров»

**Хорошая формулировка:**
> «В Next.js 15 App Router: страница `/products/[id]` с `revalidate: 3600` и тегом `product-${id}`.
> `generateStaticParams` только для топ-500 по views.
> `dynamicParams = true` для остальных.
> Route `/api/revalidate` POST: проверить `x-revalidate-secret` header, вызвать `revalidateTag(\`product-\${id}\`)`.
> Никаких персонализированных данных на этом route — только публичный контент продукта.»

---

## Чеклист архитектора

**Выбор стратегии**
- [ ] Определена граница: что генерируется в build, что через ISR, что SSR
- [ ] ISR routes содержат только публичный контент (нет сессий, нет user data)
- [ ] Количество страниц в build оценено — нет риска timeout в CI

**Astro Islands**
- [ ] `client:load` только для above-the-fold критичных компонентов
- [ ] `client:visible` для контента ниже fold
- [ ] `client:only` не используется для SEO-критичного контента
- [ ] Bundle по islands проанализирован (`astro build --verbose`)

**ISR / Data freshness**
- [ ] `revalidate` теги на каждом fetch для on-demand invalidation
- [ ] Webhook от CMS → `revalidateTag()` настроен
- [ ] stale-while-revalidate семантика понята командой (пользователи видят stale)

**SEO**
- [ ] `trailingSlash` настроен глобально (только один вариант)
- [ ] Canonical URL на каждой странице
- [ ] Sitemap с фильтром draft/private страниц
- [ ] JSON-LD structured data для ключевых типов страниц
- [ ] OG-изображения сгенерированы (не дефолтные)

**Build pipeline**
- [ ] `staticGenerationMaxConcurrency` настроен для больших сайтов
- [ ] `NODE_OPTIONS=--max-old-space-size=8192` в CI для 10k+ страниц
- [ ] Build time в CI измерен и приемлем (< 5 минут цель)

---

*Модуль 27 завершён.*
*Следующий: [Модуль 28 — Core Web Vitals: intro](../28-core-web-vitals-intro/README.md)*
