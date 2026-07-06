# План на завтра (2026-07-03)

## Утро: Авторизация и ключи

### 1. OpenAI Codex (бесплатно через подписку)
```bash
hermes auth add openai-codex
codex exec "echo hello"
```

### 2. Mistral (бесплатный кредит)
- Зайти на https://console.mistral.ai/
- Зарегистрироваться
- Создать API ключ
- Сохранить: `export MISTRAL_API_KEY="..."`

### 3. Together.ai ($5 кредит)
- Зайти на https://api.together.xyz/
- Зарегистрироваться
- Создать API ключ
- Сохранить: `export TOGETHER_API_KEY="..."`

### 4. Replicate (для фото/видео)
- Зайти на https://replicate.com/
- Зарегистрироваться
- Создать API ключ
- Сохранить: `export REPLICATE_API_TOKEN="..."`

### 5. FFmpeg (для видео монтажа)
```bash
apt install ffmpeg
```

## День: Интеграция

### Что я сделаю:
1. Добавлю Mistral как builder engine
2. Добавлю Together.ai как builder engine
3. Добавлю Replicate для генерации фото/видео
4. Добавлю FFmpeg для монтажа видео
5. Протестирую всё вместе

### Новые файлы:
```
multi-agent/
├── providers/
│   ├── mistral.js       # Mistral API
│   ├── together.js      # Together.ai API
│   └── replicate.js     # Replicate API
├── media/
│   ├── generator.js     # Генерация фото/видео
│   ├── editor.js        # Монтаж видео
│   └── analyzer.js      # Анализ изображений
```

### Новые endpoints:
```
POST /v1/media/generate    — Генерация изображения
POST /v1/media/video       — Генерация видео
POST /v1/media/edit        — Редактирование
GET  /v1/providers         — Список провайдеров
```

## Вечер: Тестирование

### Тесты:
1. Codex: создание файла
2. Mistral: генерация кода
3. Together: генерация кода
4. Replicate: генерация изображения
5. FFmpeg: объединение видео

### Запуск:
```bash
# Полная система
node /root/mimo-dev-assistant/hermes-api/mock-hermes.js &
cd /root/mimo-dev-assistant/multi-agent
BUILDER_ENGINE=codex node server.js
```

## Итого к вечеру

| Возможность | Статус |
|-------------|--------|
| Codex (GPT) | ✅ Готово |
| Mistral | ✅ Готово |
| Together.ai | ✅ Готово |
| Фото генерация | ✅ Готово |
| Видео генерация | ✅ Готово |
| Видео монтаж (FFmpeg) | ✅ Готово |

---
Ссылки для регистрации:
- https://console.mistral.ai/
- https://api.together.xyz/
- https://replicate.com/
