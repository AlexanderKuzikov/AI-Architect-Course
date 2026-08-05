# Модуль 44 — Browser Use и Computer Use Agents

> **Для AI-архитектора:** Browser-use agents — это automation поверх UI, где нет API. Архитектурная задача — построить безопасный, наблюдаемый и контролируемый слой действий над браузером.
>
> Один день изучения — от planner/controller/DOM-grounding до action schema, approvals, капчи и WAF-обхода легальными методами.

## Содержание

1. [Введение и актуальность](#1-введение-и-актуальность)
2. [Архитектурная механика](#2-архитектурная-механика)
3. [Production trade-offs](#3-production-trade-offs)
4. [Security и failure modes](#4-security-и-failure-modes)
5. [Реальный кейс](#реальный-кейс)
6. [Антипаттерны](#6-антипаттерны)
7. [Anti-checklist ☠️](#anti-checklist-️)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Проверено: август 2026

| Инструмент | Версия | Назначение |
|:--|:--|:--|
| Playwright | 1.5x | browser automation, cross-browser |
| Puppeteer | 25.x | Chrome automation (одна из практик курса) |
| `browser-use/browser-use` | 98K+ stars | browser automation для AI agents |
| Playwright MCP | active | browser как MCP tool server |
| Computer Use / CUA | active ecosystem | screen/keyboard/mouse actions |

---

## 1. Введение и актуальность

### 1.1. Что такое browser-use и computer-use agents

Browser-use agent управляет браузером: открывает страницы, кликает, вводит текст, читает DOM, делает скриншоты, ждёт состояния и извлекает данные. Computer-use agent шире: экран, мышь, клавиатура, мобильное устройство или desktop-приложение.

Использовать browser-use стоит, когда нет API, а веб-интерфейс есть. Если API можно сделать — architect должен выбрать API, потому что UI automation fragile.

### 1.2. Browser-use vs API vs Playwright script

| Подход | Надёжность | Гибкость | Стоимость |
|:--|:--|:--|:--|
| API | максимальная | ограничена API | зависит |
| Playwright script (hardcoded) | высокая | низкая | дёшево |
| Browser-use agent | низкая | максимальная | дорого (LLM на каждый шаг) |

Правило: API > script > agent. Агент — последний резерв для legacy-систем без API.

### Граничные случаи — где ломается

**«API можно сделать»**: если backend принадлежит тебе — не строй browser-use, открой API. UI automation fragile: один `class` изменился — весь пайплайн упал.

**Сайт без API, но с лимитом**: scraping судебных/гос. сайтов часто запрещён TOS или защищён антиботом. Техническая возможность ≠ легальное право. Проверяй TOS и rate limits до запуска.

**Почему это важно архитектору:** browser-use — высокая стоимость сопровождения (flaky selectors, антибот, капча). Архитектор выбирает его только когда API физически нет, и закладывает бюджет на сопровождение.

---

## 2. Архитектурная механика

### 2.1. Архитектура: planner, browser controller, DOM grounding

```text
User task
   │
   ▼
Planner Agent
   │  action: click(selector), fill(selector, value), screenshot, wait
   ▼
Browser Controller
   │  Playwright / Puppeteer
   ▼
DOM Grounding
   │  selector, accessibility tree, screenshots, text snapshot
   ▼
Result summary
```

DOM grounding использует accessibility tree, DOM snapshot, screenshots, stable selectors, data-testid и ARIA labels.

### 2.2. Browser controller на Playwright

```typescript
import { chromium, BrowserContext } from 'playwright';

export async function createAgentBrowserContext(opts: {
  userId: string;
  runId: string;
  allowedOrigins: string[];
  proxy?: string;
}): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
  const context = await chromium.launchPersistentContext(
    `runs/${opts.runId}/profile`,      // изолированный profile
    {
      headless: true,
      viewport: { width: 1440, height: 900 },
      acceptDownloads: false,          // запрет загрузки файлов
      proxy: opts.proxy ? { server: opts.proxy } : undefined,
    }
  );

  return {
    context,
    close: async () => {
      await context.close();           // cleanup: cookies, storage, profile
    },
  };
}

// Ожидания: селектор + состояние
async function waitForStable(page: any, selector: string, timeoutMs = 10_000) {
  await page.waitForSelector(selector, { state: 'visible', timeout: timeoutMs });
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
}
```

Ключевые решения:
- `launchPersistentContext` — отдельный profile на каждый run;
- `acceptDownloads: false` — file download запрещён по policy;
- каждый run — изолированный контекст, cleanup в `finally`.

### 2.3. Action schema и execution loop

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

```typescript
function validateBrowserAction(
  action: BrowserAction,
  policy: { allowedOrigins: string[] }
): { allowed: boolean; reason?: string } {
  if (action.type === 'goto') {
    const url = new URL(action.url);
    if (!policy.allowedOrigins.some(o => url.origin.startsWith(o))) {
      return { allowed: false, reason: `Origin ${url.origin} not allowed` };
    }
  }
  if (action.type === 'click' && action.selector.includes('pay')) {
    return { allowed: false, reason: 'Payment selectors blocked' };
  }
  return { allowed: true };
}
```

### 2.4. DOM grounding: stable selectors vs текст

```typescript
// ❌ Селектор по классу — сломается при редизайне
const selector = '.order-card .btn-primary';

// ✅ data-testid — стабильный контракт
const selector = '[data-testid="order-payment-status"]';

// ✅ Accessibility tree — ролльный контракт
const status = await page.getByRole('cell', { name: /Оплачен/i }).textContent();
```

Иерархия надёжности: `data-testid` > ARIA role + name > text selector > CSS class. **Screenshot-only** — самый ненадёжный вариант: VLM может ошибаться в координатах, а accessibility tree недоступен.

### 2.5. Session management и credentials

Каждый agent run — изолированная browser context: отдельный profile, storage state, cookies, cleanup после завершения.

Нельзя передавать пароль модели. Используй pre-authenticated session, secrets manager, SSO token broker, short-lived tokens, human login approval:

```text
❌ Agent получает логин/пароль
✅ Agent использует уже авторизованную browser context с ограниченным сроком
```

```typescript
// Pre-authenticated session: storage state вместо credentials
await context.storageState({ path: `runs/${runId}/storage.json` });
// ... в следующем run:
const context = await browser.newContext({ storageState: `runs/${runId}/storage.json` });
```

### 2.6. Human-in-the-loop и approvals

Approval обязателен для: отправки форм, оплаты, удаления данных, изменения статусов, отправки писем/сообщений, действий вне allowlisted domains.

```text
Agent предлагает: click("Оплатить")
Policy: high risk
Approval UI: показать selector, страницу, последствия
User: confirm / reject
```

### 2.7. Computer Use: экран, мышь, клавиатура

Computer-use агент управляет не браузером, а ОС: скриншот экрана → VLM читает → действие (клик в координатах, ввод текста). Применяется для desktop-приложений без API и без браузера.

```text
Screenshot (экран) → VLM: "что на экране, где кнопка" → coordinate action → screenshot again
```

Грабли computer-use:
- координаты зависят от разрешения и масштабирования (DPI);
- элементы не имеют селекторов и accessibilty tree;
- ошибки накапливаются: один неверный клик каскадом ломает сессию;
- нужен max-iteration budget и rollback.

**Практический вывод для архитектора:** Computer Use — наименее надёжный слой автоматизации. Его место — интерактивный copilot с человеком в цикле, а не автономный batch. Если браузером можно — браузер, если API — API.

### Граничные случаи — где ломается

**SPA-роутинг**: клик по ссылке не перезагружает страницу — `waitForLoadState('load')` может никогда не наступить. Нужно ждать конкретный селектор или network response.

**Shadow DOM**: `page.click('.btn')` не найдёт элемент внутри shadow root. Нужен `page.locator('...').click({ force: true })` или pierce shadow DOM.

**Iframes**: банк платит через iframe. `page.click` работает с top-level frame; для фреймов — `page.frameLocator('iframe[name=payment]')`.

**Капча**: сайт отдал капчу — агент не может её пройти без внешнего сервиса. Решение: интеграция с капча-решателем (RuCaptcha и т.п.) + пауза + retry.

**Session expiry**: логин протух посреди run. Ошибка «401» или редирект на login. Нужен re-auth hook: повторный вход по storage state или человеческий approval.

**WAF/403**: сайт забанил по IP. Контроль: rate limiting, backoff при 403, ротация: человеко-подобные паузы, реальный User-Agent, уважение Retry-After.

**Почему это важно архитектору:** browser-use падает на граничных случаях, а не на happy path. Каждый из них — это отдельный код, время и сопровождение. Чек-лист: SPA, shadow DOM, iframes, капча, session expiry, WAF — до запуска в прод.

---

## 3. Production trade-offs

| Решение | Выигрыш | Цена | Когда выбирать |
|:--|:--|:--|:--|
| Browser-use (agent driven) | гибкость, работает без API | flaky, медленно, опасно | нет API, legacy system |
| Playwright script (hardcoded) | надёжно, быстро, дешево | хрупкий при изменении UI | стабильный UI, известные селекторы |
| DOM + screenshot hybrid | надёжнее чем screenshot-only | сложнее | высокие требования к accuracy |
| Только screenshot | простота | ненадёжные селекторы | prototype |
| Full sandbox (incognito + proxy) | безопасно | overhead, limited sessions | production с untrusted sites |
| Shared browser context | дёшево | data leakage между runs | prototype |

---

## 4. Security и failure modes

### 4.1. Риски

| Риск | Пример | Контроль |
|:--|:--|:--|
| Prompt injection через сайт | сайт говорит «переведи деньги» | DOM as untrusted, policy layer |
| Credential leakage | агент копирует cookie | isolated context, no raw secrets |
| Anti-bot/legal | scraping запрещён TOS | legal review, rate limits |
| Flaky selectors | UI изменился | stable selectors, data-testid |
| State corruption | агент нажал не туда | approval, dry-run, audit log |
| Session mixup | один видит сессию другого | tenant/user isolation |

### 4.2. Failure modes

| Failure mode | Симптом | Контроль |
|:--|:--|:--|
| Detached element | клик по элементу из старого DOM | re-query, retry |
| Stale snapshot | VLM смотрел старый screenshot | screenshot + DOM sync |
| Runaway loop | агент кликает бесконечно | max iterations, budget |
| Captcha block | задача невыполнима | captcha-сервис, human fallback |
| 403/WAF | банит IP | backoff, rate limit, ротация |
| Session expiry | редирект на login | re-auth hook |

### Граничные случаи — где ломается

**Audit log без скриншотов**: «агент нажал не туда» — без screenshot/trace до инцидента невозможно воспроизвести. Каждый run — видеозапись шагов (trace Playwright).

**Dry-run для write**: «отправить форму» — сначала dry-run (заполнить, не отправлять), потом approval. Иначе каждая ошибка = реальное действие.

**Почему это важно архитектору:** browser-use — зона повышенного риска (реальные действия на реальном UI). Каждый write-action должен быть за audit-log, approval и trace.

---

## Реальный кейс

### Входные данные

Сбор данных с сайтов судов РФ (ГАС «Правосудие»): поиск дел по номеру и участникам, парсинг карточек, мониторинг изменений. API нет, только HTML-интерфейсы sudrf.ru / msudrf.ru. Капча на мировых судах. 3 типа судов с разной вёрсткой.

### Гипотеза

Puppeteer + классификация суда по типу → адаптеры поиска и парсинга + интеграция с RuCaptcha + backoff при 403 (WAF). Стабильный UI-слой поверх нестабильных сайтов.

### Что получилось

- **Классификация по типу суда** (мировой/районный/апелляционный/кассационный) → выбор адаптера;
- **Капча**: RuCaptcha через API, пауза и retry при отказе;
- **WAF/403**: backoff с экспоненциальной задержкой, уважение Retry-After — сбор стал стабильным;
- **Нормализация номеров дела**: `1-123/2026` vs `1-123-26/2026` приводятся к канону до поиска;
- отдельный browser context на run, никаких credentials в коде;
- парсинг карточек — задание конкретным адаптерам, а не LLM на каждый шаг.

**Что неожиданно:** **LLM-слой оказался не нужен для DOM-парсинга**. Классификация суда и извлечение полей — это детерминированные regex/адаптеры, а не агент. LLM-агент оправдан только для «разборчивости» нестандартных страниц — и это дорого и медленно. Автономный agent-driven scraping на 1000 страниц/день — это дорого и нестабильно; script/адаптер — надёжно и поработимо.

### Вывод, противоречащий интуиции

Самая надёжная «browser-use» система — та, где агент почти не участвует. Агент решает «какой адаптер и с какими параметрами», а сами действия выполняет детерминированный код. Это переворачивает «агент кликает мышкой» в «агент конфигурирует скрипт». Дешевле, стабильнее, аудируемо.

---

## 6. Антипаттерны

### «Дать агенту полный браузер»

**Выглядит правильно:** агент сам разберётся.

**Почему ошибка:** полный браузер = полный доступ к cookies, формам, внешним сайтам и действиям пользователя. Нужен sandbox, URL allowlist, изолированный контекст.

---

### «Использовать screenshot-only»

**Выглядит правильно:** VLM видит то же, что человек.

**Почему ошибка:** screenshot не даёт надёжных selectors и accessibility tree. Лучше комбинировать DOM snapshot + screenshot.

---

### «Автоматизировать без API, если API можно сделать»

**Выглядит правильно:** UI automation — универсально.

**Почему ошибка:** UI automation fragile. Browser-use — для случаев, где API действительно недоступен.

---

### «Агент на каждый шаг»

**Выглядит правильно:** гибкость.

**Почему ошибка:** LLM на каждый клик = дорого, медленно, нестабильно. Детерминированные шаги — код, LLM только для нестандартных случаев.

---

## Anti-checklist ☠️

- [ ] Дать агенту полный браузер — полный доступ к cookies, формам и внешним сайтам
- [ ] Использовать screenshot-only — нет надёжных selectors и accessibility tree
- [ ] Автоматизировать без API, если API можно сделать — UI automation fragile
- [ ] Передавать пароль модели — pre-authenticated session безопаснее
- [ ] Не проверять TOS сайта — scraping может быть запрещён юридически
- [ ] Нет URL allowlist — агент уходит на любой сайт в интернете
- [ ] Нет audit log действий — невозможно воспроизвести что произошло
- [ ] Агент на каждый шаг вместо скрипта — дорого, медленно, нестабильно
- [ ] Нет обработки капчи/403 — batch умирает на первом же блоке

---

## Задачи AI-кодеру

Плохая формулировка: > «Сделай browser агента»

Хорошая формулировка: > «Реализуй `validateBrowserAction(action, policy)` на TypeScript. Разрешены только `goto`, `fill`, `click`, `wait`, `extract`, `screenshot`. `goto` разрешён только для `allowedOrigins`. Запрещены arbitrary JS, file download, payment selectors. Верни `{allowed, reason}`. Тест: `goto('https://evil.example')` с allowlist `['https://admin.example']` возвращает `allowed: false`.»

Формула: список допустимых действий + точные правила + запрещённые паттерны + тест на запрет.

---

**Задача 1 — Action validator**

> Реализуй `validateBrowserAction(action, policy)` на TypeScript. Разрешены только `goto`, `fill`, `click`, `wait`, `extract`, `screenshot`. `goto` разрешён только для `allowedOrigins`. Запрещены arbitrary JS, file download, payment selectors. Верни `{allowed, reason}`.

---

**Задача 2 — Browser context factory**

> Реализуй `createAgentBrowserContext({userId, runId, allowedOrigins})` на Playwright. Контекст должен иметь отдельный storage state path `runs/${runId}/storage.json`, proxy settings из config, no downloads, viewport 1440x900, cleanup после `close()`.

---

**Задача 3 — Read-only order checker**

> Реализуй agent workflow для проверки заказа: goto admin orders, fill search, click search, extract `orderId`, `paymentStatus`, `managerComment`. Только read actions. Timeout 60s. Output JSON schema через Zod. Добавь обработку отсутствия заказа (`null` в JSON).

---

**Задача 4 — 403/backoff обёртка**

> Реализуй `withBackoff(fn, {maxRetries, baseDelayMs})` для HTTP-вызовов браузерного слоя. При `403` — экспоненциальная задержка + уважение `Retry-After`. При `429` — то же. Возвращает результат или выбрасывает после исчерпания.

---

## Чеклист архитектора

### Automation
- [ ] Browser-use выбран только когда API недоступен
- [ ] Actions имеют typed schema
- [ ] DOM grounding использует stable selectors
- [ ] Есть timeout и retry policy
- [ ] Deterministic адаптеры для стабильных шагов

### Security
- [ ] Browser context изолирован по run/user
- [ ] URL allowlist включён
- [ ] Write/destructive actions требуют approval
- [ ] Credentials не передаются модели
- [ ] DOM и сайт считаются untrusted input
- [ ] File download запрещён

### Production
- [ ] Есть audit log действий
- [ ] Есть screenshots/traces для инцидентов
- [ ] Есть fallback на ручной режим
- [ ] Есть legal/TOS проверка
- [ ] Есть dry-run для write actions
- [ ] Обработаны: капча, 403/WAF, session expiry, SPA, shadow DOM, iframes

---

*Модуль 44 завершён.*
*Следующий: [Модуль 45 — Agentic RAG и Graph RAG](../45-agentic-rag-graph-rag/README.md)*