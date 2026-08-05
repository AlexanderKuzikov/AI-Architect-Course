# Модуль 17 — Excel / XLSX internals

> **Для AI-архитектора:** XLSX — тот же ZIP с XML что и DOCX, но другая схема. Таблица = данные + формулы + стили + shared strings — четыре независимых слоя. Большинство проблем с Excel в production возникают потому что разработчик работает с высокоуровневым API не понимая что за ним. Когда ExcelJS не справляется с файлом на 300K строк — нужно знать куда смотреть в XML.
> Один день изучения — структура XLSX как контейнера, слои данных, shared strings как главная ловушка производительности, streaming генерация и чтение, формулы, инструменты с trade-offs.

## Содержание

1. [XLSX как ZIP-контейнер](#1-xlsx-как-zip-контейнер)
2. [Слои данных: worksheets, shared strings, styles](#2-слои-данных-worksheets-shared-strings-styles)
3. [Адресация ячеек: A1 vs R1C1 vs row/col индексы](#3-адресация-ячеек-a1-vs-r1c1-vs-rowcol-индексы)
4. [Типы данных и форматирование чисел](#4-типы-данных-и-форматирование-чисел)
5. [Формулы: хранение и вычисление](#5-формулы-хранение-и-вычисление)
6. [ExcelJS: чтение и генерация](#6-exceljs-чтение-и-генерация)
7. [SheetJS: мультиформатный парсинг](#7-sheetjs-мультиформатный-парсинг)
8. [Streaming: большие файлы без OOM](#8-streaming-большие-файлы-без-oom)
9. [Raw XML манипуляция через PizZip](#9-raw-xml-манипуляция-через-pizzip)
10. [Граничные случаи реального документооборота](#10-граничные-случаи-реального-документооборота)
11. [Реальный кейс](#11-реальный-кейс)
12. [Антипаттерны](#12-антипаттерны)
13. [Задачи AI-кодеру](#задачи-ai-кодеру)
14. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

| Инструмент | Версия | Примечание |
|:--|:--|:--|
| Node.js Active LTS | 24.x | март 2026 |
| ExcelJS | 4.4.0 | стабильная; 4.4.1-prerelease.0 в тесте |
| SheetJS (xlsx) | 0.20.3 (CDN/git) | npm пакет `xlsx` заморожен на 0.18.5 — использовать CDN или git |
| node-xlsx | 0.23.x | обёртка над SheetJS, XLSX only |
| PizZip | 3.1.x | raw ZIP манипуляция |
| TypeScript | 5.x | март 2026 |

> ⚠️ **SheetJS npm:** пакет `xlsx` на npm.js не обновлялся с 2022. Актуальная версия распространяется через `https://cdn.sheetjs.com` или `git+https://git.sheetjs.com/sheetjs/sheetjs.git`. Для production — пинить конкретный тег.

---

## 1. XLSX как ZIP-контейнер

### Структура файла

```bash
unzip workbook.xlsx -d workbook_contents/
```

```
workbook.xlsx/
├── [Content_Types].xml              # реестр типов (как в DOCX)
├── _rels/
│   └── .rels                        # корневые relationships
├── xl/
│   ├── workbook.xml                 # ← список листов, именованные диапазоны
│   ├── sharedStrings.xml            # ← ВСЕ строковые значения (централизованно)
│   ├── styles.xml                   # форматы чисел, шрифты, заливки, рамки
│   ├── calcChain.xml                # порядок вычисления формул (опционально)
│   ├── _rels/
│   │   └── workbook.xml.rels        # workbook → sheets, sharedStrings, styles
│   ├── worksheets/
│   │   ├── sheet1.xml               # данные листа 1
│   │   ├── sheet2.xml               # данные листа 2
│   │   └── _rels/
│   │       └── sheet1.xml.rels      # sheet → drawing, hyperlinks и т.д.
│   ├── drawings/
│   │   └── drawing1.xml             # диаграммы, изображения
│   └── theme/
│       └── theme1.xml               # цветовая схема
└── docProps/
    ├── core.xml                     # автор, дата создания
    └── app.xml                      # имя приложения
```

### workbook.xml: карта листов

```xml
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Данные" sheetId="1" r:id="rId1"/>
    <sheet name="Справочник" sheetId="2" r:id="rId2"/>
    <sheet name="Сводная" sheetId="3" state="hidden" r:id="rId3"/>
  </sheets>
  <!-- Именованные диапазоны -->
  <definedNames>
    <definedName name="ТаблицаТоваров">Данные!$A$1:$D$1000</definedName>
  </definedNames>
</workbook>
```

`state="hidden"` — лист скрытый. При парсинге — учитывать, при генерации — намеренно использовать для служебных данных.

**Практический вывод для архитектора:** `xl/sharedStrings.xml` — самый важный файл после самих листов. Для файлов с тысячами уникальных строк он становится узким местом производительности при загрузке целиком в память.

---

## 2. Слои данных: worksheets, shared strings, styles

### sheet1.xml: структура данных

```xml
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

  <!-- Размерность данных: подсказка парсеру -->
  <dimension ref="A1:D1000"/>

  <!-- Столбцы с явными настройками ширины -->
  <cols>
    <col min="1" max="1" width="20" customWidth="1"/>
    <col min="2" max="4" width="12" customWidth="1"/>
  </cols>

  <sheetData>

    <!-- Строка 1 — заголовки -->
    <row r="1" spans="1:4">
      <!-- s="1" — индекс стиля из styles.xml -->
      <c r="A1" t="s" s="1">   <!-- t="s" → значение из sharedStrings -->
        ```
        <v>0</v>                <!-- индекс в sharedStrings: строка "Наименование" -->
        ```
      </c>
      <c r="B1" t="s" s="1">
        ```
        <v>1</v>                <!-- "Количество" -->
        ```
      </c>
      <c r="C1" t="s" s="1">
        ```
        <v>2</v>                <!-- "Цена" -->
        ```
      </c>
      <c r="D1" t="s" s="1">
        ```
        <v>3</v>                <!-- "Сумма" -->
        ```
      </c>
    </row>

    <!-- Строка 2 — данные -->
    <row r="2" spans="1:4">
      <c r="A2" t="s">          <!-- строка из sharedStrings -->
        <v>4</v>
      </c>
      <c r="B2">                <!-- числовое значение (t не указан = число) -->
        <v>100</v>
      </c>
      <c r="C2">
        <v>250.50</v>
      </c>
      <c r="D2">                <!-- формула -->
        <f>B2*C2</f>
        ```
        <v>25050</v>            <!-- кэшированный результат -->
        ```
      </c>
    </row>

  </sheetData>

  <!-- Объединённые ячейки -->
  <mergeCells>
    <mergeCell ref="A1:A2"/>
  </mergeCells>

</worksheet>
```

### Типы ячеек (атрибут t)

| t | Тип | Значение в `<v>` |
|:--|:--|:--|
| (нет) | число | число как строка |
| `s` | shared string | индекс в sharedStrings.xml |
| `str` | formula string | строка-результат формулы |
| `inlineStr` | inline string | текст внутри `<is><t>` |
| `b` | boolean | `1` (true) или `0` (false) |
| `e` | error | `#VALUE!`, `#REF!` и т.д. |
| `d` | date (ISO 8601) | редко используется |

### sharedStrings.xml

```xml
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
     count="1000" uniqueCount="342">
  <!-- Индекс 0 -->
  <si><t>Наименование</t></si>
  <!-- Индекс 1 -->
  <si><t>Количество</t></si>
  <!-- Rich text — несколько runs с форматированием -->
  <si>
    <r><rPr><b/><sz val="12"/></rPr><t>Жирный </t></r>
    <r><t>обычный</t></r>
  </si>
</sst>
```

`count` — общее число использований строк (с повторами).
`uniqueCount` — число уникальных строк в таблице.

При N строках в таблице где каждая строковая ячейка уникальна (UUID, полные имена) — sharedStrings.xml = N записей, бесполезный оверхед. При тысячах повторов одного значения — экономия.

**Практический вывод для архитектора:** При генерации XLSX для экспорта с уникальными значениями в каждой строке — `inlineStr` (t="inlineStr") эффективнее shared strings. ExcelJS по умолчанию использует shared strings — для больших экспортов это замедление.

---

## 3. Адресация ячеек: A1 vs R1C1 vs row/col индексы

### Три системы в одном файле

```typescript
// A1 нотация — в XML и формулах
const a1 = 'B5';     // колонка B, строка 5

// R1C1 — в некоторых формулах (редко)
const r1c1 = 'R5C2'; // row 5, column 2

// Row/col индексы — в API библиотек
// ExcelJS: 1-indexed
// SheetJS: смешанно (A1 + utils)

// Конвертеры — часто нужны в raw XML манипуляции
function colIndexToLetter(col: number): string {
  // col: 1-indexed (A=1, B=2, ...)
  let result = '';
  let n = col;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function letterToColIndex(col: string): number {
  // 'A' → 1, 'Z' → 26, 'AA' → 27
  return col.toUpperCase().split('').reduce(
    (acc, char) => acc * 26 + char.charCodeAt(0) - 64,
    0
  );
}

function a1ToRowCol(a1: string): { row: number; col: number } {
  const match = a1.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid A1: ${a1}`);
  return {
    row: parseInt(match[2]),
    col: letterToColIndex(match[1]),
  };
}

function rowColToA1(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row}`;
}

// Примеры:
// colIndexToLetter(1) → 'A'
// colIndexToLetter(26) → 'Z'
// colIndexToLetter(27) → 'AA'
// colIndexToLetter(703) → 'AAA'
// letterToColIndex('XFD') → 16384 (максимальная колонка Excel)
```

### Лимиты Excel XLSX

```typescript
const EXCEL_LIMITS = {
  maxRows: 1_048_576,    // 2^20
  maxCols: 16_384,       // 2^14 = XFD
  maxSheets: 255,        // теоретически больше, практически Excel ограничивает
  maxCellChars: 32_767,  // символов в ячейке
  maxSheetNameLen: 31,   // символов в имени листа
  forbiddenSheetChars: /[:\\\/?*\[\]]/,  // запрещённые символы в имени листа
} as const;
```

**Практический вывод для архитектора:** При генерации больших XLSX — проверять лимиты программно до начала записи. Попытка записать строку 1 048 577 молча усечёт данные в некоторых библиотеках или выбросит исключение в других.

---

## 4. Типы данных и форматирование чисел

### Числа хранятся как числа

В XLSX нет различия между integer и float на уровне хранения — всё числа IEEE 754 double:

```xml
```
<c r="A1"><v>42</v></c>          <!-- может быть целым или датой -->
```
```
<c r="A2"><v>42005</v></c>       <!-- дата: 42005 дней от 1900-01-01 = 2015-01-01 -->
```
```
<c r="A3"><v>0.5</v></c>         <!-- время: 0.5 = 12:00:00 -->
```
```
<c r="A4"><v>42005.5</v></c>     <!-- дата+время: 2015-01-01 12:00:00 -->
```
```

Отличить число от даты — только по формату в styles.xml.

### styles.xml: числовые форматы

```xml
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

  <!-- Встроенные форматы Excel имеют ID 0-163 (зарезервированы) -->
  <!-- Кастомные форматы начинаются с ID 164 -->
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="DD.MM.YYYY"/>         <!-- русская дата -->
    <numFmt numFmtId="165" formatCode="# ##0.00 ₽"/>         <!-- рубли -->
    <numFmt numFmtId="166" formatCode="DD.MM.YYYY HH:MM:SS"/> <!-- дата+время -->
  </numFmts>

  <!-- xf (format record) = комбинация numFmt + font + fill + border -->
  <cellXfs>
    <xf numFmtId="0"  fontId="0" fillId="0" borderId="0"/>  <!-- индекс 0: General -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0"/> <!-- индекс 1: дата -->
    <xf numFmtId="165" fontId="1" fillId="2" borderId="0"/> <!-- индекс 2: рубли, жирный -->
  </cellXfs>
</styleSheet>
```

### Встроенные числовые форматы (важные)

```typescript
// Форматы где числовое значение = дата
const DATE_FORMAT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22,  // стандартные дата/время
  45, 46, 47,                            // время
  // кастомные определяются по наличию d, m, y, h в formatCode
]);

function isDateFormat(numFmtId: number, formatCode: string): boolean {
  if (DATE_FORMAT_IDS.has(numFmtId)) return true;
  // Эвристика для кастомных форматов
  const cleaned = formatCode
    .replace(/"[^"]*"/g, '')   // убрать строки в кавычках
    .replace(/\[[^\]]*]/g, '') // убрать условные части [...]
    .toLowerCase();
  return /[ymd]/.test(cleaned) && !//.test(cleaned);
}

// Конвертер Excel serial number → Date
function excelDateToJs(serial: number, is1904System = false): Date {
  const offset = is1904System ? 24107 : 25569; // разница эпох
  // Excel ошибочно считает 1900 високосным — поправка
  const corrected = serial > 59 ? serial - 1 : serial;
  return new Date((corrected - offset) * 86400 * 1000);
}

// JS Date → Excel serial
function jsDateToExcel(date: Date, is1904System = false): number {
  const offset = is1904System ? 24107 : 25569;
  const serial = date.getTime() / (86400 * 1000) + offset;
  return serial > 59 ? serial + 1 : serial;
}
```

**Практический вывод для архитектора:** При парсинге XLSX без библиотеки — каждая числовая ячейка требует lookp в styles.xml чтобы определить является ли она датой. Библиотеки делают это автоматически, но часто неверно для кастомных форматов.

---

## 5. Формулы: хранение и вычисление

### Как формулы хранятся

```xml
<!-- Обычная формула -->
<c r="D2">
  <f>B2*C2</f>
  ```
  <v>25050</v>   <!-- кэшированный результат последнего вычисления в Excel -->
  ```
</c>

<!-- Shared formula — экономия XML для однотипных формул -->
<c r="D2">
  <f t="shared" ref="D2:D1000" si="0">B2*C2</f>
  <v>25050</v>
</c>
<!-- Строки 3-1000 ссылаются на shared formula si="0" -->
<c r="D3">
  <f t="shared" si="0"/>  <!-- формула берётся из si=0, адаптируется автоматически -->
  <v>18000</v>
</c>

<!-- Array formula (Ctrl+Shift+Enter) -->
<c r="E2">
  <f t="array" ref="E2:E10">{SUM(B2:B10*C2:C10)}</f>
  <v>143050</v>
</c>
```

### Кэшированные значения vs пересчёт

Node.js не выполняет Excel-формулы. При чтении доступен только кэшированный `<v>`.

```typescript
// ✅ Читать кэш — быстро, работает без Excel
// ❌ Кэш может быть устаревшим если файл открывался сторонним ПО

// Стратегии для формульных ячеек:
type FormulaStrategy = 'cache' | 'skip' | 'recalculate';

// 'cache'       — использовать <v> как есть (дефолт)
// 'skip'        — пропустить ячейки с формулами
// 'recalculate' — требует движка формул (HyperFormula, formulajs)

// Для большинства production задач — 'cache' достаточно
// Если пересчёт нужен — HyperFormula (отдельная библиотека, ~2MB)
```

**Практический вывод для архитектора:** При импорте данных из Excel в систему — никогда не полагаться на формулы. Перед отправкой файла пользователь должен «запечь» формулы в значения (Paste Special → Values). Или парсить кэш и явно документировать это поведение.

---

## 6. ExcelJS: чтение и генерация

### Чтение файла

```typescript
import ExcelJS from 'exceljs';

interface ParsedSheet {
  name: string;
  rows: Record<string, unknown>[];
  headers: string[];
}

async function parseXlsx(filePath: string): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const result: ParsedSheet[] = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.state === 'hidden') continue; // ✅ пропускать скрытые листы

    const headers: string[] = [];
    const rows: Record<string, unknown>[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) {
        // Заголовки из первой строки
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value ?? `col_${colNumber}`);
        });
        return;
      }

      const rowData: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (!header) return;

        // ✅ Обработка типов ExcelJS
        switch (cell.type) {
          case ExcelJS.ValueType.Date:
            rowData[header] = cell.value instanceof Date
              ? cell.value.toISOString()
              : cell.value;
            break;
          case ExcelJS.ValueType.Formula:
            // Брать результат формулы, не саму формулу
            rowData[header] = (cell.value as ExcelJS.CellFormulaValue).result;
            break;
          case ExcelJS.ValueType.Error:
            rowData[header] = null; // #VALUE!, #REF! → null
            break;
          case ExcelJS.ValueType.RichText:
            // Rich text → plain string
            rowData[header] = (cell.value as ExcelJS.CellRichTextValue)
              .richText
              .map(rt => rt.text)
              .join('');
            break;
          default:
            rowData[header] = cell.value;
        }
      });

      if (Object.keys(rowData).length > 0) rows.push(rowData);
    });

    result.push({ name: worksheet.name, rows, headers });
  }

  return result;
}
```

### Генерация с форматированием

```typescript
async function generateReport(
  data: ReportRow[],
  outputPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Architect System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Отчёт', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
    },
  });

  // Закрепить первую строку
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Стили
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
    },
  };

  const currencyFormat = '# ##0.00 ₽';
  const dateFormat = 'DD.MM.YYYY';

  // Колонки
  sheet.columns = [
    { header: 'Дата',         key: 'date',     width: 12 },
    { header: 'Наименование', key: 'name',     width: 30 },
    { header: 'Кол-во',       key: 'qty',      width: 10 },
    { header: 'Цена',         key: 'price',    width: 14 },
    { header: 'Сумма',        key: 'total',    width: 16 },
  ];

  // Применить стиль к заголовкам (строка 1)
  sheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
  sheet.getRow(1).height = 30;

  // Данные
  data.forEach((rowData, idx) => {
    const row = sheet.addRow({
      date: rowData.date,    // Date объект
      name: rowData.name,
      qty: rowData.qty,
      price: rowData.price,
      total: { formula: `C${idx + 2}*D${idx + 2}` }, // формула
    });

    // Форматы ячеек
    row.getCell('date').numFmt = dateFormat;
    row.getCell('price').numFmt = currencyFormat;
    row.getCell('total').numFmt = currencyFormat;

    // Чередующийся фон
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F7FF' },
        };
      });
    }
  });

  // Автофильтр
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  // Итоговая строка
  const lastDataRow = data.length + 1;
  const totalRow = sheet.addRow({
    name: 'ИТОГО',
    qty: { formula: `SUM(C2:C${lastDataRow})` },
    total: { formula: `SUM(E2:E${lastDataRow})` },
  });
  totalRow.font = { bold: true };
  totalRow.getCell('total').numFmt = currencyFormat;

  await workbook.xlsx.writeFile(outputPath);
}
```

### Граничные случаи ExcelJS

**Дата 1900-01-00.** Excel содержит баг: считает 1900 год високосным (29 февраля 1900). Serial number 60 = несуществующая дата. При конвертации через ExcelJS эта дата появляется как 1900-02-28 или вызывает исключение.

**Пустые строки в `eachRow`.** `includeEmpty: true` возвращает строки до последней заполненной. Для разреженных таблиц — медленно. `includeEmpty: false` пропускает пустые строки, но нумерация строк непоследовательна.

**Память при `workbook.xlsx.readFile`.** ExcelJS загружает весь workbook в память. Для файлов >50 MB — использовать streaming API.

---

## 7. SheetJS: мультиформатный парсинг

### Статус npm vs CDN

```typescript
// ❌ npm пакет заморожен на 0.18.5 (2022)
// npm install xlsx  ← не использовать для новых проектов

// ✅ Актуальная версия через CDN (для браузера):
// <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>

// ✅ Для Node.js — через git tag:
// npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

// В package.json:
// "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

### Базовое использование

```typescript
import * as XLSX from 'xlsx';
import * as fs from 'fs';

function parseWithSheetjs(filePath: string): Record<string, unknown>[][] {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,       // ✅ числа-даты → JS Date автоматически
    cellNF: false,          // не парсить числовые форматы (быстрее)
    cellFormula: false,     // не парсить формулы (быстрее)
  });

  const results: Record<string, unknown>[][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    // sheet_to_json: массив объектов, ключи из первой строки
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,    // значение для пустых ячеек
      raw: false,      // форматированные значения (строки) вместо raw чисел
    });

    results.push(data);
  }

  return results;
}

// SheetJS поддерживает 20+ форматов из коробки:
// XLSX, XLS, XLSB, XLSM, CSV, TSV, ODS, Numbers, HTML table...
const SUPPORTED = XLSX.SSF.get_table(); // таблица встроенных числовых форматов
```

### SheetJS vs ExcelJS: матрица выбора

| Критерий | ExcelJS 4.4 | SheetJS 0.20 |
|:--|:--|:--|
| Форматы | XLSX, CSV | ✅ 20+ (XLS, ODS, Numbers...) |
| Streaming read | ✅ нативно | ❌ в память |
| Streaming write | ✅ нативно | ❌ |
| Форматирование | ✅ богатое | Базовое |
| Формулы | Чтение + запись | Чтение (кэш) |
| TypeScript | ✅ встроен | ✅ @types/xlsx |
| npm статус | ✅ активный | ⚠️ CDN-only |
| Размер бандла | ~1.5 МБ | ~0.9 МБ |
| Производительность (large) | ⚠️ streaming нужен | ⚠️ в память |

**Правило выбора:**
```
Нужен только XLSX + streaming + форматирование → ExcelJS
Нужно читать XLS/ODS/Numbers/CSV единым API → SheetJS
Максимальная скорость на большом XLSX → raw XML + streaming SAX
```

---

## 8. Streaming: большие файлы без OOM

### ExcelJS Streaming Reader

```typescript
import ExcelJS from 'exceljs';

async function streamRead(
  filePath: string,
  onRow: (row: Record<string, unknown>, sheetName: string) => Promise<void>
): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',    // ✅ shared strings в LRU кэш (не всё в памяти)
    hyperlinks: 'ignore',      // не парсить гиперссылки
    styles: 'ignore',          // не парсить стили (для данных не нужны)
    entries: 'emit',           // emit событие на каждую запись
  });

  let headers: string[] = [];

  for await (const worksheetReader of workbook) {
    headers = [];

    for await (const row of worksheetReader) {
      if (row.number === 1) {
        // Заголовки
        headers = (row.values as (string | undefined)[])
          .slice(1) // ExcelJS: values = undefined (1-indexed)
          .map((v, i) => String(v ?? `col_${i + 1}`));
        continue;
      }

      const values = row.values as unknown[];
      const rowData: Record<string, unknown> = {};

      headers.forEach((header, i) => {
        rowData[header] = values[i + 1] ?? null;
      });

      await onRow(rowData, worksheetReader.name);
    }
  }
}

// Пример: импорт 300K строк в БД без OOM
async function importLargeFile(filePath: string): Promise<number> {
  let count = 0;
  const batch: Record<string, unknown>[] = [];

  await streamRead(filePath, async (row) => {
    batch.push(row);
    count++;

    if (batch.length >= 1000) {
      await db.insertMany(batch.splice(0)); // bulk insert + очистить batch
    }
  });

  if (batch.length > 0) {
    await db.insertMany(batch);
  }

  return count;
}
```

### ExcelJS Streaming Writer

```typescript
import ExcelJS from 'exceljs';
import * as fs from 'fs';

async function streamWrite(
  outputPath: string,
  dataSource: AsyncIterable<ReportRow>
): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: outputPath,
    useStyles: true,
    useSharedStrings: false, // ✅ отключить shared strings для уникальных данных
  });

  const sheet = workbook.addWorksheet('Данные');

  // Заголовки
  sheet.addRow(['ID', 'Дата', 'Наименование', 'Сумма']).commit();

  let rowCount = 0;
  for await (const row of dataSource) {
    sheet.addRow([
      row.id,
      row.date,
      row.name,
      row.amount,
    ]).commit(); // ✅ commit() немедленно записывает строку в поток

    rowCount++;
    // Нет накопления в памяти — строки сразу пишутся в файл
  }

  await sheet.commit();
  await workbook.commit(); // финализировать ZIP

  console.log(`Записано ${rowCount} строк`);
}
```

### Чистый SAX: максимальная скорость

Когда ExcelJS streaming недостаточно быстр — читать XML напрямую через SAX:

```typescript
import PizZip from 'pizzip';
import { createReadStream } from 'fs';
import * as sax from 'sax';

async function* saxStreamRows(
  filePath: string,
  sheetName: string = 'xl/worksheets/sheet1.xml'
): AsyncGenerator<string[]> {
  const buffer = require('fs').readFileSync(filePath);
  const zip = new PizZip(buffer);
  const sheetXml = zip.file(sheetName)?.asText();
  if (!sheetXml) return;

  // SAX парсер — не загружает весь XML в DOM
  const parser = sax.createStream(true, { lowercase: false });
  const { Readable } = require('stream');

  let inRow = false;
  let inCell = false;
  let inValue = false;
  let currentRow: string[] = [];
  let currentValue = '';
  let currentType = '';

  // Получить shared strings для разрезолвинга индексов
  const ssXml = zip.file('xl/sharedStrings.xml')?.asText() ?? '';
  const sharedStrings = parseSharedStrings(ssXml);

  const rows: string[][] = [];

  await new Promise<void>((resolve, reject) => {
    parser.on('opentag', (node) => {
      if (node.name === 'row') { inRow = true; currentRow = []; }
      if (node.name === 'c')  { inCell = true; currentType = node.attributes['t'] as string ?? ''; currentValue = ''; }
      if (node.name === 'v')  { inValue = true; }
    });

    parser.on('text', (text) => {
      if (inValue) currentValue += text;
    });

    parser.on('closetag', (name) => {
      if (name === 'v') {
        inValue = false;
        if (inCell) {
          const resolved = currentType === 's'
            ? (sharedStrings[parseInt(currentValue)] ?? '')
            : currentValue;
          currentRow.push(resolved);
        }
      }
      if (name === 'c') inCell = false;
      if (name === 'row') {
        inRow = false;
        rows.push([...currentRow]);
      }
    });

    parser.on('end', resolve);
    parser.on('error', reject);

    Readable.from([sheetXml]).pipe(parser);
  });

  yield* rows;
}

function parseSharedStrings(xml: string): string[] {
  // Упрощённый парсер shared strings через regexp — только для демонстрации
  // В production — SAX или xmldom
  return [...xml.matchAll(/<si>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/si>/g)]
    .map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}
```

**Практический вывод для архитектора:** ExcelJS streaming = 50–100K строк/сек, SAX напрямую = 200–500K строк/сек. Для ETL на 1M+ строк — SAX. Для обычного импорта — ExcelJS streaming достаточно.

---

## 9. Raw XML манипуляция через PizZip

### Хирургическое добавление листа

```typescript
import PizZip from 'pizzip';
import * as fs from 'fs';

function addSheetToExisting(
  inputPath: string,
  outputPath: string,
  sheetData: string[][],
  sheetName: string
): void {
  const buffer = fs.readFileSync(inputPath);
  const zip = new PizZip(buffer);

  // 1. Определить следующий sheetId
  const workbookXml = zip.file('xl/workbook.xml')!.asText();
  const existingIds = [...workbookXml.matchAll(/sheetId="(\d+)"/g)]
    .map(m => parseInt(m[1]));
  const newSheetId = Math.max(...existingIds) + 1;
  const newRId = `rId${newSheetId + 10}`; // избегать конфликта с существующими rId

  // 2. Определить путь нового листа
  const sheetPath = `xl/worksheets/sheet${newSheetId}.xml`;

  // 3. Сгенерировать XML листа
  const rows = sheetData.map((row, rowIdx) =>
    `<row r="${rowIdx + 1}">${
      row.map((cell, colIdx) => {
        const addr = `${colIndexToLetter(colIdx + 1)}${rowIdx + 1}`;
        const isNum = typeof cell === 'number' || /^-?\d+(\.\d+)?$/.test(cell);
        if (isNum) {
          ```
          return `<c r="${addr}"><v>${cell}</v></c>`;
          ```
        }
        // ✅ escape XML спецсимволов
        const escaped = String(cell)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        ```
        return `<c r="${addr}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
        ```
      }).join('')
    }</row>`
  ).join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows}</sheetData>
</worksheet>`;

  // 4. Добавить лист в ZIP
  zip.file(sheetPath, sheetXml);

  // 5. Обновить [Content_Types].xml
  const contentTypes = zip.file('[Content_Types].xml')!.asText();
  const updatedCT = contentTypes.replace(
    '</Types>',
    `<Override PartName="/${sheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  );
  zip.file('[Content_Types].xml', updatedCT);

  // 6. Обновить workbook.xml.rels
  const relsPath = 'xl/_rels/workbook.xml.rels';
  const relsXml = zip.file(relsPath)!.asText();
  const updatedRels = relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${newSheetId}.xml"/>
</Relationships>`
  );
  zip.file(relsPath, updatedRels);

  // 7. Добавить лист в workbook.xml
  const sheetNameEscaped = sheetName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
  const updatedWorkbook = workbookXml.replace(
    '</sheets>',
    `<sheet name="${sheetNameEscaped}" sheetId="${newSheetId}" r:id="${newRId}"/>
</sheets>`
  );
  zip.file('xl/workbook.xml', updatedWorkbook);

  // 8. Записать результат
  const output = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(outputPath, output);
}
```

**Практический вывод для архитектора:** Raw ZIP операция добавления листа = 5 файлов: сам sheet XML + Content_Types + workbook.xml + workbook.xml.rels. Пропустить любой → Excel откроет с ошибкой или восстановит файл потеряв лист.

---

## 10. Граничные случаи реального документооборота

### 1С-generated XLSX

```typescript
// 1С генерирует XLSX с рядом особенностей:
const issues1C = [
  'Даты как строки "DD.MM.YYYY" (не числа)',        // не определяются как Date
  'Числа как строки с пробелом: "1 234 567"',        // не парсятся как float
  'Смешанные типы в колонке: числа и строки',        // ломает type inference
  'Merged cells в заголовках',                        // заголовки неполные
  'Несколько строк заголовков (2-3 строки)',          // header detection сложнее
];

