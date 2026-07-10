# GLOSSARY — Agent Memory и Knowledge Graphs

## E

**Episodic Memory**  
Память событий: что произошло, когда, в каком контексте. Обычно хранится с timestamps, sourceId и session/user scope.

---

## K

**Knowledge Graph**  
Графовое представление entities и relations. Полезен для долгосрочной памяти агента, multi-hop reasoning и объяснимости.

---

## M

**Memory Controller**  
Архитектурный слой между агентом и memory stores. Отвечает за write/retrieve/update/forget/explain.

---

## P

**Provenance**  
Происхождение факта: source, timestamp, user/tenant, confidence. Без provenance memory нельзя безопасно использовать.

**Procedural Memory**  
Тип долгосрочной памяти агента, хранящий правила, навыки и процедуры выполнения задач. Lifetime: months/years. Пример: «перед отправкой договора проверять реквизиты».

---

## R

**Retention Policy**  
Правило хранения памяти: TTL, legal hold, deletion policy, privacy scope.

---

## S

**Semantic Memory**  
Тип долгосрочной памяти агента, хранящий устойчивые факты о мире и пользователе. Lifetime: months/years. Пример: «клиент использует MSK timezone».

*Глоссарий модуля 43. Следующий: [Модуль 44 — Browser Use и Computer Use Agents](../44-browser-use-computer-use/GLOSSARY.md)*

