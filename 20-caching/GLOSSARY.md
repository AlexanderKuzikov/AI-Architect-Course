# GLOSSARY — Кэширование: Redis, in-memory, CDN

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**allkeys-lru**  
Политика вытеснения Redis: при заполнении памяти удалять наименее недавно используемые ключи среди всех ключей (не только с TTL). Рекомендована для кэша. Альтернативы: `volatile-lru` (только ключи с TTL), `allkeys-lfu` (по частоте), `noeviction` (ошибка при OOM — не для кэша).

**allowStale**  
Опция LRUCache: разрешить возвращать записи с истёкшим TTL при `get()`. Используется совместно с `fetchMethod` для stale-while-revalidate: клиент получает устаревшее значение пока фоново идёт обновление.

---

## C

**Cache-Aside (Lazy Loading)**  
Паттерн кэширования: приложение самостоятельно управляет кэшем. Чтение: check cache → miss → read DB → set cache. Запись: write DB → invalidate cache. Самый распространённый паттерн. Риск: thundering herd при первом промахе после инвалидации.

**Cache-Control**  
HTTP заголовок управляющий кэшированием. Директивы: `max-age` (секунды свежести), `public`/`private` (CDN vs только браузер), `no-store` (не кэшировать вообще), `no-cache` (кэшировать но ревалидировать), `immutable` (не ревалидировать до истечения max-age), `stale-while-revalidate` (отдавать stale пока обновляется).

**cache stampede**  
Эффект одновременной нагрузки на источник данных при массовом промахе кэша. Возникает при истечении популярного ключа: N параллельных запросов видят miss и все идут в DB. Решения: `fetchMethod` (in-process), Redis lock (distributed), probabilistic early expiration.

**Cache-Tag (Cloudflare)**  
HTTP заголовок для группировки CDN-кэшированных ресурсов. `Cache-Tag: doc:123,user:456`. Позволяет инвалидировать группу ресурсов одним API вызовом. Аналог: `Surrogate-Key` в Fastly.

**calculatedSize**  
Свойство LRUCache: текущий суммарный размер кэша по `sizeCalculation`. Доступно только если задан `maxSize`. Используется в метриках: отношение `calculatedSize / maxSize` = memory pressure.

**conditional GET**  
HTTP запрос с `If-None-Match` (ETag) или `If-Modified-Since`. Сервер отвечает `304 Not Modified` без тела если ресурс не изменился. Экономит bandwidth, снижает latency для неизменённых ресурсов.

---

## D

**dispose**  
Колбэк LRUCache вызываемый при вытеснении записи. Параметры: `(value, key, reason)`. `reason`: `'evict'` (вытеснен по LRU/size), `'expire'` (TTL истёк), `'delete'` (явное удаление), `'set'` (перезапись). Использовать для cleanup side effects: закрытие handles, логирование.

---

## E

**early expiration**  
Вероятностное обновление кэша до истечения TTL. Вероятность растёт экспоненциально по мере приближения к истечению. Предотвращает stampede без блокировки: часть запросов триггерит обновление заранее, основной поток получает актуальные данные без промаха.

**ETag**  
HTTP заголовок: хэш или версия ресурса. Используется в `If-None-Match` для conditional GET. Генерировать из содержимого (SHA1/MD5 среза) или версии объекта. Сильный ETag (`"abc123"`) = byte-identical; слабый (`W/"abc123"`) = семантически эквивалентный.

**eviction**  
Вытеснение записей из кэша при превышении лимита (`max` или `maxSize`). LRUCache: вытесняет наименее недавно использованную запись. Redis: по политике `maxmemory-policy`. Метрика `evicted_keys` в Redis — признак недостаточного `maxmemory`.

---

## F

**fetchMethod**  
Опция LRUCache: async функция вызываемая при `cache.fetch()` когда ключ отсутствует или устарел. Гарантирует что конкурентные `fetch()` на один ключ выполняют один реальный вызов. Основной механизм stampede protection в in-process кэше.

**fragmentation ratio (Redis)**  
`mem_fragmentation_ratio` в Redis INFO: отношение памяти выделенной OS к памяти используемой Redis. Значение >1.5 = фрагментация, Redis использует меньше памяти чем выделено. Значение <1 = Redis использует swap. Норма: 1.0–1.5.

---

## H

**hash (Redis)**  
Redis структура данных: ключ → множество field-value пар (`HSET`, `HGET`, `HGETALL`). Эффективнее отдельных строковых ключей для объектов с несколькими полями: один ключ вместо N, атомарное чтение нескольких полей через `HMGET`.

