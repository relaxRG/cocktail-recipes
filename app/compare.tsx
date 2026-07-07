import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { displayNames } from "@/lib/utils";
import { useRecipeStore } from "@/lib/recipes/store";
import { useBottleStore } from "@/lib/bottles/store";
import { useHomemadeStore } from "@/lib/homemade/store";
import { estimatePrepCost } from "@/lib/homemade/cost";
import { estimateRecipeCostSmart } from "@/lib/recipes/smart-cost";
import { formatAmountAsMl } from "@/lib/bottles/cost";
import { detectPrepTechniques, techniqueLabel } from "@/lib/homemade/technique";
import { prepTypeLabelIn } from "@/lib/homemade/types";
import { smartLinkIngredient, smartLinkDisplayName } from "@/lib/recipes/smart-link";
import { structuralFormula } from "@/lib/recipes/structure";
import {
  Recipe,
  STRENGTH_LABELS,
  STRENGTH_BAND_LABELS,
  localizedTagName,
} from "@/lib/recipes/types";

const COL_WIDTH = 168;

/** 对比行:label + 每列取值 */
interface CompareRow {
  label: string;
  values: (string | null)[];
  /** 数值行可高亮最优列(如成本最低) */
  highlightMin?: boolean;
  numeric?: (number | null)[];
  /** 差异行:非空值以警示色高亮(如用量不同) */
  emphasize?: boolean;
}

interface CompareSection {
  title: string;
  rows: CompareRow[];
}

