#!/usr/bin/env python3
"""从 Waldorf EPUB 提取配方章节纯文本,按章节输出到 docs/import/waldorf-text/"""
import re
import html as htmllib
import os

SRC = "/home/ubuntu/cocktail-recipes/docs/import/waldorf/OEBPS/xhtml"
OUT = "/home/ubuntu/cocktail-recipes/docs/import/waldorf-text"
os.makedirs(OUT, exist_ok=True)

files = sorted(os.listdir(SRC))
targets = [f for f in files if re.match(r"^(09|1\d|2\d|3[0-6])_", f)]

def to_text(raw: str) -> str:
    raw = re.sub(r"<(h[1-6])[^>]*>", "\n\n## ", raw)
    raw = re.sub(r"</(h[1-6])>", "\n", raw)
    raw = re.sub(r"<(p|div|li|tr)[^>]*>", "\n", raw)
    raw = re.sub(r"<br[^>]*>", "\n", raw)
    text = re.sub(r"<[^>]+>", "", raw)
    text = htmllib.unescape(text)
    lines = [l.strip() for l in text.split("\n")]
    out, blank = [], 0
    for l in lines:
        if not l:
            blank += 1
            if blank <= 1:
                out.append("")
        else:
            blank = 0
            out.append(l)
    return "\n".join(out).strip()

total = 0
for f in targets:
    raw = open(os.path.join(SRC, f), encoding="utf-8").read()
    text = to_text(raw)
    name = f.replace(".xhtml", ".txt")
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(text)
    total += len(text)
    print(f"{name}: {len(text)} chars")
print("TOTAL:", total)
