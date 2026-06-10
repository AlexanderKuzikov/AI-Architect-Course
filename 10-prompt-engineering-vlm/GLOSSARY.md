# Глоссарий — Prompt Engineering (VLM)

---

## A

**Aspect Ratio Distortion**
Искажение пропорций изображения при resize к фиксированному размеру без letterbox.
Stretch к квадрату деформирует символы → деградация OCR качества.
Митигация: letterbox resize с белым padding.

**Auto-rotate**
Pre-processing шаг: определение ориентации документа через pytesseract OSD
и коррекция поворота перед подачей в VLM.
Отсутствие auto-rotate — причина деградации до 38% точности на ротированных сканах.

## B

**Batch Padding**
При batch inference visual tokens всех изображений выравниваются до максимального.
Batch из изображений разного размера → KV-cache = max_tokens × batch_size.
Митигация: группировка изображений схожего размера в один batch.

**Bounding Box (нормализованный)**
Координаты региона изображения в формате [x1, y1, x2, y2] от 0 до 1000.
Используется в grounding запросах к CURRENT_VLM_MODEL.
Конвертация в пиксели: `coord / 1000 × img_dimension`.

## C

**Confidence Anchoring**
Техника VLM промптинга: запрос у модели оценки читаемости каждого поля
(`"high"/"medium"/"low"`).
Позволяет фильтровать ненадёжные extractions в downstream и направлять на повторный запрос.

**Conv3d (DeepStack)**
Трёхмерная свёртка в vision encoder CURRENT_VLM_MODEL для нативной обработки видео.
Обрабатывает пространственные (H, W) и временные (T) измерения совместно.
Устраняет необходимость во внешнем frame sampler.

## D

**DeepStack ViT**
Иерархический Vision Transformer в CURRENT_VLM_MODEL.
Несколько масштабов: крупные патчи захватывают контекст, мелкие — детали.
Обеспечивает лучшее OCR качества на документах со смешанными размерами шрифтов.

**Detail Level**
Параметр OpenAI-compatible API для VLM: `"low"` / `"high"` / `"auto"`.
`"high"` ≈ max_pixels высокого разрешения — для OCR и сложных документов.
`"low"` ≈ экономный режим — для pre-screening и классификации.

**Dynamic Resolution**
Механика VLM принимающей изображения произвольного разрешения без фиксированного resize.
Количество visual tokens масштабируется с разрешением.
Управляется через `min_pixels` / `max_pixels` в конфигурации процессора.

## E

**Early Fusion**
Архитектурный подход: мультимодальные токены присутствуют с первого шага обучения.
Противоположность late fusion где vision encoder и LLM обучались отдельно.
В CURRENT_VLM_MODEL early fusion устраняет «шов» между визуальным и текстовым пониманием.

**enable_thinking**
Параметр в `chat_template_kwargs` для LM Studio / vLLM API.
`false` — эквивалент `/no_think` для управления reasoning через API.
Для extraction pipeline всегда `false`.

## F

**Frame Sampling**
Стратегия выбора кадров видео для подачи в VLM.
Параметр `fps` определяет частоту сэмплинга.
Формула токен-бюджета: `fps × duration_sec × tokens_per_frame`.

## G

**Gated DeltaNet**
Линейный attention механизм в CURRENT_VLM_MODEL (часть Hybrid Attention).
Сложность O(n) против O(n²) у стандартного attention.
Обеспечивает эффективную обработку длинных контекстов (262K+).

**Grounding**
Задача локализации объектов на изображении с возвратом bounding box координат.
В VLM pipeline используется как Stage 1 перед точечным extraction.
Выполняется при низком разрешении — дёшево по visual tokens.

## H

**Hybrid Attention**
Архитектура attention в CURRENT_VLM_MODEL: комбинация Gated DeltaNet (линейный) и Gated Attention (стандартный).
Линейный — для длинных последовательностей, стандартный — для задач требующих точного matching.
Позволяет одновременно обрабатывать длинный контекст и сложные визуальные паттерны.

## K

**CLOUD_VLM_MODEL**
Текущая cloud VLM/reasoning model, выбранная после проверки evals/backend/license.
Vision support зависит от backend: GGUF/llama.cpp может не поддерживать projector, vLLM может требовать отдельной конфигурации.

## L

**Late Fusion**
Архитектурный подход предшественников CURRENT_VLM_MODEL: vision encoder и LLM обучались раздельно,
затем стыковались через проекционный слой.
Источник галлюцинаций на нестандартных изображениях из-за несоответствия пространств.

