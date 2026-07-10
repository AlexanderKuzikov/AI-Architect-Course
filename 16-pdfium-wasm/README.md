# Модуль 16 — PDFium WASM

> **Для AI-архитектора:** PDFium — рендеринговый движок Chrome. WASM-порт даёт производительность production-grade без нативных системных зависимостей. Критичен для Docker-сред где нельзя ставить libcairo, и для случаев когда качество рендеринга PDF.js недостаточно. Главный trade-off: ~10 МБ WASM бинарь + 500ms–1s холодный старт против отсутствия C++ зависимостей.
> Один день изучения — lifecycle объектов PDFium, рендеринг с Sharp, text extraction, Worker-паттерн для production, управление памятью.

## Содержание

1. [PDFium vs PDF.js: когда что выбирать](#1-pdfium-vs-pdfjs-когда-что-выбирать)
2. [Установка и инициализация](#2-установка-и-инициализация)
3. [Lifecycle: library → document → page → destroy](#3-lifecycle-library--document--page--destroy)
4. [Рендеринг страниц с Sharp](#4-рендеринг-страниц-с-sharp)
5. [Text extraction через PDFium](#5-text-extraction-через-pdfium)
6. [Зашифрованные документы](#6-зашифрованные-документы)
7. [Worker-паттерн для production](#7-worker-паттерн-для-production)
8. [Управление памятью и производительность](#8-управление-памятью-и-производительность)
9. [Граничные случаи](#9-граничные-случаи)
10. [Реальный кейс](#10-реальный-кейс)
11. [Антипаттерны](#11-антипаттерны)
12. [Задачи AI-кодеру](#задачи-ai-кодеру)
13. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

| Инструмент | Версия | Дата проверки |
|:--|:--|:--|
| Node.js Active LTS | 24.x | март 2026 |
| @hyzyla/pdfium | 2.1.12 | март 2026 |
| @embedpdf/pdfium | 2.1.1 | март 2026 |
| sharp | 0.34.x | март 2026 |
| TypeScript | 5.x | март 2026 |

---

## 1. PDFium vs PDF.js: когда что выбирать

### Матрица выбора

| Критерий | PDF.js + canvas | @hyzyla/pdfium |
|:--|:--|:--|
| Нативные зависимости | ✅ libcairo (npm: canvas) | ❌ нет |
| Docker сборка | ⚠️ системные пакеты | ✅ чистый образ |
| WASM размер | — | ~10 МБ |
| Cold start | ~50ms | 500ms–1s |
| Качество рендеринга | Хорошее | ✅ Chrome-grade |
| Сложные шрифты / CJK | Хорошее | ✅ Отличное |
| Text extraction | ✅ нативно | ✅ нативно |
| Form fields | ✅ частично | ✅ полностью |
| Аннотации | ✅ | ✅ |
| Многопоток | ⚠️ Worker | ✅ Worker-ready |
| Работа в браузере | ✅ | ✅ |

### Правило выбора

```
Docker + production качество + нет нативных deps → @hyzyla/pdfium
Уже используется canvas npm + простые документы → PDF.js
Браузер + bundle size критичен → PDF.js (меньше WASM)
Сложные формы / аннотации / CJK шрифты → @hyzyla/pdfium
```

**Практический вывод для архитектора:** В большинстве современных Node.js production систем — PDFium WASM предпочтительнее. Один раз заплатить за 10 МБ и cold start, получить Chrome-grade рендеринг без головной боли с нативными зависимостями в Docker.

---

## 2. Установка и инициализация

### Установка

```bash
npm install @hyzyla/pdfium sharp
```

`sharp` — отдельная зависимость для конвертации raw RGBA bitmap в PNG/WebP/JPEG. PDFium отдаёт сырые пиксели, Sharp делает из них файл.

### Первичная инициализация: паттерны

```typescript
import { PDFiumLibrary } from '@hyzyla/pdfium';
import type { PDFiumPageRenderOptions } from '@hyzyla/pdfium';
import sharp from 'sharp';

// ✅ Паттерн 1: Singleton — один экземпляр на процесс
// Инициализация один раз при старте приложения
let _library: PDFiumLibrary | null = null;

async function getLibrary(): Promise<PDFiumLibrary> {
  if (!_library) {
    _library = await PDFiumLibrary.init();
  }
  return _library;
}

// При shutdown приложения
process.on('SIGTERM', () => {
  _library?.destroy();
  _library = null;
});

// ✅ Паттерн 2: Явный lifecycle с using (TypeScript 5.2+)
// Автоматический destroy через Disposable
async function withLibrary<T>(
  fn: (lib: PDFiumLibrary) => Promise<T>
): Promise<T> {
  const library = await PDFiumLibrary.init();
  try {
    return await fn(library);
  } finally {
    library.destroy();
  }
}
```

### Render function: фабрика через Sharp

```typescript
// Фабрика render-функции с настраиваемым форматом
function makeRenderFn(
  format: 'png' | 'webp' | 'jpeg' = 'webp',
  quality: number = 85
) {
  return async (options: PDFiumPageRenderOptions): Promise<Buffer> => {
    const pipeline = sharp(options.data, {
      raw: {
        width: options.width,
        height: options.height,
        channels: 4, // RGBA
      },
    });

    switch (format) {
      case 'png':  return pipeline.png().toBuffer();
      case 'jpeg': return pipeline.jpeg({ quality }).toBuffer();
      case 'webp':
      default:     return pipeline.webp({ quality }).toBuffer();
    }
  };
}

// Использование
const renderFn = makeRenderFn('webp', 85);
```

**Практический вывод для архитектора:** `PDFiumLibrary.init()` — дорогая операция (~500ms). Инициализировать один раз (singleton или при старте сервера), переиспользовать для всех запросов. Не инициализировать на каждый запрос.

---

## 3. Lifecycle: library → document → page → destroy

### Иерархия объектов

```
PDFiumLibrary (один на процесс)
    │
    ├── PDFiumDocument (один на PDF файл)
    │       │
    │       ├── PDFiumPage (одна на страницу)
    │       │       ├── render()
    │       │       ├── getText()
    │       │       ├── getTextBox() / getTextRects()
    │       │       └── getAnnotations()
    │       │
    │       ├── pages() → Iterator<PDFiumPage>
    │       ├── getPage(index: number)
    │       └── destroy()
    │
    └── destroy()
```

**Правило:** каждый объект должен быть уничтожен явно. PDFium аллоцирует память в WASM heap — GC JavaScript не управляет этой памятью.

```typescript
// ❌ Утечка WASM памяти — document не уничтожен при ошибке
async function leaky(library: PDFiumLibrary, buffer: Buffer): Promise<string> {
  const document = await library.loadDocument(buffer);
  const page = document.getPage(0);
  const text = page.getText(); // если throws — document не destroy
  document.destroy();
  return text;
}

// ✅ try/finally гарантирует destroy
async function safe(library: PDFiumLibrary, buffer: Buffer): Promise<string> {
  const document = await library.loadDocument(buffer);
  try {
    const page = document.getPage(0);
    return page.getText();
  } finally {
    document.destroy(); // всегда выполнится
  }
}

// ✅ Через using (TypeScript 5.2+ / Node.js 20+)
// Требует [Symbol.dispose] реализации в PDFiumDocument — проверить в версии
async function modernSafe(library: PDFiumLibrary, buffer: Buffer): Promise<string> {
  const document = await library.loadDocument(buffer);
  try {
    return document.getPage(0).getText();
  } finally {
    document.destroy();
  }
}
```

### Полный рабочий lifecycle

```typescript
import { PDFiumLibrary } from '@hyzyla/pdfium';
import sharp from 'sharp';
import * as fs from 'fs/promises';

async function processDocument(pdfPath: string): Promise<void> {
  const library = await PDFiumLibrary.init();

  try {
    const buffer = await fs.readFile(pdfPath);
    const document = await library.loadDocument(buffer);

    try {
      console.log(`Страниц: ${document.pageCount}`);

      for (const page of document.pages()) {
        console.log(
          `Страница ${page.number}: ` +
          `${page.width.toFixed(1)} × ${page.height.toFixed(1)} pt`
        );
        // page объекты не требуют явного destroy в iterator паттерне
      }
    } finally {
      document.destroy();
    }

  } finally {
    library.destroy();
  }
}
```

**Практический вывод для архитектора:** `try/finally` вокруг каждого `loadDocument` — обязателен. Утечки WASM heap не видны в Node.js heap dump — они накапливаются в WASM linear memory и могут приводить к OOM без видимых следов в обычном мониторинге.

---

## 4. Рендеринг страниц с Sharp

### Базовый рендеринг

```typescript
interface RenderOptions {
  dpi?: number;       // дефолт 150
  format?: 'png' | 'webp' | 'jpeg';
  quality?: number;   // 1-100, дефолт 85
  maxDimPx?: number;  // resize до maxDim px (fit inside), дефолт 1536
}

interface RenderedPage {
  pageNumber: number;
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
  widthPt: number;
  heightPt: number;
}

async function renderPage(
  library: PDFiumLibrary,
  pdfBuffer: Buffer,
  pageIndex: number = 0,   // 0-indexed в PDFium
  options: RenderOptions = {}
): Promise<RenderedPage> {
  const {
    dpi = 150,
    format = 'webp',
    quality = 85,
    maxDimPx = 1536,
  } = options;

  const scale = dpi / 72;
  const document = await library.loadDocument(pdfBuffer);

  try {
    const page = document.getPage(pageIndex);

    const image = await page.render({
      scale,
      render: async (opts) => {
        let pipeline = sharp(opts.data, {
          raw: { width: opts.width, height: opts.height, channels: 4 },
        });

        // Resize если нужно
        if (maxDimPx) {
          pipeline = pipeline.resize(maxDimPx, maxDimPx, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        switch (format) {
          case 'png':  return pipeline.png().toBuffer();
          case 'jpeg': return pipeline.jpeg({ quality }).toBuffer();
          default:     return pipeline.webp({ quality }).toBuffer();
        }
      },
    });

    // Получить финальные размеры через Sharp metadata
    const meta = await sharp(image.data as Buffer).metadata();

    return {
      pageNumber: pageIndex + 1,
      buffer: image.data as Buffer,
      widthPx: meta.width ?? Math.round(page.width * scale),
      heightPx: meta.height ?? Math.round(page.height * scale),
      widthPt: page.width,
      heightPt: page.height,
    };
  } finally {
    document.destroy();
  }
}
```

### Рендеринг всех страниц с контролем памяти

```typescript
interface RenderAllOptions extends RenderOptions {
  batchSize?: number;       // страниц в параллели, дефолт 4
  onProgress?: (current: number, total: number) => void;
}

async function renderAllPages(
  library: PDFiumLibrary,
  pdfBuffer: Buffer,
  options: RenderAllOptions = {}
): Promise<RenderedPage[]> {
  const { batchSize = 4, onProgress, ...renderOpts } = options;

  // Получить pageCount без рендеринга
  const document = await library.loadDocument(pdfBuffer);
  const pageCount = document.pageCount;
  document.destroy();

  const results: RenderedPage[] = [];

  for (let i = 0; i < pageCount; i += batchSize) {
    const batch = Array.from(
      { length: Math.min(batchSize, pageCount - i) },
      (_, j) => i + j
    );

    const batchResults = await Promise.all(
      batch.map(pageIndex =>
        renderPage(library, pdfBuffer, pageIndex, renderOpts)
      )
    );

    results.push(...batchResults);
    onProgress?.(Math.min(i + batchSize, pageCount), pageCount);
  }

  return results;
}
```

### DPI guide для разных задач

```typescript
const DPI_PRESETS = {
  thumbnail: 72,      // превью, мелкое изображение
  screen: 96,         // отображение на экране
  print: 150,         // стандартная обработка документов
  ocr: 200,           // OCR мелкого шрифта (8-10pt)
  highQuality: 300,   // архивное качество, финансовые документы
} as const;

// Расчёт размера результирующего изображения
function estimateImageSize(
  pageWidthPt: number,
  pageHeightPt: number,
  dpi: number
): { widthPx: number; heightPx: number; megapixels: number } {
  const widthPx = Math.round(pageWidthPt * dpi / 72);
  const heightPx = Math.round(pageHeightPt * dpi / 72);
  return {
    widthPx,
    heightPx,
    megapixels: (widthPx * heightPx) / 1_000_000,
  };
}

// A4 при разных DPI:
// 72dpi  → 595 × 842 px  = 0.5 Mpx
// 150dpi → 1240 × 1754px = 2.2 Mpx
// 300dpi → 2480 × 3508px = 8.7 Mpx ← VLM может не принять без resize
```

**Практический вывод для архитектора:** Для VLM pipeline — рендер при 200 DPI, затем resize Sharp до 1536px max. Прямой рендер при 300 DPI без resize даёт изображения >8 Mpx — большинство VLM API отвергают или сжимают самостоятельно с потерей контроля.

---

## 5. Text extraction через PDFium

### Базовое извлечение

```typescript
interface PageTextResult {
  pageNumber: number;
  text: string;
  charCount: number;
}

async function extractTextAllPages(
  library: PDFiumLibrary,
  pdfBuffer: Buffer
): Promise<PageTextResult[]> {
  const document = await library.loadDocument(pdfBuffer);

  try {
    const results: PageTextResult[] = [];

    for (const page of document.pages()) {
      const text = page.getText();
      results.push({
        pageNumber: page.number + 1, // PDFium 0-indexed → 1-indexed
        text,
        charCount: text.length,
      });
    }

    return results;
  } finally {
    document.destroy();
  }
}
```

### Text с координатами (bounding boxes)

```typescript
interface TextRect {
  text: string;
  x: number;      // pt от левого края страницы
  y: number;      // pt от верхнего края страницы (конвертировано)
  width: number;
  height: number;
}

async function extractTextRects(
  library: PDFiumLibrary,
  pdfBuffer: Buffer,
  pageIndex: number = 0
): Promise<TextRect[]> {
  const document = await library.loadDocument(pdfBuffer);

  try {
    const page = document.getPage(pageIndex);
    const pageHeight = page.height;

    // getTextRects возвращает bounding boxes для каждого слова/токена
    const rects = page.getTextRects();

    return rects
      .filter(rect => rect.text.trim().length > 0)
      .map(rect => ({
        text: rect.text,
        x: rect.left,
        // ✅ PDFium Y от низа страницы → конвертируем к Y от верха
        y: pageHeight - rect.top,
        width: rect.right - rect.left,
        height: rect.top - rect.bottom,
      }));
  } finally {
    document.destroy();
  }
}
```

### Сравнение text extraction: PDFium vs PDF.js

```typescript
// PDFium часто лучше справляется с:
// - CJK шрифтами (китайский, японский, корейский)
// - Type1 шрифтами с нестандартным encoding
// - Документами с вертикальным текстом
// - RTL (арабский, иврит)

// PDF.js лучше для:
// - Западноевропейских документов со стандартными шрифтами
// - Случаев когда нужны точные координаты для layout analysis
//   (PDF.js возвращает transform матрицу с более детальными данными)

// Стратегия для ненадёжных источников:
async function robustExtract(
  library: PDFiumLibrary,
  pdfBuffer: Buffer
): Promise<string> {
  const document = await library.loadDocument(pdfBuffer);
  try {
    let text = '';
    for (const page of document.pages()) {
      text += page.getText() + '\n\n';
    }

    // Диагностика: много Private Use Area символов = битый ToUnicode
    const puaCount = [...text].filter(c => {
      const code = c.charCodeAt(0);
      return code >= 0xE000 && code <= 0xF8FF;
    }).length;

    if (puaCount / text.length > 0.05) {
      // >5% PUA символов → text extraction ненадёжен → нужен рендер → OCR/VLM
      throw new Error('PDF_ENCODING_BROKEN');
    }

    return text;
  } finally {
    document.destroy();
  }
}
```

**Практический вывод для архитектора:** PDFium text extraction надёжнее PDF.js для нестандартных шрифтов — тот же Chrome-grade движок. Но PUA-диагностику всё равно делать: некоторые PDF сломаны на уровне PDF spec, не уровне парсера.

---

## 6. Зашифрованные документы

```typescript
type OpenResult =
  | { success: true; document: any }
  | { success: false; reason: 'need_password' | 'wrong_password' | 'error'; message: string };

async function openPdfSafe(
  library: PDFiumLibrary,
  buffer: Buffer,
  password?: string
): Promise<OpenResult> {
  try {
    // PDFium: пароль передаётся вторым аргументом loadDocument
    const document = password
      ? await library.loadDocument(buffer, password)
      : await library.loadDocument(buffer);

    return { success: true, document };

  } catch (err: any) {
    const msg = String(err?.message ?? err);

    // PDFium выбрасывает разные ошибки в зависимости от версии
    if (msg.includes('password') || msg.includes('Password')) {
      if (!password) {
        return { success: false, reason: 'need_password', message: 'PDF требует пароль' };
      }
      return { success: false, reason: 'wrong_password', message: 'Неверный пароль' };
    }

    return { success: false, reason: 'error', message: msg };
  }
}

// Паттерн: попробовать без пароля, затем с паролем
async function openWithFallback(
  library: PDFiumLibrary,
  buffer: Buffer,
  passwords: string[]
): Promise<{ document: any; usedPassword: string | null }> {
  // Сначала без пароля
  const noPass = await openPdfSafe(library, buffer);
  if (noPass.success) {
    return { document: noPass.document, usedPassword: null };
  }

  // Перебрать пароли (для систем с известным набором паролей)
  for (const pwd of passwords) {
    const result = await openPdfSafe(library, buffer, pwd);
    if (result.success) {
      return { document: result.document, usedPassword: pwd };
    }
  }

  throw new Error(`PDF не открывается. Причина: ${noPass.reason}`);
}
```

---

## 7. Worker-паттерн для production

### Проблема: WASM в main thread

PDFium WASM операции — CPU-intensive. Рендеринг страницы при 200 DPI блокирует event loop Node.js на 100–500ms. Для HTTP сервера это означает задержку всех других запросов.

```
Проблема без Worker:

Request 1: renderPage(dpi=200, A4)  ──── 300ms блокировка event loop
                                           ↑
Request 2: GET /health              ─────(ждёт 300ms) ──→ response
Request 3: POST /api/other          ─────(ждёт 300ms) ──→ response
```

### Worker pool архитектура

```typescript
// pdf-worker.ts — выполняется в Worker thread
import { parentPort, workerData } from 'worker_threads';
import { PDFiumLibrary } from '@hyzyla/pdfium';
import sharp from 'sharp';

let library: PDFiumLibrary | null = null;

async function init() {
  library = await PDFiumLibrary.init();
  parentPort?.postMessage({ type: 'ready' });
}

parentPort?.on('message', async (msg) => {
  if (!library) return;

  const { id, type, payload } = msg;

  try {
    switch (type) {
      case 'render': {
        const { pdfBuffer, pageIndex, dpi, format, quality, maxDimPx } = payload;
        const scale = dpi / 72;
        const document = await library.loadDocument(Buffer.from(pdfBuffer));

        try {
          const page = document.getPage(pageIndex);
          const image = await page.render({
            scale,
            render: async (opts) => {
              let pipeline = sharp(opts.data, {
                raw: { width: opts.width, height: opts.height, channels: 4 },
              });
              if (maxDimPx) {
                pipeline = pipeline.resize(maxDimPx, maxDimPx, {
                  fit: 'inside',
                  withoutEnlargement: true,
                });
              }
              return format === 'png'
                ? pipeline.png().toBuffer()
                : pipeline.webp({ quality }).toBuffer();
            },
          });

          // Передать результат через transferList для zero-copy
          const buffer = image.data as Buffer;
          parentPort?.postMessage(
            { id, type: 'result', data: buffer },
            [buffer.buffer]
          );
        } finally {
          document.destroy();
        }
        break;
      }

      case 'extractText': {
        const { pdfBuffer } = payload;
        const document = await library.loadDocument(Buffer.from(pdfBuffer));
        try {
          const pages: string[] = [];
          for (const page of document.pages()) {
            pages.push(page.getText());
          }
          parentPort?.postMessage({ id, type: 'result', data: pages });
        } finally {
          document.destroy();
        }
        break;
      }
    }
  } catch (err: any) {
    parentPort?.postMessage({ id, type: 'error', message: err.message });
  }
});

init();
```

```typescript
// pdf-worker-pool.ts — пул воркеров
import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import * as path from 'path';

interface PendingTask {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

class PdfWorkerPool {
  private workers: Worker[] = [];
  private freeWorkers: Worker[] = [];
  private taskQueue: Array<{ worker: Worker; msg: object; task: PendingTask }> = [];
  private pending = new Map<string, PendingTask>();
  private initialized = false;

  constructor(private poolSize: number = 2) {}

  async init(): Promise<void> {
    const workerPath = path.join(__dirname, 'pdf-worker.js');

    const readyPromises = Array.from({ length: this.poolSize }, () =>
      new Promise<Worker>((resolve) => {
        const worker = new Worker(workerPath);
        worker.once('message', (msg) => {
          if (msg.type === 'ready') {
            this.freeWorkers.push(worker);
            resolve(worker);
          }
        });
        worker.on('message', (msg) => this.handleMessage(worker, msg));
        this.workers.push(worker);
      })
    );

    await Promise.all(readyPromises);
    this.initialized = true;
  }

  private handleMessage(worker: Worker, msg: any): void {
    const task = this.pending.get(msg.id);
    if (!task) return;

    this.pending.delete(msg.id);
    this.freeWorkers.push(worker);

    if (msg.type === 'error') {
      task.reject(new Error(msg.message));
    } else {
      task.resolve(msg.data);
    }

    // Обработать очередь
    this.processQueue();
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.freeWorkers.length === 0) return;

    const worker = this.freeWorkers.pop()!;
    const { msg, task } = this.taskQueue.shift()!;
    const id = (msg as any).id;

    this.pending.set(id, task);
    worker.postMessage(msg);
  }

  ```
  async send<T>(type: string, payload: object): Promise<T> {
  ```
    if (!this.initialized) throw new Error('Pool not initialized');

    const id = randomUUID();
    const msg = { id, type, payload };

    return new Promise<T>((resolve, reject) => {
      const task = {
        resolve: resolve as (v: unknown) => void,
        reject,
      };

      if (this.freeWorkers.length > 0) {
        const worker = this.freeWorkers.pop()!;
        this.pending.set(id, task);
        worker.postMessage(msg);
      } else {
        this.taskQueue.push({ worker: null as any, msg, task });
      }
    });
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
    this.freeWorkers = [];
  }
}

// Singleton
export const pdfPool = new PdfWorkerPool(2);
```

**Практический вывод для архитектора:** `poolSize = Math.max(2, os.cpus().length / 2)` — отправная точка. WASM не масштабируется линейно выше числа физических ядер. При 2 ядрах — пул из 2 воркеров. Мониторить `taskQueue.length` — при постоянной очереди увеличивать пул.

---

## 8. Управление памятью и производительность

### WASM heap: что занимает память

```
PDFiumLibrary.init()  → ~20–30 МБ WASM heap (движок + шрифты)
library.loadDocument() → +N МБ на документ (весь PDF в WASM heap)
page.render()         → +widthPx × heightPx × 4 байта RGBA bitmap
                          A4 @ 200dpi = 1240×1754 = ~8.7 МБ
document.destroy()    → освобождает память документа
```

```typescript
// Расчёт потребления памяти для планирования
function estimateMemoryMB(
  pdfSizeMB: number,
  pageWidthPt: number,
  pageHeightPt: number,
  dpi: number
): number {
  const wasmBase = 30;                                      // MB
  const documentOverhead = pdfSizeMB * 2;                  // PDF + decoded
  const widthPx = Math.round(pageWidthPt * dpi / 72);
  const heightPx = Math.round(pageHeightPt * dpi / 72);
  const bitmapMB = (widthPx * heightPx * 4) / 1_000_000;  // RGBA

  return wasmBase + documentOverhead + bitmapMB;
}

// A4 PDF 5MB @ 200dpi:
// 30 (wasm) + 10 (document) + 8.7 (bitmap) = ~49 MB
```

### Cold start стратегии

```typescript
// Стратегия 1: Eager init — инициализировать при старте сервера
// ✅ Нет задержки на первый запрос
// ❌ +500ms к startup time
export async function setupPdfService(): Promise<void> {
  const library = await PDFiumLibrary.init();
  // сохранить в singleton
}

// Стратегия 2: Lazy init с кэшем
let initPromise: Promise<PDFiumLibrary> | null = null;

export async function getLibraryCached(): Promise<PDFiumLibrary> {
  if (!initPromise) {
    initPromise = PDFiumLibrary.init();
  }
  return initPromise; // повторные вызовы ждут того же промиса
}

// Стратегия 3: Warmup запрос при деплое
// POST /internal/warmup → обрабатывает dummy PDF → библиотека инициализирована
```

### Benchmark: когда PDFium быстрее PDF.js

```
Документ: 50-страничный PDF с кириллическими шрифтами, A4, 200dpi

PDF.js + canvas:
  Рендеринг: ~2.1s (50 страниц, batch=5)
  Memory peak: ~180 МБ (JS heap + canvas native)

@hyzyla/pdfium (singleton library, batch=5):
  Cold start: 620ms (один раз)
  Рендеринг: ~1.3s (50 страниц, batch=5)
  Memory peak: ~210 МБ (WASM heap + Sharp)

Итого PDFium: 620ms cold + 1.3s → быстрее при повторных запросах
Итого PDF.js: 2.1s каждый запрос без cold start overhead
```

---

## 9. Граничные случаи

### PDF с нестандартными размерами страниц

```typescript
// В одном документе могут быть страницы разного размера
async function analyzePageSizes(
  library: PDFiumLibrary,
  buffer: Buffer
): Promise<void> {
  const document = await library.loadDocument(buffer);
  try {
    const sizes = new Map<string, number>();
    for (const page of document.pages()) {
      const key = `${page.width.toFixed(0)}×${page.height.toFixed(0)}`;
      sizes.set(key, (sizes.get(key) ?? 0) + 1);
    }
    // ✅ Адаптировать рендеринг под каждую страницу индивидуально
    for (const [size, count] of sizes) {
      console.log(`${size} pt: ${count} страниц`);
    }
  } finally {
    document.destroy();
  }
}
```

### Повреждённые PDF

```typescript
// PDFium более толерантен к повреждённым файлам чем PDF.js
// Но всё равно может выбросить исключение

async function openRobust(
  library: PDFiumLibrary,
  buffer: Buffer
): Promise<{ document: any; repaired: boolean }> {
  try {
    const document = await library.loadDocument(buffer);
    return { document, repaired: false };
  } catch (err: any) {
    // Некоторые PDF можно "починить" передав пустой пароль
    try {
      const document = await library.loadDocument(buffer, '');
      return { document, repaired: true };
    } catch {
      throw new Error(`Не удалось открыть PDF: ${err.message}`);
    }
  }
}
```

### Очень большие PDF (>200 страниц)

```typescript
// Проблема: loadDocument загружает весь PDF в WASM heap сразу
// Для 200-страничного PDF 50МБ → ~100-150MB WASM heap

// ✅ Стратегия: stream через временный файл
// PDFium поддерживает чтение из файловой системы (в нативном порту)
// В WASM версии — только из buffer

// Для очень больших файлов:
// 1. Разбить PDF на части перед загрузкой (внешний инструмент: pdftk, qpdf)
// 2. Обрабатывать части независимо
// 3. Освобождать память между частями

async function processLargeDocumentInChunks(
  library: PDFiumLibrary,
  pdfBuffer: Buffer,
  chunkSize: number = 20
): Promise<string[]> {
  // Сначала получить pageCount
  const docForCount = await library.loadDocument(pdfBuffer);
  const pageCount = docForCount.pageCount;
  docForCount.destroy();

  const allTexts: string[] = [];

  for (let start = 0; start < pageCount; start += chunkSize) {
    // Загружаем документ заново на каждый chunk
    // Не оптимально, но гарантирует освобождение памяти между чанками
    const document = await library.loadDocument(pdfBuffer);
    try {
      const end = Math.min(start + chunkSize, pageCount);
      for (let i = start; i < end; i++) {
        allTexts.push(document.getPage(i).getText());
      }
    } finally {
      document.destroy(); // ✅ освобождаем WASM heap после каждого chunk
    }
  }

  return allTexts;
}
```

### Граничные случаи — где ломается

**WASM linear memory exhausted.** При обработке очень большого PDF (>100MB) или нескольких параллельных документов — WASM heap может исчерпаться. Симптом: `RuntimeError: memory access out of bounds`. Решение: уменьшить параллелизм, увеличить `--max-old-space-size`.

**Sharp + RGBA channels mismatch.** PDFium отдаёт 4 канала (RGBA). Sharp ожидает явно `channels: 4`. Если передать raw bitmap без указания каналов — Sharp неправильно интерпретирует данные.

```typescript
// ❌ Sharp не знает размерность
sharp(opts.data).png()

// ✅ Явно указать raw формат
sharp(opts.data, {
  raw: { width: opts.width, height: opts.height, channels: 4 }
}).png()
```

**Почему это важно архитектору:** WASM ошибки памяти крашат весь Worker thread (не только текущий запрос). Worker pool абсорбирует краш и перезапускает воркер — без пула один bad PDF роняет сервер.

---

## 10. Реальный кейс

**Задача:** перевести документооборот с PDF.js на PDFium WASM.
~500 PDF/день: судебные решения, договоры, сканы 1С. Chrome-grade
качество рендеринга для VLM pipeline.

**Стек:** Node.js 24, @hyzyla/pdfium 2.1, Sharp 0.34, Docker,
LM Studio с CURRENT_VLM_MODEL.

**Гипотеза:** PDFium будет стабильнее и быстрее PDF.js на
1С-сгенерированных PDF с Type1 шрифтами и битым ToUnicode.

**Что получилось:**

**Проблема A — Cold start в serverless.** Первая попытка:
Lambda + PDFium WASM. Каждый invoke — холодный старт:
- Lambda: ~300ms
- PDFium init: ~600ms
- Рендер одной страницы A4 200dpi: ~200ms

Итого: 1100ms для первого запроса. При SLA < 2s — окей. При
burst 50 concurrent — 50× PDFium init = OOM.

Вторая попытка: long-running контейнер с singleton library.
Cold start только при деплое. Все запросы — только рендер.

**Результат сравнения PDF.js vs PDFium на 50 документах:**

| Метрика | PDF.js + canvas | PDFium WASM |
|---------|----------------|-------------|
| 1С-документы: текстовые артефакты | 12 документов | **0** |
| Сложные шрифты (кириллица) | 8 с глифами | **0** |
| Ротированные сканы | рендер ок | рендер ок |
| Среднее время на страницу | ~42ms | ~26ms |
| Docker образ | 680 MB + libcairo | **82 MB** (WASM) |

PDF.js + canvas требовал `apt-get install libcairo2-dev` —
680 MB образ. PDFium WASM — чистый Node.js образ, 82 MB.

**Вывод, противоречащий интуиции:**

Выигрыш PDFium оказался не в скорости рендеринга (+38%), а в
**Docker образе** (−88%) и **качестве текста на проблемных
документах**. Для 1С-документов с Type1 шрифтами PDF.js давал
артефакты (нечитаемые символы) — PDFium рендерил корректно.

На чистых PDF (Word → PDF) разницы в качестве не было. На
сканах (image-only) — обе библиотеки делают bitmap, разница
только в цветовом профиле.

**Архитектурное решение:**

```
Docker образ: node:24-alpine + @hyzyla/pdfium (82 MB)
Worker pool: 2 воркера на core (4 workers для Ryzen 5)
Render pipeline:
  PDF → PDFium render (200dpi) → Sharp resize (1536px) → VLM
Text extraction: PDFium.getText() + PUA-диагностика
  → при >5% PUA-символов: fallback на render → VLM OCR
```

Для 500 PDF/день:
- 380 (76%) — чистый текст через PDFium.getText() — ~200ms/документ
- 120 (24%) — повреждённый ToUnicode → рендер → VLM — ~3s/документ
- Total: ~7 мин/день (против ~18 мин на PDF.js + OCR fallback)

---

## 11. Антипаттерны

### «Инициализировать PDFiumLibrary на каждый запрос»

**Выглядит правильно:** изолированно, нет глобального состояния.

**Почему ошибка:** каждый `PDFiumLibrary.init()` загружает 10 МБ WASM бинарь и тратит 500ms–1s. При 100 req/s → 100 инициализаций в секунду = недостижимо. Singleton или Worker с одной инициализацией — обязательно.

---

### «Не вызывать document.destroy()»

**Выглядит правильно:** JS GC сам освободит.

**Почему ошибка:** GC управляет JS heap. WASM linear memory — отдельная область. `PDFiumDocument` в JS heap = маленький объект-обёртка. Реальная память документа в WASM не освобождается без явного `destroy()`. Утечка видна только в WASM heap profiler, не в стандартном Node.js мониторинге.

---

### «Рендерить в main thread без Worker»

**Выглядит правильно:** проще, меньше кода.

**Почему ошибка:** рендеринг A4 @ 200dpi блокирует event loop на 100–500ms. Express/Fastify не обрабатывают другие запросы в это время. Health-check endpoint перестаёт отвечать. Worker pool — не преждевременная оптимизация, а требование к production сервису.

---

### «Передавать большой Buffer через postMessage без transferList»

**Выглядит правильно:** postMessage(buffer) — работает.

**Почему ошибка:** без `transferList` Node.js копирует Buffer при передаче в/из Worker. Для 8 МБ RGBA bitmap — 8 МБ копирование при каждом рендере. С `transferList: [buffer.buffer]` — zero-copy transfer, ownership переходит к Worker.

```typescript
// ❌ Копирование 8MB
worker.postMessage({ type: 'render', data: bitmap });

// ✅ Zero-copy transfer
worker.postMessage({ type: 'render', data: bitmap }, [bitmap.buffer]);
```

---

### «Игнорировать холодный старт в Lambda/Serverless»

**Выглядит правильно:** функция работает корректно.

**Почему ошибка:** PDFium WASM cold start 500ms–1s + Lambda cold start 100–300ms = 1.5s задержка первого запроса. Для SLA <1s — недопустимо. Решение: Provisioned Concurrency в Lambda, или отказ от Serverless в пользу long-running контейнера.

---

## Anti-checklist ☠️

- [ ] Инициализировать PDFiumLibrary на каждый запрос — 10 MB WASM + ~500ms cold start
- [ ] Не вызывать document.destroy() — WASM heap не освобождается GC
- [ ] Рендерить в main thread без Worker — блокирует event loop на 100-500ms
- [ ] Передавать Buffer через postMessage без transferList — 8 MB копирование на каждый рендер
- [ ] Игнорировать холодный старт в Serverless — 1.5s до первого ответа
- [ ] Sharp без raw: {channels: 4} — неправильная интерпретация RGBA данных

## Задачи AI-кодеру

**Задача 1 — Production рендер-сервис**

Плохая формулировка:
> «Сделай рендеринг PDF через PDFium»

Хорошая формулировка:
> «Реализуй TypeScript класс `PdfRenderService` с методами: `init(): Promise<void>` (инициализация singleton PDFiumLibrary из @hyzyla/pdfium 2.1.12 + Worker pool из 2 воркеров), `renderPage(pdfBuffer: Buffer, pageIndex: number, opts: {dpi: number, format: 'webp'|'png', maxDimPx: number}): Promise<Buffer>` (рендер через Worker, zero-copy transfer), `destroy(): Promise<void>`. Рендер-функция: Sharp 0.34.x, raw RGBA 4 channels, resize fit:inside withoutEnlargement. При ошибке Worker — логировать и перезапускать воркер. Экспортировать singleton экземпляр.»

Формула: версии + Worker + zero-copy + error recovery + singleton.

---

**Задача 2 — Надёжное извлечение текста**

Плохая формулировка:
> «Извлеки текст из PDF через PDFium»

Хорошая формулировка:
> «Реализуй TypeScript функцию `extractPdfText(library: PDFiumLibrary, buffer: Buffer): Promise<ExtractResult>`. Тип `ExtractResult`: `{ pages: {num: number, text: string}[], encoding: 'ok'|'broken'|'empty', totalChars: number }`. Логика encoding detection: если >5% символов в диапазоне U+E000–U+F8FF (Private Use Area) → 'broken'. Если totalChars < 10 × pageCount → 'empty'. Иначе → 'ok'. При broken или empty — не выбрасывать ошибку, возвращать результат с соответствующим статусом. Обязательно document.destroy() в finally.»

Формула: тип возврата + PUA диагностика + статус без исключения + memory cleanup.

---

**Задача 3 — Batch pipeline с прогрессом**

Плохая формулировка:
> «Обработай несколько PDF»

Хорошая формулировка:
> «Реализуй TypeScript функцию `batchRenderPdfs(inputs: {id: string, buffer: Buffer}[], opts: {dpi: number, format: 'webp'|'png', concurrency: number}): AsyncGenerator<{id: string, pageIndex: number, image: Buffer}|{id: string, error: string}>`. Использовать @hyzyla/pdfium singleton library. Concurrency: не более opts.concurrency документов одновременно. Каждая страница — отдельный yield. Ошибка одного документа не прерывает обработку остальных — yield error объект. document.destroy() после каждого документа независимо от ошибок.»

Формула: AsyncGenerator + concurrency control + partial failure handling + cleanup.

---

## Чеклист архитектора

### Инициализация и lifecycle
- [ ] `PDFiumLibrary.init()` вызывается один раз — singleton или Worker init
- [ ] `document.destroy()` в `finally` блоке — без исключений
- [ ] Cold start учтён: eager init при старте сервера если SLA < 1s
- [ ] При Serverless — Provisioned Concurrency или альтернатива

### Рендеринг
- [ ] DPI выбран под задачу: ≥150 для документов, ≥200 для мелкого шрифта
- [ ] Sharp получает `raw: { channels: 4 }` явно
- [ ] Resize до maxDimPx перед отправкой в VLM
- [ ] Большие bitmap передаются в Worker через `transferList` (zero-copy)

### Production
- [ ] Рендеринг в Worker thread — event loop не блокируется
- [ ] Worker pool: size = max(2, cpus/2)
- [ ] Краш Worker'а не роняет процесс — перезапуск воркера в пуле
- [ ] WASM heap мониторится отдельно от JS heap

### Качество
- [ ] PUA-диагностика после text extraction
- [ ] Повреждённые PDF обрабатываются с try/catch без краша
- [ ] Документы с разными размерами страниц — scale рассчитывается per-page

---

*Модуль 16 завершён.*
*Следующий: [Модуль 17 — Excel / XLSX internals](../17-xlsx-internals/README.md)*
