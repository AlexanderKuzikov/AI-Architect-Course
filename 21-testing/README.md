# Модуль 21 — Тестирование: unit, integration, e2e

> **Для AI-архитектора:** тестирование — это не про покрытие кода, а про уверенность в системе при изменениях.
> AI-кодер напишет тесты за минуты. Твоя задача — задать правильные границы, иначе ты получишь 100% coverage и нулевую confidence.
> Один день изучения — стратегия и граничные случаи.

---

## Содержание

1. [Test Strategy Architecture — не пирамида, а контекст](#1-test-strategy-architecture)
2. [Unit testing — механика и границы](#2-unit-testing)
3. [Integration testing с реальными зависимостями](#3-integration-testing)
4. [E2E — когда и сколько](#4-e2e-testing)
5. [Тестирование в AI-assisted разработке](#5-testing-in-ai-assisted-development)
6. [Антипаттерны](#антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Vitest | **4.1** | Unit / integration, Node.js + Vite |
| Playwright | **1.58.x** | E2E, component testing |
| testcontainers-node | **11.13.0** | Real dependencies в тестах |
| Supertest | **7.x** | HTTP integration testing |
| Jest | **30.x** | Legacy проекты, CJS |

---

## 1. Test Strategy Architecture

### Пирамида, трофей, сота

Классическая пирамида (много unit, мало e2e) — разработана во времена, когда интеграция стоила дорого. В 2026 с Docker и testcontainers запустить реальный Postgres дешевле, чем написать качественный мок.

```
Test Pyramid (классика)          Test Trophy (Kent C. Dodds)     Test Honeycomb (Spotify)
        /\                              /\                              /\
       /e2e\                           /e2e\                         / e2e \
      /------\                        /------\                      /--------\
     /integra-\                      /integra-\                    / service  \
    /  tion    \                    /  tion    \                  / integration\
   /------------\                  /============\                /=============\
  /    unit      \                /    unit      \              / (unit minor)  \
 /________________\              /________________\            /_________________\
```

Выбор стратегии зависит от типа системы:
- **Бизнес-логика с чистыми функциями** → Test Pyramid. Много unit, быстрый feedback.
- **Node.js API / сервисы с БД** → Test Trophy. Integration tests дают максимальный ROI.
- **Микросервисы / AI pipeline** → Honeycomb. Контракт между сервисами важнее unit-деталей.

**Практический вывод для архитектора:** перед выбором инструментов ответь на один вопрос — что означает «юнит» в твоей системе? Функция, модуль, HTTP-эндпоинт или сервис? Ответ определяет весь стек.

### Confidence per cost — реальная метрика

```
Тип теста   | Скорость | Стоимость написания | Confidence | CI стоимость
------------|----------|---------------------|------------|-------------
unit        | ~1ms     | низкая              | низкая*    | ~$0
integration | ~100ms   | средняя             | высокая    | ~$0.01
e2e         | ~3-10s   | высокая             | очень выс. | ~$0.1

* unit с правильными границами — высокая; unit с моками — иллюзия
```

### Граничные случаи — где ломается

**Проблема**: архитектор выбирает пирамиду, AI-кодер пишет 500 unit-тестов с моками. Система деплоится, в продакшне падает интеграция с Postgres, потому что мок вёл себя не так, как реальный драйвер при конфликте транзакций.

**Почему это важно архитектору:** test strategy — архитектурное решение. Если не зафиксировать в `CONTRIBUTING.md` или `vitest.config.ts`, AI-кодер выберёт самый простой путь — всё замокировать.

---

## 2. Unit testing

### Механика Vitest 4.x

Vitest 4.1 требует Node.js ≥ 20 и Vite ≥ 6. Ключевое отличие от Jest: статический анализ `vi.mock()` поднят на уровень Vite-плагина, hoisting происходит до выполнения модуля.

```typescript
// ✅ Правильно — тестируем поведение, не имплементацию
import { describe, it, expect, vi } from 'vitest'
import { processInvoice } from './invoice'

describe('processInvoice', () => {
  it('возвращает overdue для просроченных счетов', () => {
    const invoice = { dueDate: new Date('2020-01-01'), amount: 100 }
    expect(processInvoice(invoice).status).toBe('overdue')
  })
})

// ❌ Неправильно — тест знает о внутреннем вызове
it('вызывает _calculateDays внутри', () => {
  const spy = vi.spyOn(invoice, '_calculateDays')
  processInvoice(...)
  expect(spy).toHaveBeenCalled() // сломается при любом рефакторинге
})
```

### vi.mock() — статический анализ, не runtime

`vi.mock()` хойстится компилятором до импортов. Это ломает динамические паттерны:

```typescript
// ❌ Не работает — factory вызывается до присвоения переменной
const mockValue = 'test'
vi.mock('./config', () => ({ value: mockValue })) // mockValue === undefined здесь

// ✅ Работает
vi.mock('./config', () => ({ value: 'test' }))

// ✅ Или через vi.mocked + beforeEach для динамики
vi.mock('./config')
beforeEach(() => {
  vi.mocked(config).value = computedValue
})
```

### Что тестировать юнитом, а что нет

```
Тестировать юнитом:              НЕ тестировать юнитом:
- Pure functions                 - Database queries (мок даст ложную confidence)
- Business rules / calculations  - HTTP calls (интеграция важнее)
- Validation logic               - File I/O
- State machines                 - Криптографию (только реальные данные)
- Алгоритмы трансформации        - ORM-маппинг (testcontainers дешевле)
```

**Практический вывод для архитектора:** unit-тесты окупаются на чистой бизнес-логике. Как только появляется I/O — стоимость правильного мока растёт быстрее, чем стоимость интеграционного теста с реальной зависимостью.

### Граничные случаи — где ломается

**Temporal coupling в тестах**: тесты зависят от порядка выполнения — глобальное состояние, синглтоны, DB-соединения без изоляции. Vitest 4.x запускает файлы в worker threads параллельно — это выявляет coupling, которого Jest (однопоточный по умолчанию) не замечал.

```typescript
// ❌ Падает в Vitest при параллельном запуске
let counter = 0
it('test 1', () => { counter++; expect(counter).toBe(1) })
it('test 2', () => { counter++; expect(counter).toBe(2) })

// ✅ Изолированное состояние
it('test 1', () => {
  const counter = createCounter()
  counter.increment()
  expect(counter.value).toBe(1)
})
```

**Почему это важно архитектору:** при переезде с Jest на Vitest 4.x падают тесты, которые годами проходили. Это не баги Vitest — это баги в тестах, которые Jest скрывал.

---

## 3. Integration testing

### testcontainers-node — механика

testcontainers-node 11.13.0 запускает реальные Docker-контейнеры из тестов. Жизненный цикл контейнера управляется через `AsyncDisposable` (TS 5.2+ `using`).

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

describe('DocumentRepository', () => {
  let container: StartedPostgreSqlContainer
  let repo: DocumentRepository

  beforeAll(async () => {
    // Реальный Postgres — никаких моков
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('testdb')
      .start()

    repo = new DocumentRepository(container.getConnectionUri())
    await repo.migrate() // реальные миграции
  })

  afterAll(async () => {
    await container.stop()
  })

  it('сохраняет и возвращает документ', async () => {
    const doc = await repo.save({ content: 'test', status: 'pending' })
    const found = await repo.findById(doc.id)
    expect(found.status).toBe('pending')
  })
})
```

### Стратегии изоляции данных между тестами

```typescript
// Стратегия 1: Transaction rollback — быстро, но не работает с COMMIT внутри логики
beforeEach(async () => { await db.query('BEGIN') })
afterEach(async () => { await db.query('ROLLBACK') })

// Стратегия 2: Truncate tables — медленнее, но честнее
afterEach(async () => {
  await db.query('TRUNCATE documents, events RESTART IDENTITY CASCADE')
})

// Стратегия 3: Отдельная БД на тест-файл (testcontainers per suite)
// Дорого по времени, но полная изоляция — для критичных тестов
```

### Supertest — HTTP integration без поднятия порта

```typescript
import request from 'supertest'
import { app } from '../app' // Express/Fastify instance

it('POST /documents возвращает 201', async () => {
  const res = await request(app)
    .post('/documents')
    .send({ content: 'hello' })
    .set('Authorization', `Bearer ${testToken}`)

  expect(res.status).toBe(201)
  expect(res.body.id).toBeDefined()
})
```

**Практический вывод для архитектора:** Supertest + testcontainers даёт полный HTTP-стек с реальной БД без запуска сервера. Это покрывает 80% confidence за 20% стоимости e2e.

### Граничные случаи — где ломается

**CI/CD + testcontainers**: в GitHub Actions / GitLab CI нужен Docker-in-Docker или privileged mode. В некоторых средах Ryuk (cleanup daemon) блокируется файрволом.

```bash
# Для CI без privileged Docker
TESTCONTAINERS_RYUK_DISABLED=true
DOCKER_HOST=unix:///var/run/docker.sock
```

**N+1 в beforeEach**: `beforeAll` поднимает контейнер один раз на suite — это правильно. `beforeEach` поднимает контейнер перед каждым тестом — 50 тестов × 3 секунды старта = 2.5 минуты только на инициализацию.

**Почему это важно архитектору:** медленный CI убивает культуру тестирования. Архитектор проектирует lifecycle контейнеров, AI-кодер — только пишет тесты внутри.

---

## 4. E2E testing

### Playwright 1.58 — архитектура

Playwright запускает реальные браузеры (Chromium, Firefox, WebKit) в изолированных контекстах. С версии 1.56 добавлены **Test Agents** — planner/generator/healer loops для AI-assisted authoring.

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,      // ✅ retry только в CI
  workers: process.env.CI ? 4 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',            // ✅ трейс только при падении
    video: 'off',                       // ❌ video: 'on' убьёт диск в CI
  },
  webServer: {                          // ✅ поднимает сервер автоматически
    command: 'npm run start:test',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

### Сколько e2e тестов достаточно

E2E тесты — дорогие (медленные, flaky, требуют полного стека). Правило: покрывать только **critical user paths**, не UI-детали.

```
Что покрывать e2e:                  Что НЕ покрывать e2e:
- Регистрация / логин               - Валидация форм (unit)
- Основной бизнес-флоу (checkout)   - Стили и layout (visual regression)
- Критичные интеграции (оплата)     - CRUD операции (integration)
- Smoke tests после деплоя          - Error messages (integration)
```

### Flakiness — системная причина

Flaky тесты — не случайность, а симптом архитектурной проблемы:

```typescript
// ❌ Race condition — тест иногда падает
await page.click('#submit')
expect(await page.locator('.result').textContent()).toBe('Success')

// ✅ Явное ожидание состояния
await page.click('#submit')
await page.waitForSelector('.result[data-status="success"]')
// или
await expect(page.locator('.result')).toHaveText('Success')
// Playwright auto-waits, но waitForSelector явнее communicates intent
```

**Практический вывод для архитектора:** если flakiness > 2% — это архитектурная проблема (race conditions, внешние зависимости, порядок тестов). Retry маскирует проблему, не решает.

### Граничные случаи — где ломается

**Playwright Test Agents (1.56+)**: AI-генерация тестов через healer loop. Генерирует рабочие тесты, но с хрупкими селекторами (`data-testid` vs CSS-классы). Архитектор должен задать стратегию селекторов до того, как AI-кодер начнёт писать e2e.

```typescript
// ❌ Хрупкий селектор — сломается при рефакторинге CSS
page.locator('.btn-primary.checkout-submit')

// ✅ Семантический селектор — устойчив к UI-изменениям
page.getByRole('button', { name: 'Оформить заказ' })
page.getByTestId('checkout-submit') // если роль неоднозначна
```

**Почему это важно архитектору:** хрупкие e2e тесты стоят дороже, чем их отсутствие — они создают ложную тревогу и блокируют деплой.

---

## 5. Тестирование в AI-assisted разработке

### Специфика AI-кодера как автора тестов

AI-кодер оптимизирует по метрикам, которые видит: coverage %, количество тестов, отсутствие ошибок линтера. Это создаёт системные проблемы:

```typescript
// ❌ AI напишет именно такой тест при задаче "покрой функцию тестами"
it('processDocument calls validator', () => {
  const mockValidator = vi.fn().mockReturnValue(true)
  processDocument({ content: 'x' }, mockValidator)
  expect(mockValidator).toHaveBeenCalled()
  // coverage: 100%. Confidence: 0. Тест проверяет мок, не логику.
})

// ✅ Правильная постановка задачи даёт правильный тест
it('processDocument отклоняет документ без content', () => {
  expect(() => processDocument({ content: '' }))
    .toThrow('Content cannot be empty')
})
```

### Mock hell — как AI создаёт иллюзию тестирования

AI склонен мокировать всё, что требует инфраструктуры. Проект с 200 тестами и 95% coverage может иметь 0 тестов, проверяющих реальное взаимодействие с БД.

```
Признаки mock hell в кодовой базе:
- vi.mock() в каждом тест-файле
- Моки возвращают идеальные данные (без null, без ошибок, без edge cases)
- Тесты падают при изменении внутренней структуры, но не при изменении поведения
- Нет ни одного testcontainers импорта в проекте
```

### Coverage как ложная метрика

100% coverage достижимо без единого значимого assertion:

```typescript
// ❌ 100% coverage, 0% confidence
it('does not throw', () => {
  expect(() => complexBusinessLogic(validInput)).not.toThrow()
  // функция может вернуть неправильный результат — тест пройдёт
})
```

**Практический вывод для архитектора:** coverage — метрика отсутствия, не наличия. Полезна как минимальная планка (< 60% = явная проблема). Выше 80% — смотри на качество assertions, не на процент.

### Граничные случаи — где ломается

**AI-кодер и testcontainers**: без явного указания в задаче AI не использует реальные контейнеры — слишком сложная настройка. Архитектор должен предоставить `vitest.config.ts` с готовым setup и шаблон теста с testcontainers как точку старта.

**Почему это важно архитектору:** если не задать паттерн тестирования до начала разработки — рефакторинг тестовой базы из mock hell в реальные интеграции стоит дороже, чем написать их правильно с начала.

---

## Антипаттерны

**1. Мокировать всё, что «медленное»**
Мок репозитория позволяет написать быстрый тест, который падает в продакшне из-за специфики реального SQL. testcontainers + Postgres 16 Alpine стартует за ~2 секунды — это приемлемая цена за реальную confidence.

**2. Тестировать имплементацию, не контракт**
Каждый spy на приватный метод — это тест, который сломается при следующем рефакторинге. Контракт: входные данные → выходные данные / side effects. Имплементация: как именно это достигается.

**3. `beforeEach` поднимает контейнер**
```typescript
// ❌ 50 тестов × 3s = 150s только на Docker startup
beforeEach(async () => { container = await new PostgreSqlContainer().start() })

// ✅ Один контейнер на suite, изоляция через truncate
beforeAll(async () => { container = await new PostgreSqlContainer().start() })
afterEach(async () => { await db.query('TRUNCATE ...') })
```

**4. E2E как замена integration**
E2E тест, который проверяет что форма сохраняет данные в БД — это integration test в дорогой обёртке. 10x медленнее, в 5x сложнее дебажить, не даёт больше confidence.

**5. Coverage как KPI для AI-кодера**
При задаче «достигни 90% coverage» AI напишет тесты, оптимизированные под покрытие строк, а не под поведение системы. Ставь задачу через поведение: «протестируй все ветки валидации с реальными данными».

---

## Задачи AI-кодеру

**Плохая формулировка:**
> «Напиши тесты для модуля DocumentService»

**Хорошая формулировка:**
> «Используя Vitest 4.1 и testcontainers-node 11.13.0, напиши integration-тест для `DocumentService.process()`.
> Подними Postgres 16-alpine через `@testcontainers/postgresql`.
> Сценарии: (1) документ со статусом `pending` переходит в `processed`, (2) документ с пустым `content` бросает `ValidationError`, (3) дубликат по `externalId` возвращает существующий документ без создания нового.
> Не мокировать DB-слой. Изоляция через TRUNCATE в afterEach. Шаблон контейнера — в `test/helpers/postgres.ts`»

---

**Плохая формулировка:**
> «Добавь e2e тесты для checkout»

**Хорошая формулировка:**
> «Используя Playwright 1.58.x, напиши e2e тест для флоу оформления заказа.
> Селекторы — только `getByRole` и `getByTestId`, не CSS-классы.
> Покрыть: успешный checkout с валидной картой, отказ при невалидной карте (mock payment API через `page.route()`).
> Добавить `data-testid` к кнопке submit и confirmation message, если их нет.
> `retries: 0` — flaky тест = баг, не retry.»

---

## Чеклист архитектора

**Стратегия**
- [ ] Определён тип системы → выбрана стратегия (pyramid / trophy / honeycomb)
- [ ] Зафиксировано что считается «юнитом» в данном проекте
- [ ] Задана целевая пропорция unit / integration / e2e
- [ ] Coverage floor задан как минимальная планка, не KPI

**Конфигурация**
- [ ] `vitest.config.ts` задаёт `pool: 'threads'` и изоляцию по умолчанию
- [ ] `playwright.config.ts` задаёт стратегию селекторов (запрещены CSS-классы)
- [ ] Шаблоны testcontainers вынесены в `test/helpers/`
- [ ] CI pipeline разделяет unit (быстро) и integration (параллельно)

**Интеграция**
- [ ] testcontainers lifecycle: `beforeAll` / `afterAll` per suite, не per test
- [ ] Стратегия изоляции данных выбрана (rollback vs truncate) и задокументирована
- [ ] `TESTCONTAINERS_RYUK_DISABLED` настроен для CI-среды

**AI-кодер**
- [ ] Шаблон integration-теста с testcontainers предоставлен как точка старта
- [ ] Задача формулируется через поведение и сценарии, не через «покрой модуль»
- [ ] Запрещено мокировать DB/HTTP без явного обоснования в задаче

---

*Модуль 21 завершён.*
*Следующий: [Модуль 22 — Worker Threads / Piscina](../22-worker-threads/README.md)*
