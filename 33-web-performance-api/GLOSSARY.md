# GLOSSARY — Web Performance API

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## B

**blockingDuration**  
Свойство `PerformanceLongAnimationFrameEntry`: время в ms когда main thread не мог обработать пользовательские input события из-за long animation frame. Ненулевое значение — прямая причина плохого INP. Отличается от `duration` (общего времени frame).

**buffered: true**  
Опция `PerformanceObserver.observe()`: получить entries возникшие ДО создания observer. Критично для LCP и FCP — они могут произойти до инициализации JS кода. Без `buffered: true` — early entries теряются.

---

## C

**CrUX (Chrome User Experience Report)**  
Google база данных: field data от реальных Chrome пользователей с opted-in sharing. 28-дневное скользящее окно, p75. Отличается от RUM: только Chrome, не включает Safari/Firefox. Используется для Page Experience Rankings.

---

## D

**DOMHighResTimeStamp**  
Тип timestamp в Performance API: микросекундная точность, относительно `timeOrigin` страницы. `performance.now()` возвращает этот тип. Значительно точнее `Date.now()` (только миллисекунды).

---

## F

**field data**  
Метрики от реальных пользователей в реальных условиях. Источники: RUM система, CrUX. Противоположность lab data. Только field data отражает реальный опыт и влияет на Google Rankings.

---

## K

**keepalive**  
`fetch()` опция: запрос продолжается после закрытия страницы. Альтернатива `sendBeacon` когда нужен `Content-Type: application/json`. Ограничение: тело запроса ≤ 64KB.

---

## L

**lab data**  
Метрики из контролируемой тестовой среды. Инструменты: Lighthouse, WebPageTest, PageSpeed Insights. Воспроизводимо. Не отражает реальный опыт: нет extensions, фиксированный CPU throttle, нет кеша пользователя.

**LoAF (Long Animation Frames API)**  
Web API (Baseline 2024, Chrome 123+): наследник Long Tasks API. Сообщает о frames > 50ms с атрибуцией к конкретным скриптам (URL, duration, invoker). Главный инструмент диагностики INP в production.

**Long Tasks API**  
Web API (Chrome 58+, deprecated): сообщал о задачах > 50ms на main thread без атрибуции источника. Заменён LoAF который добавляет информацию о скриптах-виновниках.

---

## N

**Navigation Timing L2**  
Спецификация W3C: `PerformanceNavigationTiming` interface — детальный timing загрузки страницы (DNS, TCP, TLS, TTFB, DOM processing). Заменяет deprecated L1 (`performance.timing`, `performance.navigation`).

---

## P

**PerformanceObserver**  
Web API: асинхронная подписка на новые performance entries. Не блокирует main thread. Поддерживает `buffered: true` для получения ранних entries. Правильный способ мониторинга CWV в production.

---

## R

**Resource Timing**  
Web API: timing для каждого загруженного ресурса (images, scripts, CSS, fetch). Показывает DNS, TCP, TTFB, download для каждого ресурса. Cross-origin ресурсы требуют `Timing-Allow-Origin` заголовка для полных данных.

**RUM (Real User Monitoring)**  
Практика: сбор performance метрик от реальных пользователей в production. Инфраструктура: PerformanceObserver в браузере → sendBeacon → backend → analytics. Единственный способ измерить реальный опыт.

---

## S

**sampling**  
Стратегия сбора метрик: отправлять данные только от % сессий (например, 10%). Снижает нагрузку на backend и costs. При правильном stratification — достаточная точность для оптимизационных решений.

**sendBeacon**  
Web API: асинхронная отправка данных без блокировки страницы. Работает при `visibilitychange` и `unload`. Предпочтительный способ отправки RUM данных. Ограничение: только POST, без кастомных заголовков.

**sourceURL**  
Свойство script entries в LoAF: URL скрипта вызвавшего long animation frame. Ключевая информация для атрибуции — позволяет различить first-party bundle от third-party script (analytics, chat widget, consent manager).

---

*Глоссарий модуля 33. Следующий: [Модуль 34 — Lazy loading и code splitting](../34-lazy-loading/GLOSSARY.md)*
