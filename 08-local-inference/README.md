# Модуль 08 — Local Inference (LM Studio / Ollama)

> **Для AI-архитектора:** локальный инференс — это не «запустить модель на ноутбуке».
> Это управление hardware-ограничениями, chat template механикой и детерминизмом поведения.
> Один день изучения — полный стек от расчёта VRAM до production-конфигурации,
> управление reasoning, structured output на локальных моделях.

---

## Содержание

1. [VRAM Budget — расчёт и выбор квантизации](#1-vram-budget--расчёт-и-выбор-квантизации)
2. [Chat Template — механика](#2-chat-template--механика)
3. [LM Studio — архитектура и конфигурация](#3-lm-studio--архитектура-и-конфигурация)
4. [Ollama — архитектура и Modelfile](#4-ollama--архитектура-и-modelfile)
5. [Управление Reasoning / Thinking](#5-управление-reasoning--thinking)
6. [Structured Output на локальных моделях](#6-structured-output-на-локальных-моделях)
7. [Производительность — измерение и тюнинг](#7-производительность--измерение-и-тюнинг)
8. [Реальный кейс](#реальный-кейс)
9. [Антипаттерны](#антипаттерны)

---

## Актуальные версии (март 2026)

| Инструмент | Версия | Примечание |
| :-- | :-- | :-- |
| LM Studio | 0.4.8 | GUI + headless `llmster` daemon + OpenAI/Anthropic API |
| Ollama | 0.19 | CLI + REST API, headless |
| llama.cpp | b8xxx (rolling) | Фиксируй build hash в production |
| llama-cpp-python | 0.3.19 | Python bindings, март 2026 |
| Outlines | 0.2.x | Structured generation, март 2026 |

> Версии llama.cpp обновляются несколько раз в неделю.
> Фиксируй конкретный build hash в production конфигурации.

### Qwen3.5 Small Series (март 2026) — рекомендуемые для локального запуска

| Модель | VRAM Q4_K_M | Контекст | Примечание |
| :-- | :-- | :-- | :-- |
| Qwen3.5-0.8B | ~1 ГБ | 256K | Edge/mobile |
| Qwen3.5-2B | ~2 ГБ | 256K | Минимальная production |
| Qwen3.5-4B | ~3.5 ГБ | 256K | Оптимальное качество/VRAM |
| Qwen3.5-9B | ~6 ГБ | 256K | Максимум для GTX 1660 6 ГБ |

> Apache 2.0. Поддержка thinking/no_think. GGUF через LM Studio / llama.cpp.
> **Ollama не поддерживает Qwen3.5 GGUF** (март 2026) — отдельные mmproj vision files.

---

## 1. VRAM Budget — расчёт и выбор квантизации

### Формула VRAM

Перед выбором модели и квантизации — считай VRAM. Не угадывай:

```

VRAM_total = model_weights + kv_cache + runtime_overhead

model_weights = (params_B × bits_per_weight / 8) × 1.05   \# +5% служебные структуры

kv_cache = 2 × n_layers × n_kv_heads × head_dim × n_ctx × bytes_per_element
\# × 2 — K и V матрицы
\# bytes_per_element: fp16 = 2, q8 = 1, q4 = 0.5

runtime_overhead ≈ 300–500 МБ  \# CUDA контекст, активации

```

Практические числа для GTX 1660 (6 Гб VRAM):

| Модель | Квантизация | Веса | KV 4K | KV 8K | Итого 4K | Итого 8K |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 7B | Q4_K_M | 3.8 Гб | 0.5 Гб | 1.0 Гб | 4.7 Гб ✅ | 5.2 Гб ✅ |
| 7B | Q8_0 | 7.2 Гб | 0.5 Гб | 1.0 Гб | 8.1 Гб ❌ | — |
| 14B | Q4_K_M | 7.6 Гб | 0.8 Гб | 1.5 Гб | 8.8 Гб ❌ | — |
| 14B | Q3_K_M | 5.6 Гб | 0.8 Гб | 1.5 Гб | 6.8 Гб ❌ | — |
| 3B | Q8_0 | 3.1 Гб | 0.2 Гб | 0.4 Гб | 3.7 Гб ✅ | 3.9 Гб ✅ |

Вывод: на GTX 1660 6 Гб — Q4_K_M 7B или Q8_0 3B.
14B в любой квантизации — частичный CPU offload с деградацией TPS.

### Выбор квантизации — trade-offs

```

Q8_0   → минимальная потеря качества, максимальный размер
PPL деградация < 0.1% от fp16
Применение: когда VRAM позволяет, качество критично

Q4_K_M → оптимальный баланс (K-quant, mixed precision)
PPL деградация ~1-3% от fp16
Критичные слои (attention, первый/последний) — в более высокой точности
Применение: основной выбор для production на consumer GPU

Q3_K_M → заметная деградация, ~5-8% PPL
Применение: когда 14B в Q4 не помещается, нужен размер модели

Q2_K   → значительная деградация, структурные артефакты
Применение: только для экспериментов

```

**Практический вывод для архитектора:** Q4_K_M 7B vs Q8_0 3B — не очевидный выбор.
На задачах extraction с constrained decoding Q4_K_M 7B обычно лучше:
больший параметрический объём компенсирует квантизационную деградацию.
Проверяй на своей задаче, не на PPL бенчмарке.

### Граничные случаи — где ломается расчёт

```python
# Случай 1: GQA (Grouped Query Attention) — n_kv_heads < n_heads
# Llama 3.x, Qwen 2.x используют GQA:
# n_heads = 32, n_kv_heads = 8 → KV-cache в 4x меньше
# Стандартная формула завышает KV-cache для GQA моделей

# Случай 2: context length vs training length
# Модель обучена на 8K контексте, ты ставишь n_ctx=32K
# RoPE scaling частично компенсирует, но качество на хвосте контекста деградирует
# VRAM растёт линейно, качество — нет

# Случай 3: мульти-GPU split (llama.cpp tensor parallel)
# Поддерживается, но overhead коммуникации между GPU снижает TPS
# Для 2× consumer GPU: сумма VRAM минус ~20% overhead
```

**Почему это важно архитектору:** неправильный расчёт VRAM — либо OOM при загрузке,
либо CPU fallback который ты не заметил, потому что модель «загрузилась».

---

## 2. Chat Template — механика

### Что такое chat template и где он живёт

Chat template — Jinja2 шаблон в `tokenizer_config.json` модели.
Определяет как сообщения ролей (`system`, `user`, `assistant`) преобразуются
в последовательность токенов для модели:

```python
# Пример: Qwen3.5 chat template (упрощённо)
# <|im_start|>system\nSYSTEM_PROMPT<|im_end|>\n
# <|im_start|>user\nUSER_MESSAGE<|im_end|>\n
# <|im_start|>assistant\n

# Llama 3.x использует другой формат:
# <|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nSYSTEM<|eot_id|>
# <|start_header_id|>user<|end_header_id|>\n\nUSER<|eot_id|>
# <|start_header_id|>assistant<|end_header_id|>\n\n

# Mistral v0.x:
# [INST] USER_MESSAGE [/INST] ASSISTANT_RESPONSE</s>
# Без system роли — system встраивается в первый user message
```

Неправильный chat template = деградация качества без каких-либо ошибок.
Модель просто получает токены в неожиданном порядке и отвечает хуже.

### Chat template в LM Studio и Ollama

```
LM Studio 0.4.x:
  - Читает chat template из GGUF метаданных
  - Применяет автоматически при использовании /v1/chat/completions
  - GUI: Settings → Chat → показывает применяемый шаблон
  - Overriding: через chat_template_kwargs (extension параметр, не стандарт)

Ollama:
  - Читает chat template из GGUF метаданных
  - Modelfile TEMPLATE переопределяет встроенный шаблон
  - Не применяет шаблон при использовании /api/generate (raw mode)
  - Применяет шаблон при /api/chat и /v1/chat/completions

llama-server (прямой запуск):
  - --chat-template <name> — выбор из встроенных шаблонов
  - --chat-template-file <path> — кастомный jinja2 файл
  - Логирование применённого шаблона: --verbose
```


### Диагностика проблем с chat template

```python
# Проверка применяемого шаблона через tokenizer
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3.5-9B")

messages = [
    {"role": "system", "content": "Ты экстрактор данных."},
    {"role": "user", "content": "Извлеки данные суда: ..."},
]

# Посмотреть что реально отправляется в модель
formatted = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)
print(repr(formatted))
# '<|im_start|>system\nТы экстрактор данных.<|im_end|>\n
#  <|im_start|>user\nИзвлеки данные суда: ...<|im_end|>\n
#  <|im_start|>assistant\n'

# Сравни с тем что отправляет LM Studio/Ollama через --verbose
# Расхождение → неправильный шаблон в backend
```

**Практический вывод для архитектора:** если модель плохо следует инструкциям —
сначала проверь chat template, не промпт. Неправильный шаблон даёт симптомы,
которые выглядят как «плохой промпт» или «слабая модель».

### Граничные случаи — где ломается

```python
# BOS токен задваивается — частая проблема при ручном форматировании
# llama.cpp добавляет BOS автоматически к любому промпту
# Если ты добавил <|begin_of_text|> вручную + backend добавляет ещё один →
# модель получает [BOS][BOS]... → деградация, особенно заметна на первом токене ответа

# ✅ Никогда не добавляй BOS/EOS вручную при использовании /v1/chat/completions
# Это делает backend. Добавляй только при прямом /v1/completions (raw prompt mode)

# System role не поддерживается моделью
# Mistral v0.x — нет системной роли в шаблоне
# Backend молча игнорирует или встраивает в user message без уведомления
# ✅ Проверяй через tokenizer.apply_chat_template что происходит с system message
```

**Почему это важно архитектору:** задвоенный BOS или проигнорированный system —
молчаливые ошибки без исключений. Обнаруживаются только через ухудшение качества.

---

## 3. LM Studio — архитектура и конфигурация

### Архитектурный стек (0.4.x)

LM Studio 0.4.x — серьёзная смена архитектуры относительно 0.3.x.
Главное изменение: появился `llmster` — headless daemon без GUI.

```
LM Studio 0.4.x
├── GUI (Electron) — опциональный, не нужен для server-side
├── llmster (headless daemon)
│   └── curl -fsSL https://lmstudio.ai/install.sh | bash
├── lms CLI
│   ├── lms load <model> --context-length 8192 --gpu max --parallel 3
│   ├── lms unload <model>
│   ├── lms ps
│   ├── lms server start --port 1234
│   ├── lms runtime survey          # информация о GPU
│   ├── lms chat                    # интерактивный чат в терминале
│   └── lms log stream -s runtime   # live логи inference
├── HTTP API
│   ├── /v1/chat/completions        # OpenAI-compatible
│   ├── /v1/responses               # OpenAI Responses API (0.4.x)
│   ├── /v1/messages                # Anthropic Claude API (0.4.x)
│   ├── /api/v1/models
│   ├── /api/v1/models/load
│   └── /api/v1/models/unload
└── llama.cpp backend
```


### reasoning_effort в 0.4.x — стандартный параметр

Критичное изменение для AI/ML pipeline: `reasoning_effort` и `reasoning_tokens`
теперь являются нативными параметрами `/v1/chat/completions` в LM Studio 0.4.x,
а не extension через `extra_body`:

```python
# LM Studio 0.4.x — reasoning_effort стандартный параметр
response = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    extra_body={
        "reasoning_effort": "none",   # "none" | "low" | "medium" | "high"
    },
)

# Верификация через usage — reasoning_tokens теперь всегда присутствует
usage = response.usage
reasoning_tokens = usage.reasoning_tokens  # 0 если reasoning отключён, не None
```

> Несмотря на то что параметр документирован как нативный, передаётся через `extra_body` —
> это особенность реализации OpenAI SDK, не LM Studio.

### lms CLI — обновлённые команды

```bash
# Загрузить модель с параметрами (обновлённый синтаксис 0.4.x)
lms load "lmstudio-community/Qwen3.5-9B-GGUF" \
  --context-length 8192 \
  --gpu max \
  --parallel 3          # новый флаг в 0.4.x — параллельные слоты

# Информация о GPU
lms runtime survey

# Логи inference в реальном времени
lms log stream -s runtime

# Headless установка (без GUI, через llmster)
curl -fsSL https://lmstudio.ai/install.sh | bash
lms server start --port 1234
```


### /v1/responses — OpenAI Responses API

```python
# LM Studio 0.4.x поддерживает OpenAI Responses API
from openai import OpenAI

client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

response = client.responses.create(
    model=MODEL,
    input="Извлеки данные суда из текста: ...",
    text={
        "format": {
            "type": "json_schema",
            "name": "court_record",
            "schema": schema,
            "strict": True,
        }
    },
)
```


### Python клиент — constrained decoding

```python
from openai import OpenAI
from pydantic import BaseModel
from typing import Optional, Literal

client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio",
)

class CourtRecord(BaseModel):
    name: str
    addresses: list[str]
    phones: list[str]
    region_code: int
    court_type: Literal["АРБИТРАЖНЫЙ", "РАЙОННЫЙ", "МИРОВОЙ", "АПЕЛЛЯЦИОННЫЙ", "КАССАЦИОННЫЙ", "НЕИЗВЕСТНО"]
    website: Optional[str] = None

response = client.beta.chat.completions.parse(
    model="lmstudio-community/Qwen3.5-9B-GGUF/Qwen3.5-9B-Q4_K_M.gguf",
    messages=[
        {"role": "system", "content": "Извлеки данные суда. Если поле не найдено — null."},
        {"role": "user", "content": "/no_think\n\n" + raw_text},
    ],
    response_format=CourtRecord,
    max_tokens=512,
    temperature=0.1,
    extra_body={"reasoning_effort": "none"},
)
record: CourtRecord = response.choices.message.parsed
```

**Практический вывод для архитектора:** с появлением `llmster` в 0.4.x разделение
«LM Studio = dev, Ollama = production» больше не абсолютное.
LM Studio теперь пригоден для headless server деплоя — особенно если нужен
Anthropic API (`/v1/messages`) или OpenAI Responses API (`/v1/responses`) поверх локальных моделей.
Trade-off: Ollama по-прежнему легче в Docker и CI, меньше overhead.

### Граничные случаи — где ломается

```python
# reasoning_field в 0.4.x — поведение зависит от модели
# Модели без встроенного reasoning шаблона игнорируют reasoning_effort
# Проверяй через /api/v1/models — поле "reasoning" в ответе:
import requests

models = requests.get("http://localhost:1234/api/v1/models").json()
for model in models["data"]:
    reasoning_caps = model.get("reasoning", {})
    print(f"{model['id']}: reasoning={reasoning_caps}")
# Если reasoning={} или отсутствует → reasoning_effort игнорируется
```

**Почему это важно архитектору:** `reasoning_effort: "none"` при несовместимой модели
не вызовет ошибку — просто параметр проигнорируется. Thinking продолжит работать.
Верифицируй через `reasoning_tokens` в usage.

---

## 4. Ollama — архитектура и Modelfile

### Qwen3.5 в Ollama — не работает

```bash
# ❌ Qwen3.5 GGUF несовместим с Ollama (март 2026)
# Причина: отдельные mmproj vision files — Ollama не поддерживает split weights
ollama run qwen3.5:9b   # ошибка загрузки модели

# ✅ Для Qwen3.5 — только llama.cpp-совместимые backends
# LM Studio 0.4.x (llama.cpp b8xxx), llama-cpp-python, llama.cpp CLI
```

**Практический вывод для архитектора:** если pipeline требует Qwen3.5 — Ollama не вариант.
LM Studio 0.4.x с `llmster` headless daemon — прямая замена без потери API-совместимости.

### Архитектурный стек Ollama

```
Ollama 0.19
├── ollama CLI
│   ├── ollama serve              # запустить daemon
│   ├── ollama run <model>        # интерактивный чат
│   ├── ollama pull <model>       # скачать модель
│   ├── ollama list               # список загруженных моделей
│   ├── ollama ps                 # запущенные модели
│   └── ollama create <name> -f Modelfile
├── REST API (порт 11434)
│   ├── POST /api/generate        # raw completion, без chat template
│   ├── POST /api/chat            # с chat template
│   ├── GET  /api/tags            # список моделей
│   └── /v1/* — OpenAI-compatible endpoints
└── llama.cpp backend
```


### Modelfile — архитектура и параметры

```dockerfile
FROM ./qwen3.5-9b-q4_k_m.gguf

# Chat template — переопределяет встроенный из GGUF
TEMPLATE """<|im_start|>system
{{ .System }}<|im_end|>
<|im_start|>user
{{ .Prompt }}<|im_end|>
<|im_start|>assistant
"""

SYSTEM "Ты экстрактор структурированных данных. Отвечай только JSON."

# Параметры inference
PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
PARAMETER num_ctx 8192
PARAMETER num_predict 512

# keep_alive — время жизни модели в памяти после последнего запроса
# -1 = держать всегда, 0 = выгружать сразу, "5m" = 5 минут
PARAMETER keep_alive -1
```


### Docker деплой

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama:0.19
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_NUM_PARALLEL=3        # параллельные запросы
      - OLLAMA_MAX_LOADED_MODELS=2   # моделей в памяти одновременно
      - OLLAMA_KEEP_ALIVE=5m
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  ollama_data:
```

**Практический вывод для архитектора:** `keep_alive` — критичный параметр для
batch-обработки. Дефолт `5m` означает что между запросами с паузой > 5 минут
модель выгружается и загружается заново (~10-30 сек overhead).
Для batch pipeline — `keep_alive: -1`.

### Граничные случаи — где ломается

```bash
# OLLAMA_NUM_PARALLEL > доступных VRAM слотов
# Ollama не выдаёт ошибку — просто ставит запросы в очередь
# Симптом: latency растёт линейно, не параллельно

# ollama pull — скачивает модели в формате Ollama (не GGUF напрямую)
# Нельзя использовать произвольный GGUF файл без Modelfile
# ✅ Для кастомных GGUF: ollama create mymodel -f Modelfile

# /api/generate vs /api/chat — разные поведения chat template
# /api/generate: raw mode, template НЕ применяется
# /api/chat: template применяется
# Ошибка: использовать /api/generate с messages-style промптом
```

**Почему это важно архитектору:** `/api/generate` и `/api/chat` — разные endpoint-ы
с принципиально разным поведением. Неправильный выбор = потеря chat template.

---

## 5. Управление Reasoning / Thinking

### Три способа контролировать reasoning

Модели с thinking capability (Qwen3.5, QwQ, DeepSeek-R1) имеют три уровня управления:

```
Способ 1: Chat template — /think и /no_think теги в user message
  Самый надёжный, работает на уровне токенизации
  Поддержка зависит от версии chat template модели

Способ 2: reasoning_effort параметр (LM Studio 0.4.x)
  API-level управление, удобно для pipeline
  Не все модели реагируют одинаково

Способ 3: System prompt инструкция
  Наименее надёжный — модель может игнорировать
  Использовать как fallback, не как основной метод
```


### Способ 1: /think и /no_think теги

```python
# Включить reasoning — для сложных задач
messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": "/think\n\nРешить архитектурную задачу: ..."},
]

# Отключить reasoning — для extraction, classification
messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": "/no_think\n\nИзвлеки данные суда: ..."},
]

# ✅ Тег должен быть первым в content, перед основным текстом
# ❌ Не работает если тег в system message или в середине user message
```


### Способ 2: reasoning_effort (LM Studio 0.4.x)

```python
# "none" — отключить reasoning полностью
# "low"  — короткий chain of thought
# "medium" — стандартный
# "high" — максимальный reasoning budget

response = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    extra_body={"reasoning_effort": "none"},
)

# Верификация что reasoning действительно отключён
assert response.usage.reasoning_tokens == 0, \
    f"reasoning_effort=none но reasoning_tokens={response.usage.reasoning_tokens}"
```


### Верификация через теги в ответе

```python
# Модели с thinking возвращают <think>...</think> блок перед ответом
# Если reasoning отключён — блок отсутствует или пустой

content = response.choices.message.content

if "<think>" in content:
    think_end = content.find("</think>")
    thinking = content[7:think_end]       # содержимое reasoning
    answer = content[think_end + 8:].strip()
    print(f"Reasoning tokens использованы: {len(thinking)} символов")
else:
    answer = content
    # reasoning отключён или модель не поддерживает
```

**Практический вывод для архитектора:** для batch extraction задач `/no_think` + `reasoning_effort: "none"` — не экономия, а архитектурное решение. Reasoning на extraction добавляет latency без прироста точности на well-defined задачах с жёсткой схемой.

### Граничные случаи — где ломается

```python
# grammar (constrained decoding) + thinking — конфликт
# llama.cpp grammar sampling применяется ко ВСЕМУ выводу включая <think> блок
# Если grammar требует JSON с первого токена — thinking невозможен

# ✅ Правильно: отключать reasoning при использовании grammar/json_schema
# ❌ Неправильно: ожидать что модель сначала подумает, потом выдаст JSON по grammar

# Проверка: если модель выдаёт пустой или обрезанный <think> при json_schema —
# это grammar конфликт, не баг модели
```

**Почему это важно архитектору:** grammar и thinking — взаимоисключающие режимы
в текущей реализации llama.cpp. Structured output с thinking требует
двухэтапного pipeline: сначала thinking (free generation), потом extraction (grammar).

---

## 6. Structured Output на локальных моделях

### Три механизма constrained decoding

```
Механизм 1: JSON Schema через /v1/chat/completions (response_format)
  Backend: llama.cpp grammar sampling
  Поддержка: LM Studio 0.4.x, Ollama 0.19, llama-server
  Ограничения: Draft 7, не все ключевые слова

Механизм 2: llama-cpp-python прямой (grammar объект)
  Backend: llama.cpp напрямую без HTTP overhead
  Поддержка: Python pipeline, llama-cpp-python 0.3.19
  Ограничения: Python-only, нет streaming через HTTP

Механизм 3: Outlines (0.2.x)
  Backend: токен-уровневые маски поверх HF transformers или llama.cpp
  Поддержка: сложные схемы, regex, CFG
  Ограничения: overhead инициализации FSM (~100-500ms первый запрос)
```


### Механизм 1: JSON Schema через API

```python
# LM Studio 0.4.x — json_schema через response_format
from openai import OpenAI
from pydantic import BaseModel
from typing import Optional, Literal

client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

class CourtRecord(BaseModel):
    name: str
    court_type: Literal["АРБИТРАЖНЫЙ", "РАЙОННЫЙ", "МИРОВОЙ", "НЕИЗВЕСТНО"]
    region_code: int
    addresses: list[str]
    website: Optional[str] = None

# client.beta.chat.completions.parse — автоматически строит json_schema из Pydantic
response = client.beta.chat.completions.parse(
    model=MODEL,
    messages=[
        {"role": "system", "content": "Извлеки данные. null если не найдено."},
        {"role": "user", "content": "/no_think\n\n" + raw_text},
    ],
    response_format=CourtRecord,
    temperature=0.0,
    extra_body={"reasoning_effort": "none"},
)

record = response.choices.message.parsed  # уже валидированный Pydantic объект
```


### Адаптация схемы под llama.cpp grammar

```python
# llama.cpp grammar не поддерживает все JSON Schema ключевые слова
# Проблемные паттерны:

# ❌ anyOf с разными типами — ненадёжно
{"anyOf": [{"type": "string"}, {"type": "null"}]}

# ✅ Optional через Pydantic → генерирует {"anyOf": [...]} но llama.cpp обрабатывает
from typing import Optional
website: Optional[str] = None  # → {"anyOf": [{"type": "string"}, {"type": "null"}]}

# ❌ patternProperties — не поддерживается
# ❌ $ref с глубокой рекурсией — может зависнуть
# ✅ Простые вложенные объекты — работают

# Проверка совместимости схемы:
import json
schema = CourtRecord.model_json_schema()
print(json.dumps(schema, indent=2, ensure_ascii=False))
# Визуально проверь что нет unsupported конструкций
```


### Механизм 2: llama-cpp-python прямой

```python
from llama_cpp import Llama, LlamaGrammar
import json

llm = Llama(
    model_path="./Qwen3.5-9B-Q4_K_M.gguf",
    n_gpu_layers=-1,    # все слои на GPU
    n_ctx=8192,
    verbose=False,
)

# JSON Schema → grammar объект
schema = CourtRecord.model_json_schema()
grammar = LlamaGrammar.from_json_schema(json.dumps(schema))

output = llm(
    prompt=formatted_prompt,  # уже с chat template
    grammar=grammar,
    max_tokens=512,
    temperature=0.0,
)

result = json.loads(output["choices"]["text"])
```

**Практический вывод для архитектора:** llama-cpp-python прямой — для batch pipeline
без HTTP overhead. LM Studio/Ollama API — для multi-tenant или когда нужен
параллельный доступ к одной модели из нескольких процессов.

### Граничные случаи — где ломается

```python
# Unicode в enum значениях — частая проблема
# Кириллические enum значения могут генерировать неожиданные grammar правила
# Симптом: модель зависает на генерации enum поля

# ✅ Диагностика:
grammar_str = LlamaGrammar._from_json_schema_str(json.dumps(schema))
print(grammar_str)  # посмотреть сгенерированные GBNF правила

# Если GBNF содержит hex-escape для кириллицы → возможна проблема
# Решение: использовать латинские enum ключи, маппить на кириллицу после парсинга

COURT_TYPE_MAP = {
    "ARBITRATION": "АРБИТРАЖНЫЙ",
    "DISTRICT": "РАЙОННЫЙ",
    "MAGISTRATE": "МИРОВОЙ",
    "UNKNOWN": "НЕИЗВЕСТНО",
}
```

**Почему это важно архитектору:** кириллица в enum — специфичная проблема
для русскоязычных pipeline. Обнаруживается только на реальных данных,
не на английских тестах.

---

## 7. Производительность — измерение и тюнинг

### Метрики: TTFT и TPS

```python
import time
import httpx

def measure_inference(prompt: str, model: str) -> dict:
    """Измерение TTFT и TPS через streaming."""
    start = time.perf_counter()
    first_token_time = None
    token_count = 0

    with httpx.stream("POST", "http://localhost:1234/v1/chat/completions",
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "max_tokens": 256,
        }
    ) as response:
        for line in response.iter_lines():
            if line.startswith("data: ") and line != "data: [DONE]":
                if first_token_time is None:
                    first_token_time = time.perf_counter()
                token_count += 1

    end = time.perf_counter()

    return {
        "ttft_ms": (first_token_time - start) * 1000,
        "total_ms": (end - start) * 1000,
        "tps": token_count / (end - first_token_time) if first_token_time else 0,
        "tokens": token_count,
    }

# TTFT включает: загрузку промпта + prefill + первый decode
# TPS — только decode фаза, основная метрика для generation
```


### --cache-prompt и prefix caching

```bash
# llama.cpp / LM Studio — prefix caching включён по умолчанию
# Работает когда system prompt одинаковый между запросами
# KV-cache префикса переиспользуется → TTFT второго запроса значительно ниже

# Измерение эффекта prefix caching:
# Запрос 1 (холодный): TTFT ~500ms
# Запрос 2 (тот же system prompt): TTFT ~50ms
# Разница → размер закешированного префикса

# Архитектурное следствие:
# Держи system prompt стабильным между запросами batch
# Динамические данные — только в user message, не в system
```


### Flash Attention — trade-offs

```python
# Flash Attention в llama.cpp — включается через -fa флаг
# LM Studio: Settings → Runtime → Flash Attention

# ✅ Flash Attention даёт:
# - Снижение VRAM на KV-cache ~20-30% (зависит от n_ctx)
# - Ускорение prefill на длинных контекстах

# ❌ Flash Attention ограничения:
# - Требует определённые архитектуры GPU (Ampere+ для полного эффекта)
# - GTX 1660 (Turing) — частичная поддержка, эффект меньше
# - Некоторые квантизации несовместимы (Q2_K + FA → артефакты)
# - Известный баг: Flash Attention ломает некоторые Qwen модели в LM Studio
#   github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1353

# ✅ Рекомендация для GTX 1660: тестировать с FA и без, сравнивать TPS
# Не включать по умолчанию без измерения
```

**Практический вывод для архитектора:** Flash Attention на GTX 1660 — не гарантированное
ускорение. На Turing архитектуре эффект меньше чем на Ampere/Ada. Измеряй.

### Граничные случаи — где ломается

```bash
# n_ctx максимум → VRAM overflow без предупреждения
# llama.cpp при недостатке VRAM переходит на CPU для части слоёв
# Симптом: TPS падает с 15 до 1-2 — часть KV-cache на CPU

# Диагностика CPU offload:
lms log stream -s runtime | grep "offload"
# или через llama-server --verbose — выводит распределение слоёв

# ✅ Правило: n_ctx × bytes_per_kv_element должен помещаться в свободный VRAM
# после загрузки весов модели
```

**Почему это важно архитектору:** CPU fallback для KV-cache — самая частая причина
необъяснимого падения TPS. Модель «работает», но в 10x медленнее.

---

## Реальный кейс

**Задача:** batch extraction из ~5000 судебных объектов.
**Стек:** Ryzen 5 3600, GTX 1660 6 Гб, Qwen3.5-9B Q4_K_M, LM Studio 0.4.x.
**Схема:** 7 полей, Literal enum с кириллицей, Optional поля.

**Гипотеза:** включить thinking для повышения точности на граничных кейсах
(склейка адресов, неполные названия судов).

**Что получилось:**

```
Thinking ON  (reasoning_effort: "medium"):
  TTFT:  ~800ms
  TPS:   ~12 tok/s
  Время на 5000 объектов: ~11.5 часов
  Точность на граничных кейсах: 84%

Thinking OFF (reasoning_effort: "none" + /no_think):
  TTFT:  ~180ms
  TPS:   ~18 tok/s
  Время на 5000 объектов: ~6.8 часов  ← 41% speedup
  Точность на граничных кейсах: 81%
```

**Вывод, противоречащий интуиции:** thinking дал только +3% точности на граничных кейсах
при 41% увеличении времени выполнения. Деградация объясняется конкретным типом ошибок:
модель без thinking правильно следует grammar schema и выдаёт `"НЕИЗВЕСТНО"` там,
где не уверена. С thinking — иногда «додумывает» неверные данные вместо null.

**Архитектурное решение:** two-pass pipeline.

- Pass 1: все объекты без thinking — быстро, 96% покрытие
- Pass 2: только объекты с `"НЕИЗВЕСТНО"` полями + thinking — ~4% объектов, точечно

Итоговое время: ~7.2 часа. Точность на граничных кейсах: 89%.

---

## Антипаттерны

**1. CPU fallback незаметен**

```python
# ❌ Загрузить модель и считать что она на GPU
llm = Llama(model_path=MODEL, n_gpu_layers=-1, n_ctx=32768)
# n_ctx=32768 на 7B Q4_K_M → KV-cache ~4 Гб → не помещается после весов
# llama.cpp молча переносит часть на CPU
# TPS: 1-2 вместо 15-18

# ✅ Проверять реальное распределение слоёв
llm = Llama(model_path=MODEL, n_gpu_layers=-1, n_ctx=8192, verbose=True)
# verbose=True выводит: "llm_load_tensors: offloaded 32/32 layers to GPU"
# Если не все слои → уменьшай n_ctx или квантизацию
```

**2. n_ctx максимум по умолчанию**

```python
# ❌ Выставить максимальный контекст "на всякий случай"
lms load model --context-length 131072  # 128K контекст

# ✅ Считать реальный KV-cache и ставить минимально достаточный
# Для extraction одного документа ~2-4K токенов → n_ctx=8192 достаточно
# Разница в VRAM: 8K vs 128K контекст = ~0.5 Гб vs ~8 Гб только на KV-cache
```

**3. Доверять параметрам API без верификации**

```python
# ❌ Передать reasoning_effort="none" и считать что thinking отключён
response = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    extra_body={"reasoning_effort": "none"},
)
# Не проверять usage.reasoning_tokens

# ✅ Верифицировать через метрики
assert response.usage.reasoning_tokens == 0
# или проверять отсутствие <think> тегов в ответе
```

**4. Однозапросный бенчмарк**

```python
# ❌ Измерить TPS на одном запросе и считать это репрезентативным
result = measure_inference(prompt, model)
print(f"TPS: {result['tps']}")  # может быть аномально высоким (тёплый кеш)
# или аномально низким (холодная загрузка модели)

# ✅ Прогрев + серия измерений
def benchmark(prompt, model, n=10, warmup=2):
    for _ in range(warmup):
        measure_inference(prompt, model)
    results = [measure_inference(prompt, model) for _ in range(n)]
    tps_values = [r["tps"] for r in results]
    return {
        "mean_tps": sum(tps_values) / len(tps_values),
        "min_tps": min(tps_values),
        "max_tps": max(tps_values),
    }
```

**5. Оптимизировать скорость до измерения качества**

```
❌ Антипаттерн:
   1. Включить Q2_K для экономии VRAM
   2. Отключить thinking для скорости
   3. Уменьшить n_ctx до минимума
   4. Запустить на всём датасете
   5. Обнаружить 40% ошибок на граничных кейсах

✅ Правильно:
   1. Зафиксировать baseline качества на репрезентативной выборке (~100 объектов)
   2. Оптимизировать скорость при условии: качество не хуже baseline - 2%
   3. Только после валидации — масштабировать на полный датасет
```


---

## Задачи AI-кодеру

**Задача 1 — VRAM расчёт**

Плохая формулировка:
> «Напиши скрипт для запуска LLM на локальной машине»

Хорошая формулировка:
> «Напиши Python функцию `calculate_vram(params_b, quant, n_ctx, n_layers, n_kv_heads, head_dim)`,
> которая возвращает словарь с model_weights_gb, kv_cache_gb, total_gb.
> Учитывай GQA (n_kv_heads может быть меньше n_heads).
> Добавь константу runtime_overhead=0.4 Гб.
> Верни также флаг fits_6gb: bool.
> Используй только стандартную библиотеку Python.»

Формула: **что вычисляет** + **входные параметры с типами** + **структура вывода** + **граничные случаи** + **зависимости**

---

**Задача 2 — Batch inference pipeline**

Плохая формулировка:
> «Сделай batch обработку через LM Studio API»

Хорошая формулировка:
> «Напиши async Python функцию `batch_extract(texts: list[str], schema: type[BaseModel], concurrency: int = 3) -> list[BaseModel | None]`,
> которая отправляет запросы к LM Studio 0.4.x на localhost:1234
> через openai AsyncOpenAI клиент с client.beta.chat.completions.parse.
> Параметры запроса: temperature=0.0, reasoning_effort="none", /no_think префикс в user message.
> При ValidationError или timeout — возвращать None для этого элемента, не прерывать batch.
> Логировать прогресс каждые 100 запросов через tqdm.»

---

**Задача 3 — Верификация reasoning**

Плохая формулировка:
> «Проверь что thinking отключён»

Хорошая формулировка:
> «Напиши pytest фикстуру `assert_no_reasoning(response: ChatCompletion)`,
> которая проверяет одновременно:
> 1. response.usage.reasoning_tokens == 0
> 2. "<think>" не содержится в response.choices[0].message.content
> Если хотя бы одно условие нарушено — raise AssertionError с деталями:
> какое условие нарушено и фактические значения.
> Совместимость: openai SDK 1.x, LM Studio 0.4.x API.»

---

## Чеклист архитектора

### VRAM и модель

- [ ] Рассчитан VRAM бюджет по формуле (веса + KV-cache + overhead)
- [ ] Квантизация выбрана исходя из VRAM, не по умолчанию
- [ ] Проверено что все слои на GPU (verbose лог при загрузке)
- [ ] n_ctx установлен минимально достаточный для задачи


### Chat Template

- [ ] Верифицирован применяемый chat template через tokenizer
- [ ] BOS/EOS не добавляются вручную при использовании /v1/chat/completions
- [ ] System role поддерживается выбранной моделью


### Reasoning

- [ ] Определён режим reasoning для каждого типа задач в pipeline
- [ ] reasoning_tokens верифицируется в usage при reasoning_effort="none"
- [ ] Grammar и thinking не используются одновременно


### Structured Output

- [ ] JSON Schema совместима с llama.cpp grammar (Draft 7)
- [ ] Unicode в enum значениях протестирован
- [ ] Fallback при ValidationError реализован


### Производительность

- [ ] TTFT и TPS измерены на репрезентативной выборке (не один запрос)
- [ ] Baseline качества зафиксирован перед оптимизацией скорости
- [ ] keep_alive настроен под паттерн нагрузки (batch vs real-time)
- [ ] CPU fallback исключён через проверку распределения слоёв

---

*Модуль 08 завершён.*
*Следующий: [Модуль 09 — LLM Evaluation \& Quality Metrics](../09-llm-evaluation/README.md)*

