# Модуль 40 — Performance Budget и CI Регрессии

> **Для AI-архитектора:** Performance budget — не про красивые числа в документации. Это gate в CI который блокирует merge при регрессии. Без автоматического enforcement бюджет существует только на бумаге: за 6 месяцев без проверок JS bundle вырастает в 3–5 раз (типичная траектория). Архитектурный вопрос: что проверять в CI — bundle size (быстро, детерминировано) или Lighthouse score (медленно, шумно). Ответ: оба, с разными стратегиями и разными порогами fail vs warn.
> Один день изучения — определение бюджетов, bundle size CI (BundleMon / size-limit), Lighthouse CI в GitHub Actions, стратегии fail vs warn, анализ bundle через rollup-plugin-visualizer.

---

## Содержание

1. [Что такое performance budget](#1-budget)
2. [Bundle size мониторинг](#2-bundle)
3. [Lighthouse CI](#3-lighthouse-ci)
4. [Стратегия fail vs warn](#4-strategy)
5. [Bundle analysis — где растёт](#5-analysis)
6. [Реальный кейс](#реальный-кейс)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Lighthouse CI (`@lhci/cli`) | **0.15.1** | Lighthouse в CI |
| `treosh/lighthouse-ci-action` | **v12** | GitHub Actions обёртка |
| BundleMon | **2.x** | Bundle size мониторинг + PR comments |
| `size-limit` | **12.1.0** | Bundle size limits (npm) |
| `rollup-plugin-visualizer` | **5.x** | Bundle composition анализ |
| `vite-bundle-visualizer` | **1.2.1** | Vite-специфичный анализ |
| `@next/bundle-analyzer` | **16.2.9** | Next.js bundle анализ |

---

## 1. Budget

### Рекомендованные бюджеты (2026)

```
Ресурсные бюджеты (compressed size):
  JavaScript:       < 300 KB  — parse + execution на low-end mobile
  CSS:              < 100 KB  — render-blocking resource
  Images above-fold:< 500 KB  — прямое влияние на LCP
  Fonts:            < 100 KB  — render-blocking + CLS
  Third-party:      < 200 KB  — неконтролируемый код
  Total page weight:< 1.5 MB  — 3G загрузка ~4s

Metric бюджеты:
  LCP:   ≤ 2500ms
  INP:   ≤ 200ms
  CLS:   ≤ 0.1
  TBT:   ≤ 200ms   (lab proxy для INP)
  FCP:   ≤ 1800ms

  Lighthouse scores (минимальные для merge):
  Performance: ≥ 80 (warn) / ≥ 70 (fail)
  Accessibility: ≥ 90
```

### Принципы определения бюджетов

```
1. Измерь сначала — установи бюджет ≈ текущее значение + 10%
   Нельзя начинать с идеальных чисел если сейчас всё хуже

2. Раздели по типу ресурса
   Один total budget — бесполезен: не видно что именно выросло

3. Разные бюджеты для разных страниц
   Главная страница ≠ страница корзины ≠ admin dashboard

4. Bundle size бюджет — детерминированный (хорошо для hard fail)
   Lighthouse score — шумный (хорошо для soft warn)

5. Постепенное ужесточение:
   Спринт 1: текущее + 10%  (не блокируем команду)
   Спринт 2–4: ужесточать по 5% по мере оптимизации
```

---

## 2. Bundle size мониторинг

### BundleMon — PR-level мониторинг

```yaml
# bundlemon.config.json
{
  "baseDir": "./dist",
  "files": [
    {
      "path": "assets/index-*.js",      // glob с хешем
      "friendlyName": "Main JS bundle",
      "maxSize": "300kb",
      "maxPercentIncrease": 5           // warn если +5% vs base branch
    },
    {
      "path": "assets/vendor-*.js",
      "friendlyName": "Vendor bundle",
      "maxSize": "200kb",
      "maxPercentIncrease": 10
    },
    {
      "path": "assets/index-*.css",
      "friendlyName": "Main CSS",
      "maxSize": "50kb",
      "maxPercentIncrease": 5
    }
  ],
  "reportOutput": [
    ["github", {
      "checkRun": true,       // GitHub Check на PR
      "commitStatus": true,   // commit status (green/red)
      "prComment": true       // комментарий с таблицей изменений
    }]
  ]
}
```

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: BundleMon
        uses: LironEr/bundlemon-action@v2
        with:
          config-path: ./bundlemon.config.json
        env:
          BUNDLEMON_PROJECT_ID: ${{ secrets.BUNDLEMON_PROJECT_ID }}
          BUNDLEMON_PROJECT_APIKEY: ${{ secrets.BUNDLEMON_PROJECT_APIKEY }}
          CI_COMMIT_SHA: ${{ github.sha }}
          CI_BRANCH: ${{ github.head_ref }}
          CI_TARGET_BRANCH: ${{ github.base_ref }}
```

### size-limit — простая альтернатива для npm пакетов

```json
// package.json
{
  "size-limit": [
    {
      "path": "dist/index.js",
      "limit": "300 KB",
      "gzip": true
    },
    {
      "path": "dist/vendor.js",
      "limit": "200 KB"
    }
  ],
  "scripts": {
    "size": "size-limit",
    "size:analyze": "size-limit --why"
  }
}
```

```yaml
# GitHub Actions для size-limit
- name: Check bundle size
  run: npx size-limit
  # Завершается с exit code 1 если бюджет превышен → CI fails
```

### Граничные случаи — где ломается

**BundleMon с Vite glob**: Vite генерирует файлы с хешами (`index-abc123.js`). BundleMon glob `assets/index-*.js` работает корректно. Но если Vite разбивает на чанки (`vendor-abc.js`, `vendor-def.js`) — нужны отдельные entries или `path: "assets/vendor-*.js"` покрывает все.

**size-limit и dynamic imports**: `size-limit` по умолчанию считает только entry файл без динамических импортов. `--why` флаг показывает что именно занимает место, но не dynamic chunks. Для полного анализа — `rollup-plugin-visualizer`.

**Почему это важно архитектору:** Bundle size — единственная performance метрика которая меняется детерминированно с каждым PR. Lighthouse score скачет ±10 баллов от запроса к запросу. Bundle size точен. Это делает его идеальным hard fail в CI. 

---

## 3. Lighthouse CI

### Полный конфиг LHCI

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      // URL для тестирования (локальный dev сервер или staging)
      url: [
        'http://localhost:4173/',           // главная
        'http://localhost:4173/catalog',    // каталог
        'http://localhost:4173/product/1',  // страница продукта
      ],
      numberOfRuns: 3,          // 3 запуска → медиана (уменьшает шум)
      startServerCommand: 'npm run preview',  // запустить preview сервер
      startServerReadyPattern: 'Local:',
    },

    assert: {
      // Пресет 'lighthouse:recommended' как baseline
      preset: 'lighthouse:no-pwa',

      assertions: {
        // Метрики — WARN если не соответствуют (не блокируют merge)
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],

        // Scores — WARN
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],

        // Специфичные аудиты — ERROR (блокируют merge)
        'uses-text-compression': 'error',  // gzip/brotli обязателен
        'uses-optimized-images': 'error',
        'render-blocking-resources': ['error', { maxLength: 0 }],
        'unused-javascript': ['warn', { maxNumericValue: 50000 }],

        // Ресурсные бюджеты
        'resource-summary:script:size': ['error', { maxNumericValue: 300000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 100000 }],
        'resource-summary:total:size': ['warn', { maxNumericValue: 1500000 }],
      },
    },

    upload: {
      target: 'temporary-public-storage',  // Публичный Lighthouse CI сервер
      // Или self-hosted: target: 'lhci', serverBaseUrl: 'https://lhci.example.com'
    },
  },
}
```

### GitHub Actions workflow

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: ./lighthouserc.js
          uploadArtifacts: true        # Сохранить HTML отчёты как artifacts
          temporaryPublicStorage: true # Публичная ссылка в PR comment
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

### Lighthouse CI — управление шумом

```
Проблема: Lighthouse score варьируется ±5-10 баллов между запусками
  Причина: timing-зависимые метрики (LCP, TBT) реагируют на CPU load
  на GitHub Actions runner

Стратегия:
  1. numberOfRuns: 3 — медиана из трёх запусков
  2. Assertions через warn, не error для score-based метрик
  3. error только для детерминированных проверок:
     - наличие gzip/brotli
     - отсутствие render-blocking resources
     - bundle size пороги (они одинаковы между запусками)
  4. Baseline через main branch — сравнение delta, не абсолютных значений
```

### Self-hosted LHCI сервер

```yaml
# docker-compose.yml для self-hosted Lighthouse CI
services:
  lhci-server:
    image: patrickhulce/lhci-server:latest
    ports:
      - "9001:9001"
    volumes:
      - lhci-data:/data
    environment:
      LHCI_STORAGE__SQL_DATABASE_PATH: /data/lhci.db

volumes:
  lhci-data:
```

```
Self-hosted vs temporary-public-storage:

temporary-public-storage:
  ✓ Нулевая настройка
  ✓ Публичные ссылки в PR
  ✗ Данные хранятся 7 дней
  ✗ История между деплоями недоступна

Self-hosted:
  ✓ Постоянная история метрик
  ✓ Визуальный dashboard с трендами
  ✓ Приватные данные
  ✗ Нужна инфраструктура (~1 CPU, 512MB RAM)
```

---

## 4. Стратегия fail vs warn

### Матрица: что блокировать, что предупреждать

```
ERROR (блокирует merge):
  ✓ Bundle size превышен (детерминировано, значимо)
  ✓ Отсутствует gzip/brotli compression
  ✓ Render-blocking resources появились
  ✓ Images без width/height (CLS риск)
  ✓ JS bundle > hard limit (например 500 KB)

WARN (уведомляет, не блокирует):
  ✓ Lighthouse Performance score < 80
  ✓ LCP > 2500ms в lab
  ✓ Bundle size увеличился на 5-10% vs base
  ✓ Unused JS > 50 KB
  ✓ Third-party requests > 10

Никогда не блокировать merge по:
  ✗ Lighthouse score < 100 (недостижимо на staging с mock данными)
  ✗ Абсолютный Lighthouse score без delta
    (staging ≠ production окружение)
```

### Разные бюджеты для разных веток

```yaml
# .github/workflows/lighthouse.yml

# На main push — строгие пороги (production)
# На PR — мягкие пороги (не блокировать итеративную разработку)

- name: Run Lighthouse CI (PR)
  if: github.event_name == 'pull_request'
  uses: treosh/lighthouse-ci-action@v12
  with:
    configPath: ./lighthouserc.pr.js   # warn-only конфиг

- name: Run Lighthouse CI (main)
  if: github.ref == 'refs/heads/main'
  uses: treosh/lighthouse-ci-action@v12
  with:
    configPath: ./lighthouserc.main.js  # строгий конфиг
```

---

## 5. Bundle analysis

### rollup-plugin-visualizer / vite-bundle-visualizer

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    // Генерирует stats.html при build
    visualizer({
      filename: 'stats.html',
      open: false,         // не открывать в браузере автоматически
      gzipSize: true,      // показывать gzip размеры
      brotliSize: true,    // показывать brotli размеры
      template: 'treemap', // treemap | sunburst | network
    }),
  ],
})
```

### Что искать в treemap

```
Типичные проблемы видимые в treemap:

1. Огромный vendor chunk:
   moment.js — 67KB gzip (заменить на date-fns или dayjs)
   lodash    — если полный import (заменить на lodash-es с tree-shaking)
   Причина: import _ from 'lodash' тянет всё

2. Дубликаты библиотек:
   react — присутствует дважды (два разных инстанса)
   Причина: разные version resolves в node_modules

3. Unexpected large dependency:
   markdown парсер в main chunk (должен быть dynamic import)
   PDF генератор загружается сразу (нужен только при export)

4. Node.js модули в browser bundle:
   'path', 'fs', 'buffer' — polyfills, занимают место
   Причина: библиотека написана для Node, нет browser export
```

### Техники сокращения bundle

```typescript
// 1. Dynamic imports для тяжёлых зависимостей
// ❌ Синхронный import тяжёлой библиотеки
import { jsPDF } from 'jspdf'  // 300KB — грузится всегда

// ✅ Dynamic import — только когда нужно
async function exportPDF() {
  const { jsPDF } = await import('jspdf')
  // Теперь jspdf в отдельном chunk, загружается только при вызове
}

// 2. Tree-shaking — именованные импорты
// ❌ Тянет всю библиотеку
import _ from 'lodash'
import * as dateFns from 'date-fns'

// ✅ Только нужные функции
import { debounce, throttle } from 'lodash-es'  // tree-shaken
import { format, parseISO } from 'date-fns'     // tree-shaken

// 3. Замена тяжёлых библиотек
// moment.js     → dayjs (2KB vs 67KB gzip)
// lodash        → lodash-es (tree-shakeable)
// axios         → native fetch (0KB)
// uuid          → crypto.randomUUID() (native)

// 4. Bundle splitting — vendor отдельно
// vite.config.ts:
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-router': ['react-router-dom'],
        'vendor-charts': ['recharts'],  // lazy loaded separately
      },
    },
  },
},
```

### Граничные случаи — где ломается

**manualChunks и circular dependencies**: если модуль A и B в разных chunks импортируют друг друга → runtime error. Vite предупреждает, но не всегда. Диагноз: `rollup-plugin-visualizer` с `template: 'network'` показывает граф зависимостей.

**Tree-shaking и side effects**: `package.json` библиотеки должен иметь `"sideEffects": false` чтобы bundler агрессивно tree-shake. Если нет — импорт любого экспорта тянет весь файл. Проверять через `--why` в size-limit или `rollup --input --perf`. 

**Почему это важно архитектору:** `rollup-plugin-visualizer` — первый инструмент который нужно открыть при росте bundle. Treemap мгновенно показывает кандидатов для оптимизации. Типичный результат: moment.js занимает 30% bundle — один PR с заменой на dayjs экономит 60+ KB.

---

## Реальный кейс

**Входные данные:** SPA после 8 месяцев разработки. Bundle: main JS 1.2 MB (gzip 380KB). Нет CI performance checks. Lighthouse Performance: 42. Команда не замечала деградации — не было автоматического контроля.

**Гипотеза:** 380KB gzip = значительный parsing time на low-end mobile. Скорее всего: несколько тяжёлых зависимостей загружаются синхронно, часть нужна только для edge-case функционала.

**Диагностика через visualizer:**
- `moment.js` + `moment-timezone` → 78KB gzip. Используется в трёх компонентах для форматирования дат.
- `react-pdf` → 45KB. Загружается синхронно, нужен только при PDF export (< 2% пользователей).
- `lodash` (полный, не `lodash-es`) → 24KB. Используется только `debounce` и `get`.
- `draft-js` (rich text editor) → 61KB. На трёх страницах из 40.

**Фиксы:**
1. `moment` → `dayjs` (2KB) → `-76KB gzip`
2. `react-pdf` → dynamic `import()` в export handler → `-45KB` из main chunk
3. `lodash` → `lodash-es` + точечные импорты → `-22KB`
4. `draft-js` → dynamic import в страницах где нужен → `-61KB` из main chunk

**Результат:** Main bundle: 1.2 MB → 670KB (gzip 176KB). Lighthouse Performance: 42 → 78. Внедрён BundleMon + LHCI — теперь любое добавление > 10KB visible в PR.

**Вывод, противоречащий интуиции:** команда 8 месяцев не замечала деградацию — не потому что «все заняты», а потому что не было системы обнаружения. Ни один разработчик намеренно не добавлял 380KB — это накопилось незаметно по 5-10KB за PR. Performance budget в CI — единственный надёжный способ обнаруживать регрессии в момент их появления.

---

## Антипаттерны

**1. Budget только в документации без CI enforcement**
```
❌ "Наш bundle должен быть < 300KB" в README
   Через 3 месяца: 800KB. Никто не проверял.

