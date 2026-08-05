# Модуль 04 — Python

> **Для AI-архитектора:** Python в 2026 — это не скриптовый язык
> для джунов. Это первоклассная ML/AI платформа, CLI-экосистема
> и язык для data pipeline'ов. Python 3.14 перевернул модель
> параллелизма — впервые за 30 лет GIL стал опциональным.

---

## Содержание

1. [Python в 2026 — честная оценка](#1-python-в-2026--честная-оценка)
2. [Механика исполнения и GIL](#2-механика-исполнения-и-gil)
3. [Современный Python 3.13 / 3.14](#3-современный-python-313--314)
4. [Асинхронность — asyncio](#4-асинхронность--asyncio)
5. [Типизация и инструменты качества](#5-типизация-и-инструменты-качества)
6. [Python для AI/ML pipeline](#6-python-для-aiml-pipeline)
7. [Управление проектом — uv](#7-управление-проектом--uv)
8. [Граничные случаи и ловушки](#8-граничные-случаи-и-ловушки)
9. [Python и AI-кодер](#9-python-и-ai-кодер)
10. [Антипаттерны](#10-антипаттерны)
11. [Задачи AI-кодеру](#11-задачи-ai-кодеру)
12. [Чеклист архитектора](#12-чеклист-архитектора)

---

## Актуальные версии (март 2026)

| Версия | Дата выхода | Статус | Поддержка до |
|--------|-------------|--------|-------------|
| Python 3.11 | Октябрь 2022 | Security only | Октябрь 2027 |
| Python 3.12 | Октябрь 2023 | Security only | Октябрь 2028 |
| Python 3.13 | Октябрь 2024 | **Active** | Октябрь 2029 |
| **Python 3.14** | **Октябрь 2025** | **Active (рекомендуется)** | **Октябрь 2030** |

**Для нового проекта:** Python 3.14 — free-threaded mode production-ready,
t-strings, sub-interpreters в stdlib. Минимум Python 3.13 для новых проектов.

---

## 1. Python в 2026 — честная оценка

### Где Python доминирует

Python стал первичным языком AI/ML по нескольким причинам:
- **Экосистема** — PyTorch, NumPy, Pandas, Transformers, LangChain
  написаны на Python. Альтернативы нет
- **REPL-культура** — Jupyter Notebook — де-факто стандарт исследований
  и прототипирования
- **Быстрота прототипирования** — минимум церемониального кода
- **Клей между системами** — вызов C/C++/Rust библиотек через ctypes,
  cffi, pybind11 без overhead на разработку

### Где Python проигрывает

| Задача | Лучшая альтернатива | Причина |
|--------|--------------------|---------| 
| HTTP API с нагрузкой | Go, Node.js | GIL (даже в 3.14 переходный период) |
| CLI-инструменты | Go, Rust | Медленный холодный старт |
| Системное программирование | Go, Rust | Нет контроля памяти |
| Статическая генерация | PHP | Накладные расходы рантайма |

### Ниша в стеке AI-архитектора

```
Node.js / Go    ← веб, API, CLI-инструменты, оркестрация
      ↕
   Python       ← ML pipeline, обработка данных, LLM-интеграция,
                  скрипты для Jupyter, data extraction
      ↕
  C/C++/Rust    ← ядро PyTorch, NumPy, критичный числодробильный код
```

Python — правильный выбор когда нужна ML-экосистема.
Не правильный — когда нужна производительность I/O или низкая
latency сервиса.

---

## 2. Механика исполнения и GIL

### CPython — основная реализация

Python в 99% случаев означает **CPython** — референсная реализация
на C. Компилирует код в байткод (`.pyc` файлы), интерпретирует
через виртуальную машину.

```
исходный код (.py)
      ↓
  лексинг + парсинг
      ↓
  байткод (.pyc) — кэшируется в __pycache__/
      ↓
  выполнение в CPython VM
```

### GIL — что это и почему важно

**GIL (Global Interpreter Lock)** — мьютекс в CPython, позволяющий
только одному потоку выполнять Python-байткод в каждый момент.

Создан для решения конкретной проблемы: управление памятью CPython
через reference counting не является потокобезопасным. GIL решает
это грубо — полным взаимным исключением.

**Последствия для архитектора:**
- CPU-intensive код в нескольких потоках работает как в одном
- I/O-intensive код (сеть, файлы) — GIL отпускается во время I/O,
  поэтому многопоточность работает для I/O задач
- Традиционный обход GIL для CPU — `multiprocessing`

### Python 3.13 — экспериментальный no-GIL

Python 3.13 (октябрь 2024) добавил **экспериментальный** free-threaded
режим (PEP 703). Overhead на однопоточный код — ~40%.
Не для production.

### Python 3.14 — no-GIL production-ready

Python 3.14 (октябрь 2025) — **переломный момент**:
- Free-threading официально поддерживается и production-ready
- Overhead снизился с 40% до **5-10%** на однопоточный код
- Официальные инсталляторы включают free-threaded сборку
- GIL стал опциональным, а не фундаментальным

```python
import sys

# Проверка режима в runtime
if sys._is_gil_enabled() is False:
  print("Free-threaded Python — параллелизм активен")
elif sys._is_gil_enabled() is True:
  print("Стандартный Python с GIL")
```

**Что меняет отсутствие GIL:**

```python
# Python с GIL: 4 потока = 1x ускорение для CPU задач
# Python 3.14 no-GIL: 4 потока = 3-4x ускорение для CPU задач

import threading

def cpu_work(n):
  # Тяжёлые вычисления
  return sum(i**2 for i in range(n))

threads = [threading.Thread(target=cpu_work, args=(10_000_000,))
           for _ in range(4)]

# С GIL — выполнятся последовательно, несмотря на потоки
# Без GIL — выполнятся параллельно на 4 ядрах
```

**Важный нюанс для архитектора:**
Снятие GIL не делает код автоматически потокобезопасным.
Все race conditions, которые раньше маскировал GIL — теперь реальны.
Нужны явные блокировки (`threading.Lock`) для разделяемых данных.

**Python 3.15+ (2026+):** ожидается что free-threading станет
default build, а GIL-build станет opt-out вариантом.

### Sub-interpreters — новая модель параллелизма (Python 3.14)

PEP 734 добавил в stdlib пакет `interpreters` — официальный API
для изолированных подинтерпретаторов:

```python
import interpreters

# Создать изолированный подинтерпретатор
interp = interpreters.create()

# Создать канал для передачи данных
channel = interpreters.Channel()

# Запустить код в изолированном окружении
interp.exec("""
import heavy_processing
result = heavy_processing.run(data)
channel.send(result)
""")

result = channel.recv()
interp.close()
```

**Сравнение подходов к параллелизму в Python 3.14:**

| Подход | Изоляция памяти | Overhead создания | Передача данных |
|--------|-----------------|------------------|-----------------|
| `threading` | Нет (разделяемая) | Низкий | Прямой доступ |
| `multiprocessing` | Полная (копирование) | Высокий (fork) | Pickle |
| `sub-interpreters` | Полная (по умолчанию) | Средний | Channel |
| `asyncio` | Одна задача | Минимальный | Нет (однопоточный) |

### multiprocessing — классический обход GIL

До Python 3.14 — основной путь для CPU-параллелизма:

```python
from multiprocessing import Pool

def process_document(path: str) -> dict:
  # Каждый воркер — отдельный процесс с отдельным GIL
  return heavy_parse(path)

with Pool(processes=4) as pool:
  results = pool.map(process_document, file_paths)
```

**Граничный случай — сериализация через Pickle:**
При передаче данных между процессами Python сериализует их через
`pickle`. Не все объекты сериализуемы: lambda, локальные функции,
некоторые C-объекты. Это частая причина неожиданных ошибок
в AI-генерированном коде с multiprocessing.

---

## 3. Современный Python 3.13 / 3.14

### T-strings (Python 3.14, PEP 750)

Новый тип строковых литералов — `t"..."`. В отличие от f-strings,
не производят строку немедленно, а возвращают объект `Template`:

```python
from string.templatelib import Template

# f-string — сразу возвращает str
name = "<script>alert('xss')</script>"
f_result = f"Hello {name}"
# "Hello <script>alert('xss')</script>"  ← XSS уязвимость

# t-string — возвращает Template объект
t_result = t"Hello {name}"
# Template(...)  ← можно передать в безопасный рендерер

def html_render(template: Template) -> str:
  result = []
  for part in template:
    if isinstance(part, str):
      result.append(part)
    else:
      # Интерполированное значение — экранируем
      result.append(html_escape(str(part.value)))
  return "".join(result)

safe = html_render(t_result)
# "Hello &lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
```

**Практическое применение:**
- Безопасная генерация HTML/SQL без injection-уязвимостей
- Кастомные DSL для шаблонизации
- Структурированное логирование с типизированными значениями

**Для WebForge:** t-strings как альтернатива шаблонизатору —
безопасная генерация HTML на уровне синтаксиса.

### Deferred Annotations (Python 3.14, PEP 649)

Аннотации типов теперь вычисляются **лениво** — только при явном
обращении через `__annotations__`:

```python
# До Python 3.14 — нужны кавычки для forward reference
class Node:
  def next(self) -> "Node":  # 'Node' в кавычках — иначе NameError
    ...

# Python 3.14 — forward reference без кавычек
class Node:
  def next(self) -> Node:    # работает без кавычек
    ...
```

**Архитектурное значение:**
- Нет циклических импортов ради аннотаций
- Нет `from __future__ import annotations` — это теперь default
- Pydantic и другие библиотеки на аннотациях работают быстрее
  (не нужно вычислять все аннотации при загрузке модуля)

### Улучшенный REPL (Python 3.13)

Python 3.13 принёс полностью переработанный интерактивный REPL:
- Multiline editing — редактируй блоки кода напрямую
- Syntax highlighting в терминале
- Paste mode — вставка многострочного кода без проблем
- Сохранение истории между сессиями

Для AI-архитектора это важно при интерактивной отладке
ML-пайплайнов и exploration данных.

### Новый синтаксис Generic (Python 3.12+)

```python
# До Python 3.12
from typing import TypeVar
T = TypeVar('T')
def first(lst: list[T]) -> T: ...

# Python 3.12+ — встроенный синтаксис
def first[T](lst: list[T]) -> T: ...

# Для классов
class Stack[T]:
  def push(self, item: T) -> None: ...
  def pop(self) -> T: ...

# Type alias с новым синтаксисом
type Vector = list[float]
type Matrix[T] = list[list[T]]
```

### Match Statement (Python 3.10+) — структурное сопоставление

```python
# Мощнее чем switch — поддерживает деструктуризацию
def process_command(command: dict) -> str:
  match command:
    case {"action": "create", "type": "page", "slug": str(slug)}:
      return create_page(slug)

    case {"action": "delete", "id": int(id)} if id > 0:
      return delete_item(id)

    case {"action": action} if action not in ALLOWED_ACTIONS:
      raise ValueError(f"Недопустимое действие: {action}")

    case _:
      raise ValueError("Неизвестная команда")
```

**Практическое применение в AI-pipeline:**
```python
def route_llm_response(response: dict) -> Any:
  match response:
    case {"type": "text", "content": str(text)}:
      return process_text(text)
    case {"type": "tool_call", "name": str(name), "args": dict(args)}:
      return execute_tool(name, args)
    case {"type": "error", "code": int(code)}:
      raise ApiError(code)
```

---

## 4. Асинхронность — asyncio

### Модель конкурентности

asyncio — это не параллелизм, это **конкурентность** в одном потоке.
Пока одна корутина ждёт I/O — другая выполняется:

```
Event Loop (один поток):

coroutine A: ──── await I/O ────────────────── продолжение
coroutine B:             ──── await I/O ────── продолжение
coroutine C:                         ────────── выполнение
```

Правило: если в корутине нет `await` — она монополизирует Event Loop
пока не завершится. CPU-intensive код блокирует все остальные корутины.

### Базовые примитивы

```python
import asyncio

# Запуск нескольких корутин параллельно
async def main():
  results = await asyncio.gather(
    fetch_data("url1"),
    fetch_data("url2"),
    fetch_data("url3"),
  )

  # С обработкой ошибок каждой задачи отдельно
  tasks = [
    asyncio.create_task(fetch_data(url))
    for url in urls
  ]
  results = await asyncio.gather(*tasks, return_exceptions=True)
  for r in results:
    if isinstance(r, Exception):
      handle_error(r)
    else:
      process(r)

asyncio.run(main())
```

### asyncio.TaskGroup (Python 3.11+)

Более безопасный способ управления группой задач:

```python
async def process_batch(items: list[str]) -> list[dict]:
  results = []
  async with asyncio.TaskGroup() as tg:
    tasks = [
      tg.create_task(process_item(item))
      for item in items
    ]
  # При выходе из контекста — ждём ВСЕ задачи
  # При ошибке в любой — отменяем остальные (ExceptionGroup)
  return [t.result() for t in tasks]
```

**Разница с `asyncio.gather`:**
`TaskGroup` отменяет все задачи при ошибке в одной —
более предсказуемое поведение. `gather` по умолчанию
продолжает остальные задачи даже при ошибке в одной.

### asyncio для LLM-вызовов

```python
import asyncio
from typing import AsyncIterator

async def stream_llm_response(
  prompt: str,
  model: str = "CURRENT_OLLAMA_MODEL"
) -> AsyncIterator[str]:
  async with aiohttp.ClientSession() as session:
    async with session.post(
      "http://localhost:11434/api/generate",
      json={"model": model, "prompt": prompt, "stream": True}
    ) as resp:
      async for line in resp.content:
        if line:
          chunk = json.loads(line)
          if not chunk.get("done"):
            yield chunk["response"]

# Параллельные вызовы к нескольким моделям
async def compare_models(prompt: str) -> dict:
  async with asyncio.TaskGroup() as tg:
    tasks = {
      model: tg.create_task(
        collect_stream(stream_llm_response(prompt, model))
      )
      for model in ["CURRENT_OLLAMA_MODEL", "CURRENT_OLLAMA_MODEL_LARGE"]
    }
  return {model: task.result() for model, task in tasks.items()}
```

### Semaphore — ограничение concurrency

```python
# Параллельная обработка с ограничением одновременных запросов
async def process_all(items: list, max_concurrent: int = 5):
  semaphore = asyncio.Semaphore(max_concurrent)

  async def process_one(item):
    async with semaphore:
      return await process_item(item)

  return await asyncio.gather(*[process_one(i) for i in items])
```

**Критично для LLM API:** rate limiting через Semaphore —
простейший способ не превысить лимиты API.

### CPU в asyncio — правильный подход

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

executor = ProcessPoolExecutor(max_workers=4)

async def process_heavy(data: bytes) -> dict:
  loop = asyncio.get_event_loop()
  # Запускаем CPU-функцию в процессе, не блокируя Event Loop
  result = await loop.run_in_executor(
    executor,
    cpu_intensive_function,
    data
  )
  return result
```

---

## 5. Типизация и инструменты качества

### Аннотации типов — современный синтаксис

```python
# Python 3.10+ union синтаксис
def process(value: int | str | None) -> str | None: ...

# Python 3.12+ generic синтаксис
def batch[T](items: list[T], size: int) -> list[list[T]]: ...

# TypedDict для словарей с фиксированной структурой
from typing import TypedDict

class CourtData(TypedDict):
  code:    str
  name:    str
  region:  int
  website: str | None

# Protocol для структурной типизации
from typing import Protocol

class Processable(Protocol):
  def process(self) -> dict: ...
  @property
  def id(self) -> str: ...
```

### Dataclass — основа Value Objects

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class PageConfig:
  slug:     str
  title:    str
  template: str
  meta:     dict[str, str] = field(default_factory=dict)
  noindex:  bool = False

  def __post_init__(self):
    # Валидация после инициализации
    if not self.slug:
      raise ValueError("slug не может быть пустым")
    if not self.title:
      raise ValueError("title не может быть пустым")

# frozen=True  — неизменяемый, хэшируемый (как readonly в PHP)
# slots=True   — экономия памяти ~40%, ускорение доступа
```

### Pydantic — валидация + типы

```python
from pydantic import BaseModel, field_validator, model_validator
from pydantic import HttpUrl

class CourtSchema(BaseModel):
  code:    str
  name:    str
  region:  int
  website: HttpUrl | None = None

  @field_validator('code')
  @classmethod
  def validate_code(cls, v: str) -> str:
    import re
    if not re.match(r'^\d{2}[A-Z]{2}\d{4}$', v):
      raise ValueError(f"Неверный формат кода суда: {v}")
    return v

  @field_validator('region')
  @classmethod
  def validate_region(cls, v: int) -> int:
    if not 1 <= v <= 99:
      raise ValueError(f"Регион должен быть 1-99, получен: {v}")
    return v

# Парсинг из JSON
court = CourtSchema.model_validate_json(json_string)
court = CourtSchema.model_validate(dict_data)

# Сериализация
json_str = court.model_dump_json()
dict_data = court.model_dump()
```

### Ruff — линтер и форматтер

Ruff (написан на Rust) заменяет `flake8` + `black` + `isort`:

```toml
# pyproject.toml
[tool.ruff]
target-version = "py314"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
# UP — pyupgrade: автоматически поднимает синтаксис до target-version
```

В 10-100x быстрее flake8. Де-факто стандарт в новых проектах.

### mypy / pyright — статический анализ

```bash
# mypy — классический, широко используется
mypy --strict src/

# pyright — от Microsoft, быстрее, лучше inference
pyright src/

# basedpyright — форк pyright с более строгим режимом
basedpyright src/
```

Конфигурация в `pyproject.toml`:
```toml
[tool.mypy]
python_version = "3.14"
strict = true
warn_return_any = true
```

---

## 6. Python для AI/ML Pipeline

### Стек для LLM-интеграции

```python
# Прямые HTTP-вызовы к Ollama (без зависимостей)
import httpx  # async HTTP клиент

async def call_ollama(
  prompt: str,
  model: str = "CURRENT_OLLAMA_MODEL",
  *,
  temperature: float = 0.7,
  max_tokens: int = 2048,
) -> str:
  async with httpx.AsyncClient(timeout=120.0) as client:
    response = await client.post(
      "http://localhost:11434/api/generate",
      json={
        "model":   model,
        "prompt":  prompt,
        "stream":  False,
        "options": {
          "temperature": temperature,
          "num_predict": max_tokens,
        }
      }
    )
    response.raise_for_status()
    return response.json()["response"]
```

### Structured Output через JSON Schema

```python
from pydantic import BaseModel

class DocumentAnalysis(BaseModel):
  document_type: str
  confidence:    float
  entities:      list[str]
  summary:       str

async def analyze_document(
  text: str,
  model: str = "CURRENT_OLLAMA_MODEL_LARGE"
) -> DocumentAnalysis:
  schema = DocumentAnalysis.model_json_schema()

  prompt = f"""Проанализируй документ и верни JSON по схеме:
{json.dumps(schema, ensure_ascii=False, indent=2)}

Документ:
{text}

Ответ (только JSON):"""

  response = await call_ollama(prompt, model, temperature=0.1)

  # Извлекаем JSON из ответа
  json_match = re.search(r'\{.*\}', response, re.DOTALL)
  if not json_match:
    raise ValueError("LLM не вернул JSON")

  return DocumentAnalysis.model_validate_json(json_match.group())
```

### Pipeline паттерн для обработки данных

```python
from typing import TypeVar, Callable, Awaitable
from dataclasses import dataclass

T = TypeVar('T')

@dataclass
class PipelineResult[T]:
  data:   T
  errors: list[str] = field(default_factory=list)
  meta:   dict      = field(default_factory=dict)

type Stage[T, U] = Callable[[PipelineResult[T]], Awaitable[PipelineResult[U]]]

async def pipeline[T](
  initial: T,
  stages: list[Stage],
) -> PipelineResult:
  result = PipelineResult(data=initial)
  for stage in stages:
    try:
      result = await stage(result)
    except Exception as e:
      result.errors.append(str(e))
      break  # или continue — зависит от стратегии
  return result

# Использование
result = await pipeline(
  raw_document,
  [
    extract_text_stage,
    classify_document_stage,
    extract_entities_stage,
    generate_summary_stage,
  ]
)
```

### Батч-обработка с rate limiting

```python
import asyncio
from typing import AsyncIterator

async def process_with_rate_limit[T, R](
  items: list[T],
  processor: Callable[[T], Awaitable[R]],
  *,
  max_concurrent: int = 5,
  delay_between: float = 0.1,
) -> list[R | Exception]:
  semaphore = asyncio.Semaphore(max_concurrent)
  results = []

  async def process_one(item: T) -> R:
    async with semaphore:
      result = await processor(item)
      await asyncio.sleep(delay_between)
      return result

  return await asyncio.gather(
    *[process_one(item) for item in items],
    return_exceptions=True
  )
```

---

## 7. Управление проектом — uv

### uv — де-факто стандарт 2025+

**uv** (от Astral, авторов Ruff) написан на Rust и заменяет:
`pip` + `pip-tools` + `virtualenv` + `pyenv` + `poetry`.

Скорость: установка пакетов в **10-100x быстрее pip**.

```bash
# Установка uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Создание нового проекта
uv init my-project
cd my-project

# Управление Python версиями — без pyenv
uv python install 3.14
uv python pin 3.14  # зафиксировать в .python-version

# Виртуальное окружение
uv venv                    # создать .venv
uv venv --python 3.14      # с конкретной версией

# Зависимости
uv add httpx pydantic       # добавить в pyproject.toml
uv add --dev pytest ruff    # dev-зависимости
uv remove httpx             # удалить

# Запуск
uv run python script.py
uv run pytest
```

### pyproject.toml — современный манифест проекта

```toml
[project]
name = "doc-orchestrator"
version = "0.1.0"
requires-python = ">=3.14"
dependencies = [
  "httpx>=0.27",
  "pydantic>=2.9",
  "aiofiles>=24.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "pytest-asyncio>=0.24",
  "ruff>=0.9",
  "mypy>=1.13",
]

[tool.uv]
dev-dependencies = [
  "pytest>=8.0",
]

[tool.ruff]
target-version = "py314"

[tool.mypy]
python_version = "3.14"
strict = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### uv lock — воспроизводимые сборки

```bash
# Зафиксировать версии всех зависимостей
uv lock

# Установить точно по lockfile (CI/production)
uv sync --frozen

# Обновить зависимости
uv lock --upgrade
```

`uv.lock` — cross-platform lockfile. В отличие от `requirements.txt`
содержит хэши и поддерживает все платформы в одном файле.

---

## 8. Граничные случаи и ловушки

### Ловушка 1 — Mutable Default Arguments

```python
# ❌ Классический баг Python — список создаётся ОДИН раз
def add_item(item, collection=[]):
  collection.append(item)
  return collection

add_item(1)  # ❌ [1]
add_item(2)  # ❌ [1, 2] — неожиданно!

# ✅ Правильно — None как sentinel
def add_item(item, collection=None):
  if collection is None:
    collection = []
  collection.append(item)
  return collection
```

### Ловушка 2 — Late Binding Closures

```python
# ❌ i захватывается по ссылке, не по значению
funcs = [lambda: i for i in range(5)]
[f() for f in funcs]  # ❌ [4, 4, 4, 4, 4] — все вернут 4!

# ✅ Зафиксировать значение в default argument
funcs = [lambda i=i: i for i in range(5)]
[f() for f in funcs]  # ✅ [0, 1, 2, 3, 4]
```

### Ловушка 3 — Блокирующий код в asyncio

```python
# ❌ Блокирует Event Loop — все корутины ждут
async def process():
  data = requests.get("http://api.example.com").json()  # синхронный!

# ✅ Асинхронный HTTP
async def process():
  async with httpx.AsyncClient() as client:
    data = (await client.get("http://api.example.com")).json()
```

### Ловушка 4 — time.sleep в asyncio

```python
# ❌ time.sleep блокирует поток на N секунд
async def retry():
  for i in range(3):
    try:
      return await fetch()
    except Exception:
      time.sleep(1)  # блокирует Event Loop!

# ✅ asyncio.sleep отдаёт управление Event Loop
async def retry():
  for i in range(3):
    try:
      return await fetch()
    except Exception:
      await asyncio.sleep(1)
```

### Ловушка 5 — Pickle и multiprocessing

```python
# ❌ Lambda не сериализуется через pickle
with Pool() as p:
  results = p.map(lambda x: x**2, data)  # PicklingError!

# ✅ Только именованные функции верхнего уровня
def square(x): return x**2

with Pool() as p:
  results = p.map(square, data)
```

### Ловушка 6 — Thread safety в no-GIL Python 3.14

```python
# В Python 3.14 no-GIL это реальный race condition
counter = 0

def increment():
  global counter
  for _ in range(100_000):
    counter += 1  # НЕ атомарно без GIL!

# ✅ Явная синхронизация
import threading
lock = threading.Lock()

def increment():
  global counter
  for _ in range(100_000):
    with lock:
      counter += 1
```

---

## 9. Python и AI-кодер

### Что AI делает хорошо в Python

- Пишет Pydantic-модели по описанию структуры данных
- Генерирует asyncio-пайплайны для параллельных запросов
- Создаёт data-классы и utility-функции
- Пишет тесты с `pytest`

### Где AI систематически ошибается

**Устаревший синтаксис типов:**
```python
# ❌ AI часто генерирует старый стиль
from typing import Optional, List, Dict, Tuple
def process(items: List[Dict[str, Optional[int]]]) -> Tuple[int, ...]: ...

# ✅ Python 3.10+ встроенный синтаксис
def process(items: list[dict[str, int | None]]) -> tuple[int, ...]: ...
```

**Синхронный код там, где нужен async:**
```python
# ❌ AI использует requests в asyncio-контексте
async def fetch_all(urls):
  return [requests.get(url).json() for url in urls]  # не параллельно!

# ✅ httpx + asyncio.gather
async def fetch_all(urls):
  async with httpx.AsyncClient() as client:
    return await asyncio.gather(*[
      client.get(url) for url in urls
    ])
```

**Mutable default arguments:**
```python
# ❌ AI часто генерирует классический баг
def build_prompt(messages, history=[]):
  history.append(messages)
  return history
```

**Не использует match statement:**
```python
# ❌ AI пишет if/elif цепочки
if response["type"] == "text":
  ...
elif response["type"] == "tool_call":
  ...

# ✅ match для структурного сопоставления
match response:
  case {"type": "text", "content": str(text)}: ...
  case {"type": "tool_call", "name": str(name)}: ...
```

### Как правильно ставить задачу AI-кодеру

Плохо:
> «Напиши функцию обработки документов»

Хорошо:
> «Напиши async функцию `process_documents(paths: list[Path]) -> list[DocumentResult]`.
> Параллельная обработка через asyncio.TaskGroup с max 5 одновременных.
> Каждый документ обрабатывается через `analyze_document() -> DocumentAnalysis` (Pydantic модель).
> При ошибке одного — продолжать остальные, собирать ошибки в список.
> Python 3.14, strict mypy, ruff-совместимый код.
> Без `any` типов. Без `requests`, только `httpx`.»

---


## 10. Антипаттерны

- **`asyncio` с блокирующим кодом.** `time.sleep`, CPU-циклы, sync HTTP и тяжёлый JSON убивают event loop. Для CPU — process pool; для I/O — async clients.
- **Mutable default arguments.** Значение создаётся один раз при определении функции, а не при вызове. Sentinel `None` — стандартный безопасный паттерн.
- **Pickle для ненадёжных данных.** Это исполнение кода при десериализации. Для файлов, очередей и API — JSON, MessagePack, protobuf или явный формат.
- **Глобальное состояние в pipeline.** Глобальные кэши, RNG и connection pools усложняют тесты и воспроизводимость. Состояние должно передаваться явно.
- **No-GIL как магия для любого CPU-кода.** Параллельные потоки требуют thread-safe структур и явной синхронизации. Без замеров это не оптимизация, а риск.

## Anti-checklist ☠️

- [ ] `time.sleep` в asyncio коде — блокирует Event Loop, все корутины ждут
- [ ] Mutable default arguments (`def fn(x=[])`) — список создаётся один раз
- [ ] `requests` в async контексте — синхронный HTTP убивает параллелизм
- [ ] Pickle для ненадёжных данных — исполнение кода при десериализации
- [ ] `for x in items: await process(x)` вместо `asyncio.gather` — последовательно, медленно
- [ ] No-GIL как магия для любого CPU-кода — нужна явная синхронизация

## 11. Задачи AI-кодеру

- Переписать blocking I/O в asyncio pipeline на `httpx.AsyncClient`.
- Добавить `uv` lock, `pyproject.toml`, type checker и ruff config.
- Заменить mutable defaults и pickle на безопасные форматы.
- Добавить `asyncio.Semaphore` для ограничения параллельных LLM-вызовов.
- Проверить no-GIL режим и добавить синхронизацию там, где есть shared state.

## 12. Чеклист архитектора

### Конфигурация проекта
- [ ] Python 3.14 в `requires-python = ">=3.14"` в `pyproject.toml`
- [ ] `uv` для управления зависимостями и виртуальным окружением
- [ ] `uv.lock` в репозитории для воспроизводимых сборок
- [ ] `ruff` + `mypy --strict` в CI

### Типизация
- [ ] Современный синтаксис: `X | Y` вместо `Optional[X]`, `Union[X, Y]`
- [ ] `type` alias вместо `TypeAlias = ...`
- [ ] Новый Generic синтаксис `def fn[T](...)`
- [ ] `dataclass(frozen=True, slots=True)` для Value Objects
- [ ] Pydantic для внешних данных (API, файлы, конфиг)

### Асинхронность
- [ ] Нет `time.sleep` внутри asyncio — только `await asyncio.sleep`
- [ ] Нет синхронных HTTP-клиентов (`requests`) в async коде
- [ ] `asyncio.TaskGroup` вместо `gather` там, где нужна атомарность
- [ ] Semaphore для rate limiting внешних API
- [ ] CPU-intensive задачи через `run_in_executor` + `ProcessPoolExecutor`

### Параллелизм (Python 3.14)
- [ ] Решение про GIL задокументировано: free-threaded или standard build
- [ ] В free-threaded режиме — явные блокировки на разделяемых данных
- [ ] Sub-interpreters рассмотрены как альтернатива multiprocessing

### AI-код ревью
- [ ] Нет mutable default arguments
- [ ] Нет lambda в closures с захватом переменных цикла
- [ ] Нет синхронного кода в async-контексте
- [ ] `match` используется для структурного сопоставления
- [ ] Pickle-совместимость проверена при использовании multiprocessing

---

## Связь с проектами

| Паттерн | Где используется |
|---------|-----------------|
| asyncio + httpx | DocOrchestrator — параллельные LLM-вызовы |
| Pydantic схемы | Валидация ответов LLM в любом проекте |
| Pipeline паттерн | DocOrchestrator, Floronym |
| asyncio.TaskGroup | FloraMaverick — батч-классификация |
| t-strings (Python 3.14) | Безопасная генерация промптов |
| ProcessPoolExecutor | Тяжёлая обработка PDF/изображений |
| uv | Все Python-проекты — замена pip+venv |

---

*Модуль 04 завершён.*
*Следующий: [Модуль 05 — Go](../05-go/README.md)*
