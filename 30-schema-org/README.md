# Модуль 30 — Schema.org / Structured Data

> **Для AI-архитектора:** structured data — это не «добавить JSON-LD и получить звёздочки». Это создание машиночитаемого описания сущностей сайта для поисковиков и AI систем. AI-кодер скопирует пример из документации и добавит его на все страницы одинаково. Задача архитектора — понять какие типы Google реально поддерживает в 2026, как правильно связывать сущности через `@id`, и почему Plugin Collision убивает всю разметку сразу.
> Один день изучения — Schema.org vs Google subset, JSON-LD механика, ключевые типы, изменения 2026, entity graph.

---

## Содержание

1. [Schema.org vs Google Rich Results](#1-schema-vs-google)
2. [JSON-LD механика](#2-json-ld)
3. [Ключевые типы 2026](#3-типы)
4. [Entity graph и @id](#4-entity-graph)
5. [Изменения 2026](#5-изменения-2026)
6. [Валидация и мониторинг](#6-валидация)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Schema.org vocab | **28.x** | Полная онтология типов |
| Google Search Gallery | — | Subset типов поддерживаемых Google |
| Rich Results Test | — | Валидация Google-specific |
| Schema Markup Validator | — | Полная Schema.org валидация |

> **Важно январь 2026:** Google удалил поддержку ряда rich result типов. Dataset работает только в Dataset Search. FAQPage/HowTo — строгие ограничения. Всегда проверять актуальный [Google Search Gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery).

---

## 1. Schema vs Google

### Принципиальная разница

```
Schema.org (800+ типов):
  Полная онтология для semantic web.
  Любые типы: MedicalCondition, Volcano, Molecule,
  SportingEvent, Aquarium, Cemetery...

Google Rich Results (~30 типов):
  Subset с конкретными требованиями.
  Только то, что Google может отобразить в SERP.
  Всё остальное — помогает понять контент, но не даёт rich snippet.

Правило: если типа нет в Google Search Gallery → rich result не будет.
         Но разметка всё равно полезна для AI Overview и Knowledge Graph.
```

### Что даёт structured data в 2026

```
1. Rich Results — визуальные улучшения в SERP:
   Звёздочки, цены, изображения, FAQ дропдауны
   → CTR +20-30% для подходящих типов

2. Knowledge Graph — связи между сущностями:
   Google понимает "этот автор" = "этот человек" = "эта книга"
   → лучше отвечает на entity-based запросы

3. AI Overview citations — LLM-based ответы:
   Structured data помогает AI понять intent и тип контента
   → больше шансов быть процитированным в AI ответах

4. Voice Search / Assistant:
   Голосовые ответы часто берут данные из structured data
   (время работы, адрес, цена)
```

---

## 2. JSON-LD

### Форматы и выбор

```
JSON-LD  → рекомендован Google, полностью отдельно от HTML
Microdata → встроен в HTML атрибуты, сложнее поддерживать
RDFa    → мощный, но высокий порог вхождения

JSON-LD используется во всём модуле. Причины:
  ✓ Не смешан с HTML — легко менять независимо
  ✓ Легко генерировать программно из CMS данных
  ✓ Нет риска сломать верстку при изменении
  ✓ Единственный где Google разрешает размещение в <body>
```

### Базовая структура

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "https://example.com/blog/post-slug#article",
  "headline": "Заголовок статьи",
  "datePublished": "2026-03-15",
  "dateModified": "2026-03-20",
  "author": {
    "@type": "Person",
    "@id": "https://example.com/authors/alex#person",
    "name": "Alex Kuzikov",
    "url": "https://example.com/authors/alex"
  },
  "publisher": {
    "@type": "Organization",
    "@id": "https://example.com/#organization",
    "name": "Example",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png",
      "width": 200,
      "height": 60
    }
  },
  "image": {
    "@type": "ImageObject",
    "url": "https://example.com/blog/post-slug/cover.jpg",
    "width": 1200,
    "height": 630
  },
  "description": "Краткое описание до 160 символов.",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/blog/post-slug"
  }
}
</script>
```

### Несколько типов на одной странице

```html
<!-- Несколько <script type="application/ld+json"> — это нормально -->
<!-- Каждый описывает разную сущность -->

<script type="application/ld+json">
{ "@type": "WebSite", "@id": "https://example.com/#website", ... }
</script>

<script type="application/ld+json">
{ "@type": "Organization", "@id": "https://example.com/#organization", ... }
</script>

<script type="application/ld+json">
{ "@type": "BreadcrumbList", ... }
</script>

<!-- ❌ НЕ объединять несвязанные типы в один @graph без необходимости -->
<!-- Сложнее поддерживать, сложнее дебажить -->
```

### Граничные случаи — где ломается

**Невалидный JSON**: один пропущенный символ в `<script type="application/ld+json">` → Google парсер игнорирует весь блок без ошибки. Использовать `JSON.parse()` тесты в CI.

**`datePublished` формат**: Google строго требует ISO 8601. `"2026-03-15"` — ОК. `"March 15, 2026"` или `"15.03.2026"` — игнорируется.

**Несоответствие видимому контенту**: Google политика — structured data должна описывать контент реально видимый пользователю. Product цена в JSON-LD = цена на странице. Несоответствие → manual action (penalty).

**Почему это важно архитектору:** Google карает не за неверный JSON-LD — он его просто игнорирует. Google карает за спуфинг: данные в structured data не совпадают с реальным контентом страницы.

---

## 3. Типы

### Product — e-commerce

Наиболее требовательный тип. Google требует минимально: name, image, одно из (offers ИЛИ aggregateRating ИЛИ review).

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://example.com/products/widget-pro#product",
  "name": "Widget Pro",
  "description": "High-quality widget for professionals",
  "image": [
    "https://example.com/products/widget-pro/front.jpg",
    "https://example.com/products/widget-pro/side.jpg"
  ],
  "sku": "WDGT-PRO-001",
  "brand": {
    "@type": "Brand",
    "name": "WidgetCo"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/products/widget-pro",
    "priceCurrency": "RUB",
    "price": "2990",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": {
      "@type": "Organization",
      "@id": "https://example.com/#organization"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "128",
    "bestRating": "5",
    "worstRating": "1"
  }
}
```

**Ловушка**: `priceValidUntil` обязателен для стабильного rich result. Без него Google может не показывать цену. Дата должна быть в будущем.

### Article / BlogPosting

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Заголовок (до 110 символов для Google)",
  "image": "https://example.com/post-cover.jpg",
  "datePublished": "2026-03-15T10:00:00+05:00",
  "dateModified": "2026-03-20T12:00:00+05:00",
  "author": [{
    "@type": "Person",
    "@id": "https://example.com/authors/alex#person",
    "name": "Alex Kuzikov",
    "url": "https://example.com/authors/alex"
  }],
  "publisher": {
    "@type": "Organization",
    "@id": "https://example.com/#organization"
  }
}
```

**`headline` лимит**: Google Discover обрезает до ~110 символов. Лучше держать в пределах.

### BreadcrumbList — обязателен для всех сайтов

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Главная",
      "item": "https://example.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Блог",
      "item": "https://example.com/blog/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Название статьи"
      // последний элемент — item не обязателен (текущая страница)
    }
  ]
}
```

Breadcrumbs отображаются в SERP вместо URL — повышают доверие и CTR.

### FAQPage — осторожно

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Вопрос?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Ответ в виде текста или HTML."
    }
  }]
}
```

**Ограничения 2026**: Google резко сократил показ FAQPage rich results. Показываются только для авторитетных доменов по узким запросам. Не рассчитывать на них как на стабильный канал трафика.

### LocalBusiness

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://example.com/#local-business",
  "name": "Компания",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "ул. Примерная, 1",
    "addressLocality": "Москва",
    "addressCountry": "RU",
    "postalCode": "123456"
  },
  "telephone": "+7-999-000-00-00",
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens": "09:00",
    "closes": "18:00"
  }],
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "55.7558",
    "longitude": "37.6176"
  }
}
```

