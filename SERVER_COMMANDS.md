# Управление серверами Mimo Dev Assistant

## Запуск серверов

### Mock Hermes (порт 11434)
```bash
screen -dmS hermes bash -c "cd /root/mimo-dev-assistant && node hermes-api/mock-hermes.js"
```

### Multi-Agent сервер (порт 3001)
```bash
screen -dmS multi bash -c "cd /root/mimo-dev-assistant/multi-agent && BUILDER_ENGINE=claude node server.js"
```

### Все серверы вместе
```bash
screen -dmS hermes bash -c "cd /root/mimo-dev-assistant && node hermes-api/mock-hermes.js"
sleep 2
screen -dmS multi bash -c "cd /root/mimo-dev-assistant/multi-agent && BUILDER_ENGINE=claude node server.js"
```

## Остановка серверов

### Остановить Mock Hermes
```bash
screen -X -S hermes quit
```

### Остановить Multi-Agent
```bash
screen -X -S multi quit
```

### Остановить все серверы
```bash
screen -X -S hermes quit
screen -X -S multi quit
# Или все сразу
pkill -f "node server.js"
pkill -f "mock-hermes"
```

## Просмотр логов

### Логи Mock Hermes
```bash
screen -r hermes
# Выйти: Ctrl+A, D
```

### Логи Multi-Agent
```bash
screen -r multi
# Выйти: Ctrl+A, D
```

### Список активных screen сессий
```bash
screen -ls
```

## Проверка статуса

### Проверка портов
```bash
netstat -tlnp | grep -E "3001|11434"
```

### Health check
```bash
curl -s http://localhost:3001/health
curl -s http://localhost:11434/health
```

### Список агентов
```bash
curl -s http://localhost:3001/v1/agents | python3 -m json.tool
```

### Статус Claude
```bash
curl -s http://localhost:3001/v1/claude/status
```

### Список провайдеров
```bash
curl -s http://localhost:3001/v1/providers | python3 -m json.tool
```

## Тестирование

### Тест через API
```bash
curl -X POST http://localhost:3001/v1/process \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Создай hello.py"}'
```

### Тест Claude напрямую
```bash
claude --print "Скажи привет"
claude --allowedTools "Edit,Write,Bash" --print "Создай calculator.py"
```

### Тест с памятью
```bash
claude --allowedTools "Bash,Read" --print "Прочитай память Hermes"
```

## Работа с памятью

### Чтение памяти
```bash
cat /home/hermes/.hermes/memories/USER.md
```

### Запись в память
```bash
bash /root/mimo-dev-assistant/multi-agent/save-memory.sh "текст для сохранения"
```

### Очистка памяти
```bash
echo "" > /home/hermes/.hermes/memories/USER.md
```

## Перезапуск

### Перезапустить Mock Hermes
```bash
screen -X -S hermes quit
sleep 1
screen -dmS hermes bash -c "cd /root/mimo-dev-assistant && node hermes-api/mock-hermes.js"
```

### Перезапустить Multi-Agent
```bash
screen -X -S multi quit
sleep 1
screen -dmS multi bash -c "cd /root/mimo-dev-assistant/multi-agent && BUILDER_ENGINE=claude node server.js"
```

### Перезапустить все
```bash
screen -X -S hermes quit
screen -X -S multi quit
sleep 1
screen -dmS hermes bash -c "cd /root/mimo-dev-assistant && node hermes-api/mock-hermes.js"
sleep 2
screen -dmS multi bash -c "cd /root/mimo-dev-assistant/multi-agent && BUILDER_ENGINE=claude node server.js"
```

## Диагностика

### Проверить процессы
```bash
ps aux | grep node | grep -v grep
```

### Проверить占用 портов
```bash
lsof -i :3001
lsof -i :11434
```

### Проверить логи ошибок
```bash
screen -r hermes
screen -r multi
```

## Использование Claude Code

### Прямой доступ
```bash
claude --print "твой запрос"
```

### С инструментами
```bash
claude --allowedTools "Edit,Write,Bash,Read" --print "создай файл"
```

### Интерактивный режим
```bash
claude
```

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /health | Проверка здоровья |
| GET | /v1/agents | Список агентов |
| POST | /v1/process | Обработка запроса |
| GET | /v1/tasks | Список задач |
| GET | /v1/providers | Провайдеры |
| GET | /v1/claude/status | Статус Claude |
| POST | /v1/claude/execute | Выполнить через Claude |
| POST | /v1/claude/review | Обзор кода |
