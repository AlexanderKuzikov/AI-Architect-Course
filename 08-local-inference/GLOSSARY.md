# Глоссарий — Local Inference (LM Studio / Ollama)

---

## B

**BOS / EOS (Begin/End Of Sequence)**
Специальные токены начала и конца последовательности — часть chat template.
BOS добавляется в начало каждого промпта, EOS — сигнализирует модели остановить генерацию.
Если inference backend не добавляет BOS автоматически или добавляет дважды —
поведение модели деградирует. Проверяется через `--verbose` флаг llama.cpp.

## C

**Chat Template**
Шаблон форматирования диалога, встроенный в токенизатор модели (`tokenizer_config.json`).
Определяет специальные токены ролей (`<|im_start|>`, `[INST]`, `<|user|>` и др.).
Критично: разные inference backend (LM Studio, Ollama, llama.cpp напрямую) могут применять
chat template одной модели по-разному — поведение не гарантировано идентичным.

**Constrained Decoding**
Генерация токенов с ограничением по грамматике или схеме. В llama.cpp реализуется
через grammar sampling (GBNF). Применяется ко всему выводу включая `<think>` блоки —
несовместим с thinking в текущей реализации. При json_schema — активируется через
`response_format` в `/v1/chat/completions`.

**Context Length (n_ctx)**
Максимальный размер KV-cache в токенах — ограничивает длину обрабатываемой последовательности.
Устанавливается при загрузке модели, не при запросе. При запросе длиннее n_ctx —
oldest токены вытесняются (sliding window) или запрос отклоняется.
Потребление VRAM растёт линейно с n_ctx: удвоение контекста ≈ +20-30% VRAM.

**CPU Offload**
Автоматический перенос части слоёв модели или KV-cache на CPU при нехватке VRAM.
Происходит без предупреждений. Симптом: TPS падает в 5–10x.
Диагностика: `verbose=True` при загрузке, `lms log stream -s runtime` в LM Studio.

## D

**Decode Phase**
Вторая фаза инференса: авторегрессионная генерация токенов по одному.
Скорость — TPS (tokens per second), определяется memory bandwidth GPU.
На consumer GPU decode-фаза ограничена bandwidth, не FLOPS —
поэтому ускорение от квантизации весомее, чем от более быстрого GPU по TFLOPS.

## F

**Flash Attention**
Оптимизированная реализация механизма attention: IO-aware алгоритм,
снижающий потребление VRAM и ускоряющий prefill-фазу.
В llama.cpp включается флагом `-fa` / `--flash-attn`.
Поддерживается не всеми архитектурами моделей и не всеми версиями CUDA/Metal.
Даёт наибольший эффект при длинных контекстах (>8K токенов).
На Turing GPU (GTX 1660) эффект меньше чем на Ampere/Ada.

**FSM (Finite State Machine)**
Конечный автомат, используемый в Outlines для токен-уровневой валидации схемы.
Инициализируется один раз (~100–500ms), переиспользуется для последующих запросов.

## G

**GBNF (GGML BNF)**
Формат грамматики в llama.cpp для constrained decoding.
Генерируется автоматически из JSON Schema. Не поддерживает все ключевые слова
Draft 2019-09/2020-12. Unicode в enum значениях может генерировать неожиданные правила —
проверяй через `LlamaGrammar._from_json_schema_str`.

**GGUF (GGML Unified Format)**
Бинарный формат хранения весов модели для llama.cpp и совместимых backend.
Содержит веса, метаданные модели, chat template и токенизатор в одном файле.
Заменил устаревший GGML/GGMF/GGJT форматы. Стандарт для распространения
квантизированных моделей на HuggingFace (llama.cpp экосистема).

**GPU Offloading (n_gpu_layers)**
Параметр llama.cpp: количество слоёв трансформера, загруженных в VRAM.
`-ngl -1` или `--n-gpu-layers 999` — загрузить всё что помещается.
Слои сверх VRAM остаются в RAM и обрабатываются CPU — резко снижая TPS.
Правило: частичный offload с CPU fallback даёт ~5-20x меньше TPS чем полный GPU.
Для GTX 1660 6 Гб: compact Q4_K_M model может помещаться полностью, local-mid model — часто частично.

