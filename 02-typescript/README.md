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
// - что может пойти не так (throws ApiError)
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

Partial<User>          // все поля опциональны { id?: number; name?: string; ... }
Required<User>         // все поля обязательны
Readonly<User>         // нельзя изменять поля
Pick<User, 'id'|'name'>   // только выбранные поля
Omit<User, 'password'>    // все кроме указанных
Record<string, User>   // словарь { [key: string]: User }

ReturnType<typeof fn>  // тип возвращаемого значения функции
Parameters<typeof fn>  // кортеж типов параметров функции
Awaited<Promise<User>> // разворачивает Promise → User
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
  [K in keyof T]?: T[K];  // ? делает каждое поле опциональным
};

// Это то, что делает встроенный Partial<T>

// Расширенный пример — добавить валидацию к каждому полю
type WithValidation<T> = {
  [K in keyof T]: {
    value: T[K];
    isValid: boolean;
    error?: string;
  };
};

type UserForm = WithValidation<User>;
// { id: { value: number, isValid: boolean, error?: string }, ... }
```

### Template Literal Types

```typescript
// Типы из строковых шаблонов
```
type EventName<T extends string> = `on${Capitalize<T>}`;
```

type ClickEvent = EventName<'click'>;   // 'onClick'
type ChangeEvent = EventName<'change'>; // 'onChange'

// Практическое применение — типизация конфига событий
type DOMEvents = EventName<'click' | 'change' | 'submit'>;
// 'onClick' | 'onChange' | 'onSubmit'
```

---

## 4. tsconfig — архитектурные решения

### Ключевые опции и их смысл

```json
{
  "compilerOptions": {

    // Целевая версия JS на выходе
    // ES2022+ для Node.js 18+ — нет нужды транспилировать всё
    "target": "ES2022",

    // Модульная система на выходе
    // NodeNext — правильный выбор для современного Node.js с ESM
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    // Строгий режим — ВСЕГДА включать в новых проектах
    "strict": true,

    // Генерировать .d.ts файлы для библиотек
    "declaration": true,

    // Инкрементальная компиляция — ускоряет повторные сборки
    "incremental": true,

    // Source maps для отладки
    "sourceMap": true,

    // Алиасы путей — вместо '../../../core' пишем '@core'
    "paths": {
      "@core/*": ["./src/core/*"],
      "@config/*": ["./src/config/*"]
    }
  }
}
```

### strict: true — что включает

```
strict: true = включает сразу:
  ├── strictNullChecks    — null/undefined не совместимы с другими типами
  ├── noImplicitAny       — запрет на неявный any
  ├── strictFunctionTypes — строгая проверка типов параметров функций
  ├── strictBindCallApply — проверка .bind(), .call(), .apply()
  ├── strictPropertyInit  — все поля класса должны быть инициализированы
  └── useUnknownInCatchVariables — переменная в catch имеет тип unknown
```

**Граничный случай — strict и catch:**

```typescript
// С strict: true — нельзя напрямую использовать err
try {
  await fetchData();
} catch (err) {
  // ❌ err имеет тип unknown, нельзя обращаться к .message
  console.error(err.message);

  // ✅ нужна проверка
  if (err instanceof Error) {
    console.error(err.message);
  }
}
```

### Разные tsconfig для разных окружений

В сложных проектах нужны несколько конфигов:

```
tsconfig.json           ← базовый (общие настройки)
tsconfig.main.json      ← для main процесса Electron
tsconfig.renderer.json  ← для renderer процесса Electron
tsconfig.test.json      ← для тестов (другой module resolution)
```

```json
// tsconfig.main.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS"  // Electron main нужен CJS
  },
  "include": ["src/main.ts", "src/preload.ts"]
}
```

Именно такая архитектура используется в OptimizatorNG.

---

## 5. Паттерны проектирования через типы

### Exhaustiveness Check — защита от незакрытых кейсов

```typescript
type DocumentType = 'passport' | 'inn' | 'snils';

function processDocument(type: DocumentType) {
  switch (type) {
    case 'passport': return handlePassport();
    case 'inn':      return handleInn();
    // snils не обработан!

    default:
      // Если добавить новый тип в DocumentType и забыть
      // добавить case — TypeScript выдаст ошибку здесь
      const _exhaustive: never = type;
      throw new Error(`Необработанный тип: ${_exhaustive}`);
  }
}
```

Это архитектурная страховка: при добавлении нового значения
в union тип — компилятор **заставит** обновить все switch/if.

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

// TypeScript знает типы значений для каждого ключа
const query = new QueryBuilder<User>()
  .where('name', 'Alex')   // ✅ string
  .where('id', 42)         // ✅ number
  .where('id', 'wrong')    // ❌ ошибка компиляции
  .build();
```

### Branded Types — защита от перепутывания примитивов

```typescript
// Проблема: string везде одинаковый — легко перепутать
function findCourt(id: string) { ... }
function findRegion(id: string) { ... }

findCourt(regionId); // ✅ компилируется, ❌ логическая ошибка

// Решение: branded types
type CourtId = string & { readonly __brand: 'CourtId' };
type RegionId = string & { readonly __brand: 'RegionId' };

function findCourt(id: CourtId) { ... }
function findRegion(id: RegionId) { ... }

findCourt(regionId as RegionId); // ❌ ошибка компиляции
```

### Зодификация — runtime валидация + compile-time типы

