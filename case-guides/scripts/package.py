#!/usr/bin/env python3
"""Validate a 事例 - 設計ガイド work folder and package it as an upload ZIP.

Usage:
    cd case-guides && python3 scripts/package.py work/<slug>

The ZIP contains only index.html and assets/ and is written next to the work
folder as <slug>.zip. Any error aborts packaging; warnings are printed only.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

MAX_HTML_BYTES = 1_500_000
MAX_ZIP_BYTES = 30 * 1024 * 1024
ALLOWED_ASSET_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
ASSET_NAME = re.compile(r"^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.(png|jpe?g|webp|gif|svg)$")
REQUIRED_CHAPTERS = ["はじめに", "左ナビゲーションと共通要素", "早見表", "この環境の所見", "参考ドキュメント"]
# Identifiers that must never appear in a published guide.
SENSITIVE = [
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "メールアドレス"),
    (re.compile(r"\b[a-f0-9]{32}\b"), "アカウント ID / 32 桁の ID"),
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?\b"), "IPv4 アドレス / CIDR"),
]


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    work = Path(sys.argv[1]).resolve()
    html_path = work / "index.html"
    assets_dir = work / "assets"
    errors: list[str] = []
    warnings: list[str] = []

    if not html_path.is_file():
        print(f"ERROR: {html_path} がありません")
        return 1
    raw = html_path.read_bytes()
    try:
        html = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        print(f"ERROR: index.html が UTF-8 ではありません（{e}）")
        return 1

    # ── Size / placeholders ──────────────────────────────────
    if len(raw) > MAX_HTML_BYTES:
        errors.append(f"index.html が {len(raw):,} bytes です（上限 {MAX_HTML_BYTES:,}）。画像は assets/ に分けてください。")
    for m in re.finditer(r"\{\{[^}]*\}\}", html):
        errors.append(f"未置換のプレースホルダー: {m.group(0)}")
    if "data:image" in html:
        errors.append("base64 埋め込み画像があります。assets/ に PNG として保存してください。")

    # ── No external resources (CSS/JS/fonts/images must be local) ─
    for m in re.finditer(r"<(script|link|img|iframe)\b[^>]*\b(?:src|href)=\"(https?:)?//", html, re.I):
        errors.append(f"外部リソースを読み込んでいます: <{m.group(1)} ...>（自己完結にしてください）")

    # ── Structure ────────────────────────────────────────────
    titles = re.findall(r'<section class="chapter" id="(ch\d+)" data-title="([^"]+)"', html)
    if not titles:
        errors.append('章（<section class="chapter" id="chN" data-title="...">）が見つかりません。')
    chapter_names = [t for _, t in titles]
    for name in REQUIRED_CHAPTERS:
        if name not in chapter_names:
            errors.append(f"必須章「{name}」がありません。")
    for i, (cid, _) in enumerate(titles):
        if cid != f"ch{i}":
            errors.append(f"章 id が連番ではありません: {cid}（期待値 ch{i}）")

    ids = set(re.findall(r'\bid="([^"]+)"', html))
    toc_start = html.find('<aside id="toc">')
    toc_end = html.find("</aside>", toc_start) if toc_start >= 0 else -1
    if toc_start < 0 or toc_end < 0:
        errors.append('目次（<aside id="toc"> ... </aside>）が見つかりません。')
        toc = ""
    else:
        toc = html[toc_start:toc_end]
    toc_targets = re.findall(r'href="#([^"]+)"', toc)
    for t in toc_targets:
        if t not in ids:
            errors.append(f"目次のリンク先 #{t} が本文にありません。")
    section_ids = re.findall(r'<h3 id="(s\d+-\d+)"', html)
    for sid in section_ids:
        if sid not in toc_targets:
            errors.append(f"節 {sid} が目次にありません。")
    for t in re.findall(r'href="#([^"]+)"', html):
        if t not in ids:
            errors.append(f"本文内リンク #{t} のリンク先がありません。")
    for sid in section_ids:
        if not re.search(rf'<h3 id="{sid}" data-title="[^"]+"', html):
            errors.append(f"節 {sid} に data-title がありません。")

    # ── Figures / assets ─────────────────────────────────────
    # Any reference to assets/ counts (src, href, srcset, CSS url()), with or
    # without "./" and with either quote style. Unreferenced files are still
    # excluded from the ZIP so unreviewed screenshots are never published.
    referenced = list(dict.fromkeys(
        m.group(1).split("#")[0].split("?")[0]
        for m in re.finditer(r'''(?:^|["'(\s,])(?:\./)?assets/([^"'()\s,]+)''', html)
    ))
    for name in referenced:
        if not (assets_dir / name).is_file():
            errors.append(f"参照画像がありません: assets/{name}")
    # The lightbox placeholder (<img alt=""> without src) is part of the template.
    for m in re.finditer(r'<img\b[^>]*\bsrc="[^"]*"[^>]*>', html):
        if not re.search(r'\balt="[^"]+"', m.group(0)):
            errors.append(f"alt のない画像: {m.group(0)[:80]}")
    captions = re.findall(r"<figcaption>図 (\d+)-(\d+)", html)
    seen: set[tuple[str, str]] = set()
    for c in captions:
        if c in seen:
            errors.append(f"図番号が重複しています: 図 {c[0]}-{c[1]}")
        seen.add(c)

    # ── Masking (AGENTS.md 3-4): every screenshot must come from mask.py ──
    masks_path = work / "masks.json"
    lock_path = assets_dir / ".masks.lock.json"
    try:
        mask_spec = json.loads(masks_path.read_text(encoding="utf-8")) if masks_path.is_file() else None
        mask_lock = json.loads(lock_path.read_text(encoding="utf-8")) if lock_path.is_file() else {}
    except json.JSONDecodeError as e:
        errors.append(f"masks.json / .masks.lock.json を読み込めません: {e}")
        mask_spec, mask_lock = {}, {}
    if mask_spec is None and referenced:
        errors.append("masks.json がありません。scripts/mask.py でマスクしてから assets/ に配置してください。")
        mask_spec = {}

    files: list[Path] = []
    if assets_dir.is_dir():
        for f in sorted(assets_dir.rglob("*")):
            if f.is_dir() or f.name in (".DS_Store", ".masks.lock.json"):
                continue
            rel = f.relative_to(assets_dir).as_posix()
            if f.suffix.lower() not in ALLOWED_ASSET_EXT:
                errors.append(f"許可されていない拡張子: assets/{rel}")
                continue
            if not ASSET_NAME.match(f.name):
                warnings.append(f"命名規則（NN-kebab-case.png）に沿っていません: assets/{rel}")
            if rel not in referenced:
                warnings.append(f"本文から参照されていない画像（ZIP に含めません）: assets/{rel}")
                continue
            if f.suffix.lower() != ".svg":  # SVG = hand-made diagrams, not screenshots
                entry = (mask_spec or {}).get(rel)
                if entry is None:
                    errors.append(f"masks.json に記載がありません（マスク未実施）: assets/{rel}")
                elif entry.get("reviewed") is not True:
                    errors.append(f"マスク後の確認が済んでいません（reviewed が true ではない）: assets/{rel}")
                elif mask_lock.get(rel) != hashlib.sha256(f.read_bytes()).hexdigest():
                    errors.append(f"mask.py の出力と一致しません（直接コピー・編集された可能性）: assets/{rel}")
            files.append(f)

    # ── Sensitive identifiers in text ────────────────────────
    text = re.sub(r"<(style|script)[\s\S]*?</\1>", " ", html)
    for pattern, label in SENSITIVE:
        for m in pattern.finditer(text):
            errors.append(f"{label}が本文に含まれています: {m.group(0)}")

    for w in warnings:
        print(f"WARN : {w}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        print(f"\n{len(errors)} 件のエラーがあるため ZIP を作成しませんでした。")
        return 1

    out = work.parent / f"{work.name}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(html_path, "index.html")
        for f in files:
            z.write(f, f"assets/{f.relative_to(assets_dir).as_posix()}")
    size = out.stat().st_size
    if size > MAX_ZIP_BYTES:
        out.unlink()
        print(f"ERROR: ZIP が {size:,} bytes です（上限 {MAX_ZIP_BYTES:,}）。画像を圧縮してください。")
        return 1
    print(f"OK   : {out}（{size:,} bytes / 章 {len(titles)} / 節 {len(section_ids)} / 図 {len(referenced)}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
