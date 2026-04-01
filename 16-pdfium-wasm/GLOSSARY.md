# GLOSSARY — PDFium WASM

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**AsyncGenerator**
TypeScript/JavaScript генератор возвращающий значения асинхронно через `yield`. Используется для batch pipeline: обрабатывать документы и отдавать страницы по мере готовности без накопления всех результатов в памяти. Потребитель итерирует через `for await...of`.

---

## B

**Bitmap (raw RGBA)**
Несжатый растр: последовательность пикселей в формате Red-Green-Blue-Alpha, 4 байта на пиксель. PDFium отдаёт результат рендеринга именно в этом формате. Размер: `width × height × 4` байт. A4 @ 200dpi = 1240×1754 = ~8.7 МБ.

---

## C

**channels: 4**
Параметр Sharp при создании pipeline из raw bitmap. Указывает что входные данные — 4-канальные (RGBA). Без явного указания Sharp неверно интерпретирует данные. Обязателен при передаче PDFium bitmap в Sharp.

**Cold start**
Задержка первой операции из-за инициализации тяжёлого ресурса. Для PDFium WASM — 500ms–1s на загрузку и компиляцию ~10 МБ WASM бинаря. Последующие вызовы используют уже инициализированную библиотеку. Критично для Serverless окружений.

**Concurrency**
Число одновременно обрабатываемых задач. Для PDFium WASM — одновременное число активных `loadDocument` операций. Выше concurrency → выше нагрузка на WASM heap. Рекомендуемый потолок: `Math.max(2, os.cpus().length / 2)`.

---

## D

**destroy()**
Метод явного освобождения ресурсов PDFium объектов: `library.destroy()` и `document.destroy()`. WASM linear memory не управляется JavaScript GC — без явного вызова память не освобождается. Вызывать в `finally` блоке без исключений.

---

## E

**Eager init**
Стратегия инициализации: `PDFiumLibrary.init()` вызывается при старте сервера до первого запроса. Противопоставляется lazy init. Устраняет cold start на первый запрос. Добавляет 500ms–1s к startup time приложения.

**Event loop**
Однопоточный цикл обработки событий Node.js. CPU-intensive операции (рендеринг PDF) блокируют event loop — все другие запросы ждут. Worker threads выполняются параллельно без блокировки event loop.

---

## L

**Lazy init**
Стратегия инициализации: `PDFiumLibrary.init()` откладывается до первого реального запроса. Реализуется через кэширование Promise: повторные вызовы получают тот же Promise без повторной инициализации. Первый запрос ощущает cold start.

**loadDocument()**
Метод PDFiumLibrary загружающий PDF из Buffer в WASM heap. Синхронная операция с WASM. Память выделяется в WASM linear memory пропорционально размеру PDF. Требует парного `destroy()`. Опциональный второй аргумент — пароль для зашифрованных PDF.

---

## M

**Memory access out of bounds**
WASM RuntimeError возникающий при исчерпании WASM linear memory. Крашит Worker thread полностью. Причины: одновременная загрузка нескольких очень больших PDF, отсутствие `document.destroy()`, чрезмерный concurrency. Worker pool абсорбирует краш, перезапускает воркер.

---

## P

**page.render()**
Метод PDFium рендеринга страницы в raw RGBA bitmap. Принимает `scale` и `render` callback. Callback получает `{ data: Uint8Array, width: number, height: number }` — используется для передачи в Sharp. Возвращает то что вернул callback.

**pageCount**
Свойство `PDFiumDocument.pageCount` — число страниц документа. Доступно сразу после `loadDocument` без рендеринга. Используется для планирования batch обработки без полного чтения документа.

**PDFium**
PDF rendering engine из Chromium (Google). Используется в Chrome, Chromium, Android. WASM-порт обеспечивает Chrome-grade рендеринг в Node.js и браузере без нативных зависимостей.

