import json, urllib.request, os

res = json.load(open('/home/ubuntu/waldorf_ingredients_and_steps.json'))['results']
items = []
pairs = []
failed = []
for r in res:
    if r.get('error') or not r.get('output', {}).get('result_file'):
        failed.append(r.get('input', '?'))
        continue
    url = r['output']['result_file']
    try:
        with urllib.request.urlopen(url, timeout=60) as f:
            data = json.load(f)
    except Exception as e:
        failed.append(r['input'] + f' (download: {e})')
        continue
    if 'items' in data:
        items.extend(data['items'])
    elif 'pairs' in data:
        pairs.extend(data['pairs'])
print('ingredients:', len(items))
print('step pairs:', len(pairs))
print('failed chunks:', failed)
os.makedirs('docs/import', exist_ok=True)
json.dump(items, open('docs/import/waldorf-ingredients-normalized.json','w'), ensure_ascii=False, indent=1)
json.dump(pairs, open('docs/import/waldorf-steps-pairs.json','w'), ensure_ascii=False, indent=1)