---

## 4. Entity graph

### @id — постоянные идентификаторы сущностей

```json
// ❌ Анонимные объекты — Google видит три разных "Publisher"
{ "publisher": { "@type": "Organization", "name": "Example" } }
{ "publisher": { "@type": "Organization", "name": "Example" } }
{ "publisher": { "@type": "Organization", "name": "Example" } }

// ✅ @id — один идентификатор, Google связывает в единую сущность
{ "publisher": { "@type": "Organization", "@id": "https://example.com/#organization" } }
{ "publisher": { "@type": "Organization", "@id": "https://example.com/#organization" } }
```

`@id` = URL (не обязательно реальная страница — может быть с `#fragment`). Постоянный URI для сущности по всему сайту.

### Связывание сущностей через @id (повторное использование)

```json
// Страница 1 — полное определение Organization
{
  "@type": "Organization",
  "@id": "https://example.com/#organization",
  "name": "Example Corp",
  "url": "https://example.com",
  "logo": { "url": "https://example.com/logo.png" },
  "sameAs": [
    "https://twitter.com/example",
    "https://linkedin.com/company/example",
    "https://t.me/example"
  ]
}

// Страница 2 — ссылка по @id, Google знает что это то же самое
{
  "@type": "Article",
  "publisher": {
    "@id": "https://example.com/#organization"
    // Google дополняет из первого определения — имя, лого и т.д.
  }
}
```

