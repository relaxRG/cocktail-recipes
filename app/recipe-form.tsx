import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { RecipeDraft, useRecipeStore } from "@/lib/recipes/store";
import {
  CODEX_FAMILIES,
  Ingredient,
  METHODS,
  STRENGTH_LABELS,
  Strength,
  genId,
} from "@/lib/recipes/types";

function ChipGroup({
  options,
  value,
  onChange,
  colorsMap,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  colorsMap?: Record<string, string>;
}) {
  const colors = useColors();
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const active = value === opt;
        const tint = colorsMap?.[opt];
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? (tint ?? colors.primary) : colors.surface,
                borderColor: active ? (tint ?? colors.primary) : (tint ? tint + "66" : colors.border),
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.muted }]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RecipeFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getRecipe, addRecipe, updateRecipe, categories, tagsOf } = useRecipeStore();
  const editing = getRecipe(id);

  const spiritTags = tagsOf("spirit");
  const glassTags = tagsOf("glass");
  const flavorTags = tagsOf("flavor");
  const spiritNames = spiritTags.map((t) => t.name);
  const glassNames = glassTags.map((t) => t.name);
  const spiritColors = Object.fromEntries(spiritTags.map((t) => [t.name, t.color]));
  const glassColors = Object.fromEntries(glassTags.map((t) => [t.name, t.color]));

  const [name, setName] = useState(editing?.name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [baseSpirit, setBaseSpirit] = useState(editing?.baseSpirit ?? (spiritNames[0] ?? ""));
  const [glass, setGlass] = useState(editing?.glass ?? "");
  const [method, setMethod] = useState(editing?.method ?? "摇和");
  const [strength, setStrength] = useState<Strength>(editing?.strength ?? "medium");
  const [variantOf, setVariantOf] = useState(editing?.variantOf ?? "");
  const [codexFamily, setCodexFamily] = useState(editing?.codexFamily ?? "");
  const [flavors, setFlavors] = useState<string[]>(editing?.flavors ?? []);
  const [source, setSource] = useState(editing?.source ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    editing?.ingredients?.length
      ? editing.ingredients
      : [{ id: genId(), name: "", amount: "" }],
  );
  const [steps, setSteps] = useState(editing?.steps ?? "");
  const [garnish, setGarnish] = useState(editing?.garnish ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const canSave = name.trim().length > 0;

  const strengthOptions = useMemo(
    () => (Object.keys(STRENGTH_LABELS) as Strength[]).map((k) => STRENGTH_LABELS[k]),
    [],
  );

  const updateIngredient = (iid: string, field: "name" | "amount", value: string) => {
    setIngredients((prev) => prev.map((i) => (i.id === iid ? { ...i, [field]: value } : i)));
  };

  const addIngredientRow = () => {
    setIngredients((prev) => [...prev, { id: genId(), name: "", amount: "" }]);
  };

  const removeIngredientRow = (iid: string) => {
    setIngredients((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== iid) : prev));
  };

  const toggleFlavor = (tag: string) => {
    setFlavors((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    const draft: RecipeDraft = {
      name: name.trim(),
      categoryId,
      baseSpirit,
      glass,
      method,
      strength,
      variantOf: variantOf.trim(),
      codexFamily,
      flavors,
      source: source.trim(),
      ingredients: ingredients.filter((i) => i.name.trim().length > 0),
      steps: steps.trim(),
      garnish: garnish.trim(),
      notes: notes.trim(),
    };
    if (editing) {
      updateRecipe(editing.id, draft);
    } else {
      addRecipe(draft);
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  };

  const strengthValue = STRENGTH_LABELS[strength];

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="xmark" size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">
          {editing ? "编辑配方" : "新建配方"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <Text className="text-sm font-medium text-muted mt-3 mb-1.5">酒名 *</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder="例如:金汤力 Gin & Tonic"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />

          {/* Category */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">分类</Text>
          <View style={styles.chipWrap}>
            <Pressable
              onPress={() => setCategoryId(null)}
              style={[
                styles.chip,
                {
                  backgroundColor: categoryId === null ? colors.primary : colors.surface,
                  borderColor: categoryId === null ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[styles.chipText, { color: categoryId === null ? "#FFFFFF" : colors.muted }]}
              >
                未分类
              </Text>
            </Pressable>
            {categories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? cat.color : colors.surface,
                      borderColor: active ? cat.color : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.muted }]}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Base spirit */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">基酒</Text>
          {spiritNames.length > 0 ? (
            <ChipGroup
              options={spiritNames}
              value={baseSpirit}
              onChange={setBaseSpirit}
              colorsMap={spiritColors}
            />
          ) : (
            <Text className="text-xs text-muted">暂无基酒标签,可在“分类”页添加</Text>
          )}

          {/* Codex family */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">
            Codex 根源分类
          </Text>
          <Text className="text-xs text-muted mb-2" style={{ lineHeight: 16 }}>
            按《Cocktail Codex》六大母配方归类,再点一次可取消
          </Text>
          <View style={styles.chipWrap}>
            {CODEX_FAMILIES.map((fam) => {
              const active = codexFamily === fam;
              return (
                <Pressable
                  key={fam}
                  onPress={() => setCodexFamily(active ? "" : fam)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.muted }]}>
                    {fam}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Variant of */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">经典变体来源</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder="是哪款经典鸡尾酒的变体?如:尼格罗尼"
            placeholderTextColor={colors.muted}
            value={variantOf}
            onChangeText={setVariantOf}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />

          {/* Flavor tags */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">风味标签(可多选)</Text>
          {flavorTags.length > 0 ? (
            <View style={styles.chipWrap}>
              {flavorTags.map((tag) => {
                const active = flavors.includes(tag.name);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleFlavor(tag.name)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? tag.color : colors.surface,
                        borderColor: active ? tag.color : tag.color + "66",
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.muted }]}>
                      {tag.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="text-xs text-muted">暂无风味标签,可在“分类”页添加</Text>
          )}

          {/* Method */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">制作方法</Text>
          <ChipGroup options={METHODS} value={method} onChange={setMethod} />

          {/* Strength */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">烈度</Text>
          <ChipGroup
            options={strengthOptions}
            value={strengthValue}
            onChange={(label) => {
              const entry = (Object.entries(STRENGTH_LABELS) as [Strength, string][]).find(
                ([, v]) => v === label,
              );
              if (entry) setStrength(entry[0]);
            }}
          />

          {/* Glass */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">杯型</Text>
          {glassNames.length > 0 ? (
            <ChipGroup
              options={glassNames}
              value={glass}
              onChange={setGlass}
              colorsMap={glassColors}
            />
          ) : (
            <Text className="text-xs text-muted">暂无杯型标签,可在“分类”页添加</Text>
          )}

          {/* Ingredients */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">配料</Text>
          {ingredients.map((ing) => (
            <View key={ing.id} className="flex-row items-center mb-2" style={{ gap: 8 }}>
              <TextInput
                className="flex-[3] bg-surface border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
                placeholder="配料名"
                placeholderTextColor={colors.muted}
                value={ing.name}
                onChangeText={(v) => updateIngredient(ing.id, "name", v)}
                returnKeyType="done"
                style={{ lineHeight: 20 }}
              />
              <TextInput
                className="flex-[2] bg-surface border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
                placeholder="用量"
                placeholderTextColor={colors.muted}
                value={ing.amount}
                onChangeText={(v) => updateIngredient(ing.id, "amount", v)}
                returnKeyType="done"
                style={{ lineHeight: 20 }}
              />
              <Pressable
                onPress={() => removeIngredientRow(ing.id)}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <IconSymbol
                  name="minus.circle.fill"
                  size={24}
                  color={ingredients.length > 1 ? colors.error : colors.border}
                />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={addIngredientRow}
            style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
            <Text className="text-sm font-medium" style={{ color: colors.primary, lineHeight: 20 }}>
              添加配料
            </Text>
          </Pressable>

          {/* Steps */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">做法步骤</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={"1. 摇酒壶加冰\n2. 倒入材料摇和\n3. 滤入冰镇酒杯"}
            placeholderTextColor={colors.muted}
            value={steps}
            onChangeText={setSteps}
            multiline
            style={{ minHeight: 100, textAlignVertical: "top", lineHeight: 22 }}
          />

          {/* Garnish */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">装饰物</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder="例如:柠檬皮、薄荷枝"
            placeholderTextColor={colors.muted}
            value={garnish}
            onChangeText={setGarnish}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />

          {/* Notes */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">个人笔记</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder="口感记录、改良想法…"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 80, textAlignVertical: "top", lineHeight: 22 }}
          />

          {/* Source */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">引用来源</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder="如:Cocktail Codex p.120 / 某酒吧 / 网站链接"
            placeholderTextColor={colors.muted}
            value={source}
            onChangeText={setSource}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />
        </ScrollView>

        {/* Save button */}
        <View
          className="px-5 pt-3"
          style={{
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: canSave ? colors.primary : colors.border },
              pressed && canSave && { transform: [{ scale: 0.98 }], opacity: 0.9 },
            ]}
          >
            <Text style={[styles.saveBtnText, { color: canSave ? "#FFFFFF" : colors.muted }]}>
              {editing ? "保存修改" : "保存配方"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
});
