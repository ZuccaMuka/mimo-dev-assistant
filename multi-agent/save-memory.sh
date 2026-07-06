#!/bin/bash
# Auto-save conversation to Hermes memory
# Использование: ./save-memory.sh "содержимое для сохранения"

MEMORY_FILE="/home/hermes/.hermes/memories/USER.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")

if [ -n "$1" ]; then
  echo "" >> "$MEMORY_FILE"
  echo "## [$TIMESTAMP]" >> "$MEMORY_FILE"
  echo "$1" >> "$MEMORY_FILE"
  echo "Сохранено в память Hermes"
else
  echo "Укажите текст для сохранения"
  echo "Использование: $0 'текст'"
fi
