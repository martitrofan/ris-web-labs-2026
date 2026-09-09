# Методичка · Лабораторная работа 10
## EF Core: сервер пишет в базу

Семестр 1 · 2026/2027 · **4 часа** · ориентир **10–16.11.2026**

---

## Зачем вы здесь

ASP.NET Core перестаёт хранить заявки в списке в памяти и начинает ходить в PostgreSQL через EF Core. Создали через API — остановили сервер — снова запустили — запись всё ещё в базе.

Если SQL-схема из прошлой работы и модель в коде расходятся — сначала выровняйте, потом крутите миграции.

## 1. Цель одной фразой

Сервер через EF Core пишет в PostgreSQL. Создали запись → перезапустили API → запись на месте. Строка подключения не в Git.


---

## 2. Что должно лежать в Git

### 2.1. Дерево файлов

```text
имя-репозитория/
├── README.md
├── .gitignore
├── backend/
│   ├── Data/
│   │   └── AppDbContext.cs
│   ├── Models/
│   ├── Migrations/
│   │   ├── ..._InitialCreate.cs
│   │   └── AppDbContextModelSnapshot.cs
│   ├── appsettings.json
│   └── Program.cs
├── db/
│   ├── schema.sql
│   ├── seed.sql
│   └── queries.sql
└── docs/
    └── reports/
        └── lab-10.md
```

Папка `Migrations` обязательна в Git.
Файл с настоящим паролем — запрещён.

### 2.2. Что продолжает работать

| Маршрут | Ожидание |
|---|---|
| POST | 201, запись сохранена в БД |
| GET списка | 200, данные из БД |
| GET по id | 200 или 404 |
| PATCH assignee | назначение записано в БД |
| PATCH status | переход записан в БД или 409 |

DELETE не добавляйте.

---

## 3. Подготовка

### 3.1. Установить пакеты

В папке backend:

```bash
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet tool install --global dotnet-ef
dotnet ef --version
```

Если инструмент уже установлен, используйте:

```bash
dotnet tool update --global dotnet-ef
```

Версии пакетов должны быть совместимы с версией .NET проекта.

### 3.2. Настроить секрет локально

Рекомендуемый вариант:

```bash
cd backend
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Default" \
  "Host=localhost;Port=5432;Database=course_tickets;Username=postgres;Password=ВАШ_ПАРОЛЬ"
```

`user-secrets` хранится вне репозитория.
В `appsettings.json` не пишите настоящий пароль.

Допустим также env-параметр или локальный ignored-файл.
В Git можно оставить `.example` без секрета.

---

## 4. Модель и DbContext

### 4.1. Сверка с ЛР9

Перед миграцией составьте соответствие:

| C# | PostgreSQL |
|---|---|
| `Id` | `id` |
| `SiteId` | `site_id` |
| `CreatedAt` | `created_at` |
| `AssigneeUserId` | `assignee_user_id` |

Сущности должны выражать те же связи и ограничения, что `schema.sql`.

### 4.2. DbContext

В `AppDbContext` перечислите наборы главных сущностей и справочников.
Связи, обязательность полей, длины и имена таблиц настройте явно,
если соглашения EF дают другую схему.

Зарегистрируйте контекст в `Program.cs` через Npgsql.
Строку подключения читайте по ключу `ConnectionStrings:Default`.

---

## 5. Миграции

### 5.1. Создать и применить

```bash
cd backend
dotnet ef migrations add InitialCreate
dotnet ef database update
```

После команды проверьте таблицы в pgAdmin или `psql`.

### 5.2. Правила

- изменили модель — создайте новую миграцию;
- не редактируйте применённую миграцию «на глаз»;
- не чините боевую схему вручную вместо миграции;
- добавьте созданные миграции в Git.

---

## 6. Порядок на 4 часа

| Шаг | Время | Что делаете | Готово, если |
|---|---:|---|---|
| A | 0–25 мин | Установить пакеты и `dotnet-ef` | версия выводится |
| B | 25–45 мин | Настроить user-secrets | пароль отсутствует в Git |
| C | 45–90 мин | Создать сущности и DbContext | проект собирается |
| D | 90–120 мин | Создать InitialCreate | Migrations появились |
| E | 120–145 мин | Применить миграцию | таблицы видны в PostgreSQL |
| F | 145–200 мин | Перевести сервис с памяти на EF | POST и GET работают |
| G | 200–220 мин | Перевести оба PATCH | изменения остаются в БД |
| H | 220–232 мин | Выполнить рестарт-тест | тот же id найден |
| I | 232–240 мин | Проверить секреты и commit | миграции в Git |

---

## 7. Обязательный рестарт-тест

1. Запустите PostgreSQL.
2. Запустите API на `http://localhost:5000`.
3. Создайте запись через POST.
4. Запишите `id`, `number`, `title`.
5. Остановите API через `Ctrl+C`.
6. Запустите `dotnet run` снова.
7. Выполните GET по записанному `id`.
8. Сравните поля.

```sql
SELECT id, number, title, status
FROM tickets
WHERE id = 17;
```

В отчёте зафиксируйте один и тот же id до и после рестарта.

---

