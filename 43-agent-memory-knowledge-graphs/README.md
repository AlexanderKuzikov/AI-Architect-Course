# Модуль 43 — Agent Memory и Knowledge Graphs

> **Для AI-архитектора:** Память агента — это не «сохранять весь чат в векторную БД». Это управляемая система краткосрочного, долгосрочного и процедурного знания с provenance, retention policy и privacy controls.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Failure modes](#4-failure-modes-для-памяти-агента)
5. [Антипаттерны](#5-антипаттерны)
6. [Задачи AI-кодеру](#задачи-ai-кодеру)
7. [Чеклист архитектора](#чеклист-архитектора)

---

## 1. Введение и актуальность

### 1.1. Зачем агенту память

Агент без памяти повторяет вопросы, не учитывает прошлые решения, не строит долгосрочный workflow и теряет user preferences. Но память создаёт риски: stale facts, leakage between users, privacy violations, poisoned memories и uncontrolled context growth.



## Актуальные версии и сигналы

| Cognee | active open-source | июнь 2026 | agent memory + knowledge graph |
| Neo4j Agent Memory | active | июнь 2026 | graph-native memory |
| Graphiti | active | июнь 2026 | realtime knowledge graphs for agents |
| Vector DB + metadata | mature | июнь 2026 | baseline для semantic memory |

---

## 2. Архитектурная механика

### 2.1. Типы памяти

| Тип | Что хранит | Lifetime | Пример |
|:--|:--|:--|:--|
| Short-term | текущий диалог | session | последние сообщения |
| Episodic | события и факты сессии | days/months | «пользователь утвердил договор DOC-123» |
| Semantic | устойчивые факты | months/years | «клиент использует MSK timezone» |
| Procedural | правила/навыки | months/years | «перед отправкой договора проверять реквизиты» |
| Working memory | временный plan/context | task | список шагов текущего workflow |

Не всё надо сохранять. Память должна быть полезной, проверяемой, удаляемой, изолированной по tenant/user и связанной с provenance.

### 2.2. Knowledge graph как память агента

```text
(Client:ООО Ромашка) -[HAS_CONTRACT]-> (Contract:DOC-123)
(Contract:DOC-123) -[SIGNED_BY]-> (Person:Иванов)
(Person:Иванов) -[ROLE]-> (Director)
```

Graph полезен для multi-hop questions, объяснимости, deduplication entities и temporal relations. Если нужны только FAQ и нет связей между сущностями — graph может быть избыточен.

### 2.3. Memory controller: write, retrieve, forget

```text
Agent
  │
  ▼
Memory Controller
  ├── write(memory)
  ├── retrieve(query, filters)
  ├── update(memory_id)
  ├── forget(memory_id)
  └── explain(provenance)
```

Write policy: extract entities/facts, classify type, assign confidence, attach source, check duplicates, apply privacy policy.

Retrieve policy: учитывать recency, relevance, confidence, source trust, user/tenant filters и retention status.

Forget policy: TTL, user request, project completion, consent withdrawal, poisoning detection.

```typescript
interface MemoryController {
  write(record: MemoryRecord): Promise<void>;
  retrieve(
    query: string,
    filters: { tenantId: string; userId?: string; types?: MemoryType[] }
  ): Promise<ScoredMemory[]>;
  update(id: string, updates: Partial<MemoryRecord>): Promise<void>;
  forget(id: string): Promise<void>;
  explain(id: string): Promise<ProvenanceChain>;
}

interface MemoryRecord {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural';
  tenantId: string;
  userId?: string;
  subject: string;          // entity
  predicate: string;        // relation
  object: string;           // value
  confidence: number;       // 0–1
  sourceId: string;
  sourceType: 'llm' | 'user' | 'document' | 'tool';
  createdAt: string;
  expiresAt?: string;
  accessPolicy: 'public' | 'tenant' | 'user';
}
```

### 2.4. Privacy, retention и provenance

| Data type | Retention |
|:--|:--|
| Session memory | 24–72 hours |
| Support history | 90–365 days |
| Contract facts | срок договора + legal requirement |
| Debug traces | 7–30 days |
| User preferences | until deletion request |

Provenance каждой записи обязателен — иначе нельзя откатить poisoned memory:

```json
{
  "fact": "Client uses Europe/Moscow timezone",
  "source": "ticket:12345",
  "confidence": 0.92,
  "createdAt": "2026-06-10T12:00:00Z"
}
```

### 2.5. Failure modes

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Stale memory | agent uses old preferences | TTL + recency ranking |
| Cross-user leakage | пользователь видит память другого | tenant/user filters |
| Memory poisoning | вредный факт из документа влияет на ответы | source trust + human review |
| Context explosion | retrieved memory перегружает prompt | summary + top-k + token budget |
| No explainability | нельзя понять откуда факт | provenance chain |


---

## 3. Production trade-offs

| Решение | Выигрыш | Цена | Когда выбирать |
|:--|:--|:--|:--|
| Векторная БД только для памяти | просто, быстро | нет связей между фактами | FAQ, семантический поиск |
| Graph + vector hybrid | связи, multi-hop, explainability | сложнее инфра | юрлица, документооборот, контракты |
| Единая память на всех юзеров | просто | data leakage, tenant isolation | prototype |
| Tenant-scoped memory | privacy, isolation | overhead на фильтрацию | production SaaS |
| Auto-write (всё что сказано) | полнота | шум, poisoning | исследовательские агенты |
| Policy-based write (только факты) | качество, безопасность | сложнее настройка правил | production |

---

## 5. Антипаттерны

### «Сохранять весь чат»

**Почему ошибка:** это не память, а свалка контекста. Нужны facts, summaries и relations.

---

### «Векторная БД решит всё»

**Почему ошибка:** embeddings плохо отражают связи, правила, сроки и provenance. Для долгосрочной памяти часто нужен graph.

---

### «Память без удаления»

**Почему ошибка:** без retention/forget policy память становится privacy и compliance риском.

---

## Anti-checklist ☠️

- [ ] Сохранять весь чат как память — это свалка контекста, не память
- [ ] Векторная БД решит всё — embeddings плохо отражают связи, правила и сроки
- [ ] Память без удаления — privacy и compliance риск
- [ ] Одна память для всех пользователей — cross-user data leakage
- [ ] Memory записи без provenance — нельзя понять, откуда взялся факт
- [ ] Автоматически доверять memory — poisoned memory может быть занесена через документ
- [ ] Нет token budget для retrieved memory — context window переполняется

## 6. Задачи AI-кодеру

**Задача 1 — Memory record schema**

> Опиши TypeScript interface `MemoryRecord` с полями: `id`, `type`, `tenantId`, `userId`, `subject`, `predicate`, `object`, `confidence`, `sourceId`, `sourceType`, `createdAt`, `expiresAt`, `accessPolicy`. Добавь validation через Zod и тесты: запись без tenantId невалидна, запись с `expiresAt < now` не возвращается.

---

**Задача 2 — Duplicate detector**

> Реализуй `findDuplicateMemory(record, existing)`. Дубликатом считать одинаковые `tenantId`, `subject`, `predicate`, нормализованный `object` и пересекающийся `accessPolicy`. Верни `{duplicate: boolean, existingIds: string[]}`.

---

**Задача 3 — Forget policy**

> Реализуй `applyRetention(memoryRecords, now)`. Удаляет records с `expiresAt <= now`, помечает records с `retentionReason='legal_hold'` как undeletable, возвращает `{deletedIds, retainedIds}`.


## 7. Чеклист архитектора

### Memory model
- [ ] Типы памяти явно разделены
- [ ] Есть schema для facts/events/preferences
- [ ] Confidence и source trust учитываются
- [ ] Есть provenance для каждого fact

### Retrieval
- [ ] Tenant/user filters обязательны
- [ ] Recency и relevance учитываются
- [ ] Token budget ограничен
- [ ] Retrieved memory помечается как источник

### Privacy
- [ ] Retention policy есть
- [ ] Forget API есть
- [ ] Legal hold обработан
- [ ] Cross-user leakage невозможен на уровне query
- [ ] Poisoned memory можно откатить

---

*Модуль 43 завершён.*
*Следующий: [Модуль 44 — Browser Use и Computer Use Agents](../44-browser-use-computer-use/README.md)
