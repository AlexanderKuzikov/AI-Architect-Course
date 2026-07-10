# Git QuickRef

> Шпаргалка по git-работе с репозиториями курса.
> Правила: [AGENTS.md](../../AGENTS.md) (в корне D:\GitHub).

## Основные команды

```bash
# Статус
git status                    # что изменено
git diff --stat               # статистика изменений
git log --oneline -10         # последние коммиты

# Commit
git add -A                    # все изменения
git commit -m "Краткий заголовок до 72 символов"
git push origin main          # прямо в main (без PR)

# Отмена
git restore --staged FILE     # unstage
git restore FILE              # откатить незакоммиченный файл
git reset --soft HEAD~1       # отменить последний коммит (файлы остаются)
```

## Правила из AGENTS.md

- Коммиты — на русском или английском, повелительное наклонение
- Заголовок ≤ 72 символа
- Коммиты идут прямо в main/master
- `git push --force` — только с подтверждения
- `git reset --hard` — только с подтверждения

## Типовые сценарии

```bash
# Откатить случайный коммит (сохранить изменения)
git reset --soft HEAD~1

# Обновить локальную ветку
git pull --rebase origin main

# Посмотреть что изменилось до коммита
git diff
git diff --cached  # только staged
```

## Чего НЕ делать

- `git push --force` без спроса
- `git reset --hard` без спроса
- Коммитить node_modules, .env, dist/
- Коммитить с `test.only` или `test.skip`