### sameAs — Entity disambiguation

```json
// sameAs связывает сущность с известными источниками
// Google использует для Knowledge Graph
{
  "@type": "Person",
  "@id": "https://example.com/authors/alex#person",
  "name": "Alexander Kuzikov",
  "sameAs": [
    "https://github.com/AlexanderKuzikov",
    "https://www.linkedin.com/in/alexanderkuzikov",
    "https://t.me/alexkuzikov"
  ]
}
```

### Граничные случаи — где ломается

**Plugin collision**: WordPress с Yoast + Rank Math + WooCommerce — каждый генерирует свой `Organization` блок с разными данными. Google получает конфликтующие описания одной сущности → игнорирует оба или выбирает случайный. Один источник structured data на сайт.

**@id с trailing slash непоследовательность**: `https://example.com/#org` и `https://example.com#org` — для Google это разные @id. Использовать canonical URL с или без trailing slash — единообразно.

**Circular references в @id**: `Article.author.@id` → `Person` → `Person.worksFor.@id` → `Organization` → `Organization.founder.@id` → обратно к `Person`. Валидный JSON-LD, но бессмысленно глубокая вложенность не улучшает результаты.

**Почему это важно архитектору:** `sameAs` + `@id` = разница между «набор текстовых полей» и «граф сущностей». Google Knowledge Graph строится на связях. Автор без `sameAs` — анонимная строка. Автор с `sameAs` к GitHub/LinkedIn — верифицированная личность.

---

## 5. Изменения 2026

### Удалённые типы (январь 2026)

Google прекратил поддержку rich results для:
- `Dataset` — перемещён в Dataset Search
- `SpecialAnnouncement` — добавлен в COVID период, убран
- `CovidTestingFacility` — убран

### FAQPage и HowTo — ограничения

```
До 2024: FAQPage показывался для большинства сайтов
2024:    Ограничен авторитетными доменами
2025-2026: Ещё строже — только для узких запросов,
           правительственные и медицинские сайты

Вывод: FAQPage — добавлять, но не строить стратегию на нём.
       Потенциал не исчез полностью — просто непредсказуем.
```

### AI Overview и structured data

```
Google AI Overview (SGE):
  Structured data → сигнал о типе и достоверности контента
  JSON-LD с правильными типами → выше шансы на цитирование

Важные типы для AI Overview:
  Article с dateModified → «свежий» контент
  Person/Organization с sameAs → верифицированные источники
  HowTo → пошаговые инструкции
  FAQPage → ответы на вопросы
```

---

## 6. Валидация

### Инструменты

```
1. Rich Results Test (search.google.com/test/rich-results)
   → Показывает какие Google rich results доступны
   → Предупреждения и ошибки по Google требованиям
   → Тестировать перед деплоем новых типов

2. Schema Markup Validator (validator.schema.org)
   → Полная Schema.org валидация
   → Не Google-specific — для проверки синтаксиса

3. Google Search Console → Enhancements
   → Field data: реальные ошибки с production
   → Статус по типам: valid, warning, error, excluded
   → Тренды и покрытие
```

### CI валидация

```typescript
// scripts/validate-schema.ts — проверить JSON-LD в сгенерированных HTML
import { glob } from 'glob'
import fs from 'fs/promises'
import * as cheerio from 'cheerio'

async function validateSchemaMarkup(distDir: string) {
  const htmlFiles = await glob(`${distDir}/**/*.html`)
  const errors: string[] = []

  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf-8')
    const $ = cheerio.load(html)

    $('script[type="application/ld+json"]').each((i, el) => {
      const content = $(el).html() ?? ''

      try {
        const parsed = JSON.parse(content)

        // Проверить обязательные поля
        if (!parsed['@context']) {
          errors.push(`${file}: missing @context in schema block ${i + 1}`)
        }
        if (!parsed['@type']) {
          errors.push(`${file}: missing @type in schema block ${i + 1}`)
        }

        // Проверить ISO 8601 даты
        const dateFields = ['datePublished', 'dateModified', 'priceValidUntil']
        for (const field of dateFields) {
          if (parsed[field] && isNaN(Date.parse(parsed[field]))) {
            errors.push(`${file}: invalid date format in ${field}: ${parsed[field]}`)
          }
        }

      } catch (err) {
        errors.push(`${file}: invalid JSON in schema block ${i + 1}: ${err}`)
      }
    })
  }

  if (errors.length > 0) {
    console.error('Schema validation errors:')
    errors.forEach(e => console.error(' -', e))
    process.exit(1)
  }

  console.log(`✓ Schema validated: ${htmlFiles.length} HTML files, no errors`)
}

validateSchemaMarkup('./dist')
```