✅ BundleMon в CI: merge заблокирован при превышении
```

**2. Lighthouse score как hard fail в CI**
```
❌ assert: { 'categories:performance': ['error', { minScore: 0.9 }] }
   GitHub Actions runner под нагрузкой → LCP скачет →
   легитимный PR блокируется из-за noise

✅ Scores → warn. Hard fail только для детерминированных метрик:
   bundle size, наличие compression, render-blocking resources
```

**3. Один total bundle budget**
```
❌ "Total bundle < 1MB"
   Не видно что именно выросло: JS, CSS, images, fonts

✅ Раздельные бюджеты по типу ресурса
   BundleMon: отдельный entry для main.js, vendor.js, styles.css
```

**4. Не анализировать bundle при добавлении зависимости**
```
❌ npm install heavy-library → PR без анализа размера

✅ Перед установкой: bundlephobia.com → проверить gzip size
   После установки: visualizer → проверить что попало в bundle
```

**5. manualChunks без проверки circular deps**
```typescript
// ❌ Ручное разбиение без анализа графа зависимостей
manualChunks: {
  'feature-a': ['./src/features/a'],
  'feature-b': ['./src/features/b'],
  // А → B → A → runtime error
}

// ✅ Сначала visualizer template: 'network' → убедиться нет циклов
```

**6. Dynamic import без loading state**
```typescript
// ❌ Dynamic import без UI feedback → пользователь видит пустоту 0.5-2s
const { HeavyChart } = await import('./HeavyChart')

