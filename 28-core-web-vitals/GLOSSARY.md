# GLOSSARY — Core Web Vitals

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**aspect-ratio (CSS)**  
CSS свойство: резервирует место для элемента до загрузки содержимого. `aspect-ratio: 16/9` на контейнере изображения предотвращает layout shift. Предпочтительнее JS-based высоты — работает без JavaScript.

---

## C

**CLS (Cumulative Layout Shift)**  
Core Web Vital: сумма неожиданных смещений layout за время жизни страницы. Формула: impact_fraction × distance_fraction для каждого shift. Порог: ≤ 0.1 (Good). Не включает смещения, инициированные пользователем (scroll, click).

**CrUX (Chrome User Experience Report)**  
База данных реального пользовательского опыта Chrome. 28-дневное скользящее окно, оценка по p75. Используется Google для Page Experience сигнала в Rankings. Доступна через CrUX API, Search Console, PageSpeed Insights.

---

## F

**fetchpriority**  
HTML атрибут для управления приоритетом загрузки ресурса. `fetchpriority="high"` — браузер загружает без ожидания приоритизатора. Критично для LCP image: без атрибута браузер может отложить загрузку.

**field data**  
Данные от реальных пользователей в реальных условиях (устройства, сети, локации). Источник: CrUX. Отличается от lab data: включает third-party scripts, кеш, медленные устройства. Только field data влияет на Google Rankings.

**FOUT (Flash of Unstyled Text)**  
Эффект при `font-display: swap`: текст отображается системным шрифтом до загрузки кастомного, затем происходит swap. Вызывает CLS если размеры шрифтов отличаются.

---

## I

**INP (Interaction to Next Paint)**  
Core Web Vital (заменил FID в марте 2024): 98-й перцентиль времени от взаимодействия (click, tap, keypress) до следующего paint браузера. Измеряет все взаимодействия за сессию. Порог: ≤ 200ms (Good).

---

## L

**lab data**  
Данные из контролируемой тестовой среды (Lighthouse, PageSpeed Insights): фиксированное устройство, сеть, без extensions. Воспроизводимо. Не отражает реальный опыт пользователей, не влияет на Rankings напрямую.

**LCP (Largest Contentful Paint)**  
Core Web Vital: время до отрисовки наибольшего видимого элемента (image, text block, video poster). LCP элемент может меняться в процессе загрузки страницы. Порог: ≤ 2.5s (Good).

**Lighthouse CI**  
Инструмент для автоматизации Lighthouse в CI/CD. Поддерживает budget gates (максимальные значения метрик), сравнение с baseline, хранение результатов. `lighthouse-budget.json` определяет пороги для fail CI.

**Long Task**  
Задача на main thread > 50ms. Блокирует браузер от обработки пользовательских взаимодействий. Главная причина плохого INP. Видны в DevTools Performance → Long Tasks секция.

---

## P

**p75**  
75-й перцентиль — значение, ниже которого 75% измерений. Google оценивает Core Web Vitals по p75 от всех посещений URL за 28 дней. Чтобы пройти порог, 75% пользователей должны иметь «Good» score.

**Page Experience**  
Сигнал ранжирования Google: совокупность Core Web Vitals + HTTPS + Mobile Friendliness. Влияет на позиции в поиске, особенно при прочих равных.

---

## R

**render-blocking**  
CSS и синхронный JS в `<head>` блокируют парсинг HTML до загрузки. Прямое влияние на LCP: браузер не может отрисовать контент пока не загружены блокирующие ресурсы. Critical CSS inline + остальное async.

---

## S

**scheduler.yield()**  
Web API (Chrome 115+): уступает управление main thread браузеру между задачами. Позволяет разбивать Long Tasks на части не блокируя обработку пользовательских взаимодействий. Fallback: `setTimeout(fn, 0)`.

**sendBeacon**  
Web API: отправляет данные асинхронно без блокировки страницы, даже при закрытии вкладки. Предпочтительный способ отправки analytics данных (web-vitals metrics) — не блокирует unload.

**session window (CLS)**  
Группа layout shifts с паузами между ними < 1 секунды и общей длительностью < 5 секунд. CLS score — максимальное значение среди всех session windows за время жизни страницы.

**startTransition**  
React 18+ API: помечает state update как non-urgent (deferred). Позволяет браузеру прерывать rendering этого update для обработки пользовательских взаимодействий. Ключевой инструмент для улучшения INP в React приложениях.

---

## T

**TBT (Total Blocking Time)**  
Lab метрика: сумма времени Long Tasks (>50ms) между FCP и TTI. Коррелирует с INP в field data. Используется в Lighthouse budget для CI gates, так как INP нельзя измерить в lab условиях.

**TTFB (Time to First Byte)**  
Время до получения первого байта HTML ответа. Влияет на LCP: медленный TTFB = поздний старт загрузки всего. Оптимизировать через CDN, edge caching, fast server response.

---

*Глоссарий модуля 28. Следующий: [Модуль 29 — Critical CSS inlining](../29-critical-css/GLOSSARY.md)*