// Нормализатор для 1С-строк с числами
function parse1CNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/\s/g, '')    // убрать пробелы как разделители тысяч
    .replace(',', '.');    // русская запятая → точка
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Нормализатор для 1С-дат
function parse1CDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return new Date(`${match[3]}-${match[2]}-${match[1]}`);
}
```

### Защищённые листы

```typescript
// ExcelJS: прочитать данные с защищённого листа можно
// (защита не шифрует данные, только блокирует редактирование в UI)
const worksheet = workbook.getWorksheet('Данные');
if (worksheet.state === 'veryHidden') {
  // veryHidden — лист не виден в Excel UI, только через VBA/код
  // При парсинге — обрабатывать как обычный лист
}

// Снять защиту листа при генерации
worksheet.unprotect();
// Установить защиту
worksheet.protect('password', {
  selectLockedCells: true,
  selectUnlockedCells: true,
});
```

### Большие числа и точность

```typescript
// Excel хранит числа как IEEE 754 double
// Максимальная точность: 15 значимых цифр
// ИНН (12 цифр), банковские счета (20 цифр) — теряют точность!

const inn = 770123456789;   // 12 цифр — OK для double
const account = 40702810100000012345; // 20 цифр — ПОТЕРЯ ТОЧНОСТИ

// При парсинге длинных числовых ячеек (>15 цифр):
// ExcelJS вернёт число с потерей последних цифр

