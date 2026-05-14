#!/usr/bin/env python3
"""Generate Chrome extension icon assets from the canonical root icon.png."""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ICON = ROOT / "icon.png"
ICON_DIR = ROOT / "icons"
SIZES = (16, 32, 48, 128, 512)


def main() -> int:
    """Generate all required icon sizes and validate their PNG dimensions."""
    if not SOURCE_ICON.exists():
        print("Missing canonical source icon: ./icon.png", file=sys.stderr)
        return 1

    ICON_DIR.mkdir(exist_ok=True)

    try:
        from PIL import Image
    except ImportError:
        return generate_with_sips_fallback()

    with Image.open(SOURCE_ICON) as source:
        square = square_canvas(source)
        for size in SIZES:
            output = ICON_DIR / f"icon-{size}.png"
            resized = square.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(output, format="PNG", optimize=True)
            validate_png_dimensions(output, size, size)

    print("Generated icons with Pillow Lanczos resampling from ./icon.png")
    return 0


def square_canvas(image):
    """Return an RGBA square image, center-padding non-square input with transparency."""
    from PIL import Image

    rgba = image.convert("RGBA")
    width, height = rgba.size
    edge = max(width, height)
    if width == height:
        return rgba

    canvas = Image.new("RGBA", (edge, edge), (0, 0, 0, 0))
    offset = ((edge - width) // 2, (edge - height) // 2)
    canvas.alpha_composite(rgba, offset)
    return canvas


def generate_with_sips_fallback() -> int:
    """Generate icons with macOS sips when Pillow is unavailable and input is square."""
    width, height = read_png_dimensions(SOURCE_ICON)
    if width != height:
        print(
            "Pillow is required because ./icon.png is not square and transparent center-padding is needed.",
            file=sys.stderr,
        )
        print("Install it with: python3 -m pip install pillow", file=sys.stderr)
        return 1

    sips = shutil.which("sips")
    if not sips:
        print("Pillow is not installed and the macOS sips fallback is unavailable.", file=sys.stderr)
        print("Install Pillow with: python3 -m pip install pillow", file=sys.stderr)
        return 1

    print(
        "Pillow is not installed; using macOS sips fallback. "
        "Fallback scaling is platform-provided and does not guarantee Lanczos resampling.",
        file=sys.stderr,
    )
    for size in SIZES:
        output = ICON_DIR / f"icon-{size}.png"
        subprocess.run(
            [sips, "-s", "format", "png", "-z", str(size), str(size), str(SOURCE_ICON), "--out", str(output)],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        validate_png_dimensions(output, size, size)

    print("Generated icons with macOS sips fallback from ./icon.png")
    return 0


def validate_png_dimensions(path: Path, expected_width: int, expected_height: int) -> None:
    """Validate that a PNG exists and has the expected IHDR dimensions."""
    width, height = read_png_dimensions(path)
    if (width, height) != (expected_width, expected_height):
        raise ValueError(f"{path} is {width}x{height}; expected {expected_width}x{expected_height}")


def read_png_dimensions(path: Path) -> tuple[int, int]:
    """Read PNG IHDR dimensions without depending on Pillow."""
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"{path} is not a valid PNG")
    return struct.unpack(">II", header[16:24])


if __name__ == "__main__":
    raise SystemExit(main())
