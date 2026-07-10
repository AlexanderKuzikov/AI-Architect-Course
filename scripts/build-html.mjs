import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { MODULES } from './modules.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'index.html');

// Ensure dependencies are installed
function ensureDeps() {
  try {
    require.resolve('markdown-it');
  } catch {
    console.log('Installing dependencies...');
    execSync('npm init -y', { cwd: __dirname, stdio: 'pipe' });
    execSync('npm install markdown-it highlight.js', { cwd: __dirname, stdio: 'pipe' });
    console.log('Dependencies installed.');
  }
}

// Read a module's README.md
function readModule(n) {
  const m = MODULES[n];
  if (!m) return null;
  const path = join(ROOT, m.dir, 'README.md');
  try {
    return { num: n, ...m, content: readFileSync(path, 'utf-8') };
  } catch {
    return { num: n, ...m, content: '' };
  }
}

// Build HTML for one module
function moduleToHtml(module, md) {
  const html = md.render(module.content);
  return `
    <div class="module" id="module-${String(module.num).padStart(2, '0')}">
      <div class="module-content">
        ${html}
      </div>
    </div>
  `;
}

// Generate navigation structure
function buildNav() {
  const tracks = [
    { name: 'Languages',         range: [1, 5] },
    { name: 'AI Foundation',     range: [6, 10] },
    { name: 'AI Systems',        range: [11, 13] },
    { name: 'Documents',         range: [14, 17] },
    { name: 'Infrastructure',    range: [18, 26] },
    { name: 'Web Performance',   range: [27, 40] },
    { name: 'Agent Systems',     range: [41, 47] },
  ];

  let toc = '<nav class="sidebar" id="sidebar">';
  toc += '<div class="sidebar-header">';
  toc += '<h2>AI Architect Course</h2>';
  toc += '<button class="sidebar-toggle" onclick="toggleSidebar()">✕</button></div>';

  // Search
  toc += '<input type="text" id="search" placeholder="Search..." oninput="searchModules(this.value)">';
  toc += '<div class="search-results" id="searchResults"></div>';

  // Quick links
  toc += '<div class="nav-section"><div class="nav-section-title" onclick="toggleNavSection(this)">Quick Reference</div>';
  toc += '<div class="nav-section-content">';
  toc += '<a href="../QUICKREF.md" target="_blank">📋 QuickRef</a>';
  toc += '<a href="../ARCHITECTURE_LANDSCAPE.md" target="_blank">🗺️ Landscape</a>';
  toc += '<a href="../TOOLS_COMPARISON.md" target="_blank">🔧 Tools</a>';
  toc += '<a href="../GLOSSARY.md" target="_blank">📖 Glossary</a>';
  toc += '<a href="../ADR_TEMPLATE.md" target="_blank">📝 ADR Template</a>';
  toc += '</div></div>';

  // Tracks
  for (const track of tracks) {
    toc += `<div class="nav-section"><div class="nav-section-title" onclick="toggleNavSection(this)">${track.name}</div>`;
    toc += '<div class="nav-section-content">';
    for (let i = track.range[0]; i <= track.range[1]; i++) {
      const m = MODULES[i];
      if (m) {
        toc += `<a href="#module-${String(i).padStart(2, '0')}">${String(i).padStart(2, '0')} ${m.name}</a>`;
      }
    }
    toc += '</div></div>';
  }

  toc += '</nav>';
  return toc;
}

// Build the glossary
function buildGlossary(md) {
  const path = join(ROOT, 'GLOSSARY.md');
  if (!existsSync(path)) return '';
  const content = readFileSync(path, 'utf-8');
  // First line is the H1, skip it for sidebar nav
  return `<div class="module" id="glossary">
    <div class="module-content glossary">
      ${md.render(content)}
    </div>
  </div>`;
}

