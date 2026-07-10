# Модуль 46 — AgentOps

> **Для AI-архитектора:** AgentOps — это observability, tracing, evaluation, guardrails и cost control для LLM/agent systems. Без AgentOps production agent — это black box, который может деградировать незаметно.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Failure modes](#4-failure-modes-для-agentops)
5. [Антипаттерны](#5-антипаттерны)
6. [Задачи AI-кодеру](#задачи-ai-кодеру)
7. [Чеклист архитектора](#чеклист-архитектора)

---

## 1. Введение и актуальность

### 1.1. Что такое AgentOps

AgentOps отвечает на вопросы: какой агент что сделал, какие модели/tools/memory были использованы, сколько стоил ответ, сколько занял latency, какие evals прошли, где началась деградация и кто/что виновато в инциденте.

```text
AgentOps = Tracing + Metrics + Evals + Guardrails + Cost Control
```



## Актуальные версии и сигналы

| OpenTelemetry | mature | июнь 2026 | tracing standard |
| OpenLit | active | июнь 2026 | LLM observability + GPU monitoring |
| Langfuse | active | июнь 2026 | traces, evals, playground |
| LangTrace | active | июнь 2026 | OpenTelemetry-native LLM tracing |
| Promptfoo | 0.121.3+ | март 2026 | evals и CI gates |
| DeepEval | 3.9.2+ | март 2026 | pytest-compatible evals |

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
    'llm.agent_id': metadata.agentId,
    'llm.model': metadata.model,
    'llm.tokens.input': metadata.tokensIn,
    'llm.tokens.output': metadata.tokensOut,
    'llm.latency_ms': metadata.latencyMs,
    'llm.cost_usd': metadata.cost,
  };
}
```

### 2.2. Evaluation layers

| Tier | Когда | Что проверяет |
|:--|:--|:--|
| Deterministic checks | каждый PR | JSON schema, secrets, max latency, forbidden actions |
| Golden dataset | каждый PR/nightly | fixed examples, expected outputs, score threshold |
| LLM judge | pre-release | rubric, hallucination, citations, tone |
| Human review | high-risk domains | legal, medical, finance, production write actions |

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

function validateOutput(output: unknown, policy: GuardrailPolicy): GuardrailResult {
  const failures: GuardrailResult['failures'] = [];
  if (policy.maxCost && (output as any).cost > policy.maxCost) {
    failures.push({ rule: 'cost_budget', reason: `$${(output as any).cost} > $${policy.maxCost}` });
  }
  // ... schema, PII, secrets checks
  return { passed: failures.length === 0, failures };
}
```

### 2.4. Cost, latency и fallback control

| Metric | Budget | Action |
|:--|:--|:--|
| p95 latency | 3s | fallback to cheaper model |
| cost per task | $0.02 | stop/summarize |
| tokens per task | 40K | context compression |
| LLM judge cost | $0.10 per eval | sample smaller |

Fallback policy: primary model fails → fallback model; expensive model over budget → small model + summary; judge unavailable → deterministic checks only + flag.

### 2.5. Dashboards и incident response

Must-have dashboards: success rate by agent, p50/p95 latency, cost per task, fallback rate, tool error rate, eval score trend, hallucination rate, guardrail rejection rate.

Incident questions: когда началась деградация, какой агент изменился, какая модель/провайдер, какой tool дал ошибку, какой eval first failed, был ли cost spike, есть ли security guardrail rejection.

### 2.6. Реальный кейс: AgentOps для support agent

```text
User ticket
 → retrieve customer memory
 → classify issue
 → call knowledge base RAG
 → draft answer
 → guardrail PII check
 → create response
```

Targets: p95 latency < 5s, schema valid 99.9%, hallucination rate < 1%, fallback rate < 5%, cost per ticket < $0.01.


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

## 4. Failure modes для AgentOps

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Silent quality degradation | метрики зелёные, качество упало | golden dataset + regression test |
| Cost explosion | agent costs 10× нормального | cost budget + alert |
| Flaky evals | quality gate то проходит, то нет | multiple runs + wider threshold |
| Telemetry overload | слишком много данных | sampling + aggregation |
| No blame | непонятно какой агент сломал pipeline | per-agent traces |
| Vendor lock | завязан на один observability provider | OpenTelemetry standard |

---

## 5. Антипаттерны

### «Один dashboard для всех»

**Почему ошибка:** разные агенты имеют разные SLA, cost и risk. Нужны per-agent dashboards.

---

### «LLM judge вместо всех тестов»

**Почему ошибка:** LLM judge дорогой и nondeterministic. Deterministic checks должны идти первыми.

---

### «Считать только model cost»

**Почему ошибка:** tools, memory, rerankers, judge calls и retries часто стоят больше самой генерации.

---

## Anti-checklist ☠️

- [ ] Один dashboard для всех агентов — разные SLA, cost и risk
- [ ] LLM judge вместо всех тестов — дорогой и nondeterministic, deterministic checks должны идти первыми
- [ ] Считать только model cost — tools, memory и retries часто стоят больше генерации
- [ ] Нет baseline для evals — непонятно улучшился pipeline или деградировал
- [ ] Не логировать fallback — незаметная деградация качества
- [ ] Собирать все traces подряд — через неделю база данных стоит дороже сервера
- [ ] Нет runbook для деградации качества — при падении метрик начинается паника

## 6. Задачи AI-кодеру

**Задача 1 — Trace metadata**

> Реализуй `createLLMSpanMetadata({agentId, model, tokensIn, tokensOut, latencyMs, cost})`. Верни объект для OpenTelemetry span с attributes: `llm.agent_id`, `llm.model`, `llm.tokens.input`, `llm.tokens.output`, `llm.latency_ms`, `llm.cost_usd`.

---

**Задача 2 — Guardrail validator**

> Реализуй `validateOutput(output, policy)` на TypeScript. Проверки: JSON schema, no email/phone leakage unless allowed, no `authorization`/`cookie`/`token` fields, `allowedTools` subset, `costUsd <= maxCost`.

---

**Задача 3 — Quality gate**

> Реализуй CLI `agentops-gate --results results.json --baseline baseline.json --max-regression 0.03 --min-score 0.80`. Fail если mean_score ниже min-score или регрессия больше max-regression.


## 7. Чеклист архитектора

### Tracing
- [ ] Есть traceId на workflow
- [ ] Каждый LLM/tool/retrieval шаг — span
- [ ] Метрики cost/tokens/latency собираются
- [ ] Input/output hash без raw secrets

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

### Incident response
- [ ] Dashboards per agent есть
- [ ] Можно найти first failing span
- [ ] Можно сравнить baseline vs current
- [ ] Есть runbook для деградации качества

---

*Модуль 46 завершён.*
*Следующий: [Модуль 47 — AI Security для агентов](../47-ai-security-agents/README.md)
