#!/usr/bin/env python3
"""Validate a 事例 work folder (設計ガイド / 導入アーキテクチャ) and package it as an upload ZIP.

Usage:
    cd case-guides && python3 scripts/package.py work/<slug>

The ZIP contains only index.html and assets/ and is written next to the work
folder as <slug>.zip. Any error aborts packaging; warnings are printed only.
The content type is taken from the <title> prefix (【設計ガイド】 / 【導入アーキテクチャ】)
and decides the required chapter layout (AGENTS.md 4-1 / 4-2).
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
MAX_SVG_BYTES = 2 * 1024 * 1024
MIN_SVG_FONT = 16
# Per content type (AGENTS.md 4-1 / 4-2): title prefix, brand label, fixed leading
# chapters (must be ch0.. in this order), other required chapters, and the label
# of the per-section .tip box.
KINDS = {
    "guide": {
        "label": "設計ガイド",
        "prefix": "【設計ガイド】",
        "leading": ["はじめに", "左ナビゲーションと共通要素"],
        "required": ["早見表", "この環境の所見", "参考ドキュメント"],
        "tip": "この環境での読み取り",
    },
    "architecture": {
        "label": "導入アーキテクチャ",
        "prefix": "【導入アーキテクチャ】",
        "leading": ["はじめに", "導入前の構成と課題", "導入アーキテクチャ", "設計方針と設定の意図", "左ナビゲーションと共通要素"],
        "required": ["早見表", "導入効果と今後の取り組み", "参考ドキュメント"],
        "tip": "設定の意図",
    },
}
# Hand-made diagrams are displayed via <img>, so scripts would not run, but the
# file is also downloadable directly; keep them inert and self-contained.
SVG_FORBIDDEN = [
    (re.compile(r"<script\b", re.I), "<script>"),
    (re.compile(r"<foreignObject\b", re.I), "<foreignObject>"),
    (re.compile(r"\son[a-z]+\s*=", re.I), "イベント属性（on...=）"),
    (re.compile(r"""(?:xlink:)?href\s*=\s*["']\s*(?:https?:|//|javascript:)""", re.I), "外部 URL の参照"),
    (re.compile(r"@import|url\(\s*['\"]?\s*(?:https?:|//)", re.I), "外部 CSS・フォントの読み込み"),
]
# Identifiers that must never appear in a published guide.
SENSITIVE = [
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "メールアドレス"),
    (re.compile(r"\b[a-f0-9]{32}\b"), "アカウント ID / 32 桁の ID"),
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?\b"), "IPv4 アドレス / CIDR"),
]


