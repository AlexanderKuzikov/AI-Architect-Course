import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
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

function moduleToHtml(module, md) {
  let html = md.render(module.content);
  for (const [num, m] of Object.entries(MODULES)) {
    const n = String(num).padStart(2, '0');
    html = html.replaceAll(`href="../${m.dir}/README.md"`, `href="#module-${n}"`);
    html = html.replaceAll(`href="../${m.dir}/GLOSSARY.md"`, `href="#glossary"`);
  }
  return `<div class="module" id="module-${String(module.num).padStart(2, '0')}"><div class="module-content">${html}</div></div>`;
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
  ];

  let h = `<div class="sidebar-overlay" onclick="closeSidebar()"></div>`;
  h += `<nav class="sidebar" id="sidebar"><div class="sidebar-header">`;
  h += `<h2>AI Architect Course</h2>`;
  h += `<button class="sidebar-toggle" onclick="closeSidebar()" aria-label="Close sidebar">\u2715</button></div>`;

  h += `<input type="text" id="search" placeholder="Search..." oninput="searchModules(this.value)" onfocus="openSidebar()"><div class="search-results" id="searchResults"></div>`;

  h += `<div class="controls"><div class="control-group"><label>Theme</label><div class="theme-buttons" id="themeButtons"></div></div>`;
  h += `<div class="control-group"><label>Size</label><div class="fs-controls"><button onclick="changeFontSize(-1)">A\u2212</button><span id="fontSizeLabel">100%</span><button onclick="changeFontSize(1)">A+</button></div></div></div>`;

  h += `<div class="nav-section"><div class="nav-section-title active" onclick="toggleNavSection(this)">Quick Reference</div>`;
  h += `<div class="nav-section-content active">`;
  h += `<a href="#glossary">Glossary</a>`;
  h += `<a href="#architecture-landscape" onclick="openSidebar()">Architecture Landscape</a>`;
  h += `<a href="#tools-comparison" onclick="openSidebar()">Tools Comparison</a>`;
  h += `<a href="#adr-template" onclick="openSidebar()">ADR Template</a>`;
  h += `</div></div>`;

  h += `<div class="nav-section"><div class="nav-section-title active" onclick="toggleNavSection(this)">Modules</div>`;
  h += `<div class="nav-section-content active">`;
  for (const track of tracks) {
    h += `<div class="nav-track-label">${track.name}</div>`;
    for (let i = track.range[0]; i <= track.range[1]; i++) {
      const m = MODULES[i];
      if (m) h += `<a href="#module-${String(i).padStart(2, '0')}" onclick="closeSidebar()">${String(i).padStart(2, '0')} ${m.name}</a>`;
    }
  }
  h += `<a href="#glossary" class="nav-glossary-link" onclick="closeSidebar()">Glossary</a>`;
  h += `</div></div>`;
  h += `<button class="sidebar-bottom-toggle" onclick="toggleSidebar()">\u2630 Menu</button>`;
  h += `</nav>`;
  return h;
}

function buildGlossary(md) {
  const path = join(ROOT, 'GLOSSARY.md');
  if (!existsSync(path)) return '';
  let content = readFileSync(path, 'utf-8');
  for (const [num, m] of Object.entries(MODULES)) {
    const n = String(num).padStart(2, '0');
    content = content.replaceAll(`](../${m.dir}/README.md)`, `](#module-${n})`);
  }
  return `<div class="module" id="glossary"><div class="module-content glossary">${md.render(content)}</div></div>`;
}

