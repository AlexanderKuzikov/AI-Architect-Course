# Модуль 45 — Agentic RAG и Graph RAG

> **Для AI-архитектора:** Agentic RAG — это pipeline, где retrieval становится итеративным процессом с planning, verification, graph memory и контролем hallucination cascades.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Failure modes](#4-failure-modes-для-agentic-rag)
5. [Антипаттерны](#5-антипаттерны)
6. [Задачи AI-кодеру](#задачи-ai-кодеру)
7. [Чеклист архитектора](#чеклист-архитектора)

---

## 1. Введение и актуальность

### 1.1. От RAG к Agentic RAG

Классический RAG:

```text
query → retrieve top-k → assemble context → generate
```

Agentic RAG:

```text
query → plan → retrieve → inspect gaps → retrieve again → verify → answer
```

Агент может уточнять query, искать по разным retrievers, строить graph paths, проверять противоречия и возвращаться за дополнительными источниками.



## Актуальные версии и сигналы

| Graphiti | active | июнь 2026 | realtime knowledge graphs for agents |
| Cognee | active | июнь 2026 | AI memory platform + knowledge graph |
| Neo4j + agent memory | active | июнь 2026 | graph-native memory |
| pgvector | 0.8.2+ | март 2026 | vector search baseline |
| Agentic RAG papers | active research | июнь 2026 | planning + retrieval loops |

---

## 2. Архитектурная механика



## 2. Graph RAG: entities, relations, communities

```text
Contract ── hasParty ── Company
Company ── hasDirector ── Person
Clause ── requires ── Approval
Approval ── belongsTo ── Policy
```

Graph полезен для multi-hop questions, связей между документами, объяснения пути, community summaries, temporal relations и deduplication entities. Production-вариант часто hybrid: vector search → graph search → rerank → final context.



## 3. Архитектура agentic retrieval loop

```text
User Query
   │
   ▼
Planner
   │
   ├── Vector Retriever
   ├── BM25 Retriever
   ├── Graph Retriever
   └── Temporal Retriever
   │
   ▼
Evidence Pack
   │
   ▼
Verifier
   │
   ├── enough evidence?
   ├── contradictions?
   └── need another retrieval?
   │
   ▼
Answer + citations
```

Evidence Pack должен включать chunks, entities, relations и gaps.



## 4. Temporal RAG и актуальность данных

Temporal RAG учитывает document version, valid_from/valid_to, superseded_by, updated_at и effective date query.

```text
Policy v1 (2024) superseded_by Policy v2 (2026)
```

Без temporal awareness агент может ответить по устаревшей версии документа.



## 5. Verification и hallucination cascade control

Agentic RAG создаёт риск cascade hallucination: ошибка на одном шаге порождает новые ошибки.

Controls:

- citations per claim;
- contradiction detection;
- confidence score;
- source freshness;
- verifier LLM or deterministic rules;
- abstain when evidence insufficient.

```json
{
  "claim": "Договоры > 1M требуют юриста",
  "sources": ["policy:2026-03", "clause:44"],
  "confidence": 0.91
}
```



## 6. Failure modes и observability

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Retrieval loop | агент бесконечно ищет | max iterations |
| Graph poisoning | неверные relations | source trust + review |
| Stale policy | ответ по старой версии | temporal filters |
| Citation washing | цитата не подтверждает claim | verifier |
| Context explosion | слишком много evidence | budget + summaries |
| No answer | агент не умеет сказать «не знаю» | abstain policy |



### 7.1. Реальный кейс: legal knowledge base

Запрос: «Нужно ли согласование юриста для договора на 2.5M ₽ с новым контрагентом?»

План:

1. найти policy по сумме;
2. проверить vendor status;
3. найти clause risk;
4. проверить exceptions;
5. собрать answer с citations.


---

## 3. Production trade-offs

| Решение | Выигрыш | Цена | Когда выбирать |
|:--|:--|:--|:--|
| Standard RAG (single pass) | быстро, дешево, просто | нет multi-hop, плохо для сложных вопросов | простые вопросы, FAQ |
| Agentic RAG (iterative) | глубже, точнее на сложных запросах | дороже, медленнее, сложнее | юридические, финансовые, сложные домены |
| Graph RAG | связи, multi-hop, explainability | overhead на построение графа | entity-heavy knowledge bases |
| Vector-only | просто, быстро | нет связей между фактами | прототип |
| Hybrid vector + graph | лучшее из двух | сложнее инфра | production |
| Temporal RAG | актуальность данных | сложнее индексация | контракты, политики, законы |

---

## 4. Failure modes для Agentic RAG

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Retrieval loop | агент бесконечно ищет | max iterations |
| Graph poisoning | неверные relations | source trust + review |
| Stale policy | ответ по старой версии | temporal filters |
| Citation washing | цитата не подтверждает claim | verifier |
| Context explosion | слишком много evidence | budget + summaries |
| Cascade hallucination | ошибка порождает ошибки | verifier + abstain policy |

---

## 5. Антипаттерны

### «Graph RAG вместо evaluation»

**Почему ошибка:** без evals невозможно понять, стал ли pipeline лучше или просто сложнее.

---

### «Больше retrievers = лучше»

**Почему ошибка:** больше шума, latency и cost. Каждый retriever должен иметь measured contribution.

---

### «Цитаты для красоты»

**Почему ошибка:** citations должны проверяться. Неподтверждённый claim опаснее отсутствия citations.

---

## 7. Задачи AI-кодеру

**Задача 1 — Retrieval planner**

> Реализуй `RetrievalPlanner` на TypeScript. На вход: `query`, `availableRetrievers`, `budgetTokens`. На выход: список шагов `{retriever, query, maxResults, reason}`. Ограничения: максимум 5 шагов, нельзя повторять retriever больше 2 раз, итоговый token budget ≤ `budgetTokens`.

---

**Задача 2 — Evidence verifier**

> Реализуй `verifyClaims(claims, evidence)`. Claim имеет `{text, requiredEvidence}`. Evidence имеет `{sourceId, text}`. Верни `{supported, unsupported, confidence}`. Claim считается supported только если в evidence есть все requiredEvidence phrases.

---

**Задача 3 — Temporal filter**

> Реализуй `filterTemporalDocuments(docs, asOfDate)`. Документ имеет `validFrom`, `validTo`, `supersededBy`. Вернуть только актуальные на `asOfDate`, исключая superseded.


## 8. Чеклист архитектора

### Retrieval
- [ ] Выбраны retrievers с измеренной пользой
- [ ] Есть max iterations
- [ ] Есть budget на evidence pack
- [ ] Есть hybrid/vector/graph strategy

### Evidence
- [ ] Каждый claim имеет citations
- [ ] Citations проверяются verifier'ом
- [ ] Есть confidence score
- [ ] Есть abstain policy

### Temporal
- [ ] Document versions учтены
- [ ] `valid_from` / `valid_to` есть
- [ ] `superseded_by` обрабатывается
- [ ] As-of date задаётся явно

### Observability
- [ ] Логируются retrieval steps
- [ ] Логируются gaps
- [ ] Логируются unsupported claims
- [ ] Можно воспроизвести evidence pack

---

*Модуль 45 завершён.*
*Следующий: [Модуль 46 — AgentOps](../46-agentops/README.md)
