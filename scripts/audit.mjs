// Audit the built course.html + sources: duplicate ids, broken anchors,
// unresolved fences, placeholder leftovers, module coverage.
// Usage: node scripts/audit.mjs
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MODULES, LAST_MODULE } from './modules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];

function report(kind, msg) { problems.push({ kind, msg }); }

// ---------- 1. source modules present and structurally complete ----------
// Volume is deliberately not a criterion: a module is as long as the topic
// warrants, and padding to hit a line count is the same disease as a thin
// module. What is checkable is structure — the template sections exist, edge
// cases name real failures, and every section ends in a practical takeaway.
// Headings are numbered in some modules and not in others, and Anti-checklist
// is optional by the Prompt.md rule ("только если есть что сказать"), so only
// the sections without which a module cannot teach anything are required.
// Heading prefix: level, optional "N." numbering, horizontal space only — \s*
// would also swallow the newline and match the next line's text.
const H = String.raw`(?:#{2,4}[ \t]*(?:\d+[.)][ \t]*)?)`;
const REQUIRED_SECTIONS = [
  { re: new RegExp(`^${H}Актуальные версии`, 'm'), label: 'Актуальные версии' },
  { re: new RegExp(`^${H}Задачи AI-кодеру`, 'm'), label: 'Задачи AI-кодеру' },
  { re: new RegExp(`^${H}Чеклист архитектора`, 'm'), label: 'Чеклист архитектора' },
];

// Edge cases appear either as a heading or as a bold marker inside a section.
const EDGE_RE = new RegExp(`(?:^${H}[^\\n]*[Гг]раничные случаи|\\*\\*Граничные случаи)`, 'm');
// Takeaways are phrased per module — same meaning, different wording. Narrowing
// this list produced false positives on 01/03/04/05, so it matches any bold
// lead-in that promises an architectural consequence.
const TAKEAWAY_RE = /\*\*[^*]*(?:архитектор|Практическ|Архитектурн|Последств|применени|Следстви|Диагностик|Важно)[^*]*:\*\*/i;

let totalLines = 0;
const noChecklist = [];
for (const [num, m] of Object.entries(MODULES)) {
  const readme = join(ROOT, m.dir, 'README.md');
  if (!existsSync(readme)) { report('MISSING', `${num} ${m.dir}/README.md`); continue; }
  const src = readFileSync(readme, 'utf-8');
  totalLines += src.split(/\r?\n/).length;

  const absent = REQUIRED_SECTIONS.filter(s => !s.re.test(src)).map(s => s.label);
  if (absent.length) report('STRUCTURE', `${num} ${m.dir}: нет ${absent.join(', ')}`);

  if (!EDGE_RE.test(src))
    report('STRUCTURE', `${num} ${m.dir}: нет «Граничных случаев» — где ломается`);

  // Takeaways are phrased per module, and which section carries one is an
  // editorial judgement, not a fact — so only their total absence is reported.
  if (!TAKEAWAY_RE.test(src))
    report('STRUCTURE', `${num} ${m.dir}: ни одного практического вывода для архитектора`);

  if (!new RegExp(`^${H}Anti-checklist`, 'm').test(src)) noChecklist.push(num);

  const gloss = join(ROOT, m.dir, 'GLOSSARY.md');
  if (!existsSync(gloss)) report('MISSING', `${num} ${m.dir}/GLOSSARY.md`);
}
notes.push(`Модулей: ${Object.keys(MODULES).length}, строк README: ${totalLines} (объём не критерий)`);
if (noChecklist.length) notes.push(`Без Anti-checklist (по правилу Prompt.md — норма): ${noChecklist.join(', ')}`);

// ---------- 2. leftover placeholders in sources ----------
// CURRENT_* is the project's deliberate convention for "the model chosen at
// authoring time" (documented in module 06) — not an unfinished placeholder.
// Only real fill-in-the-blank markers are reported.
const PLACEHOLDERS = [
  /\[\s*МЕТРИКА[:.]/, /\bTODO\b/, /\bFIXME\b/, /\[вставить/i,
  /\[указать ?(здесь|реальн)/i, /\[реальные ?значения\]/i,
];
for (const [num, m] of Object.entries(MODULES)) {
  const src = readFileSync(join(ROOT, m.dir, 'README.md'), 'utf-8');
  const hits = [];
  src.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) return; // skip fenced code bodies
    for (const re of PLACEHOLDERS) if (re.test(line)) { hits.push(`    ${i + 1}: ${line.trim().slice(0, 110)}`); break; }
  });
  if (hits.length) report('PLACEHOLDER', `${num} ${m.name}\n${hits.join('\n')}`);
}

