# Модуль 45 — Agentic RAG и Graph RAG

> **Для AI-архитектора:** Agentic RAG — это pipeline, где retrieval становится итеративным процессом с planning, verification, graph memory и контролем hallucination cascades.
>
> Один день изучения — от iterative retrieval loop до graph RAG, temporal awareness, verification и abstain policy.

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
| Graphiti | active | realtime knowledge graphs for agents |
| Cognee | active | AI memory platform + knowledge graph |
| Neo4j + agent memory | active | graph-native memory |
| pgvector | 0.8.x | vector search baseline |
| LiteGraph / in-memory | рассматривать | локальные графы без сервера |

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

### 1.2. Когда нужен Agentic RAG

| Тип вопросов | RAG | Agentic RAG |
|:--|:--|:--|
| FAQ, «что в документах?» | ✅ один проход | ❌ дорого |
| Multi-hop: «кто подписал договор с компанией, где директор Иванов?» | ❌ | ✅ |
| Противоречивые источники | ❌ | ✅ verifier |
| Юридические/финансовые решения | ❌ (нужен проверить) | ✅ citations + abstain |

Цена agentic RAG: latency ×2–5, cost ×2–3 относительно single-pass. Выигрыш — глубина и верификация сложных запросов.

### Граничные случаи — где ломается

**Один проход для multi-hop**: «нужно ли согласование юриста для договора на 2.5M с новым контрагентом?» — требует 3 обращения к разным источникам (policy по сумме, vendor status, clause risk). Single-pass вернёт поверхностный ответ.

**Итерация без предела**: агент «ищет ещё» бесконечно. Без max iterations и budget — cost-бомба.

**Почему это важно архитектору:** agentic RAG — это не «RAG с ретраями», а новый контракт: планирование, верификация, abstain. Каждая из этих механик — отдельный компонент с метриками.

---

## 2. Архитектурная механика

### 2.1. Graph RAG: entities, relations, communities

```text
Contract ── hasParty ── Company
Company ── hasDirector ── Person
Clause ── requires ── Approval
Approval ── belongsTo ── Policy
```

Graph полезен для multi-hop questions, связей между документами, объяснения пути, community summaries, temporal relations и deduplication entities. Production-вариант часто hybrid: vector search → graph search → rerank → final context.

```typescript
// Пример multi-hop: "Есть ли у контрагента одобрение для договора > 1M?"
// Path: Contract → hasParty → Company → hasPolicy → Policy.minAmount
// Поиск: Policy.minAmount >= 1_000_000 && Policy.status == "active"
```

**Построение графа:**

```text
Документы → Entity extraction → Community detection → Graph
   │              │
   │              └──→ Relation extraction (typed edges)
   └──→ Chunking → Vector index (для hybrid)
```

Community detection группирует связанные сущности в community summaries — это даёт «обзорные» ответы без перебора всех узлов.

**Hybrid pipeline:**

```text
query
 ├── Vector retriever → top-20 chunks
 ├── Graph retriever → entities + relations + communities
 └── BM25 → точные совпадения
        │
        ▼
   Merge + rerank → final context (токен-бюджет)
```

### 2.2. Архитектура agentic retrieval loop

```text
User Query
   │
   ▼
Planner
   │  выбирает retrievers по типу вопроса
   ├── Vector Retriever  (семантика)
   ├── BM25 Retriever    (точные совпадения)
   ├── Graph Retriever   (связи)
   └── Temporal Retriever (версии документов)
   │
   ▼
Evidence Pack  ← chunks + entities + relations
   │
   ▼
Verifier
   ├── enough evidence?
   ├── contradictions?
   └── need another retrieval?
   │
   ▼
Answer + citations
```

```typescript
interface RetrievalStep {
  retriever: 'vector' | 'bm25' | 'graph' | 'temporal';
  query: string;
  maxResults: number;
  reason: string;  // почему выбран этот retriever
}

interface EvidencePack {
  chunks: ScoredChunk[];
  entities: Entity[];
  relations: Relation[];
  gaps: string[];       // что не найдено
  iterationCount: number;
}
```

### 2.3. Temporal RAG и актуальность данных

```text
Policy v1 (2024) superseded_by Policy v2 (2026)
```

Temporal RAG учитывает document version, valid_from/valid_to, superseded_by, updated_at и effective date query. Без temporal awareness агент отвечает по устаревшей версии.

