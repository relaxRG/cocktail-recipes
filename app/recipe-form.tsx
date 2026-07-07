import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
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
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { matchPrep, suggestPrep } from "@/lib/homemade/match";
import { useHomemadeStore } from "@/lib/homemade/store";
import { RecipeDraft, useRecipeStore } from "@/lib/recipes/store";
import { parseRecipeText } from "@/lib/recipes/parser";
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
  const { t } = useI18n();
  const { getRecipe, addRecipe, updateRecipe, categories, tagsOf } = useRecipeStore();
  const { preps } = useHomemadeStore();
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
  const [importHint, setImportHint] = useState("");

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

  /** 将解析结果填充到表单;仅覆盖解析到内容的字段 */
  const applyParsed = (text: string) => {
    const p = parseRecipeText(text);
    const gotSomething =
      p.name || p.ingredients.length > 0 || p.steps || p.glass || p.garnish || p.source;
    if (!gotSomething) {
      setImportHint(t("form.import.fail"));
      return;
    }
    if (p.name) setName(p.name);
    if (p.ingredients.length > 0) setIngredients(p.ingredients);
    if (p.steps) setSteps(p.steps);
    if (p.garnish) setGarnish(p.garnish);
    if (p.source) setSource(p.source);
    if (p.variantOf) setVariantOf(p.variantOf);
    // 杯型/基酒:仅当解析结果能对应到已有标签时才选中,否则原样填入
    if (p.glass) {
      const hit = glassNames.find((g) => p.glass.includes(g) || g.includes(p.glass));
      setGlass(hit ?? p.glass);
    }
    if (p.method && (METHODS as readonly string[]).includes(p.method)) setMethod(p.method);
    if (p.baseSpirit) {
      const hit = spiritNames.find((s) => p.baseSpirit.includes(s) || s.includes(p.baseSpirit));
      if (hit) setBaseSpirit(hit);
    }
    const parts: string[] = [];
    if (p.name) parts.push(t("form.name.label"));
    if (p.ingredients.length > 0) parts.push(`${p.ingredients.length} ${t("form.ingredients")}`);
    if (p.steps) parts.push(t("detail.steps"));
    if (p.glass) parts.push(t("form.glass"));
    if (p.garnish) parts.push(t("form.garnish"));
    setImportHint(`${t("form.import.done")}: ${parts.join(", ")}`);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handlePasteImport = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        setImportHint(t("form.import.empty"));
        return;
      }
      const hasContent =
        name.trim() || ingredients.some((i) => i.name.trim()) || steps.trim();
      if (hasContent) {
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          if (typeof window !== "undefined" && !window.confirm(t("form.import.overwrite"))) {
            return;
          }
          applyParsed(text);
          return;
        }
        Alert.alert(t("form.import.title"), t("form.import.overwrite"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("form.import.confirm"), onPress: () => applyParsed(text) },
        ]);
        return;
      }
      applyParsed(text);
    } catch {
      setImportHint(t("form.import.readFail"));
    }
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
          {editing ? t("form.title.edit") : t("form.title.new")}
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
          {/* Paste import */}
          <Pressable
            onPress={handlePasteImport}
            style={({ pressed }) => [
              styles.importBtn,
              {
                backgroundColor: colors.primary + "14",
                borderColor: colors.primary + "55",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="doc.on.clipboard" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text className="text-sm font-semibold" style={{ color: colors.primary, lineHeight: 19 }}>
                {t("form.pasteImport")}
              </Text>
              <Text className="text-xs text-muted mt-0.5" style={{ lineHeight: 16 }}>
                {t("form.pasteImport.hint")}
              </Text>
            </View>
          </Pressable>
          {importHint ? (
            <Text className="text-xs mt-2" style={{ color: colors.primary, lineHeight: 16 }}>
              {importHint}
            </Text>
          ) : null}

          {/* Name */}
          <Text className="text-sm font-medium text-muted mt-3 mb-1.5">{t("form.name.required")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.name.placeholder")}
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />

          {/* Category */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.category")}</Text>
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
                {t("form.uncategorized")}
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
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.spirit")}</Text>
          {spiritNames.length > 0 ? (
            <ChipGroup
              options={spiritNames}
              value={baseSpirit}
              onChange={setBaseSpirit}
              colorsMap={spiritColors}
            />
          ) : (
            <Text className="text-xs text-muted">{t("form.noSpirit")}</Text>
          )}

          {/* Codex family */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">
            {t("form.codex")}
          </Text>
          <Text className="text-xs text-muted mb-2" style={{ lineHeight: 16 }}>
            {t("form.codex.hint")}
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
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.variantOf")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.variantOf.placeholder")}
            placeholderTextColor={colors.muted}
            value={variantOf}
            onChangeText={setVariantOf}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />

          {/* Flavor tags */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.flavors.multi")}</Text>
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
            <Text className="text-xs text-muted">{t("form.noFlavor")}</Text>
          )}

          {/* Method */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.method")}</Text>
          <ChipGroup options={METHODS} value={method} onChange={setMethod} />

          {/* Strength */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.strength")}</Text>
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
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.glass")}</Text>
          {glassNames.length > 0 ? (
            <ChipGroup
              options={glassNames}
              value={glass}
              onChange={setGlass}
              colorsMap={glassColors}
            />
          ) : (
            <Text className="text-xs text-muted">{t("form.noGlass")}</Text>
          )}

          {/* Ingredients */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.ingredients")}</Text>
          {ingredients.map((ing) => {
            const trimmed = ing.name.trim();
            const prep = trimmed.length >= 2 ? matchPrep(trimmed, preps) : null;
            const suggestion = !prep && trimmed.length >= 2 ? suggestPrep(trimmed) : null;
            return (
              <View key={ing.id} className="mb-2">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <TextInput
                    className="flex-[3] bg-surface border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
                    placeholder={t("form.ingredient.name")}
                    placeholderTextColor={colors.muted}
                    value={ing.name}
                    onChangeText={(v) => updateIngredient(ing.id, "name", v)}
                    returnKeyType="done"
                    style={{ lineHeight: 20 }}
                  />
                  <TextInput
                    className="flex-[2] bg-surface border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
                    placeholder={t("form.ingredient.amount")}
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
                {prep ? (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/homemade/[id]", params: { id: prep.id } })
                    }
                    style={({ pressed }) => [styles.prepHint, pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="sparkles" size={12} color={colors.primary} />
                    <Text className="text-xs" style={{ color: colors.primary, lineHeight: 16 }}>
                      {t("form.homemade.matched", { name: prep.name })}
                    </Text>
                    <IconSymbol name="chevron.right" size={11} color={colors.primary} />
                  </Pressable>
                ) : suggestion ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/homemade-form",
                        params: {
                          prefillName: suggestion.name,
                          prefillNameAlt: suggestion.nameAlt,
                          prefillType: suggestion.type,
                        },
                      })
                    }
                    style={({ pressed }) => [styles.prepHint, pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="plus.circle.fill" size={12} color={colors.success} />
                    <Text className="text-xs" style={{ color: colors.success, lineHeight: 16 }}>
                      {t("form.homemade.add")} · {suggestion.name}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          <Pressable
            onPress={addIngredientRow}
            style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
            <Text className="text-sm font-medium" style={{ color: colors.primary, lineHeight: 20 }}>
              {t("form.addIngredient")}
            </Text>
          </Pressable>

          {/* Steps */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.steps")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.steps.placeholder")}
            placeholderTextColor={colors.muted}
            value={steps}
            onChangeText={setSteps}
            multiline
            style={{ minHeight: 100, textAlignVertical: "top", lineHeight: 22 }}
          />

          {/* Garnish */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.garnish")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.garnish.placeholder")}
            placeholderTextColor={colors.muted}
            value={garnish}
            onChangeText={setGarnish}
            returnKeyType="done"
            style={{ lineHeight: 20 }}
          />

          {/* Notes */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.notes")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.notes.placeholder")}
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 80, textAlignVertical: "top", lineHeight: 22 }}
          />

          {/* Source */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.source")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.source.placeholder")}
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
              {editing ? t("form.save.edit") : t("form.save")}
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
    paddingVertical: 6,
  },
  prepHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
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
