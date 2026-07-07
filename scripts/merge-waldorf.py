#!/usr/bin/env python3
"""下载 map 结果中的 recipes_json 并合并"""
import json, urllib.request, os

src = json.load(open("/home/ubuntu/extract_waldorf_recipes.json", encoding="utf-8"))
all_recipes = []
issues = []
for r in src["results"]:
    out = r.get("output") or {}
    url = out.get("recipes_json")
    if not url:
        issues.append(f"{r.get('input')}: no file")
        continue
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        recs = data.get("recipes", [])
        all_recipes.extend(recs)
        iss = out.get("issues", "")
        if iss and iss.lower() != "none":
            issues.append(f"{os.path.basename(r.get('input',''))}: {iss}")
    except Exception as e:
        issues.append(f"{r.get('input')}: {e}")

# 去重(按 nameEn)
seen = {}
for rec in all_recipes:
    key = (rec.get("nameEn") or "").strip().lower()
    if key and key not in seen:
        seen[key] = rec
merged = list(seen.values())
os.makedirs("docs/import", exist_ok=True)
with open("docs/import/waldorf-recipes-merged.json", "w", encoding="utf-8") as f:
    json.dump({"recipes": merged}, f, ensure_ascii=False, indent=1)
print("total extracted:", len(all_recipes), "after dedup:", len(merged))
print("issues:", len(issues))
for i in issues[:15]:
    print(" -", i)