// ---------- 3. fence balance per module ----------
for (const [num, m] of Object.entries(MODULES)) {
  const src = readFileSync(join(ROOT, m.dir, 'README.md'), 'utf-8');
  let n = 0;
  src.split(/\r?\n/).forEach(l => { if (/^\s*(```|~~~)/.test(l)) n++; });
  if (n % 2 !== 0) report('FENCE', `${num} ${m.name}: нечётное число fence-строк (${n})`);
}

// ---------- 3b. mermaid: подписи узлов не должны начинаться с «N. » ----------
// mermaid разбирает такую подпись как markdown-список и рисует на диаграмме
// «Unsupported markdown: list» — молча, без ошибки сборки. Проверка ловит
// источник, а не симптом в готовом HTML.
for (const [num, m] of Object.entries(MODULES)) {
  const src = readFileSync(join(ROOT, m.dir, 'README.md'), 'utf-8');
  let inFence = false;
  src.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```mermaid/.test(line)) { inFence = true; return; }
    if (inFence && /^\s*```/.test(line)) { inFence = false; return; }
    if (!inFence) return;
    // Подпись узла: [N. ...], (N. ...), {N. ...} и вариант в кавычках.
    if (/\[["']?\d+\.\s|\(["']?\d+\.\s|\{["']?\d+\.\s/.test(line))
      report('MERMAID_LABEL', `${num} ${m.dir}: подпись узла начинается с «N. » — строка ${i + 1}, mermaid нарисует «Unsupported markdown»\n    ${line.trim().slice(0, 110)}`);
  });
}

// ---------- 4. built html sanity ----------
const htmlPath = join(ROOT, 'course.html');
if (!existsSync(htmlPath)) {
  report('MISSING', 'course.html не собран — запусти npm run build');
} else {
  const html = readFileSync(htmlPath, 'utf-8');
  notes.push(`course.html: ${(statSync(htmlPath).size / 1048576).toFixed(1)} MB`);

  // Inline JS/CSS and code samples legitimately contain id="..." / href="#..."
  // text; scanning them produces phantom duplicates and broken anchors.
  const body = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<pre[\s\S]*?<\/pre>/g, '');

  const ids = [...body.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  const dupes = [...counts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  const extra = dupes.reduce((s, [, n]) => s + n - 1, 0);
  if (dupes.length) {
    report('DUP_ID', `дубликаты id: ${dupes.length} групп, ${extra} лишних вхождений. Топ:\n` +
      dupes.slice(0, 12).map(([k, n]) => `    ${n}x  ${k}`).join('\n'));
  }

  const idSet = new Set(ids);
  const broken = new Set();
  for (const m of body.matchAll(/href="#([^"]+)"/g)) {
    if (!idSet.has(m[1])) broken.add(m[1]);
  }
  if (broken.size) report('BROKEN_ANCHOR', `битые якоря: ${broken.size}\n` +
    [...broken].slice(0, 20).map(s => `    #${s}`).join('\n'));

  const modCount = (body.match(/<section class="module"/g) || []).length;
  const tocCount = (body.match(/<nav class="toc"/g) || []).length;
  const pagerCount = (body.match(/<nav class="pager"/g) || []).length;
  const mermaidCount = (html.match(/<div class="mermaid">/g) || []).length;

  notes.push(`Секций: ${modCount} (${LAST_MODULE} модулей + глоссарий + 3 справочных)`);
  notes.push(`Оглавлений модулей: ${tocCount}, пагинаторов: ${pagerCount}, диаграмм: ${mermaidCount}`);
  if (tocCount !== LAST_MODULE) report('TOC', `оглавлений ${tocCount}, ожидалось ${LAST_MODULE}`);
  if (pagerCount !== LAST_MODULE) report('PAGER', `пагинаторов ${pagerCount}, ожидалось ${LAST_MODULE}`);

  for (const [num] of Object.entries(MODULES)) {
    if (!html.includes(`id="module-${String(num).padStart(2, '0')}"`))
      report('MISSING', `в html нет секции модуля ${num}`);
  }

  for (const tag of ['<html', '</html>', '<body', '</body>']) {
    if (!html.includes(tag)) report('BROKEN_HTML', `нет ${tag}`);
  }
  // Every ```mermaid fence in the sources must reach the page as .mermaid,
  // otherwise a diagram silently degrades to plain preformatted text.
  const sourceDiagrams = [ROOT, ...Object.values(MODULES).map(m => join(ROOT, m.dir))]
    .flatMap(dir => [join(dir, 'README.md'), join(dir, 'GLOSSARY.md')])
    .concat(['GLOSSARY.md', 'ARCHITECTURE_LANDSCAPE.md', 'TOOLS_COMPARISON.md', 'ADR_TEMPLATE.md'].map(f => join(ROOT, f)))
    .filter(p => existsSync(p))
    .reduce((sum, p) => sum + (readFileSync(p, 'utf-8').match(/```mermaid/g) || []).length, 0);
  if (mermaidCount !== sourceDiagrams)
    report('MERMAID', `диаграмм в исходниках ${sourceDiagrams}, в html ${mermaidCount}`);
  else notes.push(`Диаграмм: ${mermaidCount} (совпадает с исходниками)`);

  const openPre = (body.match(/<pre[ >]/g) || []).length;
  const closePre = (body.match(/<\/pre>/g) || []).length;
  if (openPre !== closePre) report('BROKEN_HTML', `<pre>: ${openPre} открывающих, ${closePre} закрывающих`);
  const openDiv = (body.match(/<div[ >]/g) || []).length;
  const closeDiv = (body.match(/<\/div>/g) || []).length;
  if (openDiv !== closeDiv) report('BROKEN_HTML', `<div>: ${openDiv} / ${closeDiv}`);
  const openSec = (body.match(/<section[ >]/g) || []).length;
  const closeSec = (body.match(/<\/section>/g) || []).length;
  if (openSec !== closeSec) report('BROKEN_HTML', `<section>: ${openSec} / ${closeSec}`);
  if (!body.includes('</html>')) report('BROKEN_HTML', 'нет </html>');
}

// ---------- 5. module counts claimed in root prose match the registry ----------
// The build can be complete while README/AGENTS still say "52 модуля" — the
// sections exist, only the prose lies. A count is a claim about state, so it is
// audited like any other.
// A stated total must read "N модулей / N модуля / N модуль" — case-sensitive
// and with an explicit lookahead, so it does not fire on "2026-10 модулями 53–55"
// (digits inside a date) or on a table row "53 Модульная архитектура".
const COUNT_RE = /(\d{2})\s+(?:модулей|модуля|модуль)(?![а-яё])/g;
// The lookbehind keeps dates like "2026-09" out of the range match.
const RANGE_RE = /(?<!\d)(\d{2})\s*[–-]\s*(\d{2})(?!\d)/g;

for (const file of ['README.md', 'AGENTS.md', 'ARCHITECTURE_LANDSCAPE.md', 'QUICKREF.md']) {
  const p = join(ROOT, file);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, 'utf-8');

  // A stated total must equal the registry: "52 модуля" while 55 exist is the
  // exact drift the 2026-10 glossary incident came from.
  const totals = new Set([...src.matchAll(COUNT_RE)].map(m => parseInt(m[1])));
  const wrongTotals = [...totals].filter(n => n !== LAST_MODULE);

  // Every range end must name a module that exists ("27–40", "53–55").
  const unknown = new Set();
  for (const m of src.matchAll(RANGE_RE)) {
    const lo = parseInt(m[1]), hi = parseInt(m[2]);
    if (lo > hi) continue;
    for (let n = lo; n <= hi; n++) if (!MODULES[n]) unknown.add(n);
  }

  if (wrongTotals.length)
    report('STALE_COUNT',
      `${file}: заявлено модулей ${[...totals].sort((a, b) => a - b).join(', ')}, в реестре ${LAST_MODULE}`);
  if (unknown.size)
    report('STALE_COUNT', `${file}: диапазоны ссылаются на несуществующие модули: ${[...unknown].sort((a, b) => a - b).join(', ')}`);
}

// ---------- 6. stale duplicate of the build ----------
const idx = join(ROOT, 'index.html');
if (existsSync(idx)) {
  report('STALE_ARTIFACT',
    'index.html — старый дубль сборки на CDN (1.9 MB), расходится с course.html. ' +
    'Сборка пишет только course.html; index.html следует удалить (или превратить в редирект).');
}

// ---------- output ----------
console.log(notes.map(n => `· ${n}`).join('\n'));
console.log('');
if (!problems.length) {
  console.log('Аудит: проблем не найдено.');
} else {
  for (const p of problems) console.log(`[${p.kind}] ${p.msg}\n`);
  console.log(`Итого замечаний: ${problems.length}`);
  process.exitCode = 1;
}
