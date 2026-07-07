import json, os, re, collections
d = json.load(open('assets/waldorf-recipes.json'))
recipes = d['recipes']
cnt = collections.Counter()
for r in recipes:
    for ing in r.get('ingredients', []):
        n = (ing.get('name') or '').strip()
        if n:
            cnt[n] += 1
names = sorted(cnt.keys())
print('unique ingredient names:', len(names))
os.makedirs('docs/import/ing-chunks', exist_ok=True)
CH = 50
n = 0
for i in range(0, len(names), CH):
    chunk = [{'name': x, 'count': cnt[x]} for x in names[i:i+CH]]
    with open(f'docs/import/ing-chunks/ing_{n:02d}.json', 'w') as f:
        json.dump(chunk, f, ensure_ascii=False, indent=0)
    n += 1
print('chunks:', n)