```typescript
function filterTemporal(docs: Document[], asOfDate: Date): Document[] {
  return docs.filter(doc => {
    const validFrom = new Date(doc.validFrom);
    const validTo = doc.validTo ? new Date(doc.validTo) : null;
    return validFrom <= asOfDate && (!validTo || validTo >= asOfDate);
  }).filter(doc => !doc.supersededBy);
}
```

### 2.4. Verification и hallucination cascade control

Agentic RAG создаёт риск cascade hallucination: ошибка на одном шаге порождает новые.

```typescript
interface Claim {
  text: string;
  sources: string[];         // source IDs
  requiredEvidence: string[]; // phrases that must appear in sources
}

interface VerificationResult {
  claim: string;
  supported: boolean;
  confidence: number;         // 0-1
  unsupportedReason?: string;
}
```

Механики:
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

### 2.5. Метрики качества (evals)

Без метрик нельзя понять, стал ли pipeline лучше:

| Метрика | Что измеряет | Как считать |
|:--|:--|:--|
| Faithfulness | нет ли галлюцинаций | claims из ответа vs источники |
| Answer relevance | отвечает ли на вопрос | semantic similarity ответа и вопроса |
| Context precision | нужен ли каждый чанк | релевантность чанков в контексте |
| Citation accuracy | цитата подтверждает claim? | verifier |

### Граничные случаи — где ломается

**Пустой граф**: сущности не извлечены, community пустые. Graph retriever возвращает ноль — pipeline должен упасть на vector, а не умереть. Fallback-retrieval обязателен.

**Омонимы**: «Ромашка» может быть и компанией, и цветком. Entity resolution по контексту и типу узла; ложные связи — source trust + review.

**Циклы в отношениях**: A owns B, B owns A (для схем групп). Traversal с visited-set, запрет бесконечных путей.

**Противоречивые версии документа**: v1 и v2 противоречат. Temporal filter по asOfDate + противоречие как сигнал для verifier.

**Документ изменён**: superseded_by цепочка из 3+ версий. Нужен полный путь, а не только последний.

**Почему это важно архитектору:** agentic RAG добавляет движущиеся части: планировщик, verifier, temporal filter. Каждая — точка отказа. Метрики (faithfulness, context precision) — обязательны, иначе «улучшение» окажется регрессией.

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

## 4. Failure modes

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Retrieval loop | агент бесконечно ищет | max iterations |
| Graph poisoning | неверные relations | source trust + review |
| Stale policy | ответ по старой версии | temporal filters |
| Citation washing | цитата не подтверждает claim | verifier |
| Context explosion | слишком много evidence | budget + summaries |
| No answer | агент не умеет сказать «не знаю» | abstain policy |
| Empty graph | нет сущностей | fallback retrieval |

---

## Реальный кейс

### Входные данные

Юридическая база знаний: договоры, политики, судебная практика. Запрос: «Нужно ли согласование юриста для договора на 2.5M ₽ с новым контрагентом?» 2000 документов, 4 версии политик за 3 года.

### Гипотеза

Agentic RAG с planner + verifier + temporal filter даст верифицируемый ответ с citations вместо «вероятно да».

### План (реальный пайплайн)

1. найти policy по сумме (vector + BM25);
2. проверить vendor status (graph: контрагент в чёрном/белом списке);
3. найти clause risk (graph: связанные клаузы);
4. проверить exceptions (temporal: актуальная версия политики);
5. собрать answer с citations + abstain при нехватке данных.

### Что получилось

- **Planner** выбрал 4 retriever-шага, EvidencePack собрал 12 чанков + 3 entities;
- **Temporal filter** отсек v1/v2 политики — ответ по v3 (актуальной);
- **Verifier** нашёл citation washing: один claim ссылался на клаузу, где правила не было;
- **Abstain**: для «нового контрагента» не было данных vendor status — агент ответил «нужна проверка», а не «да/нет».

**Что неожиданно:** самым дорогим был не retrieval, а **поддержание temporal-актуальности графа** (superseded_by цепочки). Граф устаревал быстрее, чем обновлялся. Каждое обновление политики — переиндексация связей.

### Вывод, противоречащий интуиции

Ценность agentic RAG не в «итеративном поиске», а в **отказе отвечать**. Abstain и citation-verification предотвратили больше ошибок, чем дополнительные retrieval-итерации. Дорогая итеративность окупается только там, где «не знаю» важнее «уверенно неверно».

