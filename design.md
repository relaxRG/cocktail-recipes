# 鸡尾酒配方手册 — 界面设计文档

## 产品定位
一款帮助用户记录、分类、查找个人鸡尾酒配方的本地应用。数据存储在设备本地(AsyncStorage),无需登录。整体体验遵循 Apple HIG,竖屏 9:16,单手可操作。

## 品牌与色彩
调酒吧台的高级感:深色琥珀 + 暖金色调,营造"夜间酒吧"氛围,同时支持浅色模式。

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| primary | #C0841A (琥珀金) | #E0A83C | 主按钮、强调、选中态 |
| background | #FAF7F2 (暖白) | #17130E | 页面背景 |
| surface | #FFFFFF | #241E15 | 卡片 |
| foreground | #241C10 | #F2EAD9 | 主文本 |
| muted | #8A7E6B | #A69B85 | 次要文本 |
| border | #E8E0D2 | #3A3226 | 分隔线 |

## 屏幕清单

### 1. 配方库(Tab 1,首页)
- 顶部大标题「我的酒单」+ 配方总数副标题
- 搜索框(按名称、配料、备注模糊搜索)
- 分类筛选横向滚动 Chip 列表:全部 / 各分类(经典、自创、金酒、朗姆…用户可管理)
- 配方卡片列表(FlatList):酒名、基酒标签、分类、难度/度数指示、收藏星标、配料摘要
- 右下角悬浮 + 按钮 → 新建配方
- 空状态:插画式提示 + 「添加第一杯」按钮,并提供"导入示例配方"入口

### 2. 配方详情(Stack push)
- 顶部:酒名、分类标签、基酒、收藏按钮
- 元信息行:杯型、烈度、制作方法(摇和/搅拌/直调)
- 配料清单(名称 + 用量,逐行列出)
- 步骤说明(有序步骤)
- 装饰物、个人笔记
- 操作:编辑(导航到表单)、删除(确认弹窗)

### 3. 新建/编辑配方(模态 Stack)
- 表单字段:酒名*、分类(单选,可新建)、基酒(单选 Chip)、杯型、制作方法、烈度(轻/中/烈)、配料列表(动态增删行:名称+用量)、步骤(多行文本)、装饰物、笔记
- 底部保存主按钮;未填酒名时禁用

### 4. 分类管理(Tab 2)
- 分类列表:名称、该分类下配方数
- 新增分类(输入名 + 选颜色点)、重命名、删除(删除时配方归入"未分类")
- 预置分类:经典、自创、清爽、浓烈

### 5. 收藏(通过首页筛选实现,不单独设 Tab)
- 首页 Chip 行首增加「★ 收藏」快速筛选

## Tab 结构
- Tab 1:酒单(配方库)icon: wineglass → local-bar
- Tab 2:分类 icon: folder → folder

## 关键用户流
1. 记录:酒单页 → 点 + → 填表单 → 保存 → 返回列表并见新卡片
2. 查找:酒单页 → 输入关键词或点分类 Chip → 列表实时过滤 → 点卡片看详情
3. 分类:分类页 → 新建分类 → 录入/编辑配方时选择该分类
4. 收藏:详情页或卡片点星 → 首页「收藏」Chip 快速查看

## 数据模型(AsyncStorage 持久化)
```ts
interface Ingredient { id: string; name: string; amount: string }
interface Recipe {
  id: string; name: string; categoryId: string | null;
  baseSpirit: string;          // 金酒/朗姆/伏特加/威士忌/龙舌兰/白兰地/利口酒/无酒精/其他
  glass: string;               // 杯型
  method: string;              // 摇和/搅拌/直调/分层
  strength: "light" | "medium" | "strong";
  ingredients: Ingredient[];
  steps: string;
  garnish: string;
  notes: string;
  favorite: boolean;
  createdAt: number; updatedAt: number;
}
interface Category { id: string; name: string; color: string; createdAt: number }
```
存储键:`cocktail.recipes` / `cocktail.categories`,通过 React Context + useReducer 管理,变更即持久化。
