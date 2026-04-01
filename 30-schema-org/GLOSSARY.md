# GLOSSARY — Schema.org / Structured Data

Термины из модуля по алфавиту. Латиница — первой, затем кириллица.

---

## A

**@context**  
JSON-LD ключ: объявляет словарь (namespace) для терминов в документе. `"@context": "https://schema.org"` — все типы и свойства интерпретируются как Schema.org термины. Обязателен в каждом JSON-LD блоке.

**@id**  
JSON-LD ключ: уникальный идентификатор сущности в виде URI. Позволяет связывать одну и ту же сущность между разными страницами и JSON-LD блоками. Google использует для построения Knowledge Graph.

**@type**  
JSON-LD ключ: тип сущности из словаря (@context). `"@type": "Article"`, `"@type": "Product"`. Определяет какие свойства ожидаются и возможен ли rich result.

**aggregateRating**  
Schema.org тип: агрегированный рейтинг (среднее + количество). Используется в Product, Recipe, LocalBusiness. Google требует соответствия с реально видимыми отзывами на странице — без отзывов в DOM = penalty.

**AI Overview**  
Google функция (SGE): LLM-generated ответ в верхней части SERP. Structured data с правильными типами и `sameAs` повышает шансы быть процитированным как источник.

---

## B

**BreadcrumbList**  
Schema.org тип: список навигационных breadcrumbs страницы. Google отображает вместо URL в SERP → повышает CTR. Рекомендован на всех внутренних страницах.

---

## E

**entity disambiguation**  
Задача: однозначно идентифицировать сущность (Person, Organization, Product) среди множества одноимённых. Инструменты: `@id` URI + `sameAs` ссылки на авторитетные источники (Wikipedia, LinkedIn, GitHub).

---

## J

**JSON-LD (JSON for Linked Data)**  
Формат structured data: JSON расширенный механизмом `@context` для связывания данных с онтологиями. Предпочтительный формат Google. Единственный формат разрешённый в `<body>` (у остальных только `<head>`).

---

## K

**Knowledge Graph**  
База знаний Google об объектах реального мира и их связях. Наполняется из structured data, Wikipedia, официальных источников. Влияет на Knowledge Panel, rich results, AI Overview ответы.

---

## M

**manual action**  
Ручное наказание от Google Search Quality team. За structured data: несоответствие разметки видимому контенту (спуфинг). Результат: потеря rich results или позиций. Снимается через Search Console → Manual Actions после исправления.

**Microdata**  
Формат structured data: атрибуты (`itemscope`, `itemtype`, `itemprop`) встроены в HTML теги. Поддерживается Google, но не рекомендован — смешивает структуру и контент.

---

## P

**plugin collision**  
Ситуация: несколько плагинов (Yoast, Rank Math, WooCommerce) генерируют конфликтующие JSON-LD блоки для одной сущности (Organization, WebSite). Google получает противоречивые данные → игнорирует или выбирает произвольный. Решение: один источник structured data.

**priceValidUntil**  
Свойство Offer: дата до которой действует цена (ISO 8601). Google требует для стабильного отображения цены в Product rich result. Без него — цена может не показываться.

---

## R

**RDFa (Resource Description Framework in Attributes)**  
Формат structured data: расширение HTML атрибутов для семантической разметки. Мощный, но высокий порог вхождения. Google поддерживает, но не рекомендует.

**rich result**  
Визуально расширенный результат в Google SERP: звёздочки, цены, изображения, FAQ dropdown, breadcrumbs. Требует валидного structured data соответствующего Google Search Gallery. ~30 поддерживаемых типов в 2026.

**Rich Results Test**  
Google инструмент (search.google.com/test/rich-results): проверяет HTML страницы или URL, показывает доступные rich results, ошибки и предупреждения по Google-specific требованиям.

---

## S

**sameAs**  
Schema.org свойство: URL авторитетного источника о той же сущности (Wikipedia, Wikidata, LinkedIn, GitHub). Позволяет Google однозначно идентифицировать сущность и добавить в Knowledge Graph.

**Schema Markup Validator**  
Инструмент (validator.schema.org): полная Schema.org валидация без Google-specific ограничений. Используется для проверки синтаксиса и полноты разметки.

**Schema.org**  
Collaborative vocabulary (Google, Microsoft, Yahoo, Yandex): 800+ типов для semantic web. Полная онтология. Google поддерживает только subset (~30 типов) для rich results.

---

## Г

**граф сущностей**  
Linked data структура: сущности (Organization, Person, Product) связаны через `@id` и `sameAs` в единую семантическую сеть. Основа Knowledge Graph. Отличается от набора изолированных JSON объектов.

---

*Глоссарий модуля 30. Следующий: [Модуль 31 — Mobile-First CSS](../31-mobile-first-css/GLOSSARY.md)*
