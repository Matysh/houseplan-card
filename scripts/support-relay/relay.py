#!/usr/bin/env python3
"""Точка входа House Plan support relay (#43).

Запуск: `HP_RELAY_SPOOL=… HP_RELAY_MODE=… python3 relay.py`.
Подкоманда `purge` исполняет ретеншн и выходит — её зовёт systemd-таймер.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hp_relay import app, config, ratelimit, store  # noqa: E402


def main(argv: list[str]) -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    cfg = config.load()
    if argv[1:2] == ["purge"]:
        reports = store.Store(cfg.spool).purge(cfg.retention_days)
        keys = ratelimit.Limiter(cfg.spool).purge()
        logging.getLogger("hp-support-relay").info(
            "purged reports=%s rate/idem=%s retention_days=%s", reports, keys, cfg.retention_days,
        )
        return 0
    app.serve(cfg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
