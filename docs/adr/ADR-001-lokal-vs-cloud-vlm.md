# ADR-001: Локальная vs облачная VLM для extraction

## Статус
Принято

## Контекст
- Pipeline: 2000–5000 документов/месяц, batch processing
- Железо: GTX 1660 6 ГБ, Ryzen 5 3600
- Требования: data privacy (данные клиентов не должны покидать периметр)
- Бюджет: $100/мес на inference

## Рассмотренные варианты

### Вариант A: Локальная VLM (LM Studio + CURRENT_VLM_MODEL Q4_K_M)
- Латенси: ~5–6 img/min, TTFT ~800ms
- Стоимость: $0 (только электричество, ~$5/мес)
- Приватность: данные не покидают машину
- Качество: 94% accuracy (тест 500 документов)
- Ссылка: [Модуль 10](../10-prompt-engineering-vlm/README.md), [Модуль 08](../08-local-inference/README.md)

### Вариант B: Облачная VLM (OpenAI/Claude API)
- Латенси: ~15–20 img/min, TTFT ~300ms
- Стоимость: ~$0.03/image × 3500 изображений = $105/мес
- Приватность: данные уходят к провайдеру
- Качество: 96% accuracy (те же 500 документов)
- Ссылка: [Модуль 10 §7](../10-prompt-engineering-vlm/README.md#7-production-pipeline)

## Решение
Выбран **Вариант A (локальная VLM)**.

## Обоснование
1. +2% accuracy не окупает потерю приватности и $105/мес
2. 5–6 img/min × 8 часов/день × 22 дня = ~5000–8000 img/мес — достаточно
3. Q4_K_M compact local влезает в 6 ГБ VRAM (модуль 08 §1)

## Последствия
- Pre-processing: auto-rotate + contrast enhancement обязателен (модуль 10 §Real case)
- Concurrency ограничена 2 параллельными запросами (VRAM)
- Hybrid routing: pytesseract + text LLM для чистых сканов, VLM только для сложных (модуль 11 §4)

## Связанные решения
- [Модуль 08 §1 — VRAM Budget](../08-local-inference/README.md#1-vram-budget)
- [Модуль 11 §4 — Cascade Filter](../11-multi-model-orchestration/README.md#4-cascade-filter)
