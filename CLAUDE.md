# Mimo Dev Assistant

## Описание
Мультиагентная система для разработки кода с AI.

## Структура
- `multi-agent/` — основной сервер (port 3001)
- `hermes-api/` — mock Hermes сервер (port 11434)
- `providers/` — провайдеры (Mistral, Together, Replicate)
- `media/` — модули для генерации медиа

## Память Hermes
Hermes хранит память в `/home/hermes/.hermes/memories/USER.md`

### Автоматическое сохранение памяти
ПОСЛЕ КАЖДОГО РАЗГОВОРА автоматически сохраняй важную информацию в память Hermes.

Команда для сохранения:
```bash
bash /root/mimo-dev-assistant/multi-agent/save-memory.sh "текст для сохранения"
```

Что сохранять:
- Решения и предпочтения пользователя
- Важные факты о проекте
- Завершённые задачи
- Ошибки и их исправления

### Чтение памяти
```bash
cat /home/hermes/.hermes/memories/USER.md
```

## Команды
```bash
# Запуск сервера
cd /root/mimo-dev-assistant/multi-agent
BUILDER_ENGINE=claude node server.js

# Тест через API
curl -X POST http://localhost:3001/v1/process \
  -H "Content-Type: application/json" \
  -d '{"prompt": "задача"}'

# Прямой доступ к Claude
claude --allowedTools "Edit,Write,Bash,Read" --print "задача"
```

## Правила
- Основной язык: русский
- Движок: Claude Code
- Файлы создаём в `multi-agent/`
- **ОБЯЗАТЕЛЬНО** сохраняй в память Hermes после важных решений и задач
