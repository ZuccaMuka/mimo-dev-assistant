#!/usr/bin/env python3
"""Комплексные тесты компонентов mimo-dev-assistant"""

import requests
import subprocess
import json
import sys
import os
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []

    def check(self, name, condition):
        if condition:
            self.passed += 1
            self.results.append(f"  ✅ {name}")
        else:
            self.failed += 1
            self.results.append(f"  ❌ {name}")

    def print_results(self):
        for r in self.results:
            print(r)
        print(f"\n{'='*50}")
        print(f"РЕЗУЛЬТАТ: {self.passed} пройдено, {self.failed} провалено")
        print(f"{'='*50}")


tests = TestResults()

# 1. Multi-agent
print("[1] Multi-agent сервер")
try:
    r = requests.get("http://localhost:3001/health", timeout=5)
    tests.check("Health check", r.json()['status'] == 'ok')
except:
    tests.check("Health check", False)

# 2. Mock Hermes
print("[2] Mock Hermes")
try:
    r = requests.get("http://localhost:11434/health", timeout=5)
    tests.check("Health check", r.json()['status'] == 'ok')
except:
    tests.check("Health check", False)

# 3. Z.AI API
print("[3] Z.AI API (GLM 4.7)")
if ZAI_API_KEY:
    try:
        r = requests.post("https://api.z.ai/api/anthropic/v1/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": ZAI_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            json={"model": "glm-4.7", "max_tokens": 10, "messages": [{"role": "user", "content": "Say OK"}]},
            timeout=15)
        tests.check("API request", r.status_code == 200)
        tests.check("Model response", "model" in r.json())
    except:
        tests.check("API request", False)
else:
    tests.check("API request (no key)", False)

# 4. Perplexity API
print("[4] Perplexity API")
if PERPLEXITY_API_KEY:
    try:
        r = requests.post("https://api.perplexity.ai/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {PERPLEXITY_API_KEY}"
            },
            json={"model": "sonar", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 20},
            timeout=15)
        tests.check("API request", r.status_code == 200)
        tests.check("Search results", "search_results" in r.json())
    except:
        tests.check("API request", False)
else:
    tests.check("API request (no key)", False)

# 5. GitHub API
print("[5] GitHub API")
if GITHUB_TOKEN:
    try:
        r = requests.get("https://api.github.com/user",
            headers={"Authorization": f"token {GITHUB_TOKEN}"},
            timeout=10)
        tests.check("Auth check", r.status_code == 200)
        tests.check("Username", r.json().get('login') == 'ZuccaMuka')
    except:
        tests.check("Auth check", False)
else:
    tests.check("Auth check (no token)", False)

# 6. Claude Code
print("[6] Claude Code")
try:
    r = subprocess.run(["claude", "--version"], capture_output=True, text=True, timeout=5)
    tests.check("Installed", r.returncode == 0)
except:
    tests.check("Installed", False)

# 7. Hermes Gateway
print("[7] Hermes Gateway")
try:
    r = subprocess.run(["systemctl", "is-active", "hermes-gateway"], capture_output=True, text=True, timeout=5)
    tests.check("Service active", r.stdout.strip() == "active")
except:
    tests.check("Service active", False)

# 8. MCP Servers
print("[8] MCP Servers")
try:
    r = subprocess.run(["bash", "-c", "su - hermes -c 'hermes mcp list'"], capture_output=True, text=True, timeout=10)
    tests.check("Filesystem MCP", "filesystem" in r.stdout)
    tests.check("GitHub MCP", "github" in r.stdout)
except:
    tests.check("Filesystem MCP", False)

# 9. Multi-agent task
print("[9] Multi-agent task")
try:
    r = requests.post("http://localhost:3001/v1/process",
        json={"prompt": "Say OK"},
        timeout=120)
    tests.check("Task execution", r.json()['summary']['status'] == 'success')
except:
    tests.check("Task execution", False)

# Print results
print()
tests.print_results()

sys.exit(tests.failed)
