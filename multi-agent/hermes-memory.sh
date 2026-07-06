#!/bin/bash
# Hermes Memory Tool for Claude Code
# Использование: ./hermes-memory.sh [read|write|list] [ключ] [значение]

MEMORY_DIR="/home/hermes/.hermes/memories"
MEMORY_FILE="$MEMORY_DIR/USER.md"

case "$1" in
  read)
    if [ -f "$MEMORY_FILE" ]; then
      cat "$MEMORY_FILE"
    else
      echo "Память пуста"
    fi
    ;;
  write)
    if [ -n "$2" ]; then
      echo "$2" >> "$MEMORY_FILE"
      echo "Записано: $2"
    else
      echo "Укажите текст для записи"
    fi
    ;;
  list)
    ls -la "$MEMORY_DIR/"
    ;;
  clear)
    echo "" > "$MEMORY_FILE"
    echo "Память очищена"
    ;;
  *)
    echo "Использование: $0 [read|write|list|clear] [текст]"
    echo "  read   — прочитать память"
    echo "  write  — записать в память"
    echo "  list   — список файлов памяти"
    echo "  clear  — очистить память"
    ;;
esac