// Generate the main HTML
async function main() {
  console.log('Building course HTML...');

  // Dynamic import of markdown-it (ESM)
  const MarkdownIt = (await import('markdown-it')).default;
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      if (lang === 'mermaid') {
        return `<div class="mermaid">${str}</div>`;
      }
      try {
        const hljs = require('highlight.js');
        if (lang && hljs.getLanguage(lang)) {
          return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
        }
      } catch {}
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    },
  });

  // Render all modules
  let body = '';
  let moduleCount = 0;

  for (let i = 1; i <= 47; i++) {
    const module = readModule(i);
    if (module && module.content) {
      body += moduleToHtml(module, md);
      moduleCount++;
      process.stdout.write(`\r  ${i}/47 modules`);
    }
  }

  // Add glossary
  body += buildGlossary(md);

  process.stdout.write('\n');

  // Build navigation
  const nav = buildNav();

  // Generate full HTML
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Architect Course</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/styles/github-dark.min.css">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
         line-height: 1.7; color: #1a1a2e; background: #f8f9fa; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.9em;
         padding: 0.15em 0.3em; border-radius: 3px; background: #eef2f7; }
  pre code { padding: 0; background: none; }

  .layout { display: flex; min-height: 100vh; }

  /* Sidebar */
  .sidebar { width: 300px; min-width: 300px; background: #1a1a2e; color: #e0e0e0;
             padding: 0; overflow-y: auto; position: sticky; top: 0; height: 100vh;
             border-right: 1px solid #2a2a3e; transition: margin-left 0.3s; }
  .sidebar-header { display: flex; justify-content: space-between; align-items: center;
                    padding: 18px 16px; border-bottom: 1px solid #2a2a3e;
                    background: #16162a; }
  .sidebar-header h2 { font-size: 1rem; color: #fff; font-weight: 700; }
  .sidebar-toggle { background: none; border: none; color: #888; font-size: 1.2rem;
                    cursor: pointer; padding: 4px; line-height: 1; }
  .sidebar-toggle:hover { color: #fff; }

  #search { width: calc(100% - 32px); margin: 12px 16px; padding: 8px 12px;
            border: 1px solid #3a3a5e; border-radius: 6px; background: #16162a;
            color: #e0e0e0; font-size: 0.85rem; outline: none; }
  #search:focus { border-color: #2563eb; }

  .search-results { max-height: 0; overflow: hidden; transition: max-height 0.2s; }
  .search-results.active { max-height: 300px; overflow-y: auto; }

  .nav-section { border-bottom: 1px solid #2a2a3e; }
  .nav-section-title { padding: 12px 16px; font-size: 0.85rem; font-weight: 600;
                       color: #aaa; cursor: pointer; user-select: none;
                       display: flex; align-items: center; }
  .nav-section-title:hover { color: #fff; }
  .nav-section-title::before { content: '▸'; margin-right: 8px; font-size: 0.8rem; }
  .nav-section-title.active::before { content: '▾'; }
  .nav-section-content { display: none; padding: 0 0 8px 0; }
  .nav-section-content.active { display: block; }
  .nav-section-content a { display: block; padding: 5px 16px 5px 32px;
                           font-size: 0.8rem; color: #b0b0c8; transition: background 0.1s; }
  .nav-section-content a:hover { background: #2a2a4e; color: #fff; text-decoration: none; }

  /* Main content */
  .main { flex: 1; padding: 0; max-width: 900px; margin: 0 auto; }

  .module { margin: 0; }
  .module-content { padding: 32px 40px; }
  .module-content h1 { font-size: 1.8rem; margin: 0 0 16px 0; padding-bottom: 12px;
                       border-bottom: 2px solid #e5e7eb; color: #111; }
  .module-content h2 { font-size: 1.35rem; margin: 32px 0 12px 0; padding-bottom: 8px;
                       border-bottom: 1px solid #e5e7eb; color: #1a1a2e; }
  .module-content h3 { font-size: 1.1rem; margin: 24px 0 8px 0; color: #2d2d4e; }
  .module-content h4 { font-size: 1rem; margin: 20px 0 8px 0; color: #3d3d5e; }
  .module-content p { margin: 0 0 12px 0; }
  .module-content blockquote { margin: 16px 0; padding: 12px 16px; background: #eef2f7;
                                border-left: 4px solid #2563eb; border-radius: 0 6px 6px 0; }
  .module-content blockquote p:last-child { margin-bottom: 0; }
  .module-content pre { margin: 16px 0; border-radius: 8px; overflow-x: auto;
                        background: #1e1e2e; }
  .module-content pre code { display: block; padding: 16px; font-size: 0.85rem; }
  .module-content ul, .module-content ol { margin: 8px 0 12px 24px; }
  .module-content li { margin-bottom: 4px; }
  .module-content table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .module-content th, .module-content td { padding: 8px 12px; border: 1px solid #d1d5db;
                                            text-align: left; }
  .module-content th { background: #f3f4f6; font-weight: 600; }
  .module-content tr:nth-child(even) { background: #fafbfc; }
  .module-content hr { margin: 32px 0; border: none; border-top: 1px solid #e5e7eb; }
  .module-content img { max-width: 100%; border-radius: 6px; }
  .module-content blockquote > blockquote { margin: 8px 0; padding: 8px 12px;
                                            background: #f9fafb; border-left-color: #9ca3af; }
  .module-content blockquote:first-child { margin-top: 0; }
  .module-content h1 + p, .module-content h2 + p, .module-content h3 + p { margin-top: 0; }

  /* Glossary specific */
  .glossary h2 { font-size: 1.5rem; margin-top: 20px; }
  .glossary h3 { font-size: 1.2rem; margin-top: 24px; color: #2563eb; }
  .glossary p { margin: 0 0 16px 0; }
  .glossary strong { color: #1a1a2e; }

  /* Mermaid */
  .mermaid { text-align: center; margin: 20px 0; padding: 16px; background: #fafbfc;
             border-radius: 8px; border: 1px solid #e5e7eb; }

  /* Code */
  .hljs { background: #1e1e2e !important; }

  /* Print */
  @media print {
    .sidebar { display: none; }
    .main { margin: 0; max-width: none; }
    .module { page-break-inside: avoid; }
  }

  /* Mobile */
  @media (max-width: 768px) {
    .sidebar { position: fixed; z-index: 1000; width: 100%; height: 100%;
               margin-left: -100%; }
    .sidebar.open { margin-left: 0; }
    .module-content { padding: 20px 16px; }
  }
</style>
</head>
<body>
<div class="layout">
  ${nav}
  <main class="main" id="main">
    <div style="text-align: center; padding: 32px 20px; background: linear-gradient(135deg, #1a1a2e 0%, #2563eb 100%); color: white; border-radius: 0 0 20px 20px;">
      <h1 style="font-size: 2rem; margin-bottom: 8px; border: none;">AI Architect Course</h1>
      <p style="font-size: 1rem; opacity: 0.85;">${moduleCount} модулей · Курс по современному технологическому стеку для AI-архитекторов</p>
      <p style="margin-top: 8px; font-size: 0.85rem; opacity: 0.7;">
        <a href="../GLOSSARY.md" style="color: #93c5fd;">📖 Glossary</a> ·
        <a href="../QUICKREF.md" style="color: #93c5fd;">📋 QuickRef</a>
      </p>
    </div>
    ${body}
  </main>
</div>
<script>
// Mermaid
document.addEventListener('DOMContentLoaded', () => {
  const mermaids = document.querySelectorAll('.mermaid');
  if (mermaids.length > 0 && window.mermaid) {
    mermaid.initialize({ startOnLoad: true, theme: 'base',
      themeVariables: { primaryColor: '#2563eb', lineColor: '#94a3b8' } });
  }
});

// Sidebar toggle for mobile
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Nav section toggle
function toggleNavSection(el) {
  el.classList.toggle('active');
  const content = el.nextElementSibling;
  content.classList.toggle('active');
}

// Open first section by default
document.addEventListener('DOMContentLoaded', () => {
  const first = document.querySelector('.nav-section-title');
  if (first) { first.classList.add('active'); first.nextElementSibling.classList.add('active'); }
});

// Simple search
function searchModules(query) {
  const results = document.getElementById('searchResults');
  if (!query || query.length < 2) { results.classList.remove('active'); results.innerHTML = ''; return; }
  results.classList.add('active');

  const items = document.querySelectorAll('.module-content h1, .module-content h2');
  let html = '';
  items.forEach(h => {
    const text = h.textContent.toLowerCase();
    if (text.includes(query.toLowerCase())) {
      const id = h.closest('.module')?.id || '';
      const title = h.textContent.substring(0, 100);
      html += '<a href="#' + id + '" onclick="document.getElementById(&quot;searchResults&quot;).classList.remove(&quot;active&quot;)">' + title + '</a>';
    }
  });
  results.innerHTML = html || '<div style="padding: 8px 16px; color: #888;">Nothing found</div>';
}
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.1/mermaid.min.js"></script>
</body>
</html>`;

  writeFileSync(OUTPUT, html, 'utf-8');

  console.log(`✅ Done. ${moduleCount} modules + glossary in index.html`);
  console.log(`📁 ${OUTPUT}`);
}

main().catch(console.error);

import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
