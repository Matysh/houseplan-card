#!/usr/bin/env bash
# Воспроизводимый локальный Linux-контур с пинами CI (#496): WSL2 или любой Linux.
#
# Пины не задаются здесь — читаются `node scripts/toolchain-pins.mjs --json`
# (тот же источник, что у CI). Скрипт идемпотентен: повторный запуск ничего не
# ломает. Полный HA-харнесс и каноническое релизное доказательство остаются за
# Linux CI на точном SHA; этот контур — ранняя обратная связь.
#
#   bash scripts/wsl-setup.sh            # установить/обновить окружение
#   bash scripts/wsl-setup.sh --check    # только сверить dedicated entrypoints
#   bash scripts/wsl-setup.sh --verify   # setup + HA subset + one visual capture
#
# Требует: git, curl. Node ставится через nvm (в ~/.nvm), Python — через uv
# (в .venv репозитория), Chromium — Playwright той версии, что в lockfile.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE=${1:-setup}
case "$MODE" in
  setup|--check|--verify) ;;
  *) echo "usage: bash scripts/wsl-setup.sh [--check|--verify]" >&2; exit 2 ;;
esac
START_SECONDS=$SECONDS

# Node нужен уже для чтения пинов; bootstrap — из .nvmrc (тест держит его равным CI).
NODE_PIN=$(tr -d '[:space:]' < .nvmrc)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  if [ "$MODE" = "--check" ]; then
    echo "nvm не найден в $NVM_DIR; сначала: bash scripts/wsl-setup.sh" >&2
    exit 1
  fi
  echo "nvm не найден — устанавливаю в $NVM_DIR"
  # Не менять shell profile: nvm нужен только этому явному entrypoint.
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | PROFILE=/dev/null bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
if [ "$MODE" != "--check" ]; then nvm install "$NODE_PIN" >/dev/null; fi
nvm use "$NODE_PIN" >/dev/null
echo "node $(node --version): $(command -v node) (пин $NODE_PIN)"

# До npm ci полного `toolchain-pins --json` ещё нет: Chromium pin живёт в
# node_modules/playwright-core/browsers.json. Bootstrap берёт стандартный
# Python pin-файл; тест гарантирует его равенство каноническому CI workflow.
PY_PIN=$(tr -d '[:space:]' < .python-version)
UV_BIN=""
if [ -x "$HOME/.local/bin/uv" ]; then
  UV_BIN="$HOME/.local/bin/uv"
elif command -v uv >/dev/null 2>&1; then
  UV_BIN=$(command -v uv)
fi
if [ -z "$UV_BIN" ] && [ "$MODE" != "--check" ]; then
  echo "uv не найден — устанавливаю"
  # Как и nvm, не прописывать локальный helper в пользовательский shell profile.
  curl -LsSf https://astral.sh/uv/install.sh | UV_NO_MODIFY_PATH=1 sh
  UV_BIN="$HOME/.local/bin/uv"
fi
VENV=${HOUSEPLAN_VENV:-.venv-ci}
PYTHON_EXE="$PWD/$VENV/bin/python"
if [ "$MODE" != "--check" ]; then
  "$UV_BIN" python install "$PY_PIN" >/dev/null
  if [ -x "$PYTHON_EXE" ]; then
    EXISTING_MINOR=$($PYTHON_EXE -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    if [ "$EXISTING_MINOR" != "$PY_PIN" ]; then
      echo "$VENV использует Python $EXISTING_MINOR, нужен $PY_PIN; окружение не удалено, выберите другое HOUSEPLAN_VENV" >&2
      exit 1
    fi
  else
    "$UV_BIN" venv --python "$PY_PIN" "$VENV" >/dev/null
  fi
  "$UV_BIN" pip install --python "$PYTHON_EXE" -r tests_backend/requirements.txt >/dev/null
fi
if [ ! -x "$PYTHON_EXE" ]; then
  echo "$PYTHON_EXE не найден; сначала: bash scripts/wsl-setup.sh" >&2
  exit 1
fi
echo "python $($PYTHON_EXE --version): $PYTHON_EXE + HA-стек из tests_backend/requirements.txt"

if [ "$MODE" != "--check" ]; then
  npm ci --no-audit --no-fund
  npx playwright install chromium >/dev/null
fi
echo "chromium: $(node -e 'console.log(require("playwright").chromium.executablePath())')"

# Сверка тем же скриптом, что и на Windows; Python передаётся явно и не зависит от PATH.
node scripts/toolchain-pins.mjs --check --python "$PYTHON_EXE"

if [ "$MODE" = "--verify" ]; then
  echo "HA subset: tests_backend/test_ha_setup.py"
  "$PYTHON_EXE" -c 'import fcntl; from importlib.metadata import version; print("HA import: " + version("homeassistant"))'
  "$PYTHON_EXE" -m pytest tests_backend/test_ha_setup.py -q

  echo "visual capture: panel-wide-view-light-en"
  npm run build
  node scripts/bundle-sync.mjs
  node demo/golden/run.mjs --mode=capture --scenario=panel-wide-view-light-en
  CAPTURE="$PWD/artifacts/golden/actual/panel-wide-view-light-en.png"
  test -s "$CAPTURE"
  echo "capture: $CAPTURE ($(wc -c < "$CAPTURE") bytes)"
fi

echo "WSL toolchain $MODE: $((SECONDS - START_SECONDS))s"
