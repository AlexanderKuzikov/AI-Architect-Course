# Модуль 02 — TypeScript

> **Для AI-архитектора:** TypeScript — это не «JS с типами».
> Это инструмент проектирования системы через типы,
> который делает намерения кода явными и верифицируемыми.

---

## Содержание

1. [Зачем TypeScript архитектору](#1-зачем-typescript-архитектору)
2. [Система типов — механика](#2-система-типов--механика)
3. [Продвинутые типы](#3-продвинутые-типы)
4. [tsconfig — архитектурные решения](#4-tsconfig--архитектурные-решения)
5. [Паттерны проектирования через типы](#5-паттерны-проектирования-через-типы)
6. [Граничные случаи и ловушки](#6-граничные-случаи-и-ловушки)
7. [TypeScript и AI-кодер](#7-typescript-и-ai-кодер)
8. [Чеклист архитектора](#8-чеклист-архитектора)

---

## Актуальные версии (март 2026)

| Версия | Дата | Ключевые изменения |
|--------|------|-------------------|
| TypeScript 5.7 | Ноябрь 2024 | Улучшенный error reporting, `--module node18` stable |
| TypeScript 5.8 | Февраль 2025 | `--erasableSyntaxOnly`, `require()` ESM в `--module nodenext` |
| **TypeScript 5.9** | **Июль 2025** | **`import defer`, `strictInference` в `strict`, stable Decorator Metadata** |

Актуальная версия для нового проекта: **TypeScript 5.9**

---

## 1. Зачем TypeScript архитектору

### Типы как документация

Хорошо написанные типы — это архитектурная документация,
которая не устаревает, потому что компилятор проверяет
её соответствие коду.

```typescript
// Это не просто функция — это контракт
// Читая сигнатуру, архитектор понимает:
// - что принимает (Court с обязательным address)
// - что возвращает (Promise с возможным null — суд может не найтись)
async function resolveCourtAddress(
  court: Court & { address: string }
): Promise<ResolvedCourt | null>
```

### Типы как защита от AI-ошибок

Это главная практическая ценность TypeScript в AI-assisted разработке.
AI-кодер **часто ошибается в типах данных** — передаёт строку
вместо числа, забывает обработать `null`, путает форматы дат.

TypeScript компилятор ловит эти ошибки **до запуска**.
Без TypeScript такие ошибки живут в prod до первого граничного случая.

### Структурная типизация — главное отличие от других языков

TypeScript использует **структурную типизацию** (duck typing):
тип определяется не именем, а набором полей.

```typescript
interface HasName {
  name: string;
}

// Не нужно явно объявлять implements HasName
const user = { name: 'Alex', age: 30 };
function greet(entity: HasName) { return entity.name; }

greet(user); // ✅ работает — структура совпадает
```

**Практический вывод:** В TypeScript не нужно создавать иерархии
классов ради типовой совместимости. Достаточно совпадения структуры.
AI-кодеры из Java/C# фона часто создают избыточные иерархии —
это архитектурный запах в TypeScript-проектах.

---

## 2. Система типов — механика

### Примитивы и особые типы

```typescript
// Примитивы
string, number, boolean, bigint, symbol

// Специальные
null        // явное отсутствие значения
undefined   // переменная не инициализирована
void        // функция ничего не возвращает (точнее — undefined)
never       // функция никогда не завершается нормально
unknown     // любое значение, но требует проверки перед использованием
any         // любое значение без проверок — отключает TypeScript
```

### unknown vs any — принципиальная разница

```typescript
function processApiResponse(data: any) {
  // ❌ any — компилятор не проверяет НИЧЕГО
  data.user.name.toUpperCase(); // упадёт в runtime если структура другая
}

function processApiResponse(data: unknown) {
  // ✅ unknown — нужна явная проверка
  if (
    typeof data === 'object' &&
    data !== null &&
    'user' in data
  ) {
    // только здесь TypeScript знает структуру
  }
}
```

**Правило для архитектора:** `any` в новом коде — это технический долг.
Единственное легитимное применение `any` — временная заглушка при
миграции JS → TS или интеграция с очень сложными legacy типами.

### Interface vs Type — когда что выбирать

```typescript
// Interface — для объектов и классов
// Поддерживает extends, implements, declaration merging
interface User {
  id: number;
  name: string;
}

interface AdminUser extends User {
  permissions: string[];
}

// Type — для всего остального
// Union types, intersection, mapped types, conditional types
type ID = string | number;
type Nullable<T> = T | null;
type Status = 'pending' | 'active' | 'closed';
```

**Практическое правило:**
- Публичные API библиотек и модулей → `interface` (расширяемость)
- Внутренние типы, aliases, сложные вычисления → `type`
- Когда сомневаешься → `interface`

### Union и Intersection типы

```typescript
// Union — ИЛИ
type StringOrNumber = string | number;

// Intersection — И (объединение всех полей)
type Admin = User & { permissions: string[] };

// Discriminated Union — мощный паттерн моделирования состояний
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

Discriminated Union с полем `status` позволяет TypeScript
**автоматически сужать тип** в условных блоках:

```typescript
function render<T>(state: RequestState<T>) {
  switch (state.status) {
    case 'success':
      return state.data; // TypeScript знает: data существует
    case 'error':
      return state.error.message; // TypeScript знает: error существует
  }
}
```

### Улучшенное сужение типов в TypeScript 5.9

TypeScript 5.9 улучшил narrowing для сложных union-паттернов
с дженериками — меньше ручных приведений типов:

```typescript
// TypeScript 5.8 — требовался ручной cast
function handle<T>(res: ApiResponse<T>) {
  if (res.status === 'success') {
    return (res as Extract<typeof res, { status: 'success' }>).data;
  }
}

// TypeScript 5.9 — сужает корректно без cast
function handle<T>(res: ApiResponse<T>) {
  if (res.status === 'success') {
    return res.data; // TypeScript выводит T корректно
  }
}
```

### Generics — параметризованные типы

```typescript
// Без Generic — дублирование или потеря типов
function firstItem(arr: number[]): number { return arr; }
function firstItem(arr: string[]): string { return arr; }

// С Generic — одна функция, типы сохраняются
function firstItem<T>(arr: T[]): T | undefined {
  return arr;
}

const num = firstItem([^1][^2][^3]);    // тип: number | undefined
const str = firstItem(['a', 'b']);   // тип: string | undefined
```

**Ограничения Generic (constraints):**

```typescript
// T должен иметь поле id
function findById<T extends { id: number }>(
  items: T[],
  id: number
): T | undefined {
  return items.find(item => item.id === id);
}
```

**Граничный случай — Generic по умолчанию слишком широкий:**
Когда AI-кодер пишет `<T>` без ограничений там, где они нужны —
внутри функции невозможно обратиться ни к каким свойствам T.
Это ошибка компиляции, которую легко пропустить на этапе проектирования.

---

## 3. Продвинутые типы

### Utility Types — встроенный инструментарий

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

Partial<User>              // все поля опциональны
Required<User>             // все поля обязательны
Readonly<User>             // нельзя изменять поля
Pick<User, 'id'|'name'>   // только выбранные поля
Omit<User, 'password'>    // все кроме указанных
Record<string, User>       // словарь { [key: string]: User }

ReturnType<typeof fn>      // тип возвращаемого значения функции
Parameters<typeof fn>      // кортеж типов параметров функции
Awaited<Promise<User>>     // разворачивает Promise → User

// TypeScript 5.9+ — новые utility types
NoInfer<T>                 // запрет на вывод T из этой позиции
```

**Практическое применение в архитектуре:**

```typescript
// DTO для создания — без id (генерируется сервером)
type CreateUserDTO = Omit<User, 'id'>;

// DTO для обновления — все поля опциональны кроме id
type UpdateUserDTO = Partial<Omit<User, 'id'>> & Pick<User, 'id'>;

// Публичный профиль — без пароля
type PublicUser = Omit<User, 'password'>;
```

### satisfies — валидация без потери типа

Оператор `satisfies` (TypeScript 4.9+, широкое применение в 5.x)
решает классическую дилемму: проверить тип объекта,
но сохранить его специфичность.

```typescript
// ❌ as — теряет специфичность, нет проверки
const config = {
  port: 3000,
  host: 'localhost',
} as ServerConfig;
// тип теперь ServerConfig — потеряли знание что port === 3000

// ❌ явная аннотация — тоже теряет специфичность
const config: ServerConfig = {
  port: 3000,
  host: 'localhost',
};

// ✅ satisfies — валидирует И сохраняет специфичность
const config = {
  port: 3000,
  host: 'localhost',
} satisfies ServerConfig;
// тип: { port: number, host: string } — специфичный
// но компилятор проверил соответствие ServerConfig
```

**Практическое применение:**

```typescript
// Конфиг роутов с сохранением литеральных типов
const routes = {
  home:    { url: '/',       auth: false },
  profile: { url: '/profile', auth: true  },
  admin:   { url: '/admin',  auth: true  },
} satisfies Record<string, { url: string; auth: boolean }>;

// routes.home.url имеет тип '/' — не просто string
// Автокомплит и проверки работают точно
```

### import defer (TypeScript 5.9)

Ленивая загрузка модулей — выполнение откладывается до первого
обращения к экспортам:

```typescript
// import defer — модуль загружается, но не выполняется сразу
import defer * as heavyModule from './heavy-processing';

// ... другой код ...

// Модуль выполняется только здесь — при первом обращении
const result = heavyModule.process(data);
```

**Практическое значение:**
Ускоряет холодный старт приложений с большим количеством импортов.
Особенно полезно для CLI-инструментов и Electron-приложений,
где время запуска критично.

### --erasableSyntaxOnly (TypeScript 5.8)

Флаг для совместимости с Node.js `--experimental-strip-types`
и runtime-исполнения TypeScript без компиляции:

```bash
# Node.js 22+ может запускать .ts файлы напрямую
node --experimental-strip-types app.ts
```

При `--erasableSyntaxOnly: true` TypeScript запрещает конструкции
с runtime-семантикой (enum, namespace, параметрические декораторы
старого стиля) — остаётся только «стираемый» синтаксис типов.

**Архитектурное значение:** Упрощает toolchain — можно запускать
TypeScript напрямую в Node.js 22+ без tsc или ts-node для dev-окружения.

### Conditional Types

```typescript
// Базовый синтаксис: T extends U ? TypeIfTrue : TypeIfFalse
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false

// Встроенные conditional types
NonNullable<T>    // убирает null и undefined
Extract<T, U>     // оставляет только типы из T, совместимые с U
Exclude<T, U>     // убирает из T типы, совместимые с U
```

**Практический пример — извлечение типа из Promise:**
```typescript
// Нужен тип данных, которые возвращает async функция
async function fetchUser(): Promise<User> { ... }

type UserType = Awaited<ReturnType<typeof fetchUser>>;
// UserType = User — без дублирования определения типа
```

### Mapped Types

```typescript
// Создаём новый тип, итерируя по ключам существующего
type Optional<T> = {
  [K in keyof T]?: T[K];
};

// Расширенный пример — добавить валидацию к каждому полю
type WithValidation<T> = {
  [K in keyof T]: {
    value: T[K];
    isValid: boolean;
    error?: string;
  };
};

type UserForm = WithValidation<User>;
```

### Template Literal Types

```typescript
```
type EventName<T extends string> = `on${Capitalize<T>}`;
```

type DOMEvents = EventName<'click' | 'change' | 'submit'>;
// 'onClick' | 'onChange' | 'onSubmit'
```

---

## 4. tsconfig — архитектурные решения

### Актуальная базовая конфигурация (TypeScript 5.9)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    "strict": true,

    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    "declaration": true,
    "sourceMap": true,
    "incremental": true,

    "paths": {
      "@core/*":   ["./src/core/*"],
      "@config/*": ["./src/config/*"]
    }
  }
}
```

**Новый `tsc --init` в TypeScript 5.9** генерирует компактный
современный tsconfig вместо файла с сотнями закомментированных строк.
Включает `noUncheckedIndexedAccess` и `exactOptionalPropertyTypes`
по умолчанию.

### strict: true в TypeScript 5.9 — полный состав

```
strict: true = включает:
  ├── strictNullChecks              — null/undefined отдельные типы
  ├── noImplicitAny                 — запрет неявного any
  ├── strictFunctionTypes           — строгая проверка параметров функций
  ├── strictBindCallApply           — проверка .bind(), .call(), .apply()
  ├── strictPropertyInitialization  — поля класса должны быть инициализированы
  ├── useUnknownInCatchVariables    — err в catch имеет тип unknown
  └── strictInference               — НОВОЕ в 5.9: строже проверяет
                                      unchecked generics и conditional types
```

**Граничный случай — strict и catch:**

```typescript
// С strict: true — err имеет тип unknown
try {
  await fetchData();
} catch (err) {
  // ❌ нельзя обращаться к .message напрямую
  console.error(err.message);

  // ✅ нужна проверка
  if (err instanceof Error) {
    console.error(err.message);
  }
}
```

### --module node18 (TypeScript 5.8)

Стабильный флаг для проектов зафиксированных на Node.js 18:

```json
{
  "compilerOptions": {
    "module": "node18",
    "moduleResolution": "node18"
  }
}
```

Для Node.js 22+ используй `NodeNext` — он всегда указывает
на актуальную семантику.

### Разные tsconfig для разных окружений

```
tsconfig.json           ← базовый (общие настройки)
tsconfig.main.json      ← для main процесса Electron
tsconfig.renderer.json  ← для renderer процесса Electron
tsconfig.test.json      ← для тестов
```

```json
// tsconfig.main.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS"
  },
  "include": ["src/main.ts", "src/preload.ts"]
}
```

### --erasableSyntaxOnly в tsconfig

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

Комбинация этих двух флагов готовит проект к запуску через
`node --experimental-strip-types` без отдельного шага компиляции.

---

## 5. Паттерны проектирования через типы

### Exhaustiveness Check — защита от незакрытых кейсов

```typescript
type DocumentType = 'passport' | 'inn' | 'snils';

function processDocument(type: DocumentType) {
  switch (type) {
    case 'passport': return handlePassport();
    case 'inn':      return handleInn();
    case 'snils':    return handleSnils();

    default:
      // При добавлении нового типа в DocumentType —
      // TypeScript выдаст ошибку здесь
      const _exhaustive: never = type;
      throw new Error(`Необработанный тип: ${_exhaustive}`);
  }
}
```

### Builder Pattern с типами

```typescript
class QueryBuilder<T extends object> {
  private filters: Partial<T> = {};

  where<K extends keyof T>(key: K, value: T[K]): this {
    this.filters[key] = value;
    return this;
  }

  build(): Partial<T> {
    return this.filters;
  }
}

const query = new QueryBuilder<User>()
  .where('name', 'Alex')   // ✅ string
  .where('id', 42)         // ✅ number
  .where('id', 'wrong')    // ❌ ошибка компиляции
  .build();
```

### Branded Types — защита от перепутывания примитивов

```typescript
// Проблема: string везде одинаковый — легко перепутать
type CourtId  = string & { readonly __brand: 'CourtId' };
type RegionId = string & { readonly __brand: 'RegionId' };

function findCourt(id: CourtId) { ... }
function findRegion(id: RegionId) { ... }

declare const courtId: CourtId;
declare const regionId: RegionId;

findCourt(regionId); // ❌ ошибка компиляции — защита работает
```

### satisfies + as const — мощная комбинация

```typescript
// Строгая типизация конфига с сохранением литеральных значений
const MODEL_LIMITS = {
  'qwen/qwen3-32b':      { rpm: 30,  tpd: 500_000  },
  'openai/gpt-oss-120b': { rpm: 20,  tpd: 1_000_000 },
  'kimi/k2':             { rpm: 15,  tpd: 750_000  },
} as const satisfies Record<string, { rpm: number; tpd: number }>;

// MODEL_LIMITS['qwen/qwen3-32b'].rpm имеет тип 30 — не просто number
// Компилятор проверил структуру каждой записи
```

### Зодификация — runtime валидация + compile-time типы

```typescript
import { z } from 'zod';

const CourtSchema = z.object({
  code:    z.string().regex(/^\d{2}[A-Z]{2}\d{4}$/),
  name:    z.string().min(1),
  region:  z.number().int().min(1).max(99),
  website: z.string().url().optional(),
});

// Тип выводится автоматически
type Court = z.infer<typeof CourtSchema>;

// Валидация данных из API
const result = CourtSchema.safeParse(apiResponse);
if (result.success) {
  const court = result.data; // тип Court
} else {
  console.error(result.error.issues);
}
```

**Это решает главную проблему TypeScript:** типы существуют только
на этапе компиляции. Данные из API, файлов, пользовательского ввода —
приходят в runtime без гарантий. Zod закрывает этот gap.

---

## 6. Граничные случаи и ловушки

### Ловушка 1 — Type Assertion вместо Guard

```typescript
// ❌ Опасно — компилятор доверяет нам, реальной проверки нет
const user = response.data as User;
user.name.toUpperCase(); // упадёт если data не User

// ✅ Безопасно — реальная проверка структуры
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    typeof (data as User).name === 'string'
  );
}
```

### Ловушка 2 — Лишние аннотации там, где работает inference

```typescript
// ❌ Избыточно — TypeScript сам выведет тип
```
const users: Array<User> = new Array<User>();
```
const count: number = 0;
const name: string = 'Alex';

// ✅ Чисто — inference справляется
const users = new Array<User>();
const count = 0;
const name = 'Alex';
```

### Ловушка 3 — Enum генерирует лишний код

```typescript
// ❌ Enum — генерирует реальный JS объект
enum Status {
  Pending = 'pending',
  Active  = 'active',
}

// ✅ as const — только типы, никакого лишнего кода
const Status = {
  Pending: 'pending',
  Active:  'active',
} as const;

type Status = typeof Status[keyof typeof Status];
// 'pending' | 'active'
```

### Ловушка 4 — Declaration merging неожиданно меняет типы

```typescript
// Файл без export — TypeScript считает его глобальным скриптом
interface Config { ... }  // ← глобальная, конфликтует со всем проектом

// Исправление — сделать файл модулем
export interface Config { ... }
// или
export {}; // пустой export превращает файл в модуль
```

### Ловушка 5 — noUncheckedIndexedAccess ломает старый код

При включении `noUncheckedIndexedAccess: true` (рекомендуется в 5.9):

```typescript
const arr =;[^1][^2][^3]

// ❌ С noUncheckedIndexedAccess тип arr = number | undefined
const first: number = arr; // ошибка компиляции

// ✅ Явная проверка
const first = arr;
if (first !== undefined) {
  const doubled = first * 2;
}

// ✅ Или через деструктуризацию — тип чище
const [first] = arr; // тип: number | undefined, явно
```

AI-кодеры часто не учитывают этот флаг и генерируют код,
который не компилируется при включённом `noUncheckedIndexedAccess`.

---

## 7. TypeScript и AI-кодер

### Что AI делает хорошо

- Генерирует базовые интерфейсы по описанию структуры
- Пишет Zod-схемы по описанию данных
- Создаёт utility types для стандартных трансформаций
- Добавляет типы к существующему JS-коду

### Где AI систематически ошибается

**Слишком широкие типы:**
```typescript
// AI часто генерирует
function process(data: object): any { ... }

// Должно быть
function process<T extends ProcessableDocument>(data: T): ProcessResult<T> { ... }
```

**Игнорирует strictNullChecks:**
```typescript
// AI пишет так (работает без strict)
function getUserName(user: User): string {
  return user.name; // если name может быть null — runtime ошибка
}

// Должно быть
function getUserName(user: User): string {
  return user.name ?? 'Unknown';
}
```

**Использует any при затруднении:**
```typescript
// ❌ AI при сложных типах отступает к
const result: any = complexOperation();

// ✅ Правильно
const result: unknown = complexOperation();
```

**Не использует satisfies там где нужно:**
```typescript
// ❌ AI теряет специфичность
const config: AppConfig = { port: 3000, host: 'localhost' };

// ✅ satisfies сохраняет литеральные типы
const config = { port: 3000, host: 'localhost' } satisfies AppConfig;
```

### Как правильно ставить задачу AI-кодеру

Плохо:
> «Напиши функцию обработки документов»

Хорошо:
> «Напиши generic функцию `processDocument<T extends BaseDocument>`.
> Принимает документ и массив процессоров типа `Processor<T>[]`.
> Возвращает `Promise<ProcessResult<T>>` где ProcessResult содержит
> поле result типа T и поле errors типа ValidationError[].
> strict: true, noUncheckedIndexedAccess: true.
> Не использовать any. satisfies для конфигов. TypeScript 5.9.»

---

## 8. Чеклист архитектора

### Базовая конфигурация
- [ ] `strict: true` в tsconfig — обязательно для нового кода
- [ ] `noUncheckedIndexedAccess: true` — защита от undefined при индексации
- [ ] `exactOptionalPropertyTypes: true` — строже проверяет optional поля
- [ ] Стандарт модулей определён (`NodeNext` для Node.js 22+)
- [ ] Path aliases настроены — нет `../../../` в импортах
- [ ] Отдельные tsconfig для разных окружений если проект сложный

### Типизация данных
- [ ] Нет `any` в новом коде — только `unknown` где тип неизвестен
- [ ] Внешние данные (API, файлы, env) валидируются через Zod или type guard
- [ ] Discriminated unions используются для моделирования состояний
- [ ] Enum заменены на `as const` объекты
- [ ] `satisfies` используется для конфигов и словарей

### Архитектурные паттерны
- [ ] Exhaustiveness check в switch по discriminated union
- [ ] DTO типы строятся через `Pick`/`Omit`/`Partial` из базовых типов
- [ ] Generic constraints (`extends`) используются — не голые `<T>`
- [ ] Type assertion (`as`) используется только с обоснованием

### Новые возможности TypeScript 5.8–5.9
- [ ] `import defer` для тяжёлых модулей с ленивой инициализацией
- [ ] `erasableSyntaxOnly` если планируется запуск через node --strip-types
- [ ] `strictInference` включён через `strict: true`

### AI-код ревью
- [ ] Нет необоснованных `any`
- [ ] Nullable значения обработаны явно
- [ ] Типы параметров не шире необходимого
- [ ] Return types явно указаны для публичных функций
- [ ] `noUncheckedIndexedAccess` учтён при индексации массивов

---

## Связь с проектами

| Паттерн | Где используется |
|---------|-----------------|
| Несколько tsconfig | OptimizatorNG (main/renderer) |
| Generic pipeline | DocOrchestrator, Floronym |
| Discriminated union | Court-Harvester (статусы) |
| satisfies + as const | Floronym MODEL_LIMITS конфиг |
| Zod-валидация | Рекомендуется добавить в Court-Harvester, FloraMaverick |
| import defer | WebForge — ленивая загрузка тяжёлых модулей сборки |
| Branded types | FIAS-parser — CourtId / RegionId |

---

*Модуль 02 завершён.*
*Следующий: [Модуль 03 — PHP](../03-php/README.md)*
