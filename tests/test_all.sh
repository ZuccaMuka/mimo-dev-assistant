#!/bin/bash
# Тесты всех компонентов mimo-dev-assistant

# Загрузка переменных окружения
source /root/mimo-dev-assistant/.env 2>/dev/null || true

echo "============================================"
echo "ТЕСТЫ ВСЕХ КОМПОНЕНТОВ"
echo "============================================"
echo ""

PASSED=0
FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo "  ✅ $2"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ $2"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Multi-agent сервер
echo "[1] Multi-agent сервер"
curl -s http://localhost:3001/health > /dev/null 2>&1
test_result $? "Health check (port 3001)"

# 2. Mock Hermes
echo ""
echo "[2] Mock Hermes"
curl -s http://localhost:11434/health > /dev/null 2>&1
test_result $? "Health check (port 11434)"

# 3. Z.AI API (GLM 4.7)
echo ""
echo "[3] Z.AI API (GLM 4.7)"
if [ -n "$ZAI_API_KEY" ]; then
    curl -s -X POST "https://api.z.ai/api/anthropic/v1/messages" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $ZAI_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -d '{"model":"glm-4.7","max_tokens":10,"messages":[{"role":"user","content":"Say OK"}]}' > /dev/null 2>&1
    test_result $? "API request"
else
    test_result 1 "API request (no key)"
fi

# 4. Perplexity API
echo ""
echo "[4] Perplexity API"
if [ -n "$PERPLEXITY_API_KEY" ]; then
    curl -s -X POST "https://api.perplexity.ai/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
      -d '{"model":"sonar","messages":[{"role":"user","content":"Hi"}],"max_tokens":20}' > /dev/null 2>&1
    test_result $? "API request"
else
    test_result 1 "API request (no key)"
fi

# 5. GitHub API
echo ""
echo "[5] GitHub API"
if [ -n "$GITHUB_TOKEN" ]; then
    curl -s -H "Authorization: token $GITHUB_TOKEN" \
      https://api.github.com/user > /dev/null 2>&1
    test_result $? "Auth check"
else
    test_result 1 "Auth check (no token)"
fi

# 6. Claude Code
echo ""
echo "[6] Claude Code"
which claude > /dev/null 2>&1
test_result $? "Installed"
claude --version > /dev/null 2>&1
test_result $? "Version check"

# 7. Hermes Gateway
echo ""
echo "[7] Hermes Gateway"
systemctl is-active hermes-gateway > /dev/null 2>&1
test_result $? "Service active"

# 8. MCP Servers
echo ""
echo "[8] MCP Servers"
su - hermes -c "hermes mcp list" 2>/dev/null | grep -q "filesystem"
test_result $? "Filesystem MCP"
su - hermes -c "hermes mcp list" 2>/dev/null | grep -q "github"
test_result $? "GitHub MCP"

# 9. Code Execution
echo ""
echo "[9] Code Execution"
python3 -c "print('OK')" > /dev/null 2>&1
test_result $? "Python available"
node -e "console.log('OK')" > /dev/null 2>&1
test_result $? "Node.js available"

# 10. Streaming
echo ""
echo "[10] Streaming"
grep -q "enabled: true" /home/hermes/.hermes/config.yaml 2>/dev/null
test_result $? "Enabled in config"

# Results
echo ""
echo "============================================"
echo "РЕЗУЛЬТАТ: $PASSED пройдено, $FAILED провалено"
echo "============================================"

exit $FAILED
