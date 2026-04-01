# GLOSSARY — Logging / Observability

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**AsyncLocalStorage**  
Node.js API (`async_hooks`) для хранения контекста, привязанного к async execution chain. Позволяет распространять request-scoped данные (requestId, userId) через весь async стек без явной передачи параметров. `storage.run(value, callback)` — установить контекст. `storage.getStore()` — прочитать из любой точки цепочки.

**auto-instrumentation**  
Автоматическое добавление telemetry в известные библиотеки без изменения кода. `@opentelemetry/auto-instrumentations-node` патчит http, express, pg, redis и др. Требует инициализации OTel SDK до первого импорта этих библиотек.

---

## C

**child logger**  
Производный logger, созданный через `logger.child(bindings)`. Наследует настройки родителя, добавляет фиксированные поля (bindings) к каждой записи. Bindings сериализуются один раз при создании — дешевле чем передавать в каждый вызов.

**Counter**  
OTel metric: монотонно возрастающее значение. Никогда не убывает. Примеры: количество запросов, ошибок, обработанных задач. `meter.createCounter()`.

---

## H

**Histogram**  
OTel metric: распределение значений по bucket boundaries. Используется для latency, размеров файлов. Позволяет вычислять p50/p95/p99. `advice.explicitBucketBoundaries` — явно задать границы для точности.

---

## L

**log level**  
Числовой приоритет записи: trace(10) < debug(20) < info(30) < warn(40) < error(50) < fatal(60). Записи ниже текущего уровня отбрасываются без сериализации. Управляется через `LOG_LEVEL` env var.

**Loki**  
Система агрегации логов от Grafana Labs. Хранит только индексы labels (не полный текст), сам текст — в object storage. Дешевле Elasticsearch. Query язык: LogQL.

---

## O

**observability**  
Способность понять внутреннее состояние системы по внешним выходам. Три столпа: logs (что произошло), traces (где и как долго), metrics (агрегированное состояние). Система observable если на вопрос «что произошло с запросом X?» можно ответить без изменения кода.

**OpenTelemetry (OTel)**  
Vendor-neutral стандарт для instrumentation: API + SDK + протокол OTLP. SDK 2.0 (2025): минимум Node.js 18.19+, TypeScript 5.0+, ES2022. Экспортирует в любой backend (Jaeger, Grafana Tempo, Datadog, Honeycomb).

**OTLP (OpenTelemetry Protocol)**  
Протокол передачи telemetry данных. HTTP/JSON (`/v1/traces`, `/v1/metrics`, `/v1/logs`) или gRPC. Стандартный порт: 4318 (HTTP), 4317 (gRPC).

---

## P

**PeriodicExportingMetricReader**  
OTel компонент: собирает метрики с заданным интервалом (`exportIntervalMillis`) и отправляет в exporter. Заменяет устаревший `metricReader` (singular) — использовать `metricReaders: []` (массив).

**pino**  
JSON logger для Node.js. Асинхронная запись через worker thread, `fast-json-stringify` для сериализации. ~5× быстрее Winston. Транспорт: stdout (production), pino-pretty (development).

**pino-http**  
Middleware для Express/Fastify: логирует каждый HTTP request/response. Поддерживает customLogLevel, serializers, ignore rules.

---

## R

**redact**  
Pino механизм маскирования чувствительных данных по JSON path. `paths: ['req.headers.authorization']` → значение заменяется на `[REDACTED]`. Работает до сериализации — безопасен по умолчанию.

**requestId**  
Уникальный идентификатор запроса (UUID), генерируется при входе в сервис. Передаётся через `x-request-id` header в downstream сервисы. Должен присутствовать в каждой log-записи — позволяет найти все события конкретного запроса.

**Resource (OTel)**  
Набор атрибутов, описывающих источник telemetry данных: `service.name`, `service.version`, `deployment.environment`. Прикрепляется ко всем spans и metrics от процесса.

---

## S

**sampling**  
Выборочная запись/экспорт данных для контроля объёма. Head sampling: решение на входе span. Tail sampling: решение после завершения trace (позволяет сохранить ошибочные traces). Log sampling: логировать только N% успешных запросов.

**span**  
Единица работы в OTel tracing: имеет start/end время, атрибуты, события, статус. Spans образуют trace дерево через parent span ID. `span.end()` обязателен — незакрытый span не экспортируется.

**structured logging**  
Логирование в машиночитаемом формате (JSON) вместо произвольных строк. Каждое поле — отдельный ключ, доступный для фильтрации. Противоположность: `"User 123 logged in at 14:32"` vs `{"userId":123,"event":"login","ts":"14:32"}`.

---

## T

**trace**  
Полное дерево spans, описывающее путь одного запроса через систему. Идентифицируется через `traceId` (16 байт hex). Позволяет увидеть весь путь запроса, включая вызовы в другие сервисы.

**traceId**  
16-байтный hex идентификатор trace. Одинаков для всех spans в пределах одного запроса, включая downstream сервисы. Должен пробрасываться в лог-записи для корреляции logs+traces.

---

## U

**UpDownCounter**  
OTel metric: значение может возрастать и убывать. Для текущего состояния: количество активных соединений, размер очереди. `meter.createUpDownCounter()`.

---

*Глоссарий модуля 26. Следующий: [Модуль 27 — Static site generation](../27-static-site/GLOSSARY.md)*
