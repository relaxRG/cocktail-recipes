import json, re, collections
data = json.load(open('assets/waldorf-recipes.json'))
recipes = data.get('recipes', data if isinstance(data, list) else [])
amounts = collections.Counter()
for r in recipes:
    for i in r.get('ingredients', []):
        a = (i.get('amount') or '').strip()
        if a and not re.match(r'^[\d\s./½¼¾⅓⅔~-]+\s*(ml|毫升|oz|盎司|cl|cc)\s*$', a, re.I):
            amounts[a] += 1
for a, c in amounts.most_common(80):
    print(c, repr(a))
