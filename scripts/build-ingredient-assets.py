import json, re, time

items = json.load(open('docs/import/waldorf-ingredients-normalized.json'))
pairs = json.load(open('docs/import/waldorf-steps-pairs.json'))

# ---------- 去重(按规范英文名小写) ----------
bottles = {}   # key -> bottle entry
preps = {}
alias = {}     # raw -> {en, zh}
now = int(time.time() * 1000)

def norm(s): return (s or '').strip().lower()

for it in items:
    raw = (it.get('raw') or '').strip()
    en = (it.get('nameEn') or '').strip()
    zh = (it.get('nameZh') or '').strip()
    kind = it.get('kind') or 'other'
    cat = (it.get('category') or '').strip()
    price = it.get('priceCny')
    vol = (it.get('volume') or '').strip()
    note = (it.get('note') or '').strip()
    if raw and en and zh:
        alias[raw] = {'en': en, 'zh': zh}
    if kind == 'other' or not en:
        continue
    key = norm(en)
    if kind in ('bottle', 'fresh'):
        if key not in bottles:
            bottles[key] = {
                'nameEn': en, 'nameZh': zh,
                'category': cat or ('原材料' if kind=='fresh' else '其他'),
                'kind': kind,
                'priceCny': price if isinstance(price,(int,float)) else None,
                'volume': vol, 'note': note,
            }
    elif kind == 'homemade':
        if key not in preps:
            preps[key] = {'nameEn': en, 'nameZh': zh, 'category': cat or '糖浆', 'note': note}

steps_map = {p['zh']: p['en'] for p in pairs if p.get('zh') and p.get('en')}

out = {
    'bottles': list(bottles.values()),
    'preps': list(preps.values()),
    'aliasMap': alias,
    'stepsEn': steps_map,
}
json.dump(out, open('assets/waldorf-ingredients.json','w'), ensure_ascii=False, indent=0)
print('bottles:', len(out['bottles']), '| preps:', len(out['preps']), '| alias:', len(alias), '| steps translated:', len(steps_map))
import collections
cats = collections.Counter(b['category'] for b in out['bottles'])
print('bottle categories:', dict(cats))
pc = sum(1 for b in out['bottles'] if b['priceCny'])
print('with price:', pc)
