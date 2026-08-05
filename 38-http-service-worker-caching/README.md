# Модуль 38 — HTTP / Service Worker caching

> **Для AI-архитектора:** кеширование — не «добавить Cache-Control: max-age». Это трёхуровневая система: браузерный кеш (HTTP headers), edge кеш (CDN), application-level (SW). Каждый уровень решает разную задачу. Архитектурный вопрос: как инвалидировать кеш при деплое, и как не отдавать stale данные пользователям при этом? Главная ловушка: cache `max-age=31536000` на HTML без hash в URL → пользователь видит старый сайт после деплоя.
> Один день изучения — HTTP Cache-Control директивы, ETag/Last-Modified, CDN кеширование, Service Worker стратегии с Workbox 7, cache invalidation при деплое.

---

## Содержание

1. [HTTP Cache-Control — полная механика](#1-http-cache-control)
2. [ETag и условные запросы](#2-etag)
3. [CDN кеширование](#3-cdn)
4. [Service Worker стратегии](#4-service-worker)
5. [Workbox 7 — production конфиг](#5-workbox)
6. [Cache invalidation при деплое](#6-invalidation)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент / API | Версия | Статус |
| :-- | :-- | :-- |
| Workbox | **7.4.1** | Текущий |
| vite-plugin-pwa | **1.3.0** | Vite интеграция Workbox |
| `stale-while-revalidate` | RFC 5861 | Полная поддержка браузеров + CDN |
| `stale-if-error` | RFC 5861 | CDN (Cloudflare, Fastly, Nginx) |
| `CDN-Cache-Control` | Cloudflare | Edge-specific директивы |

---

## 1. HTTP Cache-Control

### Полная карта директив

```
Видимость кеша:
  public   — кешируют браузер + CDN/proxy
  private  — только браузер (персональные данные)
  no-store — никогда не кешировать

Freshness:
  max-age=N              — свежий N секунд (браузер)
  s-maxage=N             — свежий N секунд (CDN/shared cache)
  stale-while-revalidate=N — отдавать stale пока фоново обновляется
  stale-if-error=N       — отдавать stale при ошибке origin (CDN)

Revalidation:
  must-revalidate        — нельзя отдавать stale без revalidation
  proxy-revalidate       — то же для CDN/proxy
  no-cache               — всегда revalidate перед отдачей (не "не кешировать"!)
  immutable              — никогда не revalidate (контент не изменится)
```

### Матрица: что ставить на что

```typescript
// Статические ассеты с хешем в имени: максимальный кеш
// main-abc123.js, styles-def456.css, hero-abc.avif
'Cache-Control: public, max-age=31536000, immutable'

// HTML страницы: не кешировать или очень короткий TTL
// HTML не имеет хеша — инвалидировать при деплое нельзя без CDN purge
'Cache-Control: no-cache'
// или
'Cache-Control: public, max-age=0, must-revalidate'

// API ответы — публичные данные (список продуктов):
'Cache-Control: public, max-age=60, stale-while-revalidate=3600'
// Свежий 60с; до 1 часа можно отдавать stale пока обновляется фоном

// API ответы — персональные данные (профиль, корзина):
'Cache-Control: private, max-age=0, must-revalidate'

// API ответы — с stale-if-error для resilience:
'Cache-Control: public, max-age=300, stale-if-error=86400'
// При ошибке origin — отдавать stale до 24 часов

// Service Worker файл:
'Cache-Control: no-cache'
// Браузер должен проверять SW обновления каждый раз
```

### stale-while-revalidate механика

```
Timeline для: Cache-Control: max-age=60, stale-while-revalidate=3600

0s      60s           3660s
│───fresh───│──stale (SWR)──│──stale (не отдавать)──
│            │               │
│  Отдаём    │  Отдаём STALE │  404 / fetch from origin
│  из кеша   │  + фоновый    │
│  мгновенно │  fetch → update кеш
│
Пользователь НИКОГДА не ждёт в окне 0-3660s
За исключением самого первого запроса
```

```typescript
// stale-while-revalidate на API уровне (Node.js/Express):
app.get('/api/products', (req, res) => {
  res.set(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=3600, stale-if-error=86400'
  )
  res.json(products)
})

// Cloudflare: stale-while-revalidate теперь полностью асинхронный
// Первый запрос после expiry → немедленный ответ stale +
// фоновый запрос к origin. 
```

### Граничные случаи — где ломается

**`no-cache` ≠ `no-store`**: `no-cache` = кешируй, но revalidate перед каждой отдачей. `no-store` = вообще не кешировать. Ошибка путать их: `no-cache` на персональных данных → данные кешируются в shared proxy → утечка.

**`immutable` и браузерный back button**: `immutable` означает «никогда не проверяй новую версию». Если файл с тем же именем обновился (нет хеша в URL) — пользователь получает старый контент forever. `immutable` только для файлов с hash в имени.

**Почему это важно архитектору:** `Cache-Control: no-cache` на HTML + `Cache-Control: immutable` на ассетах с хешем — стандартная стратегия. HTML всегда свежий (revalidate), ассеты кешируются вечно. При деплое: новые хеши в HTML → браузер скачивает новые ассеты.

---

## 2. ETag и условные запросы

### Механика revalidation

```
Первый запрос:
  → GET /api/data
  ← 200 OK, ETag: "abc123", Last-Modified: Wed, 01 Apr 2026 10:00:00 GMT

Повторный запрос (после max-age истёк):
  → GET /api/data
     If-None-Match: "abc123"
     If-Modified-Since: Wed, 01 Apr 2026 10:00:00 GMT
  ← 304 Not Modified (0 bytes body — только headers)
     или
  ← 200 OK (новые данные + новый ETag)
```

### Генерация ETag в Node.js

```typescript
import { createHash } from 'crypto'
import { Request, Response } from 'express'

// Weak ETag: быстро, на основе содержимого
function generateETag(content: string): string {
  const hash = createHash('md5')
    .update(content)
    .digest('hex')
    .slice(0, 16)
  return `W/"${hash}"`  // W/ = weak ETag
}

// Strong ETag: для byte-range requests (video, large files)
function generateStrongETag(content: Buffer): string {
  return `"${createHash('sha1').update(content).digest('hex').slice(0, 20)}"`
}

// Middleware для conditional requests
function conditionalGet(req: Request, res: Response, content: string) {
  const etag = generateETag(content)

  res.set('ETag', etag)
  res.set('Cache-Control', 'public, max-age=0, must-revalidate')

  // Если клиент имеет актуальную версию → 304 без тела
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return
  }

  res.json(JSON.parse(content))
}
```

### Граничные случаи — где ломается

**ETag за load balancer**: два инстанса генерируют разные ETag для одного контента (разный timestamp, process ID, random). Решение: детерминированный ETag на основе content hash, не timestamp.

**ETag с CDN**: CDN может стрипать ETag при compression (Content-Encoding: gzip). Cloudflare — сохраняет weak ETag. Nginx по умолчанию удаляет ETag при gzip. Явно включать: `gzip_vary on; etag on`.

---

## 3. CDN кеширование

### Cache-Control vs CDN-Cache-Control

```
Проблема: один заголовок управляет и браузером и CDN

Cloudflare решение: раздельные директивы

Cache-Control: public, max-age=60        ← браузер кеш: 1 минута
CDN-Cache-Control: max-age=3600          ← CDN кеш: 1 час
Cloudflare-CDN-Cache-Control: max-age=86400  ← только Cloudflare: 1 день

// Пример: персонализированный контент
// Браузер кеширует (private), CDN — нет

Cache-Control: private, max-age=300      ← браузер: 5 минут
CDN-Cache-Control: no-store             ← CDN: не кешировать
```

### Cloudflare — cache rules 2026

```typescript
// Cloudflare Cache Rules (через API или dashboard)
// Позволяют обойти/модифицировать Cache-Control от origin

// Пример конфигурации (Terraform / Cloudflare API):
{
  "rules": [
    {
      // Статические ассеты — максимальный cache независимо от origin
      "filter": "http.request.uri.path matches \"\\.(js|css|avif|webp|woff2)$\"",
      "action_parameters": {
        "cache": true,
        "edge_ttl": {
          "mode": "override_origin",
          "default": 31536000  // 1 год
        },
        "browser_ttl": {
          "mode": "override_origin",
          "default": 31536000
        }
      }
    },
    {
      // API — короткий edge TTL
      "filter": "http.request.uri.path starts_with \"/api/\"",
      "action_parameters": {
        "cache": true,
        "edge_ttl": {
          "mode": "override_origin",
          "default": 60
        }
      }
    }
  ]
}
```

### Cache Purge при деплое

```typescript
// Cloudflare — программный purge через API

async function purgeCloudflareCacheByTags(tags: string[]): Promise<void> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
    }
  )

  if (!response.ok) {
    throw new Error(`Cloudflare purge failed: ${response.status}`)
  }
}

// Использование: теги на ресурсах + purge по тегу при деплое
// Nginx: добавить Cache-Tag header на origin
// Cloudflare: кешировать тег → purge всего с тегом

// Более простой вариант: purge всё при деплое
async function purgeAllCache(): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.CF_API_TOKEN}` },
      body: JSON.stringify({ purge_everything: true }),
    }
  )
}
```

### Граничные случаи — где ломается

**`Vary` header и CDN**: `Vary: Accept-Encoding` — CDN кеширует отдельно gzip и non-gzip. `Vary: Cookie` — CDN не кеширует (каждый пользователь разный cookie). `Vary: Accept-Language` — CDN кеширует по языку. Cloudflare игнорирует `Vary: Cookie` для cache key по умолчанию. 

**stale-if-error и критичные данные**: `stale-if-error=86400` на API с финансовыми данными → при падении origin пользователи 24 часа видят устаревшие цены. Для критичных данных: `stale-if-error` с коротким TTL или не использовать.

**Почему это важно архитектору:** CDN cache hit rate напрямую влияет на расходы и latency. Cache hit rate < 80% = переплата за origin bandwidth. Правильная стратегия: HTML `no-cache` + ассеты `immutable` + API `stale-while-revalidate` = 95%+ hit rate при нулевых stale проблемах.

---

## 4. Service Worker стратегии

### Пять основных стратегий

```
1. Cache First (Offline First):
   SW → Cache → Network (если не в кеше)
   Когда: статические ассеты (JS, CSS, fonts, images)
   Риск: стale данные

2. Network First:
   SW → Network → Cache fallback (если offline)
   Когда: HTML страницы, API данные требующие freshness
   Риск: медленно при плохой сети

3. Stale While Revalidate:
   SW → Cache (мгновенно) + Network (фоново обновить кеш)
   Когда: часто меняющийся но не critical контент (аватары, listing)
   Баланс: speed vs freshness

4. Network Only:
   SW → Network (без кеша)
   Когда: POST/PUT/DELETE запросы, аналитика

5. Cache Only:
   SW → Cache (без network)
   Когда: precached критичные ассеты (offline shell)
```

### Lifecycle Service Worker

```typescript
// sw.ts — базовый lifecycle

const CACHE_VERSION = 'v2'  // Изменить при деплое → инвалидация

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // Precache: критичные ассеты загружаются при установке SW
      cache.addAll(['/offline.html', '/icons/app-192.png'])
    )
    .then(() => (self as ServiceWorkerGlobalScope).skipWaiting())
    // skipWaiting(): активировать новый SW без ожидания закрытия вкладок
  )
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    // Удалить старые кеши (старые версии CACHE_VERSION)
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_VERSION)
          .map(name => caches.delete(name))
      )
    )
    .then(() => (self as ServiceWorkerGlobalScope).clients.claim())
    // clients.claim(): взять контроль над всеми открытыми вкладками немедленно
  )
})
```

### Граничные случаи — где ломается

**skipWaiting + clients.claim() и BREAKING CHANGES**: если новый SW с `skipWaiting()` активируется пока старая страница ещё открыта — страница продолжает использовать старые ассеты но SW уже новый. При несовместимых API изменениях → runtime error. Решение: `skipWaiting()` только если изменения backwards-compatible, иначе ждать reload.

**SW и POST/PUT/DELETE**: fetch event перехватывает ВСЕ запросы. `Network Only` для mutations — обязательно, иначе SW может попытаться кешировать POST ответ.

**Почему это важно архитектору:** Service Worker регистрируется один раз на origin и живёт между сессиями. Баг в SW → сломанный сайт для всех пользователей до следующего деплоя. Обязателен offline fallback (`/offline.html`) и явная стратегия инвалидации.

---

## 5. Workbox 7

### Полный production конфиг

```typescript
// src/sw.ts — с Workbox 7 и vite-plugin-pwa
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
  NetworkOnly,
} from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { BackgroundSyncPlugin } from 'workbox-background-sync'

