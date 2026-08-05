# GLOSSARY — Agent Memory и Knowledge Graphs

## A

**Access Policy**  
Поле MemoryRecord: `public` | `tenant` | `user`. Определяет, кто может получить доступ к записи. Без него — cross-user leakage.

---

## C

**Confidence**  
Оценка 0–1 надёжности факта. Определяет приоритет при конфликте записей и trust при retrieve.

**Cross-user Leakage**  
Утечка памяти одного пользователя другому. Контроль: tenant/user filters на уровне запроса, доступ для retrieve обязателен.

---

## D

**Deduplication**  
Устранение дубликатов фактов по ключу `(tenantId, subject, predicate, normalized object)`. Без него retrieve возвращает копии одного факта.

---

## E

**Entity Extraction**  
Извлечение сущностей из текста (компании, люди, документы) для построения knowledge graph.

**Episodic Memory**  
Память событий и фактов сессии: «пользователь утвердил договор DOC-123». Lifetime: дни–месяцы.

---

## F

**Forget Policy**  
Правила удаления памяти: TTL, запрос пользователя, завершение проекта, отзыв согласия, детекция poisoning.

---

## G

**Graph Traversal**  
Запрос по связям графа (Cypher/GQL): «кто подписал договор с компанией, где директор Иванов?». Ценность graph — multi-hop запросы.

---

## K

**Knowledge Graph**  
Граф из сущностей и отношений с typed edges. Полезен для multi-hop, объяснимости, deduplication entities и temporal relations.

---

## L

**Legal Hold**  
Юридическое приостановление удаления: `retentionReason='legal_hold'` делает запись undeletable. Исключение из GDPR-delete.

---

## M

**Memory Controller**  
Компонент, управляющий памятью: write, retrieve, update, forget, explain. Единая точка применения политик.

**Memory Poisoning**  
Занесение вредного/ложного факта в память через документ или меж-агентский трафик. Контроль: source trust, human review, откат по provenance.

---

## P

**Procedural Memory**  
Память правил и навыков: «перед отправкой договора проверять реквизиты». Lifetime: месяцы–годы. Требует human review.

**Provenance**  
Запись об источнике факта: sourceId, sourceType, confidence, createdAt. Обязательна — без неё нельзя откатить poisoned memory.

**Provenance Chain**  
Цепочка источников до корня. Позволяет понять, откуда взялся факт даже после нескольких переносов.

---

## R

**Relation Extraction**  
Извлечение отношений между сущностями: `(Компания) -[OWNS 60%]-> (Компания)`. Строит рёбра графа.

**Retention Policy**  
Правила хранения по типам данных: session 24–72h, support 90–365d, contract facts — срок договора.

---

## S

**Semantic Memory**  
Устойчивые факты о пользователе/проекте: «клиент использует MSK timezone». Lifetime: месяцы–годы.

**Short-term Memory**  
Память текущего диалога. Lifetime: сессия.

**Source Trust**  
Степень доверия источнику факта: user > tool > document > llm. Зловредный документ — низкий trust.

---

## T

**Tenant Isolation**  
Изоляция памяти между арендаторами/пользователями. Обязательное условие production SaaS.

**TTL**  
Time-to-live записи. После истечения — не возвращается в retrieve и удаляется по Forget Policy.

---

## V

**Vector Store**  
Хранилище embeddings для семантического поиска. Baseline для semantic memory, но не отражает связи и правила.

---

## W

**Working Memory**  
Временный план/контекст текущей задачи: список шагов workflow. Lifetime: task.

---

*Глоссарий модуля 43. Следующий: [Модуль 44 — Browser Use и Computer Use](../44-browser-use-computer-use/GLOSSARY.md)*