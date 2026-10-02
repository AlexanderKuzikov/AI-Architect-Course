import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { MODULES } from './modules.mjs';

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'course.html');

function readFile(path) {
  try { return readFileSync(join(ROOT, path), 'utf-8'); } catch { return ''; }
}

function readModule(n) {
  const m = MODULES[n];
  if (!m) return null;
  try { return { num: n, ...m, content: readFileSync(join(ROOT, m.dir, 'README.md'), 'utf-8') }; }
  catch { return { num: n, ...m, content: '' }; }
}

function pad(n) { return String(n).padStart(2, '0'); }

const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

/**
 * Namespaces every heading id in a section with `ns-` so that 52 modules
 * sharing headings like "Содержание" or "Антипаттерны" no longer collide.
 * Intra-section links are rewritten to follow.
 */
const GLOBAL_ANCHORS = /^(module-\d+|glossary|architecture-landscape|tools-comparison|adr-template|top)$/;

function namespaceIds(html, ns) {
  html = html.replace(/id="([^"]+)"/g, (_, id) => `id="${ns}-${id}"`);
  html = html.replace(/href="#([^"]+)"/g, (_, id) => {
    const target = decodeURIComponent(id);
    // Cross-section links (rewritten to #module-NN etc.) must stay global.
    return GLOBAL_ANCHORS.test(target) ? `href="#${target}"` : `href="#${ns}-${target}"`;
  });
  return html;
}

/**
 * GLOSSARY.md carries a hand-written A-Z index linking to 66 letter sections,
 * but only the letters that actually have entries exist as headings. Rebuilds
 * the index from the real headings so it never links to a missing anchor.
 */
function rebuildGlossaryIndex(html) {
  const letters = [...html.matchAll(/<h2 id="g-([^"]+)"[^>]*>([^<]+)<\/h2>/g)]
    .map(m => ({ slug: m[1], letter: m[2].trim() }))
    .filter(x => /^[a-zа-яё]$/i.test(x.letter));

  const latin = letters.filter(l => /^[a-z]$/i.test(l.letter));
  const cyr = letters.filter(l => /[а-яё]/i.test(l.letter));
  // Already-rendered HTML: link text must be real markup, not leftover markdown.
  const line = arr => arr.map(l => `<a href="#g-${l.slug}">${l.letter}</a>`).join(' · ');
  const idx = `<h2 id="g-alphabetical-index" tabindex="-1">Alphabetical Index</h2>\n` +
    `<p class="gl-index">${line(latin)}<br>${line(cyr)}</p>\n`;
  return html.replace(/<h2 id="g-alphabetical-index"[\s\S]*?(?=<h2 id=")/i, idx);
}

/**
 * Replaces the hand-written "Содержание" list with one generated from the
 * headings that actually exist in this section. Hand-maintained anchor lists
 * drift from heading text (em dashes collapse to one dash, section numbers get
 * renumbered); generating them removes that whole failure mode.
 */
function generateToc(html) {
  const headings = [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)]
    .map(m => ({ id: m[1], title: stripTags(m[2]) }))
    .filter(h => !/^содержание$/i.test(h.title));
  if (!headings.length) return html;

  // Headings already carry their own numbering ("1. Как работает JS…"),
  // so the list must not add a second counter on top.
  const items = headings
    .map(h => `<li><a href="#${h.id}">${h.title}</a></li>`)
    .join('');
  const toc = `<nav class="toc" aria-label="Содержание раздела"><ol>${items}</ol></nav>`;

  // Drop the author-written list that followed the "Содержание" heading.
  const re = /(<h2 id="[^"]*"[^>]*>Содержание<\/h2>)[\s\S]*?(?=<h2 id=")/i;
  return re.test(html) ? html.replace(re, `$1${toc}`) : html;
}