// Precache: Workbox injects manifest при build
// Все ассеты с хешем автоматически precached
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()  // Удалить устаревшие precache entries

// HTML навигация — Network First
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages',
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 86400 }),
      ],
    }),
    {
      // Исключить API routes из навигационного перехвата
      denylist: [/\/api\//],
    }
  )
)

// Изображения — Cache First (долгий срок)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 86400,  // 30 дней
        purgeOnQuotaError: true,    // удалять при нехватке места
      }),
    ],
  })
)

// API данные — Stale While Revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/public/'),
  new StaleWhileRevalidate({
    cacheName: 'api-public',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 3600 }),
    ],
  })
)

// Мутации — Network Only (никогда не кешировать)
registerRoute(
  ({ request }) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkOnly()
)

// Background Sync для offline mutations
const bgSyncPlugin = new BackgroundSyncPlugin('mutations-queue', {
  maxRetentionTime: 24 * 60,  // 24 часа
})

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') &&
    (request.method === 'POST' || request.method === 'PUT'),
  new NetworkOnly({ plugins: [bgSyncPlugin] })
)
```

### vite-plugin-pwa конфиг

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',  // автоматически обновлять SW
      // 'prompt': показывать пользователю кнопку "обновить"
      injectRegister: 'auto',

      workbox: {
        // Какие файлы precache (Workbox генерирует manifest)
        globPatterns: ['**/*.{js,css,html,ico,png,avif,webp,woff2}'],
        globIgnores: ['**/node_modules/**', '**/stats.html'],

        // SW файл не кешировать!
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // Дополнительные runtime правила
        ],
      },

      manifest: {
        name: 'App Name',
        short_name: 'App',
        theme_color: '#01696f',
        background_color: '#f7f6f2',
        display: 'standalone',
        icons: [
          { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
```

