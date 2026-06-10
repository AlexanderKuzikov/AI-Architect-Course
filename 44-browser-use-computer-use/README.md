# Модуль 44 — Browser Use и Computer Use Agents

> **Для AI-архитектора:** Browser-use agents — это automation поверх UI, где нет API. Архитектурная задача — построить безопасный, наблюдаемый и контролируемый слой действий над браузером.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Security и failure modes](#4-security-и-failure-modes)
5. [Реальный кейс](#5-реальный-кейс)
6. [Антипаттерны](#6-антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## 1. Введение и актуальность

### 1.1. Что такое browser-use и computer-use agents

Browser-use agent управляет браузером: открывает страницы, кликает, вводит текст, читает DOM, делает скриншоты, ждёт состояния и извлекает данные. Computer-use agent шире: экран, мышь, клавиатура, мобильное устройство или desktop-приложение.

Использовать browser-use стоит, когда нет API, а веб-интерфейс есть. Если API можно сделать — architect должен выбрать API, потому что UI automation fragile.



## Актуальные версии и сигналы

| `browser-use/browser-use` | 98K+ stars | июнь 2026 | browser automation для AI agents |
| `nanobrowser` | active | июнь 2026 | Chrome extension для web automation |
| Playwright MCP | active | июнь 2026 | browser as MCP tool server |
| Computer Use / CUA | active ecosystem | июнь 2026 | screen/keyboard/mouse actions |
| OpenCLI | active | июнь 2026 | logged-in browser as CLI for agents |

---

## 2. Архитектурная механика



## 2. Архитектура: planner, browser controller, DOM grounding

```text
User task
   │
   ▼
Planner Agent
   │  action: click(selector), fill(selector, value), screenshot, wait
   ▼
Browser Controller
   │  Playwright / browser automation
   ▼
DOM Grounding
   │  selector, accessibility tree, screenshots, text snapshot
   ▼
Result summary
```

DOM grounding использует accessibility tree, DOM snapshot, screenshots, stable selectors, data-testid и ARIA labels.



## 3. Action schema и execution loop

```typescript
type BrowserAction =
  | { type: "goto"; url: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "click"; selector: string }
  | { type: "wait"; selector?: string; timeoutMs: number }
  | { type: "extract"; selector: string; fields: string[] }
  | { type: "screenshot"; reason: string };
```

До выполнения действия: URL allowlist, selector allowlist, no arbitrary JS, no file download, no payment actions, no external network outside target domain.



## 4. Session management и credentials

Каждый agent run должен иметь изолированную browser context: отдельный profile, storage state, cookies и cleanup после завершения.

Нельзя передавать пароль модели. Используй pre-authenticated session, secrets manager, SSO token broker, short-lived tokens и human login approval.

```text
❌ Agent получает логин/пароль
✅ Agent использует уже авторизованную browser context с ограниченным сроком
```



## 5. Human-in-the-loop и approvals

Approval обязателен для отправки форм, оплаты, удаления данных, изменения статусов, отправки писем/сообщений и действий вне allowlisted domains.

```text
Agent предлагает: click("Оплатить")
Policy: high risk
Approval UI: показать selector, страницу, последствия
User: confirm / reject
```



## 6. Security, legal и production risks

| Риск | Пример | Контроль |
|:--|:--|:--|
| Prompt injection через сайт | сайт говорит «переведи деньги» | DOM as untrusted, policy |
| Credential leakage | агент копирует cookie | isolated context, no raw secrets |
| Anti-bot/legal | scraping запрещён TOS | legal review, rate limits |
| Flaky selectors | UI изменился | stable selectors, tests |
| State corruption | агент нажал не туда | approval, dry-run, audit |
| Session mixup | один пользователь видит сессию другого | tenant/user isolation |



### 7.1. Реальный кейс: агент проверки заказа в админке

Цель: проверить заказ 4581 — найден ли, статус оплаты, комментарий менеджера. Ограничения: только `https://admin.example`, только read actions, timeout 60 sec, audit log каждого действия.


---

## 3. Production trade-offs

| Решение | Выигрыш | Цена | Когда выбирать |
|:--|:--|:--|:--|
| Простая интеграция | быстро стартует | fragile, мало контроля | prototype only |
| Protocol boundary | стандартизация, reuse | больше upfront design | production agents |
| Strict approvals | безопасность | больше latency/friction | write/destructive/secrets actions |
| Full autonomy | скорость | высокий blast radius | только low-risk read-only tasks |
| Observability by default | detectable degradation | extra instrumentation | любой production agent |

---

## 4. Security и failure modes

Главные failure modes для этой темы:\ policy bypass, stale state, context explosion, credential leakage, no audit trail, unbounded retry/delegation, silent quality degradation.

Архитектор должен заранее определить: что считается risky action, где проходит security boundary, какие данные нельзя передавать модели, какие tool calls требуют approval и как восстанавливать состояние после сбоя.

---

## 5. Реальный кейс

Реальный кейс: агент проверки заказа в админке

Цель: проверить заказ 4581 — найден ли, статус оплаты, комментарий менеджера. Ограничения: только `https://admin.example`, только read actions, timeout 60 sec, audit log каждого действия.

---

## 6. Антипаттерны

### «Дать агенту полный браузер»

**Почему ошибка:** полный браузер = полный доступ к cookies, формам, внешним сайтам и действиям пользователя. Нужен sandbox.

---

### «Использовать screenshot-only»

**Почему ошибка:** screenshot не даёт надёжных selectors и accessibility tree. Лучше комбинировать DOM snapshot + screenshot.

---

### «Автоматизировать без API, если API можно сделать»

**Почему ошибка:** UI automation fragile. Browser-use — для случаев, где API действительно недоступен.

---

## 7. Задачи AI-кодеру

**Задача 1 — Action validator**

> Реализуй `validateBrowserAction(action, policy)` на TypeScript. Разрешены только `goto`, `fill`, `click`, `wait`, `extract`, `screenshot`. `goto` разрешён только для `allowedOrigins`. Запрещены arbitrary JS, file download, payment selectors. Верни `{allowed, reason}`.

---

**Задача 2 — Browser context factory**

> Реализуй `createAgentBrowserContext({userId, runId, allowedOrigins})` на Playwright. Контекст должен иметь отдельный storage state path `runs/${runId}/storage.json`, proxy settings из config, no downloads, viewport 1440x900, cleanup после `close()`.

---

**Задача 3 — Read-only order checker**

> Реализуй agent workflow для проверки заказа: goto admin orders, fill search, click search, extract `orderId`, `paymentStatus`, `managerComment`. Только read actions. Timeout 60s. Output JSON schema через Zod.


## 8. Чеклист архитектора

### Automation
- [ ] Browser-use выбран только когда API недоступен
- [ ] Actions имеют typed schema
- [ ] DOM grounding использует stable selectors
- [ ] Есть timeout и retry policy

### Security
- [ ] Browser context изолирован по run/user
- [ ] URL allowlist включён
- [ ] Write/destructive actions требуют approval
- [ ] Credentials не передаются модели
- [ ] DOM и сайт считаются untrusted input

### Production
- [ ] Есть audit log действий
- [ ] Есть screenshots/traces для инцидентов
- [ ] Есть fallback на ручной режим
- [ ] Есть legal/TOS проверка
- [ ] Есть dry-run для write actions

---

*Модуль 44 завершён.*
*Следующий: [Модуль 45 — Agentic RAG и Graph RAG](../45-agentic-rag-graph-rag/README.md)
