# Глоссарий — Browser Use и Computer Use Agents

## A

**Action Schema**  
Typed contract допустимых действий браузера: goto, fill, click, wait, extract, screenshot. Нужен для validation и policy enforcement.

---

## B

**Browser Context**  
Изолированная сессия браузера: cookies, localStorage, viewport, permissions. Для agent run должен быть отдельный context.

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

