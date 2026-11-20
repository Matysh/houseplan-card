"""Compare captured #1485 gesture frames with Gaussian-filtered exact frames."""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageStat


# Device-pixel sigma and maximum mean RGB error on the accepted 2786×1758
# fixture. See docs/evidence/1485-camera-performance.md for calibration.
CASES = (
    (1.5, False, 0.5, 1.10),
    (2.0, False, 1.0, 1.42),
    (3.0, False, 3.0, 1.38),
    (4.0, False, 6.0, 1.55),
    (2 / 3, True, 0.25, 1.60),
    (0.5, True, 0.25, 1.76),
    (1 / 3, True, 0.25, 2.75),
)
SIZE = (2786, 1758)


def check_frame(directory, record, factor, underlay, sigma, limit):
    frame_id = record["id"]
    with (
        Image.open(directory / f"{frame_id}-gesture.png") as gesture,
        Image.open(directory / f"{frame_id}-exact.png") as exact,
    ):
        if gesture.size != SIZE or exact.size != SIZE:
            raise ValueError(f"{frame_id}: comparison requires the {SIZE} fixture")
        blur = exact.convert("RGB").filter(ImageFilter.GaussianBlur(sigma))
        error = sum(ImageStat.Stat(ImageChops.difference(gesture.convert("RGB"), blur)).mean) / 3
    same_pose = (
        record["active"]
        and record["visibility"] == "visible"
        and record["underlay"] == underlay
        and math.isclose(record["scale"], factor, abs_tol=.02)
    )
    print(f"{frame_id:8} sigma={sigma:4.2f}  mean RGB error={error:.4f}  limit={limit:.2f}")
    return same_pose and error <= limit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gallery", type=Path)
    args = parser.parse_args()
    records = json.loads((args.gallery / "frames.json").read_text(encoding="utf-8"))["results"]
    by_id = {row["id"]: row for row in records}
    names = {f"{theme}-{index}" for theme in ("light", "dark") for index in range(1, len(CASES) + 1)}
    if set(by_id) != names or len(records) != len(names):
        parser.error("Expected all 14 unique light/dark gallery pairs")
    results = [
        check_frame(args.gallery, by_id[f"{theme}-{index}"], *case)
        for theme in ("light", "dark")
        for index, case in enumerate(CASES, start=1)
    ]
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
