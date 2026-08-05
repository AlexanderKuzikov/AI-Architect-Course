# GLOSSARY — Docker

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**AppArmor**  
Linux security module: мандатный контроль доступа на уровне процессов. Docker автоматически применяет дефолтный AppArmor профиль `docker-default` к контейнерам. Для критичных сервисов — явные кастомные профили.

---

## B

**build context**  
Набор файлов, передаваемых Docker daemon при сборке образа. По умолчанию — всё содержимое директории, указанной в `docker build`. Без `.dockerignore` включает node_modules, .git и .env — медленная передача и потенциальная утечка секретов в слои.

**BuildKit**  
Улучшенный build engine Docker (default с Engine 23+). Возможности: параллельные stages, cache mounts (`--mount=type=cache`), secret mounts (`--mount=type=secret`), registry cache. Встроен в Docker Engine 29.

---

## C

**cache mount**  
BuildKit `--mount=type=cache,target=PATH`: persistent volume между сборками для кэша пакетных менеджеров. Не попадает в финальный образ. Ускоряет повторные сборки при изменении зависимостей: npm скачивает только новые пакеты, остальные из кэша.

**capabilities (Linux)**  
Гранулярные привилегии Linux процесса. Контейнеры по умолчанию получают subset capabilities. `--cap-drop ALL --cap-add NET_BIND_SERVICE` — минимальный набор для большинства Node.js приложений.

**CMD**  
Инструкция Dockerfile: команда запуска контейнера. Exec форма `["node", "dist/server.js"]` запускает node как PID 1 напрямую. Shell форма `node dist/server.js` запускает через `/bin/sh -c` — node получает PID 2, SIGTERM не доходит до него.

**copy-on-write**  
Механизм файловой системы контейнера: слои образа read-only. При записи файл копируется в writable layer контейнера. Исходный слой неизменён. Позволяет нескольким контейнерам делить одни слои образа.

---

## D

**depends_on**  
Директива Docker Compose управляющая порядком запуска сервисов. Без `condition` — только порядок старта, не готовность сервиса. `condition: service_healthy` — ждать успешного healthcheck. `condition: service_started` — только запуск (не готовность).

**distroless**  
Базовые образы Google (`gcr.io/distroless/nodejs24`) без shell, пакетного менеджера и лишних утилит. Минимальная attack surface: нет bash, нет apt, нет curl. Размер ~80MB для Node.js. Невозможно exec в контейнер — только distroless debug вариант.

**.dockerignore**  
Файл аналогичный `.gitignore`: исключает файлы из build context. Критичен для безопасности (исключить .env) и производительности (исключить node_modules). Без него COPY. . копирует всё включая node_modules хоста.

---

## E

**ENTRYPOINT**  
Инструкция Dockerfile: основной исполняемый процесс. В отличие от CMD — не переопределяется аргументами `docker run`. Комбинация: `ENTRYPOINT ["/sbin/tini", "--"]` + `CMD ["node", "dist/server.js"]` — tini как init, node как приложение.

---

## H

**healthcheck**  
Инструкция Dockerfile / директива Compose: команда проверки готовности сервиса. Параметры: `interval`, `timeout`, `retries`, `start_period`. Используется `depends_on: condition: service_healthy`. Без healthcheck Compose считает сервис готовым сразу после запуска.

---

## I

**image layer**  
Read-only слой файловой системы, создаваемый каждой инструкцией Dockerfile. Слои кэшируются по content hash. Изменение инструкции инвалидирует этот слой и все последующие — кэш ниже по Dockerfile не используется.

---

## M

**multi-stage build**  
Dockerfile с несколькими `FROM` инструкциями. Каждая stage независима. `COPY --from=stageName` переносит только нужные артефакты. Финальный образ содержит только runtime — без devDependencies, компилятора, исходников.

---

## N

**no-new-privileges**  
Флаг безопасности `--security-opt no-new-privileges`: запрещает процессу контейнера повысить привилегии через setuid/setgid. Предотвращает privilege escalation атаки.

---

## P

**PID 1**  
Первый процесс в namespace контейнера. Получает сигналы от Docker daemon (SIGTERM при `docker stop`). Node.js как PID 1 не обрабатывает zombie-процессы и может некорректно forwarding SIGTERM к дочерним. Решение: tini как PID 1.

---

## R

**read-only filesystem**  
`docker run --read-only` или `read_only: true` в Compose: запрещает запись в файловую систему контейнера за пределами tmpfs mount. Ограничивает возможности при компрометации. Требует явного `tmpfs` для временных файлов.

**registry cache**  
BuildKit `--cache-from type=registry,ref=...` / `--cache-to type=registry`: хранить BuildKit cache в container registry между CI runs. Альтернатива локальным cache mounts в stateless CI окружениях.

---

## S

**secret mount**  
BuildKit `--mount=type=secret,id=NAME,target=PATH`: файл с секретом доступен только во время выполнения `RUN` команды. Не попадает в слои образа, не виден в `docker history`. Передаётся через `docker build --secret id=NAME,src=FILE`.

**seccomp**  
Механизм ограничения syscalls для процессов. Docker применяет default seccomp profile (~300 разрешённых syscalls, ~44 заблокированных). Кастомный профиль позволяет минимизировать доступные syscalls для конкретного приложения.

---

## T

**tini**  
Минималистичный init process (версия 0.19.0). Корректно обрабатывает SIGTERM, forwards сигналы дочерним процессам, reaps zombie-процессы. Ставится через `apk add --no-cache tini` (в node:*-alpine по умолчанию не встроен). Использовать как `ENTRYPOINT ["/sbin/tini", "--"]`.

---

## W

**watch mode (Compose)**  
Docker Compose 2.22+: файловый watcher с действиями `sync` (копировать файл в контейнер), `rebuild` (пересобрать образ), `sync+restart` (sync + перезапустить). Альтернатива bind mount node_modules с проблемами UID и платформо-зависимых бинарников.

---

*Глоссарий модуля 24. Следующий: [Модуль 25 — CI/CD pipelines](../25-cicd/GLOSSARY.md)*