function moduleToHtml(module, md) {
  let html = md.render(module.content);
  const n = pad(module.num);
  const ns = `m${n}`;
  html = namespaceIds(html, ns);
  html = generateToc(html);

  for (const [num, m] of Object.entries(MODULES)) {
    const k = pad(num);
    html = html.replaceAll(`href="../${m.dir}/README.md"`, `href="#module-${k}"`);
    html = html.replaceAll(`href="../${m.dir}/GLOSSARY.md"`, `href="#glossary"`);
  }

  const prevNum = module.num - 1, nextNum = module.num + 1;
  const prev = MODULES[prevNum], next = MODULES[nextNum];
  const pager = [
    prev ? `<a class="pn prev" href="#module-${pad(prevNum)}"><span>← Назад</span>${pad(prevNum)} ${prev.name}</a>` : '<span class="pn-gap"></span>',
    next ? `<a class="pn next" href="#module-${pad(nextNum)}"><span>Вперёд →</span>${pad(nextNum)} ${next.name}</a>` : '<span class="pn-gap"></span>',
  ].join('');

  return `<section class="module" id="module-${n}">` +
    `<div class="module-content">${html}</div>` +
    `<nav class="pager">${pager}</nav>` +
    `</section>`;
}

function buildSidebar() {
  const tracks = [
    { name: 'Languages',         range: [1, 5] },
    { name: 'AI Foundation',     range: [6, 10] },
    { name: 'AI Systems',        range: [11, 13] },
    { name: 'Documents',         range: [14, 17] },
    { name: 'Infrastructure',    range: [18, 26] },
    { name: 'Web Performance',   range: [27, 40] },
    { name: 'Agent Systems',     range: [41, 47] },
    { name: 'Desktop / Data / Cost', range: [48, 50] },
    { name: 'API / Resilience',      range: [51, 52] },
  ];

  let h = `<div class="sidebar-overlay" id="overlay" onclick="closeSidebar()"></div>`;
  h += `<nav class="sidebar" id="sidebar" aria-label="Навигация по курсу"><div class="sidebar-header">`;
  h += `<a class="brand" href="#top">AI Architect Course</a>`;
  h += `<button class="sidebar-toggle" onclick="closeSidebar()" aria-label="Закрыть меню">&#10005;</button></div>`;

  h += `<input type="search" id="search" placeholder="Поиск по курсу…" aria-label="Поиск" oninput="searchModules(this.value)" onfocus="openSidebar()"><div class="search-results" id="searchResults" role="listbox"></div>`;

  h += `<div class="controls"><div class="control-group"><label>Тема</label><div class="theme-buttons" id="themeButtons"></div></div>`;
  h += `<div class="control-group"><label>Шрифт</label><div class="fs-controls"><button onclick="changeFontSize(-1)" aria-label="Уменьшить шрифт">A&#8722;</button><span id="fontSizeLabel">100%</span><button onclick="changeFontSize(1)" aria-label="Увеличить шрифт">A+</button></div></div></div>`;

  h += `<div class="nav-section"><div class="nav-section-title active" onclick="toggleNavSection(this)">Справочники</div>`;
  h += `<div class="nav-section-content active">`;
  h += `<a href="#glossary">Глоссарий</a>`;
  h += `<a href="#architecture-landscape">Карта архитектуры</a>`;
  h += `<a href="#tools-comparison">Сравнение инструментов</a>`;
  h += `<a href="#adr-template">Шаблон ADR</a>`;
  h += `</div></div>`;

  h += `<div class="nav-section"><div class="nav-section-title active" onclick="toggleNavSection(this)">Модули</div>`;
  h += `<div class="nav-section-content active">`;
  for (const track of tracks) {
    h += `<div class="nav-track-label">${track.name}</div>`;
    for (let i = track.range[0]; i <= track.range[1]; i++) {
      const m = MODULES[i];
      if (m) h += `<a href="#module-${pad(i)}" data-mod="${pad(i)}" onclick="closeSidebar()">${pad(i)} ${m.name}</a>`;
    }
  }
  h += `</div></div>`;
  h += `</nav>`;
  // Outside the <nav>: on mobile the sidebar is translated off-screen, so a
  // button inside it would be unreachable.
  h += `<button class="sidebar-bottom-toggle" onclick="toggleSidebar()" aria-label="Открыть меню">&#9776; Меню</button>`;
  return h;
}

function buildGlossary(md) {
  const path = join(ROOT, 'GLOSSARY.md');
  if (!existsSync(path)) return '';
  let content = readFileSync(path, 'utf-8');
  for (const [num, m] of Object.entries(MODULES)) {
    const n = pad(num);
    content = content.replaceAll(`](../${m.dir}/README.md)`, `](#module-${n})`);
    content = content.replaceAll(`](../${m.dir}/GLOSSARY.md)`, `](#glossary)`);
  }
  let rendered = namespaceIds(md.render(content), 'g');
  rendered = rebuildGlossaryIndex(rendered);
  return `<section class="module" id="glossary"><div class="module-content glossary">${rendered}</div></section>`;
}

