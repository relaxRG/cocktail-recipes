#!/usr/bin/env python3
"""把 waldorf-text 各章节按 '## ' 配方标题切分,合并为约15个配方一块的 chunk 文件"""
import os, re

SRC = "docs/import/waldorf-text"
OUT = "docs/import/waldorf-chunks"
os.makedirs(OUT, exist_ok=True)

recipes = []
for f in sorted(os.listdir(SRC)):
    if not re.match(r"^(1\d|2\d|3[0-6])_", f):
        continue
    text = open(os.path.join(SRC, f), encoding="utf-8").read()
    parts = re.split(r"(?=^## )", text, flags=re.M)
    for p in parts:
        p = p.strip()
        if p.startswith("## "):
            recipes.append(p)

print("total recipes:", len(recipes))
CH = 15
n = 0
for i in range(0, len(recipes), CH):
    chunk = "\n\n".join(recipes[i:i+CH])
    n += 1
    with open(f"{OUT}/chunk_{n:02d}.txt", "w", encoding="utf-8") as fh:
        fh.write(chunk)
print("chunks:", n)
