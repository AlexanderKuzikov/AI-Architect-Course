# GLOSSARY — AI Security для агентов

## A

**Agent Security Boundary**  
Граница между агентом и внешним миром: sandbox, tool allowlist, approvals, audit. Промпт не является security boundary.

**Audit Trail**  
Immutable (append-only) журнал действий: agentId, userId, toolName, argsHash, resultHash, ok. Основа расследования инцидентов.

---

## B

**Blast Radius**  
Масштаб ущерба при компрометации. Минимизируется least privilege: scoped tokens, tool allowlist, human approval.

---

## D

**Data Exfiltration**  
Вынос данных наружу: PII, контракты, секреты. Контроль: output guardrails, PII redaction, tenant isolation, audit.

**Defence in Depth**  
Многослойная защита: input → tool → approval → output → audit → recovery. Ни один слой не достаточен сам по себе.

---

## E

**Excessive Agency**  
Агент имеет больше прав, чем нужно для задачи. Принцип least privilege: права по задаче, а не по роли.

---

## I

**Indirect Prompt Injection**  
Вредная инструкция в retrieved document или сайте, а не в пользовательском вводе. Контроль: untrusted content, tool allowlist, approvals.

---

## L

**Least Privilege**  
Минимальный набор прав, необходимый для задачи. Применяется к tools, scopes, credentials, memory access.

---

## M

**Memory Poisoning**  
Занесение ложного/вредного факта в память агента через документ или меж-агентский трафик. Контроль: source trust, human review, provenance, rollback.

**Model Gateway**  
Слой доступа к LLM-провайдерам: allowlist провайдеров, классификация данных, fallback-политика, мониторинг cost/качества.

---

## O

**OWASP LLM Top 10**  
Базовый список рисков LLM-приложений: prompt injection, sensitive disclosure, supply chain, poisoning, excessive agency и др.

---

## P

**Prompt Injection**  
Атака, при которой зловредная инструкция попадает в промпт (direct — через пользователя, indirect — через контент).

---

## S

**Sandboxing**  
Изоляция агента от системы: отдельный контейнер, ограниченные права, no access к ядру. Обязательно для coding- и browser-агентов.

**Secret Redaction**  
Маскировка секретов в output и логах: `Bearer [REDACTED]`, `password=[REDACTED]`. Применяется рекурсивно по полям `token`, `secret`, `authorization`, `cookie`, `password`.

**Scoped Token**  
Credential с ограниченными правами и коротким TTL. Агент получает scoped token, а не полные credentials.

**SSRF**  
Server-Side Request Forgery: инструмент принимает URL и сервер ходит по нему. Контроль: URL allowlist, запрет private IP ranges, DNS pinning.

**Supply Chain**  
Риски через зависимости: вредоносные пакеты, отравленные модели, небезопасные плагины, уязвимые MCP-серверы. Контроль: пининг версий, SBOM, сканирование.

---

## T

**Threat Model**  
Анализ активов, акторов, угроз и blast radius. Первый шаг проектирования защит.

**Tool Abuse**  
Использование инструмента вопреки назначению: `emails:send` для спама, `documents:write` для порчи данных. Контроль: allowlist + approval + audit.

**Tenant Isolation**  
Изоляция данных между арендаторами. Обязательна на уровне retrieval, memory и output.

---

*Глоссарий модуля 47. Курс завершён.*