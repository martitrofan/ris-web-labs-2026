# РИС и Web · каталог лабораторных (КГЭУ)

Публичный сайт для студентов: методички, карточки и шаблоны.  
Исходный преподавательский vault **сюда не входит**.

**Сайт (GitHub Pages):** после включения Pages —

`https://martitrofan.github.io/ris-web-labs-2026/`

(подставьте свой логин/имя репо, если отличаются)

## Структура

```text
docs/                 ← корень GitHub Pages
  index.html          ← Docsify
  labs.json           ← какие ЛР опубликованы / код доступа
  labs/01/            ← материалы ЛР1
  assets/             ← стили и gate по labs.json
```

## Локальный просмотр

```bash
cd docs
python3 -m http.server 8080
# открыть http://localhost:8080
```

Нужен HTTP-сервер: `fetch('labs.json')` из `file://` не работает.

## Добавить следующую лабу

См. [docs/guide.md](docs/guide.md).
