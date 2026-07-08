# 鸡尾酒研发测试板块 · 专业方法论研究

## 来源一:Liquor.com「How to Run a Productive R&D Session」(Tyler Zielinski, 2019)
专业酒吧 R&D 八要点(Dead Rabbit/Pouring Ribbons/Sother Teague):
1. 提前规划,明确每场目标与时限;2. 先概念后动手(write-up:配方/电梯陈述/背景/关键风味);
3. Map out:先定风格模板(Old Fashioned 变体/Martini 变体/Tiki/Highball/咸鲜 Sour),再定基酒→修饰→杯型→冰;
4. 记录所有用料;5. 反馈要具体(风味替换建议+比例再校准);6. 小组化;7. 严格计时;8. 版本间要有沉淀期。
→ 映射:项目需「目标/概念」字段、风格模板选择、批次间反馈记录。

## 来源二:Nicolet College《Beverage》Ch.25 Recipe Development(教材级)
- 术语:Riff(保结构换件)、Template(母结构)、Spec(精确规格:计量/技法/杯型/装饰)、成本率 18-25%。
- 从模板出发成功率最高;**一次只改一个变量**(否则无法归因);迭代 5-10 版定稿是常态。
- **文档记录至关重要**:每版精确计量+技法+品鉴笔记。
- 平衡维度:甜酸比(sour 2:1:1)、稀释(摇/搅目标 ~20-25% 水;Liquid Intelligence 摇制 50-60% 体积口径)、苦味芳香、质地。
- 跨日多场品鉴(味觉疲劳);多人品鉴防偏差;风味强度匹配原则。
→ 映射:批次=Spec 快照+品鉴笔记+评分;变量标记;ABV/结构/成本自动指标;品鉴日期。

## 来源三:SevenFifty Daily「5 Bars Collaborative Menu Development」
- Harvard & Stone「R&D Bar」孵化器:6 年约 1 万配方,夜测挑 keeper 再 re-spec。
- Polite Provisions:定向作业(Collins 变体/气泡/迈泰 riff);Savoy:定结构→分配基酒+主题→评审→定稿或返工。
→ 映射:项目状态流(构思中/试验中/定稿/归档);keeper 转正机制。

## 来源四:Liquid Intelligence(Dave Arnold)
- 摇制稀释 50-60%(体积),搅制略低;平衡=糖酸酒水四轴;量化 ABV%/糖 g/100ml/酸 g/100ml(复用项目 estimateRecipeAbv/结构分析)。

## 来源五:Mr. Potato Head 换件法(Cocktail Codex/Death & Co 系)
- 骨架不动零件可换,同角色同轴替换(strong/sweet/sour/bitter/dilution),换件后比例需再校准(蜂蜜≠单糖浆)。
- 酸调整(acid-adjusting):柠檬酸/苹果酸调果汁至 ~6% 酸度。
→ 变量维度体系:① amount 用量(↑↓) ② product 换产品(↔) ③ technique 技法 ④ ice 冰型 ⑤ glass 杯型 ⑥ garnish 装饰 ⑦ add/remove 增减。
- chip 配色:amount=蓝、product=紫、technique=橙、add=绿、remove=红、其他=灰。

## 用户补充需求:经典框架指引(Template Guide)
- 发起项目可选经典框架(六大母方+常用衍生:Old Fashioned/Daiquiri(Sour)/Martini/Sidecar/Highball/Flip + Negroni/Collins 等)
- 每框架:结构公式、槽位卡(角色+经典用量区间+替换方向提示+经典先例)、专业提示
- 槽位预填 v1,完全可改可脱离——辅助不强制;内容复用 codex-family-badge 库,扩充于 lib/lab/templates.ts

## 数据模型设计
- LabProject:id/name/goal/templateId?/baseRecipeId?/status(ideation|testing|finalized|archived)/createdAt/finalizedRecipeId?
- LabBatch:id/projectId/seq(v1..vN)/parentBatchId?/spec 快照(ingredients[]+method+glass+garnish+ice)/
  changes[](自动 diff:amount|product|technique|ice|glass|garnish|add|remove,含 from/to)/
  tastingNote/score(1-10)/verdict(keeper|iterate|reject)/tastedAt
- 自动指标:ABV/结构角色/成本(复用现有引擎);与基准版差值
- 智能链接:配料链接酒库产品与成本(smartLink)、自制产品自动跳转逻辑与配方表单一致

## UI 方案
- 酒单页顶部工具区「研发」入口(烧瓶图标)→ app/lab/index.tsx 项目列表(状态分组)
- 新建项目 app/lab/new:名称/概念目标/框架选择(可跳过)/从现有配方发起(可选)
- 项目详情 app/lab/[id].tsx:批次时间线(vN 卡片:变量 chip+评分+verdict),按钮「新迭代」「对比」
- 批次编辑 app/lab/batch-form:复制上一版 spec,保存时自动 diff 生成 changes;多变量时提示单变量归因
- 对比 app/lab/compare:勾 2-4 批次并排配料行,差异高亮(↑↓/↔/+/-),底部指标行(ABV/成本/评分)
- 定稿:keeper 批次一键转 Recipe 入酒单(tag 研发来源+项目回链)
- i18n 双语;AsyncStorage 持久化(lab-store);单变量原则引导不强制
