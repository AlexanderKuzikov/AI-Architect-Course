# Глоссарий — AgentOps

## A

**AgentOps**  
Набор практик для observability, tracing, evaluation, guardrails, cost control и incident response в LLM/agent systems.

---

## E

**Evaluation Tier**  
Уровень проверки: deterministic checks, golden dataset, LLM judge, human review.

---

## G

**Guardrail**  
Policy check перед или после agent action: schema, PII, secrets, forbidden tools, cost, prompt injection.

---

## S

**Span**  
Единица tracing: один LLM call, tool call, retrieval, memory read или verifier step.

**Success Rate**  
Доля успешных agent workflows. Должна измеряться per agent и per task type.

---

## T

**Trace**  
Полный execution path одного workflow: user request → agent steps → tools → output.

