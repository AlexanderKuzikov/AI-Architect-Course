# GLOSSARY — AgentOps

## A

**AgentOps**  
Observability, tracing, evaluation, guardrails и cost control для LLM/agent systems. Отвечает на вопросы: что агент сделал, сколько стоило, как быстро, какое качество, что сломалось.

---

## C

**Cost per Task**  
Стоимость выполнения одной задачи агента. Ключевой бюджет: tools, memory, rerankers, judge calls и retries часто стоят больше самой генерации.

---

## D

**Deterministic Checks**  
Автоматические проверки без LLM: JSON schema, secrets, max latency, forbidden actions. Самый надёжный и дешёвый слой evals.

---

## E

**Evaluation Tier**  
Уровень проверки: deterministic (каждый PR) → golden dataset (PR/nightly) → LLM judge (pre-release) → human review (high-risk).

---

## F

**Fallback**  
Переключение на резервную модель/провайдера при отказе или превышении бюджета. Должен логироваться (`gen_ai.fallback: true`), иначе cost-метрики врут.

---

## G

**gen_ai.*** (OTel LLM Conventions)  
Стандартные атрибуты OpenTelemetry для LLM: `gen_ai.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`. Инструменты понимают их из коробки.

**Golden Dataset**  
Версионированный набор эталонных примеров с точными expected outputs. Ловит регрессии, которые LLM judge пропускает.

**Guardrail**  
Проверка output на границе: PII, secrets, forbidden actions, schema, cost budget. Последний рубеж перед отправкой пользователю.

---

## L

**LLM Judge**  
Модель, оценивающая качество ответов по рубрике: hallucination, citations, tone. Дорогой и nondeterministic — используется после deterministic checks.

---

## O

**OpenTelemetry**  
Стандарт observability: traces, metrics, logs. Предотвращает vendor lock на конкретного провайдера телеметрии.

---

## R

**Regression Gate**  
CI-проверка: mean-score не ниже порога, регрессия не больше `--max-regression`. Сравнение baseline vs current.

---

## S

**Sampling**  
Выборочный сбор traces/evals для экономии. Стратифицированный sampling (100% для редких агентов) предотвращает пропуск деградации.

**Span**  
Один шаг workflow: LLM call, tool call, retrieval, memory read, verifier. Имеет traceId, spanId, agentId, model, tokens, cost, latency.

**Success Rate**  
Доля успешных workflow. Без traces бесполезна — не видно, кто виноват.

---

## T

**Trace**  
Полный пользовательский request/workflow: цепочка spans. Первый ответ на «кто и когда сломал pipeline».

**Trace ID / Span ID**  
Идентификаторы трассы и шага. По ним восстанавливается цепочка и blame.

---

*Глоссарий модуля 46. Следующий: [Модуль 47 — AI Security для агентов](../47-ai-security-agents/GLOSSARY.md)*