import json
with open('assets/waldorf-recipes.json') as f:
    d = json.load(f)
bad = [r for r in d['recipes'] if 'Waldorf' not in r['source']]
print(len(bad), 'without Waldorf; samples:', [r['source'][:60] for r in bad[:5]])
BOOK = 'The Waldorf Astoria Bar Book (Frank Caiafa)'
for r in d['recipes']:
    if 'Waldorf' not in r['source']:
        extra = r['source'].strip()
        r['source'] = BOOK + (' \u00b7 ' + extra if extra else '')
with open('assets/waldorf-recipes.json','w') as f:
    json.dump(d, f, ensure_ascii=False)
print('fixed')