**PDFiumDocument**
Объект представляющий загруженный PDF документ в WASM heap. Свойства: `pageCount`, `pages()` (iterator). Методы: `getPage(index)`, `destroy()`. Жёстко привязан к `PDFiumLibrary` создавшей его.

**PDFiumLibrary**
Singleton объект инициализирующий WASM движок PDFium. Создаётся через `PDFiumLibrary.init()`. Один экземпляр на процесс или Worker thread. Должен быть уничтожен через `destroy()` при завершении процесса.

**PDFiumPage**
Объект страницы PDF. Свойства: `width`, `height` (в pt), `number` (0-indexed). Методы: `render()`, `getText()`, `getTextRects()`. При итерации через `document.pages()` — явный `destroy()` не требуется.

**Provisioned Concurrency**
AWS Lambda функция: предварительно инициализированные экземпляры всегда готовы к обработке запросов. Устраняет cold start. Используется для Lambda с PDFium WASM где cold start >500ms недопустим по SLA.

---

## R

**RGBA**
Формат пикселя: Red (0-255), Green (0-255), Blue (0-255), Alpha (0-255). 4 байта на пиксель. PDFium нативно рендерит в RGBA. Sharp принимает raw RGBA через `{ raw: { width, height, channels: 4 } }`.

---

## S

**scale**
Коэффициент масштабирования при вызове `page.render({ scale })`. Итоговый размер изображения: `Math.round(page.width * scale) × Math.round(page.height * scale)` пикселей. `scale = dpi / 72` для достижения нужного DPI.

**Sharp**
Node.js библиотека высокопроизводительной обработки изображений на основе libvips. Используется для конвертации raw RGBA bitmap из PDFium в PNG/WebP/JPEG и resize. Версия 0.34.x актуальна на март 2026.

**Singleton**
Паттерн: один экземпляр объекта на процесс. Для `PDFiumLibrary` — критичен: повторная инициализация дорогостоящая. Реализуется через модульную переменную или кэшированный Promise.

---

## T

**transferList**
Третий аргумент `worker.postMessage(msg, transferList)` в Node.js Worker Threads. Массив `ArrayBuffer` объектов передаваемых в Worker без копирования (zero-copy transfer). После transfer ownership переходит к Worker, оригинальный Buffer становится пустым. Критично для больших bitmap (8+ МБ).

---

## W

**WASM (WebAssembly)**
Бинарный формат исполняемого кода для веб-платформ и Node.js. Позволяет запускать C/C++ код (PDFium написан на C++) в JavaScript окружении. WASM код работает в изолированной linear memory — отдельно от JS heap.

**WASM linear memory**
Непрерывный буфер памяти выделяемый WASM модулю. Не управляется JavaScript GC. Размер может расти динамически. PDFium аллоцирует документы и bitmap в WASM linear memory. Утечки в WASM heap не отображаются в стандартных Node.js heap метриках.

**Worker pool**
Пул заранее инициализированных Worker thread'ов. Каждый воркер держит инициализированный `PDFiumLibrary` singleton. Входящие задачи распределяются по свободным воркерам. Краш одного воркера не затрагивает пул — воркер перезапускается.

**Worker thread**
Node.js поток выполнения параллельный main thread. Имеет собственный event loop и heap. CPU-intensive операции (PDFium рендеринг) выполняются в Worker без блокировки main event loop. Коммуникация через `postMessage` / `on('message')`.

---

## Z

**Zero-copy transfer**
Передача данных между Worker threads без копирования через `transferList`. Применяется при передаче больших Buffer (rendered bitmap). Без zero-copy: Node.js копирует каждый MB битмапа — двойное потребление памяти на время передачи.

---

## В

**Воркер пул** → см. *Worker pool*

---

## Х

**Холодный старт** → см. *Cold start*

---

*Глоссарий модуля 16. Следующий: [Модуль 17 — Excel / XLSX internals](../17-xlsx-internals/GLOSSARY.md)*