#!/usr/bin/env python3
"""Mask sensitive regions in screenshots and write them to assets/.

Usage:
    cd case-guides
    python3 scripts/mask.py work/<slug> --grid      # coordinate-grid previews of raw/ images
    python3 scripts/mask.py work/<slug>             # apply masks.json -> assets/

masks.json (in the work folder) lists every image that goes into assets/:

    {
      "01-overview.png": {
        "source": "raw/Screenshot 2026-10-20 at 19.51.57.png",
        "masks": [
          {"box": [120, 64, 360, 28], "type": "アカウント名"},
          {"box": [880, 310, 420, 24], "type": "ID"}
        ],
        "crop": [0, 0, 2880, 1600],
        "reviewed": false
      }
    }

- box / crop are [x, y, width, height] in pixels of the *source* image.
- An image without sensitive information still needs an entry with "masks": [].
- "reviewed" is set to true only after the masked output has been opened and
  checked (AGENTS.md 3-4). package.py refuses unreviewed or modified images.

Regions are filled with an opaque solid colour (never blurred or pixelated,
which can be reversed or leave text legible). Output files are recorded with
their SHA-256 in assets/.masks.lock.json so package.py can verify that every
packaged image came through this script.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    print("ERROR: Pillow がありません。`python3 -m pip install --user pillow` を実行してください。")
    sys.exit(1)

FILL = (55, 65, 81)  # slate-700, opaque
PAD = 4              # extra pixels around each box so glyph edges are covered
GRID_STEP = 100
LOCK_NAME = ".masks.lock.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_grids(work: Path) -> int:
    raw = work / "raw"
    out = work / ".mask-preview"
    out.mkdir(exist_ok=True)
    files = sorted(p for p in raw.glob("*") if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
    if not files:
        print(f"ERROR: {raw} に画像がありません")
        return 1
    font = ImageFont.load_default()
    for src in files:
        im = Image.open(src).convert("RGB")
        d = ImageDraw.Draw(im)
        w, h = im.size
        for x in range(0, w, GRID_STEP):
            d.line([(x, 0), (x, h)], fill=(255, 0, 80) if x % 500 == 0 else (255, 160, 190), width=1)
            d.text((x + 2, 2), str(x), fill=(255, 0, 80), font=font)
        for y in range(0, h, GRID_STEP):
            d.line([(0, y), (w, y)], fill=(255, 0, 80) if y % 500 == 0 else (255, 160, 190), width=1)
            d.text((2, y + 2), str(y), fill=(255, 0, 80), font=font)
        dst = out / f"{src.stem}.grid.png"
        im.save(dst)
        print(f"GRID : {dst}（{w}x{h}）")
    return 0


def apply_masks(work: Path) -> int:
    spec_path = work / "masks.json"
    if not spec_path.is_file():
        print(f"ERROR: {spec_path} がありません（AGENTS.md 3-4 を参照）")
        return 1
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    assets = work / "assets"
    assets.mkdir(exist_ok=True)
    lock_path = assets / LOCK_NAME
    old_lock: dict[str, str] = (
        json.loads(lock_path.read_text(encoding="utf-8")) if lock_path.is_file() else {}
    )
    lock: dict[str, str] = {}
    reset: list[str] = []
    errors = 0
    for name, entry in spec.items():
        src = work / entry.get("source", "")
        if not entry.get("source") or not src.is_file():
            print(f"ERROR: {name}: source が見つかりません: {entry.get('source')}")
            errors += 1
            continue
        masks = entry.get("masks")
        if not isinstance(masks, list):
            print(f"ERROR: {name}: masks がありません（機微情報がない場合も [] を書く）")
            errors += 1
            continue
        im = Image.open(src)
        im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
        w, h = im.size
        d = ImageDraw.Draw(im)
        for m in masks:
            box = m.get("box")
            if not (isinstance(box, list) and len(box) == 4):
                print(f"ERROR: {name}: box は [x, y, width, height]: {m}")
                errors += 1
                continue
            x, y, bw, bh = (int(v) for v in box)
            x0, y0 = max(0, x - PAD), max(0, y - PAD)
            x1, y1 = min(w, x + bw + PAD), min(h, y + bh + PAD)
            if x1 <= x0 or y1 <= y0:
                print(f"ERROR: {name}: box が画像の範囲外です: {box}（画像 {w}x{h}）")
                errors += 1
                continue
            d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=FILL + ((255,) if im.mode == "RGBA" else ()))
        crop = entry.get("crop")
        if crop:
            cx, cy, cw, ch = (int(v) for v in crop)
            im = im.crop((max(0, cx), max(0, cy), min(w, cx + cw), min(h, cy + ch)))
        dst = assets / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        # Re-encode from pixels only: drops EXIF/text chunks (capture dates, device names).
        im.save(dst, optimize=True)
        lock[name] = sha256(dst)
        # A changed output must be looked at again.
        if entry.get("reviewed") is True and old_lock.get(name) != lock[name]:
            entry["reviewed"] = False
            reset.append(name)
        status = "確認済み" if entry.get("reviewed") is True else "未確認"
        print(f"MASK : assets/{name} ← {entry['source']}（マスク {len(masks)} 件 / {status}）")
    lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if reset:
        spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for name in reset:
            print(f"WARN : {name} の出力が変わったため reviewed を false に戻しました。再確認してください。")
    if errors:
        print(f"\n{errors} 件のエラーがあります。masks.json を修正して再実行してください。")
        return 1
    print("\n出力した画像をすべて開き、マスク漏れがないか確認してから masks.json の reviewed を true にしてください。")
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    work = Path(sys.argv[1]).resolve()
    if "--grid" in sys.argv[2:]:
        return make_grids(work)
    return apply_masks(work)


if __name__ == "__main__":
    sys.exit(main())
