#!/usr/bin/env bash
# Локальный контур в Linux-песочнице агента одной командой (#633).
#
#   bash scripts/sandbox-bootstrap.sh              # всё по порядку
#   bash scripts/sandbox-bootstrap.sh <шаг>        # worktree | deps | chromium | bundle | check
#   HP_BRANCH=issue/633-local-contour bash scripts/sandbox-bootstrap.sh
#
# Идемпотентен: готовый шаг узнаётся и пропускается, поэтому при обрыве (лимит
# одной команды песочницы ≈ 3 мин, перезапуск песочницы стирает /tmp) скрипт
# просто запускают ещё раз. Каждый шаг по отдельности укладывается в 3 минуты;
# `all` на холодной песочнице может не уложиться — тогда повторить, сделанное
# не переделывается. Скрипт не знает ни путей владельца, ни учётных данных: всё
# машинно-специфичное приходит переменными окружения.
#
#   HP_CLONE               клон, из которого заводится worktree (по умолчанию —
#                          репозиторий, где лежит этот скрипт)
#   HP_WORKTREE            куда положить worktree (/tmp/hp-wt)
#   HP_BRANCH              ветка worktree; если есть на origin — берётся оттуда,
#                          иначе создаётся от HP_REF. Без неё — detached HEAD
#   HP_REF                 от чего заводить (origin/dev)
#   HP_SHARED_NODE_MODULES готовый node_modules с тем же package-lock.json:
#                          ссылка на него вместо npm ci (параллельные сессии)
#   HP_CHROMIUM_DIR        куда распаковать Chromium (/tmp/chr)
#   HP_CHROMIUM_PKG        npm-пакет с Chromium (@sparticuz/chromium@152.0.0)
#
# Почему Chromium из npm, а не `npx playwright install`: CDN Playwright
# (cdn.playwright.dev) закрыт allowlist'ом песочницы, а реестр npm открыт.
# Пакет содержит brotli-архив бинаря и его библиотек; Playwright получает шим по
# своему ожидаемому пути, который запускает этот бинарь. Существующий настоящий
# браузер по этому пути не трогается — шим узнаётся по маркеру.
#
# Golden этим браузером не снимаются (#455, только Linux CI); смоки и
# `golden:verify` как совет — да.
set -euo pipefail

STEP="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLONE="${HP_CLONE:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)}"
WT="${HP_WORKTREE:-/tmp/hp-wt}"
REF="${HP_REF:-origin/dev}"
BRANCH="${HP_BRANCH:-}"
CHR="${HP_CHROMIUM_DIR:-/tmp/chr}"
CHR_PKG="${HP_CHROMIUM_PKG:-@sparticuz/chromium@152.0.0}"
SHIM_MARK="# hp-sandbox-bootstrap chromium shim"

say() { printf '%s\n' "$*"; }
die() { printf 'sandbox-bootstrap: %s\n' "$*" >&2; exit 1; }

step_worktree() {
  if git -C "$WT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    say "worktree: $WT уже есть ($(git -C "$WT" rev-parse --abbrev-ref HEAD) @ $(git -C "$WT" rev-parse --short HEAD)) — не трогаю"
    return 0
  fi
  [ -e "$WT" ] && die "$WT существует, но это не рабочее дерево git — уберите его или задайте HP_WORKTREE"
  git -C "$CLONE" fetch -q origin
  if [ -n "$BRANCH" ]; then
    local from="$REF"
    if [ -z "${HP_REF:-}" ] && git -C "$CLONE" rev-parse -q --verify "refs/remotes/origin/$BRANCH" >/dev/null; then
      from="origin/$BRANCH"
    fi
    git -C "$CLONE" worktree add -q -B "$BRANCH" "$WT" "$from"
    say "worktree: $WT на $BRANCH от $from"
  else
    git -C "$CLONE" worktree add -q --detach "$WT" "$REF"
    say "worktree: $WT, detached на $REF"
  fi
}

lock_digest() { sha256sum "$WT/package-lock.json" | cut -d' ' -f1; }