def check_svg(path: Path, rel: str) -> list[str]:
    """Return errors for a diagram SVG (AGENTS.md 4-5)."""
    errs: list[str] = []
    raw = path.read_bytes()
    if len(raw) > MAX_SVG_BYTES:
        errs.append(f"SVG が {len(raw):,} bytes です（上限 {MAX_SVG_BYTES:,}）: assets/{rel}")
    try:
        svg = raw.decode("utf-8")
    except UnicodeDecodeError:
        return errs + [f"SVG が UTF-8 ではありません: assets/{rel}"]
    root = re.search(r"<svg\b[^>]*>", svg)
    if not root:
        return errs + [f"<svg> 要素がありません: assets/{rel}"]
    for attr in ("xmlns", "viewBox", "width", "height"):
        if not re.search(rf'\s{attr}\s*=', root.group(0)):
            errs.append(f"<svg> に {attr} がありません: assets/{rel}")
    for pattern, label in SVG_FORBIDDEN:
        if pattern.search(svg):
            errs.append(f"SVG で使えない要素・属性があります（{label}）: assets/{rel}")
    small = sorted({float(v) for v in re.findall(r'font-size\s*[=:]\s*["\']?\s*([\d.]+)', svg) if float(v) < MIN_SVG_FONT})
    if small:
        errs.append(f"SVG の文字が小さすぎます（font-size {', '.join(f'{v:g}' for v in small)}。{MIN_SVG_FONT} 以上）: assets/{rel}")
    vb = re.search(r'viewBox\s*=\s*["\']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)', root.group(0))
    if vb and float(vb.group(1)) > 1800:
        errs.append(f"SVG の横幅が {float(vb.group(1)):g} です（1600 前後にしてください。AGENTS.md 4-5）: assets/{rel}")
    # Check only human-readable text (text nodes); attribute values such as path
    # data contain digit/dot runs that look like IP addresses.
    visible = re.sub(r"<[^>]*>", " ", re.sub(r"<(style|script)[\s\S]*?</\1>", " ", svg, flags=re.I))
    for pattern, label in SENSITIVE:
        for m in pattern.finditer(visible):
            errs.append(f"{label}が接続図に含まれています: {m.group(0)}（assets/{rel}）")
    return errs


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

    # ── Content type (from <title>) ──────────────────────────
    tm = re.search(r"<title>([^<]*)</title>", html)
    page_title = tm.group(1).strip() if tm else ""
    kind_key = next((k for k, v in KINDS.items() if page_title.startswith(v["prefix"])), None)
    if kind_key is None:
        errors.append(f"<title> が「【設計ガイド】」または「【導入アーキテクチャ】」で始まっていません: {page_title or '(なし)'}")
        kind_key = "guide"
    kind = KINDS[kind_key]
    other = KINDS["architecture" if kind_key == "guide" else "guide"]
    brand = re.search(r'<div class="brand"><b>([\s\S]*?)</b>', html)
    if not brand or f"{kind['label']}：" not in brand.group(1):
        errors.append(f".brand の 1 行目に「{kind['label']}：〈顧客エイリアス〉」がありません（AGENTS.md 4-4）。")

    # ── Structure ────────────────────────────────────────────
    titles = re.findall(r'<section class="chapter" id="(ch\d+)" data-title="([^"]+)"', html)
    if not titles:
        errors.append('章（<section class="chapter" id="chN" data-title="...">）が見つかりません。')
    chapter_names = [t for _, t in titles]
    for i, name in enumerate(kind["leading"]):
        if i >= len(chapter_names) or chapter_names[i] != name:
            errors.append(f"{kind['label']}の {i:02d} 章は「{name}」にしてください（AGENTS.md 4-{1 if kind_key == 'guide' else 2}）。")
    for name in kind["required"]:
        if name not in chapter_names:
            errors.append(f"必須章「{name}」がありません。")
    if chapter_names and chapter_names[-1] != "参考ドキュメント":
        errors.append("最後の章は「参考ドキュメント」にしてください。")
    if f'<b>{other["tip"]}</b>' in html:
        errors.append(f"{kind['label']}では囲みの見出しを「{other['tip']}」ではなく「{kind['tip']}」にしてください（AGENTS.md 4-3）。")
    if f'<b>{kind["tip"]}</b>' not in html:
        warnings.append(f"「{kind['tip']}」の囲み（.tip）が 1 つもありません。")
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
            if f.suffix.lower() == ".svg":  # hand-made diagrams (AGENTS.md 4-5), not screenshots
                errors.extend(check_svg(f, rel))
            else:
                entry = (mask_spec or {}).get(rel)
                if entry is None:
                    errors.append(f"masks.json に記載がありません（マスク未実施）: assets/{rel}")
                elif entry.get("reviewed") is not True:
                    errors.append(f"マスク後の確認が済んでいません（reviewed が true ではない）: assets/{rel}")
                elif mask_lock.get(rel) != hashlib.sha256(f.read_bytes()).hexdigest():
                    errors.append(f"mask.py の出力と一致しません（直接コピー・編集された可能性）: assets/{rel}")
            files.append(f)

    svgs = [n for n in referenced if n.lower().endswith(".svg")]
    if kind_key == "architecture" and not svgs:
        errors.append("導入アーキテクチャには接続図（assets/NN-xxx.svg）が必要です（AGENTS.md 4-5）。")

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
    print(f"OK   : {out}（{kind['label']} / {size:,} bytes / 章 {len(titles)} / 節 {len(section_ids)} / 図 {len(referenced)}（うち SVG {len(svgs)}））")
    return 0


if __name__ == "__main__":
    sys.exit(main())
