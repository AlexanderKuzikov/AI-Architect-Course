# Модуль 26 — Logging / Observability

> **Для AI-архитектора:** observability — это не «добавить логи». Это проектирование системы, при которой вопрос «что произошло с запросом X в 14:32?» можно ответить за 30 секунд, не за 30 минут. AI-кодер добавит `console.log` везде. Задача архитектора — определить что собирать, как коррелировать и где хранить.
> Один день изучения — три столпа observability, Pino mechanics, OpenTelemetry SDK 2.0, корреляция logs+traces.

---

## Содержание

1. [Три столпа observability](#1-три-столпа-observability)
2. [Pino — structured logging](#2-pino)
3. [Request context и корреляция](#3-request-context)
4. [OpenTelemetry — traces и metrics](#4-opentelemetry)
5. [Что логировать — принципы](#5-что-логировать)
6. [Антипаттерны](#антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| pino | **9.x** | Structured JSON logger |
| pino-http | **10.x** | HTTP request logging middleware |
| pino-pretty | **13.x** | Human-readable dev output |
| @opentelemetry/sdk-node | **2.x** | OTel SDK для Node.js |
| @opentelemetry/auto-instrumentations-node | **0.58+** | Auto-instrument HTTP, Express, pg, Redis |
| Grafana Loki | **3.7.0** | Log aggregation |

---

## 1. Три столпа observability

### Logs, Traces, Metrics — разные вопросы

```
Logs:    "Что произошло?"
         → Последовательность событий с контекстом
         → Дебаггинг конкретного инцидента

Traces:  "Где это произошло и сколько времени заняло?"
         → Путь запроса через сервисы с timing
         → Перфоманс, bottleneck detection

Metrics: "Как система работает в целом?"
         → Агрегированные числа: RPS, latency p99, error rate
         → Алертинг, capacity planning
```

Они бесполезны по отдельности. `trace_id` в логе связывает их в единую картину: alarm на метрику → trace → logs конкретного запроса.

### Принцип: stdout как единственный транспорт

```
Application → stdout (JSON) → Log aggregator (Loki/Datadog/etc) → Storage

НЕ:
Application → файл → logrotate → filebeat → ...
```

Приложение не знает куда пойдут логи. Всё в stdout — проще, надёжнее, работает в Docker/Kubernetes без изменений.

---

## 2. Pino

### Почему Pino быстрее Winston

Pino использует асинхронную запись в stdout и откладывает JSON-сериализацию:

```
Winston: serialize → write (sync) → блокирует event loop
Pino:    serialize (lazy) → async write → не блокирует
```

Разница ~5× в throughput. При 1000 req/sec это значимо.

### Базовая конфигурация

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',

  // В development — pino-pretty для читаемости
  // В production — чистый JSON в stdout
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss',
        },
      }
    : undefined,

  // Редактирование чувствительных полей — по пути в объекте
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      '*.creditCard',
    ],
    censor: '[REDACTED]',
  },

  // Базовый контекст для всех логов
  base: {
    service: process.env.SERVICE_NAME ?? 'unknown',
    version: process.env.APP_VERSION ?? '0.0.0',
    env: process.env.NODE_ENV,
  },
})
```

### pino-http — request logging

```typescript
import pinoHttp from 'pino-http'

export const httpLogger = pinoHttp({
  logger,

  // Не логировать health checks (шум)
  autoLogging: {
    ignore: (req) =>
      req.url === '/health' || req.url === '/metrics',
  },

  // Кастомные поля в лог-записи
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },

  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress,
      }
    },
    res(res) {
      return { statusCode: res.statusCode }
    },
  },
})

app.use(httpLogger)
```

### Уровни логирования и когда использовать

```typescript
logger.fatal({ err }, 'Database connection lost — shutting down')
// fatal: сервис не может продолжать работу → немедленный shutdown

logger.error({ err, orderId }, 'Payment processing failed')
// error: операция не выполнена, требует внимания

logger.warn({ retryCount, url }, 'HTTP request failed, retrying')
// warn: деградация, но сервис работает

logger.info({ userId, action: 'login' }, 'User authenticated')
// info: значимые события бизнес-логики

logger.debug({ query, params }, 'Executing SQL query')
// debug: детали для диагностики (в production обычно выключен)

logger.trace({ bytes }, 'Reading chunk from stream')
// trace: очень детальный уровень, почти никогда в production
```

### Граничные случаи — где ломается

**Circular references**: Pino использует `fast-json-stringify` — он не обрабатывает циклические ссылки. Объект с circular ref вызовет `Maximum call stack` при логировании.

```typescript
// ❌ Циклическая ссылка упадёт
const req = { url: '/api' }
req.self = req
logger.info({ req }, 'crash')

