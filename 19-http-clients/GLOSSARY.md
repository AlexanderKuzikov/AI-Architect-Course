# GLOSSARY — HTTP клиенты и retry стратегии

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**AbortController / AbortSignal**  
Web API для отмены асинхронных операций. `AbortController.abort()` передаёт сигнал через `signal` во все подписанные операции. undici, got, fetch — поддерживают `signal` нативно. При отмене выбрасывается `AbortError` (name: 'AbortError'). Пробрасывать signal от HTTP запроса клиента до downstream — основа cancel propagation.

**AbortError**  
Ошибка сигнализирующая об отмене операции через AbortSignal. В контексте retry — не ретраить: если клиент отменил запрос, повторная попытка бессмысленна. В p-retry: `throw new AbortError(...)` прекращает retry немедленно.

---

## B

**backoff**  
Стратегия задержки между retry попытками. Типы: `exponential` — задержка удваивается (`delay * factor^attemptNumber`), cap рекомендован ≤30s; `fixed` — постоянная задержка; `linear` — линейный рост. Без jitter в multi-instance деплое приводит к thundering herd.

**body timeout**  
Таймаут на получение полного тела ответа после получения первого байта. В undici: `bodyTimeout`. Для AI inference streaming — должен быть достаточным для полного потока (120–300s). Не путать с `headersTimeout`.

---

## C

**circuit breaker**  
Паттерн устойчивости: автоматически отклоняет запросы к нестабильному сервису без ожидания таймаута. Три состояния: CLOSED (нормальная работа), OPEN (fail fast), HALF-OPEN (пробный запрос). npm: `opossum` 8.x. Обязателен в сочетании с fallback.

**CLOSED state**  
Нормальное состояние circuit breaker: запросы проходят через него к downstream сервису. Переходит в OPEN при превышении `errorThresholdPercentage` в скользящем окне.

**connect timeout**  
Таймаут на установку TCP соединения + TLS handshake. В got: `timeout.connect`. В undici Pool: `connectTimeout`. Обычно 2–5s. Короче чем response timeout — DNS и TCP должны резолвиться быстро.

**connection pooling**  
Переиспользование TCP/TLS соединений между запросами к одному origin. Устраняет 80–350ms overhead на DNS lookup + TCP connect + TLS handshake для каждого запроса. undici: `Pool`. Без пула при 100 req/s к AI API = десятки секунд потерянного времени.

---

## E

**errorThresholdPercentage**  
Параметр opossum circuit breaker: процент ошибок в скользящем окне после которого circuit переходит в OPEN. Дефолт: 50%. При `volumeThreshold: 5` — срабатывает только если было минимум 5 запросов в окне.

**ESM-only**  
Модуль распространяемый только как ES Module (import/export). got 14.x и ky 1.x — ESM-only. Несовместимы с `require()` без динамического `import()`. В TypeScript: `"module": "ESNext"`, `"moduleResolution": "bundler"` или `"node16"`.

---

## F

**fallback (circuit breaker)**  
Функция вызываемая при открытом circuit или timeout: возвращает деградированный ответ вместо ошибки. `opossum.fallback(fn)`. Обязательная часть circuit breaker — без fallback открытый circuit = ошибка для пользователя.

**fetch (global)**  
Глобальная функция HTTP запросов в Node.js 18+ (undici под капотом). Удобна для простых запросов. Не даёт прямого контроля над connection pool — для production throughput использовать undici Pool или got.

---

## G

**got**  
Node.js HTTP клиент. Версия 14.6.6 (март 2026). ESM-only. Особенности: встроенный retry с `calculateDelay`, hooks (beforeRequest, afterResponse, beforeRetry, beforeError), TypeScript нативно. Не работает в браузере. Singleton через `got.extend()`.

---

## H

**HALF-OPEN state**  
Промежуточное состояние circuit breaker: после `resetTimeout` пропускается один пробный запрос. Успех → CLOSED. Сбой → OPEN снова. Механизм автоматического восстановления без ручного вмешательства.

**headersTimeout**  
Таймаут от отправки запроса до получения HTTP заголовков ответа (HTTP status line + headers). В undici Pool. Отличается от `bodyTimeout` — измеряет только время до начала ответа сервера.

---

## J

**jitter**  
Случайная добавка к времени backoff. `delay = base + random() * 0.3 * base`. Цель: desynchronize retry попытки разных инстанций сервиса. Без jitter при одновременном сбое N инстанций все retry происходят в одно время → thundering herd. p-retry: `randomize: true`.

---

## K

**keep-alive**  
HTTP механизм: соединение остаётся открытым после запроса для последующих запросов к тому же origin. undici Pool: `keepAliveTimeout` — время ожидания следующего запроса. Основа connection pooling эффективности.

**ky**  
HTTP клиент на основе fetch. Версия 1.x (март 2026). ESM-only. Работает в браузере и Node.js. Меньше возможностей чем got (нет retry callbacks уровня got), но универсален. Использовать для isomorphic кода.

---

## M

**MockAgent (undici)**  
undici класс для mock HTTP в тестах. `mockAgent.disableNetConnect()` блокирует реальные сетевые запросы. `mockAgent.get(origin).intercept({path, method}).reply(status, body)` — имитирует ответы. Устанавливается через `setGlobalDispatcher(mockAgent)`.

---

## O

**OPEN state**  
Состояние circuit breaker: все запросы немедленно отклоняются без обращения к downstream. Вызывается fallback. Длится `resetTimeout` мс, затем переход в HALF-OPEN.

