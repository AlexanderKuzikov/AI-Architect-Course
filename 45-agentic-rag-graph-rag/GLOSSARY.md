# GLOSSARY — Agentic RAG и Graph RAG

## A

**Abstain**  
Отказ агента отвечать при недостатке или противоречивости данных. Лучше «не знаю», чем «уверенно неверно».

**Agentic RAG**  
RAG с итеративным retrieval: query → plan → retrieve → inspect gaps → retrieve again → verify → answer. Планировщик выбирает retrievers, verifier проверяет claims.

**Answer Relevance**  
Метрика: насколько ответ отвечает на вопрос. Считается семантической близостью ответа и вопроса.

---

## B

**BM25**  
Классический лексический поиск по точным совпадениям. Комплемент vector-поиска: ловит термины, не пойманные семантикой.

---

## C

**Citation**  
Ссылка claim'а на источник. Без verifier'а цитата — «для красоты»; неподтверждённый claim опаснее отсутствия цитаты.

**Citation Washing**  
Ситуация, когда цитата не подтверждает claim (ссылка есть, доказательства нет). Контроль: verifier по requiredEvidence.

**Community Detection**  
Группировка связанных сущностей графа в community summaries. Даёт обзорные ответы без перебора всех узлов.

**Community Summary**  
Сводка по сообществу связанных сущностей. Используется для ответов «в целом по теме».

**Confidence**  
Оценка 0–1 поддержки claim источниками. Порог для abstain.

**Context Precision**  
Метрика: насколько каждый чанк контекста релевантен. Оценивает точность retrieval.

**Contradiction Detection**  
Поиск противоречий между источниками. Противоречие — сигнал для verifier и углубления, а не для усреднения.

---

## E

**Entity Resolution**  
Разрешение омонимов и синонимов при извлечении сущностей («Ромашка» — компания или цветок). По контексту и типу узла.

**Evidence Pack**  
Собранный набор доказательств: chunks + entities + relations + gaps + iterationCount. Основа для ответа и верификации.

---

## F

**Faithfulness**  
Метрика: нет ли галлюцинаций. Claim'ы ответа сверяются с источниками.

---

## G

**Graph RAG**  
RAG поверх knowledge graph: entities, relations, communities, multi-hop пути. Даёт связи, объяснимость, deduplication сущностей.

**Graph Retriever**  
Retriever, работающий по рёбрам графа: multi-hop пути, связи сущностей, community summaries.

---

## H

**Hallucination Cascade**  
Каскад галлюцинаций: ошибка на одном шаге порождает новые (неверный факт → неверный запрос → неверный ответ). Контроль: verifier на каждом шаге.

---

## R

**Rerank**  
Постобработка retrieved-чанков: уточнение порядка по релевантности. Шаг между retrieval и контекстом.

**Retrieval Planner**  
Компонент, выбирающий retrievers и формулирующий шаги запроса. Ограничения: max steps, token budget.

---

## T

**Temporal RAG**  
RAG с версионностью документов: valid_from/valid_to, superseded_by, as-of date. Предотвращает ответ по устаревшей версии.

---

## V

**Verifier**  
Компонент, проверяющий claims: достаточно ли evidence, нет ли противоречий, нужен ли ещё retrieval. Считает confidence и принимает решение об abstain.

---

*Глоссарий модуля 45. Следующий: [Модуль 46 — AgentOps](../46-agentops/GLOSSARY.md)*