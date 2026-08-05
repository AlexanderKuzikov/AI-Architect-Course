# Модуль 14 — OOXML: raw XML внутри DOCX

> **Для AI-архитектора:** DOCX — это ZIP-архив с XML внутри. Библиотеки типа `docx` или `python-docx` — абстракции над этим XML, удобные но ограниченные. Когда нужно вставить кастомный стиль, трекинг изменений, сложную таблицу или поле с формулой — придётся идти в raw XML. Понимание структуры OOXML — фундамент любой серьёзной работы с документооборотом.
> Один день изучения — структура DOCX как контейнера, Word ML XML, прямая манипуляция через PizZip, граничные случаи при генерации и парсинге.

## Содержание

1. [DOCX как ZIP-контейнер](#1-docx-как-zip-контейнер)
2. [Структура Word ML XML](#2-структура-word-ml-xml)
3. [Namespaces и relationships](#3-namespaces-и-relationships)
4. [Стили и темы](#4-стили-и-темы)
5. [Прямая XML манипуляция через PizZip](#5-прямая-xml-манипуляция-через-pizzip)
6. [Шаблонизация через docxtemplater](#6-шаблонизация-через-docxtemplater)
7. [Генерация DOCX через docx npm](#7-генерация-docx-через-docx-npm)
8. [Парсинг и извлечение текста](#8-парсинг-и-извлечение-текста)
9. [Граничные случаи промышленного документооборота](#9-граничные-случаи-промышленного-документооборота)
10. [Реальный кейс](#10-реальный-кейс)
11. [Антипаттерны](#11-антипаттерны)
12. [Задачи AI-кодеру](#задачи-ai-кодеру)
13. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

| Инструмент | Версия | Дата проверки |
|:--|:--|:--|
| Node.js Active LTS | 24.x | март 2026 |
| docx (npm) | 9.5.1 | март 2026 |
| docxtemplater | 3.66.3 | март 2026 |
| PizZip | 3.1.x | март 2026 |
| python-docx | 1.1.x | март 2026 |
| ECMA-376 (OOXML стандарт) | 5th Edition | актуален |

---

## 1. DOCX как ZIP-контейнер

### Механика

DOCX — это обычный ZIP-архив с расширением `.docx`. Внутри — иерархия XML файлов и медиаресурсов:

```bash
# Распаковать любой .docx как ZIP
unzip document.docx -d document_contents/
```

```
document.docx/
├── [Content_Types].xml          # реестр типов содержимого
├── _rels/
│   └── .rels                   # корневые relationships
├── word/
│   ├── document.xml             # ← ОСНОВНОЙ ФАЙЛ: тело документа
│   ├── styles.xml               # определения стилей
│   ├── settings.xml             # настройки документа
│   ├── theme/
│   │   └── theme1.xml           # цветовая схема, шрифты
│   ├── _rels/
│   │   └── document.xml.rels    # связи document.xml → ресурсы
│   ├── media/
│   │   ├── image1.png           # изображения
│   │   └── image2.jpeg
│   ├── header1.xml              # колонтитулы (если есть)
│   ├── footer1.xml
│   └── numbering.xml            # определения списков
└── docProps/
    ├── core.xml                 # метаданные: автор, дата
    └── app.xml                  # метаданные приложения
```

### Точка входа: [Content_Types].xml

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels"
    ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"
    ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
```

Этот файл — карта: какой XML файл какого типа. При добавлении нового ресурса (картинки, части документа) — нужно регистрировать здесь. Если не зарегистрировать — Word откроет файл с предупреждением или откажется открывать.

**Практический вывод для архитектора:** Любая операция добавления ресурса в DOCX = минимум три файла: сам ресурс + запись в `[Content_Types].xml` + запись в соответствующем `.rels` файле. Библиотеки делают это за тебя. При raw XML манипуляции — твоя ответственность.

---

## 2. Структура Word ML XML

### Иерархия элементов document.xml

```xml
<w:document xmlns:wpc="..." xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ...>
  <w:body>

    <!-- Параграф -->
    <w:p>
      <w:pPr>                        <!-- Свойства параграфа -->
        <w:pStyle w:val="Heading1"/> <!-- Применить стиль -->
        <w:jc w:val="center"/>       <!-- Выравнивание -->
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>

      <!-- Run — атомарная единица форматированного текста -->
      <w:r>
        <w:rPr>                      <!-- Свойства run -->
          <w:b/>                     <!-- Bold -->
          <w:color w:val="FF0000"/>  <!-- Цвет -->
          <w:sz w:val="28"/>         <!-- Размер: 28 half-points = 14pt -->
        </w:rPr>
        <w:t xml:space="preserve">Текст параграфа </w:t>
      </w:r>

      <!-- Несколько runs в одном параграфе = разное форматирование -->
      <w:r>
        <w:rPr><w:i/></w:rPr>
        <w:t>курсивная часть</w:t>
      </w:r>
    </w:p>

    <!-- Таблица -->
    <w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="5000" w:type="pct"/> <!-- 100% ширины страницы -->
      </w:tblPr>
      <w:tr>                             <!-- Table Row -->
        <w:tc>                           <!-- Table Cell -->
          <w:tcPr>
            <w:tcW w:w="2500" w:type="pct"/>
          </w:tcPr>
          <w:p><w:r><w:t>Ячейка 1</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>Ячейка 2</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Обязательный финальный параграф — нельзя удалять -->
    <w:sectPr>                           <!-- Секция: поля, ориентация -->
      <w:pgSz w:w="12240" w:h="15840"/> <!-- Letter: 8.5" × 11" в twips -->
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800"/>
    </w:sectPr>

  </w:body>
</w:document>
```

### Единицы измерения OOXML

OOXML использует несколько единиц — это частый источник ошибок:

| Единица | Название | Значение | Где используется |
|:--|:--|:--|:--|
| twip | twentieth of a point | 1/1440 дюйма | поля страницы, отступы |
| half-point | — | 1/144 дюйма | размер шрифта (`w:sz`) |
| EMU | English Metric Unit | 1/914400 дюйма | размеры изображений |
| pt | point | 1/72 дюйма | человеческий стандарт |

```typescript
// Конвертеры
const mm2twip = (mm: number) => Math.round(mm * 56.6929);
const pt2halfpoint = (pt: number) => pt * 2;         // w:sz="28" = 14pt
const px2emu = (px: number) => Math.round(px * 9525); // 96dpi
const cm2twip = (cm: number) => Math.round(cm * 566.929);
```

### Критичные элементы которые нельзя пропустить

**`xml:space="preserve"`** на `w:t`:
```xml
<!-- ❌ Пробелы в начале/конце будут обрезаны XML-парсером -->
<w:t> Текст со значимыми пробелами </w:t>

<!-- ✅ Сохраняет пробелы -->
<w:t xml:space="preserve"> Текст со значимыми пробелами </w:t>
```

**Финальный `w:sectPr`** — последний элемент в `w:body`. Word требует его наличия. Удаление или перемещение = повреждённый документ.

**Пустые параграфы между элементами** — не просто визуальные отступы. Это полноценные `w:p` элементы. Таблица без пустого параграфа после неё может вести себя непредсказуемо.

**Практический вывод для архитектора:** Run (`w:r`) — атомарная единица. Один параграф = множество runs с разным форматированием. При парсинге текста — конкатенировать все `w:t` внутри параграфа, не брать первый.

---

## 3. Namespaces и relationships

### XML Namespaces в OOXML

OOXML использует десятки namespace-префиксов. Критичные:

```xml
xmlns:w   = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
xmlns:r   = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
xmlns:wp  = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
xmlns:a   = "http://schemas.openxmlformats.org/drawingml/2006/main"
xmlns:pic = "http://schemas.openxmlformats.org/drawingml/2006/picture"
xmlns:mc  = "http://schemas.openxmlformats.org/markup-compatibility/2006"
```

При парсинге через DOM/XPath — нужно регистрировать namespace resolver. Иначе запросы типа `//w:p` не найдут ничего.

```typescript
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { select } from 'xpath';

const doc = new DOMParser().parseFromString(xmlString, 'text/xml');

// ✅ Namespace resolver обязателен
const nsResolver = {
  lookupNamespaceURI: (prefix: string) => {
    const ns: Record<string, string> = {
      w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    };
    return ns[prefix] ?? null;
  }
};

// XPath с namespace
const paragraphs = select('//w:p', doc, true);
const textNodes = select('//w:t/text()', doc);
```

### Relationships (.rels)

Каждый XML файл, ссылающийся на внешние ресурсы, имеет парный `.rels` файл:

```xml
<!-- word/_rels/document.xml.rels -->
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

  <!-- Ссылка на стили -->
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>

  <!-- Ссылка на изображение -->
  <Relationship Id="rId2"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
    Target="media/image1.png"/>

  <!-- Внешняя гиперссылка -->
  <Relationship Id="rId3"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
    Target="https://example.com"
    TargetMode="External"/>

</Relationships>
```

В `document.xml` на изображение ссылаются по `r:id`:
```xml
<a:blip r:embed="rId2"/>  <!-- rId2 → media/image1.png -->
```

При добавлении любого ресурса — присвоить уникальный `rId` и добавить в `.rels`. `rId` должны быть уникальны внутри одного файла, но не глобально.

**Практический вывод для архитектора:** Relationship ID — это ключ связи внутри ZIP. При слиянии двух документов (merge) ID неизбежно конфликтуют — нужна перенумерация. Это главный источник ошибок при программном объединении DOCX.

---

## 4. Стили и темы

### styles.xml: два уровня стилей

OOXML разделяет **именованные стили** (styles.xml) и **прямое форматирование** (inline в document.xml):

```xml
<!-- styles.xml — определение стиля -->
<w:style w:type="paragraph" w:styleId="Heading1">
  <w:name w:val="heading 1"/>
  <w:basedOn w:val="Normal"/>
  <w:pPr>
    <w:outlineLvl w:val="0"/>
    <w:spacing w:before="480" w:after="0"/>
  </w:pPr>
  <w:rPr>
    <w:b/>
    <w:sz w:val="32"/>  <!-- 16pt -->
    <w:color w:val="2F5496"/>
  </w:rPr>
</w:style>
```

```xml
<!-- document.xml — применение стиля к параграфу -->
<w:p>
  <w:pPr>
    <w:pStyle w:val="Heading1"/>  <!-- ссылка по styleId -->
    <!-- Inline overrides — применяются поверх стиля -->
    <w:jc w:val="right"/>
  </w:pPr>
  <w:r><w:t>Заголовок</w:t></w:r>
</w:p>
```

Приоритет форматирования (от низшего к высшему):
```
Document defaults → Table style → Paragraph style → Run style → Direct formatting
```

Прямое форматирование всегда побеждает. Это значит: если модель сгенерировала XML с inline-форматированием поверх стиля — пользователь не сможет сменить стиль и увидеть эффект.

### Дефолтные стили которые должны присутствовать

При создании DOCX с нуля (без шаблона) — Word ожидает наличия минимального набора стилей. Их отсутствие не ломает файл, но вызывает предупреждения:

```typescript
const requiredStyles = [
  'Normal',        // базовый стиль параграфа
  'DefaultParagraphFont', // базовый стиль run
  'TableNormal',   // базовый стиль таблицы
];
// ✅ Проще использовать шаблон с пустым документом Word как основу,
//    чем генерировать styles.xml с нуля
```

**Практический вывод для архитектора:** Для генерации DOCX всегда начинай с реального шаблона-пустышки созданного в Word, а не генерируй styles.xml программно. Это гарантирует совместимость. Шаблон-пустышка = 15 KB ZIP с корректными дефолтными стилями.

---

## 5. Прямая XML манипуляция через PizZip

### Когда нужен raw XML

- Вставка трекинга изменений (`w:ins`, `w:del`)
- Сложные таблицы с мержем ячеек (`w:vMerge`, `w:gridSpan`)
- Поля (`w:fldChar`, формулы, оглавление)
- Комментарии и аннотации
- Кастомные свойства документа

### Базовый toolkit: чтение и запись

```typescript
import PizZip from 'pizzip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as fs from 'fs';

class DocxEditor {
  private zip: PizZip;

  constructor(buffer: Buffer) {
    this.zip = new PizZip(buffer);
  }

  static fromFile(path: string): DocxEditor {
    return new DocxEditor(fs.readFileSync(path));
  }

  getXml(partPath: string): string {
    const file = this.zip.file(partPath);
    if (!file) throw new Error(`Part not found: ${partPath}`);
    return file.asText();
  }

  setXml(partPath: string, content: string): void {
    this.zip.file(partPath, content);
  }

  toBuffer(): Buffer {
    return this.zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  // Список всех файлов в ZIP
  listFiles(): string[] {
    return Object.keys(this.zip.files);
  }
}

// Пример: добавить параграф в конец документа
function appendParagraph(editor: DocxEditor, text: string): void {
  const xml = editor.getXml('word/document.xml');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  // Найти w:body
  const body = doc.getElementsByTagNameNS(W, 'body');
  // sectPr всегда последний — вставлять перед ним
  const sectPr = doc.getElementsByTagNameNS(W, 'sectPr');

  // Создать новый параграф
  const p = doc.createElementNS(W, 'w:p');
  const r = doc.createElementNS(W, 'w:r');
  const t = doc.createElementNS(W, 'w:t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  p.appendChild(r);

  // Вставить перед sectPr
  body.insertBefore(p, sectPr);

  const serializer = new XMLSerializer();
  editor.setXml('word/document.xml', serializer.serializeToString(doc));
}
```

### Merge ячеек в таблице

```typescript
function createMergedTable(editor: DocxEditor): string {
  // vMerge — вертикальный мерж: первая ячейка w:vMerge w:val="restart",
  // последующие — w:vMerge без атрибута
  return `
<w:tbl>
  <w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="5000" w:type="pct"/>
  </w:tblPr>
  <!-- Строка 1: горизонтальный мерж через gridSpan -->
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:gridSpan w:val="2"/>  <!-- занять 2 колонки -->
      </w:tcPr>
      <w:p><w:r><w:t>Объединённая шапка</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
  <!-- Строка 2: начало вертикального мержа -->
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:vMerge w:val="restart"/>  <!-- начало вертикального мержа -->
      </w:tcPr>
      <w:p><w:r><w:t>Ячейка слева</w:t></w:r></w:p>
    </w:tc>
    <w:tc>
      <w:p><w:r><w:t>Ячейка справа 1</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
  <!-- Строка 3: продолжение вертикального мержа -->
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:vMerge/>  <!-- продолжение — без атрибута -->
      </w:tcPr>
      <w:p/>  <!-- пустой параграф обязателен даже в merged ячейке -->
    </w:tc>
    <w:tc>
      <w:p><w:r><w:t>Ячейка справа 2</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
</w:tbl>`;
}
```

### Граничные случаи — где ломается

**Неправильный порядок элементов.** OOXML требует строгого порядка дочерних элементов (определён в XSD схеме). `w:pPr` должен быть первым в `w:p`, `w:rPr` — первым в `w:r`. Word исправляет нарушения при открытии, но LibreOffice — нет.

```xml
<!-- ❌ Word откроет, LibreOffice может сломать -->
<w:p>
  <w:r><w:t>Текст</w:t></w:r>
  <w:pPr><w:jc w:val="center"/></w:pPr>
</w:p>

<!-- ✅ Правильный порядок -->
<w:p>
  <w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r><w:t>Текст</w:t></w:r>
</w:p>
```

**Encoding и спецсимволы.** XML требует экранирования `<`, `>`, `&`, `"`, `'`. При конкатенации строк в XML — использовать `textContent`, а не `innerHTML` или string interpolation.

```typescript
// ❌ XSS в документе + невалидный XML
t.innerHTML = userInput; // если userInput содержит < или &

// ✅
t.textContent = userInput; // автоматическое экранирование
```

**Почему это важно архитектору:** LibreOffice и Google Docs менее толерантны к нарушениям схемы чем Word. Документы генерируемые для российского рынка должны проверяться в LibreOffice — он доминирует в госсекторе.

---

## 6. Шаблонизация через docxtemplater

### Механика

docxtemplater работает с реальным `.docx` шаблоном: вставляет `{placeholders}` прямо в Word, сохраняет файл, затем заполняет данными программно.

```typescript
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as fs from 'fs';

interface ContractData {
  company_name: string;
  inn: string;
  contract_date: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
}

function generateContract(
  templatePath: string,
  data: ContractData
): Buffer {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,   // ✅ Циклы по параграфам (не только ячейкам)
    linebreaks: true,      // ✅ \n в данных → w:br в документе
    delimiters: { start: '{', end: '}' }, // можно менять если {} в тексте
  });

  doc.render(data);

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

// Шаблон в Word содержит:
// {company_name} — обычный плейсхолдер
// {contract_date}
// {#items}           — начало цикла по массиву
//   {name} {quantity} {price}
// {/items}           — конец цикла
// {total}
```

### Условный контент

```
{#has_appendix}
  Приложение №1: {appendix_name}
{/has_appendix}

{^has_appendix}
  Приложения отсутствуют.
{/has_appendix}
```

### Граничные случаи — где ломается

**Разбитый плейсхолдер по runs.** Word иногда разбивает `{placeholder}` на несколько runs при автокоррекции или частичном форматировании:

```xml
<!-- Word сохранил так — docxtemplater не найдёт плейсхолдер -->
<w:r><w:t>{place</w:t></w:r>
<w:r><w:rPr><w:lang w:val="en-US"/></w:rPr><w:t>holder}</w:t></w:r>
```

Решение: в Word отключить автокоррекцию перед вводом плейсхолдеров, или использовать инструмент docxtemplater Inspector для диагностики.

**Цикл внутри таблицы — пустые строки.** При `{#items}...{/items}` внутри таблицы без `paragraphLoop: true` — генерируются лишние пустые строки.

**Практический вывод для архитектора:** docxtemplater — правильный выбор когда дизайн документа делают в Word (юристы, дизайнеры), а код только заполняет данные. Разделение ответственности: шаблон ≠ код.

---

## 7. Генерация DOCX через docx npm

### Когда docx вместо raw XML

`docx` (npm 9.5.1) — декларативный TypeScript API для создания документов с нуля. Не требует шаблона. Подходит когда структура документа полностью определяется кодом.

```typescript
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle,
  Packer,
} from 'docx';

async function generateReport(data: ReportData): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 }, // twips
        },
      },
      children: [

        // Заголовок
        new Paragraph({
          text: data.title,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120 },
        }),

        // Параграф со смешанным форматированием
        new Paragraph({
          children: [
            new TextRun({ text: 'Дата составления: ', bold: true }),
            new TextRun({ text: data.date }),
            new TextRun({ text: '  |  ' }),
            new TextRun({
              text: `ИНН: ${data.inn}`,
              bold: true,
              color: '2F5496',
            }),
          ],
        }),

        // Таблица
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Заголовочная строка
            new TableRow({
              tableHeader: true,
              children: ['Наименование', 'Кол-во', 'Цена', 'Сумма'].map(
                header => new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true })],
                  })],
                  shading: { fill: 'D9E1F2' },
                })
              ),
            }),
            // Строки данных
            ...data.items.map(item =>
              new TableRow({
                children: [
                  item.name,
                  String(item.quantity),
                  `${item.price} ₽`,
                  `${item.quantity * item.price} ₽`,
                ].map(text => new TableCell({
                  children: [new Paragraph({ text })],
                })),
              })
            ),
          ],
        }),

      ],
    }],
  });

  return Packer.toBuffer(doc);
}
```

### Ограничения docx npm

`docx` не поддерживает нативно:
- Трекинг изменений (review/track changes)
- Сложные поля (TOC, формулы)
- Модификацию существующих документов (только создание)

Для этих случаев — raw XML через PizZip или patchDocument API (добавлен в docx 8.x).

**Практический вывод для архитектора:** `docx` — для генерации с нуля, `docxtemplater` — для заполнения шаблонов, raw PizZip — для хирургических изменений существующих документов. Не пытаться использовать один инструмент для всех трёх задач.

---

## 8. Парсинг и извлечение текста

### Два уровня парсинга

**Уровень 1 — plain text extraction** (быстро, без структуры):

```typescript
import PizZip from 'pizzip';
import { DOMParser } from '@xmldom/xmldom';

function extractText(docxBuffer: Buffer): string {
  const zip = new PizZip(docxBuffer);
  const xml = zip.file('word/document.xml')!.asText();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const textNodes = doc.getElementsByTagNameNS(W, 't');

  const paragraphs: string[] = [];
  const pNodes = doc.getElementsByTagNameNS(W, 'p');

  for (const p of Array.from(pNodes)) {
    const tNodes = (p as Element).getElementsByTagNameNS(W, 't');
    // ✅ Конкатенировать все runs параграфа
    const text = Array.from(tNodes)
      .map(t => t.textContent ?? '')
      .join('');
    if (text.trim()) paragraphs.push(text);
  }

  return paragraphs.join('\n');
}
```

**Уровень 2 — структурированное извлечение** (медленно, с метаданными):

```typescript
interface DocxParagraph {
  text: string;
  style: string | null;
  level: number | null;      // для заголовков
  isTableCell: boolean;
  runs: Array<{
    text: string;
    bold: boolean;
    italic: boolean;
    fontSize: number | null;
  }>;
}

function parseParagraphs(docxBuffer: Buffer): DocxParagraph[] {
  const zip = new PizZip(docxBuffer);
  const xml = zip.file('word/document.xml')!.asText();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const pNodes = doc.getElementsByTagNameNS(W, 'p');
  const result: DocxParagraph[] = [];

  for (const p of Array.from(pNodes)) {
    const pPr = (p as Element).getElementsByTagNameNS(W, 'pPr');
    const styleNode = pPr?.getElementsByTagNameNS(W, 'pStyle');
    const style = styleNode?.getAttribute('w:val') ?? null;

    // Определить уровень заголовка
    const outlineLvl = pPr?.getElementsByTagNameNS(W, 'outlineLvl');
    const level = outlineLvl
      ? parseInt(outlineLvl.getAttribute('w:val') ?? '9') + 1
      : null;

    // Собрать runs
    const rNodes = (p as Element).getElementsByTagNameNS(W, 'r');
    const runs = Array.from(rNodes).map(r => {
      const rPr = (r as Element).getElementsByTagNameNS(W, 'rPr');
      const tNodes = (r as Element).getElementsByTagNameNS(W, 't');
      const text = Array.from(tNodes).map(t => t.textContent ?? '').join('');

      const szNode = rPr?.getElementsByTagNameNS(W, 'sz');
      const szVal = szNode?.getAttribute('w:val');

      return {
        text,
        bold: !!(rPr?.getElementsByTagNameNS(W, 'b').length),
        italic: !!(rPr?.getElementsByTagNameNS(W, 'i').length),
        fontSize: szVal ? parseInt(szVal) / 2 : null, // half-points → points
      };
    });

    const text = runs.map(r => r.text).join('');
    if (text.trim() || style) {
      result.push({
        text,
        style,
        level,
        isTableCell: false, // упрощение — определять по контексту
        runs,
      });
    }
  }

  return result;
}
```

### Граничные случаи — где ломается

**Soft hyphen и специальные run-элементы.** `w:br` (перенос строки), `w:tab`, `w:softHyphen` — не `w:t`. При конкатенации только `w:t` — табуляции и переносы теряются.

**Текст в колонтитулах.** `header1.xml` / `footer1.xml` — отдельные части ZIP. Простой парсинг `document.xml` колонтитулы не захватывает.

**Почему это важно архитектору:** Перед отправкой DOCX текста в LLM — нужно знать что именно ты отправляешь. Потеря структуры (заголовки, таблицы) = потеря контекста для модели.

---

## 9. Граничные случаи промышленного документооборота

### Tracked Changes (w:ins / w:del)

Документ с трекингом изменений содержит одновременно старый и новый текст:

```xml
<w:p>
  <w:del w:id="1" w:author="Иванов" w:date="2024-01-15T10:00:00Z">
    <w:r><w:delText>старый текст</w:delText></w:r>
  </w:del>
  <w:ins w:id="2" w:author="Петров" w:date="2024-01-16T09:00:00Z">
    <w:r><w:t>новый текст</w:t></w:r>
  </w:ins>
</w:p>
```

При наивном парсинге `w:t` — получишь и старый и новый текст одновременно. Перед отправкой в LLM — принять или отклонить изменения (или явно обработать оба варианта).

### Поля (w:fldChar)

Поля (номера страниц, оглавление, формулы) хранятся в трёх runs:

```xml
<w:r><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:instrText> PAGE </w:instrText></w:r>
<w:r><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:t>5</w:t></w:r>  <!-- кэшированное значение поля -->
<w:r><w:fldChar w:fldCharType="end"/></w:r>
```

`w:t` здесь — кэш, не актуальное значение. Word пересчитывает поля при открытии.

### Совместимость Word vs LibreOffice

```typescript
// Проблемные конструкции для LibreOffice:
const libreOfficeIssues = [
  'w:sdt (structured document tags)',   // Content Controls — плохая поддержка
  'w:customXml',                         // Custom XML — игнорируется
  'VML (v:shape)',                       // старый формат фигур — устарел
  'w:themeFontLang без fallback',        // шрифты темы без явного fallback
];

// ✅ Безопасный минимальный набор для кросс-совместимости:
const safeFeatures = [
  'w:p / w:r / w:t',
  'w:tbl + w:tr + w:tc',
  'w:style (именованные стили)',
  'DrawingML (a:graphic) для изображений',
  'w:hyperlink',
];
```

**Практический вывод для архитектора:** Если документ пойдёт в госструктуры — тестируй в LibreOffice. Там нет VML поддержки, Content Controls работают частично. Генерируй только то что в `safeFeatures`.

---

## 10. Реальный кейс

**Задача:** автоматическая генерация актов выполненных работ из JSON-данных CRM.
~2000 актов/месяц, каждый — многостраничный документ с таблицей работ,
шапкой, подписями и QR-кодом. Дизайн контролируется юристами — меняется
раз в квартал.

**Стек:** Node.js 24, docxtemplater 3.66, PizZip 3.x, Sharp 0.34, актуальная локальная LLM
через Ollama (для AI-генерации описания работ).

**Гипотеза:** docxtemplater — правильный выбор: шаблон в Word, данные из
JSON, разделение ответственности. Сложности начнутся только при генерации
10+ страничных документов — там latency и память.

**Что получилось:**

Первая проблема обнаружилась на 50-м акте, а не на 500-м:

```typescript
// Акт не рендерился — docxtemplater молча возвращал пустые строки
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,  // ✅ включено
  linebreaks: true,     // ✅ включено
  delimiters: { start: '{', end: '}' },
});
doc.render(data);

// Результат: {company_name} → "", хотя data.company_name = "ООО Ромашка"
```

Причина: Word разбил `{company_name}` на два runs при автозамене:

```xml
<!-- Word сохранил так: -->
<w:r><w:rPr><w:lang w:val="ru-RU"/></w:rPr><w:t>{company</w:t></w:r>
<w:r><w:lang w:val="en-US"/></w:r>
<w:r><w:t>_name}</w:t></w:r>
```

docxtemplater не нашёл плейсхолдер. Ручная проверка 10 файлов: ~30%
шаблонов имели разбитые плейсхолдеры — Word менял язык для части символа.

**Решение:** pre-processing шаблона — объединить все runs внутри каждого
параграфа до docxtemplater:

```typescript
function mergeRunsInTemplate(zip: PizZip): void {
  const xml = zip.file('word/document.xml')!.asText();
  const merged = xml.replace(
    /<w:r>(\s*<w:rPr>.*?<\/w:rPr>\s*)?<w:t[^>]*>([^<]*)<\/w:t>\s*<\/w:r>/gs,
    (match, rPr, text) => {
      // Собираем runs с одинаковым форматированием
      return `<w:r>${rPr || ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
    }
  );
  zip.file('word/document.xml', merged);
}
```

Вторая проблема — **QR-код в колонтитуле**. docxtemplater не поддерживает
вставку изображений в header/footer через плейсхолдеры. Пришлось raw XML:

```typescript
function insertQrIntoHeader(zip: PizZip, qrBuffer: Buffer): void {
  // 1. Добавить изображение в ZIP
  zip.file('word/media/qr.png', qrBuffer);

  // 2. Зарегистрировать в [Content_Types].xml
  const ct = zip.file('[Content_Types].xml')!.asText();
  zip.file('[Content_Types].xml', ct.replace(
    '</Types>',
    '<Default Extension="png" ContentType="image/png"/>\n</Types>'
  ));

  // 3. Добавить relationship в header.xml.rels (rId3)
  const headerRels = zip.file('word/_rels/header1.xml.rels');
  if (!headerRels) {
    zip.file('word/_rels/header1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qr.png"/>
      </Relationships>`
    );
  }

  // 4. Вставить drawing в header1.xml
  // ... (опущено для краткости — 30 строк XML)
}
```

**Вывод, противоречащий интуиции:**

Проблема была не в производительности (10-страничные акты генерировались
за 200–400ms), а в **неожиданном поведении Word при сохранении шаблона**.
Разбитые плейсхолдеры — причина №1 сбоев docxtemplater, не размер документа
или сложность форматирования.

Доля времени на настройку:

| Этап | Время | Доля |
|------|-------|------|
| Создание шаблона в Word | 4 часа | 20% |
| Предобработка шаблона (merge runs) | 2 часа | 10% |
| Raw XML для QR в колонтитуле | 8 часов | 40% |
| Docxtemplater рендеринг | 4 часа | 20% |
| Тестирование совместимости (Word + LO) | 2 часа | 10% |

**Вывод:** 40% времени ушло на raw XML манипуляцию (QR в колонтитул),
которую ни docxtemplater, ни docx npm не поддерживают. Три инструмента
в одном pipeline: docxtemplater (шаблон) → raw PizZip (хирургия) →
validation в LibreOffice.

---

## 11. Антипаттерны

### «Генерировать XML конкатенацией строк»

**Выглядит правильно:** быстро, просто, без зависимостей.

**Почему ошибка:** пользовательский ввод с `<`, `>`, `&` ломает XML. Символ `&` без экранирования — невалидный XML, Word откажется открывать файл. Использовать DOM API с `textContent` или библиотеки с escape.

---

### «Один инструмент для всех задач»

**Выглядит правильно:** docx npm умеет всё — зачем ещё инструменты?

**Почему ошибка:** docx создаёт с нуля, но не редактирует. docxtemplater заполняет шаблоны, но не создаёт структуру. PizZip + raw XML хирургичен, но многословен для простых задач. Задача определяет инструмент, не наоборот.

---

### «Парсить текст без учёта tracked changes»

**Выглядит правильно:** достать все `w:t` — получить текст.

**Почему ошибка:** `w:delText` в `w:del` тоже содержит `w:t`-подобный контент. Документ с незакрытыми правками при наивном парсинге даёт дублированный текст. Для юридических документов это критично.

---

### «Не тестировать в LibreOffice»

**Выглядит правильно:** Word открыл — значит документ корректен.

**Почему ошибка:** Word исправляет многие нарушения схемы при открытии. LibreOffice и Google Docs строже. В российском госсекторе и e-commerce LibreOffice распространён. Документ должен открываться корректно везде.

---

### «Изменять document.xml не обновляя .rels»

**Выглядит правильно:** добавил изображение в XML — готово.

**Почему ошибка:** изображение добавлено в `document.xml` как `r:embed="rId99"`, но в `document.xml.rels` нет записи для `rId99`. Word откроет файл с предупреждением «broken links» и заменит изображение иконкой ошибки.



---

## Anti-checklist ☠️

- [ ] Генерировать XML конкатенацией строк — `&` и `<` в данных не экранируются
- [ ] Использовать docx npm для редактирования существующих документов — docx создаёт с нуля, не редактирует
- [ ] Парсить только `w:t` без учёта tracked changes — `w:delText` даст дублированный текст
- [ ] Не тестировать в LibreOffice — Word исправляет нарушения схемы, LibreOffice нет
- [ ] Менять `w:numPr` или `w:listPr` через строку — номерованные списки сломаются, нужен XML-патч по схеме
- [ ] Игнорировать `xml:space="preserve"` — XML парсер обрежет значимые пробелы
- [ ] Добавлять изображение в document.xml без обновления .rels — Word покажет broken link

---

## Задачи AI-кодеру

**Задача 1 — Извлечение структурированного текста**

Плохая формулировка:
> «Извлеки текст из DOCX»

Хорошая формулировка:
> «Реализуй TypeScript функцию `parseDocx(buffer: Buffer): DocxDocument`. Тип `DocxDocument`: `{ paragraphs: DocxParagraph[] }`, где `DocxParagraph`: `{ text: string, style: string|null, level: number|null, bold: boolean, isInTable: boolean }`. Использовать PizZip + @xmldom/xmldom. Учесть: конкатенировать все w:r/w:t внутри одного w:p (не только первый run). Пропускать w:delText из w:del элементов (tracked deletions). Параграфы внутри w:tc помечать isInTable: true. Не использовать regexp на XML.»

Формула: тип возврата + граничные случаи явно + что НЕ делать.

---

**Задача 2 — Генерация по шаблону**

Плохая формулировка:
> «Сделай генерацию договора из шаблона»

Хорошая формулировка:
> «Реализуй TypeScript функцию `generateContract(templatePath: string, data: ContractData): Buffer` используя docxtemplater 3.66.x и PizZip 3.x. Тип ContractData: `{ contractNumber: string, date: string, clientName: string, inn: string, items: {name: string, qty: number, price: number}[], total: number }`. Параметры Docxtemplater: paragraphLoop: true, linebreaks: true. Обработать ошибку рендеринга (незакрытые теги, отсутствующие плейсхолдеры) — выбросить Error с именем проблемного тега из e.properties.errors. Вернуть Buffer для записи в файл или отправки как HTTP response.»

Формула: версии + тип входных данных + обработка ошибок docxtemplater + формат вывода.

---

**Задача 3 — Хирургическое редактирование**

Плохая формулировка:
> «Добавь водяной знак в документ»

Хорошая формулировка:
> «Реализуй TypeScript функцию `addTextWatermark(inputBuffer: Buffer, text: string): Buffer` добавляющую текстовый водяной знак через w:background элемент в word/document.xml. Использовать PizZip + @xmldom/xmldom. Водяной знак: текст серого цвета (#CCCCCC), размер 72pt, угол 45 градусов через w:background/v:background (VML). Если w:background уже существует — заменить, не дублировать. Сохранить compression: DEFLATE при записи ZIP.»

Формула: конкретный OOXML механизм + idempotency + параметры сжатия.

---

## Чеклист архитектора

### Структура и валидность
- [ ] Все добавленные части зарегистрированы в `[Content_Types].xml`
- [ ] Все ссылки на ресурсы добавлены в соответствующий `.rels` файл
- [ ] Порядок дочерних элементов соответствует OOXML схеме (`w:pPr` первый в `w:p`)
- [ ] Пользовательский текст вставляется через `textContent`, не строковой конкатенацией
- [ ] `xml:space="preserve"` установлен на всех `w:t` элементах

### Парсинг
- [ ] Все `w:r/w:t` параграфа конкатенированы, не только первый run
- [ ] `w:delText` из `w:del` исключён при извлечении итогового текста
- [ ] Колонтитулы обработаны отдельно если нужны
- [ ] Namespace resolver передан при XPath-запросах

### Совместимость
- [ ] Документ протестирован в LibreOffice (не только Word)
- [ ] VML не используется — только DrawingML для изображений
- [ ] Content Controls (`w:sdt`) не используются если нужна кросс-совместимость
- [ ] Стили берутся из реального шаблона-пустышки, не генерируются с нуля

### Инструменты
- [ ] Задача генерации с нуля → `docx` npm
- [ ] Задача заполнения шаблона → `docxtemplater`
- [ ] Задача редактирования существующего → PizZip + raw XML

---

*Модуль 14 завершён.*
*Следующий: [Модуль 15 — PDF internals](../15-pdf-internals/README.md)*