// ✅ React.lazy + Suspense с fallback
const HeavyChart = React.lazy(() => import('./HeavyChart'))
// <Suspense fallback={<ChartSkeleton />}><HeavyChart /></Suspense>
```

---

## Anti-checklist ☠️

- [ ] Бюджет без автоматической проверки — нарушается при первом же срочном фиксе
- [ ] Одна цифра на весь проект — /feed и /checkout имеют разную толерантность к весу
- [ ] Бюджет на JS без учёта code-splitting — одна страница грузит весь bundle приложения
- [ ] Статичный бюджет без пересмотра — через год метрики могут быть неактуальны
- [ ] Считать только размер бандла — количество запросов и connection overhead не менее важны
- [ ] Budget для production, но не для CI — нарушается до деплоя, обнаруживается после

---

## Задачи AI-кодеру

**Плохая формулировка:**
> «Настрой мониторинг производительности в CI»

**Хорошая формулировка:**
> «Добавить BundleMon в GitHub Actions:
> 1. Создать `bundlemon.config.json` в корне: baseDir `./dist`, files: `assets/index-*.js` maxSize 300kb, `assets/vendor-*.js` maxSize 200kb, `assets/*.css` maxSize 50kb. reportOutput: github с checkRun + prComment.
> 2. Создать `.github/workflows/bundle-size.yml`: trigger on pull_request, steps: checkout, setup-node@v4 с node 22, npm ci, npm run build, LironEr/bundlemon-action@v2.
> 3. Добавить в workflow env: BUNDLEMON_PROJECT_ID и BUNDLEMON_PROJECT_APIKEY из secrets.
> 4. В `bundlemon.config.json`: добавить maxPercentIncrease: 5 для JS файлов.
> Не запускать при push в main — только PR.»

---

**Плохая формулировка:**
> «Почему bundle такой большой»

**Хорошая формулировка:**
> «Проанализировать bundle через rollup-plugin-visualizer:
> 1. Добавить в vite.config.ts: `import { visualizer } from "rollup-plugin-visualizer"`, добавить в plugins: `visualizer({ filename: "stats.html", gzipSize: true, brotliSize: true, template: "treemap" })`.
> 2. Запустить `npm run build` → открыть `stats.html`.
> 3. Найти топ-5 модулей по gzip size. Для каждого: (a) проверить используется ли полный пакет или только часть, (b) есть ли более лёгкая альтернатива на bundlephobia.com, (c) можно ли перенести на dynamic import.
> 4. Составить список предлагаемых замен с размерами до/после.»

---

## Чеклист архитектора

**Budget определён**
- [ ] Раздельные бюджеты: JS / CSS / images / fonts / third-party / total
- [ ] Metric бюджеты: LCP, TBT, CLS (не только score)
- [ ] Бюджеты основаны на измерениях, не идеальных числах

**Bundle size CI**
- [ ] BundleMon или size-limit установлен
- [ ] PR comment с delta размера настроен
- [ ] Hard fail при превышении абсолютного лимита

**Lighthouse CI**
- [ ] `@lhci/cli` + `treosh/lighthouse-ci-action@v12`
- [ ] `numberOfRuns: 3` для снижения шума
- [ ] Детерминированные аудиты → error; score-based → warn
- [ ] Артефакты с HTML отчётами сохраняются

**Bundle analysis**
- [ ] `rollup-plugin-visualizer` в dev build
- [ ] Анализ перед каждой новой зависимостью (bundlephobia.com)
- [ ] Dynamic imports для тяжёлых зависимостей (PDF, charts, editors)
- [ ] Нет `moment.js`, полного `lodash`, `axios` без необходимости

**Процесс**
- [ ] Budget review раз в спринт
- [ ] Постепенное ужесточение бюджетов (не сразу идеал)
- [ ] Документация: почему тот или иной бюджет

---

*Модуль 40 завершён.*
*Блок «Web Performance» (модули 28–40) завершён.*
*Следующий: [Модуль 41 — MCP: Tool Server Architecture](../41-mcp-tool-server-architecture/README.md)*
