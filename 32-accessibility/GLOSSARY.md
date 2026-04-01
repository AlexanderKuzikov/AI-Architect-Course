# GLOSSARY — Accessibility

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**ARIA (Accessible Rich Internet Applications)**  
W3C спецификация: набор атрибутов (`role`, `aria-*`, `aria-live`) для добавления semantic информации в HTML элементы которые не несут встроенной семантики. Используется только когда нативный HTML недостаточен.

**aria-describedby**  
ARIA атрибут: связывает элемент с его описанием через `id`. Screen reader объявляет описание после label. Использовать для подсказок, требований формата, контекстной информации.

**aria-labelledby**  
ARIA атрибут: связывает элемент с его меткой через `id`. Приоритет над `aria-label`. Используется когда видимый элемент является меткой: `<section aria-labelledby="heading-id">`.

**aria-live**  
ARIA атрибут: объявляет регион как «живой» — изменения содержимого объявляются screen reader автоматически. `polite` — при свободном screen reader; `assertive` — немедленно, прерывая текущее.

**axe-core**  
Open-source движок автоматической проверки accessibility от Deque. Основа Lighthouse accessibility audit, Chrome DevTools, @axe-core/playwright. Выявляет ~30-40% реальных нарушений.

---

## F

**focus trap**  
Механизм: Tab навигация «захвачена» внутри контейнера (modal, dialog). Пользователь Tab-ает внутри, не выходит за границы. Обязателен для modal окон. `<dialog>.showModal()` реализует нативно.

**focus-visible**  
CSS pseudo-class: видимый focus indicator только при keyboard навигации (не при mouse click). Заменяет `outline: none` на `:focus` — устраняет «мигающий» outline при клике мышью при сохранении keyboard accessibility.

---

## I

**inert**  
HTML атрибут: делает элемент и всех потомков недостижимыми через keyboard и screen reader. Более правильная альтернатива `tabindex="-1"` на всём контейнере. Используется для неактивных панелей, закрытых drawer.

---

## K

**keyboard navigation**  
Управление интерфейсом только клавиатурой без мыши. Требование для пользователей с motor disabilities и многих screen reader пользователей. WCAG требует доступность всего интерфейса через keyboard.

---

## L

**landmark regions**  
Семантические HTML5 элементы (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`) создающие navigational landmarks. Screen reader пользователи переходят между ними напрямую минуя другой контент.

---

## P

**POUR**  
Четыре принципа WCAG: Perceivable (воспринимаемый), Operable (управляемый), Understandable (понятный), Robust (надёжный). Организационный framework для 87 success criteria.

---

## S

**screen reader**  
Assistive technology: программа для синтеза речи из содержимого экрана. Пользователи с нарушениями зрения. Основные: NVDA (Windows, бесплатный), JAWS (Windows, платный), VoiceOver (macOS/iOS встроенный), TalkBack (Android).

**skip link**  
Скрытая ссылка `<a href="#main-content">` — первый интерактивный элемент страницы. Позволяет keyboard пользователям перейти к основному контенту минуя повторяющуюся навигацию. Обязателен на всех страницах.

---

## W

**WCAG (Web Content Accessibility Guidelines)**  
W3C стандарт web accessibility. WCAG 2.2 (октябрь 2023) — текущий baseline. 87 success criteria, три уровня: A, AA, AAA. Level AA — legal compliance target (EAA, ADA, Section 508).

---

*Глоссарий модуля 32. Следующий: [Модуль 33 — Web Performance API](../33-web-performance-api/GLOSSARY.md)*
