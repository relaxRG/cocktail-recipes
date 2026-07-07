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
import { analyzeUnknownIngredient } from "@/lib/classify";
import { useHomemadeStore } from "@/lib/homemade/store";
import { useBottleStore } from "@/lib/bottles/store";
import { displayNames } from "@/lib/utils";
import { suggestIngredients } from "@/lib/suggest";
import { RecipeDraft, useRecipeStore } from "@/lib/recipes/store";
import { parseRecipeText } from "@/lib/recipes/parser";
import { estimateRecipeAbv } from "@/lib/recipes/abv";
import {
  CODEX_FAMILIES,
  Ingredient,
  METHODS,
  STRENGTH_LABELS,
  STRENGTH_BAND_LABELS,
  genId,
  splitBilingualName,
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
  const { t, lang } = useI18n();
  const { getRecipe, addRecipe, updateRecipe, categories, tagsOf, tagGroupsOf } = useRecipeStore();
  const { preps } = useHomemadeStore();
  const { bottles } = useBottleStore();
  const editing = getRecipe(id);

  const spiritTags = tagsOf("spirit");
  const glassTags = tagsOf("glass");
  const flavorTags = tagsOf("flavor");
  const spiritNames = spiritTags.map((t) => t.name);
  const glassNames = glassTags.map((t) => t.name);
  const spiritColors = Object.fromEntries(spiritTags.map((t) => [t.name, t.color]));
  const glassColors = Object.fromEntries(glassTags.map((t) => [t.name, t.color]));

  const [name, setName] = useState(editing?.name ?? "");
  const [nameEn, setNameEn] = useState(editing?.nameEn ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [baseSpirit, setBaseSpirit] = useState(editing?.baseSpirit ?? (spiritNames[0] ?? ""));
  const [glass, setGlass] = useState(editing?.glass ?? "");
  const [method, setMethod] = useState(editing?.method ?? "摇和");
  const [variantOf, setVariantOf] = useState(editing?.variantOf ?? "");
  const [codexFamily, setCodexFamily] = useState(editing?.codexFamily ?? "");
  const [flavors, setFlavors] = useState<string[]>(editing?.flavors ?? []);
  const [source, setSource] = useState(editing?.source ?? "");
  const [story, setStory] = useState(editing?.story ?? "");
  const [flavorDesc, setFlavorDesc] = useState(editing?.flavorDesc ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    editing?.ingredients?.length
      ? editing.ingredients
      : [{ id: genId(), name: "", amount: "" }],
  );
  const [steps, setSteps] = useState(editing?.steps ?? "");
  const [garnish, setGarnish] = useState(editing?.garnish ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [importHint, setImportHint] = useState("");
  /** Which ingredient row is focused (shows live suggestions) */
  const [focusedIng, setFocusedIng] = useState<string | null>(null);
  /** Rows where user picked/dismissed suggestions — suppress until text changes */
  const [pickedIng, setPickedIng] = useState<Record<string, string>>({});

  const canSave = name.trim().length > 0 || nameEn.trim().length > 0;

  /** 根据配料与方法自动计算成品 ABV,并推导烈度大类与档位 */
  const abvEstimate = useMemo(
    () => estimateRecipeAbv(ingredients, method, bottles, preps),
    [ingredients, method, bottles, preps],
  );

  const updateIngredient = (iid: string, field: "name" | "amount", value: string) => {
    setIngredients((prev) => prev.map((i) => (i.id === iid ? { ...i, [field]: value } : i)));
  };

  const pickSuggestion = (iid: string, value: string) => {
    updateIngredient(iid, "name", value);
    setPickedIng((prev) => ({ ...prev, [iid]: value }));
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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
    if (p.name) {
      const split = splitBilingualName(p.name);
      if (split) {
        setName(split.zh);
        setNameEn(split.en);
      } else if (/[\u4e00-\u9fa5]/.test(p.name)) {
        setName(p.name);
      } else {
        setNameEn(p.name);
        if (!name.trim()) setName(p.name);
      }
    }
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
      name: name.trim() || nameEn.trim(),
      nameEn: nameEn.trim(),
      categoryId,
      baseSpirit,
      glass,
      method,
      strength: abvEstimate.strength ?? editing?.strength ?? "medium",
      strengthBand: abvEstimate.band ?? editing?.strengthBand ?? "",
      abv: abvEstimate.abv,
      variantOf: variantOf.trim(),
      codexFamily,
      flavors,
      source: source.trim(),
      story: story.trim(),
      flavorDesc: flavorDesc.trim(),
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

          {/* Name: bilingual fields, primary language first (aligned with bottle library) */}
          {lang === "en" ? (
            <>
              <Text className="text-sm font-medium text-muted mt-3 mb-1.5">{t("form.nameEn.required")}</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder={t("form.nameEn.placeholder")}
                placeholderTextColor={colors.muted}
                value={nameEn}
                onChangeText={setNameEn}
                returnKeyType="done"
                style={{ lineHeight: 20 }}
              />
              <Text className="text-sm font-medium text-muted mt-3 mb-1.5">{t("form.nameZh.label")}</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder={t("form.nameZh.placeholder")}
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
                style={{ lineHeight: 20 }}
              />
            </>
          ) : (
            <>
              <Text className="text-sm font-medium text-muted mt-3 mb-1.5">{t("form.nameZh.required")}</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder={t("form.nameZh.placeholder")}
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
                style={{ lineHeight: 20 }}
              />
              <Text className="text-sm font-medium text-muted mt-3 mb-1.5">{t("form.nameEn.label")}</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder={t("form.nameEn.placeholder")}
                placeholderTextColor={colors.muted}
                value={nameEn}
                onChangeText={setNameEn}
                returnKeyType="done"
                style={{ lineHeight: 20 }}
              />
            </>
          )}

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
            (() => {
              const flavorGroups = tagGroupsOf("flavor");
              const groupedIds = new Set(flavorGroups.map((g) => g.id));
              const blocks: { key: string; label: string | null; items: typeof flavorTags }[] = [];
              for (const g of flavorGroups) {
                const items = flavorTags.filter((tg) => tg.groupId === g.id);
                if (items.length > 0)
                  blocks.push({
                    key: g.id,
                    label: displayNames(g.nameEn ?? "", g.name, lang).primary,
                    items,
                  });
              }
              const ungrouped = flavorTags.filter((tg) => !tg.groupId || !groupedIds.has(tg.groupId));
              if (ungrouped.length > 0) {
                blocks.push({
                  key: "ungrouped",
                  label: blocks.length > 0 ? t("tg.ungrouped") : null,
                  items: ungrouped,
                });
              }
              return blocks.map((block) => (
                <View key={block.key} style={{ marginBottom: 4 }}>
                  {block.label ? (
                    <Text className="text-xs text-muted mb-1.5" style={{ lineHeight: 16 }}>
                      {block.label}
                    </Text>
                  ) : null}
                  <View style={styles.chipWrap}>
                    {block.items.map((tag) => {
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
                            {displayNames(tag.nameEn ?? "", tag.name, lang).primary}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ));
            })()
          ) : (
            <Text className="text-xs text-muted">{t("form.noFlavor")}</Text>
          )}

          {/* Method */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.method")}</Text>
          <ChipGroup options={METHODS} value={method} onChange={setMethod} />

          {/* Strength: auto-computed from ingredients + method */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.strength")}</Text>
          <View
            className="bg-surface border border-border rounded-xl px-3 py-2.5"
            style={{ gap: 2 }}
          >
            {abvEstimate.abv !== null && abvEstimate.strength && abvEstimate.band ? (
              <>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-base font-semibold text-foreground" style={{ lineHeight: 22 }}>
                    {STRENGTH_LABELS[abvEstimate.strength]}
                    {" · "}
                    {STRENGTH_BAND_LABELS[abvEstimate.band][lang]}
                  </Text>
                  <Text className="text-sm text-muted" style={{ lineHeight: 20 }}>
                    ≈{abvEstimate.abv}% ABV
                  </Text>
                </View>
                <Text className="text-xs text-muted" style={{ lineHeight: 16 }}>
                  {t("form.abv.auto")}
                </Text>
              </>
            ) : (
              <Text className="text-xs text-muted" style={{ lineHeight: 16 }}>
                {t("form.abv.pending")}
              </Text>
            )}
          </View>

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
            const classification =
              !prep && !suggestion && trimmed.length >= 3
                ? analyzeUnknownIngredient(trimmed, bottles, preps)
                : null;
            const showSuggest =
              focusedIng === ing.id && trimmed.length > 0 && pickedIng[ing.id] !== ing.name;
            const liveSuggestions = showSuggest
              ? suggestIngredients(trimmed, bottles, preps, lang).filter((s) => s.value !== trimmed)
              : [];
            return (
              <View key={ing.id} className="mb-2">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <TextInput
                    className="flex-[3] bg-surface border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
                    placeholder={t("form.ingredient.name")}
                    placeholderTextColor={colors.muted}
                    value={ing.name}
                    onChangeText={(v) => updateIngredient(ing.id, "name", v)}
                    onFocus={() => setFocusedIng(ing.id)}
                    onBlur={() => {
                      // Delay so suggestion taps register before the list hides
                      setTimeout(() => {
                        setFocusedIng((cur) => (cur === ing.id ? null : cur));
                      }, 150);
                    }}
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
                {liveSuggestions.length > 0 ? (
                  <View
                    className="rounded-xl border overflow-hidden mt-1"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  >
                    {liveSuggestions.map((s, sIdx) => (
                      <Pressable
                        key={s.key}
                        onPress={() => pickSuggestion(ing.id, s.value)}
                        style={({ pressed }) => [
                          styles.suggestRow,
                          sIdx > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <IconSymbol
                          name={s.source === "homemade" ? "sparkles" : "wineglass.fill"}
                          size={13}
                          color={s.source === "homemade" ? colors.primary : colors.muted}
                        />
                        <Text
                          className="text-sm text-foreground"
                          numberOfLines={1}
                          style={{ lineHeight: 18, flexShrink: 1 }}
                        >
                          {s.value}
                        </Text>
                        {s.secondary ? (
                          <Text
                            className="text-xs text-muted"
                            numberOfLines={1}
                            style={{ lineHeight: 16, flexShrink: 1 }}
                          >
                            {s.secondary}
                          </Text>
                        ) : null}
                        <View style={{ flex: 1 }} />
                        <Text className="text-[11px] text-muted" style={{ lineHeight: 14 }}>
                          {s.source === "homemade" ? t("form.suggest.homemade") : t("form.suggest.bottle")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {prep ? (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/homemade/[id]", params: { id: prep.id } })
                    }
                    style={({ pressed }) => [styles.prepHint, pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="sparkles" size={12} color={colors.primary} />
                    <Text className="text-xs" style={{ color: colors.primary, lineHeight: 16 }}>
                      {t("form.homemade.matched", { name: displayNames(prep.name, prep.nameAlt, lang).primary })}
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
                      {t("form.homemade.add")} · {displayNames(suggestion.name, suggestion.nameAlt, lang).primary}
                    </Text>
                  </Pressable>
                ) : classification ? (
                  <Pressable
                    onPress={() => {
                      if (classification.library === "homemade") {
                        router.push({
                          pathname: "/homemade-form",
                          params: {
                            prefillName: classification.name,
                            prefillNameAlt: classification.nameAlt,
                            prefillType: classification.category,
                          },
                        });
                      } else {
                        router.push({
                          pathname: "/bottle-form",
                          params: {
                            category: classification.category,
                            prefillName: classification.name,
                            prefillNameAlt: classification.nameAlt,
                            ...(classification.style ? { prefillStyle: classification.style } : {}),
                          },
                        });
                      }
                    }}
                    style={({ pressed }) => [styles.prepHint, pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="plus.circle.fill" size={12} color={colors.success} />
                    <Text className="text-xs" style={{ color: colors.success, lineHeight: 16 }}>
                      {classification.library === "homemade"
                        ? t("form.homemade.add")
                        : classification.library === "material"
                          ? t("form.smartAdd.material")
                          : t("form.smartAdd.bottle")}
                      {" · "}
                      {displayNames(classification.name, classification.nameAlt, lang).primary}
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

          {/* Flavor description */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.flavorDesc")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.flavorDesc.placeholder")}
            placeholderTextColor={colors.muted}
            value={flavorDesc}
            onChangeText={setFlavorDesc}
            multiline
            style={{ minHeight: 70, textAlignVertical: "top", lineHeight: 22 }}
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

          {/* Story */}
          <Text className="text-sm font-medium text-muted mt-5 mb-1.5">{t("form.story")}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
            placeholder={t("form.story.placeholder")}
            placeholderTextColor={colors.muted}
            value={story}
            onChangeText={setStory}
            multiline
            style={{ minHeight: 90, textAlignVertical: "top", lineHeight: 22 }}
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
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
