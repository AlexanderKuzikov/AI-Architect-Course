# GLOSSARY — Caching стратегии: HTTP, Service Worker, CDN

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## B

**BackgroundSyncPlugin**  
Workbox плагин: очередь failed network requests в IndexedDB. При восстановлении соединения — повтор в фоне. Для offline mutations (POST/PUT). Workbox 7+.

---

## C

**Cache-Control**  
HTTP заголовок ответа: управление поведением кеша. Директивы: `public/private`, `max-age`, `no-cache`, `no-store`, `must-revalidate`, `stale-while-revalidate`, `stale-if-error`, `immutable`. Разделяет поведение браузера и CDN.

**Cache First**  
Service Worker стратегия: сначала проверить SW cache, при отсутствии — network. Для статических ассетов (JS, CSS, fonts, images). Риск: устаревший контент без явной инвалидации.

**CDN-Cache-Control**  
Cloudflare-специфичный заголовок: управляет TTL только на CDN edge, независимо от `Cache-Control` браузера. Позволяет кешировать на CDN дольше чем в браузере.

**cleanupOutdatedCaches()**  
Workbox API: удаляет precache записи устаревших версий при activate event. Предотвращает накопление старых кешей в Storage.

**clients.claim()**  
Service Worker API: новый активированный SW берёт контроль над всеми открытыми вкладками немедленно. Без него — SW контролирует вкладки только после reload.

---

## E

**ETag**  
HTTP заголовок: уникальный идентификатор версии ресурса. `W/"hash"` — weak ETag (семантически эквивалентный). `"hash"` — strong ETag (byte-perfect). Используется для conditional requests (304 Not Modified).

---

## I

**immutable**  
`Cache-Control` директива: браузер никогда не revalidate ресурс. Безопасно только для ресурсов с content hash в URL. При изменении контента без смены URL — пользователи получают stale навсегда.

---

## N

**Network First**  
Service Worker стратегия: сначала network, при ошибке — SW cache fallback. Для HTML навигации и API данных требующих freshness. Медленнее Cache First на плохой сети.

**Network Only**  
Service Worker стратегия: только network, кеш не используется. Обязательно для POST/PUT/PATCH/DELETE mutations.

**no-cache**  
`Cache-Control` директива: кешировать разрешено, но перед каждой отдачей обязательно revalidate с origin. Не означает «не кешировать» (это `no-store`).

**no-store**  
`Cache-Control` директива: полный запрет кеширования — ни браузер, ни proxy, ни CDN. Для sensitive данных (банковские, медицинские).

---

## P

**precacheAndRoute()**  
Workbox API: регистрирует список ассетов для precaching при SW install + автоматически обслуживает их из кеша. Принимает `self.__WB_MANIFEST` (генерируется Workbox при build).

**purge (CDN)**  
Принудительное удаление ресурса из CDN edge cache. Cloudflare API: purge by URL, by tag, или purge_everything. Необходим при деплое для HTML ресурсов без версионирования в URL.

---

## S

**s-maxage**  
`Cache-Control` директива: TTL только для shared caches (CDN, proxy). Перекрывает `max-age` для CDN. Браузер использует `max-age`.

**skipWaiting()**  
Service Worker API: новый SW активируется немедленно, не дожидаясь закрытия старых вкладок. Безопасно только для backwards-compatible изменений.

**Stale While Revalidate (SW стратегия)**  
Service Worker стратегия: отвечать из кеша мгновенно + параллельно обновлять кеш из network. Баланс speed vs freshness. Для часто меняющегося но не critical контента.

**stale-if-error**  
`Cache-Control` директива: отдавать stale контент при ошибке origin (5xx, timeout). Поддерживается CDN (Cloudflare, Fastly, Nginx). Повышает resilience при падении origin.

**stale-while-revalidate**  
`Cache-Control` директива: отдавать stale ответ пока в фоне идёт revalidation. После `max-age` истёк и до `max-age + stale-while-revalidate` — stale + background fetch. Пользователь не ждёт.

---

## V

**Vary**  
HTTP заголовок: список заголовков запроса по которым кеш создаёт отдельные записи. `Vary: Accept-Encoding` — раздельный кеш gzip/non-gzip. `Vary: Cookie` — CDN не кеширует (уникальный per-user).

---

## W

**Workbox**  
Google библиотека (версия 7.x): набор модулей для Service Worker. Стратегии (CacheFirst, NetworkFirst, StaleWhileRevalidate), плагины (ExpirationPlugin, BackgroundSyncPlugin), precaching. Интегрируется через vite-plugin-pwa.

---

*Глоссарий модуля 38. Следующий: [Модуль 39 — Core Web Vitals: LCP, INP, CLS](../39-core-web-vitals/GLOSSARY.md)*
