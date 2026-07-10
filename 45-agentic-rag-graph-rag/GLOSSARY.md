# GLOSSARY — Agentic RAG и Graph RAG

## A

**Agentic RAG**  
RAG-система, где retrieval управляется агентным loop: planning, multi-step retrieval, gap detection, verification.

---

## G

**Graph RAG**  
RAG, использующий knowledge graph: entities, relations, communities, paths.

**Graph Retriever**  
Retriever, который ищет не только chunks, но и relations/entities в graph.

---

## H

**Hallucination Cascade**  
Цепочка ошибок, когда неверный результат одного шага приводит к новым неверным retrieval/generation шагам.

---

## T

**Temporal RAG**  
RAG, учитывающий версии документов, valid_from/valid_to, superseded_by и as-of date.

---

## V

**Verifier**  
Компонент, который проверяет claims against evidence. Может быть deterministic, LLM-based или hybrid.

*Глоссарий модуля 45. Следующий: [Модуль 46 — AgentOps](../46-agentops/GLOSSARY.md)*

