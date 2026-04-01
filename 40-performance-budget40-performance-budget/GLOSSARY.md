# GLOSSARY — Performance Budget и CI Регрессии

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## B

**BundleMon**  
Инструмент (версия 2.x) мониторинга bundle size в CI. Сравнивает размер файлов текущего PR с base branch, публикует PR comment с таблицей delta, создаёт GitHub Check. Поддерживает glob паттерны для файлов с хешами.

**budget.json**  
Конфиг файл Lighthouse для ресурсных и timing бюджетов. Поддерживает `resourceSizes`, `resourceCounts`, `timings`. Используется в LHCI assertions как альтернатива inline конфигу.

---

## D

**dynamic import**  
ES модульный синтаксис: `import('./module')` — асинхронная загрузка модуля по требованию. Разбивает bundle на chunks. Chunk загружается только при вызове import(). Уменьшает initial bundle size.

---

## L

**LHCI (Lighthouse CI)**  
CLI инструмент (`@lhci/cli`) для запуска Lighthouse в CI/CD. Поддерживает assertions (error/warn/off), сравнение с baseline, загрузку отчётов. GitHub Actions: `treosh/lighthouse-ci-action@v12`.

---

## M

**manualChunks**  
Vite/Rollup конфиг: явное управление разбивкой bundle на chunks. Позволяет вынести vendor библиотеки в отдельные файлы с долгим кешем. Риск: circular dependencies между chunks → runtime error.

---

## P

**performance budget**  
Лимиты на метрики и размеры ресурсов. Типы: ресурсные (JS < 300KB gzip), метрические (LCP ≤ 2500ms), timing (TBT ≤ 200ms), score (Performance ≥ 80). Ценен только при CI enforcement.

---

## R

**rollup-plugin-visualizer**  
Rollup/Vite плагин: генерирует `stats.html` с интерактивной визуализацией bundle состава. Шаблоны: `treemap` (размеры), `sunburst`, `network` (граф зависимостей). Показывает gzip и brotli размеры.

---

## S

**side effects**  
Свойство `"sideEffects"` в `package.json`: сигнал bundler что файлы без явного импорта можно удалить при tree-shaking. `"sideEffects": false` — агрессивный tree-shaking. Отсутствие свойства → bundler не удаляет unused exports.

**size-limit**  
npm инструмент (версия 11.x): проверка bundle size с завершением с exit code 1 при превышении. Прост в настройке через `package.json`. `--why` флаг показывает топ contributors к размеру. Для npm пакетов и SPA.

---

## T

**tree-shaking**  
Bundler оптимизация: удаление неиспользуемого кода на основе статического анализа ES module imports/exports. Работает только с именованными импортами из ESM пакетов. `import _ from 'lodash'` тянет всё; `import { debounce } from 'lodash-es'` — только debounce.

---

## V

**vite-bundle-visualizer**  
Vite-специфичная обёртка над `rollup-plugin-visualizer` с упрощённым API. Эквивалентна `rollup-plugin-visualizer` по функциональности для Vite проектов.

---

## Б

**бюджет по delta**  
Подход: ограничение не абсолютного размера, а прироста vs base branch (например `maxPercentIncrease: 5`). Более гибкий чем абсолютный лимит: не требует мгновенного соответствия идеалу, но предотвращает постепенное накопление bloat.

---

*Глоссарий модуля 40.*
*Блок «Web Performance» (модули 28–40) завершён.*
