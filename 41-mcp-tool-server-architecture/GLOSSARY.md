# GLOSSARY — MCP: Tool Server Architecture

## A

**Approval Policy**  
Правило, определяющее какие MCP tool calls требуют подтверждения человека. Обычно требуется для write/destructive/secrets/email actions.

---

## M

**MCP Client**  
Компонент, который подключается к MCP server'ам и вызывает tools/resources/prompts от имени агента.

**MCP Host**  
Runtime, который управляет агентом, UI, permissions, approvals и подключёнными MCP clients.

**MCP Server**  
Сервис, предоставляющий tools/resources/prompts через Model Context Protocol. Хороший MCP server является security boundary, а не просто proxy к API.

---

## P

**Prompts** — шаблоны повторяемых workflow в MCP. Позволяют агенту вызывать стандартизированные последовательности действий (draft_legal_response, summarize_incident) через единый контракт.

---

## R

**Resource**  
Именованный источник данных в MCP: документ, тикет, CRM-запись или virtual URI.

---

## T

**Tool**  
Действие, которое агент может вызвать через MCP. Должно иметь schema, validation, timeout, audit log и понятный результат.

*Глоссарий модуля 41. Следующий: [Модуль 42 — A2A Protocol](../42-a2a-protocol/GLOSSARY.md)*

