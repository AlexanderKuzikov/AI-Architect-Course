# GLOSSARY — Core Web Vitals: LCP, INP, CLS

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## C

**CLS (Cumulative Layout Shift)**  
Core Web Vital: суммарный счёт неожиданных layout shifts за сессию. Порог «хорошо»: ≤ 0.1. Формула: sum(impact_fraction × distance_fraction) для всех shifts не вызванных user action.

**CrUX (Chrome User Experience Report)**  
Google база данных реальных UX метрик собранных Chrome пользователями (opt-in). 28-дневное скользящее окно. Основа Google Search Console CWV report. Google ранжирует по 75-й перцентили CrUX, не по Lighthouse.

---

## F

**FCP (First Contentful Paint)**  
Время до первого рендера любого контента (текст, изображение, SVG). Не Core Web Vital, но сигнал загрузки. Влияет на восприятие скорости.

**fetchpriority**  
HTML атрибут (`high`/`low`/`auto`): подсказка браузеру о приоритете загрузки ресурса. Baseline 2023. Один `fetchpriority="high"` на LCP image улучшает LCP на 20-30%. Нельзя ставить на несколько элементов — конкурируют.

**field data**  
Метрики собранные от реальных пользователей (CrUX, RUM). Google использует для ранжирования. Противопоставляется lab data (Lighthouse, синтетическое тестирование).

**font-display: swap**  
CSS дескриптор: показывает fallback шрифт сразу, заменяет на загруженный (FOUT). Предотвращает невидимый текст. Может вызвать CLS при сильном расхождении метрик с fallback. Решение: `size-adjust`.

---

## I

**INP (Interaction to Next Paint)**  
Core Web Vital с марта 2024 (заменил FID): время от user interaction до следующего paint. Порог «хорошо»: ≤ 200ms. Измеряет worst-case interaction за сессию (75-я перцентиль). Три компонента: input delay + processing time + presentation delay.

**input delay**  
Компонент INP: время от user action до начала обработки event handler. Причина: main thread занят long task в момент взаимодействия. Fix: `scheduler.postTask` с правильными приоритетами, defer third-party scripts.

---

## L

**lab data**  
Метрики из синтетического окружения (Lighthouse, WebPageTest). Воспроизводимы, полезны для CI регрессий. НЕ используются Google для ранжирования. TBT — lab прокси для INP (не точная замена).

**LCP (Largest Contentful Paint)**  
Core Web Vital: время до рендера наибольшего visible элемента в viewport. Порог «хорошо»: ≤ 2.5s. Subparts: TTFB + resource load delay + resource load duration + element render delay.

**LoAF (Long Animation Frame)**  
Performance API entry type (Baseline 2024): событие когда rendering frame занял > 50ms. Содержит `scripts[]` с `sourceURL`, `invokerType`, `sourceFunctionName`. Заменил Long Tasks API для INP диагностики.

---

## P

**presentation delay**  
Компонент INP: время от конца event handler до следующего paint. Причина: тяжёлые DOM mutations, forced layout в handler. Fix: batch reads/writes, `transform` вместо layout свойств.

**processing time**  
Компонент INP: время выполнения event handlers. Причина: CPU-bound логика в handler. Fix: Web Worker для heavy computation, `scheduler.yield()` для chunking DOM updates.

---

## R

**RUM (Real User Monitoring)**  
Мониторинг метрик от реальных пользователей. Для CWV: web-vitals npm с attribution. Ключевое: агрегировать по 75-й перцентили (как Google), не по среднему.

---

## S

**size-adjust**  
CSS `@font-face` дескриптор: масштабирует метрики fallback шрифта для соответствия загружаемому шрифту. Уменьшает CLS при FOUT. Значения подбираются через инструменты (screenspan.net/fallback).

---

## T

**TBT (Total Blocking Time)**  
Lab метрика: сумма blocking time всех long tasks между FCP и Time to Interactive. Proxy для INP в lab условиях. TBT хороший при плохом INP = event handlers тяжёлые (не load-time проблема).

**TTFB (Time to First Byte)**  
Время от запроса до первого байта ответа. Компонент LCP. Зависит от: CDN, server response time, network latency.

---

## W

**web-vitals**  
npm библиотека (версия 4.x): измерение CWV в браузере. Импорт из `web-vitals/attribution` даёт диагностические данные (LCP element URL, INP interaction target + LoAF entries, CLS shift target).

---

*Глоссарий модуля 39. Следующий: [Модуль 40 — Performance budget и CI регрессии](../40-performance-budget/GLOSSARY.md)*
