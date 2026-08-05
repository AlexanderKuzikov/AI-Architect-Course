# Модуль 35 — Image optimization pipeline

> **Для AI-архитектора:** оптимизация изображений — не разовая операция «сжать и забыть». Это pipeline: формат (AVIF/WebP), размер (responsive srcset), качество (perceptual vs байты), доставка (CDN + Cache-Control). Архитектурный вопрос: где оптимизация происходит — build-time (статика), upload-time (user content) или on-the-fly (image CDN). Каждый вариант — свои trade-offs по сложности, стоимости и cache hit rate.
> Один день изучения — AVIF/WebP 2026, Sharp pipeline, responsive images, placeholder стратегии, image CDN vs self-hosted, LCP-специфичная оптимизация.

---

## Содержание

1. [Форматы 2026: AVIF vs WebP vs JPEG](#1-форматы)
2. [Sharp pipeline](#2-sharp)
3. [Responsive images](#3-responsive)
4. [Placeholder стратегии](#4-placeholder)
5. [Build-time vs upload-time vs on-the-fly](#5-архитектура-pipeline)
6. [LCP image оптимизация](#6-lcp)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| sharp | **0.34.x** | Node.js image processing |
| @squoosh/lib | заморожен | CLI инструмент, не для production pipeline |
| vite-imagetools | **7.x** | Vite plugin: трансформации при import |
| Cloudflare Images | актуален | Image CDN + трансформации |
| Imgix | актуален | Image CDN + URL-based трансформации |

---

## 1. Форматы

### Матрица выбора формата 2026

| Формат | vs JPEG | Поддержка | Декодирование | Лучший для |
| :-- | :-- | :-- | :-- | :-- |
| **AVIF** | −45–60% | ~95% (Chrome 85+, FF 93+, Safari 16+) | Медленнее | Hero photos, продуктовые фото |
| **WebP** | −25–35% | ~99% | Быстрое | UI, иконки, иллюстрации |
| **JPEG** | baseline | 100% | Очень быстрое | Fallback для legacy |
| **PNG** | +0% (lossless) | 100% | Быстрое | Прозрачность, скриншоты |
| **JPEG XL** | −40–60% | <50% (2026) | Среднее | Архивное хранение, не web |
| **SVG** | N/A (vector) | 100% | N/A | Иконки, логотипы, диаграммы |

> AVIF в 2026 — primary формат для фотографий. WebP — fallback. JPEG — fallback для legacy. 
>
> JPEG XL: Safari поддерживает, Chrome — нет (2026). Слишком рано для production web. 

### Когда что использовать

```
Фотографии, hero images, продукты:
  → AVIF (primary) + WebP (fallback) + JPEG (legacy fallback)

UI элементы, иллюстрации без прозрачности:
  → WebP (primary) + PNG (fallback)

Иконки, логотипы:
  → SVG (всегда, если возможно) → WebP/PNG fallback для растровых

Анимации:
  → WebP animated (primary) + AVIF animated → GIF только как fallback
  → Лучше: CSS animation или video (mp4/webm) для сложных анимаций

Прозрачность:
  → AVIF (alpha support) + WebP (alpha) + PNG (fallback)
```

---

## 2. Sharp

### Базовый pipeline: resize + multi-format

```typescript
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

interface OutputVariant {
  width: number
  suffix: string
}

const VARIANTS: OutputVariant[] = [
  { width: 400,  suffix: '400w' },
  { width: 800,  suffix: '800w' },
  { width: 1200, suffix: '1200w' },
  { width: 1920, suffix: '1920w' },
]

async function optimizeImage(
  inputPath: string,
  outputDir: string
): Promise<void> {
  const name = path.basename(inputPath, path.extname(inputPath))
  await fs.mkdir(outputDir, { recursive: true })

  for (const variant of VARIANTS) {
    const base = sharp(inputPath).resize(variant.width, null, {
      withoutEnlargement: true,  // не увеличивать если оригинал меньше
      fit: 'inside',
    })

    // AVIF: агрессивная компрессия, effort=6 — баланс скорость/размер
    await base.clone()
      .avif({ quality: 60, effort: 6 })
      .toFile(path.join(outputDir, `${name}-${variant.suffix}.avif`))

    // WebP: fallback
    await base.clone()
      .webp({ quality: 80 })
      .toFile(path.join(outputDir, `${name}-${variant.suffix}.webp`))

    // JPEG: legacy fallback
    await base.clone()
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toFile(path.join(outputDir, `${name}-${variant.suffix}.jpg`))
  }
}
```

### Upload pipeline (user content)

```typescript
// Обработка user uploads: rotate по EXIF + sanitize + multi-format

async function processUpload(
  inputBuffer: Buffer
): Promise<{ avif: Buffer; webp: Buffer; thumbnail: Buffer }> {
  // .rotate() без аргументов — auto-rotate по EXIF
  // Без этого portrait фото от iOS выглядят как landscape
  const image = sharp(inputBuffer)
    .rotate()
    .resize(1920, 1920, {
      fit: 'inside',
      withoutEnlargement: true,
    })

  const [avif, webp, thumbnail] = await Promise.all([
    image.clone().avif({ quality: 60, effort: 6 }).toBuffer(),
    image.clone().webp({ quality: 80 }).toBuffer(),
    image.clone()
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer(),
  ])

  return { avif, webp, thumbnail }
}
```

### Blur placeholder (LQIP)

```typescript
// Low Quality Image Placeholder — inline Base64 для немедленного показа
// Пока грузится полное изображение → нет layout shift, есть визуальный preview

async function generateLQIP(inputPath: string): Promise<string> {
  const buffer = await sharp(inputPath)
    .resize(20, 20, { fit: 'inside' })  // tiny: 20px
    .blur(2)
    .webp({ quality: 20 })
    .toBuffer()

  return `data:image/webp;base64,${buffer.toString('base64')}`
  // Размер: ~200-400 bytes — можно inline в HTML/JS
}

// Использование в генераторе статики:
// const lqip = await generateLQIP('./src/images/hero.jpg')
// <img src="hero.avif" style="background-image: url(${lqip})" ...>
```

### Граничные случаи — где ломается

**AVIF `effort` vs build time**: `effort: 9` на 1000 изображений — может занимать 30+ минут. В CI/CD — использовать `effort: 4-6`, `effort: 9` только для offline batch обработки. Sharp 0.34.x обрабатывает AVIF в 25x быстрее чем squoosh-cli. 

**`withoutEnlargement: true` и srcset**: если оригинал 600px, запрос на 1200px вариант → Sharp вернёт 600px файл с именем `image-1200w.avif`. Нужно либо проверять output metadata, либо не генерировать variants больше оригинала.

**sharp и serverless**: sharp использует native binaries (libvips). В AWS Lambda, Vercel Functions — требует platform-specific binary. Sharp 0.34.x поддерживает `sharp-linux-x64`, `sharp-linux-arm64` как отдельные пакеты. Docker: явно указывать platform. 

**Почему это важно архитектору:** sharp нельзя просто импортировать в serverless функцию без конфигурации платформы. Архитектурное решение — обрабатывать изображения при upload в отдельном сервисе/worker, не inline в request handler.

---

## 3. Responsive images

### Полный `<picture>` с AVIF + WebP + JPEG

```html
<!-- Приоритет source: AVIF → WebP → JPEG
     Браузер берёт первый поддерживаемый формат -->
<picture>
  <source
    type="image/avif"
    srcset="
      /images/hero-400w.avif  400w,
      /images/hero-800w.avif  800w,
      /images/hero-1200w.avif 1200w,
      /images/hero-1920w.avif 1920w
    "
    sizes="
      (max-width: 600px)  100vw,
      (max-width: 1200px) 80vw,
      1200px
    "
  >
  <source
    type="image/webp"
    srcset="
      /images/hero-400w.webp  400w,
      /images/hero-800w.webp  800w,
      /images/hero-1200w.webp 1200w,
      /images/hero-1920w.webp 1920w
    "
    sizes="
      (max-width: 600px)  100vw,
      (max-width: 1200px) 80vw,
      1200px
    "
  >
  <img
    src="/images/hero-800w.jpg"
    srcset="
      /images/hero-400w.jpg  400w,
      /images/hero-800w.jpg  800w,
      /images/hero-1200w.jpg 1200w
    "
    sizes="
      (max-width: 600px)  100vw,
      (max-width: 1200px) 80vw,
      1200px
    "
    alt="Hero description"
    width="1200"
    height="630"
    loading="eager"
    fetchpriority="high"
    decoding="sync"
  >
</picture>
```

### `sizes` атрибут — частые ошибки

```html
<!-- ❌ sizes="100vw" для всех изображений — браузер скачивает
     максимальный вариант для каждого viewport, игнорируя layout -->
<img srcset="img-400w.jpg 400w, img-800w.jpg 800w" sizes="100vw">

<!-- ✅ Описать реальный layout: сколько места занимает изображение -->

<!-- Карточка в grid: 3 колонки на desktop, 1 на mobile -->
<img
  srcset="card-400w.jpg 400w, card-800w.jpg 800w"
  sizes="
    (max-width: 640px)  calc(100vw - 32px),
    (max-width: 1024px) calc(50vw - 24px),
    calc(33vw - 20px)
  "
  ...
>

<!-- Инструменты для расчёта sizes: -->
<!-- https://ausi.github.io/respimagelint/ — lint srcset/sizes -->
<!-- Chrome DevTools → Network → Img element → sizes suggestion -->
```

---

## 4. Placeholder стратегии

### Сравнение подходов

```
LQIP (Low Quality Image Placeholder):
  Что: tiny base64 image (20px, blur)
  Размер: ~200-500 bytes
  CLS: нет (реальные размеры изображения)
  UX: blur-to-sharp переход
  Когда: hero images, above-fold content

Dominant color placeholder:
  Что: один цвет из изображения
  Размер: ~50 bytes (CSS color)
  CLS: нет (размеры заданы)
  UX: мгновенный, нет "blur" артефактов
  Когда: галереи, product listings — много изображений

Skeleton:
  Что: CSS shimmer animation
  Размер: ~0 (pure CSS)
  CLS: нет (размеры заданы)
  UX: нейтральный
  Когда: карточки, списки где нет заранее известного контента

Aspect-ratio box (без placeholder):
  Что: div с фиксированным aspect-ratio
  Размер: 0
  CLS: нет (aspect-ratio CSS)
  UX: пустое место
  Когда: SSG где CLS уже решён через width/height
```

### Dominant color через Sharp

```typescript
// Быстро: Sharp stats() возвращает channel statistics

async function getDominantColor(inputPath: string): Promise<string> {
  const { dominant } = await sharp(inputPath)
    .resize(1, 1)  // resize до 1x1 = dominant color
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ info }) => {
      // Альтернатива через stats:
      return sharp(inputPath).stats()
    })

  const { r, g, b } = dominant
  return `rgb(${r},${g},${b})`
}

// Использование в HTML:
// <img style="background-color: rgb(23,45,67)" src="...">
```

### Граничные случаи — где ломается

**LQIP и SSR hydration**: если LQIP генерируется в Node.js при build → inline в HTML → клиент получает сразу. Если LQIP генерируется lazy на клиенте — нет смысла (изображение уже начало грузиться). Только build-time LQIP имеет смысл.

**Blur placeholder и Safari**: CSS `backdrop-filter: blur()` и `filter: blur()` на `<img>` с base64 src работает по-разному в Safari < 17. Проверять визуально.

---

## 5. Архитектура pipeline

### Три модели

```
1. Build-time (статический сайт):
   Исходники → Sharp при build → dist/images/*.avif,*.webp,*.jpg

   Плюсы: нет runtime overhead, максимальная оптимизация
   Минусы: медленный build при большом количестве изображений
   Когда: SSG (Astro, 11ty, Hugo), фиксированный контент

2. Upload-time (user content):
   Upload → Worker/Queue → Sharp → S3/R2 → CDN

   Плюсы: обработка один раз, CDN кеш, не блокирует request
   Минусы: задержка перед доступностью (секунды)
   Когда: SaaS, e-commerce с user uploads

3. On-the-fly (image CDN):
   Request → CDN edge (Cloudflare Images, Imgix) → transform → cache

   Плюсы: нет собственной инфраструктуры, URL-based API
   Минусы: vendor lock-in, стоимость per-transform
   Когда: большой медиа-архив, частые изменения размеров
```

### Upload-time pipeline (Node.js + S3-compatible)

```typescript
import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: process.env.AWS_REGION! })

async function processAndStoreImage(
  buffer: Buffer,
  originalName: string,
  objectKey: string  // base path: 'products/abc123'
): Promise<{ avifKey: string; webpKey: string; thumbKey: string }> {
  const image = sharp(buffer).rotate()

  const [avifBuf, webpBuf, thumbBuf] = await Promise.all([
    image.clone()
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 60, effort: 6 })
      .toBuffer(),
    image.clone()
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    image.clone()
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer(),
  ])

  const uploads = [
    { key: `${objectKey}.avif`, buf: avifBuf, type: 'image/avif' },
    { key: `${objectKey}.webp`, buf: webpBuf, type: 'image/webp' },
    { key: `${objectKey}-thumb.webp`, buf: thumbBuf, type: 'image/webp' },
  ]

  await Promise.all(
    uploads.map(({ key, buf, type }) =>
      s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: buf,
        ContentType: type,
        CacheControl: 'public, max-age=31536000, immutable',
      }))
    )
  )

  return {
    avifKey:  uploads[0].key,
    webpKey:  uploads[1].key,
    thumbKey: uploads[2].key,
  }
}
```

### Граничные случаи — где ломается

**Build-time и CI timeout**: 500 изображений × 4 формата × 4 размера = 8000 операций Sharp. Даже на fast CI — 5-10 минут. Решения: кешировать по hash оригинала (только регенерировать изменившиеся), или перейти на on-the-fly для архивов > 1000 изображений.

**Upload-time и синхронный ответ**: если Sharp inline в HTTP handler → таймаут при большом файле. Обязателен async worker: upload → очередь (BullMQ, SQS) → worker обрабатывает → webhook/polling для статуса.

**Почему это важно архитектору:** выбор модели pipeline определяет scalability. E-commerce с 100K product images — build-time нереален. Медиа-платформа с user uploads — on-the-fly CDN бьёт по бюджету при пиковой нагрузке. Гибридный вариант: upload-time Sharp для стандартных форматов + on-the-fly CDN только для кастомных crop/resize запросов.

---

## 6. LCP

### Полный чеклист LCP image

```html
<!-- В <head>: preload LCP image ДО любых скриптов -->
<link
  rel="preload"
  as="image"
  href="/images/hero-1200w.avif"
  imagesrcset="
    /images/hero-400w.avif  400w,
    /images/hero-800w.avif  800w,
    /images/hero-1200w.avif 1200w
  "
  imagesizes="(max-width: 600px) 100vw, 1200px"
  fetchpriority="high"
>

<!-- В body: LCP <img> -->
<img
  src="/images/hero-1200w.jpg"
  srcset="..."
  sizes="..."
  alt="..."
  width="1200"
  height="630"
  loading="eager"
  fetchpriority="high"
  decoding="sync"   <!-- sync: decode до следующего frame для LCP -->
>
```

### LCP и CSS background images

```css
/* CSS background не участвует в browser preload scanner */
/* Это само по себе задержка ~500ms для LCP */

/* ❌ LCP элемент как CSS background */
.hero {
  background-image: url('/hero.jpg');
  height: 600px;
}

/* ✅ <img> внутри контейнера с object-fit */
.hero {
  position: relative;
  height: 600px;
}
.hero img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Граничные случаи — где ломается

**`imagesrcset` на `<link rel="preload">`**: атрибут именно `imagesrcset` (не `srcset`) и `imagesizes` (не `sizes`). Без них браузер preload-ит только `href` — фиксированный размер без учёта viewport.

**AVIF для LCP и старые iOS**: iOS 16 поддерживает AVIF, iOS 15 — нет. На iPad mini 4 (iOS 15) hero image упадёт на WebP. Проверять через BrowserStack / CrUX breakdown по браузерам аудитории.

**Почему это важно архитектору:** LCP image неправильно настроенный даёт penalty 0.5–1.5s в CrUX. `fetchpriority="high"` без `<link rel="preload">` работает, но preload даёт дополнительные 100–300ms на fast connections потому что браузер начинает fetch до полного парсинга HTML.

---

## 7. Реальный кейс: Sharp-пайплайн в двух системах

### Контекст

Один и тот же Sharp-пайплайн живёт в двух местах: PDF/VLM-конвейер (PDFtoText: рендер страниц → resize перед VLM, модуль 10/16) и веб-каталог (WooCommerce: изображения товаров из 1С). Разные задачи — одно правило: изображения в VLM и в браузер уходят только после resize.

### Задача

- VLM-конвейер: не отправлять в модель 3000×4000px фото ценника (tile-тарификация облачных API — 24× стоимость, модуль 10/11);
- каталог: не отдавать клиенту 4000px фото товара (10 МБ) при карточке в 400px.

### Гипотеза

Единый модуль оптимизации: resize по задаче (1000px для VLM, srcset-набор для браузера), WebP quality 85, `fit: inside` + `withoutEnlargement` (модуль 11 §5).

### Что получилось

```typescript
// Один модуль на обе системы (из модуля 11 §5, реальный код)
const pipeline = sharp(inputPath)
  .resize(maxDimension, maxDimension, {
    fit: 'inside',          // ✅ пропорции, без кропа
    withoutEnlargement: true, // ✅ маленькие не увеличиваем
  })

// VLM: 1000px, WebP 85 → base64 в запрос
// Каталог: srcset 400/800/1200w → AVIF primary, WebP fallback
```

- VLM-конвейер: фото ценников 1000px вместо 3000px — tile-стоимость падает в разы, качество детекции текста не изменилось (проверено на выборке, модуль 21 — golden-подход);
- каталог: srcset по ширинам, `sizes` из сетки — мобильный отдаёт 400w, desktop 800w; AVIF + WebP fallback;
- форматы и качество — параметры функции, а не «настройки на сайте»: одна правка меняет оба конвейера.

### Грабли, найденные в production

1. **`withoutEnlargement` забыли** — маленькие фото товаров (иконки из 1С) «растягивались» до 1000px: мыло. Опция стоит по умолчанию.
2. **Фото 1С бывают в CMYK/JPG с профилем** — Sharp по умолчанию не конвертит профиль: зелёные лица на каталоге. `withMetadata()` и конвертация в sRGB — часть пайплайна.
3. **Качество 85 для каталога, 80 для VLM** — VLM-конвейеру сжатие важнее (токены), каталогу — вид. Один параметр `quality` на вызов, не на систему.

### Вывод, противоречащий интуиции

Оптимизация изображений — это **контракт размеров** (что и куда уходит), а не «сжать картинку»: VLM-конвейер сэкономил стоимость (tile-тарификация), каталог — трафик, причём одним и тем же модулем. Правка в одном месте меняла оба мира — пайплайн оказался важнее, чем «оптимизация изображений» как отдельная дисциплина.

**Практический вывод для архитектора:** изображения — пограничный ресурс между системами (VLM-тарификация, браузерный трафик, CLS/LCP). Единый модуль оптимизации с явными параметрами (maxDimension, quality, format, fit) — инвестиция, окупающаяся в каждой системе, где изображение пересекает границу.

---

## Антипаттерны

**1. AVIF без fallback**
```html
<!-- ❌ iOS 15, Edge старые версии не поддерживают AVIF -->
<img src="hero.avif" alt="Hero">

<!-- ✅ <picture> с AVIF primary + WebP fallback -->
<picture>
  <source type="image/avif" srcset="hero.avif">
  <img src="hero.webp" alt="Hero">
</picture>
```

**2. Неправильный `sizes`**
```html
<!-- ❌ Браузер скачивает 1920px для карточки 300px -->
<img srcset="card-300w.jpg 300w, card-600w.jpg 600w, card-1200w.jpg 1200w"
     sizes="100vw">

<!-- ✅ Реальный размер карточки в layout -->
<img ... sizes="(max-width: 640px) 100vw, 33vw">
```

**3. Sharp inline в request handler**
```typescript
// ❌ Блокирует event loop, таймаут при большом файле
app.post('/upload', async (req, res) => {
  const result = await sharp(req.body).avif().toBuffer()
  res.json({ url: await upload(result) })
})

// ✅ Queue → Worker
app.post('/upload', async (req, res) => {
  const jobId = await queue.add('processImage', { buffer: req.body })
  res.json({ jobId, status: 'processing' })
})
```

**4. LCP image как CSS background**
Браузер preload scanner не видит CSS background → LCP image грузится после CSS парсинга. Всегда `<img>` + `object-fit: cover` для LCP.

**5. Генерировать sizes больше оригинала**
Sharp с `withoutEnlargement: false` (default!) увеличит изображение до 1920px если оригинал 400px. Всегда `withoutEnlargement: true`.

**6. Игнорировать `effort` для AVIF в CI**
`effort: 9` — production максимум. В CI pipeline: `effort: 4` достаточно, 3x быстрее. Разница в размере файла — 5-10%.

---

## Anti-checklist ☠️

- [ ] JPEG вместо WebP/AVIF для фотографий — 30-50% лишнего размера
- [ ] PNG для сложных фотографий — в 5-10× больше WebP
- [ ] Один breakpoint для всех изображений — мобильные платят за десктопные размеры
- [ ] `width: 100%` без `max-width` — изображение растягивается на весь контейнер
- [ ] Sharp resize без `withoutEnlargement: true` — маленькие изображения размываются
- [ ] srcset с неправильными размерами — браузер выбирает неоптимальный вариант
- [ ] Игнорировать aspect ratio в build pipeline — фото в portrait превращаются в квадрат

## Задачи AI-кодеру

**Плохая формулировка:**
> «Оптимизируй изображения на сайте»

**Хорошая формулировка:**
> «Написать Node.js скрипт `scripts/optimize-images.ts`:
> 1. Сканировать `src/assets/images/**/*.{jpg,png}` рекурсивно.
> 2. Для каждого изображения генерировать через sharp@0.34.x: AVIF (quality: 60, effort: 6), WebP (quality: 80), JPEG (quality: 85, mozjpeg: true) — для каждого из размеров: 400, 800, 1200px ширины с `withoutEnlargement: true`.
> 3. Пропускать если output уже существует И оригинал не изменился (сравнить mtime).
> 4. Сохранять в `public/images/{name}-{width}w.{ext}`.
> 5. Генерировать `src/assets/images/manifest.json` с путями для каждого оригинала.»

Формула: sharp-пайплайн (AVIF/WebP/JPEG + качество + метаданные) + srcset/sizes + manifest.

---

**Плохая формулировка:**
> «Добавь AVIF поддержку для product images»

**Хорошая формулировка:**
> «В компоненте `ProductImage.tsx`:
> 1. Заменить `<img src={image.url}>` на `<picture>` с тремя `<source>`: `type="image/avif"`, `type="image/webp"`, fallback `<img>` JPEG.
> 2. `srcset` для каждого формата: 400w, 800w из `image.avif400`, `image.avif800` свойств (предполагаем что pipeline уже генерирует эти URL).
> 3. `sizes`: `(max-width: 640px) calc(100vw - 32px), 400px` (карточка 400px на desktop).
> 4. `loading="lazy" decoding="async" width={400} height={400}`.
> 5. `style={{ backgroundColor: image.dominantColor }}` для placeholder пока грузится.»

Формула: AVIF-конвертация + picture-теги + dominantColor placeholder + без CLS.

---

## Чеклист архитектора

**Форматы**
- [ ] AVIF для фотографий + WebP fallback + JPEG legacy fallback
- [ ] `<picture>` с type-based source selection, не только srcset
- [ ] SVG для иконок и логотипов — не растровые форматы

**Sharp pipeline**
- [ ] `.rotate()` без аргументов для auto EXIF rotation (user uploads)
- [ ] `withoutEnlargement: true` — не увеличивать маленькие оригиналы
- [ ] AVIF: `quality: 60, effort: 4-6` (не effort: 9 в CI)
- [ ] Параллельная обработка форматов через `Promise.all`

**Responsive images**
- [ ] `sizes` атрибут отражает реальный layout (не `100vw`)
- [ ] width/height на всех `<img>` для предотвращения CLS
- [ ] Варианты: минимум 400w, 800w, 1200w

**Placeholder**
- [ ] Dominant color или LQIP для above-fold изображений
- [ ] Aspect-ratio box или явные width/height для below-fold

**LCP**
- [ ] `<link rel="preload" imagesrcset imagesizes>` в head
- [ ] `loading="eager" fetchpriority="high" decoding="sync"`
- [ ] LCP element — `<img>`, не CSS background

**Architecture**
- [ ] Выбор pipeline: build-time / upload-time / on-the-fly обоснован
- [ ] Sharp не inline в HTTP handler — только Worker/Queue
- [ ] `Cache-Control: immutable` для хешированных image URLs на CDN

---

*Модуль 35 завершён.*
*Следующий: [Модуль 36 — Critical rendering path и CSS optimization](../36-critical-rendering-path/README.md)*
