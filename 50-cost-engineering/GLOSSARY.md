# GLOSSARY — Cost Engineering для AI

## B

**Budget (Cost Budget)**
Лимит cost на задачу/день/проект. Alert при превышении. Без бюджета explosion виден через месяц по счёту.

---

## C

**Cascade Filter**
Цепочка: дешёвый gate решает, нужна ли дорогая обработка. Экономика зависит от pass rate: 30% в дорогую + 70% в дешёвую = cost −2–3×. При pass rate 90% каскад не окупается.

**Cost Attribution**
Привязка cost к фактической модели и задаче. Fallback-вызов помечается (`gen_ai.fallback: true`), иначе метрики врут.

**Cost Model**
Формула cost per task: входные/выходные токены, tools, memory, rerankers, judge, retries. Прогноз бюджета до запуска.

**Cost per Task**
Стоимость одной задачи агента. KPI архитектуры наравне с latency и accuracy. Сравнение «дешёвой» модели — по cost per task, не по цене токена.

---

## E

**Embedding Cache**
Кэш векторов: L1 (in-memory) + L2 (Redis). Повторные запросы не платят за embeddings. Hit 94% → cost −90%.

---

## F

**Fallback Economy**
Переключение на дешёвую модель при отказе/превышении бюджета. Экономия, но с риском деградации качества — требует evals и мониторинга fallback rate.

---

## G

**Gate**
Дешёвый компонент каскада: решает «нужна ли дорогая модель» (SLM 0.8B, классификатор). Должен измерять pass rate.

---

## K

**Key Rotation**
Ротация нескольких ключей провайдера для обхода rate limit. Fallback между провайдерами при отказе.

---

## L

**LLM Judge Cost**
Стоимость eval через модель-судью. При всех evals через judge — дороже пайплайна. Sampling + deterministic checks первыми.

---

## P

**Pass Rate**
Доля запросов, прошедших gate в дорогую модель. Определяет экономику каскада. Измеряется, иначе каскад — лишняя сложность.

**Provider Router**
Роутер LLM-провайдеров: RouterAI (рубли), OpenRouter (ротация, fallback). Централизует ключи и маршрутизацию.

---

## R

**Retry Cost**
Стоимость повторных вызовов при ошибках. «Retry сожрал весь RPM» — каждый retry платит за токены. Уважение Retry-After снижает cost.

---

*Глоссарий модуля 50. Далее: [Модуль 51 — API Design](../51-api-design/README.md).*