// ✅ Логировать только нужные поля через сериализатор
logger.info({ url: req.url, method: req.method }, 'request')
```

**async transport**: `pino({ transport: { target: '...' } })` — транспорт работает асинхронно через worker thread. При `process.exit()` без `await logger.flush()` последние логи теряются.

```typescript
process.on('SIGTERM', async () => {
  await logger.flush?.()  // сбросить буфер перед выходом
  process.exit(0)
})
```

**Почему это важно архитектору:** потеря последних логов при shutdown — самое неприятное место для диагностики. Именно при shutdown происходит что-то важное (OOM, DB disconnect), и эти логи нужны больше всего.

---

## 3. Request context

### Проблема: child logger vs глобальный logger

Каждый запрос должен нести request ID во всех своих логах. Проблема — функции глубоко в стеке не знают о request context.

```typescript
// ❌ Передавать logger через параметры — неудобно и не масштабируется
async function processOrder(orderId: string, logger: Logger) {
  await validatePayment(orderId, logger)  // и так далее вглубь
}

// ✅ AsyncLocalStorage — request-scoped context без явной передачи
```

### AsyncLocalStorage для request context

```typescript
import { AsyncLocalStorage } from 'async_hooks'
import pino from 'pino'

interface RequestContext {
  requestId: string
  userId?: string
  traceId?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

// Child logger с автоматическим контекстом из AsyncLocalStorage
export function getLogger() {
  const ctx = storage.getStore()
  return ctx
    ? logger.child(ctx)           // новый logger с bindings из context
    : logger
}

// Middleware: создать контекст для каждого запроса
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string
    ?? crypto.randomUUID()

  res.setHeader('x-request-id', requestId)

  storage.run({ requestId }, () => {
    next()
  })
})

// В любом модуле — без передачи logger через параметры:
import { getLogger } from './logger'

async function chargePayment(amount: number) {
  const log = getLogger()   // автоматически содержит requestId
  log.info({ amount }, 'Charging payment')
}
```

### Корреляция logs + traces

Trace ID из OpenTelemetry нужно пробрасывать в логи — иначе нельзя перейти от лога к trace:

```typescript
import { trace, context } from '@opentelemetry/api'

export function getLogger() {
  const ctx = storage.getStore()
  const span = trace.getActiveSpan()

  const otelContext = span ? {
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  } : {}

  return logger.child({ ...ctx, ...otelContext })
}

// Итоговая запись лога:
// {
//   "level": "info",
//   "requestId": "uuid-123",
//   "traceId": "abc123...",
//   "spanId": "def456...",
//   "userId": "user-789",
//   "msg": "Charging payment",
//   "amount": 100
// }
```

### Граничные случаи — где ломается

**AsyncLocalStorage и EventEmitter**: если внутри request handler создаётся EventEmitter с отложенными колбэками — они могут терять контекст AsyncLocalStorage. `EventEmitter` не автоматически распространяет async context в некоторых паттернах.

**child() vs bindings**: `logger.child({ requestId })` создаёт новый logger с постоянными bindings. Это дешевле чем передавать `{ requestId }` в каждый вызов `logger.info()` вручную — сериализация один раз при создании child.

**Почему это важно архитектору:** без корреляции logs + traces debugging в production превращается в поиск иголки в стоге. requestId в каждом логе — минимум. traceId — стандарт.

---

## 4. OpenTelemetry

### Инициализация — до всех импортов

OTel SDK должен быть инициализирован до первого импорта instrumented модулей (http, express, pg). Иначе auto-instrumentation не сработает.

```typescript
// instrumentation.ts — отдельный файл, загружается первым
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { Resource } from '@opentelemetry/resources'

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': process.env.SERVICE_NAME ?? 'api',
    'service.version': process.env.APP_VERSION ?? '0.0.0',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  }),

  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),

  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 15_000,
  }),

  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-ioredis': { enabled: true },
      '@opentelemetry/instrumentation-fs': { enabled: false }, // очень шумный
    }),
  ],
})

sdk.start()

