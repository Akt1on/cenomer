# Система скрапинга для Ценомер

## Как запустить

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
python main.py
```

## Поддерживаемые магазины

- Перекрёсток
- Магнит
- Пятёрочка
- Лента
- Верный

## Структура

- `scraper/` - основные парсеры
- `data/` - сохранённые JSON файлы
