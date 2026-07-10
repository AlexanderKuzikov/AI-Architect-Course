# CI/CD QuickRef

> Шпаргалка по GitHub Actions pipeline.
> Полный разбор — [Модуль 25](../25-cicd/README.md).

## Базовая структура CI

```yaml
name: CI
on: [push, pull_request]
permissions:
  contents: read  # ← обязательно: минимум прав

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-24.04  # пинить версию, не latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci    # не npm install!
      - run: npm run lint
```

## Параллельные jobs

```yaml
jobs:
  lint: …       # параллельно
  typecheck: …  # параллельно
  test: …       # параллельно
  build:
    needs: [lint, typecheck, test]  # после всех
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
```

## Docker build в CI

```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    password: ${{ secrets.GITHUB_TOKEN }}
- uses: docker/build-push-action@v6
  with:
    push: ${{ github.ref == 'refs/heads/main' }}
    tags: ghcr.io/myorg/myapp:latest
    cache-from: type=registry,ref=myapp:buildcache
    cache-to: type=registry,ref=myapp:buildcache,mode=max
    secrets: |
      npmrc=${{ secrets.NPMRC_CONTENT }}
```

## Security в CI

- `permissions: contents: read` — глобально
- `environment: production` — требует approve
- OIDC для cloud credentials (не долгоживущие секреты)
- Fork PR не имеет доступа к secrets
- `npm ci`, не `npm install`
- `runs-on: ubuntu-24.04` (пин, не `latest`)
- `cancel-in-progress: false` для main

## Ошибки

- `set-output` deprecated → использовать `$GITHUB_OUTPUT`
- `secrets` не выводить в `run: echo $SECRET`
- `if: always()` для деплоя → деплоит даже при падении тестов
