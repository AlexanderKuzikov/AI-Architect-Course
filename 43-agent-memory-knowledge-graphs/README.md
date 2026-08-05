# Модуль 43 — Agent Memory и Knowledge Graphs

> **Для AI-архитектора:** Память агента — это не «сохранять весь чат в векторную БД». Это управляемая система краткосрочного, долгосрочного и процедурного знания с provenance, retention policy и privacy controls.
>
> Один день изучения — от типов памяти и memory controller до knowledge graphs, provenance и poisoned-memory отката.

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
| Cognee | active | agent memory + knowledge graph |
| Neo4j Agent Memory | active | graph-native memory |
| Graphiti | active | realtime knowledge graphs for agents |
| Vector DB + metadata | mature | baseline для semantic memory |
| HiGraph / lightweight graph | рассматривать | локальные графы без Neo4j |

---

## 1. Введение и актуальность

### 1.1. Зачем агенту память

Агент без памяти повторяет вопросы, не учитывает прошлые решения, не строит долгосрочный workflow и теряет user preferences. Но память создаёт риски: stale facts, leakage between users, privacy violations, poisoned memories и uncontrolled context growth.

**Память — не «сохранить всё».** Она архитектурный компонент с четырьмя операциями: write, retrieve, update, forget. И с жёсткими ограничениями: tenant isolation, retention, provenance, token budget.

### 1.2. Память vs RAG

| | RAG | Agent Memory |
|:--|:--|:--|
| Что хранит | документы, чанки | факты, события, правила, preferences |
| Источник | корпус документов | взаимодействие агента с пользователем |
| Формат | embeddings + метаданные | факты + отношения + confidence |
| Обновление | переиндексация | point update, forget |
| Пример | «найди в договоре клаузу» | «клиент предпочитает МСК, договоры уровней A/B» |

**Практический вывод для архитектора:** RAG отвечает на «что в документах?», память — на «что мы знаем о пользователе/проекте?». Это разные системы с разными требованиями к консистентности и удалению.

### Граничные случаи — где ломается

**Память как RAG**: если память — просто векторная БД по всему чату, retrieve вернёт «клочки» диалога, а не факты. Retrieval по фактам ≠ поиск по тексту.

**Весь чат в память**: хранить весь диалог — это не память, а свалка. Растёт cost каждого запроса, падает precision, растёт риск leakage.

**Почему это важно архитектору:** память — это производная информация, а не архив. Каждая запись должна быть фактом с provenance, а не сырым текстом.

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

### 2.2. Memory controller: write, retrieve, forget

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

### 2.3. Knowledge graph как память агента

```text
(Client:ООО Ромашка) -[HAS_CONTRACT]-> (Contract:DOC-123)
(Contract:DOC-123) -[SIGNED_BY]-> (Person:Иванов)
(Person:Иванов) -[ROLE]-> (Director)
```

Graph полезен для multi-hop questions, объяснимости, deduplication entities и temporal relations. Если нужны только FAQ и нет связей между сущностями — graph может быть избыточен.

**Построение графа из текста:**

```text
Текст: "ООО Ромашка владеет 60% ООО Астра"
Entity extraction: [ООО Ромашка], [ООО Астра]
Relation extraction: (ООО Ромашка) -[OWNS 60%]-> (ООО Астра)
Confidence: 0.9 | Source: документ:47 | Validated: нет
```

**Схема графа** (node/edge types) — это дизайн-решение:

| Node type | Edge type | Пример |
|:--|:--|:--|
| Company | OWNS, HAS_CONTRACT, SIGNED_BY | собственность, договоры |
| Person | ROLE, SIGNED_BY, APPROVED | подписи, роли |
| Document | SUPERSEDES, AMENDS | версии документов |
| Policy | REQUIRES, BELONGS_TO | правила и клаузы |

**Traversal-запросы** (Cypher/GQL):

