# Модуль 01 — JavaScript / Node.js

> **Для AI-архитектора:** не как писать, а как работает внутри.
> Один день изучения — полное понимание механики платформы.

---

## Содержание

1. [Как работает JS под капотом](#1-как-работает-js-под-капотом)
2. [Асинхронность — эволюция модели](#2-асинхронность--эволюция-модели)
3. [Модульная система и ESM](#3-модульная-система-и-esm)
4. [Потоки и параллелизм](#4-потоки-и-параллелизм)
5. [Node.js как платформа](#5-nodejs-как-платформа)
6. [Архитектурные паттерны](#6-архитектурные-паттерны)
7. [Чеклист архитектора](#7-чеклист-архитектора)

---

## 1. Как работает JS под капотом

### Event Loop — главная идея платформы

JavaScript однопоточный. Это означает: в каждый момент времени
выполняется ровно одна операция. Никакого параллелизма на уровне
кода — только **видимость** параллелизма через асинхронность.

Вот что происходит внутри Node.js в каждый момент времени:

```
┌─────────────────────────────┐
│         Call Stack          │  ← здесь выполняется синхронный код
└─────────────────────────────┘
           ↓ пусто?
┌─────────────────────────────┐
│       Microtask Queue       │  ← Promise.then(), queueMicrotask()
│    (приоритет — высокий)    │  ← очищается ПОЛНОСТЬЮ перед следующим тиком
└─────────────────────────────┘
           ↓ пусто?
┌─────────────────────────────┐
│       Macrotask Queue       │  ← setTimeout, setInterval, I/O callbacks
│   (приоритет — обычный)     │  ← берётся ОДНА задача за тик
└─────────────────────────────┘
```

**Тик Event Loop** — это один полный цикл: проверить стек →
очистить микротаски → взять одну макротаску → снова.

### Call Stack

Стек вызовов — это список функций, которые сейчас выполняются.
Каждый вызов функции добавляет фрейм, возврат — удаляет.

Когда стек **пуст** — Event Loop берёт следующую задачу из очереди.
Пока стек **не пуст** — ничто другое не выполняется. Никогда.

**Практический вывод для архитектора:**
Любой тяжёлый синхронный код (большой цикл, сложные вычисления)
**блокирует весь процесс**. Пока он выполняется — никакие HTTP-запросы
не обрабатываются, никакие таймеры не срабатывают.
Это самая частая причина «зависания» Node.js сервера.

### Heap

Область памяти, где хранятся объекты. Управляется сборщиком мусора
V8 (движок JS). Архитектору важно знать два момента:

- **Утечки памяти** в Node.js почти всегда — это объекты в Heap,
  на которые остаётся ссылка дольше нужного (глобальные переменные,
  незакрытые EventEmitter подписки, кэши без ограничения размера)
- **--max-old-space-size** — флаг запуска Node.js, который
  ограничивает размер Heap. По умолчанию ~1.5GB. При обработке
  больших файлов нужно увеличивать явно

### Microtasks vs Macrotasks — практическая разница

```javascript
// Порядок выполнения:
console.log('1');                        // синхронно → сразу

setTimeout(() => console.log('2'), 0);  // macrotask → в конце тика

Promise.resolve().then(
  () => console.log('3')                // microtask → до macrotask
);

console.log('4');                        // синхронно → сразу

// Вывод: 1, 4, 3, 2
```

**Почему это важно архитектору:**
Если AI-кодер ставит критическую логику в `setTimeout(fn, 0)` вместо
`Promise.resolve().then(fn)` — порядок выполнения может быть нарушен
в граничных случаях. Разница не в задержке, а в приоритете.

### libuv — невидимый движок

Node.js использует библиотеку **libuv** для всех I/O операций.
Именно она управляет:
- Файловой системой (fs)
- Сетевыми операциями
- Таймерами
- Thread Pool для операций, которые нельзя сделать асинхронно (например, DNS lookup, некоторые операции fs)

Thread Pool libuv по умолчанию = **4 потока**. При интенсивной
работе с файлами это узкое место. Настраивается через:
`UV_THREADPOOL_SIZE=16 node app.js`

---

## 2. Асинхронность — эволюция модели

### Почему асинхронность вообще нужна

Node.js оптимизирован под **I/O-bound задачи** — когда программа
большую часть времени ждёт: ответа от API, чтения файла, запроса к БД.

В этот момент ожидания CPU свободен. Асинхронность позволяет
использовать это время для другой работы — без создания новых потоков.

Именно поэтому Node.js держит тысячи одновременных соединений
там, где PHP или Java создали бы тысячи потоков и упали бы под
нагрузкой памяти.

### Callbacks — первое поколение (проблема)

```javascript
fs.readFile('a.txt', (err, dataA) => {
  fs.readFile('b.txt', (err, dataB) => {
    fs.readFile('c.txt', (err, dataC) => {
      // Callback Hell — пирамида смерти
      // Обработка ошибок в каждом уровне отдельно
      // Невозможно нормально прервать цепочку
    });
  });
});
```

Проблема не в синтаксисе. Проблема в том, что управление потоком
(try/catch, return, break) перестаёт работать предсказуемо.

### Promises — второе поколение (решение)

Promise — это объект, представляющий **будущий результат** операции.
Три состояния: `pending` → `fulfilled` или `rejected`.

```javascript
// Цепочка вместо вложенности
readFile('a.txt')
  .then(dataA => readFile('b.txt'))
  .then(dataB => readFile('c.txt'))
  .catch(err => /* одна точка обработки ошибок */);
```

**Ключевые методы — когда что выбирать:**

| Метод | Когда использовать |
|-------|-------------------|
| `Promise.all([...])` | Все операции нужны, при одной ошибке — стоп |
| `Promise.allSettled([...])` | Нужны все результаты, ошибки не критичны |
| `Promise.race([...])` | Нужен первый ответ (таймаут, fallback) |
| `Promise.any([...])` | Нужен первый успешный (несколько источников) |

**Граничный случай — необработанный rejected Promise:**

```javascript
// Это МОЛЧА проглатывает ошибку в старых версиях Node.js
somePromise.then(result => {
  throw new Error('упс');
  // .catch() не добавлен
});
```

В Node.js 15+ это вызывает `UnhandledPromiseRejection` и крашит
процесс. Всегда добавляй глобальный обработчик:

```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});
```

### async/await — третье поколение (синтаксический сахар)

`async/await` — это не новая асинхронная модель. Это синтаксис
поверх Promises, который делает асинхронный код похожим на синхронный.

```javascript
async function processFiles() {
  try {
    const dataA = await readFile('a.txt');  // ждёт, но не блокирует
    const dataB = await readFile('b.txt');
    return dataA + dataB;
  } catch (err) {
    // обычный try/catch работает
  }
}
```

**Главная ловушка async/await для архитектора:**

```javascript
// ❌ Последовательно — медленно (ждём каждый файл)
const a = await readFile('a.txt');
const b = await readFile('b.txt');
const c = await readFile('c.txt');

// ✅ Параллельно — быстро (все три запускаются одновременно)
const [a, b, c] = await Promise.all([
  readFile('a.txt'),
  readFile('b.txt'),
  readFile('c.txt')
]);
```

Когда AI-кодер генерирует последовательные `await` там, где
возможен `Promise.all` — это архитектурная проблема производительности,
не синтаксическая.

### Граничный случай: async в циклах

```javascript
// ❌ forEach не ждёт async callback — баг, который сложно заметить
items.forEach(async (item) => {
  await process(item); // выполняется, но forEach не ждёт
});
// код после forEach продолжается немедленно

// ✅ for...of ждёт каждую итерацию
for (const item of items) {
  await process(item);
}

// ✅ Параллельно для всех
await Promise.all(items.map(item => process(item)));
```

Это одна из самых частых ошибок в AI-генерированном коде.
Всегда проверяй циклы с async-операциями.

---

## 3. Модульная система и ESM

### CommonJS — старый стандарт

```javascript
// require — синхронный, блокирующий
const fs = require('fs');
module.exports = { myFunction };
```

CommonJS загружает модули **синхронно** во время выполнения.
Это означает: `require()` можно вызвать в любом месте кода,
даже внутри `if` блока или функции.

### ESM — современный стандарт

```javascript
// import — статический, анализируется до выполнения
import fs from 'fs';
export { myFunction };
```

ESM импорты **статические** — движок знает все зависимости
до запуска кода. Это открывает tree-shaking, лучшую оптимизацию
и строгую цикличность зависимостей.

В Node.js ESM включается через:
- Расширение файла `.mjs`
- Поле `"type": "module"` в `package.json`

### Ключевые отличия для архитектора

| Аспект | CommonJS | ESM |
|--------|----------|-----|
| Загрузка | Синхронная, runtime | Асинхронная, compile-time |
| `require()` в условии | Можно | Нельзя |
| Top-level `await` | Нет | Да |
| `__dirname`, `__filename` | Есть | Нет (нужен `import.meta.url`) |
| Совместимость | Везде | Node.js 12+, современные бандлеры |

### Граничные случаи — где ломается

**Нельзя `require()` ESM-модуль из CommonJS напрямую:**
```javascript
// ❌ Это выбросит ошибку
const esModule = require('./esm-module.mjs');

// ✅ Нужен dynamic import
const esModule = await import('./esm-module.mjs');
```

**Смешанные проекты — распространённая боль:**
Когда в одном проекте часть файлов `.js` (CommonJS по умолчанию),
а часть `.mjs` — AI-кодер часто путает контекст и генерирует
несовместимый код. Архитектурное решение: **сразу определить
стандарт модулей для всего проекта** и зафиксировать в `package.json`.

**`__dirname` в ESM:**
```javascript
// В ESM нет __dirname — нужен обходной путь
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```
Это часто забывается AI-кодерами при переходе на ESM.

### Circular dependencies — скрытая проблема

```
moduleA.js импортирует moduleB.js
moduleB.js импортирует moduleA.js
```

В CommonJS это приводит к тому, что один из модулей получает
**пустой объект** вместо реального экспорта — без ошибки, молча.
В ESM — живые привязки решают часть проблем, но цикличность
всё равно является архитектурным запахом.

Признак проблемы в проекте: переменная импортирована, но равна
`undefined` в момент использования.

---

## 4. Потоки и параллелизм

### Streams — обработка без загрузки в память

Stream — это абстракция над последовательностью данных,
которые обрабатываются **по частям (chunks)**, не целиком.

```
Без Stream:    файл 2GB → загрузить всё в RAM → обработать
Со Stream:     файл 2GB → читать по 64KB → обрабатывать → писать
```

Четыре типа:
- **Readable** — источник данных (чтение файла, HTTP response)
- **Writable** — приёмник данных (запись файла, HTTP request)
- **Duplex** — и то, и другое (TCP socket)
- **Transform** — преобразование данных (gzip, шифрование)

**Pipe — основной паттерн работы со Streams:**
```javascript
// Читаем → сжимаем → пишем. Всё в потоке, память не накапливается
fs.createReadStream('large-file.txt')
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('large-file.txt.gz'));
```

**Граничный случай — backpressure:**
Если Readable генерирует данные быстрее, чем Writable их потребляет —
буфер переполняется. `.pipe()` управляет этим автоматически.
При ручной работе со Streams нужно проверять возвращаемое значение
`.write()` и ждать событие `'drain'`. AI-кодеры это часто упускают.

### Worker Threads — настоящий параллелизм

Worker Threads — это потоки внутри одного Node.js процесса с
**отдельным Event Loop** и **отдельной памятью**.

Когда нужны:
- CPU-bound задачи (обработка изображений, парсинг, шифрование)
- Когда одна операция не должна блокировать остальные
- Когда нужно использовать несколько ядер CPU

```
Главный поток (Event Loop)
    ↓ postMessage(data)
Worker Thread 1 (отдельный Event Loop)
Worker Thread 2 (отдельный Event Loop)
    ↓ parentPort.postMessage(result)
Главный поток получает результат
```

**Передача данных между потоками:**

```javascript
// Обычная передача — данные КОПИРУЮТСЯ (медленно для больших объектов)
worker.postMessage({ buffer: largeData });

// Zero-copy передача — право собственности ПЕРЕДАЁТСЯ (быстро)
// После transfer largeBuffer в главном потоке становится пустым
worker.postMessage(
  { buffer: largeBuffer },
  [largeBuffer]  // transferList — список объектов для передачи
);
```

Именно этот механизм используется в Image-Converter для
zero-copy передачи изображений в Piscina Workers.

### Piscina — пул Worker Threads

Piscina решает задачу управления пулом воркеров:
создание, переиспользование, очередь задач, ограничение concurrency.

```javascript
import Piscina from 'piscina';

const pool = new Piscina({
  filename: './worker.js',
  maxThreads: 8,        // максимум воркеров
  minThreads: 2,        // минимум (держать тёплыми)
});

// Отправка задачи в пул — автоматически выбирает свободный воркер
const result = await pool.run({ imageBuffer, options });
```

**Когда Piscina лучше прямых Worker Threads:**
- Много однотипных задач (обработка файлов, изображений)
- Нужна очередь с ограничением параллелизма
- Не хочется управлять жизненным циклом воркеров вручную

**Когда прямые Worker Threads лучше:**
- Долгоживущий фоновый поток с постоянным обменом данными
- Нужен двусторонний канал с сложным протоколом

### Child Processes — запуск внешних программ

`child_process` — для запуска внешних бинарников и команд:

```javascript
import { exec, spawn } from 'child_process';

// exec — буферизует весь вывод (не для больших данных)
exec('ffmpeg -version', (err, stdout) => { ... });

// spawn — стриминг вывода (для больших данных и долгих процессов)
const proc = spawn('ffmpeg', ['-i', 'input.mp4', 'output.webp']);
proc.stdout.pipe(outputStream);
```

**Разница spawn vs exec для архитектора:**
`exec` ждёт завершения и буферизует весь stdout. При большом
выводе — переполнение буфера и ошибка. `spawn` работает как Stream —
данные текут по мере появления.

---

## 5. Node.js как платформа

### fs — файловая система

```javascript
import fs from 'fs';
import { promises as fsp } from 'fs';

// Синхронно — блокирует Event Loop. Только для инициализации
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Асинхронно — правильный способ в runtime
const data = await fsp.readFile('data.json', 'utf8');
```

**Важные методы, которые AI-кодеры иногда путают:**

| Задача | Правильный метод |
|--------|-----------------|
| Создать директорию рекурсивно | `fs.mkdir(path, { recursive: true })` |
| Проверить существование файла | `fs.access()` или `try/catch` на `fs.stat()` |
| Скопировать файл | `fs.copyFile()` — атомарная операция |
| Переместить файл | `fs.rename()` — атомарно в пределах одного диска |
| Удалить директорию рекурсивно | `fs.rm(path, { recursive: true, force: true })` |

**Граничный случай — race condition:**
```javascript
// ❌ Проверка + действие — не атомарны, между ними файл может исчезнуть
if (await fileExists(path)) {
  await readFile(path); // может упасть
}

// ✅ Проще и надёжнее
try {
  await readFile(path);
} catch (err) {
  if (err.code === 'ENOENT') { /* файл не найден */ }
}
```

### path — работа с путями

```javascript
import path from 'path';

path.join('/users', 'alex', 'file.txt')  // '/users/alex/file.txt'
path.resolve('./relative')               // абсолютный путь
path.dirname('/users/alex/file.txt')     // '/users/alex'
path.basename('/users/alex/file.txt')    // 'file.txt'
path.extname('file.txt')                 // '.txt'
```

**Никогда не конкатенируй пути строками** (`dir + '/' + file`).
На Windows разделитель `\`, на Unix `/`. `path.join()` решает это.

### process — управление процессом

```javascript
process.env.MY_VAR          // переменные окружения
process.argv                // аргументы командной строки
process.cwd()               // текущая рабочая директория
process.exit(0)             // завершение (0 — успех, 1 — ошибка)
process.memoryUsage()       // использование памяти (диагностика)

// Graceful shutdown — корректное завершение
process.on('SIGTERM', async () => {
  await cleanup();   // закрыть соединения, дописать файлы
  process.exit(0);
});
```

### EventEmitter — основа Node.js

Большинство встроенных объектов Node.js (fs, http, stream)
наследуют EventEmitter. Это паттерн publish/subscribe:

```javascript
import { EventEmitter } from 'events';

const emitter = new EventEmitter();

emitter.on('data', (chunk) => { /* обработчик */ });
emitter.emit('data', buffer);
```

**Граничный случай — утечка памяти через EventEmitter:**
По умолчанию Warning если > 10 обработчиков на одно событие.
Это не ошибка, но сигнал об архитектурной проблеме — обработчики
добавляются, но не удаляются.

```javascript
// Всегда удаляй обработчики когда они больше не нужны
emitter.off('data', handler);
// или одноразовый обработчик
emitter.once('data', handler);
```

### Почему Node.js плох для CPU-задач

Node.js оптимизирован для I/O. Для CPU:
- Нет встроенной многопоточности в основном потоке
- Тяжёлые вычисления блокируют весь Event Loop
- Другие запросы не обрабатываются в это время

**Архитектурное решение для CPU-задач в Node.js:**
1. Worker Threads / Piscina — для вычислений внутри процесса
2. Child Process — для запуска внешних бинарников (ffmpeg, imagemagick)
3. Микросервис на Go / Rust — для критически CPU-интенсивных операций

Именно поэтому raster-forge написан на Go, а не Node.js —
растеризация PDF является CPU-bound задачей.

---

## 6. Архитектурные паттерны

### Pipeline паттерн

Последовательная обработка данных через независимые шаги.
Каждый шаг получает данные, трансформирует, передаёт дальше.

```javascript
// Функциональный pipeline
const result = await pipeline(
  inputData,
  [
    validateStep,
    normalizeStep,
    transformStep,
    outputStep,
  ]
);

async function pipeline(data, steps) {
  let current = data;
  for (const step of steps) {
    current = await step(current);
  }
  return current;
}
```

**Признак правильного pipeline для AI-кодера:**
- Каждый шаг — чистая функция: один вход, один выход
- Шаг не знает о других шагах
- Шаг можно отключить, заменить, протестировать изолированно

Именно эта архитектура используется в DocOrchestrator и OptimizatorNG.

### Config-driven design

Логика определяется конфигурацией, не кодом.

```javascript
// ❌ Логика в коде — нужна перекомпиляция для изменения
if (documentType === 'passport') {
  fields = ['series', 'number', 'issued_by'];
} else if (documentType === 'inn') {
  fields = ['number', 'date'];
}

// ✅ Логика в конфиге — меняется без кода
const config = {
  passport: { fields: ['series', 'number', 'issued_by'] },
  inn:      { fields: ['number', 'date'] }
};
const fields = config[documentType].fields;
```

**Когда config-driven подход оправдан:**
- Много однотипных сущностей с разными параметрами
- Нетехнические пользователи должны менять поведение
- Поведение меняется часто

**Когда не оправдан:**
- Сложная бизнес-логика с ветвлениями — конфиг становится кодом в JSON
- Небольшой проект с 2-3 вариантами — избыточная абстракция

### Graceful Shutdown

Корректное завершение процесса — сохранение данных,
закрытие соединений, дописывание файлов.

```javascript
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Получен ${signal}, завершаем...`);

  // 1. Перестать принимать новые задачи
  server.close();

  // 2. Завершить текущие операции
  await processingQueue.drain();

  // 3. Закрыть соединения
  await database.close();

  // 4. Сохранить состояние
  await state.save();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));  // Ctrl+C
```

**Типичные ошибки AI-кодеров в graceful shutdown:**
- Не обрабатывают `SIGTERM` (Docker stop)
- Не ждут завершения текущих операций
- Нет таймаута — процесс зависает навсегда

Добавляй таймаут принудительного завершения:
```javascript
setTimeout(() => {
  console.error('Принудительное завершение по таймауту');
  process.exit(1);
}, 10000); // 10 секунд максимум
```

### Error Classes Hierarchy

Типизированные ошибки вместо строковых сообщений:

```javascript
// Базовый класс
class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Специфичные классы
class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

class ApiError extends AppError {
  constructor(message, apiName, statusCode) {
    super(message, 'API_ERROR', statusCode);
    this.apiName = apiName;
  }
}

// В обработчике
try {
  await callExternalApi();
} catch (err) {
  if (err instanceof ApiError && err.statusCode === 429) {
    await sleep(retryAfter);
    // retry
  } else if (err instanceof ValidationError) {
    // не ретраим — данные неверны
    throw err;
  }
}
```

**Почему это важно архитектору:**
Когда AI-кодер пишет `throw new Error('api rate limit')` — в
обработчике нельзя надёжно отличить rate limit от network error
от validation error. Типизированные ошибки делают обработку
детерминированной.

---

## 7. Чеклист архитектора

Перед тем как принять решение или верифицировать AI-код:

### Event Loop и производительность
- [ ] Нет тяжёлых синхронных операций в hot path (циклы > 100ms)
- [ ] `fs.readFileSync` используется только при инициализации
- [ ] CPU-intensive задачи вынесены в Worker Threads

### Асинхронность
- [ ] Независимые async операции запускаются параллельно через `Promise.all`
- [ ] `forEach` не используется с async callback
- [ ] Есть `process.on('unhandledRejection')` глобальный обработчик
- [ ] `.catch()` есть на каждой Promise-цепочке или есть try/catch

### Модули
- [ ] Стандарт модулей (CJS или ESM) определён для всего проекта
- [ ] Нет circular dependencies в критических модулях
- [ ] В ESM-проекте `__dirname` заменён на `import.meta.url`

### Память и ресурсы
- [ ] Большие файлы обрабатываются через Streams, не `readFile`
- [ ] EventEmitter обработчики удаляются когда не нужны
- [ ] Worker Threads получают данные через transferList для больших буферов

### Завершение и ошибки
- [ ] Graceful shutdown обрабатывает SIGTERM и SIGINT
- [ ] Есть таймаут принудительного завершения
- [ ] Ошибки типизированы — не просто `new Error(string)`
- [ ] Логируется достаточно контекста для диагностики без дебаггера

---

## Задачи AI-кодеру — правильные формулировки

Плохая формулировка — размытая, AI выберет простейшее решение:
> «Напиши функцию чтения файлов»

Хорошая формулировка — с архитектурными ограничениями:
> «Напиши функцию пакетного чтения файлов через Streams.
> Файлы могут быть до 10GB. Используй pipeline из fs.createReadStream
> и Transform stream. Обработай backpressure. Верни AsyncIterator.»

Формула: **что делает** + **ограничения** + **конкретные технологии** + **формат результата**

---

*Модуль 01 завершён.*
*Следующий: [Модуль 02 — TypeScript](../02-typescript/README.md)*
