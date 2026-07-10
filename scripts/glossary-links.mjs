// Converts module references in GLOSSARY.md to clickable links
// (Модуль 42) → [Модуль 42](../42-a2a-protocol/README.md)
// (Модули 12, 45) → [Модули 12](../12-rag/README.md), [45](../45-agentic-rag-graph-rag/README.md)

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MODULES } from './modules.mjs';

const PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'GLOSSARY.md');
let content = readFileSync(PATH, 'utf-8');

// Pattern: (Модуль N) or (Модули N, M, ...)
// Replace with clickable links

// First: (Модули 01, 18) — multi-module
content = content.replace(
  /\(Модули\s+([\d,\s]+)\)/g,
  (match, nums) => {
    const parts = nums.split(',').map(s => s.trim()).filter(Boolean);
    const links = parts.map(n => {
      const m = MODULES[parseInt(n)];
      return m ? `[Модуль ${n}](../${m.dir}/README.md)` : `Модуль ${n}`;
    });
    return '(' + links.join(', ') + ')';
  }
);

// Second: (Модуль 42) — single module
content = content.replace(
  /\(Модуль\s+(\d+)\)/g,
  (match, n) => {
    const m = MODULES[parseInt(n)];
    return m ? `([Модуль ${n}](../${m.dir}/README.md))` : match;
  }
);

writeFileSync(PATH, content, 'utf-8');
console.log('GLOSSARY.md: module references converted to links.');