---

## 6. Cache invalidation при деплое

### Проблема: пользователи видят старый сайт

```
Сценарий:
  1. Деплой v2: новые JS/CSS файлы (новые хеши), тот же HTML
  2. Пользователь открывает страницу
  3. HTML кеширован → браузер отдаёт старый HTML
  4. Старый HTML ссылается на старые ассеты (с хешами v1)
  5. Ассеты с v1 хешами → в CDN кеше → отдаются
  6. Пользователь видит v1 несмотря на деплой v2

Решение: HTML должен ВСЕГДА быть свежим
  → Cache-Control: no-cache на HTML
  → CDN purge HTML при каждом деплое
```

### CI/CD pipeline с cache invalidation

```yaml
# .github/workflows/deploy.yml

jobs:
  deploy:
    steps:
      - name: Build
        run: npm run build
        # Vite генерирует хеши: main-abc123.js, styles-def456.css

      - name: Upload to S3 / R2
        run: |
          # Статические ассеты: immutable cache (хеш в имени = безопасно)
          aws s3 sync dist/ s3://$BUCKET \
            --exclude "*.html" \
            --cache-control "public, max-age=31536000, immutable"

          # HTML: no-cache (должен быть всегда свежим)
          aws s3 sync dist/ s3://$BUCKET \
            --include "*.html" \
            --cache-control "no-cache"

      - name: Purge Cloudflare HTML cache
        run: |
          # Purge только HTML — ассеты не нужно purge (у них новые URL с хешами)
          curl -X POST \
            "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -d '{"files":["https://example.com/","https://example.com/index.html"]}'
```