process.on('SIGTERM', async () => {
  await sdk.shutdown()
})
```

```bash
# Загрузить instrumentation.ts первым
node --import ./dist/instrumentation.js dist/server.js
# или через tsx:
tsx --import ./src/instrumentation.ts src/server.ts
```

### Кастомные spans и attributes

Auto-instrumentation покрывает HTTP/DB. Бизнес-логику — вручную:

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('document-processor', '1.0.0')

async function processDocument(docId: string): Promise<Result> {
  return tracer.startActiveSpan('document.process', async (span) => {
    span.setAttribute('document.id', docId)
    span.setAttribute('document.size', doc.size)

    try {
      const result = await extract(doc)
      span.setAttribute('document.pages', result.pages)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })
      throw err
    } finally {
      span.end()   // ← обязательно, иначе span не экспортируется
    }
  })
}
```

### Кастомные метрики

```typescript
import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('api-metrics', '1.0.0')

// Counter — монотонно возрастающий
const requestCounter = meter.createCounter('http.requests.total', {
  description: 'Total HTTP requests',
})

// Histogram — распределение значений (latency, размер файлов)
const latencyHistogram = meter.createHistogram('http.request.duration', {
  description: 'HTTP request duration in ms',
  unit: 'ms',
  advice: { explicitBucketBoundaries: [10, 50, 100, 200, 500, 1000, 2000] },
})

// UpDownCounter — может убывать (active connections, queue size)
const activeRequests = meter.createUpDownCounter('http.active_requests', {
  description: 'Currently active HTTP requests',
})

// Использование
app.use((req, res, next) => {
  const start = Date.now()
  activeRequests.add(1)

  res.on('finish', () => {
    const duration = Date.now() - start
    requestCounter.add(1, { method: req.method, path: req.route?.path, status: res.statusCode })
    latencyHistogram.record(duration, { method: req.method, status: res.statusCode })
    activeRequests.add(-1)
  })
  next()
})
```

### Граничные случаи — где ломается

**`span.end()` в `finally`**: без `finally` span не закроется при исключении — memory leak и потеря данных о запросе.

**`metricReader` (singular) deprecated**: в OTel JS SDK 2.x `metricReader` (single) deprecated — использовать `metricReaders: []` (массив) для нескольких экспортеров.

**OTel SDK и TypeScript**: OTel JS SDK 2.0 требует TypeScript ≥ 5.0.4 и Node.js ≥ 18.19.0. Целевой ES2022.

**Почему это важно архитектору:** `--import` флаг (ESM) vs `--require` (CJS) — ошибка в выборе = auto-instrumentation не работает молча. Проверять через тестовый endpoint с заведомо известным span.

---

## 5. Что логировать

### Принципы отбора

```
Логировать:
✅ Boundary events: вход/выход из сервиса, внешние вызовы
✅ State changes: создание/изменение/удаление значимых сущностей
✅ Ошибки с полным контекстом: error, stack, input params
✅ Security events: аутентификация, авторизация, rate limit hits
✅ Медленные операции: > threshold (100ms DB, > 1s HTTP)

НЕ логировать:
❌ PII без redaction: пароли, токены, email, phone (GDPR)
❌ Каждый SQL-запрос в production — только slow queries
❌ Health check эндпоинты — шум
❌ Успешные операции чтения в CRUD — слишком много
```

### Structured error logging

```typescript
// ❌ Теряет контекст
logger.error('Payment failed')

// ❌ Нечитаемо в системах агрегации
logger.error(err)

// ✅ Контекст + стек + операционные данные
try {
  await processPayment(order)
} catch (err) {
  logger.error({
    err: {                    // pino сериализует Error автоматически
      message: err.message,  // если использовать поле 'err'
      stack: err.stack,
      code: err.code,
    },
    orderId: order.id,
    amount: order.amount,
    userId: order.userId,
  }, 'Payment processing failed')
  throw err  // не глотать ошибку
}
```

### Sampling для шумных операций

```typescript
// Логировать только 1% успешных запросов к популярному эндпоинту
function shouldLog(req: Request, res: Response): boolean {
  if (res.statusCode >= 400) return true  // всегда логировать ошибки
  if (req.url.startsWith('/api/feed')) {
    return Math.random() < 0.01           // 1% успешных
  }
  return true
}
```

---

## Антипаттерны

**1. `console.log` в production**
`console.log` синхронно записывает в stdout — блокирует event loop при высокой нагрузке. Pino асинхронен. Ещё хуже: console.log не структурирован — невозможно автоматически парсить.

**2. Логировать в файл напрямую**
`pino({ transport: { target: 'pino/file', destination: '/app/logs/app.log' } })` — нарушает принцип 12-factor app. Файл нужно ротировать, собирать, следить за дисковым пространством. stdout → агрегатор.

