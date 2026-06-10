# Модуль 09 — Evaluator / Benchmark Design

> **Для AI-архитектора:** evaluator — это не «проверить что модель отвечает».  
> Это система измерения, которую можно сломать так же легко, как и саму модель.  
> Один день изучения — полный стек от метрик и датасетов до LLM-as-Judge  
> и интеграции в CI/CD с quality gates.

---

## Содержание

1. [Зачем нужен evaluator — и почему его нет](#1-зачем-нужен-evaluator--и-почему-его-нет)
2. [Типы метрик и их ограничения](#2-типы-метрик-и-их-ограничения)
3. [Датасет — сборка и репрезентативность](#3-датасет--сборка-и-репрезентативность)
4. [LLM-as-Judge — механика и bias](#4-llm-as-judge--механика-и-bias)
5. [Инструменты — DeepEval, Ragas, Promptfoo](#5-инструменты--deepeval-ragas-promptfoo)
6. [CI/CD интеграция и quality gates](#6-cicd-интеграция-и-quality-gates)
7. [AgentOps evals: production-оценка агентного поведения](#7-agentops-evals-production-оценка-агентного-поведения)
8. [Реальный кейс](#реальный-кейс)
9. [Антипаттерны](#антипаттерны)

---

## Актуальные версии (март 2026)


| Инструмент    | Версия  | Лицензия        | Примечание                                    |
| ------------- | ------- | --------------- | --------------------------------------------- |
| DeepEval      | 3.9.2   | Apache 2.0      | pytest-compatible, 50+ метрик, LLM-as-Judge   |
| Ragas         | 0.4.3   | Apache 2.0      | RAG-специфичные метрики, synthetic test gen   |
| Promptfoo     | 0.121.3 | MIT             | YAML-driven, CLI, CI/CD gates, multi-provider |
| Langfuse      | 3.x     | MIT (self-host) | Observability + evaluation, self-hosted       |
| Arize Phoenix | latest  | Elastic 2.0     | RAG debugging, production monitoring          |


---

## 1. Зачем нужен evaluator — и почему его нет

### Типичное состояние

В большинстве LLM pipeline evaluation выглядит так:  
разработчик запускает несколько примеров вручную, смотрит на вывод,  
говорит «работает» и идёт дальше. Это не evaluation. Это wishful thinking.

Проблема не в лени. Проблема в том, что LLM output — это  
распределение, а не детерминированная функция. Один и тот же промпт  
на одной и той же модели даёт разные результаты при разных запусках.  
«Работает» — не утверждение о качестве. Это утверждение о конкретном запуске.

```

Без evaluator:
Промпт изменился → неизвестно стало лучше или хуже
Модель обновилась → неизвестно регрессия или улучшение
Новый тип входных данных → неизвестно покрытие

С evaluator:
Промпт изменился → delta метрики на зафиксированном датасете
Модель обновилась → automated regression test
Новый тип входных данных → gap analysis по категориям

```

**Практический вывод для архитектора:** evaluator строится до начала оптимизации,  
не после. Оптимизировать без baseline метрики — оптимизировать вслепую.

### Три уровня evaluation

```

Уровень 1: Automated metrics (самый дешёвый, самый быстрый)
— Точные метрики: exact match, JSON schema validation, regex
— Статистические: ROUGE, BLEU, BERTScore
— Применение: regression tests, CI/CD gates
— Ограничение: не покрывает семантическое качество

Уровень 2: LLM-as-Judge (средняя стоимость, хорошее качество)
— Pairwise comparison: новая версия vs старая
— Scoring по критериям: точность, полнота, тон
— RAG метрики: faithfulness, relevancy
— Ограничение: position bias, verbosity bias, self-enhancement bias

Уровень 3: Human evaluation (самый дорогой, самый надёжный)
— Экспертная оценка критичных кейсов
— A/B тестирование на реальных пользователях
— Red team тестирование
— Ограничение: не масштабируется, дорого, медленно

```

**Практический вывод для архитектора:** три уровня — не выбор «что использовать».  
Это стек. Уровень 1 — на каждый коммит. Уровень 2 — на каждый значимый релиз.  
Уровень 3 — перед production запуском критичных изменений.

### Граничные случаи — где ломается

```python
# Evaluator измеряет то, что ты измеряешь, а не то, что важно
# Классический пример: оптимизировать ROUGE score для summarization
# ROUGE растёт → модель копирует больше текста из источника
# Качество summary падает, потому что копирование ≠ понимание

# ❌ Неправильно: одна агрегированная метрика
avg_score = sum(scores) / len(scores)
# Средний score 0.85 скрывает что 20% кейсов — полные провалы с score 0.1

# ✅ Правильно: распределение + хвосты
import statistics
scores = [...]
print(f"mean={statistics.mean(scores):.2f}")
print(f"p10={sorted(scores)[len(scores)//10]:.2f}")   # нижний хвост
print(f"p90={sorted(scores)[len(scores)*9//10]:.2f}") # верхний хвост
print(f"failure_rate={sum(1 for s in scores if s < 0.5) / len(scores):.1%}")
```

**Почему это важно архитектору:** агрегированные метрики скрывают системные провалы.  
Модель с mean score 0.85 может иметь 15% кейсов с нулевым качеством.  
На production это 15% плохих ответов пользователям.

---

## 2. Типы метрик и их ограничения

### Точные метрики — когда применимы

Точные метрики (exact match, schema validation) — единственные метрики  
с гарантированным детерминизмом. Применимы когда ожидаемый вывод однозначен:

```python
# Exact match — для extraction с известным ground truth
def exact_match(predicted: str, expected: str) -> float:
    return 1.0 if predicted.strip() == expected.strip() else 0.0

# JSON Schema validation — для structured output
from jsonschema import validate, ValidationError

def schema_score(output: dict, schema: dict) -> float:
    try:
        validate(instance=output, schema=schema)
        return 1.0
    except ValidationError as e:
        return 0.0  # или частичный score по глубине ошибки

# Field-level accuracy — для extraction задач
def field_accuracy(predicted: dict, expected: dict, fields: list[str]) -> dict:
    results = {}
    for field in fields:
        pred_val = predicted.get(field)
        exp_val = expected.get(field)
        results[field] = {
            "correct": pred_val == exp_val,
            "predicted": pred_val,
            "expected": exp_val,
        }
    return results
```

**Практический вывод для архитектора:** для extraction pipeline с JSON Schema —  
начинай с field-level accuracy, не с LLM-as-Judge. Точная метрика дешевле,  
быстрее и не добавляет вторую LLM как источник ошибок.

### Семантические метрики — trade-offs

```python
# BERTScore — семантическое сходство через embeddings
# Не требует LLM judge, работает локально
# Ограничение: не учитывает фактическую точность, только сходство текста

from bert_score import score as bert_score

def semantic_similarity(predictions: list[str], references: list[str]) -> list[float]:
    P, R, F1 = bert_score(predictions, references, lang="ru", verbose=False)
    return F1.tolist()

# ROUGE — overlap n-gram метрики
# Применение: summarization, где важно покрытие фактов
# Ограничение: копирование текста даёт высокий score

from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(prediction, reference)
# scores.rougeL.fmeasure — основная метрика для summarization
```

### G-Eval — LLM-оценка с chain-of-thought

G-Eval — паттерн оценки через LLM с явной цепочкой рассуждений:  
модель-судья объясняет своё решение перед выставлением оценки.  
Снижает variance по сравнению с прямым scoring:

```python
# G-Eval паттерн — явный CoT перед оценкой
GEVAL_PROMPT = """
Оцени качество извлечённых данных суда по критерию ТОЧНОСТЬ.

Входной текст:
{input_text}

Извлечённые данные:
{extracted_data}

Шаги оценки:
1. Проверь каждое поле на соответствие тексту
2. Отметь поля с ошибками и причины
3. Оцени общую точность по шкале 1-5

Сначала напиши анализ, затем итоговую оценку в формате:
SCORE: <число от 1 до 5>
"""

# DeepEval реализует G-Eval нативно:
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

accuracy_metric = GEval(
    name="Extraction Accuracy",
    criteria="Все поля в extracted_data точно соответствуют входному тексту. "
             "Пустые поля допустимы только если информация отсутствует в тексте.",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    threshold=0.7,
)
```

**Практический вывод для архитектора:** G-Eval с явными шагами оценки  
воспроизводимее чем прямой scoring. Но всё равно требует валидации  
корреляции с human judgment на твоём конкретном датасете.

### Граничные случаи — где ломается

```python
# Метрика измеряет прокси, а не цель
# Faithfulness в RAG = "ответ поддерживается контекстом"
# НЕ означает что контекст правильный
# НЕ означает что ответ полезен пользователю

# Score 1.0 по faithfulness при полностью неправильном контексте
context = "Верховный суд находится в Санкт-Петербурге"  # неверно
answer = "Верховный суд находится в Санкт-Петербурге"   # faithful, но неверно
# faithfulness = 1.0 ← метрика не видит проблемы

# ✅ Дополняй faithfulness groundedness против известных фактов
# или human evaluation для критичных доменов
```

**Почему это важно архитектору:** каждая метрика — прокси. Знай что именно  
она измеряет и что она НЕ измеряет. Комбинируй метрики, покрывающие разные аспекты.

---

## 3. Датасет — сборка и репрезентативность

### Структура evaluation датасета

```python
# Минимальная структура test case для extraction задач
from dataclasses import dataclass
from typing import Optional
from enum import Enum

class DifficultyLevel(Enum):
    EASY = "easy"         # чистый текст, все поля явные
    MEDIUM = "medium"     # частичные данные, аббревиатуры
    HARD = "hard"         # склейки, опечатки, неполные данные
    EDGE = "edge"         # граничные случаи: дубли, нестандартный формат

@dataclass
class ExtractionTestCase:
    id: str
    input_text: str
    expected_output: dict
    difficulty: DifficultyLevel
    category: str           # тип суда, регион, источник данных
    notes: str = ""         # описание почему кейс сложный

# Распределение по сложности для репрезентативного датасета
DATASET_DISTRIBUTION = {
    DifficultyLevel.EASY:   0.40,  # 40% — базовое покрытие
    DifficultyLevel.MEDIUM: 0.35,  # 35% — типичные production кейсы
    DifficultyLevel.HARD:   0.15,  # 15% — сложные но реальные
    DifficultyLevel.EDGE:   0.10,  # 10% — граничные случаи
}
```

### Минимальный размер датасета

```
Правило для classification/extraction задач:

Минимум для baseline: 100 кейсов
  — Достаточно для обнаружения регрессий > 5%
  — Статистически ненадёжно для тонких различий

Рабочий датасет: 500-1000 кейсов
  — Позволяет сегментацию по категориям
  — Обнаруживает регрессии > 2%
  — Доверительный интервал при p=0.95: ±2-3%

Production датасет: 2000+ кейсов
  — Сегментация по типу, региону, источнику
  — Обнаруживает регрессии > 1%
  — Статистически значимые A/B сравнения

# Минимум per category: 30 кейсов
# При меньшем числе — метрика по категории статистически ненадёжна
```

### Synthetic test generation

Ragas предоставляет synthetic generation на основе реальных документов:

```python
from ragas.testset import TestsetGenerator
from ragas.testset.evolutions import simple, reasoning, multi_context
from langchain_community.document_loaders import DirectoryLoader

# Генерация тестового датасета из реальных документов
loader = DirectoryLoader("./court_docs/", glob="**/*.txt")
documents = loader.load()

generator = TestsetGenerator.with_openai()  # или локальная модель

testset = generator.generate_with_langchain_docs(
    documents,
    test_size=200,
    distributions={
        simple: 0.5,       # прямые вопросы
        reasoning: 0.3,    # требующие рассуждений
        multi_context: 0.2 # из нескольких документов
    },
)
# testset.to_pandas() → DataFrame с question, ground_truth, contexts
```

**Практический вывод для архитектора:** synthetic generation — для быстрого старта,  
не для production датасета. Синтетические кейсы не покрывают реальные edge cases  
твоих данных. Используй как дополнение к ручной разметке, не как замену.

### Граничные случаи — где ломается

```python
# Train/test leakage через LLM
# Если используешь ту же модель для synthetic generation и для evaluation —
# модель знает паттерны своих же ответов
# Результат: завышенные метрики, не коррелирующие с реальным качеством

# ✅ Разделяй модели: генерация датасета и evaluation — разные модели
# ✅ Или: генерируй датасет из документов которые НЕ используются в промптах

# Data drift: датасет устарел
# Датасет из ноября не покрывает данные с новым форматом из января
# Метрики держатся, production ухудшается
# ✅ Версионируй датасет с датой. Обновляй при изменении входных данных.
```

**Почему это важно архитектору:** устаревший датасет — самая частая причина  
ложного ощущения стабильности. CI/CD зелёный, production деградирует.

---

## 4. LLM-as-Judge — механика и bias

### Архитектура LLM-as-Judge

LLM-as-Judge — паттерн где отдельная LLM оценивает качество вывода  
основной модели. Три схемы оценки:

```
Схема 1: Absolute scoring
  Судья выставляет score 1-5 по критериям
  + Быстро, масштабируется
  - Высокая variance между запусками, anchor bias

Схема 2: Pairwise comparison
  Судья сравнивает два вывода и выбирает лучший
  + Стабильнее абсолютного scoring
  - Требует 2x запросов, position bias

Схема 3: Reference-based scoring
  Судья сравнивает с эталонным ответом
  + Наиболее точная для задач с known good answer
  - Требует ground truth
```

### Известные bias и как их митигировать

```python
# Position bias: судья предпочитает первый вариант при pairwise
# Митигация: двойной прогон с reversed порядком

async def pairwise_with_debiasing(
    judge_llm,
    input_text: str,
    output_a: str,
    output_b: str,
) -> dict:
    # Прогон 1: A vs B
    result_1 = await judge_llm.compare(input_text, output_a, output_b)
    # Прогон 2: B vs A (reversed)
    result_2 = await judge_llm.compare(input_text, output_b, output_a)

    # Консистентный результат — надёжная оценка
    if result_1 == "A" and result_2 == "B":
        return {"winner": "A", "confidence": "high"}
    elif result_1 == "B" and result_2 == "A":
        return {"winner": "B", "confidence": "high"}
    else:
        return {"winner": "tie", "confidence": "low"}  # inconsistent → tie

# Verbosity bias: судья предпочитает более длинные ответы
# Митигация: явная инструкция в системном промпте судьи
JUDGE_SYSTEM = """
Оценивай ТОЛЬКО точность и полноту извлечённых данных.
Длина ответа не является критерием качества.
Краткий точный ответ лучше длинного неточного.
"""

# Self-enhancement bias: модель предпочитает свои же паттерны
# Митигация: используй модель другого семейства в качестве судьи
# Production модель: Qwen3.5 → Судья: Llama 3.x или внешний API
```

### Calibration — валидация судьи

```python
# Судья должен коррелировать с human judgment на твоих данных
# Без калибровки — непонятно насколько можно доверять метрикам

def calibrate_judge(
    judge,
    human_scores: list[float],   # оценки от людей
    judge_scores: list[float],   # оценки от LLM-судьи
) -> dict:
    from scipy.stats import pearsonr, spearmanr

    pearson_r, pearson_p = pearsonr(human_scores, judge_scores)
    spearman_r, spearman_p = spearmanr(human_scores, judge_scores)

    return {
        "pearson_r": pearson_r,
        "spearman_r": spearman_r,        # ранговая корреляция, устойчивее
        "acceptable": spearman_r > 0.7,  # порог: >0.7 — приемлемо
    }

# Минимум для калибровки: 50 кейсов с human labels
# Если spearman_r < 0.7 — судья не валиден для твоей задачи
```

**Практический вывод для архитектора:** LLM-as-Judge без калибровки — это  
замена одного subjective мнения (твоего) другим subjective мнением (модели).  
Калибруй судью против human judgment перед использованием в CI/CD.

### Граничные случаи — где ломается

```python
# Судья видел данные из твоего домена в обучении
# Для юридических документов: если модель-судья обучалась на судебных текстах —
# она может иметь prior убеждения о правильном формате

# Симптом: судья стабильно высоко оценивает определённый стиль ответов
# независимо от точности содержания

# ✅ Включай в evaluation промпт конкретные примеры неправильных ответов
# с объяснением почему они неправильны (few-shot calibration)

JUDGE_FEW_SHOT = """
Пример неправильного извлечения (score: 1):
Вход: "Арбитражный суд г. Москвы, ул. Большая Тульская, 17"
Вывод: {{"name": "Арбитражный суд Москвы", "address": "Тульская 17"}}
Проблема: адрес неполный, улица сокращена, номер без "ул."

Пример правильного извлечения (score: 5):
Вывод: {{"name": "Арбитражный суд г. Москвы", "address": "ул. Большая Тульская, 17"}}
"""
```

**Почему это важно архитектору:** domain-specific prior судьи — источник  
систематической ошибки которую трудно обнаружить без калибровки.

---

## 5. Инструменты — DeepEval, Ragas, Promptfoo

### DeepEval — pytest-style evaluation

DeepEval 3.7.9 — наиболее полный фреймворк для Python.  
50+ метрик, интеграция с pytest, поддержка мультимодальных кейсов:

```python
# pip install deepeval
import pytest
from deepeval import assert_test
from deepeval.metrics import (
    GEval,
    AnswerRelevancyMetric,
    HallucinationMetric,
    FaithfulnessMetric,
)
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

# Кастомная метрика через G-Eval
extraction_accuracy = GEval(
    name="Court Extraction Accuracy",
    criteria="""
    Оцени точность извлечения данных суда:
    1. Название суда точно соответствует тексту
    2. Адрес полный и без сокращений
    3. Тип суда определён правильно
    4. Пустые поля только если данные отсутствуют в тексте
    """,
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
        LLMTestCaseParams.EXPECTED_OUTPUT,
    ],
    threshold=0.7,
    model="gpt-4o-mini",   # или локальная модель через LiteLLM
)

@pytest.mark.parametrize("test_case", load_test_cases())
def test_court_extraction(test_case):
    llm_test_case = LLMTestCase(
        input=test_case.input_text,
        actual_output=run_extraction(test_case.input_text),
        expected_output=test_case.expected_output_str,
    )
    assert_test(llm_test_case, [extraction_accuracy])
```

### DeepEval с локальной моделью (без внешних API)

```python
# Через LiteLLM — любой OpenAI-compatible endpoint
import os
os.environ["OPENAI_API_KEY"] = "lm-studio"
os.environ["OPENAI_API_BASE"] = "http://localhost:1234/v1"

from deepeval.models import DeepEvalBaseLLM

class LocalLMStudioJudge(DeepEvalBaseLLM):
    def __init__(self, model_name: str):
        self.model_name = model_name

    def load_model(self):
        from openai import OpenAI
        return OpenAI(
            base_url="http://localhost:1234/v1",
            api_key="lm-studio",
        )

    def generate(self, prompt: str) -> str:
        client = self.load_model()
        response = client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
        )
        return response.choices.message.content

    async def a_generate(self, prompt: str) -> str:
        return self.generate(prompt)

    def get_model_name(self) -> str:
        return self.model_name

local_judge = LocalLMStudioJudge("lmstudio-community/Llama-3.2-8B-GGUF")

# Использовать локальную модель как судью
metric = GEval(
    name="Local Accuracy",
    criteria="...",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    model=local_judge,   # ← локальный судья
)
```

### Ragas — RAG-специфичные метрики

```python
# pip install ragas
from ragas import evaluate
from ragas.metrics import (
    faithfulness,         # ответ поддерживается контекстом
    answer_relevancy,     # ответ релевантен вопросу
    context_precision,    # контекст релевантен вопросу
    context_recall,       # контекст покрывает ground truth
)
from datasets import Dataset

# Структура датасета для RAG evaluation
data = {
    "question": ["Где находится Верховный суд РФ?"],
    "answer": ["Верховный суд РФ находится в Москве"],
    "contexts": [["Верховный суд РФ расположен в Москве на Поварской улице"]],
    "ground_truth": ["Верховный суд РФ находится в Москве"],
}
dataset = Dataset.from_dict(data)

result = evaluate(
    dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
    llm=local_judge_langchain,  # можно передать локальную модель
)
print(result)
# {'faithfulness': 0.97, 'answer_relevancy': 0.92, ...}
```

### Promptfoo — YAML-driven, CI-first

Promptfoo — лучший выбор для teams с несколькими промптами  
и необходимостью сравнивать модели без написания Python кода:

```yaml
# promptfooconfig.yaml
description: "Court extraction evaluation"

prompts:
  - file://prompts/court_extractor_v1.txt
  - file://prompts/court_extractor_v2.txt

providers:
  - id: openai:chat:gpt-4o-mini
  - id: http
    config:
      url: http://localhost:1234/v1/chat/completions
      headers:
        Authorization: "Bearer lm-studio"
      body:
        model: lmstudio-community/Qwen3.5-9B-GGUF
        temperature: 0.0

tests:
  - vars:
      input: "Арбитражный суд Московской области, г. Красногорск, бул. Строителей, 1"
    assert:
      - type: is-json
      - type: javascript
        value: |
          output.court_type === "АРБИТРАЖНЫЙ"
      - type: llm-rubric
        value: "Адрес полный и точный"

  - vars:
      input: "{{file 'test_cases/hard_cases.csv'}}"
    assert:
      - type: is-json
      - type: similar
        value: "{{expected_output}}"
        threshold: 0.85
```

```bash
# Запуск
npx promptfoo eval

# CI/CD с quality gate
npx promptfoo eval --ci \
  --fail-threshold 0.80 \
  --output results.json
```

**Практический вывод для архитектора:** выбор инструмента по задаче:


| Задача                                 | Инструмент |
| -------------------------------------- | ---------- |
| Python pipeline, pytest интеграция     | DeepEval   |
| RAG система, retrieval метрики         | Ragas      |
| Сравнение промптов/моделей без кода    | Promptfoo  |
| Self-hosted observability + evaluation | Langfuse   |


### Граничные случаи — где ломается

```python
# DeepEval + локальная модель → timeout на batch evaluation
# Дефолтный timeout DeepEval рассчитан на быстрые cloud API
# Локальная 9B модель при 15 tok/s → легко превышает timeout

# ✅ Настройка timeout для локального судьи
import deepeval
deepeval.confident_ai_configs.request_timeout = 120  # секунд

# Ragas требует LangChain-совместимый LLM wrapper
# Прямой OpenAI клиент не подходит — нужен langchain_openai.ChatOpenAI
from langchain_openai import ChatOpenAI

local_langchain_llm = ChatOpenAI(
    model="qwen3.5-9b",
    base_url="http://localhost:1234/v1",
    api_key="lm-studio",
    temperature=0.0,
    request_timeout=120,
)
```

**Почему это важно архитектору:** timeout и API wrapper совместимость —  
первое с чем столкнёшься при интеграции локального судьи в DeepEval/Ragas.  
Решается за 5 минут если знаешь где смотреть.

---

## 6. CI/CD интеграция и quality gates

### Архитектура pipeline

```
                        ┌─────────────────────────────────┐
  git push              │         GitHub Actions           │
      │                 │                                  │
      ▼                 │  1. pytest tests (exact metrics) │
  Pull Request ────────►│     < 1 min, no LLM calls        │
                        │                                  │
                        │  2. Evaluation suite (LLM judge) │
                        │     ~ 5-15 min, LLM calls        │
                        │                                  │
                        │  3. Quality gate check           │
                        │     score >= threshold → merge   │
                        │     score <  threshold → block   │
                        └─────────────────────────────────┘
```

### GitHub Actions — evaluation pipeline

```yaml
# .github/workflows/eval.yml
name: LLM Evaluation

on:
  pull_request:
    paths:
      - "prompts/**"
      - "pipeline/**"

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install deepeval pytest

      - name: Run exact metric tests
        run: pytest tests/test_extraction_exact.py -v

      - name: Run LLM evaluation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          python scripts/run_evaluation.py \
            --dataset data/eval_dataset.jsonl \
            --output results/eval_results.json \
            --threshold 0.80

      - name: Quality gate
        run: |
          python scripts/check_quality_gate.py \
            --results results/eval_results.json \
            --baseline results/baseline.json \
            --max-regression 0.03  # не более 3% регрессии
```

### Quality gate — логика

```python
# scripts/check_quality_gate.py
import json
import sys

def check_quality_gate(
    results_path: str,
    baseline_path: str,
    max_regression: float = 0.03,
    min_absolute_score: float = 0.75,
) -> bool:
    with open(results_path) as f:
        results = json.load(f)
    with open(baseline_path) as f:
        baseline = json.load(f)

    current_score = results["mean_score"]
    baseline_score = baseline["mean_score"]
    regression = baseline_score - current_score

    print(f"Current:  {current_score:.3f}")
    print(f"Baseline: {baseline_score:.3f}")
    print(f"Delta:    {regression:+.3f}")

    # Два условия: нет регрессии И абсолютный порог
    if regression > max_regression:
        print(f"❌ FAIL: regression {regression:.1%} > threshold {max_regression:.1%}")
        return False

    if current_score < min_absolute_score:
        print(f"❌ FAIL: score {current_score:.3f} < min {min_absolute_score:.3f}")
        return False

    print("✅ PASS: quality gate passed")
    return True

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", required=True)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--max-regression", type=float, default=0.03)
    args = parser.parse_args()

    passed = check_quality_gate(args.results, args.baseline, args.max_regression)
    sys.exit(0 if passed else 1)
```

**Практический вывод для архитектора:** два условия в quality gate — обязательно.  
Только relative regression пропустит PR который начинается с низкого baseline.  
Только absolute threshold заблокирует хорошее улучшение после плохого периода.

### Граничные случаи — где ломается

```python
# LLM evaluation в CI — нестабильные результаты между запусками
# Temperature=0 не гарантирует детерминизм на GPU (см. модуль 08)
# Результат: quality gate flappy — то проходит, то нет

# ✅ Стратегии стабилизации:
# 1. Несколько прогонов с усреднением
# 2. Более широкий threshold (не ±1%, а ±3%)
# 3. Отдельный evaluation model с temperature=0 на CPU

# Стоимость LLM evaluation в CI
# 500 тест-кейсов × 2 LLM вызова (generate + judge) × $0.001/call = $1 за прогон
# При 20 PR в день = $20/день = $600/месяц
# ✅ Используй локальную модель как судью для основного CI
# Облачный судья — только для ночного scheduled run с полным датасетом
```

**Почему это важно архитектору:** стоимость и стабильность evaluation в CI —  
практические ограничения которые определяют архитектуру пайплайна.

## 7. AgentOps evals: production-оценка агентного поведения

Для agent systems обычных extraction metrics недостаточно. Нужно измерять не только качество final answer, но и поведение pipeline: какие tools были вызваны, сколько стоил workflow, были ли retry/fallback, не ушёл ли агент в лишний retrieval loop.

Минимальный набор AgentOps evals:

| Layer | Что проверяет | Когда |
|:--|:--|:--|
| Deterministic | schema, forbidden actions, secrets, max latency | каждый PR |
| Golden dataset | ожидаемые answers/actions/tools | каждый PR или nightly |
| Regression | delta против baseline | перед merge/release |
| LLM judge | rubric, citations, hallucination | pre-release |
| Human review | high-risk domains | по необходимости |

### Agent-specific metrics

- success rate по task type;
- tool call accuracy;
- forbidden tool rate;
- retrieval loop rate;
- fallback rate;
- cost per task;
- p50/p95 latency;
- hallucination rate;
- guardrail rejection rate;
- approval rate для risky actions.

```text
workflow_trace
 ├── llm_calls: 4
 ├── tools: search_documents, get_contract_metadata
 ├── memory_reads: 2
 ├── fallback: false
 ├── cost_usd: 0.014
 ├── latency_ms: 3200
 └── final_score: 0.91
```

### Quality gates

Рекомендуемые пороги для production agent:

- schema valid ≥ 99.9%;
- forbidden tool rate = 0%;
- hallucination rate < 1% для legal/finance/support;
- cost per task не выше budget;
- p95 latency не выше SLA;
- fallback rate не выше 5% без деградации качества.

AgentOps evals должны быть частью CI/CD, но не заменять human review в high-risk доменах.

---

## 8. Реальный кейс

**Задача:** построить evaluation pipeline для extraction ~5000 судебных объектов.  
**Стек:** Python, DeepEval, локальный LLM-судья (LM Studio), GitHub Actions.

**Гипотеза:** LLM-as-Judge с Qwen3.5-9B как судьёй достаточно для CI/CD gates —  
это дешевле облачного API и соответствует требованиям data privacy.

**Что получилось:**

Первая итерация — G-Eval с локальным судьёй без калибровки:

```
Correlation с human labels (50 кейсов): spearman_r = 0.61
Вывод: ниже порога 0.7 — судья ненадёжен
```

Проблема: судья систематически завышал оценку для кейсов где адрес  
был частично правильным. Модель «видела смысл» и прощала неточности формата.

Решение — добавить few-shot примеры с явными ошибками формата:

```
После добавления few-shot калибровки:
Correlation с human labels: spearman_r = 0.79 ✅
```

**Вывод, противоречащий интуиции:** более мощная модель-судья (9B) без few-shot  
оказалась менее надёжной чем слабая модель (4B) с хорошими few-shot примерами.  
9B модель «умнее» понимала намерение — и прощала ошибки которые пользователь  
downstream системы не простит.

**Итоговая архитектура:**

- CI/CD: DeepEval + exact metrics (field-level accuracy) — на каждый PR, < 2 мин
- Ночной прогон: G-Eval с локальным судьёй (Qwen3.5-4B + few-shot) — 500 кейсов
- Pre-release: human evaluation 50 кейсов из hard/edge категорий

---

## 9. Антипаттерны

**1. Evaluator на том же датасете что и разработка**

```python
# ❌ Промпт разрабатывался на примерах из eval датасета
# Метрики высокие, production низкое — overfitting на eval set

# ✅ Строгое разделение:
# dev_examples/  → используются при разработке промпта
# eval_dataset/  → НИКОГДА не смотреть при написании промпта
# Если смотрел — датасет скомпрометирован, нужен новый
```

**2. Single metric decision**

```python
# ❌ "Faithfulness 0.92 → пайплайн хорош"
# Faithfulness не измеряет полноту, accuracy, format compliance

# ✅ Минимальный набор метрик для extraction:
REQUIRED_METRICS = {
    "schema_validity": ...,      # JSON Schema валидация
    "field_accuracy": ...,       # field-level exact match
    "null_rate": ...,            # доля null полей (должен быть в пределах)
    "extraction_accuracy": ...,  # G-Eval семантическая точность
}
# Все четыре → разные аспекты, не дублируют друг друга
```

**3. Evaluation без baseline**

```python
# ❌ Запустить evaluator один раз и считать результат "хорошим" или "плохим"
# 0.82 — это хорошо? Зависит от задачи. Без baseline — неизвестно.

# ✅ Первое что делаешь после сборки evaluator — фиксируешь baseline
import json
from datetime import date

baseline = {
    "date": str(date.today()),
    "model": MODEL_VERSION,
    "prompt_hash": hash_prompt(SYSTEM_PROMPT),
    "mean_score": 0.82,
    "p10_score": 0.61,
    "failure_rate": 0.08,
    "dataset_size": 500,
    "dataset_version": "v1.2",
}
with open("results/baseline.json", "w") as f:
    json.dump(baseline, f, indent=2)
# Этот файл — в git. Меняется только при намеренном обновлении baseline.
```

**4. LLM-as-Judge без temperature=0**

```python
# ❌ Судья с temperature=0.7 → разные оценки одного кейса при повторных запусках
# Variance ±0.2 на одном кейсе → quality gate нестабилен

# ✅ Всегда temperature=0.0 для судьи
# Seed фиксировать если backend поддерживает
judge_response = client.chat.completions.create(
    model=JUDGE_MODEL,
    messages=judge_messages,
    temperature=0.0,
    seed=42,  # если поддерживается
)
```

**5. Игнорировать стоимость evaluation**

```
❌ Антипаттерн:
   500 тест-кейсов × GPT-4o как судья = $15 за прогон
   20 PR в день = $300/день
   Команда начинает пропускать evaluation "чтобы не тратить"

✅ Правильно:
   Tier 1 (каждый PR): только exact metrics, 0 LLM вызовов, $0
   Tier 2 (ночной): локальный судья, 500 кейсов, ~$0
   Tier 3 (pre-release): облачный судья, 100 кейсов, ~$0.1
   Human evaluation: 50 кейсов, ~2 часа эксперта, раз в спринт
```

---

## Задачи AI-кодеру

**Задача 1 — Field-level accuracy**

Плохая формулировка:

> «Напиши функцию для оценки качества extraction»

Хорошая формулировка:

> «Напиши Python функцию `field_level_accuracy(predicted: dict, expected: dict, fields: list[str]) -> dict`,  
> которая для каждого поля из `fields` возвращает `{"correct": bool, "predicted": Any, "expected": Any}`.  
> Обработай случаи: поле отсутствует в predicted (считать incorrect),  
> поле None в обоих (считать correct), строки сравнивать после strip().  
> Добавь агрегированный ключ `"summary": {"total": int, "correct": int, "accuracy": float}`.  
> Только стандартная библиотека Python.»

---

**Задача 2 — DeepEval G-Eval с локальным судьёй**

Плохая формулировка:

> «Настрой DeepEval для локальной модели»

Хорошая формулировка:

> «Напиши класс `LMStudioJudge(DeepEvalBaseLLM)` для DeepEval 3.7.9,  
> использующий OpenAI-compatible API на localhost:1234.  
> Реализуй методы `load_model`, `generate`, `a_generate`, `get_model_name`.  
> В `generate` и `a_generate`: temperature=0.0, max_tokens=1024, timeout=120 сек.  
> При HTTPError или timeout — raise с информативным сообщением включающим model_name.  
> Зависимости: openai>=1.0, deepeval>=3.7.»

---

**Задача 3 — Quality gate скрипт**

Плохая формулировка:

> «Напиши проверку quality gate для CI»

Хорошая формулировка:

> «Напиши Python CLI скрипт `check_quality_gate.py` с argparse.  
> Аргументы: `--results path`, `--baseline path`, `--max-regression float` (default 0.03), `--min-score float` (default 0.75).  
> Загружает два JSON файла, сравнивает поле `mean_score`.  
> Два условия фейла: регрессия > max-regression ИЛИ текущий score < min-score.  
> При фейле: печатает причину + фактические значения, exit code 1.  
> При успехе: печатает delta + "PASS", exit code 0.  
> Только стандартная библиотека Python.»

---

## Чеклист архитектора

### Датасет

- [ ] Датасет разделён: dev_examples (разработка) vs eval_dataset (измерение)
- [ ] Минимум 100 кейсов, для production — 500+
- [ ] Покрыты все difficulty уровни: easy, medium, hard, edge
- [ ] Минимум 30 кейсов на каждую значимую категорию
- [ ] Датасет версионирован с датой и hash промпта
- [ ] Нет train/test leakage через модель-генератор

### Метрики

- [ ] Используется минимум 2-3 метрики покрывающих разные аспекты
- [ ] Exact metrics для детерминированных аспектов (schema, format)
- [ ] Анализ распределения (p10, p90), не только mean
- [ ] Зафиксирован baseline с датой и версией модели

### LLM-as-Judge

- [ ] Судья откалиброван против human labels (spearman_r > 0.7)
- [ ] Используется temperature=0.0
- [ ] Position bias митигирован (двойной прогон или single reference)
- [ ] Судья из другого семейства моделей чем production

### CI/CD

- [ ] Tier 1 (exact metrics) запускается на каждый PR
- [ ] Quality gate: два условия — regression + absolute score
- [ ] Стоимость evaluation посчитана, fit в бюджет
- [ ] Результаты сохраняются для trend analysis

---

*Модуль 09 завершён.*  
*Следующий: [Модуль 10 — Prompt Engineering (VLM)*](../10-prompt-engineering-vlm/README.md)