# Security Checklist — карта угроз по модулям курса

> Security — не отдельная опция, а архитектурный слой. Этот файл собирает
> все security-практики из разных модулей в единый чеклист.

---

## 1. Supply Chain и зависимости

| # | Практика | Модуль | Где |
|---|----------|--------|-----|
| 1.1 | Пиновать версии зависимостей (не `^`/`~`) | 19 | `package.json`, `go.mod` |
| 1.2 | Проверять lock-файл в CI (`npm ci --ignore-scripts`) | 19 | `.github/workflows/ci.yml` |
| 1.3 | SBOM для AI pipeline | 47 | dependencies scan |
| 1.4 | Избегать axios в новых проектах (supply chain risk) | 19 §10 | undici / got вместо axios |
| 1.5 | `npm ci`, не `npm install` в CI | 25 §2 | `.github/workflows/ci.yml` |

## 2. Docker / Container

| # | Практика | Модуль | Где |
|---|----------|--------|-----|
| 2.1 | `USER node` перед CMD | 24 §4 | Dockerfile |
| 2.2 | `COPY --chown=node:node` для файлов приложения | 24 §4 | Dockerfile |
| 2.3 | tini как ENTRYPOINT (PID 1 обработка сигналов) | 24 §4 | Dockerfile |
| 2.4 | `.dockerignore` исключает node_modules, .env, .git | 24 §4 | .dockerignore |
| 2.5 | BuildKit secret mount вместо ENV для токенов | 24 §3 | Dockerfile |
| 2.6 | Read-only filesystem + tmpfs для runtime | 24 §4 | docker run --read-only |
| 2.7 | `--cap-drop ALL` для минимизации прав | 24 §4 | docker run |

## 3. Secrets Management

| # | Практика | Модуль | Где |
|---|----------|--------|-----|
| 3.1 | Short-lived tokens, не долгоживущие secrets | 41, 47 | MCP auth, CI/CD |
| 3.2 | OIDC вместо PAT для cloud деплоев | 25 §4 | GitHub Actions |
| 3.3 | Secrets не хранить в промпте | 06 §7 | system prompt |
| 3.4 | Secrets не передавать модели | 47 | agent → LLM |
| 3.5 | Secrets не логировать (redact paths в Pino) | 26 §2 | logger config |
| 3.6 | Environment secrets vs Repository secrets | 25 §4 | GitHub |
| 3.7 | Fork PR не имеет доступа к secrets | 25 §1 | CI pipeline |
| 3.8 | `.env` в `.gitignore` | 24 §4 | корень проекта |

## 4. API и Network

| # | Практика | Модуль | Где |
|---|----------|--------|-----|
| 4.1 | rate-limiting на нескольких уровнях (CDN → App → Service) | 23 §2 | архитектура |
| 4.2 | 429 всегда содержит Retry-After | 23, 19 | middleware |
| 4.3 | `rejectUnauthorized: true` в TLS | 19 §7 | undici/HTTPS |
| 4.4 | Permission Model Node.js (`--allow-fs-read`, `--allow-net`) | 01 §5 | node запуск |
| 4.5 | `os.Root` для изолированного доступа к ФС | 05 §3 | Go |
| 4.6 | Trust proxy настроен для X-Forwarded-For | 23 §2 | Express |

## 5. Prompt Injection и AI Security

| # | Практика | Модуль | Где |
|---|----------|--------|-----|
| 5.1 | Retrieved documents = untrusted input | 47 | RAG pipeline |
| 5.2 | Tool allowlist, не blocklist | 41, 47 | MCP server |
| 5.3 | Human approval для write/destructive/secrets actions | 41, 42, 47 | policy engine |
| 5.4 | Output guardrails: PII redaction, schema validation | 46, 47 | AgentOps |
| 5.5 | No secrets in prompt (prompt leaking через LLM) | 06 §7 | prompt design |
| 5.6 | Audit log каждого tool call с agentId, userId | 41 | MCP server |
| 5.7 | Immutable audit trail | 47 | logging |
| 5.8 | System prompt ≠ security boundary | 47 | архитектура |
| 5.9 | Isolated browser context per agent run | 44 | Playwright |

## 6. Database и Data

| # | Практика | Модуль | Где |
|---|----------|--------|-----|
| 6.1 | No `KEYS` in Redis — только `SCAN` | 20 §5 | Redis |
| 6.2 | PostgreSQL `row level security` для multi-tenant | 12 | pgvector |
| 6.3 | Tenant/user isolation в agent memory | 43 | Memory Controller |
| 6.4 | Retention policy для памяти агентов | 43 | forget policy |
| 6.5 | No raw secrets in logs even for debugging | 26 §2 | Pino redact |
| 6.6 | Query timeout (`statement_timeout` в Postgres) | 12 | DB config |

## 7. CI/CD

| # | Практика | Модуль | Где |
|---|----------|--------|-----|
| 7.1 | `permissions: contents: read` глобально | 25 §1 | workflow |
| 7.2 | `environment: production` с required reviewers | 25 §4 | GitHub |
| 7.3 | `cancel-in-progress: false` для main | 25 §1 | concurrency |
| 7.4 | OIDC вместо долгоживущих cloud credentials | 25 §4 | AWS/GCP |
| 7.5 | `ignore-scripts=true` в .npmrc или CI | 19 §10 | npm config |
| 7.6 | Docker: BuildKit secret mount, не ENV | 24 §3 | Dockerfile |

---

## Быстрая проверка при деплое (топ-10)

- [ ] **S1**: `USER node` в Dockerfile?
- [ ] **S2**: `.dockerignore` есть и исключает node_modules/.env?
- [ ] **S3**: `npm ci`, не `npm install` в CI?
- [ ] **S4**: `permissions: contents: read` в workflow?
- [ ] **S5**: Pino `redact` для credentials?
- [ ] **S6**: Rate limiting на нескольких уровнях?
- [ ] **S7**: Retrieved documents = untrusted?
- [ ] **S8**: Secrets не передаются в LLM?
- [ ] **S9**: Audit log каждого tool call?
- [ ] **S10**: TLS rejectUnauthorized: true?

---

*Карта составлена по модулям 01–47 AI Architect Course. Июль 2026.*