**GQA (Grouped Query Attention)**
Архитектурная оптимизация: `n_kv_heads < n_heads`. Снижает размер KV-cache
пропорционально соотношению голов. Стандартная формула расчёта VRAM завышает
KV-cache для GQA моделей. Используется в современных decoder-only моделях.

## H

**Headless Daemon**
Серверный процесс без GUI. В контексте LM Studio 0.4.x — `llmster`,
устанавливаемый отдельно от GUI через `curl -fsSL https://lmstudio.ai/install.sh | bash`.
Позволяет использовать LM Studio в server-side окружении без графического интерфейса.

## I

**Inference Backend**
Программный стек, выполняющий forward pass модели: llama.cpp, vLLM, ExLlamaV2, MLC LLM.
LM Studio и Ollama — надстройки над llama.cpp (преимущественно).
Поведение модели на одном backend не гарантирует идентичное поведение на другом —
различается применение chat template, обработка параметров, KV-cache стратегия.

## K

**keep_alive**
Параметр Ollama, определяющий время жизни модели в памяти после последнего запроса.
Дефолт: `5m`. Для batch pipeline — `-1` (держать всегда).
При паузе между запросами > keep_alive: выгрузка + повторная загрузка ~10–30 сек overhead.

**KV-Cache**
Кэш key-value пар attention механизма для уже обработанных токенов.
Позволяет не пересчитывать attention для prefix промпта при каждом запросе.
В llama.cpp: `--cache-prompt` включает переиспользование KV-cache между запросами с общим prefix.
Размер: `2 × n_layers × n_kv_heads × head_dim × n_ctx × bytes_per_element`.
Flash Attention снижает пиковое потребление памяти KV-cache во время prefill.

**K-Quant (K-Quantization)**
Алгоритм квантизации llama.cpp с mixed precision: критичные слои (attention,
первый/последний) сохраняются в более высокой точности.
`Q4_K_M`, `Q3_K_M` — примеры K-quant. Суффикс `_M` — Medium (баланс качество/размер).

## L

**llama.cpp**
C++ inference библиотека — основа большинства локальных LLM backend.
Реализует GGUF загрузку, grammar sampling, CUDA/Metal/Vulkan ускорение,
квантизацию, Flash Attention, OpenAI-совместимый HTTP сервер (`llama-server`).
LM Studio и Ollama используют llama.cpp как inference engine.

**LM Studio**
GUI-приложение и headless inference сервер для локальных LLM.
Версия 0.4.x: добавлен `llmster` daemon, поддержка OpenAI Responses API (`/v1/responses`)
и Anthropic API (`/v1/messages`). Собственные extension параметры поверх OpenAI API
(`reasoning_effort`, `chat_template_kwargs`).

**llmster**
Headless inference daemon LM Studio 0.4.x. Позволяет использовать LM Studio
без GUI в server-side окружении. Управляется через `lms` CLI.

**lms CLI**
Командная строка LM Studio 0.4.x. Основные команды:
`load`, `unload`, `ps`, `server start`, `runtime survey`, `log stream`, `chat`.

## M

**mmproj**
Дополнительный файл vision проекции для мультимодальных моделей.
Причина возможной несовместимости GGUF/VLM с Ollama:
Ollama не поддерживает split weights с отдельным mmproj файлом.

**Modelfile**
Конфигурационный файл Ollama: декларативное описание модели.
Содержит базовую модель (`FROM`), system prompt (`SYSTEM`), параметры (`PARAMETER`),
кастомный chat template (`TEMPLATE`). Аналог Dockerfile для LLM.

```

FROM current-local-model
SYSTEM "Ты экстрактор данных. Возвращаешь только JSON."
PARAMETER temperature 0.1
PARAMETER num_ctx 8192

```

## N

**no_think / think**
Теги `/no_think` и `/think` в начале user message для управления reasoning
у совместимых reasoning-capable моделей.
Работают на уровне chat template токенизации — наиболее надёжный способ управления.
API параметры (`reasoning_effort`) могут игнорироваться если модель их не поддерживает.

