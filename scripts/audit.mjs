// Audit the built course.html + sources: duplicate ids, broken anchors,
// unresolved fences, placeholder leftovers, module coverage.
// Usage: node scripts/audit.mjs
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MODULES } from './modules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];

function report(kind, msg) { problems.push({ kind, msg }); }

// ---------- 1. source modules present and non-trivial ----------
let totalLines = 0;
let thin = [];
for (const [num, m] of Object.entries(MODULES)) {
  const readme = join(ROOT, m.dir, 'README.md');
  if (!existsSync(readme)) { report('MISSING', `${num} ${m.dir}/README.md`); continue; }
  const lines = readFileSync(readme, 'utf-8').split(/\r?\n/).length;
  totalLines += lines;
  if (lines < 400) thin.push(`${num} ${m.dir} ${lines} строк`);
  const gloss = join(ROOT, m.dir, 'GLOSSARY.md');
  if (!existsSync(gloss)) report('MISSING', `${num} ${m.dir}/GLOSSARY.md`);
}
notes.push(`Модулей: ${Object.keys(MODULES).length}, строк README: ${totalLines}`);
if (thin.length) notes.push(`Тонкие модули (<400 строк): ${thin.length}`);

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

  notes.push(`Секций: ${modCount} (52 модуля + глоссарий + 3 справочных)`);
  notes.push(`Оглавлений модулей: ${tocCount}, пагинаторов: ${pagerCount}, диаграмм: ${mermaidCount}`);
  if (tocCount !== 52) report('TOC', `оглавлений ${tocCount}, ожидалось 52`);
  if (pagerCount !== 52) report('PAGER', `пагинаторов ${pagerCount}, ожидалось 52`);

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

// ---------- 5. stale duplicate of the build ----------
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