---

## 7. Реальный кейс: разметка в SEO-проекте — цикл «шаблон → диагностика → переобход»

### Контекст

SEO-проект (SEO-Zavodsvay): статический сайт на PHP-шаблонах, подключение полного цикла Яндекс: Вебмастер (API v4), Метрика (обход по счётчикам), Wordstat, SerpWatcher-мониторинг позиций. Диагностика сайта и разметки — через Вебмастер API (`webmaster_baseline.py`, `webmaster_monitor.py`).

### Задача

Структурированная разметка информационных страниц (Article, FAQ) + контроль, как поисковик видит сайт: без диагностики «разметка есть» ≠ «разметка принята».

### Гипотеза

Разметка генерируется в шаблоне (единый источник — данные страницы), а проверка — не «посмотрел в Rich Results Test», а регулярная диагностика через Вебмастер API + переобход (`recrawl`) после правок.

### Что получилось

```php
<?php // partials/schema_article.php — разметка из данных страницы, не копипаст ?>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "<?= $page->url ?>#article",
  "headline": <?= json_encode($page->title, JSON_UNESCAPED_UNICODE) ?>,
  "datePublished": "<?= $page->published_at ?>",
  "publisher": { "@id": "<?= $site->url ?>/#organization" }
}
</script>
```

- `Organization` определена один раз в базовом layout, страницы ссылаются по `@id` (антипаттерн «дублировать объект на каждой странице»);
- диагностика через Вебмастер: `GET /user/{uid}/hosts/{hid}/diagnostics` — реальные проблемы индексирования, а не «разметка сломана» в вакууме;
- после правок разметки — `POST /recrawl/{url}` (квота ~700/день): страница переобходит в течение суток;
- токен OAuth — в `.env`, gitignored (получен из `#fragment`, грабль с хвостом URL).

### Грабли, найденные в production

1. **`NO_METRIKA_COUNTER_CRAWL_ENABLED` в диагностике** — это НЕ про сломанный счётчик: обход по счётчикам включается в Вебмастере (Индексирование → Обход по счётчикам), а не в Метрике. Полдня разборов на пустом месте — пока не открыли правильную вкладку.
2. **`HOST_NOT_LOADED` в первый день** — сайт добавлен и подтверждён, но данных нет ~24 часа. «Проверяй скриптом завтра», а не «всё сломалось».
3. **PowerShell против Яндекс API** — `Invoke-RestMethod` на loopback падает (системный прокси); тестирование только через `curl.exe`.
4. **Rate limit API** — 429/5xx, retry с backoff `2*(attempt+1)` до 3 попыток: монитор-скрипт не должен падать на лимите.

### Вывод, противоречащий интуиции

Разметка в SEO-проекте — это **цикл диагностики, а не генерация**: «JSON-LD в шаблоне» — половина работы; вторая половина — контроль через Вебмастер (что поисковик принял), обход по счётчикам и переобход после правок. Красивая разметка, которую поисковик не обходит, — невидимая разметка: диагностика API даёт ответ раньше, чем это увидит позиции SerpWatcher.

**Практический вывод для архитектора:** structured data — часть SEO-пайплайна с observability: генерация в шаблоне + диагностика (Вебмастер/Search Console API) + recrawl после изменений. Скрипты baseline/monitor — такой же контракт качества, как тесты: они превращают «разметка сломалась» в алерт за день, а не в просадку позиций за месяц.

---

## Антипаттерны

**1. Добавлять structured data не совпадающую с контентом**
```json
// ❌ Страница показывает цену 2990₽, в JSON-LD — 1990₽
// Manual action от Google, потеря rich results
{ "@type": "Product", "offers": { "price": "1990" } }
```

**2. Копировать schema одного типа на все страницы**
```json
// ❌ На /blog/post → Product schema скопирована с главной
// Google видит несоответствие типа и контента
```