**num_predict / max_tokens**
Максимальное количество генерируемых токенов за один запрос.
В Ollama: `num_predict`. В llama.cpp / OpenAI API: `max_tokens`.
Всегда устанавливай явно: без ограничения модель может генерировать до EOS или n_ctx —
что приводит к runaway generation при сбое grammar или неправильном промпте.

## O

**Ollama**
CLI-first инструмент для локального запуска LLM с OpenAI-совместимым REST API.
Управляет загрузкой/выгрузкой моделей, хранит их в `~/.ollama/models`.
Использует llama.cpp как backend. Modelfile — механизм конфигурации.
В отличие от LM Studio: headless-режим, легче интегрируется в Docker и CI.
GGUF/VLM может быть несовместим с Ollama из-за split weights, vision projector или неподдерживаемого tokenizer.

**OpenAI-Compatible API**
HTTP API, реализующий эндпоинты `/v1/chat/completions`, `/v1/completions`, `/v1/models`
с форматом совместимым с OpenAI. Реализован в llama-server, LM Studio, Ollama, vLLM.
«Совместимость» неполная: extension параметры, streaming behavior, error codes
различаются между провайдерами. Проверяй конкретные параметры перед использованием.

**Outlines**
Библиотека structured generation. Реализует токен-уровневые маски через FSM
поверх HuggingFace transformers или llama.cpp. Версия зависит от релиза; перед запуском проверять current package.
Поддерживает сложные схемы, regex, CFG. Overhead инициализации FSM ~100–500ms
на первый запрос, последующие — без задержки.

## P

**Perplexity (PPL)**
Метрика качества языковой модели: среднегеометрическое обратных вероятностей
предсказания токенов на тестовом корпусе. Ниже = лучше.
Используется для оценки деградации качества при квантизации:
Q8_0 ≈ fp16 по PPL, Q4_K_M — умеренная деградация (~1–3%), Q2_K — значительная.
PPL не коррелирует напрямую с качеством на конкретных задачах — измеряй на своём датасете.

**Prefill Phase**
Первая фаза инференса: параллельная обработка всего входного промпта.
Определяет TTFT (Time To First Token). Compute-bound: зависит от FLOPS GPU.
Длинный system prompt увеличивает TTFT, не TPS. KV-cache устраняет повторный prefill
для неизменного prefix между запросами.

**Prefix Caching**
Переиспользование KV-cache для одинакового префикса (system prompt) между запросами.
Снижает TTFT повторных запросов в 5–10x. Требует стабильный system prompt между запросами —
динамические данные помещай только в user message.

## Q

**Quantization**
Снижение точности представления весов модели для уменьшения размера и ускорения inference.
Основные форматы llama.cpp:

| Формат | Бит/вес | Потеря качества | Применение |
| :-- | :-- | :-- | :-- |
| Q8_0 | 8 | Минимальная | Максимальное качество, помещается в VRAM |
| Q4_K_M | 4 (mixed) | Умеренная (~1–3% PPL) | Оптимальный баланс качество/размер |
| Q3_K_M | 3 (mixed) | Заметная (~5–8% PPL) | Когда VRAM критически ограничен |
| Q2_K | 2 | Значительная | Только для экспериментов |

K_M (K-quantization, Medium) — смешанная точность: критичные слои в более высокой точности.

## R

**reasoning_effort**
Параметр LM Studio 0.4.x для управления глубиной reasoning.
Значения: `"none"`, `"low"`, `"medium"`, `"high"`. Передаётся через `extra_body` в OpenAI SDK.
Модели без встроенного reasoning шаблона игнорируют параметр без ошибок —
верифицируй через `usage.reasoning_tokens`.

**reasoning_tokens**
Поле `usage.reasoning_tokens` в ответе LM Studio 0.4.x.
Показывает количество токенов потраченных на thinking. `0` при `reasoning_effort: "none"`.
Основной способ верификации что thinking действительно отключён.

