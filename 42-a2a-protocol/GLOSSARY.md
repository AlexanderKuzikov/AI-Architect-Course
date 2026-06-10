# Глоссарий — A2A Protocol и Multi-Agent Systems

## A

**A2A (Agent-to-Agent)**  
Протокол коммуникации между агентами. Решает task submission, status, streaming, cancellation и artifact exchange.

**Agent Card**  
Метаданные агента: name, description, capabilities, URL, authentication. Используется для discovery и delegation.

**Artifact**  
Результат работы агента: structured JSON, text, file reference или ссылка на raw data.

---

## C

**Correlation ID**  
Идентификатор, связывающий все вызовы одного workflow across agents. Нужен для tracing и incident investigation.

---

## T

**Task**  
Единица работы в A2A. Имеет lifecycle: submitted → working → completed/failed/canceled.

**Task Store**  
Durable хранилище состояния задач. Нужно для polling, retry, audit и восстановления после restart.

