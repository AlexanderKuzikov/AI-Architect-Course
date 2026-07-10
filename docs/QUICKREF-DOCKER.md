# Docker QuickRef

> Шпаргалка по Dockerfile, Compose и production-безопасности.
> Полный разбор — [Модуль 24](../24-docker/README.md).

## Multi-stage Dockerfile

```dockerfile
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
RUN apk add --no-cache tini
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
EXPOSE 3000
```

## Docker Compose с healthcheck

```yaml
services:
  postgres:
    image: postgres:17-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
```

## Команды

```bash
# Build
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
docker build --cache-from type=registry,ref=mycache --cache-to type=registry,mode=max -t myapp .

# Run
docker run --read-only --tmpfs /tmp --cap-drop ALL --cap-add NET_BIND_SERVICE myapp

# Проверка
docker history IMAGE          # layers + secrets в RUN?
docker run --rm myapp whoami  # не root?
```

## Security (минимальный baseline)

- [ ] `USER node` перед CMD
- [ ] tini как ENTRYPOINT
- [ ] BuildKit secret mount для npm токенов
- [ ] `.dockerignore` с node_modules, .env, .git
- [ ] Base image пинован: `node:24-alpine` (не `:latest`)
- [ ] `--read-only` + `--tmpfs` в runtime
