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

## 待完成(客户端 app/bulk-import.tsx,539 行)
1. `type ItemType` 加 "material";`TYPE_LABEL` 加 material: {zh:"原料",en:"Material"};`TYPE_ORDER` 加 "material"
2. doImport 中 material 分支:调 addBottle 入库,category 用 matchMaterialCategory 匹配到原材料库分组(group=materials)的分类;酒库 taxonomy 中原材料分类需确认现有名称(useBottleTaxonomy().categories 有 group 字段: spirits/bottles/materials)
3. matchBottleCategory 目前在全部分类中模糊匹配;为 material 单写 matchMaterialCategory:仅在 group==="materials" 的分类中匹配(新鲜果蔬/香草香料等),不命中则回退到 materials 组第一个分类
4. 预览行徽章颜色可区分(可选)

## 关键 API 备忘
- useBottleTaxonomy(): { categories: BottleCategoryDef[] } 其中 BottleCategoryDef { key, zh, en, group: "spirits"|"bottles"|"materials", ... }
- addBottle({ nameZh, nameEn, category(中文名), style, brand, origin, volume, abv, priceCny, notes })
- 原材料库现有分类名需运行时查(grep taxonomy.tsx materials 组默认分类)
