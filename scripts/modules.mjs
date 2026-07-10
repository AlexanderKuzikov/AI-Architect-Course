// Module number → directory name mapping
const MODULES = {
  1:  { dir: '01-javascript-nodejs',        name: 'JavaScript / Node.js' },
  2:  { dir: '02-typescript',               name: 'TypeScript' },
  3:  { dir: '03-php',                      name: 'PHP' },
  4:  { dir: '04-python',                   name: 'Python' },
  5:  { dir: '05-go',                       name: 'Go' },
  6:  { dir: '06-prompt-engineering',        name: 'Prompt Engineering' },
  7:  { dir: '07-json-schema',               name: 'JSON Schema / Structured Output' },
  8:  { dir: '08-local-inference',           name: 'Local Inference' },
  9:  { dir: '09-evaluator-benchmark',       name: 'Evaluator / Benchmark Design' },
  10: { dir: '10-prompt-engineering-vlm',    name: 'Prompt Engineering (VLM)' },
  11: { dir: '11-multi-model-orchestration', name: 'Multi-model Orchestration' },
  12: { dir: '12-rag',                      name: 'RAG' },
  13: { dir: '13-fine-tuning',              name: 'Fine-tuning / LoRA' },
  14: { dir: '14-ooxml',                    name: 'OOXML / DOCX internals' },
  15: { dir: '15-pdf-internals',            name: 'PDF internals' },
  16: { dir: '16-pdfium-wasm',              name: 'PDFium WASM' },
  17: { dir: '17-xlsx-internals',           name: 'Excel / XLSX internals' },
  18: { dir: '18-task-queues',              name: 'Task Queues' },
  19: { dir: '19-http-clients',             name: 'HTTP Clients / Retry' },
  20: { dir: '20-backend-caching',          name: 'Backend Caching' },
  21: { dir: '21-testing',                  name: 'Testing' },
  22: { dir: '22-worker-threads',           name: 'Worker Threads / Piscina' },
  23: { dir: '23-rate-limiting',            name: 'Rate Limiting' },
  24: { dir: '24-docker',                   name: 'Docker' },
  25: { dir: '25-cicd',                     name: 'CI/CD (GitHub Actions)' },
  26: { dir: '26-logging',                  name: 'Logging / Observability' },
  27: { dir: '27-static-site',              name: 'Static Site Generation' },
  28: { dir: '28-core-web-vitals-intro',    name: 'Core Web Vitals: intro' },
  29: { dir: '29-critical-css',             name: 'Critical CSS' },
  30: { dir: '30-schema-org',               name: 'Schema.org / Structured Data' },
  31: { dir: '31-mobile-first-css',         name: 'Mobile-first CSS' },
  32: { dir: '32-accessibility',            name: 'Accessibility / WCAG' },
  33: { dir: '33-web-performance-api',       name: 'Web Performance API' },
  34: { dir: '34-lazy-loading',             name: 'Lazy Loading / Intersection Observer' },
  35: { dir: '35-image-optimization',       name: 'Image Optimization' },
  36: { dir: '36-critical-rendering-path',  name: 'Critical Rendering Path / CSS' },
  37: { dir: '37-js-performance',           name: 'JavaScript Performance / Memory' },
  38: { dir: '38-http-service-worker-caching', name: 'HTTP / Service Worker Caching' },
  39: { dir: '39-core-web-vitals-diagnostics-rum', name: 'CWV Diagnostics / RUM' },
  40: { dir: '40-performance-budget',       name: 'Performance Budget' },
  41: { dir: '41-mcp-tool-server-architecture', name: 'MCP Tool Server Architecture' },
  42: { dir: '42-a2a-protocol',             name: 'A2A Protocol / Multi-Agent' },
  43: { dir: '43-agent-memory-knowledge-graphs', name: 'Agent Memory / Knowledge Graphs' },
  44: { dir: '44-browser-use-computer-use', name: 'Browser Use / Computer Use' },
  45: { dir: '45-agentic-rag-graph-rag',    name: 'Agentic RAG / Graph RAG' },
  46: { dir: '46-agentops',                 name: 'AgentOps' },
  47: { dir: '47-ai-security-agents',       name: 'AI Security для агентов' },
};

function moduleLink(n) {
  const m = MODULES[n];
  return m ? `[Модуль ${n}](../${m.dir}/README.md)` : `Модуль ${n}`;
}

function moduleLinks(nums) {
  return nums.split(', ').map(n => {
    const num = parseInt(n);
    const m = MODULES[num];
    return m ? `[Модуль ${num}](../${m.dir}/README.md)` : `Модуль ${num}`;
  }).join(', ');
}

export { MODULES, moduleLink, moduleLinks };
