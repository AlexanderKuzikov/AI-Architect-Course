# GLOSSARY — Browser Use и Computer Use Agents

## A

**Accessibility Tree**  
Семантическое дерево UI (роли, имена, состояния), доступное через Playwright `getByRole`. Более стабильный контракт, чем CSS-классы.

**Action Schema**  
Типизированное описание допустимых действий: `goto`, `fill`, `click`, `wait`, `extract`, `screenshot`. Позволяет валидировать действия до выполнения.

**Anti-bot**  
Защита сайта от автоматизации: капча, поведенческий анализ, WAF. Контроль: легальные методы, rate limits, капча-сервисы, backoff.

---

## B

**Browser Context**  
Изолированное окружение браузера: profile, cookies, storage, viewport. Каждый agent run — отдельный context, cleanup после завершения.

---

## C

**Captcha**  
Проверка «человек ли ты». Препятствие для browser-use. Решение: капча-сервис (RuCaptcha и т.п.), пауза, retry, human fallback.

**Computer Use Agent**  
Агент, управляющий экраном/мышью/клавиатурой ОС. Применяется для desktop-приложений без API. Наименее надёжный слой автоматизации.

---

## D

**data-testid**  
Стабильный атрибут-контракт для селекторов. Не меняется при редизайне, в отличие от CSS-классов. Самый надёжный способ найти элемент.

**DOM Grounding**  
Превращение DOM в стабильный контракт для агента: selector, accessibility tree, screenshots, text snapshot.

---

## I

**Iframe**  
Фрейм внутри страницы (например, платёжный). `page.click` работает с top-level frame; для фреймов — `frameLocator`.

---

## P

**Playwright**  
Browser automation framework: cross-browser, auto-wait, trace, storage state. Предпочтительный инструмент для browser-use.

**Puppeteer**  
Chrome automation framework. Используется когда нужен только Chromium и знакомый API.

---

## S

**Screenshot Grounding**  
Передача скриншота в VLM для понимания страницы. Ненадёжен без DOM: VLM ошибается в координатах, accessibility tree недоступен.

**Session Isolation**  
Изоляция browser context между run и пользователями. Предотвращает session mixup и утечку cookies.

**Shadow DOM**  
Инкапсулированный DOM внутри веб-компонента. Стандартные селекторы не находят элементы в shadow root — нужен pierce.

**Storage State**  
Сериализованные cookies/localStorage браузера. Позволяет восстановить pre-authenticated session без передачи пароля агенту.

---

## U

**URL Allowlist**  
Список разрешённых origin для `goto`. Запрещает агенту уходить на внешние сайты. Защита от prompt injection через фишинговые страницы.

---

## V

**VLM (Vision Language Model)**  
Модель, читающая изображения. Используется в screen-gridding и computer-use для понимания экрана.

---

## W

**WAF (Web Application Firewall)**  
Защитный слой, банит автоматизацию по поведению (403). Контроль: backoff, экспоненциальные задержки, уважение Retry-After, человеко-подобные паузы.

---

*Глоссарий модуля 44. Следующий: [Модуль 45 — Agentic RAG](../45-agentic-rag-graph-rag/GLOSSARY.md)*