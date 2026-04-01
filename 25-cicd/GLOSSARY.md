# GLOSSARY — CI/CD (GitHub Actions)

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**artifact**  
Файл или директория, загруженные из job через `actions/upload-artifact`. Доступны для download в последующих jobs (`actions/download-artifact`) или для ручного скачивания. Хранятся N дней (`retention-days`). Не предназначены для Docker образов — использовать registry.

---

## C

**cache (actions/cache)**  
Механизм сохранения директорий между runs для ускорения jobs. Ключ (`key`) — строка, определяющая версию кэша. При совпадении — restore, при отсутствии — создаётся новый после job. Cache-miss: `restore-keys` используется как fallback по префиксу.

**cancel-in-progress**  
Параметр `concurrency`: отменять предыдущий активный run при старте нового в той же группе. `true` для feature branches (экономия runner минут), `false` для production деплоя (не прерывать на полпути).

**composite action**  
Переиспользуемый набор шагов (`steps`), не полный job. Определяется в `action.yml`, вызывается через `uses:`. Запускается в контексте вызывающего runner. Inputs/outputs поддерживаются. Secrets передаются только через inputs, не напрямую.

**concurrency**  
Директива workflow/job: управление одновременными runs. `group` — ключ группировки (обычно `workflow-ref`). Предотвращает параллельное выполнение нескольких деплоев в один environment.

---

## E

**environment**  
Именованное окружение деплоя в GitHub (development, staging, production). Может требовать: ручной approve (`required reviewers`), wait timer, ограничение веток (`deployment branches`). Environment secrets доступны только при запуске job в этом environment.

---

## F

**fail-fast**  
Параметр matrix strategy: при `true` (default) — отменить все matrix jobs при первом failure. При `false` — все jobs выполняются до конца. Использовать `false` при compatibility тестировании (нужно видеть все результаты).

---

## G

**GITHUB_OUTPUT**  
Файл для передачи outputs из step: `echo "key=value" >> $GITHUB_OUTPUT`. Заменил deprecated `::set-output::` синтаксис. Значения доступны как `steps.<step-id>.outputs.key` в последующих steps.

**GITHUB_TOKEN**  
Автоматически генерируемый токен для каждого workflow run. Права определяются `permissions` в workflow. Живёт до конца job (максимум 6 часов). Для GHCR push нужен `packages: write`.

---

## J

**job**  
Единица выполнения в GitHub Actions: набор steps, запускаемых на одном runner. Каждый job — изолированная VM. Данные между jobs — только через artifacts или outputs. Параллелен с другими jobs если нет `needs` зависимостей.

---

## M

**matrix strategy**  
Параметризованный запуск одного job с разными значениями. `matrix: { node: [20, 22, 24] }` создаёт 3 параллельных job. Поддерживает несколько измерений: OS × Node версия.

---

## N

**needs**  
Зависимость между jobs: `needs: [lint, test]` — запустить job только после успешного завершения всех указанных. Формирует DAG pipeline. `needs` без `if: success()` — job запустится даже если зависимый упал при `if: always()`.

---

## O

**OIDC (OpenID Connect)**  
Протокол получения временных cloud credentials без хранения долгоживущих secrets. GitHub выдаёт JWT, cloud provider (AWS, GCP, Azure) верифицирует его и выдаёт временный token. Требует `permissions: id-token: write`. Заменяет хранение AWS_ACCESS_KEY_ID в secrets.

**outputs (job)**  
Значения, передаваемые из одного job в другой через `jobs.<job>.outputs`. Объявляются в `outputs:` блоке job, читаются как `needs.<job-id>.outputs.<key>`. Только строки — не объекты.

---

## P

**permissions**  
Явное ограничение прав `GITHUB_TOKEN` для workflow или job. Лучшая практика: глобально `contents: read`, добавлять необходимые права на уровне job. Минимизирует impact компрометации workflow.

---

## R

**restore-keys**  
Fallback ключи для `actions/cache` при отсутствии точного совпадения. Используется по префиксу: восстанавливает ближайший кэш. Позволяет частичное попадание при изменении lock-файла.

**reusable workflow**  
Переиспользуемый полный workflow с `on: workflow_call`. Содержит полные jobs с изоляцией, не просто steps. Может принимать `inputs` и `secrets`. Вызывается через `uses: ./.github/workflows/name.yml`. `secrets: inherit` — передать все secrets вызывающего.

**runner**  
VM или контейнер, выполняющий job. GitHub-hosted: `ubuntu-24.04`, `windows-latest`, `macos-latest`. Self-hosted: собственный сервер. Каждый job — свежая VM (ephemeral). Данные не персистируются между runs без cache/artifact.

---

## S

**step**  
Минимальная единица выполнения внутри job. Либо `run:` (shell команда), либо `uses:` (action). Steps одного job выполняются последовательно на одном runner. Разделяют файловую систему и переменные окружения в рамках job.

---

## W

**workflow**  
YAML файл в `.github/workflows/`. Определяет: events (`on:`), jobs, условия. Может быть вызван вручную (`workflow_dispatch`), по расписанию (`schedule`), или другим workflow (`workflow_call`). Несколько workflow в репозитории — независимы.

**workflow_call**  
Event триггер для reusable workflows. Позволяет вызывать workflow из другого workflow через `uses:`. Поддерживает `inputs` (типизированные параметры) и `secrets` (чувствительные данные).

---

*Глоссарий модуля 25. Следующий: [Модуль 26 — Logging / observability](../26-logging/GLOSSARY.md)*
