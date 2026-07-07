import re

# 为每个 store 文件:1) 添加 notifySyncChange 导入 2) 在持久化 setItem 后调用 notify
files = {
    "lib/recipes/store.tsx": True,
    "lib/bottles/store.tsx": True,
    "lib/homemade/store.tsx": True,
    "lib/bottles/taxonomy.tsx": True,
    "lib/i18n/index.tsx": True,
}

IMPORT_LINE = 'import { notifySyncChange } from "@/lib/sync/engine";\n'

for path in files:
    s = open(path).read()
    if "notifySyncChange" in s:
        print(path, "already wired"); continue
    # 在第一个 import 后插入导入
    m = re.search(r'^import .*?;\n', s, re.M)
    s = s[:m.end()] + IMPORT_LINE + s[m.end():]
    # 替换 AsyncStorage.setItem(KEY, ...) -> 追加 notify:仅对模式 setItem(IDENT, ...) 处理
    def repl(match):
        full = match.group(0)
        key = match.group(1)
        # 跳过 sync 内部键
        return full + f'\n    notifySyncChange({key});' if False else full
    # 简单方案:在 setItem 调用行后插入 notify(同一语句尾)
    lines = s.split('\n')
    out = []
    for line in lines:
        out.append(line)
        m2 = re.search(r'AsyncStorage\.setItem\(([A-Z_][A-Z0-9_]*)\s*,', line)
        if m2:
            indent = re.match(r'\s*', line).group(0)
            out.append(f'{indent}notifySyncChange({m2.group(1)});')
    s = '\n'.join(out)
    open(path, 'w').write(s)
    print(path, "wired")
