# Модуль 03 — PHP

> **Для AI-архитектора:** PHP давно не «язык для новичков».
> PHP 8.x — это мощная современная платформа для генерации,
> обработки текста и статической сборки. Именно то, что нужно WebForge.

---

## Содержание

1. [PHP в 2026 — честная оценка](#1-php-в-2026--честная-оценка)
2. [Механика выполнения](#2-механика-выполнения)
3. [Современный PHP 8.x](#3-современный-php-8x)
4. [PHP как инструмент сборки](#4-php-как-инструмент-сборки)
5. [Работа с файлами и потоками](#5-работа-с-файлами-и-потоками)
6. [Архитектурные паттерны](#6-архитектурные-паттерны)
7. [Производительность и граничные случаи](#7-производительность-и-граничные-случаи)
8. [PHP и AI-кодер](#8-php-и-ai-кодер)
9. [Чеклист архитектора](#9-чеклист-архитектора)

---

## 1. PHP в 2026 — честная оценка

### Почему PHP жив и актуален

PHP работает на 77% веб-сайтов мира — не потому что хорош,
а потому что **прагматичен**. Он встроен в любой хостинг,
не требует настройки сервера, читается без компиляции.

Но есть и реальные технические достоинства PHP 8.x:

- **Нативная работа с текстом и HTML** — PHP изначально создан
  как шаблонизатор. Генерация HTML, XML, CSV — его естественная среда
- **Скорость разработки CLI-инструментов** — нет event loop,
  нет async complexity, линейное выполнение, всё из коробки
- **Zero-dependency deployment** — `php build.php` работает
  везде где есть PHP. Никакого `npm install`, никаких node_modules

### Где PHP выигрывает у Node.js

| Задача | PHP | Node.js |
|--------|-----|---------|
| Генерация HTML/XML | Нативно, шаблонный синтаксис | Через шаблонизаторы |
| CLI без зависимостей | `php script.php` | Нужен Node.js + npm |
| Деплой на дешёвый хостинг | Любой хостинг | Нужен VPS |
| Синхронная логика сборки | Линейный код, просто | async/await усложняет |
| Обработка больших строк | Эффективно в памяти | Аналогично |

### Где Node.js выигрывает у PHP

| Задача | Node.js | PHP |
|--------|---------|-----|
| Параллельные I/O операции | Event Loop, нативно | Нет async, нужны процессы |
| Real-time (WebSocket) | Нативно | Через костыли |
| npm-экосистема | Огромная | Меньше |
| CPU-bound задачи | Worker Threads | Нет параллелизма |

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

### OPcache — как работает и почему важен

```
Без OPcache:          С OPcache:
PHP файл              PHP файл
    ↓                     ↓ (только первый раз)
Лексинг               Лексинг
    ↓                     ↓
Парсинг               Парсинг
    ↓                     ↓
Компиляция в байткод  Компиляция → сохранить в RAM
    ↓                     ↓ (все последующие разы)
Выполнение            Байткод из RAM → Выполнение
```

Ускорение: 2-10x в зависимости от приложения.

**Критичный момент при деплое:**
При обновлении PHP-файлов OPcache не знает об изменениях
пока не истечёт `opcache.revalidate_freq` (по умолчанию 2 сек).
В production нужно явно сбрасывать кэш:

```php
opcache_reset(); // программно
// или
opcache_invalidate('/path/to/file.php', true); // конкретный файл
```

### Управление памятью

PHP имеет сборщик мусора с подсчётом ссылок (reference counting).
Объект удаляется когда счётчик ссылок достигает нуля.

```php
$a = new HeavyObject(); // refcount = 1
$b = $a;               // refcount = 2
unset($a);             // refcount = 1, объект жив
unset($b);             // refcount = 0, объект удалён, память освобождена
```

**Для долгоживущих CLI-процессов** (обработка тысяч файлов):

```php
// Явное управление памятью в циклах
foreach ($files as $file) {
  $processor = new FileProcessor($file);
  $processor->process();
  unset($processor); // явно освобождаем
  gc_collect_cycles(); // принудительная сборка циклических ссылок
}
```

---

## 3. Современный PHP 8.x

### Именованные аргументы (PHP 8.0)

```php
// До PHP 8.0 — позиционные, нужно помнить порядок
array_slice($array, 0, 5, true);

// PHP 8.0+ — именованные, порядок не важен, намерение ясно
array_slice(array: $array, offset: 0, length: 5, preserve_keys: true);

// Особенно полезно для функций с множеством опциональных параметров
htmlspecialchars(string: $html, flags: ENT_QUOTES, encoding: 'UTF-8');
```

### Match Expression (PHP 8.0)

```php
// switch — проверяет нестрого (==), нет exhaustiveness check
switch ($status) {
  case 'active':
    $label = 'Активен'; break;
  default:
    $label = 'Неизвестно';
}

// match — строгое сравнение (===), выражение, exhaustiveness
$label = match($status) {
  'active'  => 'Активен',
  'pending' => 'Ожидает',
  'closed'  => 'Закрыт',
  // Если $status не совпадёт ни с чем → UnhandledMatchError
  // Защита от необработанных кейсов как в TypeScript
};
```

### Nullsafe Operator (PHP 8.0)

```php
// До PHP 8.0 — многоуровневая проверка
$city = null;
if ($user !== null) {
  if ($user->getAddress() !== null) {
    $city = $user->getAddress()->getCity();
  }
}

// PHP 8.0+ — цепочка с ?->
$city = $user?->getAddress()?->getCity();
// Вернёт null на первом же null в цепочке
```

### Constructor Promotion (PHP 8.0)

```php
// Старый стиль — дублирование
class Court {
  public string $name;
  public int $regionCode;
  public ?string $website;

  public function __construct(
    string $name,
    int $regionCode,
    ?string $website = null
  ) {
    $this->name = $name;
    $this->regionCode = $regionCode;
    $this->website = $website;
  }
}

// PHP 8.0+ Constructor Promotion — в 3 раза короче
class Court {
  public function __construct(
    public readonly string $name,
    public readonly int    $regionCode,
    public readonly ?string $website = null,
  ) {}
}
```

### Readonly Properties и Readonly Classes (PHP 8.1 / 8.2)

```php
// PHP 8.1 — readonly свойство
class DocumentMeta {
  public readonly string $hash;

  public function __construct(string $content) {
    $this->hash = md5($content);
    // После первого присваивания — нельзя изменить
  }
}

// PHP 8.2 — readonly класс (все свойства readonly автоматически)
readonly class PageConfig {
  public function __construct(
    public string $template,
    public string $title,
    public array  $meta,
  ) {}
}
```

**Readonly для Value Objects** — идеальная пара.
Конфигурация, метаданные, результаты парсинга — всё
что должно быть неизменным после создания.

### Fibers (PHP 8.1)

```php
// Fiber — кооперативная многозадачность
$fiber = new Fiber(function(): void {
  $value = Fiber::suspend('первое значение');
  echo "Fiber получил: {$value}\n";
  Fiber::suspend('второе значение');
});

$first = $fiber->start();        // запускаем, fiber останавливается на первом suspend
echo $first . "\n";              // 'первое значение'
$second = $fiber->resume('привет'); // возобновляем, передаём значение
echo $second . "\n";             // 'второе значение'
```

**Практическое значение Fibers:**
Сами по себе Fibers — низкоуровневый примитив.
Их значение — в библиотеках над ними: ReactPHP 3, Revolt, Amp v3.
Они превращают PHP в платформу для async-приложений.

**Для WebForge это не нужно** — сборщик работает синхронно.
Но для долгоживущих PHP-сервисов (очереди, боты) — это важно знать.

### Enums (PHP 8.1)

```php
// Backed Enum — со значениями
enum DocumentStatus: string {
  case Pending   = 'pending';
  case Processed = 'processed';
  case Failed    = 'failed';

  public function label(): string {
    return match($this) {
      DocumentStatus::Pending   => 'Ожидает обработки',
      DocumentStatus::Processed => 'Обработан',
      DocumentStatus::Failed    => 'Ошибка',
    };
  }
}

$status = DocumentStatus::from('pending');       // из строки
$status = DocumentStatus::tryFrom('unknown');    // null если не найдено
echo $status->value;                             // 'pending'
echo $status->label();                           // 'Ожидает обработки'
```

---

## 4. PHP как инструмент сборки

### Шаблонизация — нативная суперсила PHP

PHP изначально создавался как язык шаблонов для HTML.
Это его реальное преимущество перед любым шаблонизатором
в Node.js (Handlebars, EJS, Nunjucks):

```php
<?php
// component: card.php
function renderCard(array $data): string {
  ob_start(); ?>

  <article class="card <?= htmlspecialchars($data['modifier'] ?? '') ?>">
    <h2 class="card__title"><?= htmlspecialchars($data['title']) ?></h2>
    <?php if (!empty($data['image'])): ?>
      <img
        src="<?= htmlspecialchars($data['image']['src']) ?>"
        alt="<?= htmlspecialchars($data['image']['alt']) ?>"
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

**`ob_start()` / `ob_get_clean()`** — буферизация вывода.
Всё что выводится между ними — захватывается в строку.
Это основа компонентной архитектуры WebForge.

### Компонентная архитектура статического генератора

```
WebForge сборка:

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
    hero.php
  pages/
    index.php       ← шаблон страницы

build.php           ← точка входа сборщика
dist/               ← результат
  index.html
  about/
    index.html
```

```php
// build.php — ядро сборщика
$config  = json_decode(file_get_contents('config/site.json'), true);
$pages   = glob('config/pages/*.json');

foreach ($pages as $pageConfig) {
  $data     = json_decode(file_get_contents($pageConfig), true);
  $slug     = basename($pageConfig, '.json');
  $template = "templates/pages/{$slug}.php";

  $html     = renderPage($template, array_merge($config, $data));
  $outDir   = $slug === 'index' ? 'dist' : "dist/{$slug}";

  @mkdir($outDir, 0755, true);
  file_put_contents("{$outDir}/index.html", $html);

  echo "✓ Built: {$slug}\n";
}
```

### Обработка данных для генерации

```php
// Чтение и обработка конфига — это PHP делает отлично
function loadPageData(string $slug, array $siteConfig): array {
  $pageFile = "content/{$slug}/index.json";

  if (!file_exists($pageFile)) {
    throw new \RuntimeException("Страница не найдена: {$slug}");
  }

  $pageData = json_decode(file_get_contents($pageFile), true);

  if (json_last_error() !== JSON_ERROR_NONE) {
    throw new \RuntimeException(
      "Ошибка JSON в {$pageFile}: " . json_last_error_msg()
    );
  }

  // Мерж с дефолтами из глобального конфига
  return array_merge($siteConfig['defaults'] ?? [], $pageData);
}
```

### AI-интеграция в pipeline сборки

```php
// Вызов локального LLM для генерации SEO-контента
function generateMetaDescription(string $content): string {
  $prompt = "Напиши мета-описание до 160 символов для: {$content}";

  $response = json_decode(
    shell_exec("curl -s -X POST http://localhost:11434/api/generate " .
      "-d " . escapeshellarg(json_encode([
        'model'  => 'qwen3:8b',
        'prompt' => $prompt,
        'stream' => false,
      ]))),
    true
  );

  return $response['response'] ?? '';
}
```

**Альтернатива через `proc_open`** даёт больше контроля
над stdin/stdout/stderr — для долгих LLM-запросов предпочтительнее.

---

## 5. Работа с файлами и потоками

### Файловые операции — надёжные паттерны

```php
// Атомарная запись файла — через временный файл
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
// Если процесс прерван — либо старый файл, либо новый. Никогда наполовину.
```

### Рекурсивный обход директорий

```php
// SPL RecursiveIterator — эффективнее рекурсивных функций
function scanTemplates(string $dir): array {
  $files = [];
  $iterator = new \RecursiveIteratorIterator(
    new \RecursiveDirectoryIterator($dir,
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

### Работа с большими файлами через генераторы

```php
// Обработка большого CSV без загрузки в память
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
    fclose($handle); // всегда закрываем, даже при исключении
  }
}

// Использование — память постоянная, не зависит от размера файла
foreach (readCsvRows('courts.csv') as $row) {
  processRow($row);
}
```

### Streams в PHP

```php
// php://memory — работа с данными в памяти как с файлом
$handle = fopen('php://memory', 'r+');
fwrite($handle, $generatedHtml);
rewind($handle);
$html = stream_get_contents($handle);
fclose($handle);

// php://temp — как memory, но при превышении лимита
// автоматически переключается на временный файл
$handle = fopen('php://temp/maxmemory:' . (5 * 1024 * 1024), 'r+');

// Сжатие на лету
$output = fopen('output.gz', 'wb');
stream_filter_append($output, 'zlib.deflate', STREAM_FILTER_WRITE);
fwrite($output, $largeContent);
fclose($output);
```

---

## 6. Архитектурные паттерны

### Service Locator vs Dependency Injection

```php
// ❌ Service Locator — скрытые зависимости
class PageBuilder {
  public function build(string $slug): string {
    $config    = Container::get('config');    // скрытая зависимость
    $renderer  = Container::get('renderer'); // не видна в сигнатуре
    // ...
  }
}

// ✅ Dependency Injection — явные зависимости
class PageBuilder {
  public function __construct(
    private readonly SiteConfig   $config,
    private readonly TemplateRenderer $renderer,
  ) {}

  public function build(string $slug): string {
    // зависимости явные, тестируемые, заменяемые
  }
}
```

### Pipeline через замыкания

```php
class BuildPipeline {
  private array $stages = [];

  public function pipe(callable $stage): static {
    $clone = clone $this;
    $clone->stages[] = $stage;
    return $clone; // immutable — каждый pipe возвращает новый экземпляр
  }

  public function process(array $context): array {
    return array_reduce(
      $this->stages,
      fn(array $ctx, callable $stage) => $stage($ctx),
      $context
    );
  }
}

// Использование
$pipeline = (new BuildPipeline())
  ->pipe(fn($ctx) => loadConfig($ctx))
  ->pipe(fn($ctx) => loadContent($ctx))
  ->pipe(fn($ctx) => renderTemplates($ctx))
  ->pipe(fn($ctx) => optimizeOutput($ctx))
  ->pipe(fn($ctx) => writeFiles($ctx));

$result = $pipeline->process(['slug' => 'index']);
```

### Value Objects для конфигурации

```php
// Вместо массивов — типизированные объекты
readonly class PageConfig {
  public function __construct(
    public string  $slug,
    public string  $title,
    public string  $template,
    public array   $meta     = [],
    public bool    $noindex  = false,
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
      meta:     $data['meta']     ?? [],
      noindex:  $data['noindex']  ?? false,
    );
  }
}
```

### Обработка ошибок — иерархия исключений

```php
// Базовое исключение приложения
class WebForgeException extends \RuntimeException {}

// Специфичные
class TemplateNotFoundException extends WebForgeException {}
class InvalidConfigException    extends WebForgeException {}
class BuildFailedException      extends WebForgeException {}

// Обработчик в точке входа
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

## 7. Производительность и граничные случаи

### Что медленно в PHP и как это обойти

**Медленно: многократное чтение одного файла**
```php
// ❌ Читает файл при каждом вызове
function getConfig(): array {
  return json_decode(file_get_contents('config.json'), true);
}

// ✅ Читает один раз, кэширует в static переменной
function getConfig(): array {
  static $config = null;
  if ($config === null) {
    $config = json_decode(file_get_contents('config.json'), true);
  }
  return $config;
}
```

**Медленно: конкатенация строк в цикле**
```php
// ❌ Создаёт новую строку на каждой итерации O(n²)
$html = '';
foreach ($items as $item) {
  $html .= renderItem($item);
}

// ✅ Собрать в массив, объединить один раз O(n)
$parts = [];
foreach ($items as $item) {
  $parts[] = renderItem($item);
}
$html = implode("\n", $parts);

// ✅ Или через ob_start() для сложных шаблонов
ob_start();
foreach ($items as $item) {
  echo renderItem($item);
}
$html = ob_get_clean();
```

### Граничный случай: glob() и большие директории

```php
// glob() загружает ВСЕ совпадения в память сразу
$files = glob('content/**/*.json'); // может быть тысячи файлов

// Для больших директорий — DirectoryIterator ленивее
$iterator = new \RecursiveIteratorIterator(
  new \RecursiveDirectoryIterator('content/')
);
// Обрабатывает по одному файлу без загрузки всего списка
```

### Граничный случай: JSON и кодировка

```php
// PHP по умолчанию экранирует Unicode в JSON
json_encode(['name' => 'Москва']);
// → {"name":"\u041c\u043e\u0441\u043a\u0432\u0430"}

// Для читаемого JSON с кириллицей
json_encode(['name' => 'Москва'], JSON_UNESCAPED_UNICODE);
// → {"name":"Москва"}

// Полный набор флагов для красивого JSON
json_encode(
  $data,
  JSON_UNESCAPED_UNICODE |
  JSON_UNESCAPED_SLASHES |
  JSON_PRETTY_PRINT
);
```

### Граничный случай: htmlspecialchars и контекст

```php
// Разные контексты требуют разного экранирования

// В HTML-атрибутах — обязателен ENT_QUOTES
<input value="<?= htmlspecialchars($value, ENT_QUOTES, 'UTF-8') ?>">

// В HTML-контенте — достаточно ENT_HTML5
```
<p><?= htmlspecialchars($text, ENT_HTML5, 'UTF-8') ?></p>
```

// В JavaScript-строках — htmlspecialchars НЕ ПОМОЖЕТ
// Нужен json_encode
```
<script>const data = <?= json_encode($data, JSON_HEX_TAG) ?>;</script>
```

// Частая ошибка AI-кодеров: использовать htmlspecialchars везде
// не думая о контексте вывода
```

### Граничный случай: register_shutdown_function

```php
// Выполняется при завершении скрипта — даже при fatal error
register_shutdown_function(function() {
  $error = error_get_last();
  if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
    echo "💥 Fatal error: {$error['message']} в {$error['file']}:{$error['line']}\n";
    // Записать в лог, отправить уведомление
  }
});
```

---

## 8. PHP и AI-кодер

### Что AI делает хорошо в PHP

- Генерирует шаблонный HTML с правильным экранированием
- Пишет CRUD-операции с файлами
- Создаёт Value Objects и DTO-классы
- Конвертирует массивы ↔ объекты

### Где AI систематически ошибается

**Устаревший стиль PHP 5.x:**
```php
// ❌ AI часто генерирует старый стиль
class Court {
  private $name;
  private $code;

  public function __construct($name, $code) {
    $this->name = $name;
    $this->code = $code;
  }
}

// ✅ Современный PHP 8.2
readonly class Court {
  public function __construct(
    public string $name,
    public string $code,
  ) {}
}
```

**Игнорирует strict_types:**
```php
// AI часто не добавляет в начало файла
declare(strict_types=1);
// Без этого PHP делает неявное приведение типов:
// function add(int $a, int $b) принимает '5' как 5 — молча
```

**Не обрабатывает возвращаемое значение file_put_contents:**
```php
// ❌ Молчит при ошибке записи
file_put_contents($path, $content);

// ✅ Проверяет результат
if (file_put_contents($path, $content) === false) {
  throw new \RuntimeException("Не удалось записать файл: {$path}");
}
```

### Как правильно ставить задачу AI-кодеру

Плохо:
> «Напиши PHP класс для рендеринга шаблонов»

Хорошо:
> «Напиши PHP 8.2 класс TemplateRenderer.
> Конструктор принимает string $templatesDir.
> Метод render(string $template, array $data): string.
> Использует ob_start()/ob_get_clean() для захвата вывода.
> Бросает TemplateNotFoundException если файл не найден.
> declare(strict_types=1) обязателен.
> Readonly class. Без зависимостей.»

---

## 9. Чеклист архитектора

### Конфигурация и окружение
- [ ] `declare(strict_types=1)` в начале каждого файла
- [ ] OPcache включён и настроен в production
- [ ] `display_errors = Off` в production, логирование включено
- [ ] Версия PHP явно указана в `composer.json` (`"php": ">=8.2"`)

### Качество кода
- [ ] Readonly классы/свойства для Value Objects и конфигов
- [ ] Constructor Promotion везде где применимо
- [ ] Match вместо switch для строгих сравнений
- [ ] Типизированы все параметры и возвращаемые значения

### Работа с файлами
- [ ] Атомарная запись через временный файл + rename()
- [ ] `file_put_contents` возвращаемое значение проверяется
- [ ] Большие данные обрабатываются через Generator или Stream
- [ ] Файловые дескрипторы закрываются в блоке `finally`

### Генерация HTML
- [ ] `htmlspecialchars()` с `ENT_QUOTES, 'UTF-8'` в атрибутах
- [ ] `JSON_UNESCAPED_UNICODE` при генерации JSON с кириллицей
- [ ] `JSON_HEX_TAG` при вставке JSON в JavaScript-контекст
- [ ] ob_start()/ob_get_clean() для компонентной шаблонизации

### AI-код ревью
- [ ] Нет старого синтаксиса PHP 5.x/7.x где применим 8.x
- [ ] Возвращаемые значения файловых функций проверяются
- [ ] strict_types добавлен
- [ ] Отсутствует `@` оператор подавления ошибок

---

## Связь с проектами

| Паттерн | Где используется |
|---------|-----------------|
| ob_start() шаблонизация | WebForge — компонентный рендеринг |
| Readonly Value Objects | WebForge PageConfig, SiteConfig |
| Pipeline через замыкания | WebForge BuildPipeline |
| Generator для файлов | FIAS-parser если переписать на PHP |
| Атомарная запись файлов | WebForge dist/ output |
| shell_exec + Ollama | WebForge AI-контентный pipeline |

---

*Модуль 03 завершён.*
*Следующий: [Модуль 04 — Python](../04-python/README.md)*
