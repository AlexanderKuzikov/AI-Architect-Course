# Модуль 03 — PHP

> **Для AI-архитектора:** PHP давно не «язык для новичков».  
> PHP 8.4/8.5 — это современная платформа для генерации,  
> обработки текста и статической сборки. Именно то, что нужно WebForge.

---

## Содержание

1. [PHP в 2026 — честная оценка](#1-php-в-2026--честная-оценка)
2. [Механика выполнения](#2-механика-выполнения)
3. [Современный PHP 8.4 / 8.5](#3-современный-php-84--85)
4. [PHP как CLI-платформа](#4-php-как-cli-платформа)
5. [PHP как инструмент сборки](#5-php-как-инструмент-сборки)
6. [Работа с файлами и потоками](#6-работа-с-файлами-и-потоками)
7. [Архитектурные паттерны](#7-архитектурные-паттерны)
8. [Производительность и граничные случаи](#8-производительность-и-граничные-случаи)
9. [PHP и AI-кодер](#9-php-и-ai-кодер)
10. [Антипаттерны](#10-антипаттерны)
11. [Задачи AI-кодеру](#11-задачи-ai-кодеру)
12. [Чеклист архитектора](#12-чеклист-архитектора)

---

## Актуальные версии (март 2026)


| Версия      | Дата выхода     | Статус                     | Поддержка до     |
| ----------- | --------------- | -------------------------- | ---------------- |
| PHP 8.2     | Ноябрь 2022     | Security only              | Декабрь 2026     |
| PHP 8.3     | Ноябрь 2023     | Active                     | Декабрь 2027     |
| **PHP 8.4** | **Ноябрь 2024** | **Active (рекомендуется)** | **Декабрь 2028** |
| PHP 8.5     | Ноябрь 2025     | Active                     | Декабрь 2029     |


**Для нового проекта:** PHP 8.4 как минимум, PHP 8.5 если хостинг поддерживает.  
`"php": ">=8.4"` в `composer.json`.

---

## 1. PHP в 2026 — честная оценка

### Почему PHP жив и актуален

PHP работает на ~77% веб-сайтов мира — не только потому что  
исторически укоренился, но и потому что **прагматичен**.  
Встроен в любой хостинг, не требует настройки сервера,  
читается без компиляции.

Реальные технические достоинства PHP 8.x:

- **Нативная работа с текстом и HTML** — PHP изначально создан  
как шаблонизатор. Генерация HTML, XML, CSV — его естественная среда
- **Скорость разработки CLI-инструментов** — нет event loop,  
нет async complexity, линейное выполнение, всё из коробки
- **Zero-dependency deployment** — `php build.php` работает  
везде где есть PHP. Никакого `npm install`, никаких node_modules

### Где PHP выигрывает у Node.js


| Задача                    | PHP                                | Node.js                     |
| ------------------------- | ---------------------------------- | --------------------------- |
| Генерация HTML/XML        | Нативно, шаблонный синтаксис       | Через шаблонизаторы         |
| CLI без зависимостей      | `php script.php`                   | Нужен Node.js + npm         |
| Деплой на дешёвый хостинг | Любой хостинг                      | Нужен VPS                   |
| Синхронная логика сборки  | Линейный код, просто               | async/await усложняет       |
| Парсинг HTML5             | Нативный `Dom\HTMLDocument` (8.4+) | Через cheerio / htmlparser2 |


### Где Node.js выигрывает у PHP


| Задача                    | Node.js             | PHP                       |
| ------------------------- | ------------------- | ------------------------- |
| Параллельные I/O операции | Event Loop, нативно | Нет async, нужны процессы |
| Real-time (WebSocket)     | Нативно             | Через костыли             |
| npm-экосистема            | Огромная            | Меньше                    |
| CPU-bound задачи          | Worker Threads      | Нет параллелизма          |


**Вывод для WebForge:** PHP — правильный выбор для **сборщика**.  
Линейная логика генерации файлов, шаблонизация, работа с  
файловой системой — это то, для чего PHP создан.

---

## 2. Механика выполнения

### Как PHP выполняет код

В отличие от Node.js, PHP **не имеет постоянного процесса**.  
Классическая модель:

```
HTTP-запрос
    ↓
PHP-FPM создаёт новый процесс (или берёт из пула)
    ↓
PHP компилирует файл в байткод (или берёт из OPcache)
    ↓
Выполняет скрипт от начала до конца
    ↓
Процесс завершается, вся память освобождается
```

**Для CLI-инструментов (WebForge):**

```
php build.php
    ↓
PHP компилирует файлы
    ↓
Выполняет скрипт линейно
    ↓
Завершается
```

**Практический вывод:** В PHP нет утечек памяти между запросами —  
каждый запуск начинает с чистого листа. Это упрощает разработку  
и устраняет целый класс ошибок, характерных для долгоживущих  
Node.js процессов.

### OPcache и JIT — как работает и почему важно

```
Без OPcache:          С OPcache:           С OPcache + JIT:
PHP файл              PHP файл             PHP файл
    ↓                     ↓ (1й раз)           ↓ (1й раз)
Лексинг               Лексинг              Лексинг
    ↓                     ↓                    ↓
Парсинг               Парсинг              Парсинг → машинный код
    ↓                     ↓                    ↓
Байткод               Байткод → RAM        Машинный код → RAM
    ↓                     ↓ (2й раз+)          ↓ (2й раз+)
Выполнение            Байткод из RAM       Машинный код из RAM
```

**OPcache** — ускорение 2-10x для веб-приложений.  
**JIT (улучшен в PHP 8.4)** — дополнительное ускорение CPU-intensive  
операций: рендеринг шаблонов, обработка строк, математика.

Для WebForge (статическая генерация) JIT даёт реальный прирост  
при сборке сотен страниц с тяжёлой шаблонизацией.

Настройка в `php.ini`:

```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.jit=tracing
opcache.jit_buffer_size=128M
```

**Критичный момент при деплое:**  
OPcache не знает об обновлённых файлах до истечения  
`opcache.revalidate_freq`. В production сбрасывай явно:

```php
opcache_reset();
// или точечно
opcache_invalidate('/path/to/file.php', true);
```

### Управление памятью

PHP использует reference counting + циклический GC.  
Для долгоживущих CLI-процессов (обработка тысяч файлов):

```php
foreach ($files as $file) {
  $processor = new FileProcessor($file);
  $processor->process();
  unset($processor);        // явно освобождаем
  gc_collect_cycles();      // принудительная сборка циклических ссылок
}
```

---

## 3. Современный PHP 8.4 / 8.5

### Property Hooks (PHP 8.4) — главная фича

Крупнейшее улучшение ООП со времён Constructor Promotion.  
Логика при чтении/записи свойства — прямо в объявлении свойства:

```php
class User {
  // Без Property Hooks — нужны геттер + сеттер
  private string $firstName;
  private string $lastName;

  public function getFullName(): string {
    return $this->firstName . ' ' . $this->lastName;
  }
  public function setFullName(string $value): void {
    [$this->firstName, $this->lastName] = explode(' ', $value, 2);
  }
}
```

```php
// PHP 8.4 — всё в одном объявлении
class User {
  public string $fullName {
    get => $this->firstName . ' ' . $this->lastName;
    set {
      [$this->firstName, $this->lastName] = explode(' ', $value, 2);
    }
  }

  public function __construct(
    private string $firstName,
    private string $lastName,
  ) {}
}

$user = new User('Alex', 'Kuzikov');
echo $user->fullName;               // 'Alex Kuzikov' — вызывает get hook
$user->fullName = 'Ivan Petrov';    // вызывает set hook
```

**Виртуальные свойства** — без backing value в объекте:

```php
class Circle {
  public float $area {
    get => M_PI * $this->radius ** 2;
    // нет set — свойство только для чтения
  }

  public function __construct(
    public readonly float $radius,
  ) {}
}
```

**Свойства в интерфейсах** (новая возможность PHP 8.4):

```php
interface HasSlug {
  // Интерфейс требует наличие публично читаемого свойства
  public string $slug { get; }
}

class Page implements HasSlug {
  public string $slug {
    get => strtolower(str_replace(' ', '-', $this->title));
  }

  public function __construct(
    public readonly string $title,
  ) {}
}
```

### Asymmetric Visibility (PHP 8.4)

Разные права доступа на чтение и запись:

```php
class Config {
  // Публично читается, но записывается только внутри класса
  public private(set) string $environment = 'production';

  // Публично читается, записывается только в классе и наследниках
  public protected(set) int $version = 1;

  public function setEnvironment(string $env): void {
    $this->environment = $env; // ✅ изнутри класса — можно
  }
}

$config = new Config();
echo $config->environment;       // ✅ публичное чтение
$config->environment = 'dev';    // ❌ ошибка — private(set) снаружи
```

**Для архитектора:** это заменяет паттерн readonly + метод-мутатор  
там, где объект должен быть частично изменяемым.

### Новый без скобок (PHP 8.4)

```php
// До PHP 8.4 — обязательные скобки
$result = (new HtmlBuilder())->setTitle('Hello')->build();

// PHP 8.4 — скобки не нужны
$result = new HtmlBuilder()->setTitle('Hello')->build();
```

### Нативный HTML5 парсер — Dom\HTMLDocument (PHP 8.4)

До PHP 8.4 встроенный DOMDocument не поддерживал HTML5 спецификацию.  
Теперь есть новые классы в пространстве `Dom\`:

```php
// Старый путь — не понимает HTML5 семантику
$dom = new DOMDocument();
@$dom->loadHTML($html); // @ нужен чтобы заглушить предупреждения

// PHP 8.4 — полноценный HTML5 парсер
$dom = Dom\HTMLDocument::createFromString($html);
$dom = Dom\HTMLDocument::createFromFile('page.html');

// Работает корректно с HTML5 элементами
$articles = $dom->querySelectorAll('article.post');
foreach ($articles as $article) {
  $title = $article->querySelector('h2')?->textContent;
}
```

**Для WebForge критично:** можно парсить и проверять  
сгенерированный HTML без внешних зависимостей.

### Новые функции массивов (PHP 8.4)

```php
$products = [
  ['name' => 'Шуруп', 'price' => 5],
  ['name' => 'Дрель', 'price' => 3500],
  ['name' => 'Гвоздь', 'price' => 2],
];

// array_find — первый элемент, удовлетворяющий условию
$expensive = array_find($products, fn($p) => $p['price'] > 1000);
// ['name' => 'Дрель', 'price' => 3500]

// array_find_key — ключ первого совпадения
$key = array_find_key($products, fn($p) => $p['price'] > 1000);
// 1

// array_any — есть ли хоть один удовлетворяющий
$hasExpensive = array_any($products, fn($p) => $p['price'] > 1000);
// true

// array_all — все ли удовлетворяют
$allCheap = array_all($products, fn($p) => $p['price'] < 100);
// false
```

### Lazy Objects (PHP 8.4)

Объект не инициализируется до первого обращения к нему:

```php
$reflector = new ReflectionClass(HeavyService::class);

$proxy = $reflector->newLazyProxy(function() {
  return new HeavyService(
    new DatabaseConnection(),
    new CacheClient(),
  );
});

// HeavyService и его зависимости НЕ созданы
// Будут созданы только при первом обращении к $proxy
if ($needsService) {
  $proxy->doWork(); // вот здесь создаётся
}
```

**Практическое значение:** Снижение потребления памяти и ускорение  
инициализации в проектах с большим количеством сервисов.

### Pipe Operator (PHP 8.5)

Один из самых ожидаемых операторов — функциональные цепочки  
без вложенности:

```php
// Без pipe — читается справа налево
$result = array_filter(
  array_map(
    fn($x) => $x * 2,
    array_values($data)
  ),
  fn($x) => $x > 10
);

// PHP 8.5 pipe operator — читается слева направо
$result = $data
  |> array_values(...)
  |> array_map(fn($x) => $x * 2, ...)
  |> array_filter(fn($x) => $x > 10, ...);
```

**Для WebForge build pipeline** это прямое архитектурное улучшение —  
шаги сборки станут читаемее без добавления классов-обёрток.

### array_first / array_last (PHP 8.5)

```php
$items = ['a', 'b', 'c', 'd'];

// До PHP 8.5 — громоздко
$first = reset($items);
$last  = end($items);

// PHP 8.5 — нативно
$first = array_first($items); // 'a'
$last  = array_last($items);  // 'd'
```

### #[\NoDiscard] атрибут (PHP 8.5)

```php
class FileWriter {
  #[\NoDiscard]
  public function write(string $content): bool {
    // Возвращает false при ошибке
    return file_put_contents($this->path, $content) !== false;
  }
}

$writer->write($content);
// ⚠️ Предупреждение: возвращаемое значение #[NoDiscard] функции игнорируется
```

**Для архитектора:** помечай методы, возвращаемые значения которых  
**нельзя игнорировать**. Особенно полезно для методов записи файлов,  
транзакций, отправки запросов.

### Constructor Promotion и Readonly (PHP 8.2+)

```php
// PHP 8.2 — readonly класс (все свойства readonly автоматически)
readonly class PageConfig {
  public function __construct(
    public string $slug,
    public string $title,
    public string $template,
    public array  $meta    = [],
    public bool   $noindex = false,
  ) {}
}
```

### Enums (PHP 8.1+)

```php
enum DocumentStatus: string {
  case Pending   = 'pending';
  case Processed = 'processed';
  case Failed    = 'failed';

  public function label(): string {
    return match($this) {
      self::Pending   => 'Ожидает',
      self::Processed => 'Обработан',
      self::Failed    => 'Ошибка',
    };
  }
}

$status = DocumentStatus::from('pending');
$status = DocumentStatus::tryFrom('unknown'); // null если не найдено
echo $status->label(); // 'Ожидает'
```

### Fibers (PHP 8.1+)

Кооперативная многозадачность — основа async-библиотек  
(ReactPHP 3, Revolt, Amp v3). Сами по себе низкоуровневый примитив.

**Для WebForge не нужно** — сборщик работает синхронно.  
Но для долгоживущих PHP-сервисов (очереди, телеграм-боты) — важно знать.

---

## 4. PHP как CLI-платформа

### Запуск без сервера

PHP CLI — это отдельный бинарь, не связанный с веб-сервером.  
Нет Nginx, нет Apache, нет PHP-FPM — только `php` и скрипт:

```bash
# Выполнить скрипт
php build.php

# С аргументами
php build.php --env=production --output=dist/

# Передача данных через stdin
echo '{"slug":"index"}' | php process.php

# Однострочник
php -r "echo json_encode(['hello' => 'world']);"

# Проверить синтаксис без выполнения
php -l build.php
```

### Shebang — скрипт как команда

```php
#!/usr/bin/env php
<?php
declare(strict_types=1);

// $argv — имя скрипта
// $argv[1..n] — аргументы командной строки
$outputDir = $argv ?? 'dist';[1]

echo "Building to: {$outputDir}\n";
```

```bash
chmod +x build.php
./build.php dist/
```

### Аргументы командной строки

```php
#!/usr/bin/env php
<?php
declare(strict_types=1);

// Разбор именованных аргументов: --env=production --verbose
$options = getopt('', ['env:', 'output:', 'verbose']);

$env     = $options['env']     ?? 'development';
$output  = $options['output']  ?? 'dist';
$verbose = isset($options['verbose']);

if ($verbose) {
  echo "Env: {$env}, Output: {$output}\n";
}
```

### Exit codes — стандарт CLI

```php
// 0 — успех, любое другое — ошибка
// Это стандарт Unix, читается shell-скриптами и CI/CD

try {
  $builder->buildAll();
  echo "✓ Build complete\n";
  exit(0);
} catch (InvalidConfigException $e) {
  fwrite(STDERR, "❌ Config error: {$e->getMessage()}\n");
  exit(1);
} catch (BuildFailedException $e) {
  fwrite(STDERR, "❌ Build failed: {$e->getMessage()}\n");
  exit(2);
}
```

**Важно:** ошибки — в `STDERR`, результаты — в `STDOUT`.  
Это позволяет отделить вывод от ошибок в пайплайнах:  
`php build.php 2>errors.log`.

### Встроенный HTTP-сервер для разработки

```bash
# Раздавать папку dist/ на localhost:8080
php -S localhost:8080 -t dist/

# С кастомным router-файлом
php -S localhost:8080 router.php
```

Только для разработки — не для production.  
Для просмотра статики в dist/ достаточно:

```bash
# Альтернативы если PHP не нужен для preview
python3 -m http.server 8080 --directory dist/
npx serve dist/
```

### Когда нужен Laragon/XAMPP, а когда — нет


| Задача                        | Нужен стек (Laragon)   | Достаточно PHP CLI    |
| ----------------------------- | ---------------------- | --------------------- |
| WordPress / WooCommerce       | ✅ Apache + MySQL + PHP | —                     |
| Laravel / Symfony             | ✅ PHP-FPM + БД         | —                     |
| WebForge (статическая сборка) | —                      | ✅ только `php`        |
| CLI-утилиты                   | —                      | ✅ только `php`        |
| Парсинг и скрипты данных      | —                      | ✅ только `php`        |
| Preview готовых HTML          | —                      | ✅ `php -S` или Python |


**Для WebForge:** Laragon не нужен. Достаточно установить  
PHP как отдельный бинарь:

```bash
# Windows — через Scoop
scoop install php

# Проверка
php --version
# PHP 8.4.x (cli)
```

### Параллельное выполнение через proc_open

PHP не имеет async/await, но может запускать параллельные  
CLI-процессы через `proc_open`:

```php
function runParallel(array $commands): array {
  $processes = [];

  foreach ($commands as $key => $cmd) {
    $processes[$key] = proc_open(
      $cmd,
      [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes[$key]
    );
  }

  $results = [];
  foreach ($processes as $key => $proc) {
    $results[$key] = [
      'stdout' => stream_get_contents($pipes[$key]),[1]
      'stderr' => stream_get_contents($pipes[$key]),[2]
      'code'   => proc_close($proc),
    ];
  }

  return $results;
}

// Параллельный вызов нескольких LLM-скриптов
$results = runParallel([
  'meta'    => 'php generate-meta.php page1.json',
  'summary' => 'php generate-summary.php page1.json',
]);
```

---

## 5. PHP как инструмент сборки

### Шаблонизация — нативная суперсила PHP

PHP изначально создавался как шаблонный язык для HTML.  
Это его реальное преимущество перед любым шаблонизатором Node.js:

```php
<?php
function renderCard(array $data): string {
  ob_start(); ?>

  <article class="card <?= htmlspecialchars($data['modifier'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
    ```
    <h2 class="card__title"><?= htmlspecialchars($data['title'], ENT_QUOTES, 'UTF-8') ?></h2>
    ```
    <?php if (!empty($data['image'])): ?>
      <img
        src="<?= htmlspecialchars($data['image']['src'], ENT_QUOTES, 'UTF-8') ?>"
        alt="<?= htmlspecialchars($data['image']['alt'], ENT_QUOTES, 'UTF-8') ?>"
        width="<?= (int)$data['image']['width'] ?>"
        height="<?= (int)$data['image']['height'] ?>"
        loading="lazy"
      >
    <?php endif; ?>
    <div class="card__body">
      <?= $data['content'] /* доверенный HTML */ ?>
    </div>
  </article>

  <?php return ob_get_clean();
}
```

`**ob_start()` / `ob_get_clean()**` — буферизация вывода.  
Всё что выводится между ними — захватывается в строку.  
Это основа компонентной архитектуры WebForge.

### Архитектура статического генератора

```
WebForge:

config/
  site.json         ← глобальная конфигурация
  pages/
    index.json      ← данные страницы
    about.json

templates/
  layouts/
    base.php        ← HTML скелет
  components/
    header.php
    card.php
  pages/
    index.php       ← шаблон страницы

build.php           ← точка входа
dist/               ← результат
  index.html
  about/
    index.html
```

```php
// build.php — ядро сборщика с pipe operator (PHP 8.5)
$config = json_decode(file_get_contents('config/site.json'), true);
$pages  = glob('config/pages/*.json');

foreach ($pages as $pageConfig) {
  $data   = PageConfig::fromJson($pageConfig);
  $html   = renderPage($data, $config);
  $outDir = $data->slug === 'index' ? 'dist' : "dist/{$data->slug}";

  @mkdir($outDir, 0755, true);
  writeFileAtomic("{$outDir}/index.html", $html);

  echo "✓ Built: {$data->slug}\n";
}
```

### Валидация сгенерированного HTML через Dom\HTMLDocument (PHP 8.4)

```php
function validateGeneratedHtml(string $html): array {
  $errors = [];
  $dom = Dom\HTMLDocument::createFromString($html);

  // Проверка title
  if ($dom->querySelector('title') === null) {
    $errors[] = 'Отсутствует тег <title>';
  }

  // Проверка мета-описания
  $metaDesc = $dom->querySelector('meta[name="description"]');
  if ($metaDesc === null) {
    $errors[] = 'Отсутствует meta description';
  }

  // Проверка alt у изображений
  foreach ($dom->querySelectorAll('img') as $img) {
    if (!$img->hasAttribute('alt')) {
      $errors[] = "Img без alt: " . $img->getAttribute('src');
    }
  }

  return $errors;
}
```

### AI-интеграция в pipeline сборки

```php
// Вызов локального LLM для генерации SEO-контента
function generateMetaDescription(string $content): string {
  $payload = json_encode([
    'model'  => 'qwen3:8b',
    'prompt' => "Напиши мета-описание до 160 символов для: {$content}",
    'stream' => false,
  ], JSON_UNESCAPED_UNICODE);

  // proc_open даёт контроль над stdin/stdout/stderr
  $proc = proc_open(
    'curl -s -X POST http://localhost:11434/api/generate -d @-',
    [
      0 => ['pipe', 'r'],  // stdin
      1 => ['pipe', 'w'],  // stdout
      2 => ['pipe', 'w'],  // stderr
    ],
    $pipes
  );

  fwrite($pipes, $payload);
  fclose($pipes);

  $output = stream_get_contents($pipes);[^1]
  fclose($pipes);[^1]
  fclose($pipes);[^2]
  proc_close($proc);

  $response = json_decode($output, true);
  return $response['response'] ?? '';
}
```

---

## 6. Работа с файлами и потоками

### Атомарная запись файла

```php
function writeFileAtomic(string $path, string $content): void {
  $tmpFile = $path . '.tmp.' . uniqid();

  if (file_put_contents($tmpFile, $content) === false) {
    throw new \RuntimeException("Не удалось записать: {$tmpFile}");
  }

  if (!rename($tmpFile, $path)) {
    unlink($tmpFile);
    throw new \RuntimeException("Не удалось переименовать в: {$path}");
  }
}
// rename() — атомарная операция в пределах одной файловой системы
// Либо старый файл, либо новый — никогда наполовину
```

### Рекурсивный обход директорий

```php
function scanTemplates(string $dir): array {
  $files    = [];
  $iterator = new \RecursiveIteratorIterator(
    new \RecursiveDirectoryIterator(
      $dir,
      \RecursiveDirectoryIterator::SKIP_DOTS
    )
  );

  foreach ($iterator as $file) {
    if ($file->getExtension() === 'php') {
      $files[] = $file->getPathname();
    }
  }

  return $files;
}
```

### Большие файлы через Generator

```php
function readCsvRows(string $path): \Generator {
  $handle = fopen($path, 'r');

  if ($handle === false) {
    throw new \RuntimeException("Не удалось открыть: {$path}");
  }

  try {
    $headers = fgetcsv($handle);

    while (($row = fgetcsv($handle)) !== false) {
      yield array_combine($headers, $row);
    }
  } finally {
    fclose($handle); // всегда закрываем — даже при исключении
  }
}

// Память постоянная — не зависит от размера файла
foreach (readCsvRows('courts.csv') as $row) {
  processRow($row);
}
```

### Streams в PHP

```php
// php://memory — работа в памяти как с файлом
$handle = fopen('php://memory', 'r+');
fwrite($handle, $generatedHtml);
rewind($handle);
$html = stream_get_contents($handle);
fclose($handle);

// php://temp — переключается на файл при превышении лимита памяти
$handle = fopen('php://temp/maxmemory:' . (5 * 1024 * 1024), 'r+');

// Сжатие на лету через stream filter
$output = fopen('output.gz', 'wb');
stream_filter_append($output, 'zlib.deflate', STREAM_FILTER_WRITE);
fwrite($output, $largeContent);
fclose($output);
```

---

## 7. Архитектурные паттерны

### Dependency Injection — явные зависимости

```php
// ❌ Service Locator — скрытые зависимости
class PageBuilder {
  public function build(string $slug): string {
    $config   = Container::get('config');    // скрытая зависимость
    $renderer = Container::get('renderer'); // не видна в сигнатуре
  }
}

// ✅ DI — явные зависимости, тестируемые, заменяемые
class PageBuilder {
  public function __construct(
    private readonly SiteConfig       $config,
    private readonly TemplateRenderer $renderer,
  ) {}

  public function build(string $slug): string { ... }
}
```

### Pipeline через замыкания (PHP 8.5 — с pipe operator)

```php
// PHP 8.4 — через класс
class BuildPipeline {
  private array $stages = [];

  public function pipe(callable $stage): static {
    $clone = clone $this;
    $clone->stages[] = $stage;
    return $clone; // immutable
  }

  public function process(array $context): array {
    return array_reduce(
      $this->stages,
      fn(array $ctx, callable $stage) => $stage($ctx),
      $context
    );
  }
}

$result = (new BuildPipeline())
  ->pipe(fn($ctx) => loadConfig($ctx))
  ->pipe(fn($ctx) => loadContent($ctx))
  ->pipe(fn($ctx) => renderTemplates($ctx))
  ->pipe(fn($ctx) => optimizeOutput($ctx))
  ->pipe(fn($ctx) => writeFiles($ctx))
  ->process(['slug' => 'index']);
```

```php
// PHP 8.5 — pipe operator делает это нативно
$result = ['slug' => 'index']
  |> loadConfig(...)
  |> loadContent(...)
  |> renderTemplates(...)
  |> optimizeOutput(...)
  |> writeFiles(...);
```

### Value Objects через readonly class

```php
readonly class PageConfig {
  public function __construct(
    public string $slug,
    public string $title,
    public string $template,
    public array  $meta    = [],
    public bool   $noindex = false,
  ) {}

  public static function fromJson(string $path): self {
    $data = json_decode(file_get_contents($path), true);

    if (!isset($data['slug'], $data['title'], $data['template'])) {
      throw new \InvalidArgumentException(
        "Обязательные поля slug, title, template отсутствуют в {$path}"
      );
    }

    return new self(
      slug:     $data['slug'],
      title:    $data['title'],
      template: $data['template'],
      meta:     $data['meta']    ?? [],
      noindex:  $data['noindex'] ?? false,
    );
  }
}
```

### Иерархия исключений

```php
class WebForgeException      extends \RuntimeException {}
class TemplateNotFoundException extends WebForgeException {}
class InvalidConfigException    extends WebForgeException {}
class BuildFailedException      extends WebForgeException {}

try {
  $builder->buildAll();
} catch (InvalidConfigException $e) {
  echo "❌ Ошибка конфигурации: {$e->getMessage()}\n";
  exit(1);
} catch (TemplateNotFoundException $e) {
  echo "❌ Шаблон не найден: {$e->getMessage()}\n";
  exit(1);
} catch (WebForgeException $e) {
  echo "❌ Ошибка сборки: {$e->getMessage()}\n";
  exit(1);
}
```

---

## 8. Производительность и граничные случаи

### Конкатенация строк в цикле — O(n²) vs O(n)

```php
// ❌ Создаёт новую строку на каждой итерации — O(n²)
$html = '';
foreach ($items as $item) {
  $html .= renderItem($item);
}

// ✅ Собрать в массив, объединить один раз — O(n)
$parts = array_map(fn($item) => renderItem($item), $items);
$html  = implode("\n", $parts);

// ✅ Через ob_start() для сложных шаблонов
ob_start();
foreach ($items as $item) {
  echo renderItem($item);
}
$html = ob_get_clean();
```

### glob() и большие директории

```php
// glob() загружает ВСЕ совпадения в память сразу
$files = glob('content/**/*.json'); // тысячи файлов — всё в RAM

// DirectoryIterator — ленивый, по одному файлу
$iterator = new \RecursiveIteratorIterator(
  new \RecursiveDirectoryIterator('content/')
);
```

### JSON и кодировка — критично для кириллицы

```php
// По умолчанию PHP экранирует Unicode
json_encode(['name' => 'Москва']);
// {"name":"\u041c\u043e\u0441\u043a\u0432\u0430"}

// Правильно для читаемого JSON
json_encode($data,
  JSON_UNESCAPED_UNICODE |
  JSON_UNESCAPED_SLASHES |
  JSON_PRETTY_PRINT
);
// {"name":"Москва"}
```

### htmlspecialchars — контекст имеет значение

```php
// В HTML-атрибутах — ENT_QUOTES обязателен
<input value="<?= htmlspecialchars($value, ENT_QUOTES, 'UTF-8') ?>">

// В HTML-контенте
```

 ```

// В JavaScript-контексте — htmlspecialchars НЕ ПОМОЖЕТ  
// Нужен json_encode с JSON_HEX_TAG

// Частая ошибка AI-кодеров: htmlspecialchars везде без учёта контекста

```

### mb_trim, mb_ltrim, mb_rtrim (PHP 8.4)

```php
// До PHP 8.4 — trim() не работает корректно с многобайтовыми символами
$clean = trim($string, "\u{00A0}"); // неразрывный пробел — не работает

// PHP 8.4 — нативная многобайтовая обрезка
$clean = mb_trim($string);         // обрезает все Unicode пробелы
$clean = mb_ltrim($string, ' ');   // только слева
$clean = mb_rtrim($string, '\n');  // только справа
```

**Для WebForge:** критично при работе с контентом из CMS,  
где пользователи вставляют текст с разными видами пробелов.

### register_shutdown_function — перехват fatal errors

```php
register_shutdown_function(function() {
  $error = error_get_last();
  if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
    echo "💥 Fatal: {$error['message']} в {$error['file']}:{$error['line']}\n";
  }
});
```

### max_memory_limit (PHP 8.5)

```ini
; Новая директива в PHP 8.5
; Устанавливает потолок для memory_limit
; Скрипт не может поднять лимит выше этого значения
max_memory_limit = 1G
memory_limit = 256M
```

---

## 9. PHP и AI-кодер

### Что AI делает хорошо в PHP

- Генерирует шаблонный HTML с экранированием
- Пишет CRUD-операции с файлами
- Создаёт Value Objects и DTO-классы
- Конвертирует массивы ↔ объекты

### Где AI систематически ошибается

**Устаревший стиль PHP 7.x:**

```php
// ❌ AI часто генерирует старый стиль
class Court {
  private $name;
  private $code;

  public function __construct($name, $code) {
    $this->name = $name;
    $this->code = $code;
  }
  public function getName() { return $this->name; }
}

// ✅ Современный PHP 8.4
readonly class Court {
  public function __construct(
    public string $name,
    public string $code,
  ) {}
}
```

**Не использует Property Hooks там, где они нужны:**

```php
// ❌ AI пишет геттер + сеттер
class Page {
  private string $_slug;
  public function getSlug(): string { return $this->_slug; }
  public function setSlug(string $v): void { $this->_slug = strtolower($v); }
}

// ✅ PHP 8.4 Property Hook
class Page {
  public string $slug {
    set => strtolower($value);
  }
}
```

**Игнорирует strict_types:**

```php
// AI часто не добавляет в начало файла
declare(strict_types=1);
// Без этого PHP делает неявное приведение типов — молча
```

**Не проверяет возвращаемое значение file_put_contents:**

```php
// ❌ Молчит при ошибке записи
file_put_contents($path, $content);

// ✅ Проверяет — или используй #[NoDiscard] (PHP 8.5)
if (file_put_contents($path, $content) === false) {
  throw new \RuntimeException("Не удалось записать: {$path}");
}
```

### Как правильно ставить задачу AI-кодеру

Плохо:

> «Напиши PHP класс для рендеринга шаблонов»

Хорошо:

> «Напиши PHP 8.4 readonly class TemplateRenderer.  
> Конструктор принимает string $templatesDir.  
> Метод render(string $template, array $data): string.  
> ob_start()/ob_get_clean() для захвата вывода.  
> Бросает TemplateNotFoundException если файл не найден.  
> declare(strict_types=1) обязателен. Без зависимостей.  
> Используй Dom\HTMLDocument для валидации результата.»

---


## 10. Антипаттерны

- **PHP только как “скрипт рядом с HTML”.** Нативный HTML-рендеринг — сила PHP, но бизнес-логика должна иметь границы: services, value objects, exceptions, tests.
- **Отключённый или неверный OPcache/JIT.** В production PHP без OPcache — это почти учебный стенд. Проверяй opcache.enable, memory, interned strings buffer, JIT mode.
- **Синхронные HTTP-вызовы в request path.** Один медленный внешний сервис задерживает весь request. Для интеграций — очереди, timeouts, circuit breaker, async workers.
- **Исключения как логирование.** `catch` без retry, fallback или явного failure mode скрывает причину. Ошибки должны менять состояние системы предсказуемо.
- **Массивы как универсальная модель данных.** Для доменных сущностей нужны value objects/DTO; массивы хороши для передачи, но плохи как долгосрочный контракт.

## Anti-checklist ☠️

- [ ] `@` оператор подавления ошибок — скрывает проблему, не решает её
- [ ] Массивы как универсальная модель данных — для доменных сущностей нужны Value Objects
- [ ] `require`/`include` без абсолютного пути — уязвимость при изменении include_path
- [ ] Конкатенация строк в цикле (`$html .= $part`) — O(n²), используй `ob_start()` или `implode`
- [ ] `extract()` и `compact()` — неявные переменные, невозможно статически анализировать
- [ ] Исключения как логирование — `catch` без retry/fallback скрывает причину

## 11. Задачи AI-кодеру

- Рефакторить смешанный HTML/PHP-шаблон в компоненты или renderer.
- Добавить typed DTO/value objects для внешних API-ответов.
- Настроить OPcache/JIT и проверить `php -i | grep opcache`.
- Заменить синхронные интеграции в критичном request path на очередь или async worker.
- Добавить exception mapping и structured logging.

## 12. Чеклист архитектора

### Конфигурация и окружение

- [ ] `declare(strict_types=1)` в начале каждого файла
- [ ] `"php": ">=8.4"` в `composer.json`
- [ ] OPcache + JIT включены и настроены в production
- [ ] `display_errors = Off` в production, логирование включено

### Качество кода (PHP 8.4)

- [ ] Readonly классы/свойства для Value Objects
- [ ] Constructor Promotion везде где применимо
- [ ] Property Hooks вместо геттеров/сеттеров
- [ ] Asymmetric Visibility вместо readonly + мутатор
- [ ] Match вместо switch для строгих сравнений
- [ ] Typed properties везде — нет нетипизированных свойств

### PHP 8.5

- [ ] `array_first()` / `array_last()` вместо `reset()` / `end()`
- [ ] `array_find()` / `array_any()` / `array_all()` вместо ручных циклов
- [ ] `#[\NoDiscard]` на методах с важным возвращаемым значением
- [ ] Pipe operator для linear build pipelines

### Работа с файлами

- [ ] Атомарная запись через временный файл + rename()
- [ ] `file_put_contents` возвращаемое значение проверяется
- [ ] Большие данные обрабатываются через Generator
- [ ] Файловые дескрипторы закрываются в блоке `finally`

### Генерация HTML

- [ ] `htmlspecialchars()` с `ENT_QUOTES, 'UTF-8'` в атрибутах
- [ ] `JSON_UNESCAPED_UNICODE` при генерации JSON с кириллицей
- [ ] `JSON_HEX_TAG` при вставке JSON в JavaScript-контекст
- [ ] `mb_trim()` вместо `trim()` для многобайтовых строк
- [ ] `Dom\HTMLDocument` для парсинга и валидации HTML (PHP 8.4)

### AI-код ревью

- [ ] Нет старого синтаксиса PHP 7.x там где применим 8.4
- [ ] Возвращаемые значения файловых функций проверяются
- [ ] `strict_types` добавлен
- [ ] Нет `@` оператора подавления ошибок
- [ ] Геттеры/сеттеры заменены на Property Hooks где это уместно

### PHP CLI

- [ ] `exit(0)` при успехе, ненулевой код при ошибке
- [ ] Ошибки — в `STDERR` через `fwrite(STDERR, ...)`
- [ ] `$argv` / `getopt()` для аргументов командной строки
- [ ] `php -S localhost:8080 -t dist/` для локального preview
- [ ] Laragon/XAMPP не устанавливается для CLI-only проектов

---

## Связь с проектами


| Паттерн                  | Где используется                            |
| ------------------------ | ------------------------------------------- |
| ob_start() шаблонизация  | WebForge — компонентный рендеринг           |
| Readonly Value Objects   | WebForge PageConfig, SiteConfig             |
| Pipeline + pipe operator | WebForge BuildPipeline (PHP 8.5)            |
| Property Hooks           | WebForge — Page, Asset объекты              |
| Dom\HTMLDocument         | WebForge — валидация сгенерированного HTML  |
| Generator для файлов     | FIAS-parser при работе с большими реестрами |
| Атомарная запись         | WebForge dist/ output                       |
| proc_open + Ollama       | WebForge AI-контентный pipeline             |


---

*Модуль 03 завершён.*  
*Следующий: [Модуль 04 — Python*](../04-python/README.md)