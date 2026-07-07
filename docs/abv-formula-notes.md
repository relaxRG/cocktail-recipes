# 鸡尾酒 ABV 计算公式选型笔记

## 选定公式(已实现于 lib/recipes/abv.ts)

ABV% = Σ(配料体积 × 配料酒精度) / (Σ配料体积 × (1 + 稀释率)) × 100

来源:
- Darcy O'Neil (Art of Drink): (Volume of "Strong" × ABV% / Sum of Ingredients) × 100
  https://www.artofdrink.com/blog/alcohol-percentages-of-cocktails
- Derek Brown / Epicurious ABV Calculator 的稀释率实验数据:
  https://www.epicurious.com/expert-advice/how-strong-is-this-cocktail

## 稀释率(按调制方法)

| 方法 | 稀释率 | 依据 |
|------|--------|------|
| 直调(poured over ice) | +20% | Epicurious 实验 |
| 搅拌(stirred, served up) | +25% | Epicurious 实验 |
| 摇和(shaken) | +30% | Epicurious 实验 |
| 搅打(blended, crushed ice) | +40% | Epicurious 实验(shaken over crushed ice ≈40%+) |
| 分层(layered, no ice) | 0% | 无冰 |

## 配料 ABV 来源优先级
1. 酒库匹配酒款的 abv 字段
2. 自制库匹配(类型启发式:liqueur 25% / infusion 40% / tincture 45% / bitters 44% / fermented 4% / fortified 17% / redistilled 35%;文本中显式 "xx%" 优先)
3. 内置关键词表(gin 43 / vodka 40 / whisky 43 / campari 25 / vermouth 17 / champagne 12 等)
4. 未识别 → 0%(果汁/糖浆/软饮)

## 特殊用量处理
- "top up / 加满" → 按 90ml 估算
- 装饰类(片/枝/皮/slice/sprig...)不计入液体体积
- 结果四舍五入到 0.1%,bandOfAbv() 映射至 7 档 StrengthBand,再经 strengthOfBand() 归入轻盈/适中/浓烈