---

## 6. Антипаттерны

### «Graph RAG вместо evaluation»

**Выглядит правильно:** граф решает всё.

**Почему ошибка:** без evals невозможно понять, стал ли pipeline лучше или просто сложнее.

---

### «Больше retrievers = лучше»

**Выглядит правильно:** вся информация важна.

**Почему ошибка:** больше шума, latency и cost. Каждый retriever должен иметь measured contribution.

---

### «Цитаты для красоты»

**Выглядит правильно:** добавил source — и правда.

**Почему ошибка:** citations должны проверяться. Неподтверждённый claim опаснее отсутствия citations.

---

### «Агент всегда отвечает»

**Выглядит правильно:** пользователь ждёт ответ.

**Почему ошибка:** при недостатке данных ответ будет галлюцинацией. Abstain — тоже ответ.

---

## Anti-checklist ☠️

- [ ] Graph RAG вместо evaluation — без метрик непонятно, стало лучше или просто сложнее
- [ ] Больше retrievers = лучше — больше шума, latency и cost
- [ ] Цитаты для красоты — неподтверждённый claim опаснее отсутствия citations
- [ ] Бесконечный retrieval loop — агент ищет и не может остановиться
- [ ] Игнорировать temporal awareness — ответ по старой версии policy
- [ ] Нет abstain policy — агент отвечает даже при недостатке данных, галлюцинируя
- [ ] Один проход для сложных вопросов — multi-hop требует итеративного retrieval
- [ ] Граф без обновлений — устаревшие связи хуже, чем отсутствие графа

---

## Задачи AI-кодеру

Плохая формулировка: > «Сделай agentic RAG»

Хорошая формулировка: > «Реализуй `RetrievalPlanner` на TypeScript. На вход: `query`, `availableRetrievers`, `budgetTokens`. На выход: список шагов `{retriever, query, maxResults, reason}`. Ограничения: максимум 5 шагов, нельзя повторять retriever больше 2 раз, итоговый token budget ≤ `budgetTokens`. Тест: query с бюджетом 2000 tokens не планирует больше 4 шагов.»

Формула: вход/выход + ограничения + тест на нарушение лимитов.

---

**Задача 1 — Retrieval planner**

> Реализуй `RetrievalPlanner` на TypeScript. На вход: `query`, `availableRetrievers`, `budgetTokens`. На выход: список шагов `{retriever, query, maxResults, reason}`. Ограничения: максимум 5 шагов, нельзя повторять retriever больше 2 раз, итоговый token budget ≤ `budgetTokens`.

---

**Задача 2 — Evidence verifier**

> Реализуй `verifyClaims(claims, evidence)`. Claim имеет `{text, requiredEvidence}`. Evidence имеет `{sourceId, text}`. Верни `{supported, unsupported, confidence}`. Claim считается supported только если в evidence есть все requiredEvidence phrases.

---

**Задача 3 — Temporal filter**

> Реализуй `filterTemporalDocuments(docs, asOfDate)`. Документ имеет `validFrom`, `validTo`, `supersededBy`. Вернуть только актуальные на `asOfDate`, исключая superseded. Добавь тест: документ с `validTo` в прошлом и `asOfDate` после — исключён.

---

**Задача 4 — Abstain policy**

> Реализуй `decideAbstain(verificationResults, {minConfidence, minSupportedClaims})`. Верни `{answer: 'supported'|'partial'|'abstain', reason}`. Если поддержано < 50% claims или confidence каждого < `minConfidence` — abstain.

---

## Чеклист архитектора

### Retrieval
- [ ] Выбраны retrievers с измеренной пользой
- [ ] Есть max iterations
- [ ] Есть budget на evidence pack
- [ ] Есть hybrid/vector/graph strategy
- [ ] Fallback retrieval при пустом графе

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
- [ ] Граф обновляется при новых версиях

### Evaluation
- [ ] Faithfulness измеряется
- [ ] Answer relevance измеряется
- [ ] Context precision измеряется
- [ ] Baseline сравним с текущим

### Observability
- [ ] Логируются retrieval steps
- [ ] Логируются gaps
- [ ] Логируются unsupported claims
- [ ] Можно воспроизвести evidence pack

---

*Модуль 45 завершён.*
*Следующий: [Модуль 46 — AgentOps](../46-agentops/README.md)*