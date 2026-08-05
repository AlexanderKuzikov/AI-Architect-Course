# Модуль 25 — CI/CD (GitHub Actions)

> **Для AI-архитектора:** GitHub Actions — не про «добавить yml файл». Это про дизайн pipeline: что параллелить, где ставить gates, как управлять секретами без утечек и сколько это стоит в минутах runner времени. AI-кодер сгенерирует workflow за 10 секунд — последовательный, без кэша, с секретами в env.
> Один день изучения — механика executor model, cache стратегии, security boundaries, reusable workflows.

---

## Содержание

1. [Механика — workflow, job, step, контексты](#1-механика)
2. [Кэш зависимостей и артефакты](#2-кэш-и-артефакты)
3. [Параллелизация и матрица](#3-параллелизация)
4. [Secrets, переменные и OIDC](#4-secrets-и-переменные)
5. [Docker build в CI](#5-docker-в-ci)
6. [Reusable workflows и composite actions](#6-reusable-workflows)
7. [Антипаттерны](#антипаттерны)
8. [Задачи AI-кодеру](#задачи-ai-кодеру)
9. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Компонент | Версия | Назначение |
| :-- | :-- | :-- |
| `actions/checkout` | **v5** | Клонирование репозитория |
| `actions/setup-node` | **v6** | Node.js окружение + встроенный npm cache |
| `actions/cache` | **v4** | Кэширование произвольных путей |
| `docker/build-push-action` | **v6** | BuildKit сборка и push |
| `docker/login-action` | **v3** | Аутентификация в registry |
| GitHub Actions Runner | **v2.321+** | ubuntu-latest = Ubuntu 24.04 |

---

## 1. Механика

### Executor model

```
GitHub Event (push, PR, schedule, workflow_dispatch)
    │
    ▼
Workflow (.github/workflows/ci.yml)
    │
    ├── Job: lint          → Runner (ubuntu-24.04) ← изолированная VM
    │   ├── Step: checkout
    │   ├── Step: setup-node
    │   └── Step: eslint
    │
    ├── Job: test          → Runner (новая VM, независимо)
    │   └── ...
    │
    └── Job: deploy        → Runner (новая VM)
        └── needs: [lint, test]  ← запустить только после успеха
```

Каждый job — отдельная VM. Данные между jobs не разделяются напрямую: только через `artifacts` (upload/download) или `outputs`.

### Контексты и выражения

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Debug contexts
        run: |
          echo "Repo: ${{ github.repository }}"
          echo "Branch: ${{ github.ref_name }}"
          echo "SHA: ${{ github.sha }}"
          echo "Actor: ${{ github.actor }}"
          echo "Event: ${{ github.event_name }}"
          echo "Run ID: ${{ github.run_id }}"

      # Условное выполнение
      - name: Deploy to production
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: echo "Deploying..."

      # Выполнить даже при failure предыдущих шагов
      - name: Cleanup
        if: always()
        run: echo "Cleanup"

      # Только при failure
      - name: Notify on failure
        if: failure()
        run: echo "Something failed"
```

### Permissions — минимальный baseline

По умолчанию `GITHUB_TOKEN` имеет write доступ ко всему. Явно ограничивать:

```yaml
# Глобально для workflow
permissions:
  contents: read      # read-only к репозиторию
  packages: write     # write только для GHCR push

jobs:
  test:
    permissions:
      contents: read  # override на уровне job
    runs-on: ubuntu-latest
```

### Граничные случаи — где ломается

**Concurrency — параллельные runs на одну ветку**:

```yaml
# ❌ При быстрых pushes накапливаются runs, деплоятся устаревшие версии
# ✅ Отменять предыдущий run при новом push в ту же ветку
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Для main branch: не отменять деплой, только ждать
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

**`pull_request` из fork**: у форкнутых PR нет доступа к secrets репозитория — `secrets.NPM_TOKEN` будет пустой строкой, не ошибкой. Workflow молча падёт на `npm install` с неочевидным сообщением.

**Почему это важно архитектору:** `cancel-in-progress: true` для feature ветвей экономит runner-минуты и предотвращает деплой устаревшего кода. Для main — опасно, можно отменить деплой на полпути.

---

## 2. Кэш и артефакты

### setup-node со встроенным кэшем

`actions/setup-node@v6` умеет кэшировать npm/yarn/pnpm без отдельного `cache` action:

```yaml
steps:
  - uses: actions/checkout@v5

  - uses: actions/setup-node@v6
    with:
      node-version: 24
      cache: 'npm'          # кэшировать ~/.npm
      # cache: 'pnpm'       # или pnpm store
      # cache: 'yarn'       # или yarn cache

  - run: npm ci             # использует кэш при cache-hit
```

Cache key формируется автоматически из `package-lock.json` hash. При изменении lock-файла кэш инвалидируется.

### Ручной cache с кастомным ключом

Для случаев сложнее чем npm:

```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  id: npm-cache
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- run: npm ci
  if: steps.npm-cache.outputs.cache-hit != 'true'
```

**restore-keys** — fallback ключи по префиксу. При отсутствии точного совпадения восстановит ближайший по ключу.

### Артефакты между jobs

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  sonar:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Download coverage
        uses: actions/download-artifact@v4
        with:
          name: coverage-report
          path: coverage/

      - name: Run SonarCloud
        # ...
```

### Граничные случаи — где ломается

**Cache key слишком широкий**: `key: ${{ runner.os }}-node` без hashFiles — кэш никогда не инвалидируется при обновлении пакетов. Всегда включать hash lock-файла.

**Артефакты и большие файлы**: `upload-artifact` имеет лимит 500MB по умолчанию (GitHub Free). Для Docker образов — не использовать артефакты, использовать registry.

**`cache-hit` не означает корректный npm ci**: если `~/.npm` восстановлен, `npm ci` всё равно читает из него — просто быстрее. Нельзя пропускать `npm ci` при cache-hit (в отличие от node_modules кэша).

**Почему это важно архитектору:** правильная стратегия ключей экономит 60–90% времени CI для Node.js проектов. Неправильная — либо устаревший кэш, либо его постоянная инвалидация.

---

## 3. Параллелизация

### Структура с needs

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: 'npm' }
      - run: npm ci
      - run: npm run test:ci

  build:
    needs: [lint, typecheck, test]   # все три параллельно → build после всех
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: 'npm' }
      - run: npm ci
      - run: npm run build

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production    # требует ручного approve
    steps:
      - run: echo "Deploy"
```

```
Timeline:
t=0:  lint ─────────────┐
      typecheck ─────────┤ параллельно
      test ──────────────┘
t=60s: build ────────────── (ждёт всех)
t=90s: deploy ─────────────── (только на main)
```

### Matrix strategy

```yaml
jobs:
  test:
    strategy:
      matrix:
        node-version: [20, 22, 24]
        os: [ubuntu-latest, windows-latest]
      fail-fast: false    # не отменять другие при failure одного
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci && npm test
```

**`fail-fast: false`** — при compatibility тестировании важно видеть все результаты, не останавливаться на первом failure.

### Outputs между jobs

```yaml
jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      should-deploy: ${{ steps.check.outputs.deploy }}
    steps:
      - id: version
        run: echo "version=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT
      - id: check
        run: echo "deploy=${{ github.ref == 'refs/heads/main' }}" >> $GITHUB_OUTPUT

  deploy:
    needs: prepare
    if: needs.prepare.outputs.should-deploy == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying version ${{ needs.prepare.outputs.version }}"
```

### Граничные случаи — где ломается

**`set-output` deprecated**: старый синтаксис `echo "::set-output name=key::value"` удалён. Используется только `echo "key=value" >> $GITHUB_OUTPUT`.

**Matrix + cache коллизии**: при matrix strategy несколько jobs могут одновременно записывать в кэш с одним ключом. Actions/cache обрабатывает это через post-job save — первый сохранит, остальные пропустят. Не race condition, но первый сохранённый кэш может быть не самым оптимальным.

**Почему это важно архитектору:** `needs` без `if` — deploy запустится при failure lint/test если прямой зависимости нет. Явные `if: success()` или правильный граф `needs` обязателен.

---

## 4. Secrets и переменные

### Иерархия переменных

```
Organization secrets  → доступны во всех репозиториях организации
Repository secrets    → только этот репозиторий
Environment secrets   → только при запуске из конкретного environment
    │
    └─ Environment: production
         ├── Required reviewers (ручной approve)
         ├── Wait timer
         └── Deployment branches (только main)
```

```yaml
# Secrets — чувствительные данные (маскируются в логах)
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

# Variables — не секретные конфиги (видны в логах)
env:
  NODE_ENV: ${{ vars.NODE_ENV }}
  API_URL: ${{ vars.API_URL }}
```

### OIDC — без долгоживущих секретов

OIDC (OpenID Connect) позволяет получать временные credentials от cloud provider без хранения долгоживущих secrets:

```yaml
jobs:
  deploy:
    permissions:
      id-token: write   # ← обязательно для OIDC
      contents: read
    runs-on: ubuntu-latest
    steps:
      # AWS: получить временные credentials через OIDC
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-role
          aws-region: eu-central-1
          # Токен живёт 1 час, не хранится в secrets

      - run: aws s3 sync ./dist s3://my-bucket
```

Workflow не хранит AWS credentials — получает ephemeral token при каждом запуске. Cloud provider верифицирует JWT от GitHub.

### Граничные случаи — где ломается

**Secrets в fork PR**: при `pull_request` от форка secrets недоступны — GitHub изолирует их. Workflow должен работать без secrets для PR проверки (lint, test), и запускаться с secrets только после merge.

**`GITHUB_TOKEN` expiry**: default token живёт до конца job (6 часов максимум). Для очень долгих деплоев — использовать GitHub App token или PAT с явным сроком.

**Secret в env vs step**: `env` на уровне job — доступен всем steps. Лучше передавать secret на уровне конкретного step где он нужен — минимизировать exposure.

**Почему это важно архитектору:** OIDC — стандарт для cloud deployments в 2026. Долгоживущие AWS/GCP secrets в GitHub — устаревший паттерн с риском компрометации при утечке.

---

## 5. Docker в CI

### Build, test, push с registry cache

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write   # GHCR push
    steps:
      - uses: actions/checkout@v5

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          # BuildKit registry cache
          cache-from: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache
          cache-to: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache,mode=max
          # Передать секреты в BuildKit
          secrets: |
            npmrc=${{ secrets.NPMRC_CONTENT }}
```

### Multi-platform builds

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3    # эмуляция arm64 на amd64

- name: Build multi-platform
  uses: docker/build-push-action@v6
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ghcr.io/${{ github.repository }}:latest
```

**Цена**: arm64 через QEMU эмуляцию в 5–10 раз медленнее native. Для больших образов — использовать native ARM runners (GitHub предоставляет).

### Граничные случаи — где ломается

**`push: false` на PR**: сборка выполняется, push — нет. Без `push: true` образ не сохраняется в registry, но layer cache в registry обновляется. PR workflow — только сборка для проверки, не деплой.

**`mode=max` registry cache**: сохраняет кэш всех промежуточных layers, не только финального. Занимает больше места в registry (несколько GB), но максимально ускоряет rebuild.

**Почему это важно архитектору:** без registry cache каждый CI run выполняет полный `npm ci` (~60s) даже при неизменённых зависимостях. С cache — только при изменении `package-lock.json`.

---

## 6. Reusable workflows

### Когда что использовать

```
Composite Action:
  - Переиспользуемые STEPS (не полный job)
  - Принимает inputs, возвращает outputs
  - Запускается в контексте вызывающего job
  - Нет доступа к secrets напрямую (передавать через inputs)

Reusable Workflow:
  - Переиспользуемый полный JOB
  - Своя VM, своя изоляция
  - Прямой доступ к secrets через inherit
  - Может содержать несколько jobs
```

### Composite action

```yaml
# .github/actions/setup-node-env/action.yml
name: 'Setup Node Environment'
description: 'Checkout, setup node, install deps'
inputs:
  node-version:
    default: '24'
outputs:
  cache-hit:
    value: ${{ steps.cache.outputs.cache-hit }}
runs:
  using: 'composite'
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v6
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'
    - run: npm ci
      shell: bash
```

```yaml
# Использование в workflow
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-node-env
        with:
          node-version: 24
      - run: npm test
```

### Reusable workflow

```yaml
# .github/workflows/deploy.yml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      DEPLOY_KEY:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - run: echo "Deploying to ${{ inputs.environment }}"
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

```yaml
# Вызов из другого workflow
jobs:
  deploy-prod:
    uses: ./.github/workflows/deploy.yml
    with:
      environment: production
    secrets:
      DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
      # или: secrets: inherit  ← передать все secrets
```

---

## Антипаттерны

**1. Последовательный pipeline без параллелизации**
```yaml
# ❌ lint → test → build → deploy (8 минут последовательно)
needs: [lint]    # test ждёт lint
needs: [test]    # build ждёт test

# ✅ lint, test, typecheck параллельно → build → deploy (3 минуты)
needs: [lint, test, typecheck]
```

**2. `npm install` вместо `npm ci` в CI**
`npm install` обновляет `package-lock.json` при несовпадении. В CI нужна воспроизводимая сборка — только `npm ci`. Разница: `npm ci` падает при несовпадении, `npm install` — молча обновляет.

**3. Секреты через `run: echo $SECRET`**
GitHub маскирует secrets в логах, но только точные совпадения. Base64, JSON, URL-encoded форматы — не маскируются. Никогда не выводить secrets в stdout явно.

**4. `runs-on: ubuntu-latest` без пининга**
`ubuntu-latest` меняется (сейчас 24.04). При смене версии — изменение поведения инструментов. Для production pipeline — пинить: `ubuntu-24.04`.

**5. Хранить долгоживущие cloud credentials в secrets**
AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY живут вечно — скомпрометированы при утечке secrets. Переходить на OIDC.

**6. `if: always()` для деплоя**
```yaml
# ❌ Деплой запустится даже при падении тестов
deploy:
  needs: test
  if: always()

# ✅ Явное условие
deploy:
  needs: test
  if: success() && github.ref == 'refs/heads/main'
```

---

## Anti-checklist ☠️

- [ ] `npm install` вместо `npm ci` в CI — молча обновляет lock-файл, невоспроизводимая сборка
- [ ] Секреты через `run: echo $SECRET` — base64/JSON форматы не маскируются
- [ ] `runs-on: ubuntu-latest` без пина — при смене версии меняется поведение
- [ ] `if: always()` для деплоя — запустится даже при падении тестов
- [ ] `set-output` (deprecated) — удалён, используй `$GITHUB_OUTPUT`
- [ ] Долгоживущие cloud credentials в secrets — OIDC даёт ephemeral token на час
- [ ] `cancel-in-progress: true` для main branch — отменяет деплой на полпути

## Задачи AI-кодеру

**Плохая формулировка:**
> «Создай CI/CD для Node.js проекта»

**Хорошая формулировка:**
> «Создай `.github/workflows/ci.yml` для Node.js 24 TypeScript проекта.
> Jobs параллельно: `lint` (eslint), `typecheck` (tsc --noEmit), `test` (vitest --run).
> `build` после всех трёх через `needs: [lint, typecheck, test]`.
> `deploy` только на main, после build, `environment: production`.
> Каждый job: `actions/checkout@v5` + `actions/setup-node@v6` с `cache: 'npm'` + `npm ci`.
> `concurrency: group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true`.
> Глобальные `permissions: contents: read`. Пинить `runs-on: ubuntu-24.04`.»

---

**Плохая формулировка:**
> «Добавь Docker build в CI»

**Хорошая формулировка:**
> «Добавь job `docker` в ci.yml после успешного `build` (`needs: build`).
> Steps: `docker/setup-buildx-action@v3`, `docker/login-action@v3` для GHCR (password: secrets.GITHUB_TOKEN).
> `docker/build-push-action@v6`: push только на main, теги `latest` и `github.sha`.
> Registry cache: `cache-from/cache-to type=registry,ref=ghcr.io/${{ github.repository }}:buildcache,mode=max`.
> Permissions job: `packages: write`.»

---

## Чеклист архитектора

**Структура pipeline**
- [ ] lint / typecheck / test параллельны, build после них
- [ ] `needs` граф корректен — deploy не запустится при падении тестов
- [ ] `concurrency` настроен: cancel-in-progress для feature branches, false для main

**Производительность**
- [ ] `actions/setup-node@v6` с `cache: 'npm'` или `cache: 'pnpm'`
- [ ] Cache keys включают `hashFiles('**/package-lock.json')`
- [ ] Docker: registry cache с `mode=max`

**Security**
- [ ] Глобальные `permissions: contents: read`
- [ ] `environment: production` с required reviewers для деплоя
- [ ] OIDC для cloud credentials, не долгоживущие secrets
- [ ] Secrets не выводятся в `run:` командах
- [ ] Fork PR не имеет доступа к secrets — обработано

**Надёжность**
- [ ] `runs-on: ubuntu-24.04` (пинован, не `latest`)
- [ ] `npm ci` (не `npm install`)
- [ ] `fail-fast: false` для compatibility matrix
- [ ] `$GITHUB_OUTPUT` (не `set-output`)

---

*Модуль 25 завершён.*
*Следующий: [Модуль 26 — Logging / observability](../26-logging/README.md)*