**opossum**  
Node.js библиотека circuit breaker. Версия 8.x (март 2026). API: `new CircuitBreaker(fn, options)`, `.fire(...args)`, `.fallback(fn)`, события: `open`, `halfOpen`, `close`, `success`, `failure`. Prometheus/OTel интеграция из коробки.

---

## P

**p-retry**  
npm утилита для retry с backoff. Версия 6.x (март 2026). ESM-only. Параметры: `retries`, `minTimeout`, `maxTimeout`, `factor`, `randomize`, `signal`. `AbortError` прекращает retry немедленно. `onFailedAttempt` — callback для логирования.

**pipelining**  
HTTP/1.1 feature: отправлять несколько запросов без ожидания ответа. undici Pool: `pipelining: 1` = keep-alive без pipelining (максимальная совместимость). `pipelining: 0` = новое соединение на каждый запрос. Большинство AI API не поддерживают pipelining.

**Pool (undici)**  
undici класс для connection pooling к одному origin. `new Pool(origin, options)`. Параметры: `connections` (размер пула), `pipelining`, `keepAliveTimeout`, `connectTimeout`, `headersTimeout`, `bodyTimeout`. Создавать singleton, переиспользовать.

---

## R

**RAT (Remote Access Trojan)**  
Вредоносный инструмент удалённого доступа. В контексте модуля: тип малварь встроенной в `axios@1.14.1` и `axios@0.30.4` через скомпрометированный npm аккаунт (31.03.2026). Устанавливался через postinstall скрипт транзитивной зависимости `plain-crypto-js`.

**response timeout**  
Таймаут от отправки запроса до получения первого байта тела ответа. В got: `timeout.response`. Для AI inference — самый критичный таймаут: модель может начать отвечать через 30–60s. Не путать с общим временем получения ответа.

**resetTimeout**  
Параметр opossum: время (мс) в состоянии OPEN до попытки HALF-OPEN. Дефолт: 30000 (30s). После истечения circuit пропускает один пробный запрос. При успехе — CLOSED, при сбое — снова OPEN на resetTimeout.

**Retry-After**  
HTTP заголовок: указывает клиенту сколько ждать перед повторным запросом. Форматы: числовые секунды (`Retry-After: 30`) или HTTP дата (`Retry-After: Wed, 01 Apr 2026 12:00:00 GMT`). Обязателен к уважению при 429 ответах от AI API.

**rollingCountTimeout**  
Параметр opossum: размер скользящего окна (мс) для подсчёта ошибок. `rollingCountBuckets` делит окно на бакеты. Пример: `rollingCountTimeout: 30000, rollingCountBuckets: 6` = 6 бакетов по 5s.

---

## S

**send timeout**  
Таймаут на отправку тела запроса. В got: `timeout.send`. Для большинства JSON запросов к AI API — 10–15s. Критично при отправке больших файлов или base64-encoded изображений.

**SSE (Server-Sent Events)**  
HTTP механизм для однонаправленного стриминга от сервера к клиенту. Content-Type: `text/event-stream`. Формат: `data: {json}\n\n`. AI API (OpenAI, Anthropic) используют SSE для streaming completion. Терминальное событие: `data: [DONE]\n\n`.

**supply chain attack**  
Атака на цепочку поставок ПО: компрометация trusted dependency вместо прямой атаки на цель. Вектор axios инцидента 31.03.2026: захват npm аккаунта мейнтейнера → публикация malicious версии. Защита: точный пин версий в package.json, `--ignore-scripts` в CI.

---

## T

**thundering herd**  
Эффект одновременного шторма retry запросов. Возникает когда N инстанций сервиса одновременно переходят в retry с одинаковым backoff. Решение: jitter в backoff стратегии.

**TLS handshake**  
Процедура установки зашифрованного соединения. Занимает 50–200ms. При connection pooling происходит один раз на соединение, затем соединение переиспользуется. Один из главных аргументов для использования Pool.

---

## U

**undici**  
Node.js HTTP/1.1 клиент. Версия 7.24.6 (март 2026). Bundled в Node.js 18+. Реализует глобальный `fetch()` в Node.js. Классы: `request` (single request), `Pool` (connection pooling), `Agent` (global dispatcher), `MockAgent` (тесты). Нулевые внешние зависимости.

---

## V

**volumeThreshold (opossum)**  
Минимальное число запросов в скользящем окне для оценки процента ошибок. При `volumeThreshold: 5` и 3 запросах — circuit не откроется даже при 100% ошибок. Защита от ложных срабатываний при низком трафике.

---

## Б

**Бэкофф** → см. *backoff*

---

## Д

**Дроппер (dropper)**  
Вредоносный компонент устанавливающий основной payload. В axios инциденте: `plain-crypto-js` — dropper, устанавливающий RAT через postinstall скрипт.

---

## З

**Задержка соединения** → см. *connect timeout*

---

## О

**Отмена запроса** → см. *AbortController / AbortSignal*

**Откат соединения** → см. *circuit breaker*

---

## П

**Пин версии**  
Точная фиксация версии зависимости в package.json без `^` или `~`. `"axios": "1.14.0"` вместо `"axios": "^1.14.0"`. Защита от автоматической установки скомпрометированных версий при `npm install` или `npm update`.

**Пул соединений** → см. *connection pooling*

---

## С

**Скользящее окно** → см. *rollingCountTimeout*

**Стриминг ответа** → см. *SSE*

---

*Глоссарий модуля 19. Следующий: [Модуль 20 — Backend caching: Redis, in-memory, CDN*](../20-backend-caching/GLOSSARY.md)