# GLOSSARY — JavaScript Performance и Memory Management

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**Atomics**  
ES2017 API: атомарные операции над SharedArrayBuffer. Гарантируют thread-safe read-modify-write без race conditions. `Atomics.add()`, `Atomics.compareExchange()`, `Atomics.wait()`/`Atomics.notify()` для синхронизации Workers.

---

## C

**Comlink**  
npm библиотека (версия 4.x): абстракция над Web Worker postMessage/onmessage. Worker-side: `expose(api)`. Main-side: `wrap<typeof api>(worker)`. Позволяет вызывать Worker методы как обычные async функции.

---

## D

**deoptimization (bailout)**  
V8 операция: отмена TurboFan оптимизации при нарушении предположений (изменился тип аргументов, shape объекта). Код возвращается в интерпретатор Ignition. Дороже чем никогда не оптимизировать.

---

## F

**FinalizationRegistry**  
ES2021 API: регистрация callback который вызывается когда объект собран GC. Timing непредсказуем. Использовать только как safety net (cleanup Map entries после WeakRef). Не для prompt resource cleanup.

---

## H

**hidden class**  
V8 внутренняя структура: описывает shape (набор свойств и их порядок) объекта. Объекты с одинаковым hidden class разделяют оптимизированный путь доступа. `delete` и dynamic property assignment нарушают hidden class.

---

## I

**Ignition**  
V8 интерпретатор (baseline): выполняет bytecode, собирает type feedback. Первый уровень JS выполнения. Горячий код передаётся в Maglev/TurboFan для JIT компиляции.

---

## L

**layout thrashing**  
Антипаттерн: чередование DOM read (offsetWidth, getBoundingClientRect) и DOM write (style изменения) в одном sync block. Каждое read после write вызывает принудительный synchronous layout. Решение: batch reads отдельно от writes.

---

## M

**Maglev**  
V8 mid-tier JIT компилятор (добавлен 2023): быстрая компиляция горячего кода (~100 вызовов). Между Ignition и TurboFan. Значительно ускоряет числовые операции без ожидания полной TurboFan оптимизации.

---

## P

**postTask()**  
`scheduler.postTask()` API: планирование задач с приоритетом (`user-blocking`, `user-visible`, `background`) и возможностью отмены через AbortController. Baseline 2024. Правильная замена `setTimeout(fn, 0)`.

---

## S

**SharedArrayBuffer**  
API: фиксированный массив памяти доступный из нескольких Workers одновременно. Zero-copy sharing. Требует Cross-Origin Isolation (`COOP: same-origin` + `COEP: require-corp`). Использовать с Atomics для thread-safety.

**scheduler.yield()**  
API: явная отдача управления браузеру в середине long задачи. Позволяет браузеру обработать user input и paint между chunks. Baseline 2024. Правильный инструмент для chunking — без задержки `setTimeout`.

---

## T

**transferable**  
Web Worker механизм: передача ownership ArrayBuffer без копирования. `worker.postMessage(buffer, [buffer])` — buffer мгновенно доступен в Worker, в main thread становится detached. Для передачи > 1MB данных.

**TurboFan**  
V8 optimizing JIT компилятор: максимальная оптимизация для очень горячего кода (~1000+ вызовов). Assumes стабильные типы. При нарушении — deoptimization.

---

## U

**using (Explicit Resource Management)**  
ES2025 синтаксис: детерминированная очистка ресурсов при выходе из scope. `using conn = new Connection()` — `conn[Symbol.dispose]()` вызывается автоматически. Не зависит от GC в отличие от FinalizationRegistry.

---

## W

**WeakRef**  
ES2021 API: слабая ссылка на объект не предотвращающая GC. `ref.deref()` возвращает объект или `undefined`. Использовать для memory-safe кешей. GC timing непредсказуем — всегда проверять deref() результат.

---

## М

**монотипизированная функция**  
Функция вызываемая всегда с одним типом аргументов. V8 оптимизирует такие функции через inline caching. Полиморфная функция (разные типы) — деоптимизация при смене типа.

---

*Глоссарий модуля 37. Следующий: [Модуль 38 — HTTP / Service Worker caching](../38-http-service-worker-caching/GLOSSARY.md)*