**3. Несколько плагинов генерирующих Organization**
Centralize: один источник structured data. Выключить все плагины кроме одного или генерировать программно в шаблоне.

**4. FAQPage для коммерческих запросов**
```json
// ❌ FAQPage на странице /buy/product — коммерческий интент
// Google не показывает FAQ для явно коммерческих страниц
// ✅ FAQPage только для информационных страниц
```

**5. Пропускать @id для сущностей**
Каждый экземпляр организации, автора, продукта — анонимная сущность без связей. Google строит граф сложнее. `@id` — всегда.

**6. `aggregateRating` без реальных отзывов**
Google проверяет соответствие: разметка с ratingValue + reviewCount, но на странице нет видимых отзывов → penalty. `aggregateRating` только если на странице есть настоящие отзывы.

---

## Anti-checklist ☠️

- [ ] JSON-LD без валидации — Google игнорирует неверную разметку молча
- [ ] Один тип schema для всех страниц — Article для страницы товара теряет цену
- [ ] Схема без актуальных данных — указать цену и не обновлять при изменении
- [ ] @id без абсолютных URL — `/product/123` не является canonical ID
- [ ] Пропускать required поля — Google требует их для rich results
- [ ] Тестировать только через Google Rich Results Test — Search Console даёт реальную картину

## Задачи AI-кодеру

**Плохая формулировка:**
> «Добавь Schema.org разметку»

**Хорошая формулировка:**
> «Для страниц блога добавить два JSON-LD блока:
> 1. BreadcrumbList с позициями Home → Blog → {post.title}. URL из `Astro.site`.
> 2. BlogPosting: headline (post.data.title), image (post.data.cover), datePublished/dateModified (ISO 8601 с timezone), author[@type Person, @id, name, url], publisher[@id "/#organization" без дублирования полного объекта].
> @id для Article: `${siteUrl}${post.url}#article`. @id для Person: `${siteUrl}/authors/${author.slug}#person`.
> `<script type="application/ld+json" set:html={JSON.stringify(schema)} />`
> Организация определена один раз в BaseLayout.»

Формула: BreadcrumbList + BlogPosting (ISO-даты, @id-граф, publisher по @id без дублей) + set:html + Organization в базовом шаблоне.

---

**Плохая формулировка:**
> «Добавь Product schema для WooCommerce товаров»

**Хорошая формулировка:**
> «JSON-LD Product schema из WooCommerce REST API данных:
> Обязательные поля: name, image (массив), sku, offers.price, offers.priceCurrency (RUB), offers.priceValidUntil (конец текущего года), offers.availability (InStock/OutOfStock → schema.org URI), offers.itemCondition (NewCondition).
> aggregateRating только если product.rating_count > 0.
> brand.name из product.brands[0].name если есть.
> @id: `https://example.com/product/${product.slug}#product`.
> priceValidUntil: `new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]`.»

Формула: required-поля Product/Offer + данные из WooCommerce REST API + aggregateRating только при отзывах + @id + priceValidUntil.

---

## Чеклист архитектора

**Архитектура**
- [ ] Один источник JSON-LD генерации (не несколько плагинов)
- [ ] `@id` URI определены для всех ключевых сущностей (Organization, Person, Product)
- [ ] Organization определена в базовом шаблоне один раз с `sameAs`
- [ ] Страницы ссылаются на Organization через `@id`, не дублируют объект

**Типы по разделам**
- [ ] BreadcrumbList — на всех внутренних страницах
- [ ] Article/BlogPosting — все публикации
- [ ] Product + Offer — все товарные страницы (priceValidUntil!)
- [ ] FAQPage — только информационные страницы, не коммерческие
- [ ] LocalBusiness — если физическая точка

**Качество данных**
- [ ] Даты в ISO 8601 с timezone
- [ ] Цены в JSON-LD совпадают с отображаемыми на странице
- [ ] aggregateRating только если реальные отзывы видны на странице
- [ ] headline ≤ 110 символов для Google Discover

**Валидация**
- [ ] Rich Results Test — перед деплоем новых типов
- [ ] JSON.parse validation в CI (невалидный JSON тихо игнорируется)
- [ ] Google Search Console → Enhancements — мониторинг ошибок
- [ ] Нет конфликтующих блоков для одной сущности на странице

---

*Модуль 30 завершён.*
*Следующий: [Модуль 31 — Mobile-First CSS](../31-mobile-first-css/README.md)*