**hit rate**  
Процент запросов к кэшу завершившихся попаданием. `hits / (hits + misses)`. Целевые значения: L1 ≥ 60%, L2 ≥ 85%. Ниже 50% = кэш неэффективен. Вычисляется из `keyspace_hits` и `keyspace_misses` в Redis INFO.

---

## I

**immutable (Cache-Control)**  
Директива Cache-Control указывающая что ресурс никогда не изменится за время `max-age`. Браузер не посылает conditional GET до истечения. Используется для статики с хэшем в имени файла: `bundle.a1b2c3.js`.

**invalidatePattern**  
Инвалидация ключей по паттерну через `SCAN` + `DEL`. Не использовать `KEYS` — блокирует Redis. Паттерн: `prefix:*`. Итеративный обход с `COUNT 100` за итерацию — не блокирует event loop Redis.

**ioredis**  
Node.js Redis клиент. Версия 5.9.3 (март 2026). Поддерживает pipeline, cluster, sentinel, pub/sub, TLS. Параметры для кэша: `maxRetriesPerRequest: 3` (для обычных команд), `commandTimeout`, `retryStrategy`.

---

## K

**keyspace_hits / keyspace_misses**  
Метрики Redis INFO: суммарное число попаданий и промахов с момента запуска (или последнего `CONFIG RESETSTAT`). Используются для расчёта hit rate. Сбрасываются командой `CONFIG RESETSTAT`.

---

## L

**L1 (cache level 1)**  
In-process кэш: данные хранятся в памяти Node.js процесса. Latency: 0.001–0.1ms. Не разделяется между процессами. Реализация: LRUCache, Map. Вытесняется при рестарте процесса.

**L2 (cache level 2)**  
Distributed кэш: Redis. Разделяется между всеми инстанциями приложения. Latency: 0.5–5ms. Переживает рестарты процессов. Ограничен объёмом Redis `maxmemory`.

**Last-Modified**  
HTTP заголовок: дата последнего изменения ресурса. Используется в `If-Modified-Since` для conditional GET. Менее точен чем ETag (точность до секунды). Использовать для файлов где `mtime` доступен.

**lru-cache**  
npm пакет. Версия 11.2.6 (март 2026). LRU + TTL + size-based eviction. Ключевые опции: `max`, `maxSize`, `sizeCalculation`, `ttl`, `allowStale`, `fetchMethod`, `dispose`. ESM-only начиная с версии 10.x.

**LRU (Least Recently Used)**  
Алгоритм вытеснения: при превышении лимита удаляется запись к которой дольше всего не обращались. Эффективен для рабочих множеств (working set): часто используемые данные остаются, редкие вытесняются.

---

## M

**maxmemory (Redis)**  
Конфигурационный параметр Redis: максимальный объём памяти. При достижении — срабатывает `maxmemory-policy`. Для кэша обязательно задавать явно. Проверять через `CONFIG GET maxmemory`.

**maxmemory-policy**  
Политика вытеснения Redis при заполнении `maxmemory`. Для кэша: `allkeys-lru` (вытеснять любые по LRU) или `allkeys-lfu` (по частоте). Дефолт `noeviction` = ошибка при OOM, не подходит для кэша.

**maxSize**  
Опция LRUCache: максимальный суммарный размер кэша в байтах (или любых единицах). Требует `sizeCalculation`. Используется вместо или вместе с `max` для точного контроля памяти.

**MessagePack / CBOR**  
Бинарные форматы сериализации. Компактнее JSON на 20–40%, быстрее сериализации/десериализации на 30–50%. Альтернатива JSON для больших объектов в Redis. npm: `msgpackr` (MessagePack), `cbor-x` (CBOR).

---

## N

**noeviction**  
Политика Redis по умолчанию: при заполнении памяти команды записи возвращают `OOM command not allowed`. Категорически не подходит для кэша — приводит к ошибкам вместо вытеснения старых данных.

**node-cache**  
npm пакет для in-memory кэширования. Версия 5.x (март 2026). Проще чем lru-cache, без LRU eviction по умолчанию. Подходит для малых кэшей с TTL без ограничения по размеру.

---

## P

**pipeline (ioredis)**  
Пакетная отправка нескольких Redis команд в одном round-trip. `redis.pipeline()` + несколько команд + `.exec()`. Снижает latency при batch операциях: N команд = 1 round-trip вместо N.

**probabilistic early expiration**  
→ см. *early expiration*

**public / private (Cache-Control)**  
`public` — разрешить кэширование CDN и промежуточными прокси. `private` — только браузер, не CDN. Использовать `private` для персонализированного контента (user-specific данные).

