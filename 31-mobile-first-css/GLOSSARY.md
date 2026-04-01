# GLOSSARY — Mobile-First CSS

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## C

**cascade layer (@layer)**  
CSS механизм (2022): позволяет явно задавать приоритет групп стилей независимо от specificity и порядка в файле. `@layer base, components, overrides` — overrides всегда выигрывает у base. Упрощает mobile-first override management.

**containment context**  
Элемент с `container-type` объявленным. Только такие элементы могут быть запрошены через `@container`. Без объявления браузер не отслеживает размер элемента — `@container` внутри него не работает.

**container query**  
CSS механизм: стили применяются на основе размера (или style properties) ближайшего containment context. Компонент адаптируется к своему контейнеру, не к viewport. Baseline 2023, safe to use в 2026.

**container style query**  
CSS механизм (2024+): стили применяются на основе CSS custom property значения родителя. `@container style(--theme: dark)`. Компонент знает «тему» контейнера без JS или class передачи.

---

## D

**dvh (Dynamic Viewport Height)**  
CSS единица: текущая высота viewport изменяющаяся при скролле (когда UI браузера появляется/скрывается). Точная, но вызывает пересчёт layout при каждом изменении. Только для элементов где точность важнее performance.

**desktop-first**  
CSS методология: базовые стили для широкого экрана, `max-width` media queries для адаптации вниз. Override cascade добавляет specificity. Противоположность mobile-first.

---

## H

**:has()**  
CSS pseudo-class: выбирает элемент если он содержит указанный дочерний элемент или состояние. Фактически «parent selector». `form:has(input:invalid)` — форма содержащая невалидный input. Baseline 2023, safe to use в 2026.

---

## I

**inline-size**  
CSS логическое свойство: размер по inline axis (ширина для горизонтального writing mode). `inline-size: 100%` = `width: 100%` в LTR/RTL. Предпочтительнее `width` для интернационализированных компонентов.

---

## L

**logical properties**  
CSS свойства использующие writing-mode-relative направления вместо physical (left/right/top/bottom). `margin-inline-start` вместо `margin-left`. Автоматически адаптируются к RTL и вертикальным writing modes.

**lvh (Large Viewport Height)**  
CSS единица: максимальная высота viewport когда UI браузера скрыт (при прокрутке). Соответствует классическому `100vh` поведению. Использовать для full-screen immersive layouts.

---

## M

**media query**  
CSS механизм: стили применяются на основе характеристик viewport (ширина, высота, orientation, prefers-*). В mobile-first — только `min-width`. Для компонентов предпочтительнее container queries.

**mobile-first**  
CSS методология: базовые стили для минимального экрана, `min-width` media queries добавляют сложность для больших экранов. Соответствует progressive enhancement принципу.

---

## P

**progressive enhancement**  
Принцип: базовый опыт работает везде, дополнительные возможности добавляются для более capable environments. Mobile-first CSS — реализация этого принципа для responsive design.

---

## S

**svh (Small Viewport Height)**  
CSS единица: минимальная высота viewport когда UI браузера полностью видим (адресная строка + навигация). Стабильна при прокрутке. Рекомендована для hero секций и full-height элементов где нужна гарантия видимости.

---

## В

**viewport units (классические)**  
`vh`, `vw`, `vmin`, `vmax`: размер относительно viewport. `100vh` на мобильном = large viewport (адресная строка скрыта) → контент обрезается когда строка видима. Заменены `svh`/`lvh`/`dvh` для мобильного.

---

*Глоссарий модуля 31. Следующий: [Модуль 32 — Accessibility](../32-accessibility/GLOSSARY.md)*
