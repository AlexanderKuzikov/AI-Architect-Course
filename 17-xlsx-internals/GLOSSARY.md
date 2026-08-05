# GLOSSARY — Excel / XLSX internals

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**A1 нотация**  
Система адресации ячеек Excel: буква(ы) колонки + номер строки. `A1` — первая ячейка, `XFD1048576` — последняя. Используется в XML атрибутах (`r="B5"`), формулах и именованных диапазонах. Максимальная колонка: XFD (16 384).

**autoFilter**  
Атрибут листа XLSX включающий выпадающие фильтры в заголовочной строке. В ExcelJS: `worksheet.autoFilter = { from: {row,column}, to: {row,column} }`. Хранится как `<autoFilter ref="A1:D1"/>` в sheet XML.

---

## B

**Boolean (t="b")**  
Тип ячейки XLSX. Значение в `<v>`: `1` (true) или `0` (false). ExcelJS возвращает как JavaScript boolean. При парсинге — не путать с числами: `t="b"` явно указан в XML.

---

## C

**calcChain.xml**  
Опциональный файл XLSX хранящий порядок вычисления формул для оптимизации пересчёта. При программной модификации ячеек с формулами — устаревает. Excel пересчитывает при открытии, но LibreOffice может выдать ошибку. Безопасная стратегия: удалять из ZIP при любой программной модификации.

**cellDates**  
Опция SheetJS при чтении: `{ cellDates: true }`. Автоматически конвертирует числовые ячейки с датовыми форматами в JavaScript `Date` объекты. Без этой опции — возвращаются сырые serial numbers.

**col index (1-indexed)**  
Числовой индекс колонки начиная с 1. A=1, B=2, Z=26, AA=27, XFD=16384. ExcelJS использует 1-indexed col/row API. Конвертация: `colIndexToLetter(n)` / `letterToColIndex(str)`.

**commit()**  
Метод ExcelJS WorkbookWriter и WorksheetWriter. После вызова строка или лист немедленно записывается в выходной поток и освобождается из памяти. Без `commit()` — строки накапливаются в памяти, теряется смысл streaming.

**Content_Types.xml**  
Корневой файл OOXML контейнера. Реестр всех частей ZIP с их MIME типами. При добавлении нового листа через raw ZIP — обязательно добавить запись `<Override PartName="/xl/worksheets/sheetN.xml" ContentType="...worksheet+xml"/>`.

---

## D

**definedName**  
Именованный диапазон в `workbook.xml`. Пример: `<definedName name="ТаблицаТоваров">Данные!$A$1:$D$1000</definedName>`. Используется в формулах вместо прямых ссылок. При парсинге — помогает находить таблицы данных без знания конкретных координат.

**dimension**  
Атрибут sheet XML: `<dimension ref="A1:D1000"/>`. Подсказка парсеру о размерности данных. Некоторые генераторы (включая 1С) указывают некорректный dimension — парсер должен определять реальные границы данных самостоятельно.

---

## E

**ExcelJS**  
Node.js библиотека для чтения и генерации XLSX/CSV. Версия 4.4.0 (март 2026). Поддерживает streaming read/write, форматирование, формулы, изображения. Единственная активно поддерживаемая XLSX библиотека на npm с полным streaming API.

**ExcelJS ValueType**  
Enum типов значений ячеек в ExcelJS API: `Null`, `Merge`, `Number`, `String`, `Date`, `Hyperlink`, `Formula`, `SharedString`, `RichText`, `Boolean`, `Error`. Используется в `switch (cell.type)` при нормализации.

---

## F

**f (formula element)**  
XML элемент `<f>` внутри `<c>` содержащий формулу ячейки. Атрибуты: `t` (тип: `shared`, `array`, или обычная), `ref` (диапазон для shared formula), `si` (индекс shared formula). При отсутствии `t` — обычная формула.

**fit: inside**  
Параметр Sharp resize. Масштабирует изображение чтобы оно полностью вошло в заданные размеры сохраняя пропорции. Аналог в Excel не применим — термин из контекста VLM pipeline модулей 15–16.