**repeat_penalty**
Параметр генерации: штраф за повторное использование уже сгенерированных токенов.
Значение > 1.0 снижает вероятность повторения. Рекомендуемый диапазон: 1.0–1.3.
При extraction с constrained decoding — обычно 1.0 (grammar уже ограничивает вывод).

**RoPE Scaling**
Техника масштабирования позиционных эмбеддингов для расширения контекстного окна
за пределы тренировочного максимума. Типы: linear, dynamic, YaRN.
YaRN — наиболее распространён для современных моделей.
При использовании n_ctx > тренировочного окна модели — деградация качества вероятна,
но контролируема через RoPE scaling. Проверяй метаданные GGUF файла.

## S

**Seed**
Начальное значение генератора случайных чисел для воспроизводимости вывода.
При фиксированном seed и temperature=0 — детерминированный результат на CPU.
На GPU детерминизм не гарантирован из-за нестабильности порядка floating point операций
при параллельных вычислениях. Полезен для отладки, не для production гарантий.

## T

**Thinking Tokens**
Токены внутренней цепочки рассуждений reasoning модели при локальном инференсе.
Управление через chat template: `/no_think` / `/think` в начале user message —
единственный надёжный способ для моделей с hardcoded chat template токенами.
Несовместимы с grammar sampling в текущей реализации llama.cpp.
Верификация — через `reasoning_tokens` в usage или парсинг `<think>` тегов из content.

**TTFT (Time To First Token)**
Задержка от отправки запроса до получения первого токена ответа.
Определяется prefill-фазой. Зависит от длины промпта и FLOPS GPU.
Для reasoning моделей с thinking — TTFT дополнительно включает время генерации
thinking-блока до начала финального ответа.
KV-cache устраняет повторный prefill общего prefix — снижает TTFT при повторных запросах.

**TPS (Tokens Per Second)**
Скорость генерации токенов в decode-фазе.
Определяется memory bandwidth GPU, не FLOPS. На GTX 1660 (192 GB/s):
Compact Q4_K_M model ≈ 30–40 TPS при полном GPU offload; Q8_0 compact model ≈ 15–20 TPS.
CPU fallback (частичный offload) даёт 5–10x падение TPS.

**Two-Pass Pipeline**
Архитектурный паттерн batch extraction: первый проход — быстрая обработка всего датасета
без thinking, второй проход — только объекты с низкой уверенностью или пустыми полями
с включённым thinking. Оптимальный баланс скорость/качество.

## V

**VRAM Budget**
Расчёт доступной видеопамяти для размещения модели и KV-cache.

```

VRAM_total = model_weights + kv_cache + overhead
model_weights = (params_billions × bits_per_weight) / 8 × 1.05  \# +5% overhead
kv_cache = 2 × n_layers × n_kv_heads × head_dim × n_ctx × bytes_per_element

# Пример: compact Q4_K_M model на GTX 1660 6 Гб

# model_weights ≈ params × 4 / 8 × 1.05

# kv_cache (n_ctx=4096) ≈ 0.5 Гб

# overhead ≈ 0.4 Гб

# Итого ≈ 4.6 Гб → помещается

```

**vLLM**
Production inference сервер с PagedAttention — эффективное управление KV-cache памятью.
Оптимален для multi-user, высоконагруженных сценариев. Требует NVIDIA GPU с CUDA.
В отличие от llama.cpp: нет GGUF поддержки (только HuggingFace форматы),
нет CPU fallback, требует значительно больше VRAM для serving.

---

## E

**Edge Inference**  
Запуск модели на устройстве пользователя или edge hardware: CPU, NPU, browser/WebGPU или локальный server. Обычно требует smaller models и строгого quality routing.

---

## S

**SLM (Small Language Model)**  
Малая языковая модель, обычно 1B–8B параметров. Используется для routing, classification, pre-screening и простых extraction-задач, где важны privacy, latency и cost.

---

## W

**WebGPU Inference**  
Запуск ML-модели прямо в браузере через WebGPU. Подходит для локальных задач, но требует проверки совместимости модели, browser support и memory budget.

