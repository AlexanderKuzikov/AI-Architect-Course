# GLOSSARY — Critical Rendering Path и CSS Optimization

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## C

**cascade layer**  
Именованный слой CSS каскада созданный через `@layer`. Слои объявленные позже в списке имеют высший приоритет независимо от specificity. Baseline 2022.

**compositor thread**  
Отдельный поток браузера: применяет GPU-ускоренные трансформации (transform, opacity) без main thread. Анимации на compositor thread не вызывают layout или paint → 60fps без jank.

**content-visibility: auto**  
CSS свойство: браузер пропускает layout и paint для off-screen элементов. Значительное ускорение initial render длинных страниц. `contain-intrinsic-size` — подсказка для scroll estimation. Baseline широкая поддержка, Safari 18+.

**critters**  
Node.js инструмент: автоматическая extraction critical CSS + inline в HTML + async load остального. Используется как Vite/Webpack plugin.

**critical CSS**  
CSS необходимый для рендера above-fold контента: reset, :root variables, header, hero секция. Inline в `<style>` в `<head>`. Цель: < 14KB. Позволяет рендер без ожидания внешних CSS файлов.

---

## F

**FOUC (Flash Of Unstyled Content)**  
Артефакт: элементы briefly показываются без стилей при async CSS loading. Решение: critical CSS должен покрывать весь visible above-fold layout.

---

## L

**layout thrashing**  
Антипаттерн: чередование чтения layout свойств (offsetWidth) и записи styles в одном frame. Каждое чтение после записи вызывает принудительный synchronous reflow.

---

## M

**media="print" trick**  
Паттерн async CSS loading: `<link rel="stylesheet" media="print" onload="this.media='all'">`. Браузер загружает CSS с низким приоритетом (не блокирует рендер), onload переключает на `all` — стили применяются.

---

## P

**penthouse**  
Node.js библиотека: headless extraction critical CSS из живой страницы. Открывает URL в браузере, определяет above-fold стили. Для SSR/SSG страниц.

**@property**  
CSS at-rule: объявление типизированного custom property с syntax, initial-value, inherits. Позволяет браузеру анимировать custom property через CSS transitions/animations. Baseline 2024.

---

## R

**reflow**  
Браузерная операция: пересчёт geometry всех элементов. Дорогостоящая — затрагивает весь affected subtree. Триггеры: изменение width/height/top/left, добавление/удаление DOM элементов.

**render-blocking**  
Ресурс блокирующий рендер страницы: браузер не показывает ничего пока ресурс не загружен и не обработан. CSS `<link>` в `<head>` — render-blocking по умолчанию. `<script>` без defer/async — render-blocking.

**Render Tree**  
Браузерная структура: комбинация DOM + CSSOM. Содержит только visible элементы с computed styles. Основа для layout → paint → composite.

---

## S

**specificity**  
CSS механизм определения приоритета правил: id > class > element. `@layer` решает specificity wars между слоями — более поздний слой побеждает независимо от specificity внутри.

---

## W

**will-change**  
CSS свойство: подсказка браузеру создать GPU layer для элемента заранее. `will-change: transform` — для transform анимаций. Злоупотребление → избыточный GPU memory usage.

---

## К

**критический путь (Critical Path)**  
Минимальная цепочка ресурсов необходимая для первого рендера: HTML → CSS → (Render Tree) → Layout → Paint. Длина критического пути определяет FCP. Оптимизация: сократить количество и размер render-blocking ресурсов.

---

*Глоссарий модуля 36. Следующий: [Модуль 37 — JavaScript performance и memory management](../37-js-performance/GLOSSARY.md)*