**frozen (view)**  
Закреплённые строки/столбцы в Excel. В ExcelJS: `worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]`. В sheet XML: `<sheetView><pane ySplit="1" state="frozen"/></sheetView>`. Первая строка остаётся видимой при прокрутке.

---

## H

**header row**  
Первая строка листа используемая как ключи при `XLSX.utils.sheet_to_json()` (SheetJS) и при ручном парсинге. При multiple header rows (2–3 строки заголовков как в 1С) — стандартные API не справляются, нужен кастомный парсер.

---

## I

**IEEE 754 double**  
Формат хранения всех чисел в XLSX. 64-битное число с плавающей точкой. Максимальная точность: 15 значимых цифр. Числа с >15 цифрами (банковские счета 20 цифр) теряют точность при хранении. Требует особой обработки при работе с ИНН, КПП, расчётными счетами.

**inlineStr (t="inlineStr")**  
Тип ячейки XLSX: строка хранится прямо в cell XML через `<is><t>текст</t></is>`. Альтернатива shared strings. Эффективнее при уникальных значениях (нет оверхеда sharedStrings индекса). При `useSharedStrings: false` ExcelJS использует inlineStr.

---

## M

**mergeCell**  
XML элемент `<mergeCell ref="A1:C1"/>` в секции `<mergeCells>`. Объединяет диапазон ячеек. Значение хранится только в верхней левой ячейке диапазона. ExcelJS streaming reader не поддерживает mergeCells корректно.

---

## N

**node-xlsx**  
npm обёртка над SheetJS специализированная на XLSX формате. Версия 0.23.x (март 2026). Проще API чем SheetJS напрямую, но те же ограничения: нет streaming, весь файл в памяти.

**numFmt / numFmtId**  
Числовой формат ячейки. `numFmtId` 0–163 — встроенные форматы Excel (зарезервированы). ID ≥164 — кастомные форматы из `<numFmts>` в styles.xml. Ключевой для детекции дат: форматы с `d`, `m`, `y` в `formatCode` — датовые.

---

## O

**OOXML (Office Open XML)**  
Стандарт ISO/IEC 29500. Формат Microsoft Office документов: DOCX, XLSX, PPTX. Каждый файл = ZIP архив с XML содержимым. XLSX использует схему SpreadsheetML.

---

## P

**PizZip**  
npm библиотека для raw ZIP манипуляции без нативных зависимостей. Версия 3.1.x (март 2026). Используется для хирургических операций с OOXML: добавление листов, замена XML фрагментов без полной перегенерации файла. Форк JSZip оптимизированный для синхронных операций.

---

## R

**R1C1 нотация**  
Альтернативная система адресации: `R5C2` = строка 5, колонка 2. Используется в некоторых Excel формулах и VBA. В XLSX XML встречается редко — A1 нотация стандартна.

**RichText**  
Ячейка XLSX с несколькими runs разного форматирования. В XML shared strings: `<si><r><rPr><b/></rPr><t>жирный</t></r><r><t> обычный</t></r></si>`. ExcelJS возвращает как `CellRichTextValue` с массивом `richText`. При нормализации — конкатенировать `.text` из всех runs.

**row (r attribute)**  
Атрибут XML элемента `<row r="5">` — номер строки (1-indexed). Атрибут `spans` — диапазон колонок в строке для оптимизации парсинга: `spans="1:4"`.

---

## S

**SAX парсер**  
Событийный XML парсер: вместо построения DOM дерева — вызывает callbacks на каждый тег. Для XLSX sheet XML с 1M+ строк — единственный способ обработки без загрузки всего XML в память. В Node.js: npm пакет `sax`.

**serial number (Excel date)**  
Числовое представление даты в Excel: количество дней от 1 января 1900 (с багом: 1900 считается високосным, serial 60 = несуществующая дата). Например: 45292 = 2024-01-01. Конвертация: `(serial - 25569) * 86400 * 1000` миллисекунд от Unix epoch.

**sharedStrings.xml**  
Централизованный реестр строковых значений XLSX. Все текстовые ячейки с `t="s"` хранят индекс в этот файл, не сам текст. Эффективен при повторяющихся строках. Узкое место производительности при загрузке больших файлов с уникальными значениями.