step_deps() {
  [ -f "$WT/package-lock.json" ] || die "нет $WT/package-lock.json — сначала шаг worktree"
  local stamp="$WT/node_modules/.hp-bootstrap-lock"
  if [ -n "${HP_SHARED_NODE_MODULES:-}" ]; then
    [ -x "$HP_SHARED_NODE_MODULES/.bin/tsc" ] || die "HP_SHARED_NODE_MODULES=$HP_SHARED_NODE_MODULES без .bin/tsc"
    if [ ! -e "$WT/node_modules" ]; then ln -s "$HP_SHARED_NODE_MODULES" "$WT/node_modules"; fi
    say "deps: node_modules -> $HP_SHARED_NODE_MODULES (общий; package-lock обязан совпадать)"
  elif [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$(lock_digest)" ] && [ -x "$WT/node_modules/.bin/tsc" ]; then
    say "deps: node_modules соответствует package-lock.json — npm ci не нужен"
  else
    # --ignore-scripts: postinstall Playwright полез бы на закрытый CDN, а
    # prepare (установка хуков) выполняется ниже явно и только при нужде.
    (cd "$WT" && npm ci --ignore-scripts --no-audit --no-fund >/tmp/hp-bootstrap-npm-ci.log 2>&1) \
      || { tail -20 /tmp/hp-bootstrap-npm-ci.log >&2; die "npm ci не удался (лог: /tmp/hp-bootstrap-npm-ci.log)"; }
    lock_digest >"$stamp"
    say "deps: npm ci — ok"
  fi
  if [ "$(git -C "$WT" config --get core.hooksPath || true)" != ".githooks" ]; then
    (cd "$WT" && node scripts/install-hooks.mjs)
  fi
}

# Пути, по которым установленный Playwright ищет свои браузеры.
playwright_targets() {
  (cd "$WT" && node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    import { dirname, join } from 'node:path';
    const require = createRequire(join(process.cwd(), 'package.json'));
    const { chromium } = require('playwright');
    const full = chromium.executablePath();
    const root = dirname(dirname(dirname(full)));
    // browsers.json не экспортирован пакетом — читается по пути от его корня.
    const core = dirname(require.resolve('playwright-core'));
    const { browsers } = JSON.parse(readFileSync(join(core, 'browsers.json'), 'utf8'));
    const rev = browsers.find((b) => b.name === 'chromium-headless-shell').revision;
    const shell = join(root, 'chromium_headless_shell-' + rev);
    console.log([full,
      join(shell, 'chrome-linux64', 'chrome-headless-shell'),
      join(shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell')].join('\n'));
  ")
}

brotli_out() { node -e "const z=require('zlib'),fs=require('fs');fs.writeFileSync(process.argv[2],z.brotliDecompressSync(fs.readFileSync(process.argv[1])));" "$1" "$2"; }

step_chromium() {
  [ -x "$WT/node_modules/.bin/tsc" ] || die "нет node_modules — сначала шаг deps"
  if [ ! -x "$CHR/bin/chromium" ]; then
    mkdir -p "$CHR/bin"
    local tgz
    tgz="$(ls "$CHR"/*.tgz 2>/dev/null | head -1 || true)"
    if [ -z "$tgz" ]; then
      (cd "$CHR" && npm pack --silent "$CHR_PKG" >/dev/null) || die "npm pack $CHR_PKG не удался"
      tgz="$(ls "$CHR"/*.tgz | head -1)"
    fi
    tar xzf "$tgz" -C "$CHR"
    brotli_out "$CHR/package/bin/chromium.br" "$CHR/bin/chromium.tmp"
    for archive in "$CHR"/package/bin/*.tar.br; do
      [ -f "$archive" ] || continue
      brotli_out "$archive" "$CHR/x.tar"
      tar xf "$CHR/x.tar" -C "$CHR/bin" 2>/dev/null || true
      rm -f "$CHR/x.tar"
    done
    chmod +x "$CHR/bin/chromium.tmp"
    mv "$CHR/bin/chromium.tmp" "$CHR/bin/chromium"   # последним: наличие = распаковка завершена
    say "chromium: распакован $CHR_PKG в $CHR/bin"
  else
    say "chromium: $CHR/bin/chromium уже есть"
  fi
  local targets target
  targets="$(playwright_targets)" || die "не удалось узнать пути браузеров Playwright"
  [ -n "$targets" ] || die "Playwright не назвал ни одного пути браузера"
  while IFS= read -r target; do
    [ -n "$target" ] || continue
    if [ -e "$target" ] && ! grep -q "$SHIM_MARK" "$target" 2>/dev/null; then
      say "chromium: $target — настоящий браузер, шим не ставлю"
      continue
    fi
    mkdir -p "$(dirname "$target")"
    printf '#!/bin/bash\n%s\nexport LD_LIBRARY_PATH="%s/bin/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"\nexec "%s/bin/chromium" --headless=new "$@"\n' \
      "$SHIM_MARK" "$CHR" "$CHR" >"$target"
    chmod +x "$target"
  done <<<"$targets"
  say "chromium: шимы Playwright на месте"
}

step_bundle() {
  [ -x "$WT/node_modules/.bin/tsc" ] || die "нет node_modules — сначала шаг deps"
  (cd "$WT" && npm run --silent bundle:sync >/tmp/hp-bootstrap-bundle.log 2>&1) \
    || { tail -30 /tmp/hp-bootstrap-bundle.log >&2; die "npm run bundle:sync не удался (лог: /tmp/hp-bootstrap-bundle.log)"; }
  say "bundle: npm run bundle:sync — ok (dist, demo/srv/assets; custom_components — только кандидат, #657)"
}

step_check() {
  (cd "$WT" && node --input-type=module -e "
    import { createRequire } from 'node:module';
    import { join } from 'node:path';
    const require = createRequire(join(process.cwd(), 'package.json'));
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent('<p id=ok>houseplan</p>');
    const text = await page.textContent('#ok');
    const version = browser.version();
    await browser.close();
    if (text !== 'houseplan') { console.error('playwright: страница не отрисовалась'); process.exit(1); }
    console.log('check: playwright открыл страницу, Chromium ' + version);
  ") || die "проверка Playwright не прошла — повторите шаг chromium"
  say "готово: cd $WT && node demo/smoke_edge_cases.mjs"
}

case "$STEP" in
  worktree) step_worktree ;;
  deps) step_deps ;;
  chromium) step_chromium ;;
  bundle) step_bundle ;;
  check) step_check ;;
  all) step_worktree; step_deps; step_chromium; step_bundle; step_check ;;
  -h|--help|help) sed -n '2,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
  *) die "неизвестный шаг «$STEP»: worktree | deps | chromium | bundle | check | all" ;;
esac
