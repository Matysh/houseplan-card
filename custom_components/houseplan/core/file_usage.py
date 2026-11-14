"""Pure bounded-root filesystem usage helper shared with HA uploads."""
from pathlib import Path as Path


def dir_usage(path: Path, *, exclude: Path | None = None) -> tuple[int, int]:
    """(bytes, files) below `path`, ignoring what we cannot read.

    `exclude` is the caller's own staged upload: it already lives under `path`
    and its size arrives separately as `incoming`, so counting it here would
    charge the same bytes and the same file twice (#498). Any *other* staged
    file stays in the count — it is about to become an attachment.
    """
    total = count = 0
    if not path.is_dir():
        return 0, 0
    for item in path.rglob("*"):
        if exclude is not None and item == exclude:
            continue
        try:
            if item.is_file():
                total += item.stat().st_size
                count += 1
        except OSError:
            continue
    return total, count