```cypher
// Кто подписал договор с компанией, где директор Иванов?
MATCH (d:Document {id:'DOC-123'})-[:SIGNED_BY]->(p:Person)<-[:ROLE]-(c:Company {name:'ООО Ромашка'})
RETURN p.name
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

Provenance chain: `fact → source → sourceType → confidence → createdAt`. Для отката poisoned memory достаточно `forget(factId)` + блокировки повторного write из того же source.

### Граничные случаи — где ломается

**Конкурентные записи**: два агента одновременно пишут факт про одного клиента. Последний write побеждает — но это может быть более низкий confidence. Необходим конфликт-резолюшн: compare confidence + recency, или merge.

**Дубликаты facts**: «клиент использует МСК» записан трижды с разными id. Retrieve возвращает тройную копию. Deduplication по (tenantId, subject, normalized predicate) обязателен.

**Юридическое удаление (GDPR)**: пользователь просит удалить персональные данные. Forget должен каскадно пройти по всем типам памяти, включая references в графе. Legal hold — исключение: retentionReason='legal_hold' блокирует удаление.

**Token budget**: retrieved memory забивает context window. Top-k + summary + token budget. Memory должна помещаться в отведённый лимит, иначе агент «забывает» системный промпт.

**Почему это важно архитектору:** память — единственный компонент агента, где «просто положить данные» приводит к юридическим и качественным рискам. Конкурентность, дубликаты, удаление и бюджет — обязательные механики, а не «потом добавим».

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

## 4. Failure modes

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Stale memory | agent uses old preferences | TTL + recency ranking |
| Cross-user leakage | пользователь видит память другого | tenant/user filters |
| Memory poisoning | вредный факт из документа влияет на ответы | source trust + human review |
| Context explosion | retrieved memory перегружает prompt | summary + top-k + token budget |
| No explainability | нельзя понять откуда факт | provenance chain |
| Duplicate facts | факт записан N раз | deduplication key |
| Lost memory | рестарт стёр рабочую память | durable store + reconciliation |

---

## Реальный кейс

### Входные данные

Юридический assistant: память по клиентам и договорам. 2000 активных клиентов, каждый со сторонами договоров, подписями, preferences. Нужно: multi-hop вопросы («какие договоры подписал директор Иванов?»), объяснимость решений, удаление по запросу клиента.

### Гипотеза

Гибрид: vector для семантического поиска + graph (Neo4j) для связей и multi-hop. Policy-based write: в память попадают только факты с источником и confidence, не сырые диалоги.

### Что получилось

- graph: `(Company)-[:HAS_CONTRACT]->(Contract)-[:SIGNED_BY]->(Person)` — multi-hop ответы работают;
- vector: «проблемы с оплатой» → семантический поиск по жалобам клиента;
- deduplication по (tenantId, subject, predicate) — убрал тройные копии;
- provenance обязательна: каждый факт знает источник, пересоздание графа из истории возможно;
- GDPR delete: каскадный forget по всем типам + legal hold для открытых дел.

**Что неожиданно:** самым дорогим оказался не graph, а **процесс извлечения фактов** (entity/relation extraction). LLM вытягивает факты с ошибками, и без human review для procedural memory качество деградирует. Graph сам по себе не решает quality — он только делает ошибки видимыми.

### Вывод, противоречащий интуиции

Значимость graph переоценена: для большинства сценариев vector + метаданные достаточно. Graph даёт выигрыш только на multi-hop и объяснимости — и то при условии качественного extraction. Архитектор должен сначала ответить «нужны ли связи между фактами», и только потом выбирать хранилище.

---

## 6. Антипаттерны

### «Сохранять весь чат»

**Выглядит правильно:** полная информация.

**Почему ошибка:** это не память, а свалка контекста. Растут cost, шум, риск leakage. Нужны facts, summaries и relations.

---

### «Векторная БД решит всё»

**Выглядит правильно:** embeddings — универсальный поиск.

**Почему ошибка:** embeddings плохо отражают связи, правила, сроки и provenance. Для долгосрочной памяти часто нужен graph.

---

### «Память без удаления»

**Выглядит правильно:** чем больше данных, тем умнее агент.

**Почему ошибка:** без retention/forget policy память становится privacy и compliance риском.

---

### «Доверять письму в память»

**Выглядит правильно:** агент сам решает, что запомнить.

**Почему ошибка:** LLM ошибается в извлечении фактов, а зловредный документ может занести poisoned memory. Нужен source trust и review для критичных типов.

---

## Anti-checklist ☠️

- [ ] Сохранять весь чат как память — это свалка контекста, не память
- [ ] Векторная БД решит всё — embeddings плохо отражают связи, правила и сроки
- [ ] Память без удаления — privacy и compliance риск
- [ ] Одна память для всех пользователей — cross-user data leakage
- [ ] Memory записи без provenance — нельзя понять, откуда взялся факт
- [ ] Автоматически доверять memory — poisoned memory может быть занесена через документ
- [ ] Нет token budget для retrieved memory — context window переполняется
- [ ] Нет deduplication — факт записан N раз, retrieve возвращает копии

---

## Задачи AI-кодеру

Плохая формулировка: > «Сделай память для агента»

Хорошая формулировка: > «Опиши TypeScript interface `MemoryRecord` с полями `id`, `type`, `tenantId`, `userId`, `subject`, `predicate`, `object`, `confidence`, `sourceId`, `sourceType`, `createdAt`, `expiresAt`, `accessPolicy`. Добавь validation через Zod и тесты: запись без tenantId невалидна, запись с `expiresAt < now` не возвращается.»

Формула: точная схема + валидация + тесты инвариантов.

---

**Задача 1 — Memory record schema**

> Опиши TypeScript interface `MemoryRecord` с полями: `id`, `type`, `tenantId`, `userId`, `subject`, `predicate`, `object`, `confidence`, `sourceId`, `sourceType`, `createdAt`, `expiresAt`, `accessPolicy`. Добавь validation через Zod и тесты: запись без tenantId невалидна, запись с `expiresAt < now` не возвращается.

---

**Задача 2 — Duplicate detector**

> Реализуй `findDuplicateMemory(record, existing)`. Дубликатом считать одинаковые `tenantId`, `subject`, `predicate`, нормализованный `object` и пересекающийся `accessPolicy`. Верни `{duplicate: boolean, existingIds: string[]}`.

---

**Задача 3 — Forget policy**

> Реализуй `applyRetention(memoryRecords, now)`. Удаляет records с `expiresAt <= now`, помечает records с `retentionReason='legal_hold'` как undeletable, возвращает `{deletedIds, retainedIds}`.

---

**Задача 4 — Provenance chain**

> Реализуй `buildProvenanceChain(record, records)` — по `sourceId` строит цепочку источников до корня. Каждый элемент: `{id, sourceType, sourceId, createdAt}`. Верни chain или `[]` если найти нельзя. Тест: факт с источником, который сам ссылается на документ.

---

## Чеклист архитектора

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
- [ ] Deduplication реализована

### Privacy
- [ ] Retention policy есть
- [ ] Forget API есть
- [ ] Legal hold обработан
- [ ] Cross-user leakage невозможен на уровне query
- [ ] Poisoned memory можно откатить

### Graph (если выбран)
- [ ] Node/edge schema определена
- [ ] Extraction имеет confidence и review
- [ ] Traversal-запросы покрывают реальные вопросы
- [ ] Graph оправдан multi-hop-запросами

---

*Модуль 43 завершён.*
*Следующий: [Модуль 44 — Browser Use и Computer Use Agents](../44-browser-use-computer-use/README.md)*