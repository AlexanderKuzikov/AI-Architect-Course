# Модуль 13 — Fine-tuning / LoRA

> **Для AI-архитектора:** Fine-tuning — последний инструмент, не первый. Его берут когда prompt engineering исчерпан, RAG не применим, а задача требует изменения поведения модели на уровне весов. На GTX 1660 6 ГБ реально: QLoRA на моделях до 7B. Выше — только в облаке или с quantization tricks.
> Один день изучения — механика LoRA/QLoRA, границы применимости, dataset pipeline, гиперпараметры с trade-offs, GGUF export в LM Studio.

## Содержание

1. [Когда fine-tuning — правильный выбор](#1-когда-fine-tuning--правильный-выбор)
2. [Механика LoRA](#2-механика-lora)
3. [QLoRA — 4-bit + LoRA](#3-qlora--4-bit--lora)
4. [Dataset — единственное что важно](#4-dataset--единственное-что-важно)
5. [Гиперпараметры: rank, alpha, lr, epochs](#5-гиперпараметры-rank-alpha-lr-epochs)
6. [Фреймворки: Unsloth vs Axolotl vs PEFT](#6-фреймворки-unsloth-vs-axolotl-vs-peft)
7. [Тренировочный pipeline на GTX 1660 6 ГБ](#7-тренировочный-pipeline-на-gtx-1660-6-гб)
8. [Экспорт: GGUF → LM Studio / Ollama](#8-экспорт-gguf--lm-studio--ollama)
9. [Оценка результата](#9-оценка-результата)
10. [Реальный кейс](#10-реальный-кейс)
11. [Антипаттерны](#11-антипаттерны)
12. [Задачи AI-кодеру](#задачи-ai-кодеру)
13. [Чеклист архитектора](#чеклист-архитектора)

---

## Актуальные версии

| Инструмент | Версия | Дата проверки |
|:--|:--|:--|
| Python | 3.12+ | март 2026 |
| Unsloth | 2026.3.x (PyPI) | март 2026 |
| PEFT (HuggingFace) | 0.18.0+ | март 2026 |
| Transformers | 5.x | март 2026 |
| Axolotl | 0.8.x | март 2026 |
| bitsandbytes | 0.44.x | март 2026 |
| LM Studio | 0.4.8 | март 2026 |

---

## 1. Когда fine-tuning — правильный выбор

### Дерево решений

Прежде чем браться за fine-tuning — пройти по дереву:

```
Задача требует нового поведения модели?
        │
        ├── Нет → Prompt Engineering (Модуль 06)
        │
        ├── Нужны внешние данные/факты?
        │       └── Да → RAG (Модуль 12)
        │
        ├── Нужен специфичный формат вывода?
        │       └── Да → JSON Schema + промпт (Модуль 07)
        │
        ├── Базовая модель не знает домен / стиль / язык?
        │       └── Да → Fine-tuning (этот модуль)
        │
        └── Нужна максимальная скорость на узкой задаче?
                └── Да → Fine-tuning (distillation / specialization)
```

### Что fine-tuning меняет, а что нет

Fine-tuning адаптирует **поведение и стиль**, но не добавляет новые знания надёжно:

| Fine-tuning меняет | Fine-tuning НЕ меняет |
|:--|:--|
| Формат и стиль ответа | Актуальность данных (stale knowledge) |
| Следование инструкциям в домене | Фактические знания (лучше RAG) |
| Тон и регистр (юридический, технический) | Размер context window |
| Производительность на узкой задаче | Галлюцинации (может усилить) |
| Поведение при специфичных входных данных | Ограничения по VRAM |

**Практический вывод для архитектора:** Если задача — «модель должна знать наш каталог товаров» — это RAG, не fine-tuning. Если задача — «модель должна всегда отвечать в формате юридического документа с нашими шаблонными оборотами» — это fine-tuning.

---

## 2. Механика LoRA

### Математика без воды

Полное обновление весов при обычном fine-tuning:

\[W' = W + \Delta W\]

где \(\Delta W\) имеет ту же размерность что и \(W\) — например, 4096×4096 для attention слоя. Это миллиарды параметров.

LoRA (Low-Rank Adaptation) аппроксимирует \(\Delta W\) через произведение двух малых матриц:

\[\Delta W = BA\]

где \(B \in \mathbb{R}^{d \times r}\), \(A \in \mathbb{R}^{r \times k}\), и \(r \ll \min(d, k)\).

```
Оригинальный вес W: [4096 × 4096] = 16 777 216 параметров
LoRA при r=16:
  A: [16 × 4096]   = 65 536 параметров
  B: [4096 × 16]   = 65 536 параметров
  Итого: 131 072 — в 128× меньше

При r=64:
  524 288 параметров — в 32× меньше
```

При инференсе адаптер складывается с оригинальным весом: `W_merged = W + B×A×(alpha/r)`. Нет оверхеда в runtime при merged модели.

### Какие слои адаптировать

LoRA применяется к проекционным матрицам transformer-блоков:

```python
target_modules = [
    "q_proj",   # query projection
    "k_proj",   # key projection
    "v_proj",   # value projection
    "o_proj",   # output projection
    "gate_proj", # FFN gate (MoE и стандартные)
    "up_proj",   # FFN up
    "down_proj", # FFN down
]
# ✅ Все основные линейные слои — стандартная рекомендация Unsloth
# ❌ Не только q_proj/v_proj — экономия VRAM минимальна, потеря качества существенна
```

**Практический вывод для архитектора:** LoRA rank `r` — главный рычаг управления ёмкостью адаптера. Малый rank (4–8) — быстро, мало параметров, может не хватить для сложных задач. Высокий rank (64–128) — медленно, больше параметров, риск переобучения на малом датасете.

---

## 3. QLoRA — 4-bit + LoRA

### Механика

QLoRA = quantization исходной модели до 4-bit (NF4) + обучение LoRA адаптера в 16-bit поверх замороженных квантованных весов:

```
Оригинальная модель (frozen, 4-bit NF4)
        │
        ▼
┌───────────────────────────────────────────┐
│  Transformer Layer                        │
│                                           │
│  W (frozen, 4-bit) ──▶ dequantize ──▶    │
│  W_fp16 + B×A (trainable, 16-bit) ──▶    │
│  forward pass                             │
└───────────────────────────────────────────┘
```

### VRAM: LoRA vs QLoRA

| Модель | LoRA (16-bit) | QLoRA (4-bit) | Влезает в 6 ГБ |
|:--|:--|:--|:--|
| Qwen3.5 0.8B | ~2 ГБ | ~1 ГБ | ✅ LoRA и QLoRA |
| Qwen3.5 2B | ~5 ГБ | ~2 ГБ | ⚠️ LoRA впритык, QLoRA ✅ |
| Qwen3.5 4B | ~10 ГБ | ~4 ГБ | ❌ LoRA, ✅ QLoRA |
| Qwen3.5 7B+ | ~18 ГБ | ~6–7 ГБ | ❌ LoRA, ⚠️ QLoRA с tricks |

Tricks для GTX 1660 6 ГБ при QLoRA на 4B:
- `gradient_checkpointing="unsloth"` — -30% VRAM при +20% времени
- `per_device_train_batch_size=1`
- `gradient_accumulation_steps=4` — effective batch size 4 без VRAM overhead

### NF4 vs INT4

NF4 (Normal Float 4) — квантизация с неравномерными шагами, оптимизированная под нормальное распределение весов нейросетей. INT4 — равномерная сетка. NF4 даёт лучшее качество при том же объёме — bitsandbytes использует NF4 по умолчанию.

**Практический вывод для архитектора:** На GTX 1660 6 ГБ — QLoRA с Qwen3.5 2B или 4B. 2B для быстрых итераций, 4B для production качества. 7B+ — только облако (Colab T4 = 15 ГБ бесплатно).

---

## 4. Dataset — единственное что важно

### Форматы датасетов

Fine-tuning требует структурированных примеров. Три стандартных формата:

**Alpaca (instruction tuning):**
```json
{
  "instruction": "Извлеки из текста название компании и ИНН",
  "input": "ООО «Ромашка», ИНН 7701234567, заключает договор...",
  "output": "{\"company\": \"ООО Ромашка\", \"inn\": \"7701234567\"}"
}
```

**ShareGPT (multi-turn conversation):**
```json
{
  "conversations": [
    {"from": "human", "value": "Извлеки ИНН из документа: ООО «Ромашка», ИНН 7701234567"},
    {"from": "gpt", "value": "{\"inn\": \"7701234567\"}"}
  ]
}
```

**Raw completion (pretraining style):**
```json
{
  "text": "<|im_start|>user\nИзвлеки ИНН...<|im_end|>\n<|im_start|>assistant\n{\"inn\": \"7701234567\"}<|im_end|>"
}
```

Для instruction tuning — Alpaca или ShareGPT. Chat template форматирует их автоматически.

### Объём датасета

```
Минимум жизнеспособного датасета:
  Простая классификация / детекция: 200–500 примеров
  Structured extraction (JSON): 500–1000 примеров
  Стилистическая адаптация: 1000–3000 примеров
  Сложный домен (юридический, медицинский): 3000–10 000 примеров

Признаки переобучения:
  - Train loss падает, eval loss растёт
  - Модель воспроизводит тренировочные примеры дословно
  - На out-of-distribution примерах деградация

Правило: 80/10/10 split (train/val/test)
  Test set — не трогать до финальной оценки
```

### Качество важнее количества

```python
# ❌ 10 000 шумных примеров
bad_example = {
    "instruction": "обработай",
    "input": "какой-то текст с ошибками и опечатками адрес улица ленина д5",
    "output": "Улица Ленина, д. 5"  # верно, но промпт бессодержателен
}

# ✅ 500 чистых примеров с богатым контекстом
good_example = {
    "instruction": "Извлеки из текста почтовый адрес в стандартизированном формате. "
                   "Если адрес неполный — верни null для отсутствующих полей. "
                   "Верни JSON с полями: street, house, apartment, city, postal_code.",
    "input": "Доставка по адресу: ул. Ленина д.5 кв 12, г. Казань",
    "output": '{"street": "ул. Ленина", "house": "5", "apartment": "12", "city": "Казань", "postal_code": null}'
}
```

### Аугментация для русского текста

```python
import random

def augment_russian(example: dict) -> list[dict]:
    """Простая аугментация через вариации формулировок."""
    variations = []
    input_text = example["input"]

    # Вариации написания адресов
    replacements = [
        ("ул.", "улица"),
        ("д.", "дом"),
        ("кв.", "квартира"),
        ("г.", "город"),
    ]

    for old, new in replacements:
        if old in input_text:
            variations.append({
                **example,
                "input": input_text.replace(old, new)
            })

    return variations if variations else [example]
```

### Граничные случаи — где ломается

**Unbalanced dataset.** Если 95% примеров — успешное извлечение, 5% — null/отсутствие данных, модель обучится игнорировать null случаи. Балансируй классы явно.

**Data leakage в test set.** При аугментации легко получить в test set вариацию тренировочного примера. Стратифицированный split по source_id, а не по примерам.

**Почему это важно архитектору:** Fine-tuning усиливает паттерны в данных — хорошие и плохие. Шумный датасет = модель, уверенно делающая ошибки.

**Практический вывод для архитектора:** Потрать 80% времени на датасет, 20% на обучение. Это не преувеличение.

---

## 5. Гиперпараметры: rank, alpha, lr, epochs

### LoRA-специфичные параметры

| Параметр | Дефолт | Диапазон | Влияние |
|:--|:--|:--|:--|
| `r` (rank) | 16 | 4–128 | Ёмкость адаптера. Выше → больше параметров, риск переобучения |
| `lora_alpha` | 16 | = r или 2×r | Scaling: `alpha/r` умножает на ∆W. `alpha=r` → scaling=1.0 |
| `lora_dropout` | 0.05 | 0–0.1 | Регуляризация. При малом датасете 0.05–0.1 |
| `target_modules` | все | subset | Меньше слоёв → меньше VRAM, хуже качество |

**alpha/r соотношение:**

```
alpha = r → scaling = 1.0 (стандарт, начинать отсюда)
alpha = 2r → scaling = 2.0 (усиленная адаптация, риск нестабильности)
alpha = r/2 → scaling = 0.5 (консервативно, для малых датасетов)
```

### Общие параметры обучения

| Параметр | Малый датасет (<1K) | Средний (1K–10K) | Большой (>10K) |
|:--|:--|:--|:--|
| `learning_rate` | 1e-4 | 2e-4 | 3e-4 |
| `num_train_epochs` | 3–5 | 2–3 | 1–2 |
| `warmup_ratio` | 0.1 | 0.05 | 0.03 |
| `weight_decay` | 0.01 | 0.01 | 0.01 |

### Признаки проблем в loss кривой

```
Нормально:
  train_loss: 2.1 → 0.8 → 0.4 (плавный спуск)
  eval_loss:  2.2 → 0.9 → 0.5 (параллельно train)

Переобучение:
  train_loss: 2.1 → 0.3 → 0.1 (слишком быстро)
  eval_loss:  2.2 → 0.8 → 1.2 (растёт после минимума)
  Решение: меньше epochs, выше dropout, меньше rank

Недообучение:
  train_loss: 2.1 → 1.8 → 1.6 (почти не падает)
  eval_loss:  2.2 → 1.9 → 1.7
  Решение: выше lr, больше epochs, выше rank, больше данных
```

**Практический вывод для архитектора:** `r=16, alpha=16` — стартовая конфигурация для любой задачи. Менять только после измерения eval_loss динамики, не наугад.

---

## 6. Фреймворки: Unsloth vs Axolotl vs PEFT

| Критерий | Unsloth 2026.3 | Axolotl 0.8.x | PEFT 0.18+ |
|:--|:--|:--|:--|
| Скорость обучения | ✅ 2–3× быстрее | Стандартная | Стандартная |
| VRAM эффективность | ✅ Лучшая | Хорошая | Базовая |
| VLM fine-tuning | ✅ Qwen3.5 VLM | ✅ Multimodal | ⚠️ Ручная настройка |
| Multi-GPU | ⚠️ Ограниченно | ✅ Нативно | ✅ через Accelerate |
| Конфигурация | Python API | ✅ YAML | Python API |
| Embedding fine-tuning | ✅ 1.8–3.3× быстрее | ❌ | ✅ |
| Кастомизация | ⚠️ Менее гибкий | ✅ Полный контроль | ✅ Полный контроль |
| Для одной GPU | ✅ Оптимум | ✅ | ✅ |

**Правило выбора:**
```
Одна GPU (GTX 1660, A100) + скорость/VRAM критичны → Unsloth
Multi-GPU + production scale + multimodal → Axolotl
Нестандартная архитектура / максимальный контроль → PEFT напрямую
```

---

## 7. Тренировочный pipeline на GTX 1660 6 ГБ

### Полный рабочий пример: Qwen3.5 2B + QLoRA

```python
# fine_tune.py — QLoRA на GTX 1660 6GB
from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
import torch

MAX_SEQ_LENGTH = 1024   # ✅ Ограничь — каждые +512 токенов ≈ +0.5GB VRAM
DTYPE = torch.float16   # GTX 1660 не поддерживает bfloat16
LOAD_IN_4BIT = True     # QLoRA

# 1. Загрузка модели
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen3-2B-bnb-4bit",
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=DTYPE,
    load_in_4bit=LOAD_IN_4BIT,
)

# 2. LoRA адаптер
model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    lora_alpha=16,
    lora_dropout=0.05,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    bias="none",
    use_gradient_checkpointing="unsloth",  # ✅ -30% VRAM
    random_state=42,
)

# 3. Датасет (Alpaca формат)
dataset = load_dataset("json", data_files={
    "train": "data/train.jsonl",
    "validation": "data/val.jsonl",
})

def format_alpaca(example):
    return {
        "text": (
            f"<|im_start|>user\n"
            f"{example['instruction']}\n"
            f"{example['input']}<|im_end|>\n"
            f"<|im_start|>assistant\n"
            f"{example['output']}<|im_end|>"
        )
    }

dataset = dataset.map(format_alpaca)

# 4. Обучение
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    args=TrainingArguments(
        output_dir="./output",
        num_train_epochs=3,
        per_device_train_batch_size=1,      # ✅ Минимум для 6GB
        gradient_accumulation_steps=4,      # effective batch = 4
        learning_rate=2e-4,
        warmup_ratio=0.05,
        weight_decay=0.01,
        fp16=True,                          # ✅ GTX 1660 — fp16, не bf16
        logging_steps=10,
        evaluation_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=100,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        report_to="none",                   # отключить wandb если не нужен
    ),
)

trainer.train()

# 5. Сохранение LoRA адаптера
model.save_pretrained("./lora_adapter")
tokenizer.save_pretrained("./lora_adapter")
```

### Мониторинг VRAM во время обучения

```python
import subprocess

def log_vram():
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=memory.used,memory.free",
         "--format=csv,noheader,nounits"],
        capture_output=True, text=True
    )
    used, free = result.stdout.strip().split(", ")
    print(f"VRAM: {used}MB used / {free}MB free")

# Вызывать перед и после загрузки модели
log_vram()
```

### Граничные случаи — где ломается

**CUDA OOM посреди обучения.** Не при загрузке модели, а через N шагов. Причина: активации накапливаются с ростом длины последовательности. Gradient checkpointing перевычисляет активации — экономит VRAM за счёт времени.

```python
# ✅ Если OOM — сначала уменьшить max_seq_length, потом batch_size
# Порядок влияния на VRAM: max_seq_length >> batch_size > rank
```

**fp16 instability на GTX 1660.** При высоком learning rate fp16 может давать `nan` в loss. Признак: loss внезапно становится `nan` на 10–50 шаге.

```python
# ✅ При nan loss:
args = TrainingArguments(
    ...
    fp16=True,
    half_precision_backend="auto",
    max_grad_norm=1.0,   # gradient clipping
    learning_rate=1e-4,  # уменьшить lr
)
```

**Почему это важно архитектору:** CUDA OOM на шаге 200 из 1000 — потеря времени без checkpoint. Сохраняй checkpoint каждые 50–100 шагов.

---

## 8. Экспорт: GGUF → LM Studio / Ollama

### Механика merge + quantize

После обучения — два варианта деплоя:

```
Вариант 1: LoRA адаптер отдельно
  base_model + lora_adapter → загружать вместе в Unsloth/PEFT
  ✅ Быстрая итерация (адаптер ~100MB)
  ❌ Не работает в LM Studio / Ollama напрямую

Вариант 2: Merge + GGUF export
  base_model + lora_adapter → merged_model → GGUF → LM Studio
  ✅ Работает в любом llama.cpp совместимом inference
  ❌ Занимает место (полная модель в GGUF)
```

### Merge и экспорт через Unsloth

```python
# export_gguf.py
from unsloth import FastLanguageModel

# Загрузить обученную модель с адаптером
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="./lora_adapter",  # путь к сохранённому адаптеру
    max_seq_length=1024,
    load_in_4bit=True,
)

# Merge LoRA в базовую модель и экспорт в GGUF
# Уровни квантизации для GGUF:
#   q4_k_m — баланс качество/размер (рекомендуется)
#   q5_k_m — выше качество, больше размер
#   q8_0   — почти fp16 качество, большой файл
#   f16    — без квантизации, максимальный размер

model.save_pretrained_gguf(
    "my_model_gguf",
    tokenizer,
    quantization_method="q4_k_m",
)
# Результат: my_model_gguf/model.gguf — готов для LM Studio
```

### Установка в LM Studio

```bash
# Скопировать .gguf файл в директорию моделей LM Studio
# macOS/Linux: ~/.cache/lm-studio/models/<author>/<model-name>/
# Windows: %USERPROFILE%\.cache\lm-studio\models\

cp my_model_gguf/model.gguf \
   ~/.cache/lm-studio/models/local/my-finetuned-qwen/model.gguf

# В LM Studio: My Models → появится local/my-finetuned-qwen
```

**Практический вывод для архитектора:** `q4_k_m` — стандарт для деплоя. Разница с `q5_k_m` в качестве незначительна, разница в размере файла — 25%. Для 2B модели: q4_k_m ≈ 1.4 ГБ, q5_k_m ≈ 1.8 ГБ.

---

## 9. Оценка результата

### Три уровня оценки

**Уровень 1 — Loss метрики** (во время обучения):
- `eval_loss` — падает? Не растёт? Необходимо, но недостаточно

**Уровень 2 — Task-specific метрики** (после обучения):
```python
def evaluate_extraction(model, test_dataset: list[dict]) -> dict:
    correct = 0
    structural_errors = 0
    null_errors = 0

    for example in test_dataset:
        response = model.generate(example["input"])

        try:
            parsed = json.loads(response)
            # Сравнение по полям
            if parsed == json.loads(example["output"]):
                correct += 1
        except json.JSONDecodeError:
            structural_errors += 1

    return {
        "accuracy": correct / len(test_dataset),
        "structural_error_rate": structural_errors / len(test_dataset),
        "null_error_rate": null_errors / len(test_dataset),
    }
```

**Уровень 3 — Сравнение с baseline**:

```
Baseline (base model + промпт без fine-tuning):
  accuracy: 0.72, structural_errors: 0.08

После fine-tuning:
  accuracy: 0.89, structural_errors: 0.01

Прирост: +17pp accuracy, -7pp structural errors
```

Если fine-tuned модель не превосходит базовую на test set — fine-tuning не помог. Причины: мало данных, плохой датасет, неподходящий rank.

### LLM-as-judge для оценки качества

```python
async function evaluateWithLLM(
  predicted: string,
  expected: string,
  criteria: string
): Promise<{ score: number; reason: string }> {
  const prompt = `Оцени качество ответа по критерию: "${criteria}"

Ожидаемый ответ: ${expected}
Полученный ответ: ${predicted}

Верни JSON: {"score": 0-10, "reason": "краткое обоснование"}`;

  const response = await llm.complete(prompt);
  return JSON.parse(response);
}
```

**Практический вывод для архитектора:** Eval loss — необходимое условие. Task-specific метрика на test set — достаточное. Без сравнения с baseline неясно, было ли fine-tuning вообще полезно.

---

## 10. Реальный кейс

> ⚠️ **Раздел ожидает данных от автора.**
> Формат: входные данные → гипотеза → результат → вывод противоречащий интуиции.
> Кандидаты: fine-tuning для структурированной экстракции юридических документов, адаптация под кириллические ценники, domain-specific prompt following.

---

## 11. Антипаттерны

### «Fine-tuning вместо промпта»

**Выглядит правильно:** модель даёт нестабильный формат — обучим её на правильном формате.

**Почему ошибка:** JSON Schema + правильный system prompt решает проблему формата за 10 минут. Fine-tuning — за несколько часов на подготовку данных и обучение. Сначала исчерпай prompt engineering.

---

### «Больше эпох = лучше модель»

**Выглядит правильно:** модель обучается дольше = лучше усваивает.

**Почему ошибка:** после точки минимума eval_loss модель начинает запоминать тренировочные примеры, а не обобщать паттерн. Переобучение на малом датасете (< 1000 примеров) наступает уже на 5–7 эпохе. Early stopping по `eval_loss` — обязателен.

---

### «Fine-tune на шумных данных быстро»

**Выглядит правильно:** есть 50 000 автоматически разобранных примеров — используем всё.

**Почему ошибка:** fine-tuning усиливает паттерны данных включая ошибки. 500 чистых примеров > 10 000 шумных. Автоматически собранный датасет без верификации на выборке = обучение модели ошибаться уверенно.

---

### «LoRA rank побольше = качество получше»

**Выглядит правильно:** больше параметров адаптера → больше выразительность.

**Почему ошибка:** при малом датасете высокий rank ведёт к переобучению быстрее. r=64 на 300 примерах запомнит датасет, а не обобщит задачу. Начинай с r=16, повышай только при доказанном недообучении.

---

### «Деплоить адаптер без merge на production»

**Выглядит правильно:** адаптер маленький (100 МБ), удобно обновлять.

**Почему ошибка:** inference с отдельным LoRA адаптером требует PEFT runtime, дополнительной памяти и замедления. Merged GGUF в LM Studio/Ollama работает на нативном llama.cpp без оверхеда. Для production — всегда merge + quantize.

---

## Задачи AI-кодеру

**Задача 1 — Dataset pipeline**

Плохая формулировка:
> «Подготовь датасет для fine-tuning»

Хорошая формулировка:
> «Реализуй на Python 3.12 скрипт подготовки датасета для instruction fine-tuning. Входные данные: JSONL файл с полями `raw_text` и `expected_json`. Выходной формат: Alpaca JSONL с полями `instruction`, `input`, `output`. `instruction` — фиксированный промпт из константы. Добавь: стратифицированный train/val/test split 80/10/10 по хэшу поля `source_id` (не random). Логируй: общее число примеров, распределение по split, количество примеров где `expected_json` содержит null-поля (отдельная метрика).»

Формула: формат входа/выхода + split стратегия + метрики датасета.

---

**Задача 2 — QLoRA тренировка**

Плохая формулировка:
> «Запусти fine-tuning модели на наших данных»

Хорошая формулировка:
> «Напиши скрипт QLoRA fine-tuning на Python 3.12 с Unsloth 2026.3. Модель: `unsloth/Qwen3-2B-bnb-4bit`. Параметры: r=16, lora_alpha=16, все target_modules, gradient_checkpointing="unsloth", fp16=True, batch_size=1, gradient_accumulation=4, lr=2e-4, 3 эпохи. Датасет: `data/train.jsonl` и `data/val.jsonl` в Alpaca формате. Early stopping: если eval_loss не улучшается 3 eval шага подряд — остановить. Сохранять checkpoint каждые 100 шагов в `./checkpoints/`. После обучения экспортировать merged GGUF q4_k_m в `./output/model.gguf`.»

Формула: точная версия + все гиперпараметры + early stopping + экспорт.

---

**Задача 3 — Оценка модели**

Плохая формулировка:
> «Проверь качество fine-tuned модели»

Хорошая формулировка:
> «Реализуй скрипт оценки на Python 3.12. Входные данные: test.jsonl (Alpaca формат), путь к GGUF модели (через llama-cpp-python). Метрики: exact_match (JSON сравнение после parse), structural_error_rate (JSONDecodeError / total), field_accuracy (per-field сравнение для известных полей схемы). Сравни с baseline: те же тесты на базовой модели без fine-tuning. Вывод: таблица baseline vs fine-tuned по каждой метрике + delta. Сохрани результаты в `eval_results.json`.»

Формула: конкретные метрики + сравнение с baseline + формат вывода.

---

## Чеклист архитектора

### Перед стартом
- [ ] Prompt engineering и JSON Schema уже исчерпаны — fine-tuning обоснован
- [ ] RAG рассмотрен и отклонён с обоснованием
- [ ] Задача чётко сформулирована: что модель должна делать иначе

### Dataset
- [ ] Минимум 200 примеров для простых задач, 500+ для structured extraction
- [ ] Примеры верифицированы вручную на выборке ≥ 10%
- [ ] Split по source_id, не по random — нет leakage
- [ ] Null/edge cases представлены пропорционально реальным данным
- [ ] Датасет проверен на дубликаты между train и test

### Hardware / VRAM
- [ ] VRAM оценён: модель + адаптер + активации + optimizer states
- [ ] GTX 1660 6 ГБ → QLoRA, fp16, batch_size=1, gradient_checkpointing
- [ ] max_seq_length ограничен реальным максимумом входных данных

### Обучение
- [ ] r=16, alpha=16 — стартовые гиперпараметры, меняются только по данным eval_loss
- [ ] Early stopping настроен по eval_loss
- [ ] Checkpoint каждые 50–100 шагов
- [ ] Loss кривые проверены: train и eval loss сходятся, нет nan

### Оценка и деплой
- [ ] Task-specific метрики на test set (не только eval_loss)
- [ ] Сравнение с baseline измерено количественно
- [ ] Деплой: merged GGUF q4_k_m, не raw адаптер
- [ ] Модель протестирована на out-of-distribution примерах

---

*Модуль 13 завершён.*
*Следующий: [Модуль 14 — OOXML: raw XML внутри DOCX](../14-ooxml/README.md)*