export default function CompareScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ type?: string; ids?: string }>();
  const type = params.type === "prep" ? "prep" : "recipe";
  const ids = (params.ids ?? "").split(",").filter(Boolean);

  const { recipes, getCategory } = useRecipeStore();
  const { bottles } = useBottleStore();
  const { preps, types } = useHomemadeStore();

  /** 列头与分组行数据 */
  const { columns, sections } = useMemo(() => {
    if (type === "prep") {
      const items = ids
        .map((id) => preps.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      const columns = items.map((p) => ({
        id: p.id,
        title: displayNames(p.name, p.nameAlt, lang).primary,
        subtitle: displayNames(p.name, p.nameAlt, lang).secondary ?? "",
        route: { pathname: "/homemade/[id]" as const, params: { id: p.id } },
      }));
      const costs = items.map((p) => estimatePrepCost(p, bottles));
      const sections: CompareSection[] = [
        {
          title: t("compare.section.basic"),
          rows: [
            {
              label: t("compare.row.type"),
              values: items.map((p) => prepTypeLabelIn(types, p.type, lang)),
            },
            {
              label: t("compare.row.technique"),
              values: items.map((p) => {
                const ks = detectPrepTechniques(p);
                return ks.length > 0 ? ks.map((k) => techniqueLabel(k, lang)).join(" · ") : null;
              }),
            },
            { label: t("compare.row.yield"), values: items.map((p) => p.yield || null) },
            { label: t("compare.row.shelfLife"), values: items.map((p) => p.shelfLife || null) },
            { label: t("compare.row.storage"), values: items.map((p) => p.storage || null) },
          ],
        },
        {
          title: t("compare.section.ingredients"),
          rows: [
            {
              label: t("compare.row.ingredientCount"),
              values: items.map((p) => String(p.ingredients.length)),
            },
            // 自制配料三分区:名量全同 / 名同量异 / 各自独有(解析 "名 用量" 文本)
            ...(() => {
              const parse = (line: string): [string, string] => {
                const s = line.trim();
                // 用量通常在结尾:数字+单位 或 常见量词
                const m = s.match(/^(.*?)[\s:：]+([\d.]+\s*\S*|适量|少许|数滴|半个|一个)$/);
                return m ? [m[1].trim(), formatAmountAsMl(m[2].trim())] : [s, ""];
              };
              const maps = items.map((p) => {
                const m = new Map<string, string>();
                for (const line of p.ingredients) {
                  const [n, a] = parse(line);
                  if (n) m.set(n, a);
                }
                return m;
              });
              const allNames = maps.length > 0 ? [...maps[0].keys()] : [];
              const sameBoth = allNames.filter((n) => {
                if (!maps.every((m) => m.has(n))) return false;
                const amt = maps[0].get(n);
                return maps.every((m) => m.get(n) === amt);
              });
              const sameNameDiffAmt = allNames.filter(
                (n) => maps.every((m) => m.has(n)) && !sameBoth.includes(n),
              );
              const fmt = (m: Map<string, string>, n: string) =>
                m.get(n) ? `${n} ${m.get(n)}` : n;
              return [
                {
                  label: t("compare.row.sameBoth"),
                  values: items.map((_, idx) =>
                    sameBoth.length > 0
                      ? sameBoth.map((n) => fmt(maps[idx], n)).join("\n")
                      : null,
                  ),
                },
                {
                  label: t("compare.row.sameNameDiffAmount"),
                  emphasize: true,
                  values: items.map((_, idx) =>
                    sameNameDiffAmt.length > 0
                      ? sameNameDiffAmt.map((n) => fmt(maps[idx], n)).join("\n")
                      : null,
                  ),
                },
                {
                  label: t("compare.row.diffBoth"),
                  values: items.map((_, idx) => {
                    const uniq = [...maps[idx].keys()].filter(
                      (n) => !maps.every((m) => m.has(n)),
                    );
                    return uniq.length > 0
                      ? uniq.map((n) => fmt(maps[idx], n)).join("\n")
                      : null;
                  }),
                },
              ];
            })(),
            {
              label: t("compare.section.ingredients"),
              values: items.map((p) => (p.ingredients.length > 0 ? p.ingredients.join("\n") : null)),
            },
          ],
        },
        {
          title: t("compare.section.making"),
          rows: [
            {
              label: t("compare.row.batchCost"),
              values: costs.map((c) => (c.estimatedCount > 0 ? `¥${c.batchCost.toFixed(1)}` : null)),
              numeric: costs.map((c) => (c.estimatedCount > 0 ? c.batchCost : null)),
              highlightMin: true,
            },
            {
              label: t("compare.row.per30"),
              values: costs.map((c) =>
                c.costPer30Ml !== null ? `¥${c.costPer30Ml.toFixed(2)}` : null,
              ),
              numeric: costs.map((c) => c.costPer30Ml),
              highlightMin: true,
            },
          ],
        },
      ];
      return { columns, sections };
    }

    const items = ids
      .map((id) => recipes.find((r) => r.id === id))
      .filter((r): r is Recipe => Boolean(r));
    const columns = items.map((r) => ({
      id: r.id,
      title: displayNames(r.nameEn, r.name, lang).primary,
      subtitle: r.variantOf ? `${t("card.variant")} · ${r.variantOf}` : (displayNames(r.nameEn, r.name, lang).secondary ?? ""),
      route: { pathname: "/recipe/[id]" as const, params: { id: r.id } },
    }));
    const costs = items.map((r) => {
      if (r.ingredients.length === 0) return null;
      const est = estimateRecipeCostSmart(r.ingredients, bottles, preps);
      return est.estimatedCount > 0 ? est.total : null;
    });
    const sections: CompareSection[] = [
      {
        title: t("compare.section.basic"),
        rows: [
          {
            label: t("compare.row.category"),
            values: items.map((r) => {
              const c = getCategory(r.categoryId);
              return c ? displayNames(c.nameEn ?? "", c.name, lang).primary : null;
            }),
          },
          {
            label: t("compare.row.spirit"),
            values: items.map((r) => (r.baseSpirit ? localizedTagName(r.baseSpirit, "", lang) : null)),
          },
          {
            label: t("compare.row.abv"),
            values: items.map((r) =>
              r.abv !== null && r.abv !== undefined
                ? `≈${r.abv}%`
                : r.strengthBand
                  ? STRENGTH_BAND_LABELS[r.strengthBand][lang]
                  : null,
            ),
          },
          {
            label: t("compare.row.strength"),
            values: items.map((r) =>
              lang === "en" ? t(`strength.${r.strength}`) : STRENGTH_LABELS[r.strength],
            ),
          },
          {
            label: t("compare.row.cost"),
            values: costs.map((c) => (c !== null ? `≈¥${c.toFixed(1)}` : null)),
            numeric: costs,
            highlightMin: true,
          },
        ],
      },
      {
        title: t("compare.section.ingredients"),
        rows: [
          {
            label: t("compare.row.ingredientCount"),
            values: items.map((r) => String(r.ingredients.length)),
          },
          // 配料三分区:名字用量全一致 / 名字一致用量不一致 / 名字用量都不一致(独有)
          ...(() => {
            const nameKey = (n: string) => {
              const link = smartLinkIngredient(n, bottles, preps);
              return smartLinkDisplayName(link, lang as "zh" | "en")?.primary ?? n.trim();
            };
            // 每份配方:规范名 → 用量(ml 格式化后)映射
            const maps = items.map((r) => {
              const m = new Map<string, string>();
              for (const i of r.ingredients) {
                m.set(nameKey(i.name), i.amount ? formatAmountAsMl(i.amount) : "");
              }
              return m;
            });
            const allNames = maps.length > 0 ? [...maps[0].keys()] : [];
            // ① 名字都出现且用量一致
            const sameBoth = allNames.filter((n) => {
              if (!maps.every((m) => m.has(n))) return false;
              const amt = maps[0].get(n);
              return maps.every((m) => m.get(n) === amt);
            });
            // ② 名字都出现但用量不一致
            const sameNameDiffAmt = allNames.filter(
              (n) => maps.every((m) => m.has(n)) && !sameBoth.includes(n),
            );
            return [
              {
                label: t("compare.row.sameBoth"),
                values: items.map((_, idx) =>
                  sameBoth.length > 0
                    ? sameBoth
                        .map((n) => (maps[idx].get(n) ? `${n} ${maps[idx].get(n)}` : n))
                        .join("\n")
                    : null,
                ),
              },
              {
                label: t("compare.row.sameNameDiffAmount"),
                emphasize: true,
                values: items.map((_, idx) =>
                  sameNameDiffAmt.length > 0
                    ? sameNameDiffAmt
                        .map((n) => (maps[idx].get(n) ? `${n} ${maps[idx].get(n)}` : n))
                        .join("\n")
                    : null,
                ),
              },
              {
                label: t("compare.row.diffBoth"),
                values: items.map((_, idx) => {
                  const uniq = [...maps[idx].keys()].filter(
                    (n) => !maps.every((m) => m.has(n)),
                  );
                  return uniq.length > 0
                    ? uniq
                        .map((n) => (maps[idx].get(n) ? `${n} ${maps[idx].get(n)}` : n))
                        .join("\n")
                    : null;
                }),
              },
            ];
          })(),
          {
            label: t("compare.section.ingredients"),
            values: items.map((r) =>
              r.ingredients.length > 0
                ? r.ingredients
                    .map((i) => {
                      const link = smartLinkIngredient(i.name, bottles, preps);
                      const name =
                        smartLinkDisplayName(link, lang as "zh" | "en")?.primary ?? i.name;
                      return i.amount ? `${name} ${formatAmountAsMl(i.amount)}` : name;
                    })
                    .join("\n")
                : null,
            ),
          },
        ],
      },
      {
        title: t("compare.section.making"),
        rows: [
          {
            label: t("compare.row.method"),
            values: items.map((r) => (r.method ? localizedTagName(r.method, "", lang) : null)),
          },
          {
            label: t("compare.row.glass"),
            values: items.map((r) => (r.glass ? localizedTagName(r.glass, "", lang) : null)),
          },
          { label: t("compare.row.garnish"), values: items.map((r) => r.garnish || null) },
          {
            label: t("compare.row.formula"),
            values: items.map((r) =>
              r.ingredients.length > 0
                ? structuralFormula(r.ingredients, lang as "zh" | "en", formatAmountAsMl) || null
                : null,
            ),
          },
          {
            label: t("compare.row.flavors"),
            values: items.map((r) =>
              r.flavors.length > 0
                ? r.flavors.map((f) => localizedTagName(f, "", lang)).join(" · ")
                : null,
            ),
          },
          {
            label: t("compare.row.steps"),
            values: items.map((r) => {
              const n = r.steps ? r.steps.split("\n").filter((s) => s.trim()).length : 0;
              return n > 0 ? String(n) : null;
            }),
          },
          { label: t("compare.row.source"), values: items.map((r) => r.source || null) },
        ],
      },
    ];
    return { columns, sections };
  }, [type, ids.join(","), recipes, preps, bottles, types, lang, t, getCategory]);

  if (columns.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <Text className="text-base text-muted">{t("compare.empty")}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>{t("common.back")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  /** 数值行最优列索引(最小值高亮,如成本) */
  const minIndex = (nums?: (number | null)[]) => {
    if (!nums) return -1;
    let idx = -1;
    let min = Infinity;
    nums.forEach((n, i) => {
      if (n !== null && n < min) {
        min = n;
        idx = i;
      }
    });
    // 只有 >1 个有效值时才有意义
    return nums.filter((n) => n !== null).length > 1 ? idx : -1;
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-1 pb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="chevron.left" size={26} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground ml-2">{t("compare.title")}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 16 }}>
            {/* 列头:苹果风格产品名 + 查看详情链接 */}
            <View style={styles.headerRow}>
              <View style={{ width: 88 }} />
              {columns.map((col) => (
                <Pressable
                  key={col.id}
                  onPress={() => router.push(col.route as never)}
                  style={({ pressed }) => [styles.colHeader, pressed && { opacity: 0.7 }]}
                >
                  <Text
                    className="text-[15px] font-semibold text-foreground text-center"
                    numberOfLines={2}
                    style={{ lineHeight: 20 }}
                  >
                    {col.title}
                  </Text>
                  {col.subtitle ? (
                    <Text className="text-xs text-muted text-center mt-0.5" numberOfLines={1}>
                      {col.subtitle}
                    </Text>
                  ) : null}
                  <Text className="text-xs text-center mt-1" style={{ color: colors.primary }}>
                    {t("compare.viewDetail")}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 分组规格行 */}
            {sections.map((section) => {
              // 空 section(所有行所有列均为空)不渲染
              const rows = section.rows.filter((row) => row.values.some((v) => v !== null));
              if (rows.length === 0) return null;
              return (
                <View key={section.title}>
                  <Text
                    className="text-[13px] text-muted uppercase mt-6 mb-2"
                    style={{ letterSpacing: 0.4, lineHeight: 18 }}
                  >
                    {section.title}
                  </Text>
                  <View className="bg-surface rounded-xl overflow-hidden">
                    {rows.map((row, ri) => {
                      const best = row.highlightMin ? minIndex(row.numeric) : -1;
                      return (
                        <View
                          key={row.label + ri}
                          style={[
                            styles.specRow,
                            ri > 0 && {
                              borderTopWidth: StyleSheet.hairlineWidth,
                              borderTopColor: colors.border,
                            },
                          ]}
                        >
                          <View style={styles.specLabel}>
                            <Text className="text-xs text-muted" style={{ lineHeight: 16 }}>
                              {row.label}
                            </Text>
                          </View>
                          {row.values.map((v, ci) => (
                            <View key={ci} style={styles.specCell}>
                              <Text
                                className="text-[13px]"
                                style={{
                                  lineHeight: 19,
                                  color:
                                    v === null
                                      ? colors.muted
                                      : best === ci
                                        ? colors.success
                                        : row.emphasize
                                          ? colors.warning
                                          : colors.foreground,
                                  fontWeight: best === ci ? "700" : "400",
                                  textAlign: "center",
                                }}
                              >
                                {v ?? "—"}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <Text className="text-[11px] text-muted mt-4" style={{ lineHeight: 15 }}>
              {t("compare.hint")}
            </Text>
          </View>
        </ScrollView>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 8,
  },
  colHeader: {
    width: COL_WIDTH,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  specLabel: {
    width: 80,
    paddingTop: 1,
  },
  specCell: {
    width: COL_WIDTH,
    paddingHorizontal: 6,
  },
});