async function main() {
  console.log('Building course HTML...');

  const MarkdownIt = (await import('markdown-it')).default;
  const anchor = (await import('markdown-it-anchor')).default;
  const hljsCss = readFile('assets/highlight-github-dark.min.css');
  const mermaidJs = readFile('assets/mermaid.min.js');

  const md = new MarkdownIt({
    html: true, linkify: true, typographer: true,
    highlight: (str, lang) => {
      // mermaid.run() reads innerHTML, so the source must not be wrapped in <code>.
      if (lang === 'mermaid') return `<div class="mermaid">${md.utils.escapeHtml(str)}</div>`;
      try {
        const hljs = _require('highlight.js');
        if (lang && hljs.getLanguage(lang))
          return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {}
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    },
  });
  md.use(anchor, {
    level: [1, 2, 3, 4],
    slugify: s => s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/(^-|-$)/g, '')
  });

  let body = '';
  let moduleCount = 0;
  for (let i = 1; i <= 52; i++) {
    const module = readModule(i);
    if (module?.content) { body += moduleToHtml(module, md); moduleCount++; }
    process.stdout.write(`\r  ${i}/52 modules`);
  }
  body += buildGlossary(md);

  const extraPages = [
    { id: 'architecture-landscape', file: 'ARCHITECTURE_LANDSCAPE.md', ns: 'al' },
    { id: 'tools-comparison', file: 'TOOLS_COMPARISON.md', ns: 'tc' },
    { id: 'adr-template', file: 'ADR_TEMPLATE.md', ns: 'adr' },
  ];
  for (const page of extraPages) {
    let content = readFile(page.file);
    if (!content) continue;
    for (const [num, m] of Object.entries(MODULES)) {
      const n = pad(num);
      content = content.replaceAll(`../${m.dir}/README.md`, `#module-${n}`);
      content = content.replaceAll(`../${m.dir}/GLOSSARY.md`, `#glossary`);
    }
    const rendered = namespaceIds(md.render(content), page.ns);
    body += `<section class="module" id="${page.id}"><div class="module-content">${generateToc(rendered)}</div></section>`;
  }

  process.stdout.write('\n');

  const sidebar = buildSidebar();

  const themeVars = `:root,.theme-dark{--bg:#f8f9fa;--bgc:#fff;--bgs:#1a1a2e;--bgsh:#16162a;--tc:#1a1a2e;--tsc:#555;--ts:#e0e0e0;--tsm:#888;--lk:#2563eb;--bd:#e5e7eb;--bds:#2a2a3e;--bqb:#eef2f7;--bqbdr:#2563eb;--cb:#eef2f7;--pb:#1e1e2e;--th:#f3f4f6;--tr:#fafbfc;--fs:16px}
.theme-light{--bg:#f5f5f0;--bgc:#fff;--bgs:#2c3e50;--bgsh:#243342;--tc:#333;--tsc:#666;--ts:#ddd;--tsm:#999;--lk:#2980b9;--bd:#ddd;--bds:#3a4a5e;--bqb:#f0f4f8;--bqbdr:#2980b9;--cb:#f0f0f0;--pb:#2d2d2d;--th:#ecf0f1;--tr:#fafafa}
.theme-sepia{--bg:#fbf7ed;--bgc:#fefcf5;--bgs:#3d2e1e;--bgsh:#322518;--tc:#433422;--tsc:#6b5a4a;--ts:#d4c5b0;--tsm:#9a8a78;--lk:#8b5e3c;--bd:#e0d6c8;--bds:#4d3e2e;--bqb:#f6f0e4;--bqbdr:#8b5e3c;--cb:#f0ebe2;--pb:#2d2518;--th:#f0ebe2;--tr:#faf5ec}
.theme-night{--bg:#0a0a0f;--bgc:#111118;--bgs:#0d0d14;--bgsh:#0a0a10;--tc:#c0c0d0;--tsc:#808090;--ts:#9090a8;--tsm:#505060;--lk:#6699ff;--bd:#222233;--bds:#1a1a28;--bqb:#151520;--bqbdr:#4466aa;--cb:#181825;--pb:#0d0d15;--th:#181825;--tr:#111120}
.theme-terminal{--bg:#0c0c0c;--bgc:#111;--bgs:#0a0a0a;--bgsh:#080808;--tc:#33ff33;--tsc:#22aa22;--ts:#33cc33;--tsm:#226622;--lk:#66ff66;--bd:#223322;--bds:#1a2a1a;--bqb:#111a11;--bqbdr:#33cc33;--cb:#0d180d;--pb:#080d08;--th:#0d180d;--tr:#0a120a}
.theme-highcontrast{--bg:#000;--bgc:#fff;--bgs:#000;--bgsh:#000;--tc:#000;--tsc:#000;--ts:#fff;--tsm:#ccc;--lk:#00f;--bd:#000;--bds:#fff;--bqb:#fff;--bqbdr:#000;--cb:#fff;--pb:#fff;--th:#fff;--tr:#fff}
.theme-blue{--bg:#e8f0fe;--bgc:#fff;--bgs:#1a365d;--bgsh:#142a4a;--tc:#1a202c;--tsc:#4a5568;--ts:#e2e8f0;--tsm:#718096;--lk:#3182ce;--bd:#e2e8f0;--bds:#2a4575;--bqb:#ebf4ff;--bqbdr:#3182ce;--cb:#edf2f7;--pb:#1a202c;--th:#edf2f7;--tr:#f7fafc}`;

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Architect Course — 52 модуля</title>
<meta name="description" content="Учебник AI-архитектора: 52 модуля — языки, AI-фундамент, RAG, агенты, инфраструктура, API и устойчивость.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;line-height:1.75;color:var(--tc);background:var(--bg);font-size:var(--fs);transition:background .3s,color .3s;-webkit-text-size-adjust:100%}
${themeVars}a{color:var(--lk)}
code{font-family:'JetBrains Mono','Fira Code',Consolas,monospace;font-size:.9em;padding:.15em .35em;border-radius:3px;background:var(--cb)}
pre code{padding:0;background:none}
.layout{display:flex;min-height:100vh}

/* ---------- sidebar ---------- */
.sidebar-overlay{display:none}
.sidebar{width:290px;min-width:290px;background:var(--bgs);color:var(--ts);overflow-y:auto;position:sticky;top:0;height:100vh;border-right:1px solid var(--bds);transition:margin-left .3s,background .3s,z-index .3s}
.sidebar-header{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:14px;border-bottom:1px solid var(--bds);background:var(--bgsh);position:sticky;top:0;z-index:2}
.brand{font-size:.95rem;font-weight:700;color:var(--lk);text-decoration:none}
.sidebar-toggle{background:none;border:none;color:var(--tsm);font-size:1.1rem;cursor:pointer;line-height:1;padding:4px}
.sidebar-toggle:hover{color:var(--ts)}
#search{width:calc(100% - 24px);margin:10px 12px;padding:8px 10px;border:1px solid var(--bds);border-radius:6px;background:var(--bgsh);color:var(--ts);font-size:.82rem;outline:none}
#search:focus{border-color:var(--lk)}
.search-results{max-height:0;overflow:hidden;transition:max-height .2s}
.search-results.active{max-height:340px;overflow-y:auto}
.search-results a{display:block;padding:5px 14px;font-size:.78rem;color:var(--tsm);cursor:pointer;text-decoration:none;border-bottom:1px solid var(--bds)}
.search-results a:hover,.search-results a.sel{background:var(--bds);color:var(--ts)}
.search-results .sr-mod{color:var(--lk);font-weight:600}
.search-results .sr-empty{padding:8px 14px;font-size:.78rem;color:var(--tsm)}
.controls{padding:10px 12px;border-bottom:1px solid var(--bds);display:flex;gap:12px;flex-wrap:wrap;align-items:center;font-size:.75rem}
.control-group{display:flex;align-items:center;gap:6px}
.control-group label{color:var(--tsm)}
.theme-buttons{display:flex;gap:4px}
.theme-btn{width:17px;height:17px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}
.theme-btn.active{border-color:var(--lk)}
.fs-controls{display:flex;align-items:center;gap:4px}
.fs-controls button{background:var(--bds);border:none;color:var(--ts);width:26px;height:26px;border-radius:4px;cursor:pointer;font-size:.8rem;line-height:1}
.fs-controls button:hover{background:var(--lk);color:#fff}
.fs-controls span{color:var(--tsm);font-size:.78rem;min-width:34px;text-align:center}
.nav-section{border-bottom:1px solid var(--bds)}
.nav-section-title{padding:9px 14px;font-size:.8rem;font-weight:600;color:var(--ts);cursor:pointer;user-select:none}
.nav-section-title::before{content:'\\25B8';margin-right:6px;font-size:.75rem;color:var(--tsm)}
.nav-section-title.active::before{content:'\\25BE'}
.nav-section-content{display:none}
.nav-section-content.active{display:block}
.nav-section-content a{display:block;padding:4px 14px 4px 26px;font-size:.78rem;color:var(--tsm);cursor:pointer;text-decoration:none}
.nav-section-content a:hover{background:var(--bds);color:var(--ts)}
.nav-section-content a.current{color:var(--lk);font-weight:600;background:var(--bgs)}
.nav-track-label{font-weight:600;padding:9px 14px 3px;font-size:.72rem;color:var(--tsm);text-transform:uppercase;letter-spacing:.5px}
.sidebar-bottom-toggle{display:none}

/* ---------- layout / reading ---------- */
.main{flex:1;max-width:1000px;margin:0 auto;min-width:0}
.hero{text-align:center;padding:44px 24px 38px;background:linear-gradient(135deg,var(--bgs) 0%,var(--lk) 100%);color:#fff}
.hero h1{font-size:2.1rem;margin-bottom:8px;color:#fff;letter-spacing:-.5px}
.hero p{font-size:.95rem;opacity:.9;margin-bottom:2px}
.hero .sub{font-size:.82rem;opacity:.75}

/* content-visibility:auto was tried here for render speed, but it makes every
   module's height an estimate until scrolled past, which breaks deep anchors
   and reading-position tracking across 170k px of content. */
.module{}
.module-content{padding:34px 44px 12px;background:var(--bgc);transition:background .3s}
.module-content>*:first-child{margin-top:0}
.module-content h1{font-size:1.85rem;margin:0 0 16px;padding-bottom:12px;border-bottom:2px solid var(--bd);line-height:1.25}
.module-content h2{font-size:1.35rem;margin:34px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--bd);scroll-margin-top:12px;line-height:1.3}
.module-content h3{font-size:1.08rem;margin:26px 0 8px;color:var(--tsc);scroll-margin-top:12px;line-height:1.35}
.module-content h4{font-size:1rem;margin:20px 0 6px;color:var(--tsc);scroll-margin-top:12px}
.module-content p{margin:0 0 12px}
.module-content ul,.module-content ol{margin:8px 0 14px 26px}
.module-content li{margin-bottom:5px}
.module-content li>p{margin-bottom:6px}
.module-content blockquote{margin:16px 0;padding:12px 16px;background:var(--bqb);border-left:4px solid var(--bqbdr);border-radius:0 6px 6px 0}
.module-content blockquote p:last-child{margin-bottom:0}
.module-content pre{margin:16px 0;border-radius:8px;overflow-x:auto;background:var(--pb)}
.module-content pre code{display:block;padding:16px;font-size:.85rem;line-height:1.6}
.module-content table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.92rem;display:block;overflow-x:auto}
.module-content td,.module-content th{padding:7px 11px;border:1px solid var(--bd);text-align:left;vertical-align:top}
.module-content th{background:var(--th);font-weight:600;white-space:nowrap}
.module-content tr:nth-child(even){background:var(--tr)}
.module-content hr{margin:30px 0;border:none;border-top:1px solid var(--bd)}
.module-content img{max-width:100%;border-radius:6px}
.glossary h2{font-size:1.5rem;margin-top:24px}
.glossary h3{font-size:1.15rem;margin-top:26px;color:var(--lk)}
.glossary p{margin:0 0 16px}
.glossary .gl-index{line-height:2.1;font-size:.95rem}
.glossary .gl-index a{display:inline-block;min-width:1.5em;text-align:center;font-weight:600}

.toc{margin:18px 0 22px;padding:14px 18px;background:var(--bqb);border:1px solid var(--bd);border-radius:8px}
.toc ol{margin:0 0 0 4px;list-style:none;counter-reset:toc}
.toc li{margin:0}
.toc a{display:block;padding:4px 0;color:var(--lk);text-decoration:none;font-size:.94rem}
.toc a:hover{text-decoration:underline}

.mermaid{text-align:center;margin:18px 0;padding:16px;background:var(--tr);border-radius:8px;border:1px solid var(--bd);overflow-x:auto}

.pager{display:flex;justify-content:space-between;gap:12px;padding:20px 44px 34px;background:var(--bgc);border-top:1px solid var(--bd)}
.pn{display:block;padding:10px 14px;border:1px solid var(--bd);border-radius:8px;text-decoration:none;color:var(--lk);max-width:48%;background:var(--tr)}
.pn span{display:block;font-size:.72rem;color:var(--tsm);margin-bottom:2px}
.pn:hover{border-color:var(--lk)}
.pn.next{text-align:right;margin-left:auto}

#progress{position:fixed;top:0;left:0;height:3px;background:var(--lk);width:0;z-index:1000;transition:width .1s}
#toTop{position:fixed;bottom:20px;right:20px;z-index:997;background:var(--lk);color:#fff;border:none;width:44px;height:44px;border-radius:50%;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);opacity:0;pointer-events:none;transition:opacity .25s}
#toTop.show{opacity:1;pointer-events:auto}

@media print{
  .sidebar,.controls,#toTop,#progress,.pager,.sidebar-bottom-toggle{display:none!important}
  .main{margin:0;max-width:none}
  body{background:#fff}
  .module{page-break-before:always}
  .module-content{padding:0}
  .toc{page-break-after:avoid}
  pre,table,blockquote{page-break-inside:avoid}
}
@media(max-width:860px){
  .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:998}
  .sidebar-overlay.show{display:block}
  .sidebar{position:fixed;top:0;left:0;width:85%;max-width:320px;height:100%;z-index:999;transform:translateX(-100%);transition:transform .3s}
  .sidebar.open{transform:translateX(0)}
  .sidebar-bottom-toggle{display:block;position:fixed;bottom:20px;left:20px;z-index:996;background:var(--lk);color:#fff;border:none;padding:12px 16px;border-radius:30px;font-size:.9rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3)}
  .module-content{padding:20px 16px 8px}
  .pager{padding:16px}
  .hero{padding:32px 16px}
  .hero h1{font-size:1.5rem}
}
${hljsCss}
.hljs{background:var(--pb)!important}
</style>
</head>
<body>
<div id="progress"></div>
<div class="layout" id="top">
  ${sidebar}
  <main class="main" id="main">
    <div class="hero">
      <h1>AI Architect Course</h1>
      <p>${moduleCount} модулей · один день изучения на модуль</p>
      <p class="sub">Node.js · TypeScript · PHP · Python · Go · RAG · агенты · MCP · A2A · API · resilience</p>
    </div>
    ${body}
  </main>
</div>
<button id="toTop" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Наверх">&#8593;</button>
<script type="text/plain" id="mermaid-lib">${mermaidJs.replace(/<\/script>/gi, '<\\/script>')}</script>
<script>
var THEME_LABELS={dark:'По умолчанию',light:'Светлая',sepia:'Сепия',night:'Ночь',terminal:'Терминал',highcontrast:'Контраст',blue:'Синяя'};
var THEME_COLORS={dark:'#1a1a2e',light:'#2c3e50',sepia:'#3d2e1e',night:'#0a0a0f',terminal:'#0c0c0c',highcontrast:'#000',blue:'#1a365d'};
var THEMES=Object.keys(THEME_LABELS);
var fsOffset=0;
var HEADINGS=[];
var CHUNKS=null;
var mermaidLoaded=false;

// Heading index (cheap, built on load): every h1/h2/h3 in the book.
function buildIndex(){
  HEADINGS=[];
  document.querySelectorAll('.module').forEach(function(mod){
    var h1=mod.querySelector('h1');
    var label=h1?h1.textContent.trim():mod.id;
    mod.querySelectorAll('h1[id],h2[id],h3[id]').forEach(function(h){
      HEADINGS.push({id:h.id,t:h.textContent.trim().toLowerCase(),m:label});
    });
  });
}

/**
 * Full-text index, built lazily on the first search keystroke.
 * Splits each section at its h2/h3 boundaries so a hit can jump to the exact
 * subsection that mentions the term, not just the module.
 */
function buildChunks(){
  if(CHUNKS)return CHUNKS;
  CHUNKS=[];
  document.querySelectorAll('.module').forEach(function(mod){
    var h1=mod.querySelector('h1');
    var label=h1?h1.textContent.trim():mod.id;
    var anchor=mod.id;
    var buf=[];
    function flush(){
      var txt=buf.join(' ').replace(/\s+/g,' ').trim();
      if(txt.length>40)CHUNKS.push({a:anchor,m:label,t:txt.toLowerCase()});
      buf=[];
    }
    mod.querySelectorAll('.module-content > *').forEach(function(node){
      var tag=node.tagName;
      if(tag==='H2'||tag==='H3'){flush();anchor=node.id||anchor}
      if(tag==='PRE'||tag==='SCRIPT'||tag==='STYLE')return;
      buf.push(node.textContent||'');
    });
    flush();
  });
  return CHUNKS;
}

function snippet(text,needle){
  var i=text.indexOf(needle);
  if(i<0)return text.slice(0,110)+'…';
  var start=Math.max(0,i-45);
  return (start>0?'…':'')+text.slice(start,start+130)+'…';
}

function searchModules(q){
  var box=document.getElementById('searchResults');
  if(!q||q.length<2){box.classList.remove('active');box.innerHTML='';return}
  var needle=q.trim().toLowerCase();
  var hits=[],seen={};

  HEADINGS.forEach(function(h){
    if(h.t.indexOf(needle)>=0&&!seen[h.id]){seen[h.id]=1;hits.push({id:h.id,kind:'h',label:h.m,text:h.t})}
  });

  var chunks=buildChunks();
  for(var i=0;i<chunks.length&&hits.length<60;i++){
    var c=chunks[i];
    var p=c.t.indexOf(needle);
    if(p>=0&&!seen[c.a+'#'+i]){
      seen[c.a+'#'+i]=1;
      hits.push({id:c.a,kind:'b',label:c.m,text:snippet(c.t,needle)});
    }
  }

  if(!hits.length){box.classList.add('active');box.innerHTML='<div class="sr-empty">Ничего не найдено</div>';return}
  box.classList.add('active');
  box.innerHTML=hits.slice(0,60).map(function(h){
    var label=h.label.length>46?h.label.slice(0,46)+'…':h.label;
    var text=h.text.length>110?h.text.slice(0,110)+'…':h.text;
    return '<a href="#'+h.id+'" onclick="closeSidebar();document.getElementById(\\'searchResults\\').classList.remove(\\'active\\')">'+
      '<span class="sr-mod">'+esc(label)+'</span><br>'+esc(text)+'</a>';
  }).join('');
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}

function initThemeButtons(){
  var c=document.getElementById('themeButtons');
  THEMES.forEach(function(t){
    var b=document.createElement('button');
    b.className='theme-btn';b.dataset.theme=t;b.title=THEME_LABELS[t];b.setAttribute('aria-label','Тема: '+THEME_LABELS[t]);
    b.style.background=THEME_COLORS[t];
    b.onclick=function(){setTheme(t)};
    c.appendChild(b);
  });
}

function setTheme(t){
  document.body.className='theme-'+t;
  localStorage.setItem('course-theme',t);
  document.querySelectorAll('.theme-btn').forEach(function(b){b.classList.toggle('active',b.dataset.theme===t)});
}

function changeFontSize(d){
  fsOffset=Math.max(-4,Math.min(8,fsOffset+d));
  document.documentElement.style.fontSize=(16+fsOffset)+'px';
  document.getElementById('fontSizeLabel').textContent=(100+fsOffset*6.25).toFixed(0)+'%';
  localStorage.setItem('course-fs',fsOffset);
}

/**
 * content-visibility:auto makes offscreen modules skip layout, so their heights
 * are estimates until scrolled past — a deep anchor then lands in the wrong
 * place. Sections are kept measurable and the target is re-aligned until its
 * offset stops moving.
 */
function jumpTo(hash,behavior){
  var el=document.getElementById(hash);
  if(!el)return;
  var frames=0,stable=0,lastTop=NaN;
  requestAnimationFrame(function step(){
    var top=el.getBoundingClientRect().top;
    if(Math.abs(top-lastTop)<1)stable++;else stable=0;
    lastTop=top;
    if(stable>=4||frames++>180)return;
    if(Math.abs(top-12)>1)el.scrollIntoView({block:'start',behavior:frames===0?behavior:'auto'});
    requestAnimationFrame(step);
  });
}

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('overlay').classList.toggle('show')}
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').classList.add('show')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('show')}
function toggleNavSection(el){el.classList.toggle('active');el.nextElementSibling.classList.toggle('active')}

function loadMermaid(){
  if(mermaidLoaded)return;
  mermaidLoaded=true;
  var src=document.getElementById('mermaid-lib').textContent;
  var blob=new Blob([src],{type:'text/javascript'});
  var s=document.createElement('script');
  s.src=URL.createObjectURL(blob);
  s.onload=function(){
    mermaid.initialize({startOnLoad:false,theme:'base',securityLevel:'strict',themeVariables:{primaryColor:'#2563eb',lineColor:'#94a3b8'}});
    mermaid.run({querySelector:'.mermaid'}).catch(function(){});
  };
  document.head.appendChild(s);
}

function initScroll(){
  var bar=document.getElementById('progress');
  var top=document.getElementById('toTop');
  var links={};
  document.querySelectorAll('.nav-section-content a[data-mod]').forEach(function(a){links[a.getAttribute('data-mod')]=a});
  var ticking=false;
  function update(){
    var h=document.documentElement;
    var max=h.scrollHeight-h.clientHeight;
    bar.style.width=(max>0?(h.scrollTop/max*100):0)+'%';
    top.classList.toggle('show',window.scrollY>700);
    var mid=window.scrollY+window.innerHeight*0.3,current=null;
    document.querySelectorAll('.module').forEach(function(s){
      if(s.offsetTop<=mid)current=s.id.replace('module-','');
    });
    Object.keys(links).forEach(function(k){links[k].classList.toggle('current',k===current)});
    ticking=false;
  }
  window.addEventListener('scroll',function(){
    if(!ticking){requestAnimationFrame(update);ticking=true}
  },{passive:true});
  window.addEventListener('resize',update);
  update();
}

document.addEventListener('DOMContentLoaded',function(){
  initThemeButtons();
  var s=localStorage.getItem('course-theme')||'dark';
  var f=parseInt(localStorage.getItem('course-fs')||'0',10)||0;
  document.body.className='theme-'+s;
  document.documentElement.style.fontSize=(16+f)+'px';
  document.getElementById('fontSizeLabel').textContent=(100+f*6.25).toFixed(0)+'%';
  document.querySelectorAll('.theme-btn').forEach(function(b){if(b.dataset.theme===s)b.classList.add('active')});
  fsOffset=f;
  buildIndex();
  initScroll();
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')closeSidebar();
    if(e.key==='/'&&document.activeElement.id!=='search'){e.preventDefault();openSidebar();document.getElementById('search').focus()}
  });

  // Route every in-page anchor through jumpTo so deep links land correctly.
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href^="#"]');
    if(!a)return;
    var hash=a.getAttribute('href').slice(1);
    if(!hash)return;
    if(!document.getElementById(hash))return;
    e.preventDefault();
    if(history.replaceState)history.replaceState(null,'','#'+encodeURIComponent(hash));
    closeSidebar();
    jumpTo(hash,'smooth');
  });

  if(location.hash.length>1){
    var initial=decodeURIComponent(location.hash.slice(1));
    if(document.getElementById(initial))jumpTo(initial,'auto');
  }
  // Only 9 diagrams exist in the whole book, and they sit inside sections
  // hidden by content-visibility:auto — so IntersectionObserver never reports
  // them as intersecting. Defer to idle instead: the 2.5 MB parser blob stays
  // off the critical path but reliably loads.
  if(document.querySelector('.mermaid')){
    if(window.requestIdleCallback)requestIdleCallback(loadMermaid,{timeout:2000});
    else setTimeout(loadMermaid,600);
  }
});
</script>
</body>
</html>`;

  writeFileSync(OUTPUT, html, 'utf-8');
  const size = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1);
  console.log(`Done. ${moduleCount} modules + glossary + 3 reference pages -> course.html (${size} MB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
