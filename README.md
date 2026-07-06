# Multi-Agent Development System

Система агентов для разработки ПО на базе Hermes/Gemma с поддержкой OpenAI Codex.

## Структура

```
mimo-dev-assistant/
├── hermes-api/           # Bridge-сервер (OpenAI-совместимый)
│   ├── server.js         # API сервер (порт 3000)
│   ├── mock-hermes.js    # Мок Hermes для тестов
│   └── package.json
├── multi-agent/          # Multi-agent система
│   ├── orchestrator.js   # Оркестратор
│   ├── agents/
│   │   ├── base.js       # Базовый агент
│   │   ├── planner.js    # Планировщик
│   │   ├── builder.js    # Разработчик (Hermes)
│   │   ├── codex.js      # Разработчик (Codex)
│   │   └── reviewer.js   # Ревьюер
│   ├── memory/
│   │   ├── store.js      # Хранилище сессий
│   │   ├── tasks.js      # Трекер задач
│   │   └── persistent.js # JSON-персистентность
│   ├── tools/
│   │   ├── registry.js   # Реестр инструментов
│   │   └── executor.js   # Исполнитель
│   ├── server.js         # API сервер (порт 3001)
│   └── package.json
├── hermes-client.js      # Простой клиент
└── README.md
```

## Быстрый старт

### 1. Установка зависимостей

```bash
cd /root/mimo-dev-assistant/hermes-api && npm install
cd /root/mimo-dev-assistant/multi-agent && npm install
```

### 2. Запуск

```bash
# Терминал 1: Mock Hermes
node /root/mimo-dev-assistant/hermes-api/mock-hermes.js

# Терминал 2: Multi-agent сервер
cd /root/mimo-dev-assistant/multi-agent
node server.js
```

### 3. Использование

```bash
# Отправить запрос
curl -X POST http://localhost:3001/v1/process \
  -H "Content-Type: application/json" \
  -d '{"prompt":"создай REST API"}'

# Стриминг
curl -X POST http://localhost:3001/v1/process/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"создай сайт"}'
```

## Запуск с Codex

```bash
# 1. Авторизуйтесь
hermes auth add openai-codex

# 2. Запустите с Codex
BUILDER_ENGINE=codex node server.js

# 3. Используйте
curl -X POST http://localhost:3001/v1/codex/execute \
  -H "Content-Type: application/json" \
  -d '{"task":{"name":"Create API","description":"Create REST API"}}'
```

## API Endpoints

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | /v1/agents | Список агентов |
| POST | /v1/process | Обработка запроса |
| POST | /v1/process/stream | Стриминг (SSE) |
| GET | /v1/tasks | Список задач |
| GET | /v1/timeline | Таймлайн |
| GET | /v1/memory | Память |
| POST | /v1/memory | Сохранить в память |
| GET | /v1/sessions | Сессии |
| GET | /v1/codex/status | Статус Codex |
| POST | /v1/codex/execute | Выполнить через Codex |
| POST | /v1/codex/review | Ревью PR |
| POST | /v1/codex/fix-issue | Исправить issue |
| GET | /health | Проверка здоровья |

## Порты

| Сервис | Порт |
|--------|------|
| Mock Hermes | 11434 |
| Bridge API | 3000 |
| Multi-Agent | 3001 |

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| HERMES_URL | http://localhost:11434 | URL Hermes/Ollama |
| MODEL | gemma | Имя модели |
| BUILDER_ENGINE | hermes | Движок: hermes или codex |
| PROJECT_DIR | . | Корень проекта |
| DATA_DIR | ./data | Данные |
| PORT | 3001 | Порт сервера |