### SW версионирование

```typescript
// Стратегия: SW CACHE_VERSION = git commit hash
// При деплое → новый SW → install event → precache новые ассеты
// → activate → clients.claim() → пользователи переключились

// Инъекция версии через Vite:
// vite.config.ts:
define: {
  __CACHE_VERSION__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 8) || 'dev')
}

// sw.ts:
declare const __CACHE_VERSION__: string
const CACHE_VERSION = __CACHE_VERSION__
```

---

## Антипаттерны

**1. `Cache-Control: max-age=31536000` на HTML**
```
❌ HTML кеширован на год без hash в URL
   Деплой → пользователи видят старый сайт 1 год

✅ Cache-Control: no-cache на HTML
   Cache-Control: immutable только на ассетах с хешем
```

**2. `no-cache` путают с `no-store`**
```
❌ Cache-Control: no-cache на медицинских данных
   Данные кешируются в shared proxy, только revalidate перед отдачей

✅ Cache-Control: private, no-store — для sensitive данных
```

**3. ETag без детерминированной генерации**
```typescript
// ❌ ETag на основе timestamp или PID — разные за load balancer
const etag = `"${Date.now()}"` // Каждый инстанс → свой ETag

// ✅ Content hash
const etag = `W/"${hash(content)}"`
```

**4. SW без offline fallback**
```typescript
// ❌ SW перехватывает navigate, нет fallback при offline
// Пользователь видит пустую страницу / chrome error

// ✅ Offline page в precache
cache.addAll(['/offline.html'])
// При ошибке navigate → отдать /offline.html
```

