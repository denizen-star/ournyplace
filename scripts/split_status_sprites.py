#!/usr/bin/env python3
"""
Split a 3-row status badge sheet (4 + 4 + 5 cells) into one PNG per status.

Layout matches the standard nyhome order in lib/apartmentStatus.js.
Install: python3 -m pip install -r scripts/requirements-sprites.txt
Usage:  python3 scripts/split_status_sprites.py <path-to-sheet.png> [-o out-dir]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print(
        "Pillow is required. Run: python3 -m pip install -r scripts/requirements-sprites.txt",
        file=sys.stderr,
    )
    raise

# Row-major: 4, then 4, then 5 — must match the composite image order
STATUS_ORDER = [
    "new",
    "evaluating",
    "shortlisted",
    "tour_scheduled",
    "toured",
    "finalist",
    "applying",
    "applied",
    "approved",
    "lease_review",
    "signed",
    "rejected",
    "archived",
]

ROW_COLS = (4, 4, 5)


def split_sheet(img: Image.Image) -> list[tuple[str, Image.Image]]:
    w, h = img.size
    if w < 1 or h < 1:
        raise ValueError("Image has no area")

    out: list[tuple[str, Image.Image]] = []
    idx = 0
    for row, ncols in enumerate(ROW_COLS):
        top = (row * h) // len(ROW_COLS)
        bottom = ((row + 1) * h) // len(ROW_COLS)
        for j in range(ncols):
            if idx >= len(STATUS_ORDER):
                break
            left = (j * w) // ncols
            right = ((j + 1) * w) // ncols
            name = STATUS_ORDER[idx]
            cell = img.crop((left, top, right, bottom))
            out.append((name, cell))
            idx += 1
    if idx != len(STATUS_ORDER):
        raise RuntimeError(f"Expected {len(STATUS_ORDER)} cells, got {idx}")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export each status badge from a 4+4+5 grid PNG."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Composite PNG (three rows: 4, 4, 5 icons)",
    )
    parser.add_argument(
        "-o",
        "--out-dir",
        type=Path,
        default=Path("assets/img/status-badges"),
        help="Output directory (created if missing). Default: assets/img/status-badges",
    )
    args = parser.parse_args()

    input_path: Path = args.input
    if not input_path.is_file():
        print(f"Not found: {input_path}", file=sys.stderr)
        return 1

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(input_path) as im:
        if im.mode in ("P", "PA"):
            im = im.convert("RGBA")
        elif im.mode != "RGB" and im.mode != "RGBA":
            im = im.convert("RGBA")
        pieces = split_sheet(im)

    for name, cell in pieces:
        out_path = out_dir / f"{name}.png"
        cell.save(out_path, "PNG", optimize=True)
        print(out_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
