# Модуль 07 — JSON Schema / Structured Output

> **Для AI-архитектора:** structured output — это не «попроси модель вернуть JSON».
> Это управление вероятностным пространством на уровне токенизатора.
> Один день изучения — полная иерархия надёжности от postprocessing до constrained decoding,
> проектирование схем под LLM-специфику, валидация семантики вне модели.

---

## Содержание

1. [JSON Schema — спецификация и версии](#1-json-schema--спецификация-и-версии)
2. [Иерархия надёжности Structured Output](#2-иерархия-надёжности-structured-output)
3. [Constrained Decoding — механика](#3-constrained-decoding--механика)
4. [Проектирование схем для LLM](#4-проектирование-схем-для-llm)
5. [Pydantic и инструменты схем](#5-pydantic-и-инструменты-схем)
6. [Семантическая валидация и Structural Diff](#6-семантическая-валидация-и-structural-diff)
7. [Производительность и граничные случаи](#7-производительность-и-граничные-случаи)
8. [Реальный кейс](#реальный-кейс)
9. [Антипаттерны](#антипаттерны)

---

## Актуальные версии (март 2026)

### JSON Schema спецификация

| Версия | Статус | Ключевое изменение |
| :-- | :-- | :-- |
| Draft 7 | Широко поддержан | Базовый уровень, совместим везде |
| Draft 2019-09 | Поддержан частично | `$defs` вместо `definitions`, `$vocabulary` |
| Draft 2020-12 | Поддержан частично | `prefixItems`, `unevaluatedProperties` |

> LLM API провайдеры ориентируются преимущественно на Draft 7.
> Проверяй совместимость ключевых слов с конкретным backend перед использованием.

### Инструменты и библиотеки

| Инструмент | Версия | Назначение |
| :-- | :-- | :-- |
| Pydantic | 2.x | Схемы и валидация, Python |
| zod | 3.x | Схемы и валидация, TypeScript/Node.js |
| jsonschema | 4.x | Валидация JSON Schema, Python |
| Outlines | 0.1.x | Constrained generation поверх HuggingFace / llama.cpp |
| llama.cpp | b4xxx | Grammar sampling (GBNF) |
| LM Studio | 0.3.x | OpenAI-совместимый API с `response_format` |

---

## 1. JSON Schema — спецификация и версии

### Что такое JSON Schema и зачем это архитектору

JSON Schema — словарь для описания структуры и ограничений JSON-документов.
В контексте LLM pipeline это контракт между промптом и кодом:
схема одновременно инструктирует модель о формате вывода
и служит спецификацией для валидации результата.

Три уровня применения схемы:

```
1. Документация — описывает ожидаемый формат (аннотация)
2. Валидация    — проверяет соответствие вывода (runtime check)
3. Generation constraint — физически ограничивает генерацию (constrained decoding)
```

Джун использует JSON Schema только на уровне 1 — описывает формат в тексте промпта.
Архитектор использует все три уровня: схема в промпте + валидация в коде + constrained decoding.

### Ключевые слова — архитектурный контекст

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name":    { "type": "string" },
    "address": { "type": "string" },
    "phones":  {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 0,
      "maxItems": 5
    },
    "region_code": {
      "type": "integer",
      "minimum": 1,
      "maximum": 99
    },
    "court_type": {
      "type": "string",
      "enum": ["АРБИТРАЖНЫЙ", "РАЙОННЫЙ", "МИРОВОЙ", "АПЕЛЛЯЦИОННЫЙ", "КАССАЦИОННЫЙ"]
    },
    "website": { "type": ["string", "null"] }
  },
  "required": ["name", "address", "region_code", "court_type", "website"],
  "additionalProperties": false
}
```

Разбор архитектурных решений:
- `phones: array` вместо `string` — семантически верно, у суда несколько номеров
- `court_type: enum` — grammar тривиальна, значение гарантировано
- `website: ["string", "null"]` + в `required` — всегда присутствует, явный null если не найдено
- `additionalProperties: false` — никаких лишних полей, обязательно для `strict` mode

### Версии спецификации — практические отличия

```json
// Draft 7 — definitions (старый синтаксис, совместим везде)
{
  "definitions": {
    "Address": { "type": "object" }
  },
  "$ref": "#/definitions/Address"
}

// Draft 2019-09+ — $defs (актуальный синтаксис)
{
  "$defs": {
    "Address": { "type": "object" }
  },
  "$ref": "#/$defs/Address"
}
```

**Практический вывод для архитектора:** `model.model_json_schema()` в Pydantic V2 генерирует
Draft 2020-12 с `$defs`. LLM API ожидает Draft 7 с `definitions`.
Между этими форматами нужна явная трансляция — без неё `strict: true` может вернуть ошибку.

### Граничные случаи — где ломается

```python
# Рекурсивные схемы — не поддерживаются в constrained decoding
class TreeNode(BaseModel):
    value: str
    children: list["TreeNode"] = []  # рекурсия через $ref
# При компиляции в GBNF → бесконечный автомат → ошибка или зависание

# ✅ Решение: сплющить структуру, ограничить глубину
class TreeNodeFlat(BaseModel):
    id: str
    value: str
    parent_id: str | None = None

class FlatTree(BaseModel):
    nodes: list[TreeNodeFlat]
```

**Почему это важно архитектору:** рекурсивные схемы — частый паттерн в Python коде,
но они некомпилируемы в grammar. Constrained decoding требует конечного автомата.

---

## 2. Иерархия надёжности Structured Output

### Четыре уровня — принципиально разные гарантии

```
Уровень 1: Postprocessing с retry
  Промпт: «Верни JSON с полями name и address»
  Гарантия: никакой. Модель может вернуть markdown, prose, невалидный JSON.
  Применение: прототипирование, одноразовые скрипты.

Уровень 2: JSON Mode
  API: response_format: {type: "json_object"}
  Гарантия: валидный JSON любой структуры.
  Применение: когда схема неизвестна заранее или слишком динамична.

Уровень 3: JSON Schema Mode
  API: response_format: {type: "json_schema", json_schema: {...}}
  Гарантия: соответствие схеме ~95-99%. Может нарушить на сложных схемах.
  Применение: production сценарии с простыми схемами.

Уровень 4: Constrained Decoding (strict mode)
  API: json_schema + strict: true / GBNF grammar
  Гарантия: структурная валидность 100%.
  Применение: extraction pipeline, любой production с чёткой схемой.
```

### Postprocessing с retry — почему не работает в production

```python
# ❌ Антипаттерн — retry без детерминизма
async def extract_with_retry(text: str, max_retries: int = 3) -> dict:
    for attempt in range(max_retries):
        raw = await llm_call(f"Extract JSON: {text}")
        try:
            clean = raw.strip().removeprefix("```json").removesuffix("```").strip()
            data = json.loads(clean)
            assert "name" in data and "address" in data
            return data
        except (json.JSONDecodeError, AssertionError):
            if attempt == max_retries - 1:
                raise
            # Следующая попытка не обязана быть лучше
            continue
# При 5000 объектах даже 0.5% failure rate = 25 ручных доисправлений
```

```python
# ✅ Правильно — constrained decoding без retry
from pydantic import BaseModel
from typing import Optional, Literal

class CourtRecord(BaseModel):
    name: str
    addresses: list[str]
    phones: list[str]
    region_code: int
    court_type: Literal["АРБИТРАЖНЫЙ", "РАЙОННЫЙ", "МИРОВОЙ", "АПЕЛЛЯЦИОННЫЙ", "КАССАЦИОННЫЙ", "НЕИЗВЕСТНО"]
    website: Optional[str] = None

response = client.beta.chat.completions.parse(
    model=MODEL,
    messages=messages,
    response_format=CourtRecord,
)
record: CourtRecord = response.choices[0].message.parsed
# json.JSONDecodeError физически невозможен
```

**Практический вывод для архитектора:** если в коде есть `json.loads()` с `try/except`
на пути обработки LLM-вывода в production — это сигнал к переходу на constrained decoding.

---

## 3. Constrained Decoding — механика

### Как grammar sampling работает внутри

На каждом шаге генерации, после вычисления логитов и перед sampling,
применяется маска допустимых токенов:

```
logits [vocab_size] = transformer_forward(context)
                               ↓
допустимые_токены = grammar_automaton.get_allowed(current_state)
                               ↓
маска: logits[недопустимый_токен] = -inf
                               ↓
softmax → вероятности только допустимых токенов
                               ↓
sampling → следующий токен (гарантированно допустимый)
                               ↓
grammar_automaton.advance(выбранный_токен) → новое состояние
```

Конечный автомат строится из JSON Schema или GBNF грамматики один раз — при компиляции.
Overhead на каждый шаг генерации минимален: проверка состояния + битовая маска на vocab.

### LM Studio / OpenAI-совместимый API

```python
import json
from pydantic import BaseModel

schema = CourtRecord.model_json_schema()

response = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "court_record",
            "strict": True,
            "schema": schema
        }
    },
    max_tokens=512,
)

raw_json = response.choices[0].message.content
record = CourtRecord.model_validate_json(raw_json)
```

```python
# Через openai SDK beta.parse — автоматическая валидация
response = client.beta.chat.completions.parse(
    model=MODEL,
    messages=messages,
    response_format=CourtRecord,  # Pydantic модель напрямую
)
record: CourtRecord = response.choices[0].message.parsed
```

**Практический вывод для архитектора:** `strict: True` в запросе и
`additionalProperties: false` + все поля в `required` в схеме — единый комплект.
Одно без другого работает хуже или не работает вовсе.

### Граничные случаи — где ломается

```python
# Случай 1: union типы с большим количеством вариантов
class Record(BaseModel):
    doc_type: Union[TypeA, TypeB, TypeC, TypeD, TypeE]  # anyOf с 5 объектами
    # → grammar automaton становится большим, overhead заметен

# ✅ Решение: discriminator field
class Record(BaseModel):
    doc_type: Literal["A", "B", "C", "D", "E"]  # enum вместо union объектов
    data: dict  # остальное валидируется после определения типа

# Случай 2: enum с длинными строками (85 регионов)
class Region(BaseModel):
    name: Literal["Республика Адыгея", "Республика Алтай", ...]  # 85 вариантов
    # Grammar с 85 строковыми альтернативами компилируется долго

# ✅ Решение: integer код + lookup table в коде
class Region(BaseModel):
    code: int  # 1-99, lookup в REGION_NAMES[code]
```

**Почему это важно архитектору:** сложность grammar прямо влияет на TTFT.
Измеряй время компиляции grammar отдельно от времени инференса.

---

## 4. Проектирование схем для LLM

### Схема для extraction ≠ схема для хранения

При extraction модель обязана заполнить все `required` поля — даже если данных нет.
Это меняет архитектурные решения по сравнению со схемой для БД:

```python
# ❌ Схема «как в базе данных»
class CourtDB(BaseModel):
    id: int           # нет в исходных данных — модель галлюцинирует
    name: str
    phone: str        # обязательный — модель придумает если нет
    created_at: datetime  # нет в исходных данных

# ✅ Схема для LLM extraction
class CourtExtraction(BaseModel):
    name: str                         # есть всегда
    addresses: list[str]              # массив, может быть пустым
    phones: list[str]                 # может не быть
    region_code: int
    court_type: Literal[...]
    website: Optional[str] = None     # явный null если нет

class CourtDB(CourtExtraction):       # расширяет extraction для хранения
    id: int
    created_at: datetime
    source_url: str
```

### Массив vs строка с разделителем

```python
# ❌ Строка с разделителем — потеря семантики
class CourtWrong(BaseModel):
    phones: str  # "8-800-100-3456; +7(495)987-65-43"
    # Модель может: поменять разделитель, пропустить пробелы,
    # в разных прогонах использовать ";" vs "\n" vs ", "

# ✅ Массив — явная семантика, предсказуемый формат
class CourtRight(BaseModel):
    phones: list[str]     # ["8-800-100-3456", "+7(495)987-65-43"]
    addresses: list[str]  # каждый адрес — отдельный элемент
```

### Enum vs string

```python
# ❌ String с описанием в промпте
class DocType(BaseModel):
    doc_type: str  # «Возможные значения: РЕШЕНИЕ, ОПРЕДЕЛЕНИЕ...»
    # Модель может написать «Решение», «решение суда», «DECISION»

# ✅ Literal — grammar тривиальна, значение гарантировано
class DocType(BaseModel):
    doc_type: Literal["РЕШЕНИЕ", "ОПРЕДЕЛЕНИЕ", "ПОСТАНОВЛЕНИЕ", "НЕИЗВЕСТНО"]
    # «НЕИЗВЕСТНО» лучше null — явно сигнализирует что поле обработано
```

### Вложенность vs плоская структура

| Аспект | Вложенная | Плоская |
| :-- | :-- | :-- |
| Grammar размер | Больше | Меньше |
| Токены на генерацию | Больше | Меньше |
| Читаемость схемы | Высокая | Средняя |
| Переиспользование | Легко через `$ref` | Сложно |
| Применение | До 3 уровней вложенности | Batch extraction |

**Практический вывод для архитектора:** для batch extraction на локальных моделях
плоская схема предпочтительнее — меньше токенов на JSON overhead (скобки, ключи),
меньший automaton, выше TPS.

---

## 5. Pydantic и инструменты схем

### Pydantic V2 — генерация и адаптация схем

```python
from pydantic import BaseModel, Field
from typing import Optional, Literal
import json

class CourtRecord(BaseModel):
    name: str = Field(description="Полное официальное название суда")
    addresses: list[str] = Field(default_factory=list, max_length=3)
    phones: list[str] = Field(default_factory=list, max_length=5)
    region_code: int = Field(ge=1, le=99)
    court_type: Literal["АРБИТРАЖНЫЙ", "РАЙОННЫЙ", "МИРОВОЙ", "АПЕЛЛЯЦИОННЫЙ", "КАССАЦИОННЫЙ", "НЕИЗВЕСТНО"]
    website: Optional[str] = None

# model_json_schema() → Draft 2020-12 с $defs
# Для LLM API нужна адаптация под Draft 7:
def to_api_schema(model: type[BaseModel]) -> dict:
    schema = model.model_json_schema()
    schema_str = json.dumps(schema)
    # $defs → definitions, пути $ref
    schema_str = schema_str.replace('#/$defs/', '#/definitions/')
    adapted = json.loads(schema_str)
    if "$defs" in adapted:
        adapted["definitions"] = adapted.pop("$defs")
    return adapted
```

```python
# Три способа валидации вывода модели
from pydantic import ValidationError

# 1. model_validate_json — из строки, строгая валидация
try:
    record = CourtRecord.model_validate_json(llm_output)
except ValidationError as e:
    for error in e.errors():
        print(f"Поле: {error['loc']}, Ошибка: {error['msg']}")

# 2. model_validate — из dict
data = json.loads(llm_output)
record = CourtRecord.model_validate(data)

# 3. openai SDK parse — при constrained decoding, уже типизирован
record: CourtRecord = response.choices[0].message.parsed
```

### zod — Node.js / TypeScript

```typescript
import { z } from "zod";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

const CourtRecord = z.object({
  name: z.string(),
  addresses: z.array(z.string()).max(3),
  phones: z.array(z.string()).max(5),
  region_code: z.number().int().min(1).max(99),
  court_type: z.enum(["АРБИТРАЖНЫЙ", "РАЙОННЫЙ", "МИРОВОЙ", "АПЕЛЛЯЦИОННЫЙ", "КАССАЦИОННЫЙ", "НЕИЗВЕСТНО"]),
  website: z.string().nullable(),
});

type CourtRecord = z.infer<typeof CourtRecord>;

const response = await client.beta.chat.completions.parse({
  model: MODEL,
  messages,
  response_format: zodResponseFormat(CourtRecord, "court_record"),
});

const record: CourtRecord = response.choices[0].message.parsed!;
```

**Практический вывод для архитектора:** Pydantic и zod — не просто удобный синтаксис.
Это валидационный слой с детальными сообщениями об ошибках и автогенерацией JSON Schema.
Не дублируй схему руками в JSON.

---

## 6. Семантическая валидация и Structural Diff

### Структурная vs семантическая валидность

Constrained decoding гарантирует структуру. Семантика — в коде:

```python
# Структурно валидно, семантически неверно:
record = CourtRecord(
    name="Арбитражный суд Пермского края",
    addresses=["г. Пермь, ул. Луначарского, 37; г. Пермь, ул. Пушкина, 22"],  # склейка
    phones=["8-800"],  # неполный номер
    region_code=59,
    court_type="АРБИТРАЖНЫЙ",
    website=None
)
# Pydantic validation → OK. Бизнес-правила → нарушены.
```

```python
from dataclasses import dataclass
import re

@dataclass
class ValidationResult:
    is_valid: bool
    errors: list[str]

def validate_court_record(record: CourtRecord) -> ValidationResult:
    errors = []

    # Детектор склейки адресов
    for addr in record.addresses:
        if any(sep in addr for sep in [";", " / "]):
            errors.append(f"Возможная склейка адресов: {addr!r}")

    # Валидация телефонов
    phone_pattern = re.compile(r"^[\d\s\-\+\(\)]{7,20}$")
    for phone in record.phones:
        if not phone_pattern.match(phone):
            errors.append(f"Подозрительный формат: {phone!r}")

    # Валидация кода региона
    if record.region_code not in VALID_REGION_CODES:
        errors.append(f"Неизвестный код региона: {record.region_code}")

    return ValidationResult(is_valid=len(errors) == 0, errors=errors)
```

### Structural Diff — инструмент качества pipeline

```python
from deepdiff import DeepDiff
from dataclasses import dataclass, field
from collections import Counter

@dataclass
class DiffReport:
    total: int
    changed: int
    changed_pct: float
    by_field: dict[str, int]
    examples: list[dict]

def structural_diff(
    baseline: list[dict],
    candidate: list[dict],
    sample_size: int = 10,
) -> DiffReport:
    changed_records = []
    field_counts: Counter = Counter()

    for i, (base, cand) in enumerate(zip(baseline, candidate)):
        diff = DeepDiff(base, cand, ignore_order=True)
        if diff:
            changed_records.append({"index": i, "diff": diff})
            for change_type, changes in diff.items():
                for path in changes:
                    field = str(path).split("[")[1].split("]")[0].strip('\'"')
                    field_counts[field] += 1

    return DiffReport(
        total=len(baseline),
        changed=len(changed_records),
        changed_pct=len(changed_records) / len(baseline) * 100,
        by_field=dict(field_counts),
        examples=changed_records[:sample_size],
    )

# Пример: DiffReport(total=5000, changed=187, changed_pct=3.74,
#          by_field={"addresses": 142, "phones": 31, "website": 14})
# → 28% расхождений в addresses → ручной анализ → склейка адресов
```

**Практический вывод для архитектора:** structural diff — инструмент обнаружения
изменений поведения между конфигурациями. Допустимый уровень расхождений —
бизнесовое решение, не техническое.

---

## 7. Производительность и граничные случаи

### Batch processing — один объект на запрос

```python
# ❌ Все объекты в одном промпте — потеря контекста при > 10-20 объектов
async def process_batch_naive(items: list[str]) -> list[CourtRecord]:
    batch_prompt = "\n\n---\n\n".join(items)
    response = await llm(f"Извлеки данные из всех объектов:\n{batch_prompt}")
    # Модель начинает путать объекты, пропускать поля, смешивать данные

# ✅ Один объект = один запрос + параллелизм через семафор
async def process_all(items: list[str], concurrency: int = 10) -> list[CourtRecord]:
    semaphore = asyncio.Semaphore(concurrency)

    async def process_one(item: str) -> CourtRecord:
        async with semaphore:
            response = await client.beta.chat.completions.parse(
                model=MODEL,
                messages=build_messages(item),
                response_format=CourtRecord,
                max_tokens=512,
            )
            return response.choices[0].message.parsed

    return await asyncio.gather(*[process_one(item) for item in items])
```

### Мониторинг воронки валидации

```python
from dataclasses import dataclass, field
from collections import Counter

@dataclass
class ExtractionMetrics:
    total: int = 0
    json_valid: int = 0       # прошли JSON parse
    schema_valid: int = 0     # прошли Pydantic
    semantic_valid: int = 0   # прошли бизнес-правила
    field_errors: Counter = field(default_factory=Counter)
    total_output_tokens: int = 0
    total_thinking_tokens: int = 0

    @property
    def clean_rate(self) -> float:
        return self.semantic_valid / self.total if self.total else 0.0

    def report(self) -> str:
        return (
            f"Total: {self.total} | "
            f"JSON: {self.json_valid} | Schema: {self.schema_valid} | "
            f"Semantic: {self.semantic_valid} ({self.clean_rate:.1%}) | "
            f"Top errors: {self.field_errors.most_common(3)}"
        )

# success_rate = 99.8% скрывает semantic_rate = 94.2%
# Отслеживай все три уровня воронки
```

**Почему это важно архитектору:** одна метрика `success_rate` не даёт полной картины.
Constrained decoding поднимает `json_valid` до 100% — это маскирует семантические проблемы,
если не измерять их отдельно.

---

## Реальный кейс

**Задача:** структурированное извлечение данных из ~5000 карточек судебных органов РФ.
Каждая карточка — HTML-stripped текст. Формат непредсказуем:
от чистого структурированного до «адрес написан в поле телефона».

**Первая итерация схемы:**

```python
# ❌ Схема с одиночными строками
class CourtV1(BaseModel):
    name: str
    address: str   # одна строка
    phone: str     # один телефон
    region_code: int
```

Structural diff после прогона 500 объектов:
142 записи (28.4%) имели расхождения в `address` между двумя прогонами.
Ручной анализ 10 примеров — Чусовской городской суд Пермского края:
основное здание и здание по гражданским делам разделены.
Модель склеивала: `"ул. Ленина, 1; ул. Советская, 45"` vs `"ул. Ленина, 1\nул. Советская, 45"`.

**Гипотеза:** массив `addresses: list[str]` устранит недетерминизм.

**Вторая итерация:**

```python
# ✅ Массив адресов — правильная семантика
class CourtV2(BaseModel):
    name: str
    addresses: list[str] = Field(max_length=3)
    phones: list[str] = Field(default_factory=list, max_length=5)
    region_code: int
    court_type: Literal["АРБИТРАЖНЫЙ", "РАЙОННЫЙ", "МИРОВОЙ", "АПЕЛЛЯЦИОННЫЙ", "КАССАЦИОННЫЙ", "НЕИЗВЕСТНО"]
    website: Optional[str] = None
```

Structural diff на той же выборке 500 объектов:
- Расхождения в address/addresses: 142 → 8 (−94%)
- Оставшиеся 8: суды сменившие адрес в период обновления данных

**Влияние thinking на качество CourtV2:**

Прогон с `thinking=True` vs `thinking=False` на 500 объектах:
- Расхождений: 31 (6.2%) — преимущественно `phones` и `region_code`
- Speedup от отключения thinking: 41%

Решение: thinking остался включён для production прогона.
Батч одноразовый — точность важнее скорости.

**Вывод, противоречащий интуиции:**
Правильная схема (массив вместо строки) дала −94% расхождений
без каких-либо изменений в промпте или параметрах модели.
Семантика схемы влияет на качество extraction сильнее, чем качество инструкций.

---

## Антипаттерны

### Дублирование схемы в промпте при constrained decoding

```python
# ❌ Описание формата словами + схема одновременно
SYSTEM = """
Верни JSON с полями: name (строка), address (строка), phones (массив)...
court_type: одно из АРБИТРАЖНЫЙ, РАЙОННЫЙ, МИРОВОЙ...
"""
# + response_format с той же схемой

# Промпт тратит токены на описание формата, который уже гарантирован схемой.
# Может создавать конфликт инструкций если описание расходится со схемой.

# ✅ Промпт описывает ЗАДАЧУ, не формат
SYSTEM = """
Извлеки данные суда из текста.
Если поле не найдено — null. Несколько значений — все в массив.
"""
```

### Одна схема для extraction и для хранения

```python
# ❌ Одна модель — модель обязана генерировать служебные поля
class Court(BaseModel):
    id: int              # LLM галлюцинирует id
    name: str
    created_at: datetime # LLM галлюцинирует дату

# ✅ Разделение ответственности
class CourtExtraction(BaseModel):  # только extractable поля
    name: str
    addresses: list[str]
    ...

class CourtDB(CourtExtraction):    # расширение для хранения
    id: int
    created_at: datetime
```

### Считать structured output = отсутствие ошибок

```python
# ❌ Одна метрика скрывает реальную картину
success_rate = success / total  # 99.8% — выглядит отлично

# Реальная воронка:
# json_valid:     5000/5000 (100%)  ← constrained decoding
# schema_valid:   4990/5000 (99.8%) ← pydantic
# semantic_valid: 4712/5000 (94.2%) ← бизнес-правила

# ✅ Отслеживай все три уровня воронки
```

### Валидационная выборка из «чистых» объектов

```python
# ❌ Первые 100 — хорошо отформатированные крупные суды
validation_set = courts[:100]

# ✅ Репрезентативная выборка с намеренными граничными кейсами
def build_validation_set(all_courts: list) -> list:
    return [
        *random.sample(all_courts, 50),
        *[c for c in all_courts if len(c.raw_addresses) > 1][:20],  # несколько адресов
        *[c for c in all_courts if not c.has_website][:15],          # без сайта
        *[c for c in all_courts if c.is_rural][:15],                 # малые суды
    ]
```

---

## Задачи AI-кодеру

### Extraction pipeline

Плохая формулировка:
> «Напиши скрипт для извлечения данных судов из текста»

Хорошая формулировка:
> «Реализуй async Python функцию `extract_court(text: str, client: AsyncOpenAI) -> CourtRecord`.
> Pydantic V2 модель `CourtRecord`: `name: str`, `addresses: list[str]` (max 3),
> `phones: list[str]` (max 5), `region_code: int` (1-99),
> `court_type: Literal["АРБИТРАЖНЫЙ","РАЙОННЫЙ","МИРОВОЙ","АПЕЛЛЯЦИОННЫЙ","КАССАЦИОННЫЙ","НЕИЗВЕСТНО"]`,
> `website: Optional[str]`.
> Constrained decoding через `client.beta.chat.completions.parse` с `response_format=CourtRecord`.
> Бросает `ValidationError` при невалидном выводе. Без retry — вынести выше по стеку.
> Python 3.12, openai>=1.50, pydantic>=2.0.»

**Формула:** **входной тип** + **выходная схема полностью** + **метод constrained decoding** +
**поведение при ошибке** + **что НЕ входит в скоуп** + **зависимости и версии**

---

### Адаптация Pydantic V2 схемы для LLM API

Плохая формулировка:
> «Как получить JSON Schema из Pydantic модели?»

Хорошая формулировка:
> «Напиши функцию `to_api_schema(model: type[BaseModel]) -> dict`.
> Принимает Pydantic V2 модель, возвращает dict для `response_format.json_schema.schema`.
> Трансформации: `$defs` → `definitions`, пути `#/$defs/` → `#/definitions/`,
> добавить `"additionalProperties": false` ко всем объектным субсхемам рекурсивно.
> Бросает `ValueError` если схема содержит рекурсивные `$ref`.
> Unit-тесты: простая схема, nested объект, Optional поля, схема с $defs.»

---

### Structural Diff CLI утилита

Плохая формулировка:
> «Сравни два JSON файла»

Хорошая формулировка:
> «CLI утилита `diff_extractions.py`.
> Принимает два JSON Lines файла одинаковой длины (один объект на строку).
> Вычисляет DeepDiff для каждой пары. Вывод: количество изменённых записей,
> breakdown по полям (поле → count), первые N примеров расхождений.
> Аргументы: `baseline.jsonl candidate.jsonl [--sample N] [--field FIELD]`.
> `--field` фильтрует вывод по конкретному полю.
> Python 3.12, только stdlib + deepdiff>=6.0. Без pandas.»

---

## Чеклист архитектора

### Проектирование схемы
- [ ] Массивы вместо строк с разделителями для полей с множественными значениями
- [ ] `Optional[T] = None` для реально опциональных полей, с явным null
- [ ] `Literal[...]` для полей с конечным множеством значений
- [ ] `additionalProperties: false` на всех объектных типах
- [ ] `max_length` / `maxItems` на массивах
- [ ] Отдельные схемы для extraction и для хранения
- [ ] Нет рекурсивных `$ref` — проверено до компиляции grammar

### Constrained Decoding
- [ ] `strict: True` + все поля в `required` + `additionalProperties: false` — комплект
- [ ] Pydantic V2 схема адаптирована для API: нет `$defs`, Draft 7 формат
- [ ] Grammar скомпилирована без ошибок на самой сложной схеме
- [ ] `anyOf` с > 5 вариантами имеет discriminator поле

### Валидация
- [ ] Структурная: Pydantic / zod — автоматически при parse
- [ ] Семантическая: детерминированный код с бизнес-правилами
- [ ] Воронка: json_valid → schema_valid → semantic_valid — три отдельные метрики
- [ ] Structural diff между baseline и candidate перед сменой параметров

### Качество и тестирование
- [ ] Валидационная выборка содержит граничные кейсы
- [ ] A/B тест thinking on/off на валидационной выборке перед отключением
- [ ] Один объект = один запрос
- [ ] `max_tokens` установлен явно с запасом от типичного размера вывода

---

*Модуль 07 завершён.*
*Следующий: [Модуль 08 — Local Inference (LM Studio / Ollama)](../08-local-inference/README.md)*