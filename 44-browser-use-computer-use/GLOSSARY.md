# GLOSSARY — Browser Use и Computer Use Agents

## A

**Action Schema**  
Typed contract допустимых действий браузера: goto, fill, click, wait, extract, screenshot. Нужен для validation и policy enforcement.

---

## B

**Browser Context**  
Изолированная сессия браузера: cookies, localStorage, viewport, permissions. Для agent run должен быть отдельный context.

---

## C

**Computer Use Agent**  
тип агента, управляющего экраном, мышью, клавиатурой, мобильным устройством или desktop-приложением (шире чем browser-use, который ограничен браузером).

**Screenshot Grounding**  
техника получения контекста страницы через скриншот. Комбинируется с DOM snapshot для надёжных selectors. Screenshot-only недостаточен — не даёт accessibility tree и точных координат элементов.

---

## D

**DOM Grounding**  
Привязка действий агента к конкретным элементам DOM: selectors, accessibility tree, ARIA labels, screenshots.

---

## S

**Session Isolation**  
Разделение browser sessions по user/run/tenant. Предотвращает leakage cookies и cross-user actions.

---

## U

**URL Allowlist**  
Список разрешённых origins/domains для browser-use agent. Всё вне allowlist запрещено.

*Глоссарий модуля 44. Следующий: [Модуль 45 — Agentic RAG и Graph RAG](../45-agentic-rag-graph-rag/GLOSSARY.md)*