**3. Один глобальный logger без child**
Все логи без request ID — невозможно отследить путь конкретного запроса при параллельных операциях.

**4. Логировать объекты request/response целиком**
`logger.info({ req, res }, '...')` — тысячи полей, включая headers с токенами, тело с PII. Использовать сериализаторы для контролируемого набора полей.

**5. OTel SDK инициализировать после импортов**
```typescript
// ❌ express уже импортирован — http instrumentation не работает
import express from 'express'
import { initOtel } from './instrumentation'
initOtel()

// ✅ --import flag или instrumentation первый импорт
// node --import ./dist/instrumentation.js dist/server.js
```

**6. Не закрывать spans**
```typescript
// ❌ Span открыт но не закрыт → утечка, нет данных в Jaeger
const span = tracer.startSpan('work')
await doWork()
// span.end() забыли

// ✅ startActiveSpan с try/finally
tracer.startActiveSpan('work', async (span) => {
  try { await doWork() }
  finally { span.end() }
})
```

---

## Anti-checklist ☠️

- [ ] `console.log` в production — синхронный, блокирует event loop, не структурирован
- [ ] Логировать в файл напрямую — нарушает 12-factor app, нужен logrotate
- [ ] Один глобальный logger без child — нет requestId, невозможно трассировать запрос
- [ ] Логировать req/res целиком — тысячи полей, включая токены в headers
- [ ] OTel SDK инициализировать после импортов — auto-instrumentation не работает молча
- [ ] Не закрывать spans — утечка, нет данных в Jaeger

## Задачи AI-кодеру

**Плохая формулировка:**
> «Добавь логирование в сервис»

**Хорошая формулировка:**
> «Настрой pino 9.x логирование для Express приложения.
> `logger.ts`: singleton pino с `redact: ['req.headers.authorization', 'body.password']`, `base: { service, version }`, pino-pretty только при NODE_ENV=development.
> `requestContext.ts`: AsyncLocalStorage для `{ requestId, userId, traceId }`. Middleware генерирует requestId (crypto.randomUUID()), устанавливает x-request-id заголовок ответа.
> `getLogger()`: child logger с bindings из AsyncLocalStorage.
> pino-http middleware: игнорировать `/health`, customLogLevel по statusCode (≥500 → error, ≥400 → warn).
> Добавить `await logger.flush?.()` в SIGTERM handler.»

---

**Плохая формулировка:**
> «Добавь OpenTelemetry»

**Хорошая формулировка:**
> «Создай `instrumentation.ts` для @opentelemetry/sdk-node 2.x.
> Resource: service.name, service.version, deployment.environment из env vars.
> Trace exporter: OTLPTraceExporter на OTEL_EXPORTER_OTLP_ENDPOINT (default localhost:4318).
> Metric reader: PeriodicExportingMetricReader, 15s interval, массив `metricReaders` (не устаревший metricReader).
> Auto-instrumentations: http ✅, express ✅, pg ✅, ioredis ✅, fs ❌.
> Загружать через `--import` флаг до всех других импортов.
> В SIGTERM handler: `await sdk.shutdown()`.
> В getLogger(): читать traceId/spanId из `trace.getActiveSpan()?.spanContext()` и добавлять в child bindings.»

---

## Чеклист архитектора

**Logging**
- [ ] pino вместо console.log / Winston
- [ ] JSON в production, pino-pretty только в development
- [ ] `redact` настроен для PII и credentials путей
- [ ] AsyncLocalStorage для request context (requestId обязательно)
- [ ] pino-http с игнором health endpoints
- [ ] `logger.flush()` в SIGTERM handler

**Трассировка**
- [ ] OTel SDK инициализируется через `--import` до всех модулей
- [ ] `service.name` и `service.version` в Resource
- [ ] Бизнес-критичные операции обёрнуты в кастомные spans
- [ ] Spans закрываются в `finally` блоке
- [ ] `traceId` пробрасывается в pino child bindings

**Метрики**
- [ ] Counters для request count (разбить по method/status)
- [ ] Histogram для latency с bucket boundaries
- [ ] UpDownCounter для active connections / queue size
- [ ] Health и metrics эндпоинты не влияют на latency метрики

**Операционность**
- [ ] Health check эндпоинт не логируется
- [ ] Sampling для шумных операций определён
- [ ] Log level управляется через LOG_LEVEL env var (не хардкод)
- [ ] Структурированные ошибки: `{ err: { message, stack, code }, ...context }`

---

*Модуль 26 завершён.*
*Следующий: [Модуль 27 — Static site generation](../27-static-site/README.md)*
