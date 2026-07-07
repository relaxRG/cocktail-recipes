# 报价表批量导入增强 — 实施笔记

## 背景
用户上传供应商报价表(如"26年7月份水果报价表.xlsx",本次实际收到的是 textClipping 无内容,已请用户重传)。
要求:批量导入时自动识别此类文件,筛选调酒有用原料,双语化,归入原材料库对应分区。

## 已完成(服务端 server/routers.ts)
- EXTRACT_SYSTEM_PROMPT 增强:
  - 新增第 4 类 `material`(原材料库条目:新鲜水果/香草香料/糖类/蛋奶/茶咖)
  - 报价表识别规则:品名/规格/单位/单价 列;只提取调酒有用原料;无关条目跳过
  - material 的 category 取值:新鲜果蔬/香草香料/糖类甜味剂/蛋奶乳制品/茶与咖啡/其他原料
  - 价格换算说明(元/斤→notes 注明计价单位)
  - 双语强制:nameZh/nameEn 必须都给出(柠檬→Lemon 等)
- bulkItemSchema type 枚举加 "material"

## 客户端已完成(app/bulk-import.tsx)
- ItemType/TYPE_LABEL/TYPE_ORDER 加 material("原料"/"Material")
- matchMaterialCategory():归入 group=materials 的"原材料"分类
- doImport material 分支:addBottle 入库,带 style(如 Fruit & Citrus)/volume/priceCny/notes

## 端到端实测(2026-07-08)
模拟"26年7月份水果报价表.xlsx"(12行含大白菜/土豆干扰项)→ 提取 10 条 material:
- 全部双语(黄柠檬/Lemon 等),style 归类正确(薄荷→Herb,姜→Spice & Botanical)
- 无关条目(大白菜/土豆)正确跳过;价格与计价单位备注正确(65元/箱10斤)
- 测试脚本: scripts/make-test-quotation.mjs

## 关键 API 备忘
- useBottleTaxonomy(): { categories: BottleCategoryDef[] } 其中 BottleCategoryDef { key, zh, en, group: "spirits"|"bottles"|"materials", ... }
- addBottle({ nameZh, nameEn, category(中文名), style, brand, origin, volume, abv, priceCny, notes })
- 原材料库现有分类名需运行时查(grep taxonomy.tsx materials 组默认分类)
