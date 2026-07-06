# Hermes-MiMo Bridge

API-сервис, совместимый с MiMoCode, который подключается к Hermes/Gemma.

## Что это делает

Превращает вашего Hermes-бота в полноценный инструмент разработки с доступом к файловой системе, терминалу и поиску по коду.

## Установка

```bash
cd /root/mimo-dev-assistant/hermes-api
npm install
```

## Запуск

```bash
# С настройками по умолчанию (Ollama на localhost:11434, модель gemma)
node server.js

# С кастомными настройками
HERMES_URL=http://your-hermes-host:8080 MODEL=gemma2 node server.js

# С указанием проекта
PROJECT_DIR=/path/to/your/project node server.js
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `PORT` | 3000 | Порт сервера |
| `HERMES_URL` | http://localhost:11434 | URL Hermes/Ollama API |
| `MODEL` | gemma | Имя модели |
| `PROJECT_DIR` | текущая папка | Корень проекта |

## Использование с MiMoCode

```bash
# В mimo-dev-assistant/index.js добавить подключение к bridge
node index.js --server http://localhost:3000 -p "создай REST API"
```

## API Endpoints

### POST /v1/chat/completions
OpenAI-совместимый чат. Принимает стандартный формат OpenAI API.

### POST /v1/agent
Агент с использованием инструментов. Принимает `{ prompt, maxIterations }`.

### GET /v1/models
Список доступных моделей.

### GET /v1/tools
Список доступных инструментов.

### GET /health
Проверка состояния.

## Инструменты

- `read_file` — чтение файлов
- `write_file` — запись файлов
- `list_files` — список файлов в директории
- `bash` — выполнение команд терминала
- `search` — поиск по кодовой базе