**5. skipWaiting() при breaking API changes**
```
❌ Новый SW с несовместимым API активируется skipWaiting()
   Старая страница ещё открыта → runtime errors

✅ skipWaiting() только для backwards-compatible изменений
   Иначе: ждать reload пользователя
```

**6. Кешировать POST/PUT в Service Worker**
```typescript
// ❌ Случайно перехватить и кешировать POST
self.addEventListener('fetch', event => {
  event.respondWith(cacheFirst(event.request))  // кеширует POST!
})

// ✅ Явная проверка метода
if (request.method !== 'GET') return  // Не перехватывать mutations
```

---

## Anti-checklist ☠️

- [ ] `no-cache` везде — убивает все преимущества кэша, сервер получает лишние запросы
- [ ] `Cache-Control: public` для авторизованных страниц — все пользователи видят данные первого
- [ ] SW cache-first для API — пользователь видит устаревшие данные после обновления
- [ ] Service Worker без версионирования — старый SW кэширует новую версию сайта
- [ ] `Vary: *` — CDN не кэширует ничего, каждый запрос идёт к origin
- [ ] max-age=31536000 для HTML — контент не обновится год

---

## Задачи AI-кодеру

**Плохая формулировка:**
> «Добавь Service Worker»

**Хорошая формулировка:**
> «Добавить PWA с Workbox 7 через vite-plugin-pwa@1.3.0:
> 1. В `vite.config.ts`: VitePWA({ registerType: 'autoUpdate', workbox: { globPatterns: ['**/*.{js,css,html,ico,avif,webp,woff2}'] } }).
> 2. Стратегии в workbox.runtimeCaching: HTML навигация → NetworkFirst (maxEntries: 30, maxAgeSeconds: 604800); изображения → CacheFirst (maxEntries: 100, 30 дней); `/api/public/*` → StaleWhileRevalidate (maxEntries: 50, 1 час).
> 3. Все POST/PUT/DELETE → NetworkOnly (без кеша).
> 4. Создать `public/offline.html` — минимальная страница "нет соединения".
> 5. Проверить: Chrome DevTools → Application → Service Workers → активен без ошибок.»

---

**Плохая формулировка:**
> «Настрой правильное кеширование»

**Хорошая формулировка:**
> «Настроить Cache-Control заголовки в Express/Nginx:
> 1. Все ответы `*.js, *.css, *.avif, *.webp, *.woff2` с хешем в имени: `Cache-Control: public, max-age=31536000, immutable`.
> 2. HTML ответы (`text/html`): `Cache-Control: no-cache`.
> 3. GET `/api/` endpoints с публичными данными: `Cache-Control: public, max-age=60, stale-while-revalidate=3600, stale-if-error=86400`.
> 4. GET `/api/` endpoints с user-specific данными: `Cache-Control: private, max-age=0, must-revalidate`.
> 5. Добавить `ETag` middleware для `/api/` (content hash, не timestamp).»

---

## Чеклист архитектора

**HTTP Cache-Control**
- [ ] HTML: `no-cache` (не `max-age`)
- [ ] Ассеты с хешем: `public, max-age=31536000, immutable`
- [ ] Публичный API: `public, max-age=N, stale-while-revalidate=M`
- [ ] Приватные данные: `private, no-store`
- [ ] SW файл: `no-cache`

**ETag**
- [ ] ETag детерминированный (content hash, не timestamp/PID)
- [ ] Nginx: `gzip_vary on; etag on` при использовании gzip

**CDN**
- [ ] Разные TTL для браузера и CDN через `CDN-Cache-Control`
- [ ] Стратегия purge при деплое: URL list или tags
- [ ] `stale-if-error` для resilience (но не на критичных данных)

**Service Worker**
- [ ] Workbox 7 + vite-plugin-pwa
- [ ] Precache: критичные ассеты + `/offline.html`
- [ ] Стратегии по типу контента: HTML→NetworkFirst, images→CacheFirst
- [ ] POST/PUT/DELETE → NetworkOnly
- [ ] `cleanupOutdatedCaches()` при каждом activate
- [ ] Offline fallback page

**Деплой**
- [ ] CI/CD: раздельные cache headers для HTML vs ассетов
- [ ] CDN HTML purge в deploy pipeline
- [ ] SW CACHE_VERSION = git commit hash

---

*Модуль 38 завершён.*
*Следующий: [Модуль 39 — Core Web Vitals: диагностика, RUM и fixes](../39-core-web-vitals-diagnostics-rum/README.md)*
