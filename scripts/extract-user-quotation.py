#!/usr/bin/env python3
"""调用本地 bulkImport.extract 端点解析用户真实报价表"""
import base64, json, urllib.request

src = "/home/ubuntu/upload/副本26年7月份水果报价表.xlsx"
b64 = base64.b64encode(open(src, "rb").read()).decode()
payload = json.dumps({"json": {"fileBase64": b64, "fileName": "26年7月份水果报价表.xlsx"}}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:3000/api/trpc/bulkImport.extract",
    data=payload, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=300) as r:
    d = json.load(r)
items = d["result"]["data"]["json"]["items"]
print("items:", len(items))
for it in items:
    print(f"{it['type']} | {it['nameZh']} / {it['nameEn']} | {it['category']} | {it['style']} | {it['volume']} | ¥{it['priceCny']} | {(it['notes'] or '')[:30]}")
json.dump(items, open("/tmp/extracted-items.json", "w"), ensure_ascii=False, indent=1)
print("saved /tmp/extracted-items.json")