---

## R

**RedisCache**  
Типизированная обёртка над ioredis. Паттерн: prefix + key → полный Redis ключ, JSON сериализация/десериализация, TTL через `SETEX`. Экспонировать domain-specific инстанции (`documentCache`, `embeddingCache`) как синглтоны.

---

## S

**SCAN**  
Redis команда для итеративного обхода ключей. `SCAN cursor MATCH pattern COUNT count`. Не блокирует Redis — возвращает порцию ключей за итерацию. В отличие от `KEYS`: O(1) за вызов, безопасен в production.

**SET NX (SET … NX)**  
Redis команда: установить ключ только если он не существует (`NX` = Not eXists). Атомарная операция. Используется для distributed lock: `SET lock:key 1 EX 10 NX` → `OK` если lock взят, `nil` если уже занят.

**SETEX**  
Redis команда: `SETEX key seconds value` = установить значение с TTL в секундах. Атомарная альтернатива `SET` + `EXPIRE`. В ioredis: `redis.setex(key, ttlSeconds, value)`.

**sizeCalculation**  
Функция LRUCache возвращающая размер одной записи: `(value, key) => number`. Обязательна при `maxSize`. Для embeddings: `(v) => v.vector.length * 4 + 64` (Float32 bytes + object overhead).

**stale-while-revalidate**  
Паттерн кэширования: отдавать устаревшие данные пока фоново обновляются. HTTP директива: `Cache-Control: stale-while-revalidate=3600`. LRUCache: `allowStale: true` + `fetchMethod`. Снижает perceived latency при обновлении кэша.

**Surrogate-Key (Fastly)**  
→ см. *Cache-Tag (Cloudflare)* — аналог для Fastly CDN.

---

## T

**tag-based invalidation**  
Инвалидация группы ключей по тегу. Redis реализация: `SADD tag:userId key1 key2 key3` → при инвалидации `SMEMBERS tag:userId` + `DEL key1 key2 key3`. CDN реализация: `Cache-Tag` заголовок + API purge.

**TTL (Time To Live)**  
Время жизни записи в кэше. Redis: `SETEX`, `EXPIRE`, `PEXPIRE` (мс). LRUCache: `ttl` в мс. Выбор TTL = компромисс между staleness (устаревание) и cache pressure (частые промахи). Нет универсального значения — определяется lifecycle данных.

---

## U

**updateAgeOnGet**  
Опция LRUCache: сбрасывать TTL при каждом `get()`. По умолчанию `false`. `true` = часто читаемые записи никогда не устаревают. Использовать осторожно: горячие записи могут содержать бесконечно устаревшие данные.

---

## V

**Vary**  
HTTP заголовок: указывает по каким заголовкам запроса CDN/браузер должен различать кэшированные варианты. `Vary: Accept-Encoding` = разные кэши для gzip и не-gzip. `Vary: Accept-Language` = разные кэши для разных языков. Злоупотребление `Vary: *` = отключить кэш.

**volatile-lru**  
Политика вытеснения Redis: вытеснять по LRU только среди ключей с TTL. Подходит если в Redis хранятся и кэш (с TTL) и персистентные данные (без TTL) — персистентные не вытесняются.

---

## W

**Write-Behind (Write-Back)**  
Паттерн записи: данные пишутся в кэш немедленно, в DB — асинхронно через буфер. Минимальный write latency. Риск потери данных при падении до flush. Оправдан для некритичных счётчиков, аналитики.

**Write-Through**  
Паттерн записи: данные пишутся в кэш и DB одновременно. Кэш всегда консистентен. Write latency = max(DB, cache). Подходит для read-heavy данных с редкими записями.

---

## Д

**Двухуровневый кэш (L1 + L2)** → см. *L1*, *L2*. Стандартная стратегия: L1 in-process для горячих данных, L2 Redis для разделяемых данных между инстанциями.

---

## И

**Инвалидация** → см. *tag-based invalidation*, *invalidatePattern*. Одна из двух сложных проблем Computer Science. Правило: инвалидировать при изменении источника, не при чтении.

---

## К

**Коллизия ключей**  
Два разных объекта получают одинаковый ключ. В embedding кэше: хэш-коллизия SHA-256 (вероятность ~1/2^128 — игнорируется). Реальная проблема: `doc:123` в разных контекстах. Решение: namespace prefix (`documentCache` использует `doc:`, `embeddingCache` — `emb:`).

---

*Глоссарий модуля 20. Следующий: [Модуль 21 — Тестирование: unit, integration, e2e*](../21-testing/GLOSSARY.md)