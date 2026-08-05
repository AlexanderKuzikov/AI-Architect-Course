# Модуль 24 — Docker

> **Для AI-архитектора:** Docker — не про «завернуть приложение в контейнер». Это про управление слоями, воспроизводимость сборки и security posture образа. AI-кодер сделает работающий Dockerfile за 30 секунд. Он будет весить 2GB, запускаться от root и пересобираться полностью при каждом изменении кода.
> Один день изучения — layer model, multi-stage builds, BuildKit cache mounts, hardening.

---

## Содержание

1. [Layer model — механика и кэш](#1-layer-model)
2. [Multi-stage builds](#2-multi-stage-builds)
3. [BuildKit — cache mounts и секреты](#3-buildkit)
4. [Security hardening образа](#4-security-hardening)
5. [Docker Compose для разработки](#5-docker-compose)
6. [Антипаттерны](#антипаттерны)
7. [Задачи AI-кодеру](#задачи-ai-кодеру)
8. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

> Апрель 2026

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Docker Engine | **29.x** | Container runtime |
| Docker Compose | **v2.40+** | Multi-container orchestration |
| BuildKit | **встроен в Docker 29** | Параллельная сборка, cache mounts |
| tini | **0.19.0** | PID 1 init process |
| Node.js base image | **node:24-alpine** | Базовый образ |

---

## 1. Layer model

### Как строятся слои

Каждая инструкция Dockerfile создаёт read-only слой. Финальный образ — стек слоёв с copy-on-write файловой системой поверх них.

```
Dockerfile:
FROM node:24-alpine          → layer 0: базовый образ (несколько слоёв)
RUN apk add dumb-init        → layer 1: dumb-init бинарник
COPY package*.json ./        → layer 2: package.json + package-lock.json
RUN npm ci                   → layer 3: node_modules (тяжёлый, ~200MB)
COPY src/ ./src              → layer 4: исходники (лёгкий, ~1MB)

При изменении src/:
  Слои 0–3 из кэша ✅
  Слои 4:    пересборка ← только этот
```

Инвалидация кэша работает каскадно: изменение любого слоя инвалидирует все последующие.

### Порядок COPY — основное правило оптимизации

```dockerfile
# ❌ Изменение любого файла src/ → пересборка npm install (~60s)
FROM node:24-alpine
COPY . .
RUN npm ci

# ✅ package.json меняется редко → npm install в кэше при изменении кода
FROM node:24-alpine
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/ ./src
```

### Граничные случаи — где ломается

**COPY с glob и кэш**: `COPY package*.json ./` инвалидирует кэш при изменении любого файла, начинающегося на `package`. Включая `package-lock.json`. Это нормально — изменение lock-файла требует переустановки зависимостей.

**ARG до FROM**: `ARG` перед `FROM` существует в отдельном scope. После `FROM` нужно повторить `ARG` без значения для доступа к нему.

```dockerfile
ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION}
ARG NODE_VERSION  # ← повторить для доступа внутри образа
RUN echo "Building on node ${NODE_VERSION}"
```

**`docker history` и секреты**: `RUN npm install --registry https://user:token@registry` — токен виден в `docker history IMAGE`. Никогда не передавать секреты через `RUN`-команды — только через BuildKit secrets.

**Почему это важно архитектору:** порядок инструкций в Dockerfile — это архитектурное решение о времени CI сборки. Неправильный порядок = 60s npm install на каждый коммит.

---

## 2. Multi-stage builds

### Принцип: builder ≠ runtime

Build tools (компилятор, npm devDependencies, tsc) нужны только при сборке. В production образе — только артефакты.

```dockerfile
# ─── Stage 1: deps ───────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev   # только production deps

# ─── Stage 2: builder ────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci               # все deps включая devDependencies
COPY tsconfig.json ./
COPY src/ ./src
RUN npm run build        # tsc → dist/

# ─── Stage 3: runner (финальный образ) ───────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

# Только нужное:
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Не попадает в финальный образ:
# - devDependencies
# - src/
# - tsconfig.json
# - весь builder stage (~500MB)
```

### Размеры образов

```
Без multi-stage:  node:24-alpine + src + ALL deps + build tools ≈ 600MB
С multi-stage:    node:24-alpine + dist + prod deps only         ≈ 180MB
Distroless:       gcr.io/distroless/nodejs24 + dist             ≈  80MB
```

### Именованные targets для CI

```dockerfile
FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS test
COPY . .
RUN npm run test:ci    # запустить тесты на этом stage

FROM base AS build
RUN npm ci --omit=dev
COPY src/ ./src
RUN npm run build

FROM node:24-alpine AS runner
# ... production stage
```

```bash
# В CI: собрать только до test stage, сфейлить если тесты не прошли
docker build --target test -t app:test .
docker run app:test

# Собрать финальный образ только если тесты прошли
docker build --target runner -t app:prod .
```

### Граничные случаи — где ломается

**node_modules платформо-зависимы**: `COPY --from=deps /app/node_modules ./node_modules` работает если архитектура builder и runner одинаковая. При multi-arch сборке (amd64 builder → arm64 runner) — нативные аддоны (Sharp, bcrypt) падают. Решение: отдельные `npm ci` в runner stage.

**Почему это важно архитектору:** `COPY --from` не проверяет бинарную совместимость. Это выявляется только при первом запуске на target архитектуре.

---

## 3. BuildKit

### Cache mounts — npm install без переустановки

BuildKit cache mounts — persistent volume между сборками. npm/pnpm используют глобальный кэш пакетов — без mount кэш теряется при каждой сборке.

```dockerfile
# ✅ BuildKit cache mount для npm
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# При повторной сборке:
# - package.json не изменился → cache miss на COPY → кэш слоя
# - package.json изменился → COPY обновлён → RUN запускается
#   но /root/.npm уже заполнен → npm скачивает только новые пакеты
```

```dockerfile
# ✅ pnpm с cache mount
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod
```

### Secret mounts — приватные npm registry

```dockerfile
# ❌ Секрет видён в docker history и layer
RUN npm config set //registry.example.com/:_authToken=${NPM_TOKEN}
RUN npm install

# ✅ Secret mount — не попадает в слои
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
```

```bash
# Передать секрет при сборке
docker build \
  --secret id=npmrc,src=$HOME/.npmrc \
  -t myapp .
```

### Параллельные stages

BuildKit автоматически параллелизует независимые stages:

```dockerfile
FROM node:24-alpine AS test-unit
# ...
RUN npm run test:unit

FROM node:24-alpine AS test-integration
# ...
RUN npm run test:integration

FROM node:24-alpine AS build
# ...
RUN npm run build

# Финальный stage зависит от всех → BuildKit запустит test-unit,
# test-integration и build параллельно
FROM node:24-alpine AS runner
COPY --from=test-unit /app/coverage ./coverage   # проверить артефакт
COPY --from=build /app/dist ./dist
```

### Граничные случаи — где ломается

**Cache mounts в CI**: BuildKit cache mounts — локальные по умолчанию. В CI (GitHub Actions, GitLab) нет persistence между runs без явного `--cache-from`. Использовать registry cache:

```bash
docker build \
  --cache-from type=registry,ref=registry.example.com/myapp:buildcache \
  --cache-to type=registry,ref=registry.example.com/myapp:buildcache,mode=max \
  -t myapp .
```

**Почему это важно архитектору:** cache mounts ускоряют локальную разработку, но в CI требуют дополнительной конфигурации. Без неё — прироста нет.

---

## 4. Security hardening

### Non-root user — обязательный минимум

По умолчанию Node.js процесс в контейнере запускается от root. Компрометация приложения = root в контейнере.

```dockerfile
FROM node:24-alpine AS runner
WORKDIR /app

# node:24-alpine уже содержит пользователя 'node' (UID 1000)
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Переключиться на non-root до CMD
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
# Проверить что процесс не root
docker run --rm myapp whoami
# → node
```

### PID 1 и обработка сигналов

Node.js процесс как PID 1 не пересылает сигналы дочерним процессам и не reaps zombie-процессы. SIGTERM от `docker stop` может не дойти до Node.js.

```dockerfile
# ✅ tini как init process
FROM node:24-alpine AS runner

# node:24-alpine: добавить tini
RUN apk add --no-cache tini

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]

# Теперь: docker stop → SIGTERM → tini → Node.js → graceful shutdown
```

```typescript
// В Node.js: явная обработка graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, starting graceful shutdown')
  await server.close()       // перестать принимать новые соединения
  await db.pool.end()        // закрыть соединения с БД
  await redisClient.quit()   // закрыть Redis
  process.exit(0)
})
```

### Read-only filesystem + tmpfs

```dockerfile
# Dockerfile — ничего дополнительного
# Runtime: запустить с --read-only
```

```bash
docker run \
  --read-only \
  --tmpfs /tmp \           # разрешить запись только в /tmp
  --tmpfs /app/logs \      # и в logs если нужно
  myapp
```

```yaml
# docker-compose.yml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
```

### .dockerignore — что исключать

```dockerignore
# Управление версиями
.git
.gitignore

# Зависимости (пересобираются в контейнере)
node_modules
npm-debug.log

# Конфигурация локальной разработки
.env
.env.*
docker-compose*.yml
Dockerfile*

# Тесты и документация (не нужны в production образе)
**/*.test.ts
**/*.spec.ts
coverage/
docs/

# IDE и OS
.vscode
.idea
.DS_Store
*.swp
```

**Критический момент**: без `.dockerignore` → `COPY . .` копирует `node_modules` из хоста (если есть) в контейнер → build context огромный → сборка медленная → нативные аддоны хоста попадают в образ (неправильная платформа).

### Граничные случаи — где ломается

**Capabilities**: даже non-root процесс может иметь Linux capabilities. Дропать все явно:

```bash
docker run \
  --cap-drop ALL \
  --cap-add NET_BIND_SERVICE \  # только если нужен порт < 1024
  myapp
```

**seccomp и AppArmor**: для критичных сервисов — явные seccomp profiles. Docker default seccomp profile блокирует ~44 syscalls, но не всё.

**Почему это важно архитектору:** security hardening — слоёный. Каждый уровень (non-root, read-only fs, drop caps, seccomp) независим. Минимальный production baseline: non-root + tini.

---

## 5. Docker Compose для разработки

### Watch mode — синхронизация без rebuild

Docker Compose 2.22+ поддерживает `watch` — файловый watcher с действиями на изменения:

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    develop:
      watch:
        - action: sync          # скопировать файл в контейнер без rebuild
          path: ./src
          target: /app/src
        - action: rebuild       # полный rebuild при изменении зависимостей
          path: package.json
        - action: rebuild
          path: package-lock.json
        - action: sync+restart  # sync и перезапустить процесс
          path: .env
          target: /app/.env
```

```bash
docker compose watch   # запустить с watch mode
```

### Healthcheck и depends_on

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy   # ждать healthcheck
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://postgres:secret@postgres:5432/myapp
      REDIS_URL: redis://redis:6379
```

### Граничные случаи — где ломается

**node_modules volume mount**: популярный паттерн — монтировать код с хоста, а node_modules оставить в контейнере:

```yaml
# ❌ Проблема на Linux: UID хоста ≠ UID контейнера (node=1000)
volumes:
  - .:/app
  - /app/node_modules  # anonymous volume "shadow" node_modules
```

При `USER node` в Dockerfile: anonymous volume создаётся от root, Node процесс не может писать. Решение: явный `chown` или использовать watch mode вместо bind mount.

**Compose networking**: сервисы обращаются друг к другу по имени сервиса (`postgres`, `redis`) — только внутри одной Compose network. Localhost не работает.

**Почему это важно архитектору:** `depends_on: condition: service_healthy` — единственный правильный способ дождаться готовности БД. `depends_on` без condition — только порядок запуска, не готовность сервиса.

---

## 6. Реальный кейс: 680 MB → 82 MB за счёт WASM

### Контекст

PDF-рендер-сервис (обработка судебных PDF, PDFtoText): рендер страниц в bitmap для VLM-пайплайна. Первая версия — PDF.js + canvas.

### Задача

Рендер-сервис в Docker: первая версия собиралась с `apt-get install libcairo2-dev` — системная библиотека для canvas. Образ раздулся до 680 MB, сборка CI замедлилась, каждый слой с apt-пакетами — отдельная точка отказа.

### Гипотеза

PDFium WASM (чистый Node.js, без native deps) уберёт системные пакеты: образ станет маленьким, а заодно уйдёт проблема «собери libcairo в Alpine».

### Что получилось

| Метрика | PDF.js + canvas | PDFium WASM |
|---------|----------------|-------------|
| Docker образ | 680 MB + libcairo2-dev | **82 MB** (WASM) |
| Системные пакеты | apt-get install | нет |
| Сборка в CI | apt-слой кэшируется плохо | только npm ci |

```
# Финальный Dockerfile (реальный)
FROM node:24-alpine AS runner
USER node                          # не root
COPY --chown=node:node dist/ dist/
COPY --chown=node:node node_modules/ node_modules/
ENTRYPOINT ["tini", "--"]          # PID 1: сигналы работают
CMD ["node", "dist/server.js"]
```

### Грабли, найденные в production

1. **`ENTRYPOINT ["node", ...]` без tini**: контейнер с Node как PID 1 не обрабатывает SIGTERM — `docker stop` убивает через SIGKILL после таймаута, graceful shutdown не работает. tini как ENTRYPOINT — обязателен, а не «для красоты».
2. **Холодный старт WASM**: PDFiumLibrary инициализируется 500ms–1s — в контейнере это значит медленный старт при каждом рестарте/масштабировании. Модель инициализируется один раз при старте процесса, а не по запросу.
3. **82 MB ≠ быстро**: сжатие образа не компенсирует ~10 МБ WASM-бинаря при каждой загрузке слоя в CI/CD — docker-слой кэшируется, но при cold pull выигрыш всё равно в 8× против 680 MB.

### Вывод, противоречащий интуиции

Проблема была не в Docker, а в выборе библиотеки: **архитектура определила образ**. Переход на WASM сократил образ на 88% без единой строчки Dockerfile-оптимизаций. Docker-навыки (multi-stage, cache mounts) дали бы 20–30%; выбор инструмента — 88%.

**Практический вывод для архитектора:** размер образа — производная от выбора зависимостей: native deps → apt-слои и multi-stage-хореография; WASM/чистый JS → маленький образ и простой Dockerfile. При проектировании сервиса закладывай «каким будет образ» ещё на этапе выбора библиотек.

---

## Антипаттерны

**1. Один большой RUN с &&**
```dockerfile
# ❌ Читаемо, но если любая команда упала — всё переустанавливается
RUN apt-get update && apt-get install -y git curl wget vim && npm install

# ✅ Разделить логически независимые шаги — отдельные слои с кэшем
RUN apk add --no-cache git curl
COPY package*.json ./
RUN npm ci
```

**2. `COPY . .` без .dockerignore**
Build context включает node_modules (сотни MB), .git, .env с секретами. Сборка медленная, образ потенциально содержит секреты в слоях.

**3. `CMD node server.js` без init process**
Shell форма `CMD` запускает `/bin/sh -c "node server.js"` — Node.js получает PID 2, не PID 1. SIGTERM идёт к sh, не к Node. Всегда: `CMD ["node", "dist/server.js"]` (exec форма) + tini как ENTRYPOINT.

**4. Секреты через ENV в Dockerfile**
```dockerfile
# ❌ NPM_TOKEN виден в docker history, docker inspect
ENV NPM_TOKEN=abc123
RUN npm install

# ✅ BuildKit secret mount
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

**5. Latest тег в production**
`FROM node:latest` или `image: redis:latest` — образ меняется без твоего ведома. Пинить минорные версии: `node:24-alpine`, `redis:7-alpine`.

**6. Запускать процессы от root**
`USER node` — две строки в Dockerfile. Не делать это = намеренно расширять attack surface.

---

## Anti-checklist ☠️

- [ ] COPY . . без .dockerignore — node_modules, .env, .git попадают в образ
- [ ] CMD node server.js без init process — SIGTERM идёт к sh, не к Node.js
- [ ] Секреты через ENV в Dockerfile — видны в docker history
- [ ] Latest тег в production — образ меняется без твоего ведома
- [ ] Запускать процессы от root — компрометация = root в контейнере
- [ ] COPY --from без учёта архитектуры — amd64 → arm64 падает с native addons

## Задачи AI-кодеру

**Плохая формулировка:**
> «Напиши Dockerfile для Node.js приложения»

**Хорошая формулировка:**
> «Создай multi-stage Dockerfile для Node.js 24 TypeScript приложения.
> Stages: `deps` (npm ci --omit=dev), `builder` (npm ci + tsc), `runner` (production).
> BuildKit cache mount для /root/.npm в deps и builder stages.
> Финальный образ: node:24-alpine, USER node (UID 1000), ENTRYPOINT tini.
> COPY с --chown=node:node. Expose 3000. CMD exec форма.
> .dockerignore: node_modules, .git, .env*, coverage/, **/*.test.ts.»

Формула: multi-stage (deps/builder/runner) + BuildKit cache + user/права (USER node, chown) + tini + .dockerignore.

---

**Плохая формулировка:**
> «Настрой docker-compose для локальной разработки»

**Хорошая формулировка:**
> «Создай docker-compose.yml с сервисами: app (build .), postgres:17-alpine, redis:7-alpine.
> postgres и redis — healthcheck через pg_isready и redis-cli ping.
> app — depends_on с condition: service_healthy для обоих.
> Compose watch для ./src (action: sync) и package.json (action: rebuild).
> Переменные окружения через env_file: .env.local.
> Без volume bind mount для node_modules.»

Формула: compose-сервисы (app/postgres/redis) + healthcheck + depends_on с condition + develop.watch + env_file.

---

## Чеклист архитектора

**Dockerfile**
- [ ] Multi-stage: отдельные deps / builder / runner stages
- [ ] `COPY package*.json` до `npm ci` — зависимости в кэшированном слое
- [ ] BuildKit cache mount для npm/pnpm store
- [ ] Секреты только через `--mount=type=secret`, не через ENV или RUN args
- [ ] Base image пинован на минорную версию: `node:24-alpine`

**Security**
- [ ] `USER node` перед CMD
- [ ] `COPY --chown=node:node` для файлов приложения
- [ ] tini как ENTRYPOINT
- [ ] SIGTERM обработан в Node.js (graceful shutdown)
- [ ] `.dockerignore` покрывает node_modules, .env*, .git, coverage

**Docker Compose**
- [ ] `depends_on: condition: service_healthy` для всех зависимостей
- [ ] `healthcheck` на каждом stateful сервисе
- [ ] `develop.watch` вместо bind mount node_modules
- [ ] Переменные через `env_file`, не inline

---

*Модуль 24 завершён.*
*Следующий: [Модуль 25 — CI/CD pipelines](../25-cicd/README.md)*
