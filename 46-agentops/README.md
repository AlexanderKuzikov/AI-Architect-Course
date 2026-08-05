# Модуль 46 — AgentOps

> **Для AI-архитектора:** AgentOps — это observability, tracing, evaluation, guardrails и cost control для LLM/agent systems. Без AgentOps production agent — это black box, который может деградировать незаметно.
>
> Один день изучения — от tracing (OTel, spans) и evaluation tiers до guardrails, cost control и incident response.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Failure modes](#4-failure-modes)
5. [Реальный кейс](#реальный-кейс)
6. [Антипаттерны](#6-антипаттерны)
7. [Anti-checklist ☠️](#anti-checklist-️)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Проверено: август 2026

| Инструмент | Версия | Назначение |
|:--|:--|:--|
| OpenTelemetry | 1.x | tracing standard (gen_ai.* conventions) |
| OpenTelemetry LLM Conventions | proposta stabile | semantic conventions для LLM |
| Langfuse | active | traces, evals, playground |
| LangTrace | active | OTel-native LLM tracing |
| Promptfoo | 0.12x | evals и CI gates |
| DeepEval | 3.9.x | pytest-compatible evals |

---

## 1. Введение и актуальность

### 1.1. Что такое AgentOps

AgentOps отвечает на вопросы: какой агент что сделал, какие модели/tools/memory были использованы, сколько стоил ответ, сколько занял latency, какие evals прошли, где началась деградация и кто/что виновато в инциденте.

```text
AgentOps = Tracing + Metrics + Evals + Guardrails + Cost Control
```

### 1.2. Почему без AgentOps нельзя

LLM-системы деградируют незаметно: провайдер сменил модель, retrieval вернул мусор, fallback включился на слабую модель, guardrail молча заблокировал. Всё это видно только через tracing + evals + metrics.

Архитектор должен знать ответ на пять вопросов по любому агенту:
1. Что он сделал? (trace)
2. Сколько это стоило? (cost)
3. Как быстро? (latency)
4. Качество? (evals)
5. Что сломалось? (guardrails, errors)

### Граничные случаи — где ломается

**Только метрики без traces**: видно «success rate упал», но нельзя узнать, какой агент/модель/step виноват. Traces — обязательная пара к метрикам.

**Только traces без evals**: видно «что сделал», но не «хорошо ли». Eval — источник сигнала о качестве.

**Почему это важно архитектору:** AgentOps — не «добавить логгер», а архитектурный слой: источники данных (traces), метрики, evals, guardrails и cost. Проектируется вместе с агентом, не после.

---

## 2. Архитектурная механика

### 2.1. Tracing: spans, traces, metadata

**Trace** — один пользовательский request/workflow. **Span** — один шаг: LLM call, tool call, retrieval, memory read, verifier, external API.

Каждый span должен иметь:

- `traceId`;
- `spanId`;
- `agentId`;
- `model`;
- `toolName`;
- `inputHash`;
- `outputHash`;
- `tokensIn`;
- `tokensOut`;
- `cost`;
- `latencyMs`;
- `errorType`.

**OpenTelemetry LLM conventions**: вместо самодельных `llm.*` используй стандарт `gen_ai.*`:

```typescript
function createLLMSpan(metadata: {
  agentId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  cost: number;
}): SpanAttributes {
  return {
    'gen_ai.agent_id': metadata.agentId,
    'gen_ai.model': metadata.model,
    'gen_ai.usage.input_tokens': metadata.tokensIn,
    'gen_ai.usage.output_tokens': metadata.tokensOut,
    'gen_ai.latency_ms': metadata.latencyMs,
    'gen_ai.cost_usd': metadata.cost,
  };
}
```

Стандарт `gen_ai.*` — это не про «красивый аккуратный код», а про совместимость: инструменты (Langfuse, Datadog, Grafana) понимают эти атрибуты из коробки, без кастомных парсеров.

### 2.2. Evaluation layers

| Tier | Когда | Что проверяет |
|:--|:--|:--|
| Deterministic checks | каждый PR | JSON schema, secrets, max latency, forbidden actions |
| Golden dataset | каждый PR/nightly | fixed examples, expected outputs, score threshold |
| LLM judge | pre-release | rubric, hallucination, citations, tone |
| Human review | high-risk domains | legal, medical, finance, production write actions |

Golden dataset — версионированный набор эталонных примеров. Regression gate: `--max-regression 0.03 --min-score 0.80` в CI.

### 2.3. Guardrails и policy checks

Guardrails должны проверять PII leakage, secrets, forbidden actions, prompt injection, output schema, allowed tools, model/provider policy и cost budget.

```text
LLM output
   │
   ▼
Guardrail Validator
   ├── schema valid?
   ├── PII allowed?
   ├── secrets absent?
   ├── policy ok?
   └── cost ok?
```

```typescript
interface GuardrailResult {
  passed: boolean;
  failures: Array<{ rule: string; reason: string; value?: string }>;
}
```

### 2.4. Cost, latency и fallback control

| Metric | Budget | Action |
|:--|:--|:--|
| p95 latency | 3s | fallback to cheaper model |
| cost per task | $0.02 | stop/summarize |
| tokens per task | 40K | context compression |
| LLM judge cost | $0.10 per eval | sample smaller |

Политика fallback: при отказе основной модели — fallback-модель; дорогая модель превысила бюджет → маленькая модель + суммаризация; судья недоступен → только детерминированные проверки + флаг.

**Cost attribution при fallback**: если запрос ушёл на fallback-модель, cost должен быть приписан правильно. Иначе dashboards показывают «модель X стоит дорого», хотя половина трафика — модель Y.

### 2.5. Dashboards и incident response

Обязательные дашборды: success rate по агенту, p50/p95 latency, cost per task, fallback rate, tool error rate, eval score trend, hallucination rate, guardrail rejection rate.

Incident questions: когда началась деградация, какой агент изменился, какая модель/провайдер, какой tool дал ошибку, какой eval first failed, был ли cost spike, есть ли security guardrail rejection.

### Граничные случаи — где ломается

**Sampling bias**: вместо «все traces подряд» — sampling. Если выборка 1%, можно пропустить деградацию редкого агента. Стратифицированный sampling по агенту/модели обязателен.

**Потеря traces при crash**: процесс упал до flush буфера — трассы потеряны. Async-экспортёры с durable buffer (или синхронный flush критичных spans).

**Неверная cost attribution**: fallback на другую модель без пометки в span — cost-метрики врут, fallback незаметен. `gen_ai.model` должен фиксировать фактическую модель, а не запрошенную.

**Flaky evals**: LLM judge недетерминирован — gate то проходит, то падает. Несколько прогонов + допуск + детерминированные проверки первыми.

**Почему это важно архитектору:** три из четырёх граничных случаев — про молчаливые искажения данных (sampling, loss, misattribution). Инструмент, который «врет», хуже отсутствия инструмента: он даёт ложную уверенность.

---

## 3. Production trade-offs

| Решение | Выигрыш | Цена | Когда выбирать |
|:--|:--|:--|:--|
| Deterministic checks only | дёшево, быстро, детерминированно | не ловит семантику | PR gate, быстрая обратная связь |
| LLM judge + golden dataset | ловит семантику, качество | дороже, медленнее, nondeterministic | pre-release, critical paths |
| Всегда все evals | максимальная уверенность | $500+/день, 30+ мин CI | финансовые/медицинские systems |
| Sampling evals | баланс cost/confidence | пропускает часть ошибок | большинство production systems |
| Self-hosted judge | privacy, no API cost | overhead на настройку | sensitive data, high volume |
| Cloud judge API | простота, качество | cost, data privacy | prototype, medium volume |

---

## 4. Failure modes

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Silent quality degradation | метрики зелёные, качество упало | golden dataset + regression test |
| Cost explosion | agent costs 10× нормального | cost budget + alert |
| Flaky evals | quality gate то проходит, то нет | multiple runs + wider threshold |
| Telemetry overload | слишком много данных | sampling + aggregation |
| No blame | непонятно какой агент сломал pipeline | per-agent traces |
| Vendor lock | завязан на один observability provider | OpenTelemetry standard |
| Traces loss | crash до flush | durable exporter buffer |
| Sampling bias | пропущена деградация редкого агента | стратифицированный sampling |

---

## Реальный кейс

### Входные данные

Support-agent: ticket → retrieve customer memory → classify issue → RAG → draft answer → guardrail PII → create response. 50 000 запросов/мес. Нужно: p95 latency < 5s, schema valid 99.9%, hallucination rate < 1%, fallback rate < 5%, cost per ticket < $0.01.

### Гипотеза

OTel-трассировка + golden dataset в CI + стратифицированный sampling дадут контроль над деградацией без explosion cost на телеметрию.

### Что получилось

```text
User ticket
 → retrieve customer memory
 → classify issue
 → call knowledge base RAG
 → draft answer
 → guardrail PII check
 → create response
```

- каждый шаг — span с `gen_ai.*` атрибутами;
- golden dataset из 200 кейсов в CI, regression gate `--max-regression 0.03`;
- стратифицированный sampling по агенту: 100% для редких, 5% для массовых;
- cost атрибутируется фактической моделью (учёт fallback);
- дашборды per-agent: success, p95, cost, fallback rate, guardrail rejections.

**Что неожиданно:** падение качества ловил не LLM judge, а **Golden dataset + deterministic checks**. LLM judge пропустил регрессию (смена модели провайдером), потому что «похоже звучало». Golden dataset с точными expected outputs — поймал. LLM judge оказался самым дорогим и самым ненадёжным слоем.

**Второй инцидент:** fallback rate вырос до 18% (провайдер деградировал), но cost-дашборд молчал — атрибуты fallback-модели не помечались. Фикс: `gen_ai.model` = фактическая модель + `gen_ai.fallback: true`.

### Вывод, противоречащий интуиции

Самый ценный eval-слой — **детерминированный golden dataset**, а не LLM judge. Регрессии ловятся точными expected outputs, а LLM judge добавляет шум и cost. For high-risk domains — human review ничем не заменяется. Инвестиции в AgentOps окупаются не метриками «для галочки», а способностью ответить «кто и когда сломал pipeline».

---

## 6. Антипаттерны

### «Один dashboard для всех»

**Выглядит правильно:** единый вид.

**Почему ошибка:** разные агенты имеют разные SLA, cost и risk. Нужны per-agent dashboards.

---

### «LLM judge вместо всех тестов»

**Выглядит правильно:** судья оценит семантику.

**Почему ошибка:** LLM judge дорогой и nondeterministic. Deterministic checks должны идти первыми, golden dataset — в CI.

---

### «Считать только model cost»

**Выглядит правильно:** главный компонент cost.

**Почему ошибка:** tools, memory, rerankers, judge calls и retries часто стоят больше самой генерации.

---

### «Собирать все traces подряд»

**Выглядит правильно:** полная информация.

**Почему ошибка:** через неделю БД телеметрии стоит дороже сервера. Sampling + агрегация обязательны.

---

## Anti-checklist ☠️

- [ ] Один dashboard для всех агентов — разные SLA, cost и risk
- [ ] LLM judge вместо всех тестов — дорогой и nondeterministic, deterministic checks должны идти первыми
- [ ] Считать только model cost — tools, memory и retries часто стоят больше генерации
- [ ] Нет baseline для evals — непонятно улучшился pipeline или деградировал
- [ ] Не логировать fallback — незаметная деградация качества
- [ ] Собирать все traces подряд — через неделю база данных стоит дороже сервера
- [ ] Нет runbook для деградации качества — при падении метрик начинается паника
- [ ] Самодельные `llm.*` атрибуты вместо `gen_ai.*` — инструменты не понимают трассы из коробки

---

## Задачи AI-кодеру

Плохая формулировка: > «Добавь observability агенту»

Хорошая формулировка: > «Реализуй `createLLMSpanMetadata({agentId, model, tokensIn, tokensOut, latencyMs, cost})`. Верни объект для OpenTelemetry span с атрибутами `gen_ai.agent_id`, `gen_ai.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.latency_ms`, `gen_ai.cost_usd`. Добавь тест: все ключи соответствуют OTel LLM conventions.»

Формула: точная функция + стандартные атрибуты + тест на соответствие стандарту.

---

**Задача 1 — Trace metadata**

> Реализуй `createLLMSpanMetadata({agentId, model, tokensIn, tokensOut, latencyMs, cost})`. Верни объект для OpenTelemetry span c атрибутами `gen_ai.agent_id`, `gen_ai.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.latency_ms`, `gen_ai.cost_usd`.

---

**Задача 2 — Guardrail validator**

> Реализуй `validateOutput(output, policy)` на TypeScript. Проверки: JSON schema, no email/phone leakage unless allowed, no `authorization`/`cookie`/`token` fields, `allowedTools` subset, `costUsd <= maxCost`. Верни `{passed, failures[]}`.

---

**Задача 3 — Quality gate**

> Реализуй CLI `agentops-gate --results results.json --baseline baseline.json --max-regression 0.03 --min-score 0.80`. Fail если mean_score ниже min-score или регрессия больше max-regression.

---

**Задача 4 — Sampling allocator**

> Реализуй `samplingDecision(agentId, count, {baseRate, rareAgents})`. Для редких агентов — 100% sampling, для массовых — baseRate. Верни `{sample: boolean, rate: number}`. Тест: редкий агент всегда в выборке.

---

## Чеклист архитектора

### Tracing
- [ ] Есть traceId на workflow
- [ ] Каждый LLM/tool/retrieval шаг — span
- [ ] Метрики cost/tokens/latency собираются
- [ ] Input/output hash без raw secrets
- [ ] Атрибуты по стандарту `gen_ai.*`

### Evaluation
- [ ] Deterministic checks есть
- [ ] Golden dataset версионирован
- [ ] Regression threshold задан
- [ ] LLM judge используется осознанно

### Guardrails
- [ ] PII/secrets checks есть
- [ ] Tool policy checks есть
- [ ] Cost budget есть
- [ ] Fallback policy документирована

### Cost
- [ ] Cost атрибутируется фактической моделью
- [ ] Fallback помечается в span
- [ ] Cost budget на задачу есть
- [ ] Редкие агенты в sampling не теряются

### Incident response
- [ ] Dashboards per agent есть
- [ ] Можно найти first failing span
- [ ] Можно сравнить baseline vs current
- [ ] Есть runbook для деградации качества

---

*Модуль 46 завершён.*
*Следующий: [Модуль 47 — AI Security для агентов](../47-ai-security-agents/README.md)*