# Модуль 10 — Prompt Engineering (VLM)

> **Для AI-архитектора:** VLM — это не «LLM с картинкой».
> Это другая модальность с другой механикой токенизации, другими провалами и другими паттернами промптинга.
> Один день изучения — от visual token budget и dynamic resolution до
> document extraction, grounding и production-ready мультимодальных pipeline.

---

## Содержание

1. [Как VLM видит изображение — механика visual tokens](#1-как-vlm-видит-изображение--механика-visual-tokens)
2. [Dynamic Resolution — управление токен-бюджетом](#2-dynamic-resolution--управление-токен-бюджетом)
3. [Промптинг для VLM — отличия от text-only LLM](#3-промптинг-для-vlm--отличия-от-text-only-llm)
4. [Document Understanding — OCR, таблицы, формы](#4-document-understanding--ocr-таблицы-формы)
   - [Document Intelligence 2026: MarkItDown + VLM + OCR](#document-intelligence-2026-markitdown--vlm--ocr)
5. [Grounding и локализация объектов](#5-grounding-и-локализация-объектов)
6. [Multi-image и видео](#6-multi-image-и-видео)
7. [Production pipeline — выбор backend](#7-production-pipeline--выбор-backend)
8. [Реальный кейс](#реальный-кейс)
9. [Антипаттерны](#антипаттерны)

---

## Актуальный VLM-стек и модельная свежесть

VLM-модели, vision encoder, projector, context length и reasoning режимы меняются быстрее, чем успевают обновляться учебные таблицы. Поэтому в этом модуле нет статичного leaderboard. Перед использованием нужно проверить:

- LMArena / Vision Arena / независимые evals — качество на похожих задачах;
- Hugging Face / Ollama / LM Studio — доступность модели, projector, tokenizer и license;
- backend support — GGUF/VLM, chat template, dynamic resolution, grounding;
- hardware envelope — VRAM/RAM, n_ctx, visual tokens, batch size;
- cost/latency — cloud vs local vs hybrid.

### Model freshness policy

```text
Не писать: "конкретный model name из старого leaderboard — актуальный топ"
Писать: "перед запуском проверить текущую VLM-модель в LMArena/HF/Ollama/LM Studio"
```

В примерах используются плейсхолдеры:

- `CURRENT_VLM_MODEL` — текущая VLM-модель, выбранная после проверки;
- `LOCAL_VLM_MODEL` — текущая локальная GGUF/VLM-модель;
- `CLOUD_VLM_MODEL` — текущая cloud VLM/reasoning model.

### Ключевые архитектурные отличия современных VLM

| Компонент | Механика |
|:--|:--|
| Vision encoder | image/video → visual tokens; архитектура зависит от модели |
| Fusion | early/late/interleaved fusion; влияет на grounding и hallucination |
| Positional | multimodal positional embeddings: text/image/video axes |
| Attention | long-context attention patterns; проверяются на visual token budget |
| Context | visual tokens конкурируют с text tokens за n_ctx |
| Reasoning | reasoning mode может помогать, но увеличивает latency и может ломать schema |

### Инструменты

| Инструмент | Статус | Примечание |
|:--|:--|:--|
| LM Studio | текущий stable | GGUF/VLM support зависит от релиза |
| vLLM | текущий stable | Production serving; support model/backend нужно проверять |
| transformers | текущий stable | Processor/model compatibility зависит от выбранной VLM |
| OCR / layout parsers | текущий stable | pytesseract, MarkItDown, layout models — проверять по задаче |

## 1. Как VLM видит изображение — механика visual tokens

### Vision Encoder → visual tokens

VLM не «видит» изображение. Он получает последовательность visual tokens,
сгенерированных vision encoder из пикселей. В CURRENT_VLM_MODEL это vision encoder текущей VLM —
иерархический encoder с несколькими масштабами:

```

Изображение
│
▼
vision encoder текущей VLM (иерархический — несколько масштабов)
│  patch embedding: изображение → патчи P×P пикселей
│  каждый патч → вектор (visual token)
│  иерархия: крупные патчи → контекст, мелкие → детали
▼
Проекция (MLP cross-attention)
│  visual tokens → пространство LLM эмбеддингов
▼
LLM backbone (attention backbone текущей VLM)
│  visual tokens + text tokens → единая последовательность
│  long-context attention текущей VLM: O(n) для длинных последовательностей
▼
Ответ

```

Ключевое число: **количество visual tokens зависит от разрешения**.
Для конкретной VLM patch size нужно проверять в processor config:

```

tokens = (width / 32) × (height / 32)

Примеры:
256×256   →   64 tokens   (8×8 патчей)
512×512   →  256 tokens   (16×16 патчей)
1024×1024 → 1024 tokens   (32×32 патчей)
2048×2048 → 4096 tokens   (64×64 патчей)

```

Это токены контекста — они конкурируют с text tokens за n\_ctx.
Изображение 2048×2048 = 4096 visual tokens ≈ ~3000 слов текста.

### multimodal positional embeddings — позиционные эмбеддинги

Многие современные VLM используют multimodal positional embeddings с осями для текста/изображения/видео:

```

Text tokens:   позиция в последовательности [0, 1, 2, ...]
Image tokens:  2D координаты (row, col) патча
Video tokens:  3D координаты (frame, row, col)

Следствие для промптинга:
✅ Модель понимает пространственное расположение объектов
✅ "Левый верхний угол" — реальная позиционная информация, не метафора
✅ Bounding box запросы работают точно
✅ Видео обрабатывается нативно без внешнего frame sampler

```

### Early Fusion — почему CURRENT_VLM_MODEL иначе чем предшественники

Предыдущие поколения: vision encoder обучается отдельно, затем стыкуется с LLM.
CURRENT_VLM_MODEL: мультимодальные токены присутствуют с первого шага обучения — нет
швов между текстовым и визуальным пониманием.

```

❌ Late fusion (старый подход):
Vision Encoder (pretrained) → проекция → LLM (pretrained)
Стык — источник галлюцинаций на нестандартных изображениях

✅ Early fusion (CURRENT_VLM_MODEL):
Обучение на смешанных мультимодальных данных с нуля
Модель не «переводит» картинку в текст — понимает нативно

```

**Практический вывод для архитектора:** visual tokens — это конкретное
количество токенов из n\_ctx бюджета. При batch обработке документов
фиксируй `max_pixels`, иначе разные размеры изображений дадут
непредсказуемое потребление контекста и OOM на первом высокоразрешённом скане.

### Граничные случаи — где ломается

```python
# Padding при batch inference — visual tokens выравниваются до максимального
# Batch из 4 изображений разного размера:
# img1: 256 tokens, img2: 1024 tokens, img3: 512 tokens, img4: 256 tokens
# После padding все 4 → 1024 tokens
# VRAM: 4 × 1024 = 4096 visual tokens в batch

# ✅ Для batch extraction: стандартизируй размер до подачи в batch
# resize всё к одному разрешению через letterbox

# Aspect ratio distortion → деградация OCR
# Stretch изображения к квадрату ломает читаемость текста
# ✅ Всегда letterbox resize

from PIL import Image

def letterbox_resize(img: Image.Image, target_size: int) -> Image.Image:
    w, h = img.size
    scale = target_size / max(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    result = Image.new("RGB", (target_size, target_size), (255, 255, 255))
    result.paste(resized, ((target_size - new_w) // 2, (target_size - new_h) // 2))
    return result
```

**Почему это важно архитектору:** aspect ratio distortion — первая причина
плохого OCR при document extraction. Не модель плохая — входные данные неправильные.

---

## 2. Dynamic Resolution — управление токен-бюджетом

### Механика dynamic resolution в CURRENT_VLM_MODEL

CURRENT_VLM_MODEL принимает произвольные разрешения — нет фиксированного resize до
стандартного размера. Модель динамически нарезает на патчи и обрабатывает
иерархически через vision encoder текущей VLM:

```python
from transformers import AutoProcessor

# ❌ Дефолт — нативное разрешение без ограничений
processor = AutoProcessor.from_pretrained("os.environ.get("CURRENT_VLM_MODEL", "current-vlm")")
# A4 скан 2480×3508 → (2480/32) × (3508/32) ≈ 77 × 109 = 8393 visual tokens
# При n_ctx=8192 — не помещается вместе с текстом

# ✅ Явное ограничение через min_pixels / max_pixels
min_pixels = 256 * 32 * 32    # 256 tokens минимум
max_pixels = 1280 * 32 * 32   # 1280 tokens максимум

processor = AutoProcessor.from_pretrained(
    "os.environ.get("CURRENT_VLM_MODEL", "current-vlm")",
    min_pixels=min_pixels,
    max_pixels=max_pixels,
)
# A4 скан → автоматически resize до ~1280 visual tokens
```


### Калькуляция токен-бюджета

```python
def calculate_visual_tokens(
    img_width: int,
    img_height: int,
    patch_size: int = 32,
    max_pixels: int = 1280 * 32 * 32,
) -> dict:
    current_pixels = img_width * img_height
    if current_pixels > max_pixels:
        scale = (max_pixels / current_pixels) ** 0.5
        img_width = (int(img_width * scale) // patch_size) * patch_size
        img_height = (int(img_height * scale) // patch_size) * patch_size

    tokens = (img_width // patch_size) * (img_height // patch_size)
    return {
        "visual_tokens": tokens,
        "resized_width": img_width,
        "resized_height": img_height,
        "fits_8k_context": tokens < 6000,  # запас на текст + output
    }

# Планирование n_ctx для extraction pipeline:
# n_ctx = visual_tokens + system_prompt_tokens + user_text_tokens + output_tokens
# Типичный A4:  1280 + 200 + 100 + 512 = ~2092 → n_ctx=4096 достаточно
# Сложная форма: 2560 + 300 + 200 + 1024 = ~4084 → n_ctx=8192

# Примеры:
print(calculate_visual_tokens(2480, 3508))  # A4 300dpi → ~1120 tokens
print(calculate_visual_tokens(1920, 1080))  # FullHD    → ~800 tokens
print(calculate_visual_tokens(800, 600))    # Scan low  → ~468 tokens
```


### Стратегии для высококачественного OCR

```python
# Стратегия 1: Высокое разрешение — для мелкого шрифта
high_res_processor = AutoProcessor.from_pretrained(
    "os.environ.get("CURRENT_VLM_MODEL", "current-vlm")",
    min_pixels=1024 * 32 * 32,
    max_pixels=4096 * 32 * 32,   # до 4096 tokens
)
# Требует n_ctx=16K+, медленнее

# Стратегия 2: Tile processing — нарезка документа на фрагменты
def tile_document(img: Image.Image, tiles: int = 4) -> list[Image.Image]:
    w, h = img.size
    tile_h = h // tiles
    return [
        img.crop((0, i * tile_h, w, min((i + 1) * tile_h, h)))
        for i in range(tiles)
    ]
# Каждый тайл — отдельный extraction запрос с высоким разрешением
# Результаты объединяются в post-processing

# Стратегия 3: Two-pass — grounding низким разрешением, extraction высоким
# Stage 1: найти регион интереса (512 tokens, быстро)
# Stage 2: crop + extraction высоким разрешением (только нужная область)
```

**Практический вывод для архитектора:** для production document pipeline
`max_pixels` фиксируется в конфигурации явно — не дефолт. Стратегия выбирается
по DPI входных документов: низкий DPI → high res или tile,
высокий DPI с крупным шрифтом → стандартный max\_pixels достаточен.

### Граничные случаи — где ломается

```python
# Слишком мало visual tokens → галлюцинации на мелком шрифте
# CURRENT_VLM_MODEL с min_pixels=256 для документа 8pt → модель «домысливает» текст
# Симптом: уверенный ответ с неверными данными

# Правило: для OCR качества нужно ~1-2 visual tokens на символ
# Строка 80 символов, A4 ширина → минимум 80-160 tokens на строку
# ✅ Для full-page OCR: min max_pixels = 2048*32*32, tile strategy

# OOM при смешанном batch
# batch = [маленькое изображение 256 tokens, большое 4096 tokens]
# padding → всё выравнивается до 4096 → VRAM × batch_size
# ✅ Группируй изображения схожего размера в один batch
```

**Почему это важно архитектору:** visual token budget — прямой trade-off
качество OCR / скорость / VRAM. Нет универсального оптимума —
зависит от DPI и размера шрифта входных документов.

---

## 3. Промптинг для VLM — отличия от text-only LLM

### Структура мультимодального сообщения

```python
# Правильный порядок: изображение ПЕРЕД текстовым запросом
messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image",
                "image": "file:///path/to/document.jpg",
                "min_pixels": 512 * 32 * 32,
                "max_pixels": 2048 * 32 * 32,
            },
            {
                "type": "text",
                "text": "/no_think\nИзвлеки из документа: название организации, адрес, ИНН.",
            },
        ],
    }
]

# ❌ Изображение после текста — допустимо, но снижает quality
# Модель строит attention к изображению после обработки запроса
# ✅ Изображение первым — модель читает контекст до формулировки запроса

# Управление reasoning для VLM задач:
# /think    — активирует chain-of-thought (медленнее, лучше для сложных сцен)
# /no_think — отключает reasoning (быстрее, достаточно для structured extraction)
```


### Специфика system prompt

```python
SYSTEM_PROMPT = """Ты экстрактор структурированных данных из документов.

Правила:
- Извлекай только то что явно присутствует на изображении
- Если поле не найдено — возвращай null, не додумывай
- Текст воспроизводи точно как написано, без исправления опечаток
- Для таблиц: сохраняй структуру строк и столбцов
- Возвращай только JSON без markdown блоков и пояснений"""

# Ключевые отличия от text-only промпта:
# 1. "явно присутствует на изображении" — якорь к визуальному контенту
# 2. "без исправления опечаток" — VLM склонны к autocorrect
# 3. "без markdown блоков" — JSON без ```json``` обёртки
# 4. /no_think в user message — отключить reasoning для extraction
```


### Техники промптинга специфичные для VLM

```python
# Техника 1: Spatial anchoring — пространственные референсы работают буквально
# M-RoPE даёт 2D координаты каждому патчу — "верхний правый" это реальная позиция
"Извлеки данные из таблицы в верхней правой части документа"
"Найди реквизиты в нижней части страницы под основным текстом"

# Техника 2: Visual chain-of-thought (только с /think)
"Сначала опиши структуру документа (1-2 предложения), затем извлеки данные в JSON"
# Промежуточное описание снижает галлюцинации на сложных layouts

# Техника 3: Confidence anchoring
"Для каждого поля добавь 'confidence': 'high'/'medium'/'low'
в зависимости от читаемости на изображении"
# Позволяет фильтровать ненадёжные extractions в downstream

# Техника 4: Region focus — для документов со сложной структурой
"На документе есть печать организации в левом нижнем углу или рядом с подписью.
Извлеки из неё: название, ИНН, ОГРН"

# ❌ Для extraction: длинный промпт с рассуждениями + /think
# Медленно, reasoning не добавляет точности для structured extraction
# ✅ Для extraction: короткий промпт + spatial anchors + /no_think
```


### Thinking mode — когда включать для VLM

```
/no_think (default для extraction):
  ✅ Structured extraction (JSON, таблицы, поля форм)
  ✅ OCR задачи — точный текст с изображения
  ✅ Простая классификация изображений
  ✅ Скорость критична, batch processing

/think (для сложных задач):
  ✅ Анализ сложных схем, диаграмм, чертежей
  ✅ Интерпретация графиков с рассуждением
  ✅ Multi-step visual reasoning
  ✅ Документы с неоднозначной структурой
```

**Практический вывод для архитектора:** для document extraction pipeline —
всегда `/no_think`. Reasoning в VLM context = дополнительные токены
в которых модель может «убедить себя» изменить правильный ответ.

### Граничные случаи — где ломается

```python
# VLM autocorrect — модель исправляет то что видит
# Оригинал: "ООО «Ромашкa»" (латинская 'a' — опечатка в документе)
# VLM вернёт: "ООО «Ромашка»" (исправленная кириллица)
# В юридических документах — изменение текста, критичная ошибка

# ✅ Явная инструкция:
"Воспроизводи текст точно как написано, включая опечатки и нестандартные символы.
Не исправляй ошибки. Если символ неразличим — используй [?]"

# Low contrast + watermarks → галлюцинации
# ✅ Pre-processing: enhance contrast
from PIL import ImageEnhance
enhanced = ImageEnhance.Contrast(img).enhance(1.5)

# Reasoning loop при /think на простых задачах
# Модель начинает сомневаться в очевидном ответе
# Симптом: длинный thinking block, результат хуже чем без think
# ✅ Для extraction: /no_think без исключений
```

**Почему это важно архитектору:** autocorrect — специфичный для VLM артефакт,
в text-only LLM его нет. Обнаруживается только при сравнении с ground truth.

---

## 4. Document Understanding — OCR, таблицы, формы

### Structured extraction — полный pipeline

```python
from transformers import AutoModelForCausalLM, AutoProcessor
from pydantic import BaseModel
from typing import Optional
import torch
import json

class DocumentRecord(BaseModel):
    organization_name: str
    inn: Optional[str] = None
    ogrn: Optional[str] = None
    address: Optional[str] = None
    director: Optional[str] = None
    confidence: dict[str, str] = {}  # поле → "high"/"medium"/"low"

model = AutoModelForCausalLM.from_pretrained(
    "os.environ.get("CURRENT_VLM_MODEL", "current-vlm")",
    torch_dtype=torch.float16,
    device_map="cuda",
)
processor = AutoProcessor.from_pretrained(
    "os.environ.get("CURRENT_VLM_MODEL", "current-vlm")",
    min_pixels=512 * 32 * 32,
    max_pixels=2048 * 32 * 32,
)

schema_str = json.dumps(DocumentRecord.model_json_schema(), ensure_ascii=False)

messages = [
    {
        "role": "system",
        "content": f"""Извлеки данные из документа. Возвращай только JSON по схеме:
{schema_str}
Только явные данные, null если отсутствует, без markdown.""",
    },
    {
        "role": "user",
        "content": [
            {
                "type": "image",
                "image": "file:///path/to/doc.jpg",
                "min_pixels": 512 * 32 * 32,
                "max_pixels": 2048 * 32 * 32,
            },
            {"type": "text", "text": "/no_think\nИзвлеки реквизиты организации."},
        ],
    },
]

text = processor.apply_chat_template(
    messages, tokenize=False, add_generation_prompt=True
)
inputs = processor(text=[text], images=[...], return_tensors="pt").to("cuda")

with torch.no_grad():
    generated_ids = model.generate(
        **inputs,
        max_new_tokens=512,
        temperature=0.0,
        do_sample=False,
    )

output = processor.batch_decode(
    [generated_ids[inputs.input_ids.shape:]],
    skip_special_tokens=True,
)

record = DocumentRecord.model_validate_json(output)
```


### API через LM Studio 0.4.8

```python
# Для production: OpenAI-compatible API, без transformers overhead
import base64
from pathlib import Path
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio",
    timeout=120.0,
)

async def extract_document(image_path: str) -> dict | None:
    img_b64 = base64.b64encode(Path(image_path).read_bytes()).decode()
    try:
        response = await client.chat.completions.create(
            model="lmstudio-community/CURRENT_VLM_MODEL-GGUF",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_b64}",
                                "detail": "high",  # ≈ max_pixels high res
                            },
                        },
                        {"type": "text", "text": "/no_think\nИзвлеки реквизиты."},
                    ],
                },
            ],
            max_tokens=512,
            temperature=0.0,
            extra_body={
                "chat_template_kwargs": {"enable_thinking": False},
            },
        )
        return json.loads(response.choices.message.content)
    except Exception:
        return None
```


### Таблицы — специфика промптинга

```python
TABLE_SYSTEM = """Ты экстрактор данных из таблиц.

При работе с таблицей:
1. Определи заголовки (первая строка или первый столбец)
2. Для каждой строки данных создай отдельный объект
3. Используй заголовки как ключи JSON
4. Объединённые ячейки: дублируй значение для каждой строки/столбца

Возвращай: {"headers": [...], "rows": [{...}, ...]}"""
```

**Практический вывод для архитектора:** `detail: "high"` в LM Studio API
соответствует высокому разрешению — используй для OCR критичных документов.
`detail: "low"` — для pre-screening и классификации где детализация не нужна.

### Граничные случаи — где ломается

```python
# Ротированные документы — critical failure
# Документ под углом 90° → текст читается как столбцы, не строки
# CURRENT_VLM_MODEL не автоматически корректирует ориентацию

# ✅ Pre-processing: auto-rotate через pytesseract OSD
import pytesseract

def auto_rotate(img: Image.Image) -> tuple[Image.Image, int]:
    try:
        osd = pytesseract.image_to_osd(img, output_type=pytesseract.Output.DICT)
        angle = osd.get("rotate", 0)
        if angle != 0:
            return img.rotate(-angle, expand=True), angle
        return img, 0
    except Exception:
        return img, 0  # OSD failed — вернуть оригинал

# Многостраничный PDF как единое изображение
# ❌ render всего PDF в одно изображение — не работает
# ✅ постраничная обработка
from pdf2image import convert_from_path
pages = convert_from_path(pdf_path, dpi=150)
results = [await extract_document(page) for page in pages]
```

**Почему это важно архитектору:** ориентация документа — pre-processing шаг
который VLM не делает автоматически. Встречается на 5–10% реальных сканов.

### Document Intelligence 2026: MarkItDown + VLM + OCR

Document Intelligence — это уже не только OCR. Для production pipeline лучше думать в терминах **layout-aware extraction**:

```text
Document → layout/OCR → semantic parsing → structured JSON → validation
```

Ключевые компоненты:

- **OCR** для печатного текста;
- **VLM** для сложных layout, таблиц, форм, рукописных фрагментов;
- **MarkItDown / document parsers** для DOCX/XLSX/PDF → markdown/html;
- **layout model** для понимания блоков: header, table, footer, checkbox;
- **structured output** для финального JSON;
- **deterministic validation** для реквизитов, дат, ИНН, сумм.

Практический routing:

| Тип документа | Лучший путь |
|:--|:--|
| чистый печатный текст | OCR + text LLM |
| скан с таблицами | VLM + structured output |
| DOCX/XLSX | parser → markdown/table extraction |
| сложный PDF с формами | OCR + layout + VLM |
| низкое качество | preprocessing → VLM |

Главная ошибка — отправлять raw document сразу в VLM. Сначала нужны preprocessing, layout detection, token budget и понятный output schema.

---

## 5. Grounding и локализация объектов

### Bounding box extraction

CURRENT_VLM_MODEL возвращает bounding boxes в нормализованном формате [0, 1000]:

```python
# Промпт для grounding
messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "image": "file:///path/to/doc.jpg"},
            {
                "type": "text",
                "text": "/no_think\nНайди и верни bounding box печати организации. "
                        "JSON: {\"bbox\": [x1, y1, x2, y2]} "
                        "Координаты нормализованы от 0 до 1000.",
            },
        ],
    }
]

def denormalize_bbox(
    bbox: list[int],
    img_width: int,
    img_height: int,
) -> tuple[int, int, int, int]:
    return (
        int(bbox[0] / 1000 * img_width),
        int(bbox[1] / 1000 * img_height),
        int(bbox[2] / 1000 * img_width),
        int(bbox[3] / 1000 * img_height),
    )

def crop_region(img: Image.Image, bbox_norm: list[int], padding: int = 10) -> Image.Image:
    x1, y1, x2, y2 = denormalize_bbox(bbox_norm, img.width, img.height)
    return img.crop((
        max(0, x1 - padding), max(0, y1 - padding),
        min(img.width, x2 + padding), min(img.height, y2 + padding),
    ))
```


### Two-stage pipeline

```python
async def two_stage_extraction(
    doc_path: str,
    regions: list[str],  # ["печать", "подпись директора", "реквизиты"]
) -> dict:
    img = Image.open(doc_path)

    # Stage 1: grounding — низкое разрешение, быстро
    grounding = await vlm_call(
        image=img,
        prompt=f"/no_think\nНайди bounding boxes: {', '.join(regions)}. "
               f'JSON: {{"regions": [{{"name": str, "bbox": [x1,y1,x2,y2]}}]}}',
        detail="low",   # экономный режим
    )
    found_regions = parse_grounding(grounding)

    # Stage 2: extraction — crop + высокое разрешение точечно
    results = {}
    for region in found_regions:
        crop = crop_region(img, region["bbox"])
        results[region["name"]] = await vlm_call(
            image=crop,
            prompt=f"/no_think\nИзвлеки данные из: {region['name']}. JSON.",
            detail="high",
        )
    return results
```

**Практический вывод для архитектора:** two-stage — стандартный паттерн для
сложноструктурированных документов. Stage 1 дёшев (мало visual tokens),
Stage 2 применяется точечно только к найденным регионам.

---

## 6. Multi-image и видео

### Multi-image

```python
# Несколько изображений в одном запросе — страницы одного договора
messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "image": "file:///page1.jpg",
             "max_pixels": 1024 * 32 * 32},
            {"type": "image", "image": "file:///page2.jpg",
             "max_pixels": 1024 * 32 * 32},
            {"type": "image", "image": "file:///page3.jpg",
             "max_pixels": 1024 * 32 * 32},
            {
                "type": "text",
                "text": "/no_think\nЭто страницы одного договора. "
                        "Извлеки: стороны, предмет, срок, сумму.",
            },
        ],
    }
]
# Токен-бюджет: сумма visual tokens всех изображений
# 3 страницы × 1024 tokens = 3072 visual tokens
# n_ctx=8192: остаётся 5120 на text + output → достаточно
```


### Видео — нативная поддержка через Conv3d

```python
# CURRENT_VLM_MODEL обрабатывает видео нативно через video encoder текущей VLM
# Не нужен внешний frame sampler — модель сама управляет temporal attention

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "video",
                "video": "file:///recording.mp4",
                "fps": 1.0,                        # 1 кадр/сек для обзора
                "max_pixels": 512 * 32 * 32,       # low res для видео
                "max_frames": 64,                  # лимит кадров
            },
            {"type": "text", "text": "/no_think\nОпиши что происходит в видео."},
        ],
    }
]

# Расчёт video tokens:
# tokens = fps × duration_sec × tokens_per_frame
# 60 сек × fps=1 × 256 tokens = 15360 → не влезет в n_ctx=8192
# ✅ fps=0.5 или разбивать на сегменты для длинного видео

# Trade-offs fps для разных задач:
# fps=0.5  → обзор длинного видео (>2 мин), мало деталей
# fps=1.0  → стандартный баланс для большинства задач
# fps=2.0  → детальный анализ, короткие клипы (<30 сек)
# fps=8+   → только для коротких клипов с быстрыми событиями (<10 сек)
```


---

## 7. Production pipeline — выбор backend

### Матрица выбора backend

```
                    ┌────────────────────────────────────────────┐
                    │         VLM Backend Selection (2026)        │
                    └────────────────────────────────────────────┘

 GTX 1660 6 Гб           RTX 3090/4090 24 Гб        Multi-GPU / Cloud
      │                         │                          │
 CURRENT_VLM_MODEL Q4             CLOUD_VLM_MODEL mid           CLOUD_VLM_MODEL large
 LM Studio 0.4.8           LM Studio / vLLM          vLLM / NVIDIA NIM
 ~4-6 img/min              ~15-20 img/min            ~50+ img/min
 n_ctx до 16K              n_ctx до 32K              n_ctx до 262K

 Маленькие задачи          Рабочий вариант           Enterprise production
 CURRENT_SMALL_VLM / 2B / 0.8B   для команды               CLOUD_VLM_MODEL (vLLM only)
 для routing/pre-screen
```


### Routing по размеру модели — паттерн для GTX 1660

```python
from enum import Enum

class DocumentComplexity(Enum):
    SIMPLE = "simple"   # чистый текст, один блок реквизитов
    MEDIUM = "medium"   # таблицы, несколько блоков
    COMPLEX = "complex" # сложный layout, смешанный контент

# Pre-screening: маленькая модель классифицирует сложность
# Основная extraction: только на нужном размере
async def smart_extract(image_path: str) -> dict | None:
    # Stage 0: быстрая классификация сложности (CURRENT_EDGE_SLM)
    complexity = await classify_complexity(
        image_path,
        model="lmstudio-community/CURRENT_EDGE_SLM-GGUF",
    )

    # Stage 1: extraction по сложности
    model = {
        DocumentComplexity.SIMPLE:  "CURRENT_SMALL_VLM-GGUF",
        DocumentComplexity.MEDIUM:  "CURRENT_VLM_MODEL-GGUF",
        DocumentComplexity.COMPLEX: "CURRENT_VLM_MODEL-GGUF",  # max на GTX 1660
    }[complexity]

    return await extract_document(image_path, model=model)
```


### Async batch pipeline

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio",
    timeout=120.0,
)

async def batch_extract(
    paths: list[str],
    concurrency: int = 2,  # GTX 1660: максимум 2 для CURRENT_VLM_MODEL
) -> list[dict | None]:
    # Расчёт concurrency:
    # GTX 1660: 6 Гб - 5 Гб (модель Q4) - 0.5 Гб (overhead) = 0.5 Гб
    # KV-cache 1 VLM запроса (1280 visual + 300 text) ≈ 0.25 Гб
    # max_concurrency = 0.5 / 0.25 = 2

    semaphore = asyncio.Semaphore(concurrency)

    async def _extract(path: str) -> dict | None:
        async with semaphore:
            return await extract_document(path)

    return await asyncio.gather(*[_extract(p) for p in paths])
```

**Практический вывод для архитектора:** CURRENT_EDGE_SLM/2B/4B — не «слабые версии».
Это отдельные инструменты: 0.8B для routing и classification, 2B для простых
extraction, 4B для medium сложности. Все с Reasoning и Vision. Routing по
сложности снижает median latency в 2–3× при том же качестве на сложных кейсах.

### Граничные случаи — где ломается

```python
# CLOUD_VLM_MODEL vision через GGUF — не работает
# Vision поддерживается только через vLLM
# ❌ Попытка запустить K2.5 через llama.cpp с mmproj
# → vision недоступен, только text inference

# ✅ CLOUD_VLM_MODEL vision — только vLLM production setup:
# vllm serve os.environ[CLOUD_VLM_MODEL] \
#   --trust-remote-code \
#   --tensor-parallel-size 8 \
#   --gpu-memory-utilization 0.9

# Для локального VLM без multi-GPU — только CURRENT_VLM_MODEL

# Concurrency > 2 на GTX 1660 для 9B модели
# VRAM overflow → CPU fallback → TPS деградация ×10
# Симптом: первые запросы быстрые, следующие зависают
# ✅ Жёсткий semaphore, мониторинг GPU memory через nvidia-smi
```

**Почему это важно архитектору:** CLOUD_VLM_MODEL — лидер leaderboard, но
недоступен для локального VLM без серьёзного железа. CURRENT_VLM_MODEL —
не фиксировать линейку по памяти; выбирать текущую модель после проверки visual token budget
VLM на любом hardware.

---

## Реальный кейс

**Задача:** batch extraction реквизитов из ~2000 сканов судебных удостоверений.
**Стек:** GTX 1660 6 Гб, CURRENT_VLM_MODEL Q4\_K\_M, LM Studio 0.4.8, Python.

**Гипотеза:** VLM с detail=high даст лучший результат чем
pytesseract + text LLM для extraction из низкокачественных сканов.

**Что получилось:**

```
Pytesseract + text LLM:
  Скорость: ~8 docs/min
  Точность (чистые сканы):    91%
  Точность (низкое качество): 54%

CURRENT_VLM_MODEL, detail=high, concurrency=2:
  Скорость: ~4 docs/min
  Точность (чистые сканы):    95%
  Точность (низкое качество): 73%
  Точность (ротация без preprocessing): 38% ← хуже pytesseract
```

**Вывод, противоречащий интуиции:** VLM медленнее в 2× и хуже на ротированных
документах чем pytesseract — потому что pytesseract делает OSD автоматически,
а VLM нет. После добавления auto\_rotate в pre-processing:

```
CURRENT_VLM_MODEL + pre-processing pipeline:
  Скорость: ~5.5 docs/min
  Точность (все типы): 94%
```

**Итоговая архитектура — hybrid routing:**

- Pre-processing: auto\_rotate → contrast enhancement → letterbox resize
- Routing: SSIM quality score
    - высокое качество → pytesseract + text LLM (~8 docs/min)
    - низкое качество → CURRENT_VLM_MODEL detail=high (~4 docs/min)
- CURRENT_SMALL_VLM для pre-screening и классификации типа документа

Итог: 6.5 docs/min средняя скорость, 94% точность на всём датасете.

---

## Антипаттерны

**1. Нативное разрешение без max_pixels**

```python
# ❌ processor без max_pixels на production данных
processor = AutoProcessor.from_pretrained("os.environ.get("CURRENT_VLM_MODEL", "current-vlm")")
# A4 300dpi → OOM или деградация из-за превышения n_ctx

# ✅
processor = AutoProcessor.from_pretrained(
    "os.environ.get("CURRENT_VLM_MODEL", "current-vlm")",
    max_pixels=1280 * 32 * 32,
)
```

**2. /think для structured extraction**

```python
# ❌ Reasoning включён для простого extraction
messages[-1]["content"][-1]["text"] = "/think\nИзвлеки ИНН из документа."
# Reasoning добавляет токены в которых модель может изменить правильный ответ

# ✅ Extraction = /no_think без исключений
messages[-1]["content"][-1]["text"] = "/no_think\nИзвлеки ИНН из документа."
```

**3. VLM вместо pytesseract для простых задач**

```python
# ❌ CURRENT_VLM_MODEL для чистого печатного текста с высоким DPI
# VLM в 5-10× медленнее pytesseract без прироста качества

# ✅ VLM оправдан когда:
# — Низкое качество скана (SSIM < 0.7)
# — Сложный layout: таблицы, формы, смешанные блоки
# — Семантическая интерпретация (не только OCR)
# — Рукописный текст
```

**4. Игнорировать ориентацию документа**

```python
# ❌ Подавать сканы напрямую
results = [await extract(scan) for scan in scans]

# ✅ Pre-processing обязателен
def preprocess(path: str) -> Image.Image:
    img = Image.open(path).convert("RGB")
    img, _ = auto_rotate(img)
    img = ImageEnhance.Contrast(img).enhance(1.3)
    return letterbox_resize(img, 1024)
```

**5. CLOUD_VLM_MODEL через GGUF для vision задач**

```python
# ❌ Ожидать vision через llama.cpp / LM Studio для K2.5
# Vision support в GGUF зависит от модели/backend; для некоторых VLM нужен отдельный projector или vLLM

# ✅ CLOUD_VLM_MODEL vision — только vLLM с полной моделью
# Для локального VLM: CURRENT_VLM_MODEL линейка
```

**6. Один размер модели на все задачи**

```python
# ❌ CURRENT_VLM_MODEL для всех документов включая простые
# Waste: простой документ обрабатывается в 2× дольше чем нужно

# ✅ Routing: 0.8B/2B для классификации и простых задач,
# 4B для medium, 9B только для сложных кейсов
```


---

## Anti-checklist ☠️

- [ ] Нативное разрешение без `max_pixels` — A4 300dpi → OOM или превышение n_ctx
- [ ] `/think` для structured extraction — reasoning добавляет токены, в которых модель меняет правильный ответ
- [ ] VLM вместо pytesseract для чистого текста — в 5-10× медленнее без прироста качества
- [ ] Игнорировать ориентацию документа — ротированный скан ломает extraction
- [ ] Один размер модели на все задачи — 2B для routing, 9B только для сложных кейсов
- [ ] Изображение после текста в content — модель строит attention без визуального контекста

## Задачи AI-кодеру

**Задача 1 — Visual token calculator**

Плохая формулировка:
> «Напиши функцию для подсчёта токенов изображения»

Хорошая формулировка:
> «Напиши Python функцию `calculate_vl_budget(img_path: str, max_pixels: int, patch_size: int = 32) -> dict`,
> которая возвращает: `visual_tokens`, `resized_width`, `resized_height`, `original_width`, `original_height`, `fits_8k_context: bool`.
> Resize с сохранением aspect ratio, итоговые размеры кратны patch\_size.
> Зависимости: только Pillow. Python 3.12.»

---

**Задача 2 — Async batch extraction**

Плохая формулировка:
> «Сделай batch extraction через LM Studio»

Хорошая формулировка:
> «Напиши async Python функцию `batch_document_extraction(image_paths: list[str], schema: type[BaseModel], concurrency: int = 2) -> list[BaseModel | None]`.
> Backend: OpenAI-compatible API на localhost:1234 (LM Studio 0.4.8).
> Каждый запрос: base64 image\_url с detail="high", /no\_think в user message,
> `chat_template_kwargs: {"enable_thinking": false}` в extra\_body.
> JSON parse error или timeout → None для элемента, без исключения.
> Зависимости: openai>=1.0, Pillow, pydantic>=2.0. Python 3.12, только async.»

---

**Задача 3 — Pre-processing pipeline**

Плохая формулировка:
> «Напиши preprocessing для сканов»

Хорошая формулировка:
> «Напиши Python функцию `preprocess_document_scan(img_path: str, output_path: str) -> dict`.
> Шаги по порядку: 1) PIL open, convert RGB; 2) auto-rotate через pytesseract OSD,
> при исключении — пропустить без ошибки; 3) contrast enhance до 1.3;
> 4) letterbox resize до 1024×1024 с белым фоном.
> Вернуть dict: original\_size, output\_size, rotation\_applied (int), osd\_confidence (float или None).
> JPEG quality=95. Зависимости: Pillow, pytesseract. Python 3.12.»

---

## Чеклист архитектора

### Visual token budget

- [ ] `max_pixels` явно задан в конфигурации, не дефолт
- [ ] Токен-бюджет подсчитан для типичных документов датасета
- [ ] n\_ctx выставлен с запасом: visual + text + output < n\_ctx
- [ ] Batch: изображения одного размера или pack strategy


### Pre-processing

- [ ] Auto-rotate (OSD) перед подачей в VLM
- [ ] Contrast enhancement для низкокачественных сканов
- [ ] Letterbox resize без дистortion aspect ratio
- [ ] Конвертация в RGB (убрать CMYK, RGBA)


### Промптинг

- [ ] Изображение идёт перед текстовым запросом в content
- [ ] `/no_think` для extraction задач без исключений
- [ ] System prompt содержит явный запрет autocorrect
- [ ] Spatial anchors для документов со сложной структурой


### Production

- [ ] Concurrency рассчитан под VRAM бюджет (не дефолт)
- [ ] Routing по сложности: 0.8B/2B/4B/9B под задачу
- [ ] CLOUD_VLM_MODEL vision — только vLLM, не GGUF
- [ ] Two-stage pipeline для документов со сложной структурой
- [ ] Fallback на pytesseract для высококачественных сканов

---

*Модуль 10 завершён.*
*Следующий: [Модуль 11 — Multi-model Orchestration](../11-multi-model-orchestration/README.md)*
