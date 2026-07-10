# ADR-002: Очередь задач — BullMQ vs pg-boss

## Статус
Принято

## Контекст
- Система: документооборот с batch-обработкой PDF
- Нагрузка: ~1000 задач/день, непиковая
- Стек: уже есть PostgreSQL 17, Redis — нет
- Требования: exactly-once для финансовых документов

## Рассмотренные варианты

### Вариант A: BullMQ 5.x + Redis 7
- Доступно: Redis отдельно не развёрнут — ещё один сервис
- Гарантии: at-least-once
- DAG: нативный через FlowProducer
- Мониторинг: Bull Board UI
- Ссылки: [Модуль 18 §3](../18-task-queues/README.md#3-queue-и-worker-базовый-паттерн)

### Вариант B: pg-boss 12.x (на существующем Postgres)
- Доступно: zero дополнительной инфраструктуры
- Гарантии: exactly-once через SKIP LOCKED
- DAG: нет нативного — реализовать через parent_job_id
- Мониторинг: SQL запросы
- Ссылки: [Модуль 18 §7](../18-task-queues/README.md#7-pg-boss)

## Решение
Выбран **Вариант B (pg-boss)**.

## Обоснование
1. 1000 задач/день << 5000 job/s порога pg-boss — Redis избыточен
2. Exactly-once критичен для финдокументов
3. Отсутствие Redis в стеке = меньше движущихся частей

## Последствия
- DAG pipeline — ручное управление статусами (parent_job_id поле)
- Мониторинг через SQL, не через UI
- Graceful shutdown через boss.stop() + pool.end()

## Связанные решения
- [Модуль 18 §7 — pg-boss](../18-task-queues/README.md#7-pg-boss)
- [Модуль 24 §3 — Docker Compose](../24-docker/README.md#3-buildkit)
