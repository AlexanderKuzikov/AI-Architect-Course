# Модуль 23 — Rate Limiting паттерны

> **Для AI-архитектора:** rate limiting — это не про «добавить middleware». Это про выбор алгоритма под конкретный threat model, уровень применения в стеке и поведение при деградации зависимостей. AI-кодер поставит `express-rate-limit` с дефолтными настройками — и это защитит от нагрузочных тестов, но не от реальных атак.
> Один день изучения — четыре алгоритма, уровни применения, распределённый контекст.

---

## Содержание

1. [Алгоритмы — механика и trade-offs](#1-алгоритмы)
2. [Уровни применения в стеке](#2-уровни-применения)
3. [rate-limiter-flexible — production конфигурация](#3-rate-limiter-flexible)
4. [Распределённый rate limiting](#4-распределённый-rate-limiting)
5. [Архитектурные паттерны](#5-архитектурные-паттерны)
6. [Антипаттерны](#антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| rate-limiter-flexible | **10.0.1** | Production rate limiting, Redis/Memory/Postgres |
| express-rate-limit | **7.x** | Простой HTTP middleware для Express |
| @upstash/ratelimit | **latest** | Serverless / edge, HTTP-based Redis |
| ioredis | **5.9.x** | Redis клиент для distributed limiting |

---

## 1. Алгоритмы

### Fixed Window

Счётчик сбрасывается каждые N секунд по таймеру. Самый простой алгоритм.

```
Window 1 [0s–60s]: ████████░░ 8/10 requests
Window 2 [60s–120s]: ██████████ 10/10 → LIMIT ❌
                      │
                      └─ 10 запросов в секунду 59
                         + 10 запросов в секунду 61
                         = 20 запросов за 2 секунды ← не защищает
```

**Граничный случай — window boundary attack**: злоумышленник отправляет 10 запросов в конце одного окна и 10 в начале следующего. Реальный burst = 2× лимита. Алгоритм не защищает от этого.

```
Trade-offs Fixed Window:
✅ O(1) память, O(1) время
✅ Простая реализация
❌ Window boundary attack (двойной burst)
❌ Неравномерное распределение (все 10 в первую секунду окна)
```

### Sliding Window Counter

Комбинирует два фиксированных окна с весовым коэффициентом для сглаживания.

```
Текущий момент: 75s (внутри окна [60s–120s])

Вес предыдущего окна [0s–60s]: (60 - 15) / 60 = 0.75
Вес текущего окна [60s–120s]: 15/60 = 0.25 (прошло 15s)

Счётчик: prev_count × 0.75 + curr_count
         8 × 0.75 + 3 = 9 → в пределах лимита
```

Аппроксимация скользящего окна. Redis реализация: два счётчика + арифметика. Память: O(1).

```typescript
// Реализация через rate-limiter-flexible (RateLimiterRedis)
// использует sliding window counter внутри
```

### Sliding Window Log

Точный алгоритм: храним timestamp каждого запроса в sorted set. Считаем запросы в [now - window, now].

```
Sorted Set: [1714000001, 1714000010, 1714000025, 1714000058]
Запрос в 1714000060:
  Удалить всё < (1714000060 - 60) = 1714000000 → ничего
  Счётчик = 4 → в пределах 10/min
  Добавить 1714000060
```

```
Trade-offs Sliding Window Log:
✅ Точный — нет boundary attack
✅ Показывает точный reset time
❌ O(N) память — N записей на пользователя
❌ Не масштабируется при высоком трафике (тысячи запросов/мин)
```

### Token Bucket

Bucket наполняется токенами со скоростью R токенов/секунду до максимума B (burst capacity). Каждый запрос потребляет токен.

```
Bucket: capacity=10, refill=2/sec

t=0:  [██████████] 10 токенов → 10 запросов burst ✅
t=1:  [░░░░░░░░░░]  0 токенов + 2 refill = 2
t=2:  [░░████████]  4 токенов (2 запроса + 2 refill)
```

```
Trade-offs Token Bucket:
✅ Burst разрешён — легитимные пики не блокируются
✅ Сглаженный throughput в steady state
❌ Первый запрос может использовать весь burst (10 запросов за мс)
❌ Сложнее реализовать атомарно в Redis
```

### Leaky Bucket

Запросы поступают в очередь (bucket), обрабатываются с фиксированной скоростью. Если bucket переполнен — reject.

```
Incoming: [req1, req2, req3, req4, req5] burst
Queue:     [req1, req2, req3] ← max 3
           [req4, req5] → 429 ❌

Processing: req1 → req2 → req3 (равномерно, 1/sec)
```

```
Trade-offs Leaky Bucket:
✅ Абсолютно ровный выходной поток
✅ Защита downstream от burst
❌ Добавляет latency (очередь)
❌ Burst из легитимных запросов отклоняется
```

### Практический вывод для архитектора

```
Используй алгоритм              Когда
─────────────────────────────────────────────────────
Fixed Window                    Простая защита, потери точности допустимы
Sliding Window Counter          Production default: точность + O(1) память
Sliding Window Log              Нужна точность, трафик низкий (< 1000 req/min/user)
Token Bucket                    API с burst-паттерном (мобильные клиенты)
Leaky Bucket                    Защита downstream сервиса от перегрузки
```

---

## 2. Уровни применения

### Где ставить rate limiting

```
Internet
    │
    ▼
[CDN / WAF] ← L1: IP-based, DDoS protection (тысячи req/sec)
    │
    ▼
[API Gateway / nginx] ← L2: Per-IP, per-API-key (сотни req/sec)
    │
    ▼
[Application middleware] ← L3: Per-user, per-endpoint, business rules
    │
    ▼
[Service layer] ← L4: Per-operation (expensive AI calls, payment)
```

Каждый уровень решает свою задачу. Ставить только на один уровень — неправильно.

### Ключи для rate limiting

Выбор ключа определяет что именно защищаешь:

```typescript
// Per-IP — защита от DDoS, анонимных атак
const key = req.ip  // ❌ не работает за прокси без X-Forwarded-For

// Per-user — fair use, монетизация
const key = `user:${req.user.id}`

// Per-API-key — партнёрские интеграции
const key = `apikey:${req.headers['x-api-key']}`

// Per-endpoint — защита дорогих операций
const key = `${req.user.id}:${req.path}`  // user:123:/api/ai/generate

// Composite — тонкая настройка
const key = `${req.user.plan}:${req.user.id}:${req.path}`
// premium пользователи получают другой лимит
```

### Граничные случаи — где ломается

**X-Forwarded-For spoofing**: если брать `req.ip` за reverse proxy — получишь IP прокси. Если брать первый заголовок `X-Forwarded-For` без валидации — злоумышленник подделает IP.

```typescript
// ❌ Уязвимо — X-Forwarded-For: 1.2.3.4, злоумышленник подставит любой IP
const ip = req.headers['x-forwarded-for']?.split(',')[0]

// ✅ Доверять только последнему известному прокси
// express: trust proxy = число hop-ов от клиента
app.set('trust proxy', 1) // доверять одному прокси
const ip = req.ip        // Express вычислит реальный IP

// ✅ Для множества прокси — доверять только IP из whitelist
app.set('trust proxy', ['loopback', '10.0.0.0/8'])
```

**Почему это важно архитектору:** неправильное получение IP делает rate limiting бесполезным — злоумышленник меняет заголовок при каждом запросе.

---

## 3. rate-limiter-flexible

### Базовая конфигурация с Redis

```typescript
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

// Основной лимитер — Redis
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:api',       // namespace в Redis
  points: 100,               // разрешённых запросов
  duration: 60,              // за N секунд (sliding window counter)
  blockDuration: 0,          // не блокировать после превышения (просто reject)
})

// Insurance лимитер — in-memory при недоступности Redis
const rateLimiterMemory = new RateLimiterMemory({
  points: 100,
  duration: 60,
})

async function applyRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.user?.id ?? req.ip

  try {
    await rateLimiter.consume(key)
    next()
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      // Redis недоступен → fallback на memory
      try {
        await rateLimiterMemory.consume(key)
        next()
      } catch {
        res.status(429).set(rateLimitHeaders(rejRes)).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
        })
      }
    } else {
      // Лимит превышен
      res.status(429).set(rateLimitHeaders(rejRes)).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
      })
    }
  }
}
```

### Блокировка после серии нарушений

```typescript
// Прогрессивная блокировка: после N превышений — блокировать на T секунд
const bruteForceProtection = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:brute',
  points: 5,             // 5 попыток
  duration: 60 * 15,     // за 15 минут
  blockDuration: 60 * 60, // блокировка на 1 час
})

// При неудачной аутентификации:
await bruteForceProtection.consume(`login:${username}`)
// После 5 неудач — автоматически блокируется на 1 час
// consume() бросит RateLimiterRes с msBeforeNext > 0
```

### Многоуровневый лимитер

```typescript
import { RateLimiterUnion } from 'rate-limiter-flexible'

// Применить несколько ограничений одновременно
const unionLimiter = new RateLimiterUnion(
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:minute',
    points: 100, duration: 60,     // 100/мин
  }),
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:hour',
    points: 1000, duration: 3600,  // 1000/час
  }),
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:day',
    points: 5000, duration: 86400, // 5000/день
  })
)

// consume() отклоняет если любой из лимитеров превышен
await unionLimiter.consume(userId)
```

### Graничные случаи — где ломается

**RateLimiterRedis без страховки**: при Redis недоступности `consume()` бросает `Error`, а не `RateLimiterRes`. Без insurance limiter — все запросы проходят (fail open) или все блокируются (необработанное исключение). Явная обработка двух типов ошибок обязательна.

**keyPrefix коллизии**: несколько сервисов используют один Redis без namespace → счётчики смешиваются. Всегда: `rl:{service}:{endpoint}:{key}`.

**Почему это важно архитектору:** rate limiting через Redis — distributed critical path. Деградация Redis без insurance = либо DoS себя, либо отсутствие защиты.

---

## 4. Распределённый rate limiting

### Атомарность в Redis

Несколько инстанций приложения конкурентно инкрементируют счётчик. Без атомарности — race condition:

```
Instance A: GET counter → 9
Instance B: GET counter → 9
Instance A: SET counter 10 ✅ (в пределах лимита)
Instance B: SET counter 10 ✅ (тоже в пределах!) ← race condition
```

rate-limiter-flexible использует Lua-скрипты в Redis — они выполняются атомарно:

```lua
-- Упрощённая версия Lua-скрипта sliding window counter
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

-- Атомарный инкремент с проверкой
local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, window)
end
if current > limit then
    return {0, current, redis.call('TTL', key)}
end
return {1, current, redis.call('TTL', key)}
```

### Sliding Window через Sorted Set

Точный алгоритм в Redis — sorted set с timestamp как score:

```typescript
// Ручная реализация (rate-limiter-flexible делает это за тебя)
async function slidingWindowLog(
  redis: Redis, key: string, limit: number, windowMs: number
): Promise<boolean> {
  const now = Date.now()
  const windowStart = now - windowMs

  const result = await redis
    .pipeline()
    .zremrangebyscore(key, '-inf', windowStart)  // удалить старые
    .zadd(key, now, `${now}-${Math.random()}`)   // добавить текущий
    .zcard(key)                                   // посчитать
    .expire(key, Math.ceil(windowMs / 1000))      // TTL
    .exec()

  const count = result?.[2]?.[1] as number
  return count <= limit
}
```

### Clock drift

В распределённой системе часы на разных серверах расходятся. При sliding window на основе timestamps — один сервер может видеть запросы из «будущего» другого сервера.

```
Server A clock: 14:00:59.800
Server B clock: 14:01:00.200

Запрос в Server B: попадает в окно [14:00:00, 14:01:00] → window 2
Тот же запрос в Server A: попадает в окно [13:59:59, 14:00:59] → window 1
→ Разные счётчики, двойное прохождение
```

**Решение**: использовать Redis `TIME` для получения единого времени (не локальные часы серверов). rate-limiter-flexible делает это автоматически при `useRedisPackage: true`.

### Граничные случаи — где ломается

**Redis Cluster и hash slots**: при использовании Redis Cluster ключи должны быть на одном узле для атомарных Lua-скриптов. rate-limiter-flexible требует явного хэш-тега: `rl:{user:123}:api` — фигурные скобки гарантируют попадание на один узел.

```typescript
// ❌ В Redis Cluster: ключи могут быть на разных узлах → Lua упадёт
const key = `rl:${userId}:api`

// ✅ Hash tag — {userId} определяет slot
const key = `rl:{${userId}}:api`
```

**Почему это важно архитектору:** Redis Cluster + Lua = несовместимость без hash tags. Это не документировано явно в большинстве туториалов.

---

## 5. Архитектурные паттерны

### Rate limit headers — стандарт

IETF RFC 6585 расширен черновиком `draft-ietf-httpapi-ratelimit-headers`. Клиент должен знать о лимите:

```typescript
function rateLimitHeaders(rateLimiterRes: RateLimiterRes) {
  return {
    'RateLimit-Limit': rateLimiterRes.remainingPoints + rateLimiterRes.consumedPoints,
    'RateLimit-Remaining': Math.max(0, rateLimiterRes.remainingPoints),
    'RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
    'Retry-After': Math.ceil(rateLimiterRes.msBeforeNext / 1000),
  }
}

// Добавлять заголовки даже при успешных запросах
res.set({
  'RateLimit-Limit': limit,
  'RateLimit-Remaining': remaining,
  'RateLimit-Reset': resetTime,
})
```

### Tiered limits — разные лимиты для планов

```typescript
function getLimiterForUser(user: User): RateLimiterAbstract {
  switch (user.plan) {
    case 'enterprise': return enterpriseLimiter  // 10000/час
    case 'premium':    return premiumLimiter     // 1000/час
    case 'free':       return freeLimiter        // 100/час
    default:           return anonymousLimiter   // 10/час
  }
}
```

### Fail Open vs Fail Closed

При недоступности Redis выбор стратегии определяет security vs availability:

```
Fail Open (пропустить запрос):
✅ Сервис работает при деградации Redis
❌ Окно уязвимости — атака во время outage

Fail Closed (заблокировать запрос):
✅ Безопасно — нет окна для атаки
❌ Сервис недоступен при Redis outage

Компромисс — Insurance Limiter:
✅ In-memory fallback с меньшим лимитом
✅ Сервис работает, лимит всё ещё применяется
❌ Разные инстанции не видят друг друга (нет синхронизации)
```

**Практический вывод для архитектора:** insurance limiter — правильный дефолт для API. Fail closed — для аутентификации и финансовых операций.

### Граничные случаи — где ломается

**Rate limiting без идемпотентности**: запрос дошёл до сервера, списал токен, но сеть упала — клиент повторяет. Токен потрачен дважды. Для дорогих операций (AI inference, платежи) нужна идемпотентность через `Idempotency-Key` заголовок + хранение результата.

**Почему это важно архитектору:** rate limiting и идемпотентность — связанные проблемы. Решать их независимо — значит, что клиент либо получит 429 при ретрае, либо дважды спишет операцию.

---

## Антипаттерны

**1. Один глобальный лимитер для всех эндпоинтов**
`GET /health` и `POST /ai/generate` имеют разную стоимость. Общий лимит 100/мин — либо слишком мало для health checks, либо слишком много для дорогих операций. Раздельные лимиты по endpoint-группам обязательны.

**2. Rate limiting только на application уровне**
DDoS с 10 000 req/sec достигнет Node.js процесса и перегрузит его раньше, чем rate limiter отклонит запросы. L3/L4 защита (CDN, WAF) обязательна как первый рубеж.

**3. 429 без Retry-After**
Клиент не знает когда повторить — делает exponential backoff или retry storm. `Retry-After` заголовок — обязательный элемент 429 ответа. Клиенты, соблюдающие его, снимают нагрузку автоматически.

**4. IP-based rate limiting за NAT**
Корпоративный клиент с 500 пользователями за одним NAT IP получает один лимит на всех. Использовать per-user или per-API-key где возможно; IP — только для анонимных запросов.

**5. blockDuration без логирования**
Заблокировать IP на час — правильно. Не знать об этом — неправильно. Блокировки должны логироваться с причиной и ключом для диагностики ложных срабатываний.

---

## Задачи AI-кодеру

**Плохая формулировка:**
> «Добавь rate limiting на API»

**Хорошая формулировка:**
> «Используя rate-limiter-flexible 10.0.1 с RateLimiterRedis (ioredis клиент), создай три лимитера:
> 1. `api-general`: 100 points / 60s per userId (sliding window)
> 2. `ai-generate`: 10 points / 3600s per userId (дорогие операции)
> 3. `login-brute`: 5 points / 900s per username, blockDuration: 3600
> Insurance fallback через RateLimiterMemory с теми же параметрами.
> Middleware возвращает 429 с заголовками RateLimit-Limit, RateLimit-Remaining, Retry-After.
> keyPrefix формат: `rl:{service}:{limiterName}`. Redis Cluster — использовать hash tags в ключах.»

---

**Плохая формулировка:**
> «Сделай разные лимиты для free и premium пользователей»

**Хорошая формулировка:**
> «Создай фабрику лимитеров `getLimiterForPlan(plan: 'free' | 'premium' | 'enterprise')`.
> Free: 100/час, Premium: 1000/час, Enterprise: 10000/час — все через RateLimiterRedis.
> Синглтоны на уровне модуля (не создавать при каждом запросе).
> В middleware: выбрать лимитер по `req.user.plan`, при отсутствии user — anonymous лимитер 10/час per IP.
> X-Forwarded-For: `app.set('trust proxy', 1)`, использовать `req.ip`.»

---

## Чеклист архитектора

**Алгоритм и ключи**
- [ ] Алгоритм выбран под threat model (sliding window counter — production default)
- [ ] Ключи определены для каждого уровня: IP / user / API-key / endpoint
- [ ] `trust proxy` настроен корректно, IP извлекается надёжно

**Redis и отказоустойчивость**
- [ ] Insurance limiter (RateLimiterMemory) настроен как fallback
- [ ] Обработаны оба типа ошибок: `Error` (Redis недоступен) и `RateLimiterRes` (лимит)
- [ ] keyPrefix уникален для сервиса
- [ ] Redis Cluster: hash tags в ключах

**HTTP контракт**
- [ ] 429 всегда содержит `Retry-After` и `RateLimit-*` заголовки
- [ ] Успешные ответы содержат `RateLimit-Remaining`
- [ ] Разные лимиты для разных групп эндпоинтов

**Операционность**
- [ ] Блокировки логируются (ключ, причина, время разблокировки)
- [ ] Метрики: rate limit hits по endpoint и плану
- [ ] Идемпотентность проработана для дорогих операций

---

*Модуль 23 завершён.*
*Следующий: [Модуль 24 — Docker](../24-docker/README.md)*
