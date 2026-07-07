import json, os
d = json.load(open('assets/waldorf-recipes.json'))
seen = []
seenset = set()
for r in d['recipes']:
    for ln in (r.get('steps') or '').split('\n'):
        ln = ln.strip()
        if ln and ln not in seenset:
            seenset.add(ln); seen.append(ln)
    g = (r.get('garnish') or '').strip()
    if g and g not in seenset:
        seenset.add(g); seen.append(g)
print('unique lines (steps+garnish):', len(seen))
os.makedirs('docs/import/step-chunks', exist_ok=True)
CH = 220
n = 0
for i in range(0, len(seen), CH):
    with open(f'docs/import/step-chunks/steps_{n}.json','w') as f:
        json.dump(seen[i:i+CH], f, ensure_ascii=False, indent=0)
    n += 1
print('chunks:', n)
