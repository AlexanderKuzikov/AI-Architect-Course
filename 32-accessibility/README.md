# Модуль 32 — Accessibility (a11y)

> **Для AI-архитектора:** accessibility — не чеклист для юридического compliance. Это системное качество кода. AI-кодер добавит `alt=""` на все изображения и посчитает задачу выполненной. Задача архитектора — выстроить pipeline где нарушения выявляются в CI до деплоя, ARIA используется только там где нужно (не везде), и компоненты соответствуют WCAG 2.2 AA по умолчанию. 95.9% сайтов в 2026 не проходят accessibility аудит — это конкурентное преимущество, не overhead.
> Один день изучения — WCAG 2.2 новые критерии, ARIA правильно, keyboard navigation, автоматизированное тестирование.

---

## Содержание

1. [WCAG 2.2 — что изменилось](#1-wcag-22)
2. [Семантический HTML как основа](#2-семантический-html)
3. [ARIA — когда и как](#3-aria)
4. [Keyboard navigation](#4-keyboard)
5. [Focus management](#5-focus)
6. [Автоматизация и CI](#6-автоматизация)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Стандарт / инструмент | Версия | Статус |
| :-- | :-- | :-- |
| WCAG | **2.2** (октябрь 2023) | Текущий стандарт, EAA/ADA/Section 508 ссылаются на него |
| axe-core | **4.10.x** | Базовый движок для автоматической проверки |
| @axe-core/playwright | **4.10.x** | Интеграция с Playwright |
| ARIA | **1.2** | Текущая спецификация |
| NVDA | **2024.x** | Screen reader Windows (бесплатный) |
| VoiceOver | встроен macOS/iOS | Screen reader Apple |

> WCAG 3.0 в draft — не использовать как compliance target. WCAG 2.2 Level AA — актуальный baseline.

---

## 1. WCAG 2.2

### POUR принципы

```
Perceivable   — информация доступна не только визуально
Operable      — интерфейс управляем без мыши
Understandable — контент понятен и предсказуем
Robust        — работает с assistive technologies

Уровни: A (минимум) → AA (baseline, legal target) → AAA (расширенный)
```

### 9 новых критериев в 2.2

```
2.4.11 Focus Not Obscured (Minimum) — AA
  Элемент в фокусе не должен быть полностью скрыт
  другим контентом (sticky header, cookie banner)

2.4.12 Focus Not Obscured (Enhanced) — AAA
  Элемент в фокусе не должен быть частично скрыт

2.4.13 Focus Appearance — AAA
  Focus indicator: min 2px outline, достаточный contrast ratio

2.5.7 Dragging Movements — AA
  Drag операции должны иметь pointer-based альтернативу
  (кнопки Up/Down вместо drag-to-reorder)

2.5.8 Target Size (Minimum) — AA
  Минимум 24×24 CSS pixels для кликабельных элементов
  (было 44×44 в WCAG 2.1 Level AAA)

3.2.6 Consistent Help — A
  Help механизмы (chat, phone, FAQ) должны быть
  на одном месте на всех страницах

3.3.7 Redundant Entry — A
  Не просить вводить одни данные дважды в одной сессии

3.3.8 Accessible Authentication (Minimum) — AA
  Авторизация не должна требовать cognitive test
  (CAPTCHA с буквами) без альтернативы

3.3.9 Accessible Authentication (Enhanced) — AAA
  Никаких cognitive tests вообще
```

### Удалённый критерий

```
4.1.1 Parsing — удалён в WCAG 2.2
  Требовал валидный HTML (уникальные id, закрытые теги)
  Современные браузеры корректируют HTML → критерий устарел

Но: уникальные id по-прежнему важны для ARIA!
```

### Правовой контекст 2026

```
European Accessibility Act (EAA): вступил в силу июнь 2025
  Обязателен для всех цифровых продуктов в EU market
  Стандарт: EN 301 549 → ссылается на WCAG 2.2 AA

Российский рынок:
  ГОСТ Р 52872-2019 — национальный стандарт
  Для международных проектов — WCAG 2.2 AA
```

---

## 2. Семантический HTML

### Принцип первый: нативные элементы вместо ARIA

```html
<!-- ❌ Custom button с ARIA — сложнее и хуже -->
<div role="button" tabindex="0" aria-pressed="false"
     onclick="toggle()" onkeydown="handleKey(event)">
  Нажми меня
</div>

<!-- ✅ Нативный элемент — keyboard, focus, states встроены -->
<button type="button" aria-pressed="false">
  Нажми меня
</button>

<!-- Нативный <button>:
  ✓ Фокусируется по Tab автоматически
  ✓ Активируется Enter и Space
  ✓ role="button" уже объявлен
  ✓ :focus-visible работает
  ✓ Disabled state обрабатывается
  Div требует всё это реализовывать вручную -->
```

### Landmark regions

```html
<body>
  <!-- Skip link — первый интерактивный элемент -->
  <a href="#main-content" class="skip-link">
    Перейти к основному содержимому
  </a>

  <header role="banner">           <!-- одна шапка на странице -->
    <nav aria-label="Основная навигация">
      <ul>
        <li><a href="/" aria-current="page">Главная</a></li>
        <li><a href="/blog">Блог</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content">         <!-- один main -->
    <article>                      <!-- самодостаточный контент -->
      <h1>Заголовок статьи</h1>

      <section aria-labelledby="comments-heading">
        <h2 id="comments-heading">Комментарии</h2>
        ...
      </section>
    </article>

    <aside aria-label="Связанные статьи">
      ...
    </aside>
  </main>

  <footer role="contentinfo">      <!-- одна нижняя часть -->
    ...
  </footer>
</body>
```

### Заголовки — иерархия обязательна

```html
<!-- ❌ Нарушение иерархии — screen reader пропускает уровни -->
<h1>Страница</h1>
<h3>Раздел</h3>  <!-- пропущен h2 -->
<h5>Подраздел</h5>

<!-- ✅ Строгая иерархия, один h1 на страницу -->
<h1>Страница</h1>
  <h2>Раздел</h2>
    <h3>Подраздел</h3>
    <h3>Другой подраздел</h3>
  <h2>Другой раздел</h2>

<!-- Правило: заголовок описывает структуру, не внешний вид
     <h2 class="visually-small"> — ОК если структурно это h2
     <h4 class="large-heading"> — антипаттерн -->
```

### Граничные случаи — где ломается

**`<button>` внутри `<a>`**: невалидный HTML — интерактивный элемент внутри интерактивного. Screen readers ведут себя непредсказуемо. Выбрать одно: ссылка для навигации, кнопка для действия.

**`aria-label` vs видимый текст**: когда `aria-label` отличается от видимого текста кнопки — пользователь voice control говорит видимый текст, но software ищет `aria-label`. Всегда включать видимый текст в `aria-label` как часть строки.

**Почему это важно архитектору:** semantic HTML — единственный надёжный accessibility фундамент. ARIA flickering (role меняется) и неверные иерархии заголовков — главные причины провала screen reader аудита.

---

## 3. ARIA

### Три правила ARIA

```
1. Не использовать ARIA если нативный HTML решает задачу
2. Не изменять семантику нативного HTML без необходимости
3. Все интерактивные ARIA элементы должны быть keyboard accessible
```

### ARIA атрибуты — когда что

```html
<!-- aria-label: видимого текста нет, нужна метка -->
<button aria-label="Закрыть диалог">
  <svg>...</svg>  <!-- icon only button -->
</button>

<!-- aria-labelledby: метка — существующий элемент -->
<section aria-labelledby="section-title">
  <h2 id="section-title">Заголовок</h2>
  ...
</section>

<!-- aria-describedby: дополнительное описание (не метка) -->
<input
  id="password"
  type="password"
  aria-describedby="password-hint"
/>
<p id="password-hint">Минимум 8 символов, одна заглавная</p>

<!-- aria-expanded: элемент управляет expanded/collapsed -->
<button
  aria-expanded="false"
  aria-controls="dropdown-menu"
>
  Меню
</button>
<ul id="dropdown-menu" hidden>...</ul>

<!-- aria-live: динамический контент для screen reader -->
<div
  aria-live="polite"      <!-- объявить когда screen reader свободен -->
  aria-atomic="true"      <!-- объявить весь регион, не только изменения -->
  role="status"
>
  <!-- Контент обновится → screen reader объявит -->
</div>

<!-- aria-live="assertive" — только для критичных ошибок: -->
<div aria-live="assertive" role="alert">
  Сессия истекает через 2 минуты
</div>
```

### Dialog / Modal паттерн

```html
<!-- dialog element — нативный, не требует role="dialog" -->
<dialog
  id="confirm-dialog"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Подтверждение удаления</h2>
  <p id="dialog-description">Это действие необратимо.</p>

  <div>
    <button type="button" id="cancel-btn">Отмена</button>
    <button type="button" id="confirm-btn">Удалить</button>
  </div>
</dialog>
```

```typescript
// Правильное управление фокусом для dialog
function openDialog(dialog: HTMLDialogElement, triggerEl: HTMLElement) {
  dialog.showModal()  // нативный метод: trap focus + ESC автоматически

  // Переместить фокус на первый интерактивный элемент
  const firstFocusable = dialog.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  firstFocusable?.focus()

  // Восстановить фокус при закрытии
  dialog.addEventListener('close', () => {
    triggerEl.focus()
  }, { once: true })
}
```

### Граничные случаи — где ломается

**`aria-hidden` на видимом контенте**: `aria-hidden="true"` скрывает элемент и всех его потомков от screen reader. Если использовать на контейнере с интерактивным элементом — keyboard-navigable контент, который screen reader не может достичь.

**`role="presentation"` vs `aria-hidden`**: `role="presentation"` убирает semantic роль, но элемент остаётся видимым для AT. `aria-hidden` убирает элемент полностью. Для декоративных изображений: `<img alt="">` (не `aria-hidden`).

**`aria-live` flooding**: изменение содержимого `aria-live` региона каждые 500ms → screen reader объявляет бесконечно. Буферизировать обновления.

**Почему это важно архитектору:** ARIA — это override браузерной accessibility tree. Неверное ARIA хуже чем его отсутствие: даёт screen reader неверную информацию которую пользователь не может проверить.

---

## 4. Keyboard navigation

### Focus order должен соответствовать visual order

```html
<!-- ❌ tabindex > 0 разрушает естественный порядок -->
<div tabindex="3">Третий по Tab</div>
<div tabindex="1">Первый по Tab</div>
<div tabindex="2">Второй по Tab</div>

<!-- ✅ Естественный DOM порядок = Tab порядок -->
<!-- Если visual order отличается от DOM — использовать CSS order,
     но убедиться что DOM порядок логичен -->

<!-- tabindex="0": элемент в Tab последовательности -->
<!-- tabindex="-1": фокусируемый через JS, но не через Tab -->
<!-- tabindex > 0: НИКОГДА в production -->
```

### Keyboard patterns по ARIA APG

```
Компонент          Tab behavior           Arrow keys
──────────────────────────────────────────────────────
Links / Buttons    Tab между ними         —
Menu               Tab входит/выходит     ↑↓ между items
Tabs               Tab на tablist         ←→ между tabs
Dialog             Tab внутри trap        —
Tree               Tab входит/выходит     ↑↓ между nodes
Radio group        Tab входит/выходит     ↑↓ между options
Combobox           Tab входит/выходит     ↑↓ для dropdown
```

### Skip links

```css
/* Skip to main content — обязателен */
.skip-link {
  position: absolute;
  top: -100%;          /* скрыт за пределами viewport */
  left: 0;
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  z-index: 9999;
  transition: top var(--transition-interactive);
}

/* Появляется при фокусе */
.skip-link:focus {
  top: 0;
}
```

### 2.5.8 Target Size — новый критерий WCAG 2.2

```css
/* Минимум 24×24 CSS pixels для AA */
/* Практика: 44×44 для mobile (WCAG 2.5.5 AAA, но здравый смысл) */

.icon-button {
  /* Кнопка маленькая визуально, но tap target большой */
  width: 24px;
  height: 24px;
  position: relative;
}

/* Увеличить tap target без изменения визуала */
.icon-button::before {
  content: '';
  position: absolute;
  inset: -10px;     /* расширяет tap target на 10px во все стороны */
  /* итого: 24 + 20 = 44px tap target */
}

/* Или: padding без clip */
.icon-button {
  padding: 10px;                   /* 24px icon + 20px padding = 44px */
  background: transparent;
  border: none;
}
```

---

## 5. Focus management

### 2.4.11 Focus Not Obscured (WCAG 2.2 AA)

```css
/* Sticky header скрывает focus элемент при Tab навигации */

/* ❌ Проблема: focused элемент под sticky header */
header {
  position: sticky;
  top: 0;
  height: 64px;
  z-index: 100;
}

/* ✅ Решение 1: scroll-padding-top */
html {
  scroll-padding-top: 80px;  /* header height + buffer */
}

/* ✅ Решение 2: scroll-margin на элементах */
:target,
:focus {
  scroll-margin-top: 80px;
}
```

### Focus trap для модальных окон

```typescript
// Focus trap: Tab не выходит за пределы dialog
function createFocusTrap(container: HTMLElement) {
  const focusableSelector = [
    'a[href]', 'button:not([disabled])',
    'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  function getFocusableElements() {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return

    const focusable = getFocusableElements()
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      // Shift+Tab: если на первом элементе → перейти на последний
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      // Tab: если на последнем элементе → перейти на первый
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeydown)
  return () => container.removeEventListener('keydown', handleKeydown)
  // Примечание: <dialog>.showModal() делает это нативно
}
```

### Focus visible styling

```css
/* WCAG 2.4.13 (AAA) но разумный baseline для AA */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

/* Убрать outline только при mouse click (не keyboard) */
:focus:not(:focus-visible) {
  outline: none;
}

/* Высококонтрастный режим */
@media (forced-colors: active) {
  :focus-visible {
    outline: 3px solid ButtonText;  /* системный цвет */
  }
}
```

---

## 6. Автоматизация

### axe-core + Playwright

```typescript
// e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('главная страница — нет WCAG 2.2 AA нарушений', async ({ page }) => {
    await page.goto('/')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze()

    // Прикрепить детали к отчёту Playwright
    await test.info().attach('accessibility-violations', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    })

    expect(results.violations).toHaveLength(0)
  })

  test('блог страница — нет нарушений', async ({ page }) => {
    await page.goto('/blog')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .exclude('#third-party-widget')  // исключить сторонние виджеты
      .analyze()

    expect(results.violations).toHaveLength(0)
  })
})
```

### Что axe-core НЕ проверяет

```
Автоматически проверяется (~30-40% проблем):
  ✓ alt text отсутствует
  ✓ contrast ratio
  ✓ aria-* на несуществующих id
  ✓ form labels
  ✓ heading иерархия
  ✓ landmark regions

Требует ручного тестирования (~60-70% проблем):
  ✗ Логический порядок фокуса
  ✗ Screen reader опыт (что именно объявляется)
  ✗ Keyboard navigation паттерны (APG compliance)
  ✗ Focus trap корректность
  ✗ Meaningful alt text (наличие ≠ качество)
  ✗ 2.5.8 Target size в реальных условиях
```

### CI pipeline

```yaml
# .github/workflows/accessibility.yml
name: Accessibility

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e -- --grep="Accessibility"
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: accessibility-report
          path: playwright-report/
```

### Граничные случаи — где ломается

**axe-core ложные отрицательные**: `aria-label="Кнопка"` на кнопке с текстом "Кнопка" — axe не пожалуется. Но ARIA label должен включать видимый текст (WCAG 2.5.3). Ручная проверка обязательна.

**Dynamic content и axe timing**: `axe.run()` в момент когда dynamic content ещё не загружен даст другой результат. В тестах — ждать загрузки контента перед анализом.

**Почему это важно архитектору:** автоматизация убирает регрессии, но не заменяет ручное тестирование с реальными screen readers. Цель CI — не пропустить новые нарушения; цель ручного тестинга — убедиться что screen reader опыт осмыслен.

---

## 7. Реальный кейс: a11y-аудит каталога — автоматы нашли треть

### Контекст

Тот же каталог WooCommerce (модули 30/31): 50k товаров, мобильный-first редизайн, фильтры, корзина, модалка быстрого просмотра. Аудит перед релизом: axe + Lighthouse accessibility score — «ошибок нет».

### Задача

Валидный a11y-аудит без ручной проверки — ложная уверенность: автоматические проверки находят < 30% проблем (WCAG-известный факт, см. Anti-checklist). Нужны ручные сценарии для критичных flow.

### Гипотеза

Три ручных сценария закрывают 80% реальных проблем каталога: навигация с клавиатуры по фильтрам, добавление в корзину со screen reader, модалка быстрого просмотра.

### Что получилось — проблемы, которые не нашёл ни один автомат

1. **Фокус-ловушка в модалке**: Tab в модалке быстрого просмотра уводил фокус на фон (страница скроллилась под модалкой). Фикс — focus trap: цикл Tab внутри модалки, фокус на открытии, возврат на кнопку при закрытии.
2. **Корзина без `aria-live`**: добавление товара меняло счётчик, но screen reader молчал — «я нажал кнопку, ничего не произошло». Фикс — `aria-live="polite"` на счётчике корзины.
3. **Фильтры каталога: `role="checkbox"` на `<div>` без клавиатурного обработчика** — фокус есть, Space/Enter не работают (антипаттерн №6 модуля). Фикс — нативные `<input type="checkbox">` вместо дивов.
4. **Контраст цены**: цена (серый текст на белом) — 3.1:1 при норме 4.5:1. Автоматы могут ловить, но цвет «рабочий» проскочил из-за шрифта большого размера — ручная проверка на реальном контенте.

### Вывод, противоречащий интуиции

Самые дорогие a11y-баги — не «отсутствие aria-атрибутов», а **сломанная интерактивность**: фокус, клавиатура, уведомление об изменении. Это архитектурные проблемы компонентов (как построена модалка, как устроен фильтр), а не «добавить атрибут». Автоматы видят атрибуты, но не поведение.

**Практический вывод для архитектора:** a11y-требования — часть контракта компонентов: focus trap, aria-live, нативные элементы — проектируются при создании, а не аудитятся после. Ручные сценарии (клавиатура + screen reader) входят в acceptance criteria каждого интерактивного компонента.

---

## Антипаттерны
```html
<!-- ❌ Избыточная ARIA — браузер уже знает что это button -->
<button role="button" aria-label="Button" aria-disabled="false">
  Нажми
</button>
<!-- ✅ -->
<button type="button">Нажми</button>
```

**2. `tabindex > 0`**
```html
<!-- ❌ Разрушает естественный Tab порядок -->
<input tabindex="2">
<input tabindex="1">
<!-- ✅ DOM порядок = Tab порядок -->
```

**3. `aria-hidden` на фокусируемых элементах**
```html
<!-- ❌ Screen reader не видит, keyboard достигает — конфликт -->
<div aria-hidden="true">
  <button>Этот button Tab-accessible, но screen reader его игнорирует</button>
</div>
<!-- Если скрыть — добавить disabled или inert атрибут -->
```

**4. Только color для передачи информации**
```html
<!-- ❌ Colorblind пользователи не видят разницу -->
<span style="color: red">Ошибка</span>
<span style="color: green">Успех</span>

<!-- ✅ Цвет + иконка + текст -->
<span class="error">
  <svg aria-hidden="true"><!-- error icon --></svg>
  Ошибка: поле обязательно
</span>
```

**5. Автовоспроизведение с audio**
```html
<!-- ❌ Screen reader пользователи слышат два аудио потока -->
<video autoplay>...</video>

<!-- ✅ autoplay только если muted, controls обязательны -->
<video autoplay muted controls>...</video>
```

**6. Placeholder вместо label**
```html
<!-- ❌ Placeholder исчезает при вводе → пользователь забывает что вводит -->
<input type="text" placeholder="Email адрес">

<!-- ✅ Видимый label всегда -->
<label for="email">Email адрес</label>
<input id="email" type="email" placeholder="user@example.com">
```

---

## Anti-checklist ☠️

- [ ] `aria-label` без перевода для мультиязычных сайтов — screen reader читает всегда один язык
- [ ] Цветовой контраст проверять только инструментами — 4.5:1 не гарантирует читаемость на проекторе
- [ ] `tabindex > 0` — нарушает ожидаемый порядок навигации
- [ ] Фокус только на WCAG checks — автоматические проверки находят < 30% проблем
- [ ] `role="button"` на `<div>` без клавиатурного обработчика — фокус есть, действия нет
- [ ] Видео/аудио без субтитров — WCAG Level A failure, самые частые иски

## Задачи AI-кодеру

**Плохая формулировка:**
> «Сделай форму доступной»

**Хорошая формулировка:**
> «Для формы регистрации:
> 1. Каждый `<input>` должен иметь `<label for="{id}">` — не `placeholder` вместо label.
> 2. Обязательные поля: `aria-required="true"` на input.
> 3. Ошибки валидации: `aria-describedby="{error-id}"` на input, сообщение в `<span id="{error-id}" role="alert">`.
> 4. При ошибке submit — переместить фокус на первый невалидный input через `.focus()`.
> 5. Password toggle (eye icon): `<button type="button" aria-label="Показать пароль" aria-pressed="false">`, при нажатии менять `aria-pressed` и `type="password/text"`.
> 6. Submit кнопка: `type="submit"`, не `type="button"`.»

Формула: семантический HTML (label/aria/fieldset) + клавиатура (tabindex/фокус) + submit-типы + отказ от недонативных решений.

---

**Плохая формулировка:**
> «Добавь accessibility тесты»

**Хорошая формулировка:**
> «Добавить Playwright accessibility тест в `e2e/a11y.spec.ts`:
> 1. Установить `@axe-core/playwright@4.10.x`.
> 2. Тест для каждого URL: `/`, `/blog`, `/contact`.
> 3. Использовать теги `['wcag2a', 'wcag2aa', 'wcag22aa']`.
> 4. При нарушениях: `test.info().attach('violations', JSON)` и `expect(violations).toHaveLength(0)`.
> 5. Добавить в CI как отдельный job `a11y` после `build`.
> 6. При failure — upload artifact с playwright-report.»

Формула: Playwright + @axe-core (wcag22aa) + прогон по URL-набору + attach violations + отдельный job + artifact.

---

## Чеклист архитектора

**Фундамент**
- [ ] Semantic HTML: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`
- [ ] Один `<h1>` на страницу, строгая иерархия без пропуска уровней
- [ ] Skip link — первый интерактивный элемент страницы
- [ ] Нативные элементы (`<button>`, `<a>`, `<input>`) везде где возможно

**WCAG 2.2 новые критерии (AA)**
- [ ] 2.4.11: Focus элемент не скрыт sticky header → `scroll-padding-top`
- [ ] 2.5.7: Drag operations имеют pointer-based альтернативу
- [ ] 2.5.8: Все интерактивные элементы ≥ 24×24px (tap target)
- [ ] 3.3.8: CAPTCHA имеет доступную альтернативу

**ARIA**
- [ ] ARIA используется только там где нативный HTML недостаточен
- [ ] `aria-label` включает видимый текст кнопки (WCAG 2.5.3)
- [ ] `aria-live="polite"` для статус обновлений, `assertive` только для критичных ошибок
- [ ] Нет `aria-hidden` на родителях фокусируемых элементов

**Keyboard и Focus**
- [ ] Весь интерфейс управляем только клавиатурой
- [ ] Нет `tabindex > 0`
- [ ] Focus trap в modal/dialog
- [ ] Фокус восстанавливается на trigger после закрытия dialog
- [ ] `:focus-visible` стиль виден (2px outline минимум)

**Автоматизация**
- [ ] axe-core тест в CI с тегами `wcag22aa`
- [ ] Ручное тестирование NVDA (Windows) или VoiceOver (macOS)
- [ ] Проверка contrast ratio в DevTools

---

*Модуль 32 завершён.*
*Следующий: [Модуль 33 — Web Performance API](../33-web-performance-api/README.md)*