**Letterbox Resize**
Resize изображения с сохранением aspect ratio и добавлением padding до целевого размера.
Стандартный pre-processing для VLM: предотвращает distortion символов.
Padding цвет для документов: белый (255, 255, 255).

## M

**max_pixels**
Верхний лимит пикселей изображения в конфигурации AutoProcessor.
Управляет максимальным количеством visual tokens.
Обязателен для production: без лимита A4 300dpi генерирует 8000+ visual tokens → OOM.

**min_pixels**
Нижний лимит пикселей изображения в конфигурации AutoProcessor.
Гарантирует минимальное разрешение — защита от деградации OCR на маленьких изображениях.

**M-RoPE (Multimodal Rotary Position Embedding)**
Позиционные эмбеддинги с тремя осями: 1D для текста, 2D для изображений, 3D для видео.
Даёт модели реальную информацию о пространственном расположении патчей.
Основа для spatial anchoring в промптах: «верхний правый угол» — не метафора.

**Vision encoder**
Модуль CLOUD_VLM_MODEL/CURRENT_VLM_MODEL, преобразующий image/video в visual tokens.
Архитектура и patch size зависят от модели; в production их нужно проверять по выбранной VLM.

## P

**Patch**
Фрагмент изображения фиксированного размера (в CURRENT_VLM_MODEL: 32×32 пикселя).
Каждый патч → один visual token после проекции.
Количество патчей = (width / patch_size) × (height / patch_size).

**Patch Size**
Размер одного патча в пикселях для нарезки изображения.
Patch size зависит от выбранной VLM и определяет соотношение разрешение / количество visual tokens.
Итоговые размеры изображения должны быть кратны patch_size.

## R

**Reasoning Mode (VLM)**
Управление chain-of-thought в CURRENT_VLM_MODEL для визуальных задач.
`/think` — CoT активирован: медленнее, лучше для сложного visual reasoning.
`/no_think` — CoT отключён: быстрее, оптимально для structured extraction.

**Routing (по размеру модели)**
Паттерн: edge SLM классифицирует сложность задачи,
результат направляется к модели нужного класса.
На слабом локальном GPU может снижать median latency без потери качества на сложных кейсах.

## S

**Spatial Anchoring**
Техника VLM промптинга: явные пространственные референсы на расположение элементов.
Работает буквально благодаря M-RoPE 2D координатам.
Примеры: «в верхней правой части», «под основным текстом», «рядом с подписью».

## T

**Tile Processing**
Стратегия нарезки документа на фрагменты для обработки с высоким разрешением.
Каждый тайл — отдельный VLM запрос, результаты объединяются в post-processing.
Альтернатива повышению max_pixels: позволяет OCR мелкого шрифта без превышения n_ctx.

**Two-Stage Pipeline**
Архитектурный паттерн для VLM extraction:
Stage 1 — grounding (низкое разрешение, найти регионы),
Stage 2 — extraction (высокое разрешение, только найденные регионы).
Снижает суммарный visual token cost при высоком OCR качестве.

## V

**Visual Token**
Единица представления изображения в LLM контексте.
Один патч изображения → один visual token после проекции через MLP.
Конкурирует с text tokens за n_ctx бюджет.

**Visual Token Budget**
Суммарное количество visual tokens запроса.
Формула полного бюджета: `visual_tokens + system_prompt_tokens + user_tokens + output_tokens < n_ctx`.
Управляется через max_pixels в конфигурации процессора.

**VLM Autocorrect**
Артефакт VLM: модель «исправляет» опечатки и нестандартные символы при extraction.
Специфичен для мультимодальных моделей — в text-only LLM отсутствует.
Митигация: явный запрет в system prompt с инструкцией использовать `[?]` для неразличимых символов.

## W

**VRAM Budget (VLM)**
Расчёт: `свободный VRAM = total - веса модели - overhead`.
KV-cache одного VLM запроса (1280 visual + 300 text tokens) ≈ 0.25 Гб на GTX 1660.
`max_concurrency = свободный VRAM / KV-cache per request`.

---

## D

**Document Intelligence**  
Комплексный pipeline из OCR, layout detection, VLM, parsers и structured output для извлечения данных из документов, таблиц и форм.

**Document Parser**  
Компонент, который преобразует DOCX/XLSX/PDF в markdown/html/table representation перед VLM или LLM extraction.

