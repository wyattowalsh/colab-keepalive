# Scripts Agent Instructions

- Keep scripts dependency-light and safe to rerun from the repository root.
- `generate-icons.py` must read only `./icon.png` as its source image and must never modify that file.
- Prefer Pillow with Lanczos resampling. Any fallback must clearly state its limitations.
