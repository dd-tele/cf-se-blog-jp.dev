#!/usr/bin/env python3
"""Render the diagram SVGs in assets/ to PNG for visual checking (AGENTS.md 4-5).

Usage:
    cd case-guides && python3 scripts/preview_svg.py work/<slug>

Writes work/<slug>/.preview/<name>.png at the SVG's own width/height using
headless Google Chrome (the same engine that displays the guide). Set CHROME
to the browser binary if it is not in the default location.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

CANDIDATES = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
]


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    work = Path(sys.argv[1]).resolve()
    svgs = sorted((work / "assets").glob("*.svg"))
    if not svgs:
        print(f"SVG がありません: {work / 'assets'}")
        return 1
    chrome = next((c for c in CANDIDATES if c and Path(c).exists()), None)
    if not chrome:
        print("ERROR: Google Chrome が見つかりません。環境変数 CHROME にブラウザのパスを指定してください。")
        return 1
    out_dir = work / ".preview"
    out_dir.mkdir(exist_ok=True)
    status = 0
    for svg in svgs:
        root = re.search(r"<svg\b[^>]*>", svg.read_text(encoding="utf-8"))
        w = re.search(r'\swidth\s*=\s*["\']?([\d.]+)', root.group(0)) if root else None
        h = re.search(r'\sheight\s*=\s*["\']?([\d.]+)', root.group(0)) if root else None
        if not (w and h):
            print(f"ERROR: <svg> に width / height がありません: {svg.name}")
            status = 1
            continue
        out = out_dir / f"{svg.stem}.png"
        subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
             f"--window-size={round(float(w.group(1)))},{round(float(h.group(1)))}",
             f"--screenshot={out}", svg.as_uri()],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
        )
        if out.is_file():
            print(f"OK   : {out}")
        else:
            print(f"ERROR: 変換に失敗しました: {svg.name}")
            status = 1
    return status


if __name__ == "__main__":
    sys.exit(main())
