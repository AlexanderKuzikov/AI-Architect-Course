# GLOSSARY — Lazy Loading и Code Splitting

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## C

**chunkSizeWarningLimit**  
Параметр Vite/Rollup: размер чанка в KB при превышении которого build выдаёт предупреждение. Default 500KB. Индикатор что нужен дополнительный code splitting или `manualChunks`.

**code splitting**  
Стратегия bundling: разбиение JavaScript на несколько чанков вместо одного bundle. Каждый чанк загружается по требованию. Реализуется через dynamic `import()` и конфиг bundler.

---

## D

**decoding="async"**  
Атрибут `<img>`: декодирование изображения не блокирует main thread. Браузер может начать следующий рендер не дожидаясь декодирования. Использовать вместе с `loading="lazy"` для всех non-LCP изображений.

**dynamic import**  
ES2020 синтаксис: `import('./module')` возвращает Promise. Загружает модуль асинхронно в runtime. Основа code splitting — bundler создаёт отдельный chunk для каждого dynamic import.

---

## F

**fetchpriority**  
HTML атрибут (`<img>`, `<link>`, `<script>`): подсказка браузеру о приоритете загрузки. `high` — загружать первым (LCP image), `low` — с низким приоритетом, `auto` — default.

---

## I

**IntersectionObserver**  
Web API: асинхронное наблюдение за пересечением элементов с viewport или указанным контейнером. Основа для lazy loading CSS backgrounds и кастомных компонентов. Не блокирует main thread в отличие от scroll событий.

---

## L

**lazy import waterfall**  
Антипаттерн: цепочка вложенных dynamic import — модуль A загружает модуль B который загружает модуль C. Три sequential network requests вместо одного. Критично при медленном соединении.

**loading="lazy"**  
Нативный HTML атрибут (`<img>`, `<iframe>`): браузер откладывает загрузку до приближения к viewport. Universal support 2026. НЕ использовать для LCP image и first above-fold images.

---

## M

**manualChunks**  
Конфигурация Rollup/Vite: явное управление тем какие модули попадают в какой chunk. Используется для выделения vendor libraries в отдельные долгоживущие chunks.

**modulepreload**  
`<link rel="modulepreload">`: загрузка ES модуля с parse/compile на ранней стадии. Эффективнее чем `prefetch` для JS чанков — браузер сразу парсит, не только скачивает.

---

## P

**prefetch**  
`<link rel="prefetch">`: низкоприоритетная загрузка ресурса в idle time для следующей навигации. Не блокирует текущую страницу. В React Router — `prefetch="intent"` триггерится на hover/focus.

**preload**  
`<link rel="preload">`: высокоприоритетная загрузка ресурса нужного текущей странице. Используется для LCP image, критичных шрифтов. Без использования ресурса вызывает console warning.

---

## R

**React.lazy**  
React API: lazy loading компонента через dynamic import. Возвращает компонент который загружается при первом рендере. Требует Suspense boundary. Не работает с named exports напрямую.

**rootMargin**  
Параметр IntersectionObserver: отступ от viewport для определения пересечения. `rootMargin: "200px"` — начать загрузку за 200px до входа в viewport. Аналог browser preload buffer для нативного `loading="lazy"`.

---

## S

**sourcemap: 'hidden'**  
Vite параметр: генерирует source maps но не добавляет ссылку в JS файлы. Source maps доступны для error monitoring (Sentry), но не раскрыты в публичных assets.

**Suspense**  
React компонент: показывает fallback UI пока lazy компонент загружается. Граница для обработки loading состояния. Несколько Suspense boundaries — независимые fallback для разных частей UI.

---

*Глоссарий модуля 34. Следующий: [Модуль 35 — Image optimization pipeline](../35-image-optimization/GLOSSARY.md)*
