# GLOSSARY — Worker Threads / Piscina

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**ArrayBuffer**  
Объект фиксированного размера в памяти V8. После передачи в воркер через `transferList` становится detached в отправляющем потоке: `byteLength === 0`. В отличие от SharedArrayBuffer — не разделяется, а передаётся (zero-copy move).

**Atomics**  
Namespace глобальных атомарных операций для SharedArrayBuffer: `add`, `sub`, `load`, `store`, `wait`, `notify`. Гарантируют неделимость read-modify-write — предотвращают race condition при конкурентной записи из нескольких потоков.

**Atomics.wait()**  
Блокирует текущий поток до получения уведомления через `Atomics.notify()`. Допустимо только в Worker Threads — блокирует event loop при вызове в main thread. Механизм синхронизации между потоками без busy-loop.

---

## B

**backpressure**  
Механизм управления нагрузкой: при переполнении `maxQueue` Piscina бросает ошибку, которую вызывающий код обрабатывает как сигнал замедлить подачу задач. Альтернатива накоплению очереди в памяти до OOM.

---

## C

**cold start (worker)**  
Время инициализации нового Worker Thread: создание V8 Isolate, загрузка модуля, выполнение top-level кода. ~50ms для чистого JS. Несколько секунд при загрузке ML-модели или ORM-инициализации. Причина использовать `minThreads > 0`.

---

## I

**IPC (Inter-Process Communication)**  
Механизм передачи данных между `child_process` и родительским процессом: `process.send()` / `child.on('message')`. Данные сериализуются через JSON или fd. В отличие от worker_threads — разные OS процессы без общей памяти.

---

## L

**libuv thread pool**  
Пул потоков внутри libuv (4 по умолчанию), используемый для I/O операций и native addons (Sharp, bcrypt, Argon2). Не связан с Worker Threads. При интенсивном использовании native addons увеличивать: `UV_THREADPOOL_SIZE=8`.

---

## M

**maxQueue**  
Параметр Piscina: максимальный размер очереди ожидающих задач. При превышении — `run()` бросает ошибку немедленно. `'auto'` = `maxThreads * 10`. В production использовать явное число для предсказуемого backpressure.

**maxThreads**  
Параметр Piscina: максимальное количество Worker Thread в пуле. Default: `Math.min(cpus().length, 4)`. Оптимальное значение для CPU-bound задач — число физических ядер.

**MessageChannel**  
Пара портов (`port1`, `port2`) для двунаправленной коммуникации между потоками. Более гибкий вариант чем `parentPort` — позволяет создавать независимые каналы внутри одного воркера для разных типов сообщений.

**minThreads**  
Параметр Piscina: минимальное число поддерживаемых живых воркеров. `minThreads > 0` — воркеры прогреты, нет cold start при первом запросе. Для latency-sensitive сервисов всегда задавать явно.

---

## N

**named export (Piscina)**  
Возможность Piscina вызывать конкретный экспорт воркера: `pool.run(task, { name: 'resize' })`. Позволяет одному воркер-файлу реализовывать несколько операций без создания отдельных пулов для каждой функции.

---

## P

**parentPort**  
Объект в Worker Thread для коммуникации с родительским потоком: `parentPort.postMessage(result)` и `parentPort.on('message', handler)`. Аналог `process.send()` в child_process. `null` если воркер создан не через `Worker` API.

**Piscina**  
Worker Thread Pool для Node.js. Управляет жизненным циклом воркеров, очередью задач, статистикой. Воркер — файл с default export функцией. Версия 5.1.4 (апрель 2026).

---

## R

**race condition**  
Состояние, когда результат операции зависит от порядка выполнения двух потоков. При конкурентной записи в SharedArrayBuffer без Atomics: thread A читает значение, thread B читает то же значение, оба инкрементируют, один перезаписывает другого.

**resourceLimits**  
Параметр `new Worker()` и Piscina: ограничения памяти V8 для воркера. `maxOldGenerationSizeMb` — лимит heap, `maxYoungGenerationSizeMb` — лимит new space. При превышении воркер убивается, Piscina создаёт новый.

---

## S

**SharedArrayBuffer (SAB)**  
Буфер памяти, разделяемый между потоками без копирования. Передаётся через `postMessage` — обе стороны получают view на одни и те же байты. Требует Atomics для thread-safe доступа. В Node.js доступен без дополнительных заголовков (в отличие от браузера).

**structured clone algorithm**  
Алгоритм сериализации данных при `postMessage`. Поддерживает: примитивы, ArrayBuffer, Map, Set, Date, RegExp, Error. Не поддерживает: функции, классы с методами, Symbol, WeakMap, DOM nodes. Создаёт глубокую копию.

---

## T

**transferList**  
Второй аргумент `postMessage`: массив Transferable объектов (ArrayBuffer, MessagePort, ReadableStream). После transfer объект detached в отправляющем потоке. Zero-copy — данные не копируются, а перемещаются.

**tinypool**  
Форк Piscina с меньшим размером (38KB vs ~800KB). Меньше возможностей (нет utilization, нет OS-приоритетов). Используется внутри Vitest для test isolation. Версия 2.1.0 (апрель 2026).

---

## U

**utilization (Piscina)**  
Метрика `pool.utilization`: доля времени, когда воркеры были заняты задачами. Значение 0–1. `> 0.8` постоянно = воркеры перегружены, нужно увеличить `maxThreads`. `< 0.2` постоянно = воркеров слишком много, можно уменьшить.

**UV_THREADPOOL_SIZE**  
Переменная окружения Node.js для изменения размера libuv thread pool. Default: 4. Увеличивать при использовании native addons в Piscina воркерах: `UV_THREADPOOL_SIZE=8 node server.js`. Максимум: 1024.

---

## V

**V8 Isolate**  
Независимый экземпляр V8: своя heap, свой GC, свой JIT-компилятор. Каждый Worker Thread имеет отдельный Isolate. Данные между Isolates передаются через structured clone или SharedArrayBuffer — напрямую не доступны.

---

## W

**workerData**  
Данные, передаваемые в Worker Thread при создании: `new Worker(filename, { workerData: {...} })`. Structured clone, выполняется до старта event loop воркера. Подходит для конфигурации. Не поддерживает функции и классы с методами.

---

*Глоссарий модуля 22. Следующий: [Модуль 23 — Rate limiting паттерны](../23-rate-limiting/GLOSSARY.md)*
