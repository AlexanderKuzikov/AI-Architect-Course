# Модуль 05 — Go

> **Для AI-архитектора:** Go — это язык, где ограничения
> сделаны намеренно. Нет дженериков ради дженериков,
> нет исключений, нет наследования. Взамен — предсказуемость,
> скорость компиляции и производительность близкая к C.

---

## Содержание

1. [Go в 2026 — честная оценка](#1-go-в-2026--честная-оценка)
2. [Механика рантайма](#2-механика-рантайма)
3. [Современный Go 1.24 / 1.26](#3-современный-go-124--126)
4. [Горутины и каналы — модель конкурентности](#4-горутины-и-каналы--модель-конкурентности)
5. [Обработка ошибок](#5-обработка-ошибок)
6. [Стандартная библиотека — суперсила Go](#6-стандартная-библиотека--суперсила-go)
7. [Архитектурные паттерны](#7-архитектурные-паттерны)
8. [Производительность и граничные случаи](#8-производительность-и-граничные-случаи)
9. [Go и AI-кодер](#9-go-и-ai-кодер)
10. [Антипаттерны](#10-антипаттерны)
11. [Задачи AI-кодеру](#11-задачи-ai-кодеру)
12. [Чеклист архитектора](#12-чеклист-архитектора)

---

## Актуальные версии (июнь 2026)

| Версия | Статус | Комментарий |
|--------|--------|-------------|
| Go 1.24 | Stable | актуальная база для проектов, написанных в 2025 |
| Go 1.25 | Stable | промежуточная стабильная ветка |
| **Go 1.26** | **актуальная стабильная ветка** | **рекомендуется для нового проекта** |

**Для нового проекта:** Go 1.26. `go 1.26` в `go.mod`.

---

## 1. Go в 2026 — честная оценка

### Где Go доминирует

Go занял нишу **системного языка для инфраструктуры**:
Docker, Kubernetes, Terraform, Prometheus, Grafana, CockroachDB —
всё написано на Go. Причины:

- **Минимальный binary** — статически линкованный exe без зависимостей
- **Кросс-компиляция** — `GOOS=linux GOARCH=amd64 go build` прямо
  с Mac/Windows
- **Горутины** — 10k+ конкурентных соединений без сложной async-модели
- **Предсказуемая производительность** — нет GIL, нет JIT-пауз,
  нет event loop
- **Время компиляции** — большой проект за секунды, не минуты

### Где Go проигрывает

| Задача | Лучшая альтернатива | Причина |
|--------|--------------------|---------| 
| ML/AI экосистема | Python | Нет PyTorch-эквивалента |
| Быстрый прототип | Python, Node.js | Больше церемониального кода |
| Системное программирование | Rust | Нет контроля памяти, GC-паузы |
| Сложные данные/алгоритмы | Python | Меньше библиотек |

### Ниша в стеке AI-архитектора

```
   Python     ← ML pipeline, LLM-интеграция, данные
     ↕
Node.js / PHP ← веб, статическая генерация, API
     ↕
     Go        ← CLI-инструменты, демоны, бинарные утилиты,
                 высоконагруженные HTTP сервисы,
                 инфраструктурные компоненты
```

**Конкретные применения:**
- Court-Harvester — параллельный crawler с тысячами горутин
- FIAS-parser — обработка многогигабайтных XML/DBF файлов
- Бинарные CLI-утилиты без зависимостей для автоматизации

---

## 2. Механика рантайма

### Компиляция — что происходит под капотом

```
исходный код (.go)
      ↓
  лексинг + парсинг + type checking
      ↓
  SSA (Static Single Assignment) IR
      ↓
  оптимизации (escape analysis, inlining, devirtualization)
      ↓
  машинный код (ELF/PE/Mach-O)
      ↓
  статически слинкованный бинарь
```

**Escape analysis** — компилятор определяет:
размещать переменную на стеке или в куче.
Стек — без GC, без overhead. Куча — управляется GC.
`go build -gcflags="-m"` показывает escape decisions.

### Go Scheduler — M:N модель

Go runtime мультиплексирует горутины (G) на OS-потоки (M)
через процессоры (P):

```
G G G G G       ← горутины (тысячи)
    ↕
P P P P         ← logical processors (= GOMAXPROCS)
    ↕
M M M M         ← OS threads
    ↕
  OS kernel
```

**Work stealing** — если P1 закончил свою очередь горутин,
он крадёт горутины из очереди P2. Нагрузка балансируется
автоматически без явного управления потоками.

**Goroutine preemption** (Go 1.14+) — горутины вытесняются
планировщиком даже в CPU-intensive коде (раньше нужен был
вызов функции для переключения контекста).

### Garbage Collector

Go использует трёхцветный concurrent mark-and-sweep GC:

- **Concurrent** — большая часть работы GC параллельна с горутинами
- **Stop-the-world (STW)** — крайне короткие паузы (~100μs в Go 1.24)
- **Write barrier** — во время GC отслеживает изменения указателей

**Настройка GC:**
```bash
# GOGC — порог запуска GC (% роста кучи от baseline)
# По умолчанию = 100 (запуск когда куча удвоилась)
GOGC=200 ./app    # реже GC, больше памяти

# GOMEMLIMIT (Go 1.19+) — жёсткий лимит памяти
# GC будет активнее чтобы не превысить лимит
GOMEMLIMIT=1GiB ./app

# Для контейнеров — установи GOMEMLIMIT явно!
# Go не знает про cgroup memory limits без этого
```

**Для архитектора:**
Go GC оптимизирован под **low latency**, не throughput.
Если нужна максимальная пропускная способность с допустимой
задержкой — увеличивай `GOGC`. Если нужна минимальная latency
в контейнере — устанавливай `GOMEMLIMIT`.

### Стек горутины

Горутина стартует со стека ~2-8KB. Стек **растёт динамически**
через copying stack — при необходимости создаётся новый бо́льший
стек, все указатели перезаписываются.

Это означает: нельзя брать указатель на переменную на стеке
горутины из C-кода (через cgo) — адрес может измениться.

---

## 3. Современный Go 1.24 / 1.26

### Range-over-func — итераторы (Go 1.23)

До Go 1.23 кастомная итерация требовала callback-паттернов
или раскрытия внутренней структуры. Теперь — через `range`:

```go
// Пакет iter — стандартные типы итераторов
import "iter"

// iter.Seq[V]   — итератор одного значения
// iter.Seq2[K,V] — итератор пары ключ-значение

// Итератор страниц API
func PaginatedResults(baseURL string) iter.Seq2[int, []Record] {
  return func(yield func(int, []Record) bool) {
    page := 1
    for {
      records, hasMore := fetchPage(baseURL, page)
      if !yield(page, records) {
        return // потребитель сделал break
      }
      if !hasMore {
        return
      }
      page++
    }
  }
}

// Чистое использование
for page, records := range PaginatedResults(apiURL) {
  for _, r := range records {
    process(r)
  }
  if page >= 10 {
    break // правильно прерывает итератор
  }
}
```

**Адаптеры итераторов — функциональный стиль без промежуточных слайсов:**

```go
import "slices"

// slices.All, slices.Values — стандартные итераторы из Go 1.23
for i, v := range slices.All(mySlice) {
  fmt.Println(i, v)
}

// Кастомный filter-map pipeline без аллокаций промежуточных слайсов
func Filter[V any](seq iter.Seq[V], pred func(V) bool) iter.Seq[V] {
  return func(yield func(V) bool) {
    for v := range seq {
      if pred(v) && !yield(v) {
        return
      }
    }
  }
}

func Map[V, W any](seq iter.Seq[V], fn func(V) W) iter.Seq[W] {
  return func(yield func(W) bool) {
    for v := range seq {
      if !yield(fn(v)) {
        return
      }
    }
  }
}
```

**Исправление timer в Go 1.23:**
`time.Timer` и `time.Ticker` больше не вызывают утечку горутин
при Reset()/Stop() — классический источник тонких багов.

### Generic Type Aliases (Go 1.24)

```go
// До Go 1.24 — нельзя было создать параметризованный алиас
// Go 1.24 — полная поддержка

type Predicate[T any] = func(T) bool
type Transform[T, U any] = func(T) U
type Handler[Req, Resp any] = func(context.Context, Req) (Resp, error)

// Практическое применение
type CourtFilter    = Predicate[Court]
type DocumentMapper = Transform[RawDoc, ParsedDoc]
type APIHandler[T any] = Handler[T, APIResponse]
```

### os.Root — изолированный доступ к файловой системе (Go 1.24)

```go
import "os"

// Открываем только конкретную директорию
root, err := os.OpenRoot("/data/uploads")
if err != nil {
  return err
}
defer root.Close()

// Все операции изолированы в этой директории
// Path traversal (../../etc/passwd) — невозможен
f, err := root.Open("user-file.txt")  // безопасно

// Можно передавать как интерфейс
func processUploads(root *os.Root) error {
  entries, err := root.ReadDir(".")
  ...
}
```

**Для архитектора:** это нативная sandbox для обработки
пользовательских файлов. Раньше приходилось вручную проверять
`filepath.Clean` и `strings.HasPrefix` — теперь OS-уровневая защита.

### Swiss Tables — новые map (Go 1.24)

Go 1.24 заменил реализацию `map` на Swiss Tables:
- **30% быстрее** доступ и запись для больших map
- **35% быстрее** запись в pre-sized map (`make(map[K]V, n)`)
- **10-60% быстрее** итерация в зависимости от размера

Никаких изменений в коде — просто быстрее.

`sync.Map` переписан на concurrent hash-trie — быстрее
на всех benchmark'ах.

### Weak Pointers (Go 1.24)

```go
import "weak"

// Слабая ссылка — не препятствует GC собрать объект
ptr := weak.Make(&MyObject{data: "important"})

// Позже — проверяем жив ли объект
if obj := ptr.Value(); obj != nil {
  // объект ещё жив — используем
  use(obj)
}
// Если GC собрал объект — Value() вернёт nil
```

**Применение:** кэши без риска memory leak. Если объект нужен —
GC его не соберёт. Если нигде больше не используется — GC соберёт,
weak pointer автоматически становится nil.

### runtime.AddCleanup — замена SetFinalizer (Go 1.24)

```go
// SetFinalizer — один финализатор, проблемы с циклами, deprecated
runtime.SetFinalizer(obj, func(o *MyObj) { o.cleanup() })

// AddCleanup — несколько cleanup'ов, работает с циклами ссылок
// cleanup запускается в отдельной горутине последовательно
runtime.AddCleanup(obj, func(resource *Resource) {
  resource.Close()
}, resource)

// Несколько cleanup'ов на одном объекте — теперь возможно
runtime.AddCleanup(obj, closeDB, db)
runtime.AddCleanup(obj, closeCache, cache)
```

### tool directive в go.mod (Go 1.24)

```go
// go.mod — теперь инструменты объявляются явно
module myapp

go 1.24

require (
  github.com/some/dep v1.2.3
)

// Инструменты разработки — без костыля tools.go
tool (
  golang.org/x/tools/cmd/stringer
  github.com/golang/mock/mockgen
  github.com/golangci/golangci-lint/cmd/golangci-lint
)
```

```bash
# Запуск инструмента из go.mod
go tool stringer -type=Status

# Обновление инструментов
go get -tool golang.org/x/tools/cmd/stringer@latest
```

До Go 1.24 инструменты управлялись через хак с пустым файлом
`tools.go` — теперь нативно.

---

## 4. Горутины и каналы — модель конкурентности

### Горутины — легковесность в числах

```go
// Стоимость создания горутины
// OS thread: ~1MB стек, ~1μs создание
// Goroutine: ~2-8KB стек, ~100ns создание

// 100k горутин — нормально для Go
// 100k OS threads — катастрофа для системы

func main() {
  const n = 100_000
  done := make(chan struct{}, n)

  for range n {        // range over integer — Go 1.22+
    go func() {
      work()
      done <- struct{}{}
    }()
  }

  for range n {
    <-done
  }
}
```

### Worker Pool — стандартный паттерн

```go
func WorkerPool[T, R any](
  ctx    context.Context,
  jobs   iter.Seq[T],
  worker func(context.Context, T) (R, error),
  n      int,
) ([]R, error) {
  jobCh    := make(chan T, n)
  resultCh := make(chan R, n)

  var wg sync.WaitGroup
  var mu sync.Mutex
  var results []R
  var firstErr error

  // Запускаем n воркеров
  for range n {
    wg.Add(1)
    go func() {
      defer wg.Done()
      for job := range jobCh {
        result, err := worker(ctx, job)
        if err != nil {
          mu.Lock()
          if firstErr == nil {
            firstErr = err
          }
          mu.Unlock()
          continue
        }
        resultCh <- result
      }
    }()
  }

  // Собираем результаты
  go func() {
    wg.Wait()
    close(resultCh)
  }()

  // Подаём задачи
  go func() {
    for job := range jobs {
      select {
      case jobCh <- job:
      case <-ctx.Done():
        break
      }
    }
    close(jobCh)
  }()

  for r := range resultCh {
    results = append(results, r)
  }

  return results, firstErr
}
```

### Select — управление конкурентностью

```go
// Таймаут операции
func fetchWithTimeout(ctx context.Context, url string) ([]byte, error) {
  ch := make(chan []byte, 1)

  go func() {
    data, err := http.Get(url)
    if err == nil {
      ch <- data
    }
  }()

  select {
  case data := <-ch:
    return data, nil
  case <-ctx.Done():
    return nil, ctx.Err()
  }
}

// Fan-out + первый ответ (race pattern)
func FastestSource(ctx context.Context, sources []string) ([]byte, error) {
  ch := make(chan []byte, len(sources))

  for _, src := range sources {
    go func(url string) {
      if data, err := fetch(ctx, url); err == nil {
        ch <- data
      }
    }(src)
  }

  select {
  case result := <-ch:
    return result, nil
  case <-ctx.Done():
    return nil, ctx.Err()
  }
}
```

### Context — отмена через дерево вызовов

```go
func ProcessDocuments(ctx context.Context, paths []string) error {
  // Таймаут на всю операцию
  ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
  defer cancel()

  var wg sync.WaitGroup
  errCh := make(chan error, len(paths))

  for _, path := range paths {
    wg.Add(1)
    go func(p string) {
      defer wg.Done()
      if err := processOne(ctx, p); err != nil {
        // Проверяем — это наша ошибка или отмена контекста?
        if ctx.Err() != nil {
          return // контекст отменён — не шумим
        }
        errCh <- fmt.Errorf("process %s: %w", p, err)
      }
    }(path)
  }

  go func() {
    wg.Wait()
    close(errCh)
  }()

  for err := range errCh {
    return err // возвращаем первую ошибку
  }
  return nil
}
```

### Граничный случай — утечки горутин

Горутина живёт до завершения своей функции. Если горутина
заблокирована навсегда — это утечка:

```go
// ❌ Утечка — никто не читает из ch
func leak() {
  ch := make(chan int)
  go func() {
    result := compute()
    ch <- result  // блокируется вечно если никто не читает
  }()
  // функция возвращается, горутина висит
}

// ✅ Буферизованный канал или явная отмена
func noLeak(ctx context.Context) {
  ch := make(chan int, 1) // буфер — горутина не заблокируется

  go func() {
    select {
    case ch <- compute():
    case <-ctx.Done(): // выход по отмене контекста
    }
  }()
}
```

**Диагностика утечек:**
```go
// В тестах
import "runtime"

goroutinesBefore := runtime.NumGoroutine()
// ... тест ...
goroutinesAfter := runtime.NumGoroutine()
assert.Equal(t, goroutinesBefore, goroutinesAfter)
```

---

## 5. Обработка ошибок

### Философия — ошибки как значения

В Go нет исключений. Ошибки — обычные значения, возвращаемые
как последний результат. Это делает путь ошибки явным и
неизбежным для обработки.

```go
// Интерфейс error — один метод
type error interface {
  Error() string
}

// Функция возвращает (результат, ошибка)
func OpenFile(path string) (*os.File, error) {
  f, err := os.Open(path)
  if err != nil {
    return nil, fmt.Errorf("open %s: %w", path, err)
  }
  return f, nil
}

// Вызов — обязателен check
f, err := OpenFile("data.json")
if err != nil {
  return fmt.Errorf("load config: %w", err)
}
defer f.Close()
```

**Wrapping с `%w`** — сохраняет оригинальную ошибку в цепочке:
```go
// Добавляем контекст, не теряя тип
return fmt.Errorf("process document %s: %w", id, ErrInvalidFormat)

// Позже — проверяем тип по цепочке
if errors.Is(err, ErrInvalidFormat) { ... }
```

### Кастомные типы ошибок

```go
// Структура с дополнительным контекстом
type ParseError struct {
  Line    int
  Column  int
  Message string
}

func (e *ParseError) Error() string {
  return fmt.Sprintf("line %d, col %d: %s", e.Line, e.Column, e.Message)
}

// errors.As — извлечение конкретного типа из цепочки
var parseErr *ParseError
if errors.As(err, &parseErr) {
  fmt.Printf("Ошибка в строке %d\n", parseErr.Line)
}
```

### errors.Join (Go 1.20+) — агрегация ошибок

```go
func validateDocument(doc Document) error {
  var errs []error

  if doc.Title == "" {
    errs = append(errs, errors.New("title обязателен"))
  }
  if doc.Date.IsZero() {
    errs = append(errs, errors.New("date обязателен"))
  }
  if len(doc.Content) < 100 {
    errs = append(errs, fmt.Errorf("content слишком короткий: %d символов", len(doc.Content)))
  }

  return errors.Join(errs...) // nil если errs пустой
}

// errors.Is/As работают с каждой ошибкой в Join
```

### Sentinel errors — именованные ошибки

```go
// Именованные ошибки для сравнения
var (
  ErrNotFound       = errors.New("not found")
  ErrAlreadyExists  = errors.New("already exists")
  ErrInvalidInput   = errors.New("invalid input")
)

func FindCourt(code string) (*Court, error) {
  court, ok := db[code]
  if !ok {
    return nil, fmt.Errorf("court %s: %w", code, ErrNotFound)
  }
  return court, nil
}

// Вызывающий код — сравнение через errors.Is
court, err := FindCourt("77RS0001")
if errors.Is(err, ErrNotFound) {
  // обработка отсутствия
} else if err != nil {
  // другая ошибка
}
```

### Паника — только для инвариантов

```go
// Легитимно — нарушение инварианта программиста
func NewServer(port int) *Server {
  if port < 1 || port > 65535 {
    panic(fmt.Sprintf("invalid port: %d", port))
  }
  return &Server{port: port}
}

// Легитимно — на границе горутины для защиты от непредвиденной паники
func safeGo(fn func()) {
  go func() {
    defer func() {
      if r := recover(); r != nil {
        log.Printf("recovered panic: %v\n%s", r, debug.Stack())
      }
    }()
    fn()
  }()
}
```

---

## 6. Стандартная библиотека — суперсила Go

### HTTP сервер — из коробки

```go
package main

import (
  "encoding/json"
  "log/slog"
  "net/http"
)

func main() {
  mux := http.NewServeMux()

  // Go 1.22+ — метод и путь в паттерне
  mux.HandleFunc("GET /api/courts/{code}", handleGetCourt)
  mux.HandleFunc("POST /api/courts", handleCreateCourt)
  mux.HandleFunc("GET /health", handleHealth)

  slog.Info("starting server", "addr", ":8080")
  if err := http.ListenAndServe(":8080", mux); err != nil {
    slog.Error("server failed", "error", err)
  }
}

func handleGetCourt(w http.ResponseWriter, r *http.Request) {
  code := r.PathValue("code") // Go 1.22+ — нативные path params

  court, err := db.FindCourt(r.Context(), code)
  if errors.Is(err, ErrNotFound) {
    http.Error(w, "not found", http.StatusNotFound)
    return
  }
  if err != nil {
    slog.Error("db error", "error", err)
    http.Error(w, "internal error", http.StatusInternalServerError)
    return
  }

  w.Header().Set("Content-Type", "application/json")
  json.NewEncoder(w).Encode(court)
}
```

**Для большинства микросервисов** стандартная библиотека
достаточна без Gin/Echo/Fiber. Рассматривай фреймворки
только если нужны: middleware-стек, router groups, автоматический
swagger-gen.

### log/slog — структурированное логирование (Go 1.21)

```go
import "log/slog"

// Структурированный лог — JSON или text
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
  Level: slog.LevelInfo,
}))
slog.SetDefault(logger)

// Использование
slog.Info("court processed",
  "code",     court.Code,
  "duration", time.Since(start),
  "status",   "success",
)

slog.Error("fetch failed",
  "url",   url,
  "error", err,
)

// С постоянными полями — создаём под-логгер
reqLogger := slog.With("request_id", reqID, "user_id", userID)
reqLogger.Info("processing started")
```

### encoding/json — новые возможности Go 1.24

```go
// omitzero тег — пропустить если zero value (Go 1.24)
type Document struct {
  Title    string    `json:"title"`
  Date     time.Time `json:"date,omitzero"` // не включать если zero
  Score    float64   `json:"score,omitzero"`
  Internal string    `json:"-"`
}

// json.NewDecoder с контекстом
dec := json.NewDecoder(r.Body)
dec.DisallowUnknownFields() // ошибка при неизвестных полях

var doc Document
if err := dec.Decode(&doc); err != nil {
  http.Error(w, err.Error(), http.StatusBadRequest)
  return
}
```

### Тестирование — встроенный фреймворк

```go
// Table-driven tests — идиоматичный Go
func TestParseCourtCode(t *testing.T) {
  tests := []struct {
    name    string
    input   string
    want    CourtCode
    wantErr bool
  }{
    {"valid", "77RS0001", CourtCode{Region: 77, Type: "RS", ID: 1}, false},
    {"empty", "", CourtCode{}, true},
    {"too short", "77RS", CourtCode{}, true},
  }

  for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
      got, err := ParseCourtCode(tt.input)
      if (err != nil) != tt.wantErr {
        t.Errorf("wantErr=%v, got error=%v", tt.wantErr, err)
      }
      if got != tt.want {
        t.Errorf("want %v, got %v", tt.want, got)
      }
    })
  }
}

// Fake time в тестах — Go 1.24
func TestScheduler(t *testing.T) {
  // Контролируемое время без sleep в тестах
  clock := testing.NewFakeClock(time.Now())
  sched := NewScheduler(clock)

  sched.Schedule(time.Minute, myTask)
  clock.Advance(time.Minute + time.Second)
  // myTask должен был выполниться
}

// Test context — Go 1.24
func TestWithContext(t *testing.T) {
  ctx := t.Context() // автоматически отменяется при завершении теста
  result, err := doWork(ctx)
  ...
}
```

### sync пакет — примитивы синхронизации

```go
// sync.Map — для high-read, low-write concurrent словарей
var cache sync.Map
cache.Store("key", value)
if v, ok := cache.Load("key"); ok {
  use(v.(*MyType))
}
cache.LoadOrStore("key", defaultValue)

// sync.Pool — пул объектов для снижения GC давления
var bufPool = sync.Pool{
  New: func() any { return new(bytes.Buffer) },
}

func processRequest(data []byte) string {
  buf := bufPool.Get().(*bytes.Buffer)
  defer func() {
    buf.Reset()
    bufPool.Put(buf)
  }()

  // используем buf — аллокация только при первом вызове
  buf.Write(data)
  return buf.String()
}

// sync.Once — однократная инициализация
var (
  instance *Service
  once     sync.Once
)

func GetService() *Service {
  once.Do(func() {
    instance = &Service{
      db:    connectDB(),
      cache: initCache(),
    }
  })
  return instance
}
```

---

## 7. Архитектурные паттерны

### Интерфейсы — маленькие и конкретные

```go
// ✅ Go-идиома: маленькие интерфейсы
type Reader interface {
  Read(p []byte) (n int, err error)
}

type Writer interface {
  Write(p []byte) (n int, err error)
}

// Компоновка вместо иерархии
type ReadWriter interface {
  Reader
  Writer
}

// Применение: функция принимает интерфейс, возвращает конкретный тип
func NewCSVParser(r io.Reader) *CSVParser {
  return &CSVParser{reader: r}
}

// Тестируемо — подставляем любой Reader
parser := NewCSVParser(strings.NewReader("a,b,c\n1,2,3"))
parser := NewCSVParser(os.Stdin)
parser := NewCSVParser(httpResponse.Body)
```

### Option Pattern — конфигурация без накопления параметров

```go
type CrawlerOptions struct {
  timeout     time.Duration
  concurrency int
  retries     int
  userAgent   string
}

type Option func(*CrawlerOptions)

func WithTimeout(d time.Duration) Option {
  return func(o *CrawlerOptions) { o.timeout = d }
}

func WithConcurrency(n int) Option {
  return func(o *CrawlerOptions) { o.concurrency = n }
}

func NewCrawler(opts ...Option) *Crawler {
  options := &CrawlerOptions{
    timeout:     30 * time.Second, // defaults
    concurrency: 10,
    retries:     3,
    userAgent:   "Mozilla/5.0",
  }
  for _, opt := range opts {
    opt(options)
  }
  return &Crawler{options: options}
}

// Использование
crawler := NewCrawler(
  WithTimeout(60*time.Second),
  WithConcurrency(50),
)
```

### Pipeline через каналы

```go
// Классический Go pipeline — каждый этап горутина + канал

func generateURLs(ctx context.Context, base string) <-chan string {
  out := make(chan string, 100)
  go func() {
    defer close(out)
    for i := 1; i <= 1000; i++ {
      select {
      case out <- fmt.Sprintf("%s/%d", base, i):
      case <-ctx.Done():
        return
      }
    }
  }()
  return out
}

func fetchPages(ctx context.Context, urls <-chan string, workers int) <-chan Page {
  out := make(chan Page, workers)
  var wg sync.WaitGroup

  for range workers {
    wg.Add(1)
    go func() {
      defer wg.Done()
      for url := range urls {
        if page, err := fetch(ctx, url); err == nil {
          select {
          case out <- page:
          case <-ctx.Done():
            return
          }
        }
      }
    }()
  }

  go func() {
    wg.Wait()
    close(out)
  }()

  return out
}

// Использование — читаемая цепочка
func main() {
  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
  defer cancel()

  urls  := generateURLs(ctx, "https://courts.ru/court")
  pages := fetchPages(ctx, urls, 50)

  for page := range pages {
    process(page)
  }
}
```

### Embedding — композиция вместо наследования

```go
// BaseRepository — общая логика
type BaseRepository struct {
  db *sql.DB
}

func (r *BaseRepository) Exec(query string, args ...any) error {
  _, err := r.db.Exec(query, args...)
  return err
}

// CourtRepository — встраивает Base, добавляет специфику
type CourtRepository struct {
  BaseRepository // embedding — не наследование!
}

func (r *CourtRepository) FindByCode(ctx context.Context, code string) (*Court, error) {
  // Доступ к методам BaseRepository напрямую
  row := r.db.QueryRowContext(ctx, "SELECT * FROM courts WHERE code = ?", code)
  ...
}

// Тест — подменяем через интерфейс
type CourtRepo interface {
  FindByCode(context.Context, string) (*Court, error)
  Save(context.Context, *Court) error
}
```

---

## 8. Производительность и граничные случаи

### Профилирование — встроенный инструментарий

```go
import _ "net/http/pprof"

// Добавить в main для HTTP API
go func() {
  http.ListenAndServe(":6060", nil)
}()
```

```bash
# CPU профиль — 30 секунд
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Heap профиль
go tool pprof http://localhost:6060/debug/pprof/heap

# Goroutine профиль — найти утечки
go tool pprof http://localhost:6060/debug/pprof/goroutine

# В интерактивном режиме
(pprof) top 10    # топ-10 по CPU
(pprof) web       # граф вызовов в браузере
```

### Аллокации — главный источник GC давления

```go
// Измерение аллокаций в бенчмарке
func BenchmarkProcess(b *testing.B) {
  b.ReportAllocs() // показывает allocs/op и bytes/op
  for range b.N {
    process(testData)
  }
}

// go test -bench=. -benchmem
// BenchmarkProcess  1000000  1200 ns/op  256 B/op  3 allocs/op
```

**Частые источники лишних аллокаций:**

```go
// ❌ Конкатенация строк в цикле
var result string
for _, s := range items {
  result += s // новая аллокация на каждой итерации
}

// ✅ strings.Builder
var sb strings.Builder
sb.Grow(estimatedSize) // pre-allocate
for _, s := range items {
  sb.WriteString(s)
}
result := sb.String()

// ❌ Маленький слайс без capacity hint
var results []Result
for range items {
  results = append(results, process(item))
}

// ✅ Pre-allocated slice
results := make([]Result, 0, len(items))
for _, item := range items {
  results = append(results, process(item))
}
```

### Race detector — обязательно в CI

```bash
go test -race ./...
go run -race main.go
go build -race -o app_race .
```

**Каждый тест в CI должен запускаться с `-race`.**
Race condition в production — непредсказуемое поведение,
которое почти невозможно воспроизвести.

### Граничный случай — range loop и указатели (до Go 1.22)

```go
// До Go 1.22 — классический баг: все горутины читают ОДНУ переменную
for _, item := range items {
  go func() {
    process(item) // ❌ все получат последний item
  }()
}

// Go 1.22+ — каждая итерация создаёт СВОЮ переменную
for _, item := range items {
  go func() {
    process(item) // ✅ каждая горутина получает свой item
  }()
}

// Для Go < 1.22 — явное копирование
for _, item := range items {
  item := item // shadow variable
  go func() {
    process(item) // ✅
  }()
}
```

Убедись что `go 1.22` или выше в `go.mod` — это меняет семантику.

### Граничный случай — nil interface vs nil pointer

```go
// Одна из самых коварных ловушек Go
func getError() error {
  var p *MyError = nil
  return p // НЕ nil error! interface{type: *MyError, value: nil}
}

err := getError()
fmt.Println(err == nil) // false — хотя p был nil!

// ✅ Правильно
func getError() error {
  var p *MyError = nil
  if p == nil {
    return nil // возвращаем nil interface, не nil pointer
  }
  return p
}
```

### Граничный случай — defer в цикле

```go
// ❌ defer выполняется при ВОЗВРАТЕ из функции, не из цикла
func processFiles(paths []string) error {
  for _, path := range paths {
    f, _ := os.Open(path)
    defer f.Close() // все Close() вызовутся только в конце функции!
  }
  return nil
}

// ✅ Замыкание или явная функция
func processFiles(paths []string) error {
  for _, path := range paths {
    if err := processOne(path); err != nil {
      return err
    }
  }
  return nil
}

func processOne(path string) error {
  f, err := os.Open(path)
  if err != nil { return err }
  defer f.Close() // теперь закрывается при выходе из processOne ✅
  // ...
  return nil
}
```

---

## 9. Go и AI-кодер

### Что AI делает хорошо в Go

- Генерирует table-driven тесты
- Пишет HTTP обработчики стандартной библиотеки
- Создаёт Value Objects как structs с методами
- Пишет worker pool паттерны

### Где AI систематически ошибается

**Игнорирует ошибки:**
```go
// ❌ AI часто генерирует
result, _ := doSomething() // молча проглатывает ошибку

// ✅ Всегда обрабатывай
result, err := doSomething()
if err != nil {
  return fmt.Errorf("context: %w", err)
}
```

**Устаревший синтаксис роутера (до Go 1.22):**
```go
// ❌ AI использует сторонние фреймворки без необходимости
r := chi.NewRouter()
r.Get("/courts/{code}", handleGetCourt)

// ✅ Стандартная библиотека Go 1.22+
mux := http.NewServeMux()
mux.HandleFunc("GET /courts/{code}", handleGetCourt)
code := r.PathValue("code")
```

**Не использует context:**
```go
// ❌ Нет propagation отмены
func fetchData(url string) ([]byte, error) {
  resp, err := http.Get(url)
  ...
}

// ✅ Context первым аргументом всегда
func fetchData(ctx context.Context, url string) ([]byte, error) {
  req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
  resp, err := http.DefaultClient.Do(req)
  ...
}
```

**Не закрывает ресурсы:**
```go
// ❌ Утечка response body
resp, _ := client.Do(req)
body, _ := io.ReadAll(resp.Body)

// ✅ Всегда закрывать body
resp, err := client.Do(req)
if err != nil { return err }
defer resp.Body.Close()
body, err := io.ReadAll(resp.Body)
```

**Не учитывает range-loop variable (до Go 1.22):**
```go
// ❌ Все горутины захватят последний item в Go < 1.22
for _, item := range items {
  go func() { process(item) }()
}
```

### Как правильно ставить задачу AI-кодеру

Плохо:
> «Напиши Go-краулер для сайта»

Хорошо:
> «Напиши Go 1.24 краулер для обхода 10k URL.
> Worker pool на 50 горутин. Context с таймаутом 10 минут.
> `iter.Seq[string]` как источник URL.
> Результаты через `chan CrawlResult` с буфером.
> Стандартная library — без зависимостей.
> log/slog для структурированного логирования.
> Детектор race conditions (`-race` совместимый).
> Context propagation в каждом HTTP запросе.
> Все ошибки оборачиваются через `%w`.»

---


## 10. Антипаттерны

- **Горутина на каждый request без лимита.** goroutine дешёвая, но не бесплатная. Без semaphore/worker pool можно убить память, CPU и downstream-сервис.
- **Context без распространения.** Если `context.Context` не передаётся в HTTP, DB, queue и child calls, отмена запроса не работает.
- **Ошибки как строки.** `fmt.Errorf("failed")` без context, wrapping и typed errors ломает observability и retry-логику.
- **Shared mutable state между goroutines.** Гонки появляются даже в простом кэше. Для состояния — mutex, channel ownership, atomic или immutable snapshots.
- **Игнорирование GC и аллокаций.** Go быстрый, но не отменяет профилирование. `pprof`, `GOMEMLIMIT`, escape analysis и benchmark нужны до production.

## Anti-checklist ☠️

- [ ] Игнорировать ошибки (`result, _ := doSomething()`) — молча теряешь сбой
- [ ] Горутина на каждый request без лимита — дешёво, но не бесплатно
- [ ] `defer` в цикле — все Close() вызовутся только при возврате из функции
- [ ] Context без распространения — отмена запроса не работает
- [ ] `interface{}` / `any` как универсальный тип — теряешь все преимущества типизации
- [ ] `go test` без `-race` в CI — race condition в production непредсказуемы

## 11. Задачи AI-кодеру

- Добавить `context.Context` во все HTTP/DB/queue вызовы.
- Заменить ошибки-строки на wrapping errors и typed errors для retryable failures.
- Добавить worker pool/semaphore для fan-out goroutines.
- Настроить `pprof` endpoints и benchmark критичного handler.
- Проверить race detector в CI: `go test -race ./...`.

## 12. Чеклист архитектора

### Конфигурация проекта
- [ ] `go 1.24` и `toolchain go1.24.x` в `go.mod`
- [ ] Tool dependencies через `tool` директиву (не `tools.go`)
- [ ] `GOMEMLIMIT` установлен для контейнерных деплоев
- [ ] `-race` в CI тестах

### Конкурентность
- [ ] Каждая горутина имеет путь завершения
- [ ] Нет утечек горутин — буферизованные каналы или context
- [ ] `context.Context` — первый аргумент всех I/O функций
- [ ] Worker pool ограничивает concurrency явно
- [ ] Разделяемые данные защищены mutex или через channels

### Обработка ошибок
- [ ] Нет `_` для ошибок в продакшн-коде
- [ ] Ошибки оборачиваются с контекстом через `%w`
- [ ] Sentinel errors объявлены на уровне пакета
- [ ] Паника только для инвариантов, не бизнес-ошибок
- [ ] `errors.Is` / `errors.As` для сравнения типов

### Go 1.24/1.26 фичи
- [ ] Range-over-func для кастомных итераторов
- [ ] `iter.Seq` / `iter.Seq2` для публичных итерирующих API
- [ ] `os.Root` для изолированного доступа к директориям
- [ ] `runtime.AddCleanup` вместо `SetFinalizer`
- [ ] Generic type aliases для читаемых типов
- [ ] `omitzero` JSON тег где применимо

### AI-код ревью
- [ ] Ошибки не игнорируются через `_`
- [ ] Response body всегда закрывается
- [ ] HTTP запросы используют `NewRequestWithContext`
- [ ] Range loop variable shadowing проверен (для Go < 1.22)
- [ ] nil interface vs nil pointer в возвращаемых ошибках
- [ ] `defer` не используется в циклах

---

## Связь с проектами

| Паттерн | Где используется |
|---------|-----------------|
| Worker pool + iter.Seq | Court-Harvester — 50 горутин на обход |
| Pipeline через каналы | Court-Harvester — fetch → parse → save |
| os.Root | FIAS-parser — изолированный доступ к данным |
| sync.Pool | FIAS-parser — пул буферов для XML парсинга |
| Context + timeout | Все HTTP-клиенты |
| Стандартный HTTP router | REST API без зависимостей |
| log/slog | Структурированное логирование всех сервисов |
| Weak pointers | Кэши в DocOrchestrator |

---

*Модуль 05 завершён.*
*Блок языков завершён: JS/Node.js → TypeScript → PHP → Python → Go*
