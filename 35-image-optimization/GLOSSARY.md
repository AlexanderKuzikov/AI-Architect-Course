# GLOSSARY — Image optimization pipeline

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**AVIF (AV1 Image File Format)**  
Формат изображений основанный на AV1 video codec. 45–60% меньше JPEG при том же визуальном качестве. Поддерживает HDR (10-bit/12-bit), прозрачность, анимацию. Browser support ~95% в 2026. Primary формат для фотографий.

---

## D

**decoding="sync"**  
Атрибут `<img>`: декодирование изображения блокирует следующий рендер frame. Использовать только для LCP image — гарантирует что изображение декодировано ДО первого composite. Для всех остальных: `decoding="async"`.

**dominant color placeholder**  
Техника placeholder: один цвет извлечённый из изображения через resize до 1×1 пикселя. Показывается как `background-color` до загрузки полного изображения. ~50 bytes CSS. Эффективнее LQIP при большом количестве изображений (галереи).

---

## E

**effort (AVIF)**  
Параметр Sharp: уровень усилий кодирования AVIF (0–9). Выше = меньше файл + медленнее кодирование. `effort: 6` — production баланс. `effort: 9` — offline batch. `effort: 4` — CI pipeline для скорости.

---

## F

**fetchpriority**  
HTML атрибут: явная приоритизация загрузки ресурса. `high` — для LCP image и critical preloads. `low` — для prefetch. Без атрибута браузер определяет приоритет эвристически.

---

## I

**imagesrcset / imagesizes**  
Атрибуты `<link rel="preload" as="image">`: позволяют preload responsive image с учётом srcset и sizes. Отличие от обычного `srcset`/`sizes`: используются только на preload link элементе.

---

## J

**JPEG XL (JXL)**  
Новый формат с ~40–60% преимуществом над JPEG. Safari поддерживает с 2022, Chrome — нет (2026). Рекомендуется только для архивного хранения и high-end photography. Не использовать для web delivery в 2026.

---

## L

**LQIP (Low Quality Image Placeholder)**  
Low Quality Image Placeholder: tiny (20px) версия изображения с blur, закодированная в Base64 (~200–500 bytes). Inline в HTML. Показывается мгновенно, заменяется полным изображением при загрузке. Blur-to-sharp эффект.

**libvips**  
C библиотека для обработки изображений. Основа Sharp. Обрабатывает изображения потоково без полной загрузки в память. 4–5x быстрее ImageMagick.

---

## M

**mozjpeg**  
Оптимизированный JPEG encoder от Mozilla. Sharp параметр `{ mozjpeg: true }`. 10–15% меньше размер файла vs стандартный libjpeg при том же качестве. Рекомендуется для всех JPEG output.

---

## O

**on-the-fly transformation**  
Архитектурная модель image pipeline: изображения трансформируются при первом запросе на CDN edge, затем кешируются. Инструменты: Cloudflare Images, Imgix. Нет предварительной обработки, но стоимость per-transform запроса.

---

## P

**progressive JPEG**  
JPEG режим: изображение загружается постепенно от низкого качества к высокому (vs baseline JPEG — сверху вниз). `{ progressive: true }` в Sharp. Лучший UX при медленных соединениях.

---

## S

**sizes**  
HTML атрибут `<img>` и `<source>`: описывает ширину изображения в layout для разных viewport breakpoints. Браузер использует для выбора варианта из srcset. Критично: должен отражать реальный layout, не `100vw`.

**srcset**  
HTML атрибут `<img>`: список image candidates с указанием ширины (`400w`) или pixel density (`2x`). Браузер выбирает оптимальный вариант с учётом viewport, DPR и sizes.

---

## W

**WebP**  
Формат Google основанный на VP8 codec. 25–35% меньше JPEG. ~99% browser support. Поддерживает прозрачность и анимацию. Recommended fallback для AVIF. Быстрее декодируется на low-power devices чем AVIF.

**withoutEnlargement**  
Sharp параметр `.resize()`: `true` — не увеличивать изображение если оригинал меньше запрошенного размера. Default `false`. Без этого параметра Sharp interpolate маленький оригинал → артефакты + больший файл.

---

*Глоссарий модуля 35. Следующий: [Модуль 36 — Critical rendering path и CSS optimization](../36-critical-rendering-path/GLOSSARY.md)*
