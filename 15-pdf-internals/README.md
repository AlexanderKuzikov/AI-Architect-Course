# Модуль 15 — PDF internals

> **Для AI-архитектора:** PDF — не «документ с текстом». Это язык описания страниц (PostScript-производный) где текст, шрифты, изображения и координаты существуют независимо. Нет гарантии что «видимые слова» соответствуют «извлечённому тексту». Понимание внутренней структуры определяет что вообще возможно сделать с конкретным PDF — и почему одни файлы парсятся нормально, а другие дают мусор.
> Один день изучения — структура PDF как формата, text extraction механика, инструменты для Node.js, рендеринг через PDF.js и PDFium WASM, граничные случаи реального документооборота.

## Содержание

1. [PDF как формат: структура файла](#1-pdf-как-формат-структура-файла)
2. [Текст в PDF: три уровня](#2-текст-в-pdf-три-уровня)
3. [Шрифты и кодировки: главная боль](#3-шрифты-и-кодировки-главная-боль)
4. [Text extraction в Node.js](#4-text-extraction-в-nodejs)
5. [Рендеринг страниц: PDF.js vs PDFium WASM](#5-рендеринг-страниц-pdfjs-vs-pdfium-wasm)
6. [Метаданные и структура документа](#6-метаданные-и-структура-документа)
7. [PDF/A и PDF/UA: производственные форматы](#7-pdfa-и-pdfua-производственные-форматы)
8. [Граничные случаи реального документооборота](#8-граничные-случаи-реального-документооборота)
9. [Реальный кейс](#9-реальный-кейс)
10. [Антипаттерны](#10-антипаттерны)
11. [Задачи AI-кодеру](#задачи-ai-кодеру)
12. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

| Инструмент | Версия | Дата проверки |
|:--|:--|:--|
| Node.js Active LTS | 24.x | март 2026 |
| pdfjs-dist (Mozilla PDF.js) | 5.6.205 | март 2026 |
| MuPDF JS | 1.26.9 | март 2026 |
| @hyzyla/pdfium | актуальный на npm | март 2026 |
| @embedpdf/pdfium | актуальный на npm | март 2026 |
| pdf-parse | 1.1.x | март 2026 |

---

## 1. PDF как формат: структура файла

### Механика

PDF — бинарный формат с текстовыми секциями. Файл состоит из четырёх частей:

```
┌─────────────────────────────────┐
│  Header                         │  %PDF-1.7 или %PDF-2.0
├─────────────────────────────────┤
│  Body                           │  объекты: страницы, шрифты,
│  (objects)                      │  изображения, потоки контента
├─────────────────────────────────┤
│  Cross-reference table (xref)   │  байтовые смещения объектов
│  или Cross-reference stream     │  для random access
├─────────────────────────────────┤
│  Trailer                        │  указатель на корневой объект
│                                 │  (Catalog), размер xref
└─────────────────────────────────┘
```

Файл читается с конца: парсер ищет `%%EOF`, затем `startxref` — смещение xref таблицы. XRef даёт байтовые адреса всех объектов для прямого доступа без линейного чтения.

### Объекты PDF

Всё в PDF — объекты с номером и версией (`N G obj`):

```
% Объект 1, версия 0 — словарь страницы
1 0 obj
<<
  /Type /Page
  /Parent 2 0 R        % R = Reference на объект 2
  /MediaBox [0 0 595 842]  % A4 в pt: 210mm×297mm при 72dpi
  /Contents 3 0 R      % ссылка на поток контента страницы
  /Resources <<
    /Font <<
      /F1 4 0 R        % шрифт F1 = объект 4
    >>
  >>
>>
endobj

% Объект 3 — поток контента страницы
3 0 obj
<<
  /Length 44
>>
stream
BT
  /F1 12 Tf            % выбрать шрифт F1, размер 12pt
  100 700 Td           % переместить курсор в точку (100, 700)
  (Hello, World!) Tj   % вывести строку
ET
endstream
endobj
```

### Системы координат

PDF использует PostScript координаты: origin (0,0) — нижний левый угол страницы, ось Y направлена вверх. Единица — pt (1/72 дюйма).

```
A4 страница:
  Width:  595 pt = 210 mm
  Height: 842 pt = 297 mm

  (0, 842) ─────────── (595, 842)
      │                       │
      │    Y ↑                │
      │    │                  │
      │    └──→ X             │
  (0, 0) ─────────────(595, 0)

Конвертер:
  mm2pt = mm * 2.8346
  pt2px_72dpi = pt (1:1 при 72dpi)
  pt2px_96dpi = pt * (96/72) = pt * 1.333
  pt2px_150dpi = pt * (150/72) = pt * 2.083
```

**Практический вывод для архитектора:** При рендеринге PDF в изображение для VLM — multiplier зависит от требуемого DPI. Для OCR мелкого текста документов: минимум 150dpi, оптимум 200–300dpi. `pt * (dpi/72)` — универсальная формула.

---

## 2. Текст в PDF: три уровня

### Три класса PDF по наличию текста

Это фундаментальный выбор: что вообще можно сделать с конкретным файлом.

```
Класс 1: Searchable PDF (native text)
  ├─ Текст хранится как символы в content stream
  ├─ text extraction работает напрямую
  ├─ Качество зависит от корректности ToUnicode map
  └─ Источник: Word → PDF, LaTeX → PDF, печать в PDF

Класс 2: Image-only PDF (scanned)
  ├─ Страницы = растровые изображения (JPEG/JBIG2/CCITTFax)
  ├─ Текста в PDF нет вообще
  ├─ Требует OCR для получения текста
  └─ Источник: сканер без OCR, фото документа

Класс 3: Hybrid PDF (image + hidden text layer)
  ├─ Изображение страницы + невидимый текстовый слой поверх
  ├─ text extraction возвращает OCR-результат (может содержать ошибки)
  ├─ "Searchable scan" — результат Adobe Acrobat OCR
  └─ Источник: сканер + Adobe/ABBYY с OCR
```

### Определение класса программно

```typescript
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfClass = 'native-text' | 'image-only' | 'hybrid';

async function classifyPdf(buffer: ArrayBuffer): Promise<PdfClass> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  let totalChars = 0;
  let imageOnlyPages = 0;

  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // первые 5 страниц
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageChars = textContent.items
      .filter((item): item is pdfjs.TextItem => 'str' in item)
      .reduce((acc, item) => acc + item.str.length, 0);

    if (pageChars < 10) imageOnlyPages++;
    totalChars += pageChars;
  }

  const checkedPages = Math.min(pdf.numPages, 5);
  if (imageOnlyPages === checkedPages) return 'image-only';

  // Hybrid: есть текст, но мало символов на страницу (OCR layer)
  const avgCharsPerPage = totalChars / (checkedPages - imageOnlyPages || 1);
  if (imageOnlyPages > 0 || avgCharsPerPage < 50) return 'hybrid';

  return 'native-text';
}
```

**Практический вывод для архитектора:** Класс PDF определяет pipeline. `native-text` → text extraction. `image-only` → render → VLM/OCR. `hybrid` → либо доверять existing text layer (быстро, риск ошибок), либо render → OCR (медленно, надёжно). Выбор зависит от источника документа и требований к точности.

---

## 3. Шрифты и кодировки: главная боль

### Механика

PDF хранит текст как последовательность glyph ID или байтовых кодов, не Unicode символов. Маппинг code → Unicode — через структуры шрифта:

```
Content stream: (Привет) Tj
  ↓
Font object: /Encoding /WinAnsiEncoding
  ↓
Character code: 0xCF 0xF0 0xE8 0xE2 0xE5 0xF2
  ↓
ToUnicode CMap: код → Unicode codepoint
  ↓
Текст: "Привет"
```

Если `ToUnicode` map отсутствует или некорректен — text extraction даёт мусор.

### Три сценария кодировок

**Сценарий 1: ToUnicode присутствует и корректен**
```
Результат: извлечённый текст совпадает с видимым. Всё хорошо.
```

**Сценарий 2: Стандартная кодировка без ToUnicode**
```
/Encoding /WinAnsiEncoding → cp1252 → некорректный для кириллицы
/Encoding /MacRomanEncoding → mac-roman → аналогично
Результат: кириллица извлекается как латиница или знаки вопроса
```

**Сценарий 3: Custom encoding или Type3 шрифт**
```
Корпоративные PDF генераторы часто создают нестандартный маппинг
Type3 шрифты = глифы как векторные программы без стандартного маппинга
Результат: извлечённый текст — произвольный мусор
```

### Диагностика проблемы кодировки

```typescript
async function diagnoseEncoding(buffer: ArrayBuffer): Promise<void> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();

  // Проверить наличие toUnicode проблем
  const items = textContent.items.filter(
    (item): item is pdfjs.TextItem => 'str' in item
  );

  const suspiciousChars = items
    .flatMap(item => [...item.str])
    .filter(char => {
      const code = char.charCodeAt(0);
      // Символы в Private Use Area часто означают broken ToUnicode
      return (code >= 0xE000 && code <= 0xF8FF) ||
             code === 0xFFFD || // replacement character
             (code < 0x20 && code !== 0x09 && code !== 0x0A);
    });

  if (suspiciousChars.length > 0) {
    console.warn(
      `[PDF] Подозрительные символы в тексте: ${suspiciousChars.length}шт. ` +
      `Возможна проблема ToUnicode. Рекомендуется рендер → OCR.`
    );
  }
}
```

### Кириллица в российских PDF

Российский документооборот — особый случай:

```
Типичные источники проблемных PDF:
  - 1С: Предприятие (Print → PDF) — часто Type1 шрифты, битый ToUnicode
  - СБИС, Контур: нормально, есть ToUnicode
  - Государственные системы (ГАС, ФНС) — PostScript маршрут, Type1
  - Сканы нотариусов / судов — image-only или hybrid с ошибками OCR

✅ Надёжные источники: docx→PDF через Word, Google Docs→PDF
❌ Ненадёжные источники: 1С Print, старые госсистемы, сканы
```

**Практический вывод для архитектора:** Для российского документооборота — всегда проверяй класс PDF и наличие ToUnicode проблем перед text extraction. Render → VLM надёжнее для 1С-generated PDF чем попытка распарсить побитый text layer.

---

## 4. Text extraction в Node.js

### pdf-parse: простейший случай

```typescript
import pdfParse from 'pdf-parse';
import * as fs from 'fs';

interface ExtractResult {
  text: string;
  numPages: number;
  info: Record<string, unknown>;
}

async function extractTextSimple(pdfPath: string): Promise<ExtractResult> {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);

  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info,
  };
}
```

`pdf-parse` использует PDF.js под капотом. Удобен для быстрого прототипа. Проблемы: нет контроля над постраничной обработкой, нет позиций текста, тихо даёт мусор при битом ToUnicode.

### pdfjs-dist: полный контроль

```typescript
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';

interface PageText {
  pageNum: number;
  text: string;
  items: Array<{
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
  }>;
}

async function extractTextStructured(
  buffer: ArrayBuffer
): Promise<PageText[]> {
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // ✅ Отключить worker в Node.js
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pages: PageText[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent({
      includeMarkedContent: false,
    });

    const items = textContent.items
      .filter((item): item is TextItem => 'str' in item && item.str.length > 0)
      .map(item => {
        // transform: [scaleX, skewX, skewY, scaleY, transX, transY]
        const [, , , scaleY, x, y] = item.transform;
        return {
          str: item.str,
          x: Math.round(x),
          // ✅ PDF: Y от низа страницы, конвертируем к Y от верха
          y: Math.round(viewport.height - y),
          width: Math.round(item.width),
          height: Math.round(item.height),
          fontSize: Math.round(Math.abs(scaleY)),
        };
      });

    // Собрать текст с сохранением порядка строк
    const text = reconstructText(items, viewport.height);

    pages.push({ pageNum, text, items });
  }

  return pages;
}

function reconstructText(
  items: PageText['items'],
  pageHeight: number
): string {
  if (!items.length) return '';

  // Группировать по строкам (одинаковый Y с допуском)
  const lineThreshold = 5; // px
  const lines = new Map<number, string[]>();

  // Сортировать по Y (сверху вниз), затем по X (слева направо)
  const sorted = [...items].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x - b.x
  );

  for (const item of sorted) {
    // Найти ключ строки с допуском
    let lineKey = item.y;
    for (const existingY of lines.keys()) {
      if (Math.abs(existingY - item.y) <= lineThreshold) {
        lineKey = existingY;
        break;
      }
    }

    if (!lines.has(lineKey)) lines.set(lineKey, []);
    lines.get(lineKey)!.push(item.str);
  }

  return [...lines.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, words]) => words.join(' '))
    .join('\n');
}
```

### Граничные случаи — где ломается

**Многоколоночный текст.** Алгоритм группировки по Y строкам объединяет текст из разных колонок одной строки. Газетная вёрстка, судебные решения с реквизитами — типичные случаи.

```typescript
// ✅ Для многоколоночных документов — детектировать колонки по X-кластеризации
// перед group by Y
function detectColumns(items: PageText['items'], pageWidth: number): number {
  // Гистограмма X-координат с bin size = pageWidth/10
  const binSize = pageWidth / 10;
  const histogram = new Array(10).fill(0);
  for (const item of items) {
    const bin = Math.min(Math.floor(item.x / binSize), 9);
    histogram[bin]++;
  }
  // Колонки разделены пустыми bin'ами
  const gaps = histogram.filter(h => h === 0).length;
  return gaps + 1; // упрощённая оценка
}
```

**Ротированный текст.** Текст повёрнутый на 90° (боковые подписи таблиц, водяные знаки) имеет нестандартную transform матрицу. При group by Y попадёт не в свою строку.

**Почему это важно архитектору:** Для отправки PDF-текста в LLM качество reconstruction определяет качество ответа. «Правильный» text extraction — не тривиальная задача.

---

## 5. Рендеринг страниц: PDF.js vs PDFium WASM

### Когда нужен рендеринг

- PDF class 2 (image-only) — нет текста, нужен рендер → OCR/VLM
- PDF с битым ToUnicode — рендер надёжнее text extraction
- Верификация визуального содержимого
- Генерация превью/thumbnail

### PDF.js: рендеринг в Node.js через Canvas

```typescript
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas'; // npm: canvas (libcairo binding)

async function renderPageToBuffer(
  pdfBuffer: ArrayBuffer,
  pageNum: number = 1,
  dpi: number = 150
): Promise<Buffer> {
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const page = await pdf.getPage(pageNum);
  const scale = dpi / 72; // PDF native = 72dpi
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(
    Math.round(viewport.width),
    Math.round(viewport.height)
  );
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  // ✅ PNG для текстовых документов (lossless)
  // JPEG для фото-heavy документов (размер меньше)
  return canvas.toBuffer('image/png');
}

// Рендер всех страниц в буферы
async function renderAllPages(
  pdfBuffer: ArrayBuffer,
  dpi: number = 150
): Promise<Buffer[]> {
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const buffers: Buffer[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    buffers.push(await renderPageToBuffer(pdfBuffer, i, dpi));
  }
  return buffers;
}
```

### PDFium WASM: рендеринг без нативных зависимостей

PDF.js требует `canvas` npm пакет — нативный C++ binding (libcairo). PDFium через WASM работает без нативных зависимостей:

```typescript
import { PDFiumLibrary } from '@hyzyla/pdfium';

async function renderWithPdfium(
  pdfBuffer: Uint8Array,
  pageNum: number = 0, // 0-indexed в PDFium
  dpi: number = 150
): Promise<Uint8Array> {
  const library = await PDFiumLibrary.init();
  const doc = await library.loadDocument(pdfBuffer);

  try {
    const page = doc.getPage(pageNum);
    const scale = dpi / 72;

    const width = Math.round(page.width * scale);
    const height = Math.round(page.height * scale);

    // Рендер в RGBA bitmap
    const bitmap = page.render({
      width,
      height,
      scale,
    });

    return bitmap.toUint8ClampedArray(); // raw RGBA
  } finally {
    doc.destroy();
    library.destroy();
  }
}
```

### Сравнение подходов

| Критерий | PDF.js + canvas | PDFium WASM |
|:--|:--|:--|
| Нативные зависимости | ✅ libcairo (npm: canvas) | ❌ только WASM (~10 МБ) |
| Docker совместимость | ⚠️ нужны системные lib | ✅ zero system deps |
| Качество рендеринга | Хорошее | ✅ Отличное (Chrome engine) |
| Размер WASM | — | ~10 МБ холодный старт |
| Скорость инициализации | Быстро | ⚠️ 500ms–1s на init |
| Сложные шрифты / CJK | ✅ | ✅ |
| Поддержка форм | Частичная | ✅ |

**Правило выбора:**
```
Docker + нет нативных зависимостей + качество рендеринга критично → PDFium WASM
Node.js + уже есть canvas в зависимостях + простые документы → PDF.js
```

### Размер изображения для VLM после рендеринга

```typescript
import sharp from 'sharp';

async function renderForVLM(
  pdfBuffer: ArrayBuffer,
  pageNum: number = 1,
  targetMaxDim: number = 1536 // px
): Promise<Buffer> {
  // 1. Рендер при высоком DPI для качества
  const renderDpi = 200;
  const rawPng = await renderPageToBuffer(pdfBuffer, pageNum, renderDpi);

  // 2. Resize под VLM лимит (Модуль 11)
  return sharp(rawPng)
    .resize(targetMaxDim, targetMaxDim, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
```

**Практический вывод для архитектора:** Рендер при 200 DPI, потом resize Sharp до 1536px — оптимальная цепочка для документов с мелким шрифтом. Прямой рендер при 72 DPI → текст нечитаем для VLM.

---

## 6. Метаданные и структура документа

### Два хранилища метаданных

**Info Dictionary** (старый способ):
```typescript
async function getPdfInfo(buffer: ArrayBuffer): Promise<Record<string, string>> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const metadata = await pdf.getMetadata();

  return {
    title: metadata.info?.['Title'] as string ?? '',
    author: metadata.info?.['Author'] as string ?? '',
    creator: metadata.info?.['Creator'] as string ?? '',  // приложение создавшее PDF
    producer: metadata.info?.['Producer'] as string ?? '', // PDF engine
    creationDate: metadata.info?.['CreationDate'] as string ?? '',
    modDate: metadata.info?.['ModDate'] as string ?? '',
    pdfVersion: String((pdf as any)._pdfInfo?.PDFFormatVersion ?? ''),
  };
}
```

**XMP Metadata** (современный способ, XML в PDF stream):
```typescript
const xmpData = metadata.metadata?.getRaw(); // XML строка
// XMP содержит Dublin Core, PDF, XMP базовые схемы
// Более полные метаданные чем Info Dictionary
```

`Creator` — ключевое поле диагностики: `'Microsoft Word'`, `'1C:Enterprise'`, `'Adobe Acrobat'` → разные ожидания по качеству text extraction.

### Outline (Bookmarks)

```typescript
async function getOutline(buffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const outline = await pdf.getOutline();

  if (!outline) return [];

  function flattenOutline(
    items: pdfjs.PDFTreeNode[],
    depth = 0
  ): string[] {
    return items.flatMap(item => [
      '  '.repeat(depth) + item.title,
      ...flattenOutline(item.items ?? [], depth + 1),
    ]);
  }

  return flattenOutline(outline);
}
// Outline = структура документа = потенциальный chunking guide для RAG
```

**Практический вывод для архитектора:** `Creator` + количество страниц + класс (native/image/hybrid) — три поля, определяющих стратегию обработки до чтения текста.

---

## 7. PDF/A и PDF/UA: производственные форматы

### PDF/A — архивный формат

PDF/A — ISO 19005 стандарт для долгосрочного хранения. Запрещает:
- Внешние ссылки и зависимости (все ресурсы встроены)
- Шифрование
- JavaScript
- Некоторые типы сжатия

Важно для архитектора: PDF/A документы **надёжнее** для text extraction — требуют встроенных шрифтов с ToUnicode. Госсектор и банки часто используют PDF/A.

Детектирование:
```typescript
async function isPdfA(buffer: ArrayBuffer): Promise<boolean> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const metadata = await pdf.getMetadata();
  const xmp = metadata.metadata?.getRaw() ?? '';
  // XMP содержит pdfaid:conformance для PDF/A
  return xmp.includes('pdfaid:conformance') || xmp.includes('pdfaSchema');
}
```

### PDF/UA — доступный формат

PDF/UA (ISO 14289) требует структурных тегов (`Tagged PDF`) — логической разметки документа: заголовки, параграфы, таблицы, изображения с alt text.

Tagged PDF открывает возможности недоступные для неразмеченных:
```typescript
// Получить структурное дерево (только для Tagged PDF)
const markInfo = await (pdf as any).getMarkInfo();
if (markInfo?.Marked) {
  // Документ содержит структурные теги
  // Можно извлекать заголовки, таблицы как структурированные данные
}
```

**Практический вывод для архитектора:** Tagged PDF + правильный ToUnicode = высококачественный text extraction с сохранением структуры. Если исходный документ Tagged — используй это. Большинство реальных PDF — неразмечены.

---

## 8. Граничные случаи реального документооборота

### Зашифрованные PDF

```typescript
async function openEncrypted(
  buffer: ArrayBuffer,
  password: string
): Promise<pdfjs.PDFDocumentProxy> {
  try {
    return await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;
  } catch (err: any) {
    if (err.name === 'PasswordException') {
      // PasswordException.CODE: NEED_PASSWORD (1) или INCORRECT_PASSWORD (2)
      throw new Error(
        err.code === 1
          ? 'PDF требует пароль'
          : 'Неверный пароль PDF'
      );
    }
    throw err;
  }
}
```

### Повреждённые и инкрементально обновлённые PDF

PDF поддерживает **incremental updates**: изменения дописываются в конец файла без перезаписи. Каждое обновление — новый xref. При множестве обновлений файл раздувается, а парсеры могут читать устаревшие объекты.

```typescript
// Признаки инкрементальных обновлений
function countIncrementalUpdates(pdfBuffer: Buffer): number {
  // %%EOF встречается столько раз, сколько было обновлений
  let count = 0;
  let pos = 0;
  const marker = Buffer.from('%%EOF');
  while ((pos = pdfBuffer.indexOf(marker, pos)) !== -1) {
    count++;
    pos += marker.length;
  }
  return count;
}
```

### Большие PDF: потоковая обработка

Загрузка 500-страничного PDF полностью в память — типичная ошибка:

```typescript
async function processLargePdf(
  pdfPath: string,
  processPage: (pageNum: number, text: string) => Promise<void>,
  batchSize: number = 10
): Promise<void> {
  const buffer = fs.readFileSync(pdfPath);
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  // ✅ Обрабатывать батчами — не держать все страницы в памяти
  for (let i = 1; i <= pdf.numPages; i += batchSize) {
    const batch = Array.from(
      { length: Math.min(batchSize, pdf.numPages - i + 1) },
      (_, j) => i + j
    );

    await Promise.all(batch.map(async (pageNum) => {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .filter((item): item is pdfjs.TextItem => 'str' in item)
        .map(item => item.str)
        .join('');
      await processPage(pageNum, text);
      page.cleanup(); // ✅ освободить ресурсы страницы
    }));
  }
}
```

### Form fields (AcroForms)

Интерактивные формы в PDF хранят данные отдельно от content stream:

```typescript
async function extractFormFields(
  buffer: ArrayBuffer
): Promise<Record<string, string>> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const fields: Record<string, string> = {};

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const annotations = await page.getAnnotations();

    for (const ann of annotations) {
      if (ann.subtype === 'Widget' && ann.fieldName) {
        // fieldValue может быть строкой, массивом (checkbox), или null
        fields[ann.fieldName] = Array.isArray(ann.fieldValue)
          ? ann.fieldValue.join(', ')
          : String(ann.fieldValue ?? '');
      }
    }
  }

  return fields;
}
```

**Почему это важно архитектору:** Заполненные PDF-формы (налоговые декларации, анкеты) хранят данные в fields, не в text content. Наивный text extraction не извлечёт введённые пользователем значения.

---

## 9. Реальный кейс

> ⚠️ **Раздел ожидает данных от автора.**
> Формат: входные данные → гипотеза → результат → вывод противоречащий интуиции.
> Кандидаты: обработка PDF из российских госсистем (1С, ФНС), парсинг судебных решений, автоматизация договоров.

---

## 10. Антипаттерны

### «PDF с текстом = можно извлечь текст»

**Выглядит правильно:** файл searchable, PDF.js возвращает строку.

**Почему ошибка:** возвращённая строка может быть мусором при битом ToUnicode. Нет автоматической валидации. Для 1С-generated PDF text extraction часто даёт нечитаемый результат при видимо-корректном тексте на странице.

---

### «Рендерить при нативном 72 DPI»

**Выглядит правильно:** PDF native = 72dpi, зачем масштабировать?

**Почему ошибка:** 72 DPI для A4 = 595×842 px. Мелкий шрифт (8–10pt) = 8–10px высотой. VLM и OCR не читают текст меньше ~15px. Минимум для документов — 150 DPI = 1240×1754 px.

---

### «pdf-parse для production pipeline»

**Выглядит правильно:** одна зависимость, простой API, работает.

**Почему ошибка:** `pdf-parse` не поддерживает постраничную обработку с управлением памятью. 500-страничный PDF загружается целиком. Нет доступа к координатам текста. Для production — pdfjs-dist напрямую.

---

### «Игнорировать поле Creator»

**Выглядит правильно:** текст он текст, откуда файл — не важно.

**Почему ошибка:** `Creator: "1C:Enterprise"` → высокая вероятность битого ToUnicode. `Creator: "Microsoft Word"` → надёжный text extraction. Поле Creator = первичная диагностика без чтения контента.

---

### «Обрабатывать форм-данные через text extraction»

**Выглядит правильно:** отрендерить → извлечь текст = получить данные формы.

**Почему ошибка:** form fields могут не рендериться как text content. В content stream значения полей могут отсутствовать — они в AcroForm объектах. Для форм — `page.getAnnotations()`, не `page.getTextContent()`.

---

## Задачи AI-кодеру

**Задача 1 — Классификация и extraction pipeline**

Плохая формулировка:
> «Извлеки текст из PDF»

Хорошая формулировка:
> «Реализуй TypeScript функцию `processPdf(buffer: ArrayBuffer): Promise<PdfResult>`. Тип `PdfResult`: `{ class: 'native-text'|'image-only'|'hybrid', pages: PageResult[], creatorApp: string }`, где `PageResult`: `{ pageNum: number, text: string, hasText: boolean }`. Использовать pdfjs-dist 5.6.x с `useWorkerFetch: false, isEvalSupported: false`. Классификацию определять по среднему числу символов на страницу (< 10 символов = image-only). Для `image-only` и `hybrid` — возвращать `hasText: false` и пустой text. Обработать PasswordException: выбросить Error с message "PDF_ENCRYPTED".»

Формула: тип возврата + логика классификации + граничные случаи (пароль) + версия библиотеки.

---

**Задача 2 — Рендеринг для VLM pipeline**

Плохая формулировка:
> «Конвертируй PDF в изображения»

Хорошая формулировка:
> «Реализуй TypeScript функцию `renderPdfPages(buffer: ArrayBuffer, options: {dpi?: number, maxDimPx?: number, format?: 'webp'|'png'}): Promise<Buffer[]>`. Дефолты: dpi=200, maxDimPx=1536, format='webp'. Pipeline: рендер через pdfjs-dist при заданном dpi (scale = dpi/72) → canvas (npm: canvas) → PNG buffer → Sharp resize (fit: inside, withoutEnlargement: true) до maxDimPx → возврат в указанном формате. WebP quality=85. Возвращать массив буферов (по одному на страницу). Освобождать ресурсы каждой страницы через page.cleanup() после рендера.»

Формула: конкретный pipeline + дефолты + memory management + формат вывода.

---

**Задача 3 — Структурированное извлечение с координатами**

Плохая формулировка:
> «Извлеки текст с позициями»

Хорошая формулировка:
> «Реализуй TypeScript функцию `extractStructuredText(buffer: ArrayBuffer): Promise<StructuredPage[]>`. Тип `StructuredPage`: `{ pageNum: number, width: number, height: number, lines: TextLine[] }`, `TextLine`: `{ text: string, y: number, x: number, fontSize: number, items: TextItem[] }`. Группировать TextItem по строкам: items с |y1 - y2| <= 5px считаются одной строкой. Внутри строки — сортировка по x. Координаты: Y от верха страницы (height - pdfjs_y). fontSize = abs(transform[^3]). Пропускать items с пустым str. Не использовать regexp.»

Формула: полные типы + алгоритм группировки с допуском + система координат + ограничения.

---

## Чеклист архитектора

### Диагностика входящего PDF
- [ ] Определён класс PDF: native-text / image-only / hybrid
- [ ] Проверено поле `Creator` — источник определяет надёжность текста
- [ ] Для 1С и госсистем — ToUnicode диагностика обязательна
- [ ] Наличие пароля обрабатывается явно (PasswordException)

### Text extraction
- [ ] Все `w:r/w:t` → все `str` из всех TextItem параграфа конкатенированы
- [ ] Координатная система учтена: PDF Y от низа → конвертация к Y от верха
- [ ] Многоколоночный текст — детектирован и обработан отдельно
- [ ] Форм-данные (AcroForms) — через `getAnnotations()`, не через `getTextContent()`

### Рендеринг
- [ ] DPI ≥ 150 для документов, ≥ 200 для мелкого шрифта
- [ ] После рендера — Sharp resize до 1536px max перед отправкой в VLM
- [ ] PDFium WASM рассмотрен если canvas нативные зависимости неприемлемы

### Производительность
- [ ] Большие PDF обрабатываются батчами с `page.cleanup()` после каждой страницы
- [ ] Инициализация PDFium WASM (~1s) — вынесена из hot path
- [ ] Количество `%%EOF` проверено для диагностики incremental updates

---

*Модуль 15 завершён.*
*Следующий: [Модуль 16 — PDFium WASM](../16-pdfium-wasm/README.md)*
