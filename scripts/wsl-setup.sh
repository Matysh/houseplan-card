#!/usr/bin/env bash
# Воспроизводимый локальный Linux-контур с пинами CI (#496): WSL2 или любой Linux.
#
# Пины не задаются здесь — читаются `node scripts/toolchain-pins.mjs --json`
# (тот же источник, что у CI). Скрипт идемпотентен: повторный запуск ничего не
# ломает. Полный HA-харнесс и каноническое релизное доказательство остаются за
# Linux CI на точном SHA; этот контур — ранняя обратная связь.
#
#   bash scripts/wsl-setup.sh            # установить/обновить окружение
#   bash scripts/wsl-setup.sh --check    # только сверить с пинами
#
# Требует: git, curl. Node ставится через nvm (в ~/.nvm), Python — через uv
# (в .venv репозитория), Chromium — Playwright той версии, что в lockfile.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--check" ]; then
  exec node scripts/toolchain-pins.mjs --check
fi

# Node нужен уже для чтения пинов; bootstrap — из .nvmrc (тест держит его равным CI).
NODE_PIN=$(tr -d '[:space:]' < .nvmrc)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm не найден — устанавливаю в $NVM_DIR"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install "$NODE_PIN" >/dev/null
nvm use "$NODE_PIN" >/dev/null
echo "node $(node --version) (пин $NODE_PIN)"

npm ci --no-audit --no-fund

PY_PIN=$(node scripts/toolchain-pins.mjs --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).python))')
if ! command -v uv >/dev/null 2>&1; then
  echo "uv не найден — устанавливаю"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
uv python install "$PY_PIN" >/dev/null
[ -d .venv ] || uv venv --python "$PY_PIN" .venv >/dev/null
uv pip install --python .venv/bin/python -r tests_backend/requirements.txt >/dev/null
echo "python $(.venv/bin/python --version) + HA-стек из tests_backend/requirements.txt"

npx playwright install chromium >/dev/null
echo "chromium: $(node -e 'console.log(require("playwright").chromium.executablePath())')"

# Сверка тем же скриптом, что и на Windows; python берётся из .venv.
PATH="$PWD/.venv/bin:$PATH" node scripts/toolchain-pins.mjs --check
