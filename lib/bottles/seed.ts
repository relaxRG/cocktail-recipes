import { Bottle } from "./types";

/**
 * 内置酒款数据集:常见基酒、利口酒与辅料酒
 * 价格为中国电商/商超常见参考价(人民币),会随市场波动,仅供参考
 */
export function buildDefaultBottles(): Bottle[] {
  const now = Date.now();
  let i = 0;
  const mk = (
    nameZh: string,
    nameEn: string,
    category: string,
    brand: string,
    origin: string,
    volume: string,
    abv: number,
    priceCny: number,
    notes = "",
  ): Bottle => ({
    id: `bottle-${i}`,
    nameZh,
    nameEn,
    category,
    brand,
    origin,
    volume,
    abv,
    priceCny,
    notes,
    builtin: true,
    createdAt: now + i,
    updatedAt: now + i++,
  });

  return [
    // 金酒
    mk("哥顿金酒", "Gordon's London Dry Gin", "金酒", "Gordon's", "英国", "700ml", 37.5, 75, "经典伦敦干金,入门性价比之选"),
    mk("必富达金酒", "Beefeater London Dry Gin", "金酒", "Beefeater", "英国", "700ml", 40, 110, "杜松子风味突出,金汤力常客"),
    mk("添加利金酒", "Tanqueray London Dry Gin", "金酒", "Tanqueray", "英国", "750ml", 43.1, 140, "四重蒸馏,口感干爽"),
    mk("孟买蓝宝石金酒", "Bombay Sapphire", "金酒", "Bombay", "英国", "750ml", 40, 150, "十种植物香料,风味柔和"),
    mk("亨利爵士金酒", "Hendrick's Gin", "金酒", "Hendrick's", "苏格兰", "700ml", 41.4, 320, "黄瓜与玫瑰风味,适合G&T"),
    // 朗姆
    mk("百加得白朗姆", "Bacardi Carta Blanca", "朗姆", "Bacardi", "波多黎各", "750ml", 40, 85, "轻盈白朗姆,大吉利基酒"),
    mk("哈瓦那俱乐部3年", "Havana Club 3 Años", "朗姆", "Havana Club", "古巴", "700ml", 40, 130, "古巴风格,莫吉托首选"),
    mk("外交官精选朗姆", "Diplomático Reserva Exclusiva", "朗姆", "Diplomático", "委内瑞拉", "700ml", 40, 380, "甜润陈年朗姆,可纯饮"),
    mk("萨凯帕23朗姆", "Ron Zacapa 23", "朗姆", "Zacapa", "危地马拉", "700ml", 40, 480, "索莱拉陈酿,层次丰富"),
    // 伏特加
    mk("斯米诺红牌伏特加", "Smirnoff No.21 Vodka", "伏特加", "Smirnoff", "美国", "700ml", 40, 60, "全球销量最大伏特加之一"),
    mk("绝对伏特加", "Absolut Vodka", "伏特加", "Absolut", "瑞典", "750ml", 40, 100, "冬小麦酿造,口感纯净"),
    mk("灰雁伏特加", "Grey Goose Vodka", "伏特加", "Grey Goose", "法国", "750ml", 40, 330, "高端伏特加代表"),
    // 威士忌
    mk("占边波本威士忌", "Jim Beam Bourbon", "威士忌", "Jim Beam", "美国", "750ml", 40, 90, "经典波本,适合调酒"),
    mk("威凤凰波本威士忌", "Wild Turkey 101", "威士忌", "Wild Turkey", "美国", "700ml", 50.5, 160, "高度数,古典鸡尾酒骨架感强"),
    mk("布莱特黑麦威士忌", "Bulleit Rye", "威士忌", "Bulleit", "美国", "700ml", 45, 220, "黑麦辛香,曼哈顿首选"),
    mk("尊美醇爱尔兰威士忌", "Jameson Irish Whiskey", "威士忌", "Jameson", "爱尔兰", "700ml", 40, 130, "三次蒸馏,柔顺易饮"),
    mk("格兰菲迪12年", "Glenfiddich 12", "威士忌", "Glenfiddich", "苏格兰", "700ml", 40, 280, "单一麦芽入门经典"),
    // 龙舌兰
    mk("奥美加白龙舌兰", "Olmeca Blanco", "龙舌兰", "Olmeca", "墨西哥", "700ml", 38, 110, "入门级,玛格丽特常用"),
    mk("金快活银龙舌兰", "Jose Cuervo Especial Silver", "龙舌兰", "Jose Cuervo", "墨西哥", "750ml", 38, 130, "全球知名龙舌兰品牌"),
    mk("唐胡里奥珍藏白", "Don Julio Blanco", "龙舌兰", "Don Julio", "墨西哥", "750ml", 38, 420, "100%蓝色龙舌兰,清新植物香"),
    // 白兰地
    mk("轩尼诗VS干邑", "Hennessy V.S", "白兰地", "Hennessy", "法国", "700ml", 40, 320, "边车等干邑鸡尾酒基酒"),
    mk("圣雷米VSOP白兰地", "St-Rémy VSOP", "白兰地", "St-Rémy", "法国", "700ml", 40, 110, "法国葡萄白兰地,调酒性价比高"),
    // 利口酒
    mk("君度橙酒", "Cointreau", "利口酒", "Cointreau", "法国", "700ml", 40, 170, "橙皮利口酒标杆,玛格丽特/边车必备"),
    mk("金巴利", "Campari", "利口酒", "Campari", "意大利", "750ml", 25, 150, "苦味开胃酒,尼格罗尼核心"),
    mk("阿佩罗", "Aperol", "利口酒", "Aperol", "意大利", "700ml", 11, 130, "轻苦橙味,Aperol Spritz"),
    mk("咖啡利口酒", "Kahlúa Coffee Liqueur", "利口酒", "Kahlúa", "墨西哥", "700ml", 16, 130, "白俄罗斯/浓缩马天尼必备"),
    mk("圣杰曼接骨木花利口酒", "St-Germain", "利口酒", "St-Germain", "法国", "700ml", 20, 330, "花香典雅,提升酒感层次"),
    mk("绿查特酒", "Chartreuse Verte", "利口酒", "Chartreuse", "法国", "700ml", 55, 500, "130种草本,Last Word 关键"),
    mk("玛拉斯奇诺樱桃酒", "Luxardo Maraschino", "利口酒", "Luxardo", "意大利", "700ml", 32, 260, "航空邮件/Last Word 常用"),
    mk("波士蓝橙利口酒", "Bols Blue Curaçao", "利口酒", "Bols", "荷兰", "700ml", 21, 90, "蓝色系鸡尾酒着色担当"),
    mk("迪莎萝娜杏仁酒", "Disaronno Amaretto", "利口酒", "Disaronno", "意大利", "700ml", 28, 160, "杏仁香甜,教父鸡尾酒"),
    mk("百利甜酒", "Baileys Irish Cream", "利口酒", "Baileys", "爱尔兰", "700ml", 17, 130, "奶油利口酒,甜品酒常客"),
    // 味美思 & 苦精
    mk("马天尼干味美思", "Martini Extra Dry", "味美思", "Martini", "意大利", "1000ml", 15, 90, "干马天尼必备"),
    mk("马天尼红味美思", "Martini Rosso", "味美思", "Martini", "意大利", "1000ml", 15, 90, "尼格罗尼/曼哈顿用甜味美思"),
    mk("好奇美国佬", "Cocchi Americano", "味美思", "Cocchi", "意大利", "750ml", 16.5, 180, "Vesper 推荐,轻苦花香"),
    mk("安高天娜苦精", "Angostura Aromatic Bitters", "苦精", "Angostura", "特立尼达", "200ml", 44.7, 120, "老式鸡尾酒灵魂,几滴即可"),
    mk("安高天娜橙味苦精", "Angostura Orange Bitters", "苦精", "Angostura", "特立尼达", "100ml", 28, 90, "马天尼/威士忌酸提香"),
    // 其他
    mk("圣佩黎洛气泡水", "S.Pellegrino Sparkling Water", "其他", "S.Pellegrino", "意大利", "500ml", 0, 10, "高球/菲兹类稀释气泡"),
    mk("怡泉汤力水", "Schweppes Tonic Water", "其他", "Schweppes", "英国", "330ml", 0, 6, "金汤力标配"),
    mk("普罗塞克起泡酒", "Prosecco DOC", "其他", "多品牌", "意大利", "750ml", 11, 100, "Spritz/含羞草基底"),
  ];
}

