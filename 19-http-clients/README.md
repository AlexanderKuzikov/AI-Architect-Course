# Модуль 19 — HTTP клиенты и retry стратегии

> **Для AI-архитектора:** HTTP клиент — не «просто fetch». В production это retry с backoff, circuit breaker, таймауты на каждом уровне, connection pooling и observability. Выбор библиотеки определяет что вообще можно настроить без велосипеда. Для AI API с rate limits и нестабильными endpoint — правильная retry стратегия разница между работающим и не работающим пайплайном.
> Один день изучения — undici как встроенный транспорт, got как production HTTP клиент, retry стратегии, circuit breaker, таймауты, connection pooling, axios supply chain инцидент.

## Содержание

1. [Ландшафт HTTP клиентов Node.js 2026](#1-ландшафт-http-клиентов-nodejs-2026)
2. [undici: встроенный транспорт](#2-undici-встроенный-транспорт)
3. [got: production HTTP клиент](#3-got-production-http-клиент)
4. [Таймауты: три уровня](#4-таймауты-три-уровня)
5. [Retry: стратегии и backoff](#5-retry-стратегии-и-backoff)
6. [Circuit breaker](#6-circuit-breaker)
7. [Connection pooling и keep-alive](#7-connection-pooling-и-keep-alive)
8. [Работа с AI API: rate limits и streaming](#8-работа-с-ai-api-rate-limits-и-streaming)
9. [Observability: метрики и трассировка](#9-observability-метрики-и-трассировка)
10. [Supply chain: axios инцидент 2026](#10-supply-chain-axios-инцидент-2026)
11. [Реальный кейс](#11-реальный-кейс)
12. [Антипаттерны](#12-антипаттерны)
13. [Задачи AI-кодеру](#задачи-ai-кодеру)
14. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

| Инструмент | Версия | Примечание |
|:--|:--|:--|
| Node.js Active LTS | 24.x | март 2026 |
| undici | 7.24.6 | bundled в Node.js 24 |
| got | 14.6.6 | ESM-only; Node.js 18+ |
| ky | 1.x | ESM-only; fetch-based |
| axios | **1.14.0** | ⚠️ 1.14.1 и 0.30.4 скомпрометированы (31.03.2026) |
| p-retry | 6.x | utility для retry логики |
| opossum | 8.x | circuit breaker |

> ⚠️ **CRITICAL (31.03.2026):** `axios@1.14.1` и `axios@0.30.4` содержат RAT через скомпрометированный npm аккаунт мейнтейнера. Безопасная версия: `1.14.0`. Детали в разделе 10.

---

## 1. Ландшафт HTTP клиентов Node.js 2026

### Три уровня

```
Уровень 1: Встроенный transport
  ├── node:http / node:https   — низкоуровневый, без удобств
  ├── undici                   — bundled в Node.js 18+/24.x, fetch() реализация
  └── fetch (global)           — встроен в Node.js 18+, undici под капотом

Уровень 2: HTTP клиенты
  ├── got 14.x                 — Node.js only, ESM, богатый API
  └── ky 1.x                   — browser + Node.js, ESM, fetch-based

Уровень 3: Высокоуровневые (с axios-совместимым API)
  └── axios 1.14.0             — ⚠️ legacy, supply chain incident (см. раздел 10)
```

### Матрица выбора

| Критерий | undici / fetch | got 14.x | axios 1.14.0 |
|:--|:--|:--|:--|
| Зависимости | 0 (встроен) | ~5 ESM | ~5 |
| ESM | ✅ | ✅ only | ✅ CJS+ESM |
| Retry встроен | ❌ | ✅ | ❌ |
| Streams | ✅ | ✅ | ✅ |
| Hooks / middleware | ❌ | ✅ | ✅ interceptors |
| TypeScript | ✅ | ✅ | ✅ |
| Browser совм. | ✅ (fetch) | ❌ | ✅ |
| Supply chain риск | ✅ низкий | ✅ низкий | ⚠️ инцидент 31.03 |
| Активный рост | ✅ | ✅ | ⚠️ |

**Правило выбора:**
```
Zero-dependency + Node.js 24.x + нужен контроль пула → undici Pool
Богатый API + retry + hooks + Node.js only → got 14.x
Browser + Node.js + единый код → ky
Axios в legacy codebase → пинить 1.14.0 жёстко до аудита
```

**Практический вывод для архитектора:** В новых Node.js проектах 2026 — `undici` или `got`. `fetch()` глобальный удобен для простых запросов, но не даёт контроль над connection pooling и retry без дополнительных абстракций. Для AI API pipelines — `got` с кастомными retry hooks.

---

## 2. undici: встроенный транспорт

### Почему undici, а не node:http

```typescript
// ❌ node:http — callback API, ручное управление всем
import * as http from 'node:http';
const req = http.request({ hostname: 'api.example.com', path: '/v1/data' }, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => JSON.parse(body));
});
req.on('error', (err) => console.error(err));
req.end();

// ✅ undici — Promise API, connection pooling, HTTP/2, современный
import { request, Pool } from 'undici';
const { statusCode, body } = await request('https://api.example.com/v1/data');
const data = await body.json();
```

### undici Pool: connection reuse

```typescript
import { Pool, Dispatcher } from 'undici';

// Pool для одного origin — оптимально для AI API
const apiPool = new Pool('https://api.openai.com', {
  connections: 10,          // размер пула соединений
  pipelining: 1,            // 1 = keep-alive без pipelining (совместимость)
  keepAliveTimeout: 30_000, // держать соединение 30s после последнего запроса
  keepAliveMaxTimeout: 60_000,
  connectTimeout: 5_000,    // таймаут установки соединения
  headersTimeout: 30_000,   // таймаут получения заголовков ответа
  bodyTimeout: 60_000,      // таймаут получения тела ответа
});

interface AiApiResponse {
  id: string;
  choices: Array<{ message: { content: string } }>;
}

async function callAiApi(
  prompt: string,
  options?: { signal?: AbortSignal }
): Promise<AiApiResponse> {
  const { statusCode, body } = await apiPool.request({
    method: 'POST',
    path: '/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.CURRENT_TEXT_MODEL || "current-text-model",
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: options?.signal,
  });

  if (statusCode !== 200) {
    const errorText = await body.text();
    throw new HttpError(statusCode, errorText);
  }

  return body.json() as Promise<AiApiResponse>;
}

// Закрыть пул при shutdown
process.on('SIGTERM', async () => {
  await apiPool.close();
});
```

### undici MockAgent: тесты без сети

```typescript
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

describe('AI API client', () => {
  let mockAgent: MockAgent;
  let originalDispatcher: Dispatcher;

  beforeEach(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect(); // ✅ блокировать реальные сетевые запросы
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    setGlobalDispatcher(originalDispatcher);
    mockAgent.close();
  });

  it('должен обработать 429 и retry', async () => {
    const mockPool = mockAgent.get('https://api.openai.com');

    // Первый запрос → 429
    mockPool.intercept({ path: '/v1/chat/completions', method: 'POST' })
      .reply(429, JSON.stringify({ error: { type: 'rate_limit_exceeded' } }), {
        headers: { 'Retry-After': '1' },
      });

    // Второй запрос → 200
    mockPool.intercept({ path: '/v1/chat/completions', method: 'POST' })
      .reply(200, JSON.stringify({
        id: 'test-id',
        choices: [{ message: { content: 'Hello' } }],
      }));

    const result = await callWithRetry('Test prompt');
    expect(result.choices.message.content).toBe('Hello');
  });
});
```

**Практический вывод для архитектора:** `Pool` vs глобальный `fetch` — разница в connection reuse. Без Pool каждый запрос создаёт новое TCP соединение. Для AI API с тысячами запросов — Pool экономит 50–100ms на TLS handshake на каждый запрос.

---

## 3. got: production HTTP клиент

### Instance с дефолтами

```typescript
import got, { type Got, HTTPError, TimeoutError, RequestError } from 'got';

// ✅ Создавать instance с дефолтами — не использовать got напрямую
const apiClient: Got = got.extend({
  prefixUrl: process.env.API_BASE_URL ?? 'https://api.example.com',
  headers: {
    'User-Agent': 'MyApp/1.0 (Node.js)',
    'Accept': 'application/json',
  },
  timeout: {
    connect: 3_000,
    send: 10_000,
    response: 30_000,
  },
  retry: {
    limit: 3,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    statusCodes: ,
    errorCodes: [
      'ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE',
      'ECONNREFUSED', 'EPIPE', 'ENOTFOUND',
      'ENETUNREACH', 'EAI_AGAIN',
    ],
    calculateDelay: ({ retryAfter, attemptCount, error }) => {
      // Уважать Retry-After заголовок (AI API часто его посылают)
      if (retryAfter) return retryAfter * 1000;
      // Exponential backoff с jitter
      const base = Math.min(1000 * Math.pow(2, attemptCount - 1), 30_000);
      const jitter = Math.random() * 0.3 * base; // ±30% jitter
      return base + jitter;
    },
  },
  hooks: {
    beforeRetry: [
      (options) => {
        console.warn(
          `[HTTP] Retry ${options.retryCount} для ${options.request?.requestUrl}: ` +
          `${(options.error as HTTPError)?.response?.statusCode ?? options.error?.message}`
        );
      },
    ],
    afterResponse: [
      (response) => {
        // Логировать медленные ответы
        const duration = Date.now() - (response.timings?.start ?? 0);
        if (duration > 5000) {
          console.warn(`[HTTP] Медленный ответ: ${response.url} (${duration}ms)`);
        }
        return response;
      },
    ],
    beforeError: [
      (error) => {
        // Обогащать ошибку контекстом
        if (error instanceof HTTPError) {
          error.message = `HTTP ${error.response.statusCode} ${error.request.requestUrl}: ${
            JSON.stringify(error.response.body).slice(0, 200)
          }`;
        }
        return error;
      },
    ],
  },
});

// Типизированные методы
export async function getResource<T>(path: string): Promise<T> {
  return apiClient.get(path).json<T>();
}

export async function postResource<TBody, TResult>(
  path: string,
  data: TBody
): Promise<TResult> {
  return apiClient.post(path, { json: data }).json<TResult>();
}
```

### Обработка ошибок got

```typescript
import { HTTPError, TimeoutError, RequestError } from 'got';

type ApiErrorType =
  | 'not-found'
  | 'unauthorized'
  | 'rate-limited'
  | 'server-error'
  | 'timeout'
  | 'network';

interface NormalizedError {
  type: ApiErrorType;
  statusCode?: number;
  message: string;
  retryAfterMs?: number;
}

function normalizeGotError(err: unknown): NormalizedError {
  if (err instanceof HTTPError) {
    const status = err.response.statusCode;
    const retryAfter = err.response.headers['retry-after'];
    const retryAfterMs = retryAfter ? parseFloat(retryAfter) * 1000 : undefined;

    if (status === 404) return { type: 'not-found', statusCode: 404, message: 'Not found' };
    if (status === 401 || status === 403) return { type: 'unauthorized', statusCode: status, message: 'Auth error' };
    if (status === 429) return { type: 'rate-limited', statusCode: 429, message: 'Rate limited', retryAfterMs };
    if (status >= 500) return { type: 'server-error', statusCode: status, message: `Server error: ${status}` };
  }

  if (err instanceof TimeoutError) {
    return { type: 'timeout', message: `Timeout: ${err.event}` };
  }

  if (err instanceof RequestError) {
    return { type: 'network', message: err.message };
  }

  return { type: 'network', message: String(err) };
}
```

### Streaming с got

```typescript
import got from 'got';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

// Скачать большой файл без буферизации в памяти
async function downloadFile(url: string, destPath: string): Promise<void> {
  const downloadStream = got.stream(url, {
    timeout: { response: 30_000 },
    retry: { limit: 2 },
  });

  downloadStream.on('downloadProgress', ({ percent, transferred, total }) => {
    if (Math.floor(percent * 10) !== Math.floor((percent - 0.01) * 10)) {
      console.log(`Download: ${Math.round(percent * 100)}% (${transferred}/${total} bytes)`);
    }
  });

  await pipeline(
    downloadStream,
    createWriteStream(destPath)
  );
}
```

---

## 4. Таймауты: три уровня

### Иерархия таймаутов

```
Запрос к AI API:
  ┌──────────────────────────────────────────────────────────┐
  │  connect timeout (TCP + TLS handshake)                   │ ← 3–5s
  │  ├── Установить TCP соединение                           │
  │  └── Завершить TLS handshake                             │
  ├──────────────────────────────────────────────────────────┤
  │  send timeout (отправка тела запроса)                    │ ← 10–30s
  │  └── Отправить JSON body к API                           │
  ├──────────────────────────────────────────────────────────┤
  │  response timeout (получение первого байта ответа)       │ ← 30–120s
  │  └── Ждать начала ответа от модели                       │
  └──────────────────────────────────────────────────────────┘
  Итоговый таймаут = response timeout (самый длинный)
```

```typescript
// Профили таймаутов для разных типов запросов

const TIMEOUT_PROFILES = {
  // Быстрые API: health check, auth, metadata
  fast: {
    connect: 2_000,
    send: 5_000,
    response: 5_000,
  },
  // Стандартные API запросы
  standard: {
    connect: 3_000,
    send: 10_000,
    response: 30_000,
  },
  // AI API: inference может быть медленным
  aiInference: {
    connect: 5_000,
    send: 15_000,
    response: 120_000,  // 2 минуты для длинного контекста
  },
  // Загрузка файлов
  fileDownload: {
    connect: 5_000,
    send: 30_000,
    response: 300_000,  // 5 минут для больших файлов
  },
} as const;

// Использование
const fastClient = got.extend({ timeout: TIMEOUT_PROFILES.fast });
const aiClient = got.extend({ timeout: TIMEOUT_PROFILES.aiInference });
```

### AbortSignal для отмены запроса

```typescript
// Отмена запроса при отмене вышестоящей операции
async function processWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Operation timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// Пример: отменить AI запрос если пользователь закрыл соединение
app.post('/api/ai/process', async (req, res) => {
  const controller = new AbortController();

  // Отменить запрос при закрытии HTTP соединения клиентом
  req.on('close', () => {
    if (!res.headersSent) {
      controller.abort(new Error('Client disconnected'));
    }
  });

  try {
    const result = await callAiApi(req.body.prompt, {
      signal: controller.signal,
    });
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).end(); // Client Closed Request
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});
```

**Практический вывод для архитектора:** Нет единого таймаута — есть иерархия. Самая частая ошибка: `response: 5000` для AI inference. Модель может отвечать 30–90 секунд. `response timeout` = время до получения ПЕРВОГО байта ответа, не времени его полного получения.

---

## 5. Retry: стратегии и backoff

### Какие ошибки retry, какие нет

```typescript
// Ретраить:
const RETRYABLE_STATUS = new Set([
  408,  // Request Timeout
  429,  // Too Many Requests (rate limit)
  500,  // Internal Server Error (временные сбои)
  502,  // Bad Gateway
  503,  // Service Unavailable
  504,  // Gateway Timeout
]);

const RETRYABLE_ERRORS = new Set([
  'ETIMEDOUT',    // TCP таймаут
  'ECONNRESET',   // сброс соединения
  'ECONNREFUSED', // соединение отклонено (сервер перезапускается)
  'EPIPE',        // broken pipe
  'ENOTFOUND',    // DNS не резолвится (временно)
  'EAI_AGAIN',    // DNS retry
  'ENETUNREACH',  // сеть недоступна
]);

// НЕ ретраить:
const NON_RETRYABLE_STATUS = new Set([
  400, // Bad Request — данные невалидны, retry бессмысленен
  401, // Unauthorized — нужна новая авторизация
  403, // Forbidden — права, не временная проблема
  404, // Not Found
  409, // Conflict
  410, // Gone
  422, // Unprocessable Entity
]);
```

### p-retry: явная retry логика

```typescript
import pRetry, { AbortError } from 'p-retry';

async function callAiWithRetry(
  prompt: string,
  options?: { maxAttempts?: number; signal?: AbortSignal }
): Promise<string> {
  const { maxAttempts = 4 } = options ?? {};

  return pRetry(
    async (attemptNumber) => {
      console.log(`[AI] Попытка ${attemptNumber}/${maxAttempts}`);

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.CURRENT_TEXT_MODEL || "current-text-model",
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: options?.signal,
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitMs = retryAfter
            ? parseFloat(retryAfter) * 1000
            : 1000 * Math.pow(2, attemptNumber); // fallback exponential

          console.warn(`[AI] Rate limited. Waiting ${waitMs}ms`);
          await new Promise(r => setTimeout(r, waitMs));
          throw new Error(`Rate limited (attempt ${attemptNumber})`);
        }

        if (!response.ok) {
          // Для 4xx (кроме 429) — не ретраить
          if (response.status >= 400 && response.status < 500) {
            throw new AbortError(
              `Non-retryable error: ${response.status}`
            );
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        return data.choices.message.content;

      } catch (err: any) {
        // AbortError (отмена пользователем) — не ретраить
        if (err.name === 'AbortError' && options?.signal?.aborted) {
          throw new AbortError('Request cancelled');
        }
        throw err;
      }
    },
    {
      retries: maxAttempts - 1,
      onFailedAttempt: (error) => {
        console.warn(
          `[AI] Attempt ${error.attemptNumber} failed: ${error.message}. ` +
          `${error.retriesLeft} retries left.`
        );
      },
      // Exponential backoff: 1s → 2s → 4s → 8s (max 30s)
      minTimeout: 1_000,
      maxTimeout: 30_000,
      factor: 2,
      randomize: true, // ± jitter
      signal: options?.signal,
    }
  );
}
```

### Retry-After заголовок: правильная обработка

```typescript
function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;

  // Числовой формат: Retry-After: 30  (секунды)
  const seconds = parseFloat(header);
  if (!isNaN(seconds)) return seconds * 1000;

  // HTTP Date формат: Retry-After: Wed, 01 Apr 2026 12:00:00 GMT
  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
}
```

**Практический вывод для архитектора:** Jitter — не опциональная красота. Без jitter все инстанции сервиса retry одновременно после сбоя → новый шторм запросов → новый сбой. `randomize: true` в p-retry или ручной `+ Math.random() * base * 0.3` — обязателен для любых retry в multi-instance деплоях.

---

## 6. Circuit breaker

### Модель Circuit Breaker

```
States:
  CLOSED   → нормальная работа, запросы проходят
  OPEN     → сервис недоступен, запросы отклоняются немедленно
  HALF-OPEN → пробный запрос, если успех → CLOSED, если сбой → OPEN

Transitions:
  CLOSED → OPEN:      N сбоев за T секунд (errorThresholdPercentage)
  OPEN → HALF-OPEN:   после resetTimeout (сервис восстановился?)
  HALF-OPEN → CLOSED: успешный запрос
  HALF-OPEN → OPEN:   сбой пробного запроса

Профит:
  - Fail fast вместо ожидания таймаута
  - Защита downstream от шторма retry
  - Автоматическое восстановление
```

```typescript
import CircuitBreaker from 'opossum';

// Обернуть AI API вызов в circuit breaker
async function callAiApiRaw(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.CURRENT_TEXT_MODEL || "current-text-model",
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices.message.content;
}

const aiCircuitBreaker = new CircuitBreaker(callAiApiRaw, {
  timeout: 30_000,               // считать сбоем если нет ответа за 30s
  errorThresholdPercentage: 50,  // открыть при >50% ошибок в окне
  resetTimeout: 60_000,          // попробовать восстановить через 60s
  volumeThreshold: 5,            // минимум 5 запросов для оценки
  rollingCountTimeout: 30_000,   // окно подсчёта ошибок: 30s
  rollingCountBuckets: 6,        // 6 бакетов по 5s
});

// Fallback при открытом circuit
aiCircuitBreaker.fallback((prompt: string) => {
  console.warn('[Circuit] AI API недоступен, возвращаем fallback');
  return 'Сервис временно недоступен. Попробуйте позже.';
});

// События
aiCircuitBreaker.on('open', () =>
  console.error('[Circuit] OPEN — AI API недоступен')
);
aiCircuitBreaker.on('halfOpen', () =>
  console.log('[Circuit] HALF-OPEN — проверка восстановления')
);
aiCircuitBreaker.on('close', () =>
  console.log('[Circuit] CLOSED — AI API восстановлен')
);

// Метрики
aiCircuitBreaker.on('success', (result, latency) => {
  metrics.histogram('ai_api_latency_ms', latency);
});
aiCircuitBreaker.on('failure', (result, latency, error) => {
  metrics.increment('ai_api_failures');
});

// API
export async function callAiWithCircuitBreaker(prompt: string): Promise<string> {
  return aiCircuitBreaker.fire(prompt) as Promise<string>;
}

// Статус для health endpoint
export function getCircuitStatus() {
  return {
    state: aiCircuitBreaker.opened ? 'OPEN'
         : aiCircuitBreaker.halfOpen ? 'HALF-OPEN'
         : 'CLOSED',
    stats: aiCircuitBreaker.stats,
  };
}
```

### Circuit Breaker + Retry: правильная комбинация

```
❌ Неправильно: retry внутри circuit breaker
  Запрос → CB(retry(callApi))
  Проблема: retry скрывает ошибки от circuit breaker

✅ Правильно: retry снаружи circuit breaker
  Запрос → retry(CB(callApi))
  Circuit breaker видит каждую попытку и считает ошибки корректно
```

```typescript
// ✅ Правильный порядок
async function callAiResilient(prompt: string): Promise<string> {
  return pRetry(
    () => callAiWithCircuitBreaker(prompt), // CB внутри retry
    {
      retries: 2,
      shouldRetry: (err) => {
        // Не ретраить если circuit OPEN — бессмысленно
        if (err.message.includes('Circuit breaker is open')) return false;
        return true;
      },
    }
  );
}
```

---

## 7. Connection pooling и keep-alive

### Почему pooling критичен для AI API

```
Без pooling (новое соединение каждый запрос):
  DNS lookup:      10–50ms
  TCP connect:     20–100ms
  TLS handshake:   50–200ms
  Overhead total:  80–350ms PER REQUEST

С undici Pool (keep-alive):
  Первый запрос:   80–350ms (TLS handshake один раз)
  Последующие:     0ms overhead (соединение переиспользуется)

При 1000 запросов/сек к AI API:
  Без pool:   350ms × 1000 = 350s избыточного overhead
  С pool:     ~0ms
```

```typescript
import { Pool, Agent, setGlobalDispatcher } from 'undici';

// Глобальный Agent для fetch() с настройками pool
const globalAgent = new Agent({
  connections: 50,           // пул соединений на origin
  pipelining: 1,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connect: {
    timeout: 5_000,
    rejectUnauthorized: true,  // ✅ всегда в production
  },
});

// Применить к глобальному fetch
setGlobalDispatcher(globalAgent);

// Отдельный пул для AI API (другие параметры)
export const aiApiPool = new Pool('https://api.openai.com', {
  connections: 20,           // меньше — AI API часто имеет лимиты
  pipelining: 1,
  keepAliveTimeout: 60_000,  // дольше держать — TLS дорогой
  connectTimeout: 5_000,
  headersTimeout: 10_000,
  bodyTimeout: 120_000,      // inference может быть длинным
});

// Статус пула для health check
export function getPoolStats() {
  const stats = aiApiPool.stats;
  return {
    connected: stats.connected,
    free: stats.free,
    pending: stats.pending,
    queued: stats.queued,
    running: stats.running,
    size: stats.size,
  };
}
```

---

## 8. Работа с AI API: rate limits и streaming

### Rate limit detection и handling

```typescript
interface RateLimitInfo {
  limitRequests?: number;
  remainingRequests?: number;
  resetRequestsMs?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokensMs?: number;
}

function parseOpenAiRateLimitHeaders(
  headers: Headers | Record<string, string>
): RateLimitInfo {
  const get = (name: string): string | null =>
    headers instanceof Headers
      ? headers.get(name)
      : (headers[name] ?? null);

  return {
    limitRequests: parseIntOrUndefined(get('x-ratelimit-limit-requests')),
    remainingRequests: parseIntOrUndefined(get('x-ratelimit-remaining-requests')),
    resetRequestsMs: parseDurationMs(get('x-ratelimit-reset-requests')),
    limitTokens: parseIntOrUndefined(get('x-ratelimit-limit-tokens')),
    remainingTokens: parseIntOrUndefined(get('x-ratelimit-remaining-tokens')),
    resetTokensMs: parseDurationMs(get('x-ratelimit-reset-tokens')),
  };
}

// OpenAI reset время: "1m30s", "500ms", "2s"
function parseDurationMs(value: string | null): number | undefined {
  if (!value) return undefined;
  let ms = 0;
  const minutes = value.match(/(\d+)m/);
  const seconds = value.match(/(\d+\.?\d*)s/);
  const milliseconds = value.match(/(\d+)ms/);
  if (minutes) ms += parseInt(minutes) * 60_000;[^1]
  if (seconds) ms += parseFloat(seconds) * 1_000;[^1]
  if (milliseconds) ms += parseInt(milliseconds);[^1]
  return ms || undefined;
}

function parseIntOrUndefined(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value);
  return isNaN(n) ? undefined : n;
}
```

### SSE Streaming от AI API

```typescript
import { request } from 'undici';

interface StreamChunk {
  id: string;
  delta: string;
  finishReason?: string;
}

async function* streamCompletion(
  prompt: string,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const { statusCode, body } = await request(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: process.env.CURRENT_TEXT_MODEL || "current-text-model",
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
      signal,
    }
  );

  if (statusCode !== 200) {
    const errorBody = await body.text();
    throw new Error(`AI API error ${statusCode}: ${errorBody}`);
  }

  // Парсить SSE поток
  let buffer = '';

  for await (const chunk of body) {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // незавершённая строка в буфер

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.?.delta?.content;
        const finishReason = parsed.choices?.?.finish_reason;

        if (delta || finishReason) {
          yield {
            id: parsed.id,
            delta: delta ?? '',
            finishReason: finishReason ?? undefined,
          };
        }
      } catch {
        // Пропустить невалидный JSON чанк
      }
    }
  }
}

// Использование в HTTP endpoint (Server-Sent Events)
app.get('/api/ai/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    for await (const chunk of streamCompletion(
      req.query.prompt as string,
      controller.signal
    )) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  } finally {
    res.end();
  }
});
```

---

## 9. Observability: метрики и трассировка

### HTTP метрики через got hooks

```typescript
import got from 'got';

// Метрики для Prometheus / любого коллектора
interface HttpMetrics {
  increment(name: string, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
}

function createInstrumentedClient(metrics: HttpMetrics): typeof got {
  return got.extend({
    hooks: {
      beforeRequest: [
        (options) => {
          (options as any)._startTime = Date.now();
        },
      ],
      afterResponse: [
        (response) => {
          const startTime = (response.request.options as any)._startTime ?? Date.now();
          const duration = Date.now() - startTime;
          const labels = {
            method: response.request.options.method ?? 'GET',
            status: String(response.statusCode),
            host: new URL(response.url).hostname,
          };

          metrics.histogram('http_request_duration_ms', duration, labels);
          metrics.increment('http_requests_total', labels);
          return response;
        },
      ],
      beforeRetry: [
        (options) => {
          metrics.increment('http_retries_total', {
            host: new URL(String(options.request?.requestUrl)).hostname,
            attempt: String(options.retryCount),
          });
        },
      ],
      beforeError: [
        (error) => {
          metrics.increment('http_errors_total', {
            type: error.constructor.name,
          });
          return error;
        },
      ],
    },
  });
}
```

### OpenTelemetry трассировка HTTP запросов

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

// undici и встроенный fetch — автоматически трассируются
const sdk = new NodeSDK({
  instrumentations: [
    new HttpInstrumentation({
      // Фильтровать health check endpoints
      ignoreIncomingRequestHook: (req) =>
        req.url === '/health' || req.url === '/metrics',
    }),
    new UndiciInstrumentation({
      // Добавить атрибуты к spans
      requestHook: (span, { request }) => {
        span.setAttribute('http.request.body.size',
          Buffer.byteLength(request.body?.toString() ?? '')
        );
      },
    }),
  ],
});
```

---

## 10. Supply chain: axios инцидент 2026

> ⚠️ **Актуально:** события 30–31 марта 2026.

### Что произошло

31 марта 2026 в npm были опубликованы `axios@1.14.1` и `axios@0.30.4` через скомпрометированный аккаунт мейнтейнера `jasonsaayman`. [web:151][web:152]

**Механизм атаки:**
```
1. Атакующий получил доступ к npm аккаунту jasonsaayman
2. Сменил email аккаунта на анонимный ProtonMail
3. Опубликовал axios@1.14.1 и axios@0.30.4 вручную через npm CLI
   (минуя GitHub Actions OIDC pipeline — соответствующих коммитов нет)
4. Инъектировал зависимость plain-crypto-js@4.2.1 (маскируется под crypto-js)
5. plain-crypto-js в postinstall устанавливает cross-platform RAT
   (macOS, Windows, Linux)
6. RAT самоудаляется после установки
```

**Затронутые версии:** `axios@1.14.1`, `axios@0.30.4`
**Безопасные версии:** `axios@1.14.0`, `axios@0.30.3`

### Диагностика

```bash
# Проверить установленную версию
npm list axios

# Проверить наличие malicious dependency
ls node_modules/plain-crypto-js

# Если заражены — немедленно:
npm install axios@1.14.0
rm -rf node_modules/plain-crypto-js
npm install --ignore-scripts

# Ротировать все credentials на заражённых системах:
# npm tokens, cloud keys, SSH keys, CI/CD secrets
```

### Защита от supply chain атак

```typescript
// package.json: жёсткий пин для критичных зависимостей
{
  "dependencies": {
    "axios": "1.14.0"   // ✅ точная версия без ^ и ~
  }
}

// .npmrc: запрет postinstall скриптов (защита от RAT dropper)
// ignore-scripts=true  ← глобально, может сломать нативные модули

// Для CI/CD — проверять integrity через lockfile:
// npm ci --ignore-scripts

// Для production — использовать undici/got вместо axios:
// нулевые или минимальные зависимости = меньше attack surface
```

### Архитектурный вывод

```
Аксиома supply chain безопасности:
  Популярность пакета ∝ привлекательность для атаки

axios: 100M+ загрузок/неделю = максимальная цель
undici: встроен в Node.js (npm maintainer = Node.js core team)
got: 5M загрузок/неделю, меньшая поверхность

Для новых проектов (март 2026+):
  ✅ undici (Node.js 24.x, zero external deps)
  ✅ got 14.6.6
  ⚠️ axios — только при явной необходимости, пинить 1.14.0
```

**Практический вывод для архитектора:** Этот инцидент — аргумент в пользу `undici` для новых проектов. Встроен в Node.js, npm maintainer = Node.js core team, нулевые внешние зависимости. Attack surface минимален по определению.

---

## 11. Реальный кейс

> ⚠️ **Раздел ожидает данных от автора.**
> Формат: входные данные → гипотеза → результат → вывод противоречащий интуиции.
> Кандидаты: retry стратегия для нестабильного AI API, circuit breaker для внешнего документооборота, оптимизация connection pooling.

---

## 12. Антипаттерны

### «Один глобальный таймаут на все запросы»

**Выглядит правильно:** единообразно, просто.

**Почему ошибка:** health check нужно 2s, AI inference нужно 120s. Единый таймаут 120s → health check висит 2 минуты при сбое. Единый 2s → AI inference никогда не успевает. Профили таймаутов по типу запроса — обязательны.

---

### «Retry без jitter»

**Выглядит правильно:** экспоненциальный backoff — стандарт.

**Почему ошибка:** все инстанции сервиса падают одновременно → retry одновременно с одинаковой задержкой → шторм повторных запросов → повторный сбой. `randomize: true` или `jitter = random * 0.3 * delay` — обязателен в multi-instance деплое.

---

### «Retry для всех HTTP ошибок»

**Выглядит правильно:** устойчивость к ошибкам.

**Почему ошибка:** `400 Bad Request` при retry вернёт тот же `400` — данные запроса не изменились. `401 Unauthorized` при retry без обновления токена — то же самое. Retry для 4xx (кроме 429) = бессмысленный overhead и замедленная обработка ошибок.

---

### «Circuit breaker без fallback»

**Выглядит правильно:** защита downstream.

**Почему ошибка:** открытый circuit без fallback = `CircuitBreakerOpenError` для пользователя. Каждый сервис должен определить деградированное поведение: кэш, дефолтный ответ, очередь для отложенной обработки. `opossum.fallback()` — не опция, обязательная часть circuit breaker.

---

### «Новый экземпляр got / fetch без Pool на каждый запрос»

**Выглядит правильно:** изолированно, нет shared state.

**Почему ошибка:** каждый запрос создаёт новое TCP + TLS соединение = 80–350ms overhead. При 100 запросах к AI API в секунду — 8–35 секунд чистого overhead. `got.extend()` instance и `undici.Pool` — создавать один раз, переиспользовать.

---

### «npm install axios без пина версии (март 2026)»

**Выглядит правильно:** получить последнюю версию.

**Почему ошибка:** после инцидента 31.03.2026 — `axios@1.14.1` активно ретроспективно исключается из registry, но window заражения несколько часов. Любой `npm install axios` или `npm update` в этом окне мог установить malicious версию. Точный пин `"axios": "1.14.0"` — единственная защита.

---

## Задачи AI-кодеру

**Задача 1 — Resilient AI API client**

Плохая формулировка:
> «Сделай HTTP клиент для AI API»

Хорошая формулировка:
> «Реализуй TypeScript класс `AiApiClient` использующий undici 7.24.6 Pool. Конструктор принимает `{baseUrl: string, apiKey: string, poolSize?: number, inferenceTimeoutMs?: number}`. Дефолты: poolSize=10, inferenceTimeoutMs=120000. Метод `complete(prompt: string, signal?: AbortSignal): Promise<string>` — POST /v1/chat/completions, model: process.env.CURRENT_TEXT_MODEL || "current-text-model", парсить choices[^0].message.content. Retry через p-retry 6.x: maxAttempts=4, exponential backoff с jitter (randomize: true), ретраить только 429/500/502/503/504 и network ошибки. Для 429 — читать Retry-After заголовок и ждать указанное время. AbortError — немедленно выбрасывать без retry. Метод `getStats()` возвращает `{connected, free, pending}` из Pool stats.»

Формула: pooling + retry семантика + Retry-After + AbortError handling + stats.

---

**Задача 2 — Circuit breaker с метриками**

Плохая формулировка:
> «Добавь circuit breaker для внешнего API»

Хорошая формулировка:
> «Реализуй TypeScript функцию `createCircuitBreaker<T>(fn: (...args: any[]) => Promise<T>, options: {name: string, timeout?: number, errorThreshold?: number, resetTimeout?: number, fallback?: (...args: any[]) => T|Promise<T>}): {fire: (...args: any[]) => Promise<T>, getStatus: () => {state: 'CLOSED'|'OPEN'|'HALF-OPEN', stats: object}}`. Использовать opossum 8.x. Дефолты: timeout=30000, errorThreshold=50, resetTimeout=60000. Логировать state transitions (open/halfOpen/close) через console.warn/log. На каждый success — вызывать metrics.histogram("cb_latency_ms", latency, {name}). На каждый failure — metrics.increment("cb_failures", {name}). metrics — глобальный объект передаваемый при инициализации модуля.»

Формула: дженерик + все опции + state logging + метрики + экспорт status.

---

**Задача 3 — SSE streaming proxy**

Плохая формулировка:
> «Проксируй стриминг от AI API»

Хорошая формулировка:
> «Реализуй Express middleware `streamAiProxy(req: Request, res: Response): Promise<void>`. Читать prompt из `req.body.prompt` (string). Устанавливать заголовки SSE: Content-Type=text/event-stream, Cache-Control=no-cache, Connection=keep-alive. Использовать undici 7.24.6 request к https://api.openai.com/v1/chat/completions с stream:true. Парсить SSE: каждая строка начинающаяся с "data: " — extract JSON, взять choices[^0].delta.content, писать в res через `res.write("data: " + JSON.stringify({delta}) + "\\n\\n")`. При получении "[DONE]" — `res.write("data: [DONE]\\n\\n")` и `res.end()`. При `req.on("close")` — AbortController.abort(). Ошибки 429 — писать `data: {"error":"rate_limited"}` и завершать.»

Формула: SSE формат + SSE парсинг + AbortController + error events + chunked write.

---

## Чеклист архитектора

### Клиент
- [ ] `undici.Pool` или `got.extend()` — singleton, не создавать на запрос
- [ ] Таймауты: профили по типу запроса (fast / standard / aiInference)
- [ ] `AbortSignal` пробрасывается от HTTP запроса клиента до downstream

### Retry
- [ ] Retry только для retryable status codes: 429, 5xx + network errors
- [ ] Retry НЕ для 4xx (кроме 429) — `AbortError` или прямой throw
- [ ] Jitter обязателен в multi-instance деплое
- [ ] `Retry-After` заголовок уважается для 429

### Resilience
- [ ] Circuit breaker для каждого внешнего API
- [ ] Fallback определён для каждого circuit
- [ ] Retry снаружи circuit breaker, не внутри
- [ ] Circuit status экспортируется в `/health` endpoint

### Security
- [ ] `axios` в зависимостях — проверить версию, пинить `1.14.0`
- [ ] `npm ci --ignore-scripts` в CI/CD pipeline
- [ ] `rejectUnauthorized: true` в TLS конфигурации — всегда

### Observability
- [ ] Latency histogram по `{method, status, host}`
- [ ] Retry counter с `{host, attempt}`
- [ ] Pool stats (`connected`, `pending`) в health/metrics endpoint

---

*Модуль 19 завершён.*
*Следующий: [Модуль 20 — Backend caching: Redis, in-memory, CDN](../20-backend-caching/README.md)*