**sheetId**  
Уникальный числовой идентификатор листа в `workbook.xml`: `<sheet sheetId="3" .../>`. Не совпадает с порядковым номером листа. При добавлении листа через raw XML — новый sheetId = max(существующих) + 1.

**SheetJS**  
Мультиформатная JavaScript библиотека для работы с таблицами. Поддерживает XLSX, XLS, ODS, Numbers, CSV и 20+ других форматов. npm пакет `xlsx` заморожен на 0.18.5 (2022). Актуальная версия 0.20.3 — через CDN URL или git tag.

**SpreadsheetML**  
XML схема Microsoft для XLSX (`http://schemas.openxmlformats.org/spreadsheetml/2006/main`). Определяет структуру workbook.xml, sheet XML, styles.xml и sharedStrings.xml.

**styles.xml**  
Файл XLSX хранящий все стили ячеек. Структура: `numFmts` (числовые форматы) + `fonts` + `fills` + `borders` + `cellXfs` (комбинации). Индекс стиля ячейки — атрибут `s` в `<c s="2">`. Для детекции дат — обязателен lookup numFmtId из cellXfs.

---

## T

**t attribute**  
Атрибут XML элемента `<c t="s">` — тип значения ячейки. Отсутствие атрибута = число. `s` = shared string. `str` = строковый результат формулы. `inlineStr` = inline строка. `b` = boolean. `e` = error. `d` = ISO 8601 дата (редко).

---

## U

**useSharedStrings**  
Опция ExcelJS WorkbookWriter. `false` — записывать строки как inlineStr без построения sharedStrings индекса. Ускоряет генерацию при уникальных строках (UUID, имена). `true` (дефолт) — shared strings, эффективнее при повторяющихся значениях.

---

## V

**v (value element)**  
XML элемент `<v>` внутри `<c>` хранящий значение ячейки или кэшированный результат формулы. Для `t="s"` — числовой индекс в sharedStrings. Для чисел и дат — число как строка. Для `t="b"` — `0` или `1`.

**veryHidden**  
Состояние листа XLSX. `state="veryHidden"` — лист скрыт и недоступен через меню Excel, виден только через VBA или программный API. Отличается от `state="hidden"` который пользователь может отобразить через UI. При парсинге — обрабатывать наравне с обычными листами.

---

## W

**WorkbookReader**  
ExcelJS класс для streaming чтения XLSX. `new ExcelJS.stream.xlsx.WorkbookReader(filePath, options)`. Итерируется через `for await...of` по листам, затем по строкам. Опция `sharedStrings: 'cache'` — LRU кэш вместо полной загрузки.

**WorkbookWriter**  
ExcelJS класс для streaming записи XLSX. `new ExcelJS.stream.xlsx.WorkbookWriter({ filename, useStyles, useSharedStrings })`. Строки записываются немедленно при вызове `row.commit()`. Финализация через `workbook.commit()`.

---

## X

**xf (cell format)**  
Запись в `<cellXfs>` styles.xml. Комбинирует: `numFmtId` (числовой формат) + `fontId` + `fillId` + `borderId`. Индекс xf = значение атрибута `s` ячейки. Lookup: `cell.s → cellXfs[s].numFmtId → numFmts → formatCode`.

**xl/_rels/workbook.xml.rels**  
Файл relationships для workbook.xml. Связывает rId идентификаторы с физическими путями файлов: sheets, sharedStrings, styles. При добавлении листа через raw XML — обязательно добавить `<Relationship Id="rId..." Type="...worksheet" Target="worksheets/sheetN.xml"/>`.

---

## З

**Заморозка строк** → см. *frozen (view)*

---

## И

**Именованный диапазон** → см. *definedName*

**Инлайн строка** → см. *inlineStr*

---

## О

**Общие строки** → см. *sharedStrings.xml*

---

## С

**Серийный номер даты** → см. *serial number (Excel date)*

---

*Глоссарий модуля 17. Следующий: [Модуль 18 — Очереди задач и фоновая обработка](../18-task-queues/GLOSSARY.md)*