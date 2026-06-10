# Модуль 42 — A2A Protocol и Multi-Agent Systems

> **Для AI-архитектора:** Multi-agent system — это не «запустить несколько LLM в цикле». Это система коммуникации, состояния, делегирования, retry и accountability. A2A даёт protocol layer для agent-to-agent interaction.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Security и failure modes](#4-security-и-failure-modes)
5. [Реальный кейс](#5-реальный-кейс)
6. [Антипаттерны](#6-антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## 1. Введение и актуальность

### 1.1. Что такое A2A

A2A — протокол коммуникации между агентами. Он нужен, когда один агент не владеет всеми компетенциями и вызывает специализированные агенты как сервисы.

```text
Orchestrator Agent
   │
   ├── Research Agent
   ├── Contract Extraction Agent
   ├── Legal Policy Agent
   └── Ticket Agent
```

Важно: A2A не отменяет MCP. Они решают разные задачи:

| Слой | Решает |
|:--|:--|
| MCP | агент ↔ инструменты/данные/UI |
| A2A | агент ↔ агент |
| Model Gateway | агент ↔ LLM providers |
| AgentOps | измерение и контроль agent system |



## Актуальные версии и сигналы

| A2A Protocol | v0.3.x ecosystem | июнь 2026 | agent-to-agent communication |
| `a2a-js` | 0.2.0 | июнь 2026 | JavaScript SDK |
| Python A2A SDK | active | июнь 2026 | Google A2A ecosystem |
| A2A Go SDK | active | июнь 2026 | backend/Go implementations |

---

## 2. Архитектурная механика



## 2. Agent Card, Task, Artifact

**Agent Card** описывает capabilities агента: name, description, URL, capabilities, authentication.

**Task** — единица работы: `taskId`, `sessionId`, `input`, `status`.

**Artifact** — результат работы: structured JSON, text, file reference или ссылка на raw data.

```json
{
  "taskId": "task_123",
  "sessionId": "session_456",
  "input": {"documentId": "DOC-789"},
  "status": "submitted"
}
```



## 3. Протокольный lifecycle

```text
submit → submitted → working → completed
                         ↘ failed
                         ↘ canceled
```

Операции: submit, poll, stream, cancel.

| Тип задачи | Timeout |
|:--|:--|
| classification | 5–10 sec |
| extraction | 30–60 sec |
| research | async, 5–30 min |
| code review | async, 10–60 min |
| legal analysis | async + human approval |



## 4. Паттерны multi-agent orchestration

| Паттерн | Плюсы | Минусы |
|:--|:--|:--|
| Orchestrator + specialists | контроль, accountability | coordinator bottleneck |
| Peer agents | гибкость | сложнее tracing и blame |
| Pipeline agents | предсказуемость | меньше адаптивности |
| Market-style delegation | масштабируемость | нужен trust/rating/auth layer |



## 5. State management и idempotency

Нужны: `taskId`, `sessionId`, `correlationId`, `idempotencyKey`, durable task store, retry policy, cancellation token.

Write operations должны быть идемпотентны:

```text
same task + same input + same idempotencyKey → same result
```

Иначе retry создаст дубли тикетов, писем или платежей.



## 6. Failure modes и observability

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Infinite delegation | task уходит по кругу | max depth, visited agents |
| Lost task | orchestrator не знает status | durable task store |
| Silent quality degradation | result есть, но плохой | evaluator per agent |
| Context explosion | слишком много artifact | summary + references |
| No blame | непонятно кто сломал pipeline | per-agent traces |
| Retry storm | failed agent вызывает лавину retry | backoff + circuit breaker |



### 7.1. Реальный кейс: агент обработки договора

Цель: извлечь реквизиты, проверить риски, сравнить с policy, подготовить резюме, создать тикет юристу.

```text
contract:DOC-789
 ├── extraction: completed, 12s
 ├── risk: completed, 8s
 ├── summary: completed, 6s
 └── ticket: created, id=LEGAL-1042
```


---

## 3. Production trade-offs

| Решение | Выигрыш | Цена | Когда выбирать |
|:--|:--|:--|:--|
| Простая интеграция | быстро стартует | fragile, мало контроля | prototype only |
| Protocol boundary | стандартизация, reuse | больше upfront design | production agents |
| Strict approvals | безопасность | больше latency/friction | write/destructive/secrets actions |
| Full autonomy | скорость | высокий blast radius | только low-risk read-only tasks |
| Observability by default | detectable degradation | extra instrumentation | любой production agent |

---

## 4. Security и failure modes

Главные failure modes для этой темы:\ policy bypass, stale state, context explosion, credential leakage, no audit trail, unbounded retry/delegation, silent quality degradation.

Архитектор должен заранее определить: что считается risky action, где проходит security boundary, какие данные нельзя передавать модели, какие tool calls требуют approval и как восстанавливать состояние после сбоя.

---

## 5. Реальный кейс

Реальный кейс: агент обработки договора

Цель: извлечь реквизиты, проверить риски, сравнить с policy, подготовить резюме, создать тикет юристу.

```text
contract:DOC-789
 ├── extraction: completed, 12s
 ├── risk: completed, 8s
 ├── summary: completed, 6s
 └── ticket: created, id=LEGAL-1042
```

---

## 6. Антипаттерны

### «Пять агентов вместо одного большого промпта»

**Почему ошибка:** если нет явных контрактов, state и evals — это усложнение без выигрыша.

---

### «Агент вызывает агента без timeout»

**Почему ошибка:** без timeout и cancellation один медленный агент блокирует весь workflow.

---

### «Retry без idempotency»

**Почему ошибка:** retry без idempotency создаёт дубликаты внешних действий.

---

## 7. Задачи AI-кодеру

**Задача 1 — Task store**

> Реализуй `TaskStore` на TypeScript. Методы: `createTask`, `updateStatus`, `getTask`, `listTasksBySession`, `markCanceled`. Обязательные поля: `taskId`, `sessionId`, `agentId`, `status`, `attempts`, `createdAt`, `updatedAt`, `resultArtifactIds`. Добавь unit-тесты на idempotent create по `idempotencyKey`.

---

**Задача 2 — Delegation limiter**

> Реализуй `DelegationLimiter` с `maxDepth`, `maxTasksPerSession`, `visitedAgents`. Метод `canDelegate(currentAgent, targetAgent, sessionTrace)` возвращает `{allowed, reason}`. Если agent уже был в trace или depth превышен — запрет. Добавь тест на цикл A → B → C → A.

---

**Задача 3 — Artifact summarizer**

> Реализуй функцию `summarizeArtifact(artifact, maxChars)`, которая возвращает `{summary, references, truncated}`. Summary должен содержать: agentId, status, keyFacts, confidence, warnings. Raw data не включается, только ссылки на artifact IDs.


## 8. Чеклист архитектора

### Protocol
- [ ] Agent Cards описаны для каждого агента
- [ ] Task lifecycle явно определён
- [ ] Artifact format стабилен
- [ ] Streaming/polling выбран осознанно

### Orchestration
- [ ] Есть coordinator или понятный peer protocol
- [ ] Max depth задан
- [ ] Cycles запрещены
- [ ] Timeout есть на каждый agent call

### State
- [ ] Task store durable
- [ ] Idempotency keys есть для write actions
- [ ] Retry policy имеет backoff
- [ ] Cancellation обрабатывается

### Observability
- [ ] Per-agent traces есть
- [ ] Per-agent metrics есть
- [ ] Quality evals есть для критичных агентов
- [ ] Blame по pipeline можно установить по `correlationId`

---

*Модуль 42 завершён.*
*Следующий: [Модуль 43 — Agent Memory и Knowledge Graphs](../43-agent-memory-knowledge-graphs/README.md)