async function main() {
  console.log('Building course HTML...');

  const MarkdownIt = (await import('markdown-it')).default;
  const hljsCss = readFile('assets/highlight-github-dark.min.css');
  const mermaidJs = readFile('assets/mermaid.min.js');

  const md = new MarkdownIt({
    html: true, linkify: true, typographer: true,
    highlight: (str, lang) => {
      if (lang === 'mermaid') return `<div class="mermaid">${str}</div>`;
      try {
        const hljs = _require('highlight.js');
        if (lang && hljs.getLanguage(lang))
          return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {}
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    },
  });

  let body = '';
  let moduleCount = 0;
  for (let i = 1; i <= 47; i++) {
    const module = readModule(i);
    if (module?.content) { body += moduleToHtml(module, md); moduleCount++; }
    process.stdout.write(`\r  ${i}/47 modules`);
  }
  body += buildGlossary(md);

  // Build extra pages from markdown (injected as hidden anchors + content)
  const extraPages = [
    { id: 'architecture-landscape', file: 'ARCHITECTURE_LANDSCAPE.md' },
    { id: 'tools-comparison', file: 'TOOLS_COMPARISON.md' },
    { id: 'adr-template', file: 'ADR_TEMPLATE.md' },
  ];
  for (const page of extraPages) {
    let content = readFile(page.file);
    if (content) {
      // Rewrite module links in extra pages too
      for (const [num, m] of Object.entries(MODULES)) {
        const n = String(num).padStart(2, '0');
        content = content.replaceAll(`../${m.dir}/README.md`, `#module-${n}`);
        content = content.replaceAll(`../${m.dir}/GLOSSARY.md`, `#glossary`);
      }
      body += `<div class="module" id="${page.id}"><div class="module-content">${md.render(content)}</div></div>`;
    }
  }

  process.stdout.write('\n');

  const sidebar = buildSidebar();
  const mermaidSafe = mermaidJs.replace(/<\/script>/gi, '<\\/script>');

  const themeVars = `:root{--bg:#f8f9fa;--bgc:#fff;--bgs:#1a1a2e;--bgsh:#16162a;--tc:#1a1a2e;--tsc:#555;--ts:#e0e0e0;--tsm:#888;--lk:#2563eb;--bd:#e5e7eb;--bds:#2a2a3e;--bqb:#eef2f7;--bqbdr:#2563eb;--cb:#eef2f7;--pb:#1e1e2e;--th:#f3f4f6;--tr:#fafbfc;--fs:16px}
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
<title>AI Architect Course</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;line-height:1.7;color:var(--tc);background:var(--bg);font-size:var(--fs);transition:background .3s,color .3s}
${themeVars}a{color:var(--lk)}
code{font-family:'JetBrains Mono','Fira Code',monospace;font-size:.9em;padding:.15em .3em;border-radius:3px;background:var(--cb)}
pre code{padding:0;background:0 0}
.layout{display:flex;min-height:100vh}
.sidebar-overlay{display:none}
.sidebar{width:280px;min-width:280px;background:var(--bgs);color:var(--ts);overflow-y:auto;position:sticky;top:0;height:100vh;border-right:1px solid var(--bds);transition:margin-left .3s,background .3s,z-index .3s}
.sidebar-header{display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid var(--bds);background:var(--bgsh)}
.sidebar-header h2{font-size:.95rem;color:var(--lk);font-weight:700}
.sidebar-toggle{background:0 0;border:none;color:var(--tsm);font-size:1.2rem;cursor:pointer;line-height:1;padding:2px}
.sidebar-toggle:hover{color:var(--ts)}
#search{width:calc(100% - 24px);margin:10px 12px;padding:6px 10px;border:1px solid var(--bds);border-radius:6px;background:var(--bgsh);color:var(--ts);font-size:.8rem;outline:0}
#search:focus{border-color:var(--lk)}
.search-results{max-height:0;overflow:hidden;transition:max-height .2s}
.search-results.active{max-height:250px;overflow-y:auto}
.search-results a{display:block;padding:4px 14px;font-size:.8rem;color:var(--tsm);cursor:pointer}
.search-results a:hover{background:var(--bds);color:var(--ts)}
.controls{padding:8px 12px;border-bottom:1px solid var(--bds);display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:.75rem}
.control-group{display:flex;align-items:center;gap:4px}
.control-group label{color:var(--tsm)}
.theme-buttons{display:flex;gap:3px}
.theme-btn{width:16px;height:16px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}
.theme-btn.active{border-color:var(--lk)}
.fs-controls{display:flex;align-items:center;gap:4px}
.fs-controls button{background:var(--bds);border:none;color:var(--ts);width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:.8rem;line-height:1}
.fs-controls button:hover{background:var(--lk)}
.fs-controls span{color:var(--tsm);font-size:.8rem;min-width:30px;text-align:center}
.nav-section{border-bottom:1px solid var(--bds)}
.nav-section-title{padding:8px 14px;font-size:.8rem;font-weight:600;color:var(--tsm);cursor:pointer;user-select:none}
.nav-section-title::before{content:'\\25B8';margin-right:6px;font-size:.75rem}
.nav-section-title.active::before{content:'\\25BE'}
.nav-section-content{display:none}
.nav-section-content.active{display:block}
.nav-section-content a{display:block;padding:3px 14px 3px 28px;font-size:.78rem;color:var(--tsm);cursor:pointer;text-decoration:none}
.nav-section-content a:hover{background:var(--bds);color:var(--ts)}
.nav-track-label{font-weight:600;padding:8px 14px 2px;font-size:.75rem;color:var(--tsm);text-transform:uppercase;letter-spacing:.5px}
.nav-glossary-link{display:block!important;padding:5px 14px 5px 28px!important;font-size:.78rem!important;color:var(--lk)!important;font-weight:600;margin-top:6px}
.sidebar-bottom-toggle{display:none}
.main{flex:1;max-width:900px;margin:0 auto;min-width:0}
.module-content{padding:28px 36px;background:var(--bgc);margin:0 0 1px;transition:background .3s}
.module-content h1{font-size:1.8rem;margin:0 0 14px;padding-bottom:10px;border-bottom:2px solid var(--bd);color:var(--tc)}
.module-content h2{font-size:1.35rem;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--bd);color:var(--tc)}
.module-content h3{font-size:1.1rem;margin:22px 0 8px;color:var(--tsc)}
.module-content h4{font-size:1rem;margin:18px 0 6px;color:var(--tsc)}
.module-content p{margin:0 0 10px}
.module-content blockquote{margin:14px 0;padding:10px 14px;background:var(--bqb);border-left:4px solid var(--bqbdr);border-radius:0 6px 6px 0}
.module-content blockquote p:last-child{margin-bottom:0}
.module-content pre{margin:14px 0;border-radius:8px;overflow-x:auto;background:var(--pb)}
.module-content pre code{display:block;padding:14px;font-size:.85rem;background:0 0}
.module-content ul,.module-content ol{margin:6px 0 10px 24px}
.module-content li{margin-bottom:3px}
.module-content table{width:100%;border-collapse:collapse;margin:14px 0}
.module-content td,.module-content th{padding:6px 10px;border:1px solid var(--bd);text-align:left}
.module-content th{background:var(--th);font-weight:600}
.module-content tr:nth-child(even){background:var(--tr)}
.module-content hr{margin:28px 0;border:none;border-top:1px solid var(--bd)}
.module-content img{max-width:100%;border-radius:6px}
.glossary h2{font-size:1.5rem;margin-top:18px}
.glossary h3{font-size:1.15rem;margin-top:22px;color:var(--lk)}
.glossary p{margin:0 0 14px}
.mermaid{text-align:center;margin:18px 0;padding:14px;background:var(--tr);border-radius:8px;border:1px solid var(--bd)}
.hero{text-align:center;padding:32px 20px;background:linear-gradient(135deg,var(--bgs) 0%,var(--lk) 100%);color:#fff;border-radius:0 0 20px 20px;margin-bottom:1px}
.hero h1{font-size:2rem;margin-bottom:6px;border:none;color:#fff}
.hero p{font-size:.95rem;opacity:.85}
@media print{.sidebar,.controls{display:none}.main{margin:0;max-width:none}}
@media(max-width:768px){
.sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:998}
.sidebar-overlay.show{display:block}
.sidebar{position:fixed;top:0;left:0;width:85%;max-width:320px;height:100%;z-index:999;transform:translateX(-100%);transition:transform .3s}
.sidebar.open{transform:translateX(0)}
.sidebar.open+.sidebar-overlay{display:block}
.sidebar-bottom-toggle{display:block;position:fixed;bottom:20px;right:20px;z-index:997;background:var(--lk);color:#fff;border:none;padding:12px 16px;border-radius:30px;font-size:.9rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.module-content{padding:16px 14px}
}
${hljsCss}
.hljs{background:var(--pb)!important}
</style>
</head>
<body>
<div class="layout">
  ${sidebar}
  <main class="main" id="main">
    <div class="hero">
      <h1>AI Architect Course</h1>
      <p>${moduleCount} modules</p>
    </div>
    ${body}
  </main>
</div>
<script>${mermaidSafe}</script>
<script>
document.addEventListener('DOMContentLoaded',function(){
  if(window.mermaid)mermaid.initialize({startOnLoad:true,theme:'base',themeVariables:{primaryColor:'#2563eb',lineColor:'#94a3b8'}});
  initThemeButtons();
  var s=localStorage.getItem('course-theme')||'dark',f=parseInt(localStorage.getItem('course-fs'))||0;
  document.body.className='theme-'+s;
  if(f)document.documentElement.style.fontSize=(16+f)+'px';
  document.getElementById('fontSizeLabel').textContent=(100+f*6.25).toFixed(0)+'%';
  document.querySelectorAll('.theme-btn').forEach(function(b){if(b.dataset.theme===s)b.classList.add('active')});
  // Scroll handler for sidebar mobile close
  var ticking=false;
  document.addEventListener('scroll',function(){
    if(!ticking){requestAnimationFrame(function(){
      var s=document.getElementById('sidebar');
      s.classList.toggle('scrolled',window.scrollY>100)
    });ticking=false}
  });
  // Auto-close sidebar on anchor click via scroll handling
  var lastClose=0;
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var href=this.getAttribute('href');
      if(href&&href.length>1&&document.getElementById(href.substring(1))){
        closeSidebar();
      }
    });
  });
});
function initThemeButtons(){
  var c=document.getElementById('themeButtons'),t=['dark','light','sepia','night','terminal','highcontrast','blue'];
  var l={dark:'Default',light:'Light',sepia:'Sepia',night:'Night',terminal:'Terminal',highcontrast:'High C',blue:'Blue'};
  var o={dark:'#1a1a2e',light:'#2c3e50',sepia:'#3d2e1e',night:'#0a0a0f',terminal:'#0c0c0c',highcontrast:'#000',blue:'#1a365d'};
  t.forEach(function(t){
    var b=document.createElement('button');b.className='theme-btn';b.dataset.theme=t;b.title=l[t];b.style.background=o[t];
    b.onclick=function(){setTheme(t)};c.appendChild(b);
  });
}
function setTheme(t){document.body.className='theme-'+t;localStorage.setItem('course-theme',t);
  document.querySelectorAll('.theme-btn').forEach(function(b){b.classList.toggle('active',b.dataset.theme===t)})}
function changeFontSize(d){fs=Math.max(-4,Math.min(6,fs+d));
  document.documentElement.style.fontSize=(16+fs)+'px';
  document.getElementById('fontSizeLabel').textContent=(100+fs*6.25).toFixed(0)+'%';
  localStorage.setItem('course-fs',fs)}
var fs=0;
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open')}
function openSidebar(){document.getElementById('sidebar').classList.add('open')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open')}
function toggleNavSection(el){el.classList.toggle('active');el.nextElementSibling.classList.toggle('active')}
function searchModules(q){
  var r=document.getElementById('searchResults');
  if(!q||q.length<2){r.classList.remove('active');r.innerHTML='';return}
  r.classList.add('active');
  var items=document.querySelectorAll('.module-content h1,.module-content h2'),html='';
  items.forEach(function(h){
    if(h.textContent.toLowerCase().indexOf(q.toLowerCase())>=0){
      var id=h.closest('.module')&&h.closest('.module').id||'';
      html+='<a href="#'+id+'" onclick="closeSidebar();document.getElementById(\'searchResults\').classList.remove(\'active\')">'+h.textContent.substring(0,100)+'</a>';
    }
  });
  r.innerHTML=html||'<div style="padding:6px 14px;color:var(--tsm)">Nothing found</div>';
}
</script>
</body>
</html>`;

  writeFileSync(OUTPUT, html, 'utf-8');
  const size = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1);
  console.log(`Done. ${moduleCount} modules + glossary + docs -> course.html (${size} MB)`);
}

main().catch(console.error);