```typescript
import { z } from 'zod';

// Одно описание → и валидация, и тип
const CourtSchema = z.object({
  code:    z.string().regex(/^\d{2}[A-Z]{2}\d{4}$/),
  name:    z.string().min(1),
  region:  z.number().int().min(1).max(99),
  website: z.string().url().optional(),
});

// Тип выводится автоматически — не нужно дублировать
type Court = z.infer<typeof CourtSchema>;

// Валидация данных из API
const result = CourtSchema.safeParse(apiResponse);
if (result.success) {
  const court = result.data; // тип Court, безопасно использовать
} else {
  console.error(result.error.issues); // детализированные ошибки
}
```

**Это решает главную проблему TypeScript:** типы существуют только
на этапе компиляции. Данные из API, файлов, пользовательского ввода —
приходят в runtime без гарантий. Zod закрывает этот gap.

---

## 6. Граничные случаи и ловушки

### Ловушка 1 — Type Assertion вместо Guard

```typescript
// ❌ Опасно — просто убеждаем компилятор, реальной проверки нет
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

if (isUser(response.data)) {
  response.data.name.toUpperCase(); // безопасно
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

AI-кодеры из статически типизированных языков часто
добавляют явные аннотации везде. Это шум, не безопасность.

### Ловушка 3 — Мутация readonly данных через assertion

```typescript
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} as const;

// ❌ TypeScript это пропустит — as any убивает проверки
(config as any).apiUrl = 'hacked';

// Защиты от этого на уровне типов нет
// Защита — архитектурная: не передавать конфиг туда, где он может мутировать
```

### Ловушка 4 — Enum генерирует лишний код

```typescript
// ❌ Enum — генерирует реальный JS объект
enum Status {
  Pending = 'pending',
  Active  = 'active',
  Closed  = 'closed',
}
// В скомпилированном JS появится объект Status

// ✅ as const — только типы, никакого лишнего кода
const Status = {
  Pending: 'pending',
  Active:  'active',
  Closed:  'closed',
} as const;

type Status = typeof Status[keyof typeof Status];
// тип: 'pending' | 'active' | 'closed'
```

### Ловушка 5 — Declaration merging неожиданно меняет типы

```typescript
interface Window {
  myCustomProperty: string;
}
// Это не создаёт новый интерфейс — это РАСШИРЯЕТ глобальный Window
// Если в двух местах проекта одинаково назвать интерфейс —
// TypeScript молча объединит их. Может привести к
// неожиданным ошибкам компиляции в несвязанных местах.
```

### Ловушка 6 — Ошибки типов в d.ts файлах

```typescript
// Если в проекте есть файл без явного export/import —
// TypeScript считает его глобальным скриптом, а не модулем
// Все объявления становятся глобальными

// Файл types.ts без export:
interface Config { ... }  // ← глобальная, конфликтует со всеми

// Исправление — добавить любой export
export interface Config { ... }
// или пустой export чтобы сделать файл модулем
export {};
```

---

## 7. TypeScript и AI-кодер

### Что AI делает хорошо

- Генерирует базовые интерфейсы по описанию структуры
- Пишет utility types для стандартных трансформаций
- Добавляет типы к существующему JS-коду
- Создаёт Zod-схемы по описанию данных

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
// AI при сложных типах часто отступает к
const result: any = complexOperation();

// Правильно — разобраться с типом или использовать unknown
const result: unknown = complexOperation();
```

### Как правильно ставить задачу AI-кодеру

Плохо:
> «Напиши функцию обработки документов»

Хорошо:
> «Напиши generic функцию `processDocument<T extends BaseDocument>`.
> Она принимает документ и массив процессоров типа `Processor<T>[]`.
> Возвращает `Promise<ProcessResult<T>>` где ProcessResult содержит
> поле result типа T и поле errors типа ValidationError[].
> Используй strict null checks. Не используй any.»

Формула: **сигнатура** + **generic constraints** + **возвращаемый тип** + **ограничения**

---

## 8. Чеклист архитектора

### Базовая конфигурация
- [ ] `strict: true` в tsconfig — всегда для нового кода
- [ ] Стандарт модулей определён (`NodeNext` для Node.js, `ESNext` для браузера)
- [ ] Path aliases настроены — нет `../../../` в импортах
- [ ] Отдельные tsconfig для разных окружений если проект сложный

### Типизация данных
- [ ] Нет `any` в новом коде — только `unknown` там, где тип неизвестен
- [ ] Внешние данные (API, файлы, env) валидируются через Zod или type guard
- [ ] Discriminated unions используются для моделирования состояний
- [ ] Enum заменены на `as const` объекты

### Архитектурные паттерны
- [ ] Exhaustiveness check в switch по discriminated union
- [ ] DTO типы строятся через `Pick`/`Omit`/`Partial` из базовых типов
- [ ] Generic constraints (`extends`) используются — не голые `<T>`
- [ ] Type assertion (`as`) используется только с обоснованием

### AI-код ревью
- [ ] Нет необоснованных `any`
- [ ] Nullable значения обработаны явно
- [ ] Типы параметров не шире необходимого
- [ ] Return types явно указаны для публичных функций

---

## Связь с проектами

| Паттерн | Где используется |
|---------|-----------------|
| Несколько tsconfig | OptimizatorNG (main/renderer) |
| Generic pipeline | DocOrchestrator, Floronym |
| Discriminated union | Court-Harvester (статусы обновлений) |
| Zod-валидация | Рекомендуется добавить в Court-Harvester, FloraMaverick |
| Branded types | Рекомендуется для CourtId / RegionId в FIAS-parser |

---

*Модуль 02 завершён.*
*Следующий: [Модуль 03 — PHP](../03-php/README.md)*
