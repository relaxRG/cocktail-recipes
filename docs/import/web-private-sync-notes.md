# 私密网页版 + 云端同步 方案笔记 (2026-07-08)

## 用户需求
1. 网页版仅内部测试,只有用户本人可见可用(登录保护+账号白名单)
2. 使用记录与内容云端保存(类 iCloud;真 iCloud 不可行已说明,用云端 DB 同步替代)
3. 网页端参考 Apple 官网风格:留白、克制配色、圆润卡片、细腻字体层级、毛玻璃

## 现状梳理(已完成 Phase1)
- 模板自带 Manus OAuth: hooks/use-auth.ts (web=cookie, native=token+SecureStore)
- server: tRPC (publicProcedure/protectedProcedure), drizzle mysql, users 表已存在
- routers.ts 已有: systemRouter + 批量导入提取路由(extractFileText+LLM)
- 前端数据全部 AsyncStorage,键:
  - cocktail.recipes / cocktail.categories / cocktail.tags / cocktail.tagGroups / cocktail.seeded
  - cocktail.bottles / cocktail.bottles.seeded / cocktail.bottles.waldorf.v1
  - homemade.preps.v1 / homemade.sections.v1 / homemade.types.v1 / homemade.taxonomy.v2 / homemade.waldorf.v1
  - bottles.taxonomy.categories.v1 / bottles.taxonomy.styles.v1
  - app.lang.v1
- 根布局 providers: I18n > Recipe > Bottle > BottleTaxonomy > Homemade (app/_layout.tsx)
- drizzle/schema.ts 目前只有 users 表

## 设计方案
### 同步(键值快照方案,最小侵入)
- 新表 sync_data: id, userId(unique+key), key(varchar 64), value(longtext json), updatedAt
  - 实际用 (userId, key) 唯一;每个 AsyncStorage 键一行
- tRPC 路由 sync.pull (protected, 返回全部键值+updatedAt), sync.push (protected, upsert 多键)
- 客户端 lib/sync/provider.tsx:
  - 登录后: pull → 若云端有数据且比本地新 → 覆盖本地(或首次上传本地)
  - 本地写入后 debounce(~3s) push 改动的键
  - 使用 AsyncStorage 包装/事件总线拦截 setItem(简单做法: 各 store persist 后调 notifySync(key))
  - 冲突策略: last-write-wins per key + 首次登录本地优先上传
### 访问控制(仅限本人)
- 新增 owner 机制: 第一个登录的用户(或 role=admin)成为 owner,记录 openId 到表 app_config(key='ownerOpenId')
- protectedProcedure 之上加 ownerProcedure: ctx.user.openId != owner → FORBIDDEN
- 网页端 web 平台: 未登录显示全屏登录页(毛玻璃 Apple 风),登录但非 owner 显示"无访问权限"
- 原生 App 不强制登录(本地可用),登录后同步
### Apple 风格 web 优化
- max-width 容器(桌面居中 ~1080px),背景微灰 #f5f5f7
- 顶部导航毛玻璃 backdrop-blur,SF 风字体栈(-apple-system)
- 卡片圆角 16-18px、阴影柔和