// ✅ Решение: форматировать ячейку как текст в Excel
// ✅ При генерации: передавать как строку с t="inlineStr"
// ❌ Нельзя доверять числовым значениям для ИНН/КПП/счётов
```

### Граничные случаи — где ломается

**Merged cells при streaming.** ExcelJS streaming reader не поддерживает merged cells корректно — ячейки после первой в merge возвращаются пустыми без информации о merge. Для таблиц с мержем в заголовках — читать через обычный (non-streaming) API.

**calcChain.xml после модификации.** При редактировании ячеек с формулами через raw XML — `calcChain.xml` устаревает. Excel пересчитает при открытии, но некоторые валидаторы помечают файл как повреждённый. Безопаснее удалить `calcChain.xml` из ZIP после модификации.

**Почему это важно архитектору:** `calcChain.xml` — опциональный файл. Excel открывает XLSX без него. Удалить при любой программной модификации формул — безопаснее чем поддерживать консистентность.

---

## 11. Реальный кейс

**Задача:** импорт прайс-листов из 1С в WooCommerce. ~50 000 товаров,
еженедельное обновление. 1С выгружает XLSX — 15–25 МБ, 3–5 листов,
смешанные типы данных.

**Стек:** Node.js 24, ExcelJS stream reader + stream writer, PostgreSQL.

**Гипотеза:** ExcelJS streaming reader справится — у него есть
WorkbookReader. 50K строк × 10 колонок = 500K ячеек, должно быть
быстро.

**Что получилось:**

Первая же попытка с `WorkbookReader` упёрлась в shared strings:

```typescript
const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
  sharedStrings: 'cache',    // ← LRU кэш, казалось бы
  styles: 'ignore',
});
```

Причина: 1С генерирует **уникальные строки** для каждой ячейки с
названиями товаров. «Шуруп 5×20 оцинкованный», «Гайка М8
нержавеющая» — каждая строка уникальна. SharedStrings.xml вырос до
12 МБ (50K уникальных строк). LRU кэш с дефолтным размером не
вмещал все строки — cache miss на каждой второй ячейке.

```
WorkbookReader + default cache: ~4 минуты на файл
WorkbookReader + cache увеличен до 100K: ~2.5 минуты
```

**Вторая проблема — числа из 1С как строки.** 1С экспортирует
числа с пробелами как разделителями тысяч: `"1 234.50"`. ExcelJS
читает их как строки. Нужна нормализация:

```typescript
function normalize1CNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  return parseFloat(value.replace(/\s/g, '').replace(',', '.'));
}
```

**Третья проблема — даты.** 1С часто выгружает даты как строки
формата `"15.03.2024"`. Excel с `cellDates: true` умеет парсить
числа-даты, но строки пропускает. Пришлось schema-driven
нормализатор:

```typescript
const COLUMN_SCHEMA = {
  'ID':         { type: 'number' },
  'Наименование': { type: 'string' },
  'Цена':       { type: '1c-number' },   // ← строка с пробелами
  'Остаток':    { type: '1c-number' },
  'Дата_поставки': { type: '1c-date' },  // ← "DD.MM.YYYY"
} as const;
```

**Итоговая архитектура импорта:**

```
XLSX → WorkbookReader (stream, 50K за раз) → chunk 500 → normalize → upsert DB
```

- Streaming чтение: ~2.5 мин (основное время — извлечение из ZIP + парсинг XML)
- Нормализация: ~3 сек на 500 строк
- Bulk upsert (Postgres `ON CONFLICT UPDATE`): ~5 сек на 500 строк
- Total: ~2.5 мин / 50K товаров = ~330 товаров/сек

**Вывод, противоречащий интуиции:**

Shared strings оказались главным узким местом, не сам парсинг XML.
1С-генерация с уникальными строками в каждой ячейке делает shared
strings бесполезными — они только добавляют overhead на lookup.
Решение — `useSharedStrings: false` для ExcelJS Writer при экспорте,
и `sharedStrings: 'cache'` с увеличенным размером для Reader.

Статистика ошибок на первом прогоне 50K товаров:

| Тип ошибки | Количество | Причина |
|-----------|-----------|---------|
| Цена с буквой | 3 | Оппечатка в 1С |
| Пустая строка | 47 | Товар снят с производства |
| Дата вне диапазона | 1 | "31.02.2024" |
| Null вместо числа | 12 | Цена не указана |

Все ошибки обработаны через `batch.errors` — ни одна не уронила пайплайн.

---

## 12. Антипаттерны

### «npm install xlsx для нового проекта»

**Выглядит правильно:** популярная библиотека, миллионы загрузок.

**Почему ошибка:** npm пакет `xlsx` заморожен на версии 0.18.5 с 2022 года. Разработчики перешли на CDN-распространение. Устанавливать через CDN URL или git tag — не через `npm install xlsx`.

---

### «Читать весь 200MB XLSX в workbook.xlsx.readFile»

**Выглядит правильно:** простой API, одна строка кода.

**Почему ошибка:** ExcelJS загружает весь workbook в память. 200 МБ XLSX → 600–800 МБ RSS. Node.js OOM killer убьёт процесс без предупреждения. Для файлов >30 МБ — streaming API.

---

### «Доверять числам в ячейках ИНН/счётов»

**Выглядит правильно:** ExcelJS вернул число, число выглядит правильно.

**Почему ошибка:** IEEE 754 double хранит максимум 15 значимых цифр. Банковский счёт (20 цифр) возвращается с обнулёнными последними 5 цифрами. ИНН (12 цифр) в границах точности, но КПП + ИНН как одно число — уже нет. Всегда читать как строку при `t="s"` или `t="inlineStr"`.

---

### «Не удалять calcChain.xml после модификации формул»

**Выглядит правильно:** файл есть — пусть остаётся.

**Почему ошибка:** calcChain.xml содержит порядок вычисления ячеек с формулами. После программной вставки/удаления строк с формулами — chain устаревает. Excel 2016+ исправляет это при открытии, но LibreOffice и некоторые валидаторы отмечают как corrupt. Удалять из ZIP при любой модификации.

---

### «Использовать shared strings для уникальных значений»

**Выглядит правильно:** ExcelJS использует shared strings по умолчанию.

**Почему ошибка:** shared strings эффективны при повторяющихся значениях. При генерации таблицы с уникальными UUID или полными именами в каждой строке — sharedStrings.xml разрастается до размера всего контента, плюс оверхед на построение индекса. `useSharedStrings: false` в WorkbookWriter для данных с высокой уникальностью.

---

## Задачи AI-кодеру

**Задача 1 — Streaming импорт с нормализацией**

Плохая формулировка:
> «Прочитай большой Excel файл»

Хорошая формулировка:
> «Реализуй TypeScript функцию `streamImportXlsx(filePath: string, schema: ColumnSchema[], onBatch: (rows: NormalizedRow[]) => Promise<void>, batchSize?: number): Promise<ImportStats>`. Тип `ColumnSchema`: `{key: string, col: number, type: 'string'|'number'|'date'|'1c-number'|'1c-date'}`. Тип `ImportStats`: `{total: number, errors: number, sheets: string[]}`. Использовать ExcelJS 4.4.0 WorkbookReader с `sharedStrings:'cache', styles:'ignore'`. Нормализация типов: '1c-number' — убрать пробелы + заменить запятую на точку; '1c-date' — парсить "DD.MM.YYYY". Ошибку нормализации — логировать в stats.errors, строку не пропускать (заменить поле на null). batchSize дефолт: 500. Первую строку считать заголовками — пропускать.»

Формула: schema-driven нормализация + batch + error stats без прерывания.

---

**Задача 2 — Streaming экспорт каталога**

Плохая формулировка:
> «Сгенерируй Excel с товарами»

Хорошая формулировка:
> «Реализуй TypeScript функцию `exportCatalogXlsx(products: AsyncIterable<Product>, outputPath: string): Promise<{rows: number, sizeBytes: number}>`. Тип `Product`: `{id: number, sku: string, name: string, price: number, stock: number, updatedAt: Date}`. Использовать ExcelJS 4.4.0 WorkbookWriter с `useSharedStrings: false, useStyles: true`. Заголовочная строка: жирный шрифт, фон #2F5496, белый текст. Числовой формат для price: "# ##0.00 ₽". Формат даты для updatedAt: "DD.MM.YYYY HH:MM". Каждую строку commit() сразу после addRow(). Закрепить первую строку (frozen). Вернуть число записанных строк и размер файла через fs.stat.»

Формула: streaming + стили + форматы + commit per row + возврат метрик.

---

**Задача 3 — Хирургическое добавление листа**

Плохая формулировка:
> «Добавь лист в существующий Excel»

Хорошая формулировка:
> «Реализуй TypeScript функцию `appendSheet(inputBuffer: Buffer, sheetName: string, data: (string|number|Date|null)[][]): Buffer`. Использовать PizZip 3.x. Алгоритм: 1) определить следующий sheetId через max существующих sheetId из workbook.xml; 2) сгенерировать sheet XML с inlineStr для строк (не shared strings), числами без типа, датами как ISO строками в inlineStr; 3) обновить [Content_Types].xml, xl/_rels/workbook.xml.rels, xl/workbook.xml; 4) удалить xl/calcChain.xml если присутствует; 5) сгенерировать ZIP с DEFLATE compression level 6. XML спецсимволы (&, <, >, ") — экранировать во всех строках. sheetName длиннее 31 символа — обрезать. Вернуть Buffer.»

Формула: точный алгоритм + 5 шагов явно + экранирование + edge cases (calcChain, длинное имя).

---

## Чеклист архитектора

### Парсинг
- [ ] Файл >30 МБ → streaming WorkbookReader, не `readFile`
- [ ] Числовые ячейки для ИНН/счётов — читать как строки (type check)
- [ ] Даты из 1С — нормализовать через DD.MM.YYYY парсер
- [ ] Числа из 1С — убирать пробелы и заменять запятую
- [ ] Скрытые и veryHidden листы — обрабатывать явно или игнорировать по правилу
- [ ] Формульные ячейки — использовать кэш `result`, не формулу

### Генерация
- [ ] Streaming write (`WorkbookWriter`) для >10K строк
- [ ] `useSharedStrings: false` при высокой уникальности строк
- [ ] `commit()` после каждой строки в streaming режиме
- [ ] Числовые форматы явно указаны (даты, валюты)
- [ ] Лимиты Excel проверены: maxRows=1048576, maxCols=16384, имя листа ≤31 символ

### Raw XML
- [ ] При модификации — обновить все 3 файла: sheet XML + Content_Types + .rels
- [ ] `calcChain.xml` удалён из ZIP при изменении формул
- [ ] XML спецсимволы экранированы во всех пользовательских данных
- [ ] SheetJS: использовать CDN URL / git tag, не npm `xlsx`

---

*Модуль 17 завершён.*
*Следующий: [Модуль 18 — Очереди задач и фоновая обработка](../18-task-queues/README.md)*
