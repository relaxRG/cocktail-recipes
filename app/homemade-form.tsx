import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { useHomemadeStore } from "@/lib/homemade/store";
import { PREP_SECTIONS, PREP_TYPES } from "@/lib/homemade/types";

export default function HomemadeFormScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getPrep, addPrep, updatePrep } = useHomemadeStore();
  const editing = getPrep(id);

  const [name, setName] = useState(editing?.name ?? "");
  const [nameAlt, setNameAlt] = useState(editing?.nameAlt ?? "");
  const [type, setType] = useState(editing?.type ?? "syrup");
  const [ingredientsText, setIngredientsText] = useState(
    editing ? editing.ingredients.join("\n") : "",
  );
  const [recipe, setRecipe] = useState(editing?.recipe ?? "");
  const [yieldStr, setYieldStr] = useState(editing?.yield ?? "");
  const [shelfLife, setShelfLife] = useState(editing?.shelfLife ?? "");
  const [storage, setStorage] = useState(editing?.storage ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const canSave = useMemo(() => name.trim().length > 0, [name]);

  const handleSave = () => {
    if (!canSave) return;
    const ingredients = ingredientsText
      .split(/\n|;|；/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name: name.trim(),
      nameAlt: nameAlt.trim(),
      type,
      ingredients,
      recipe: recipe.trim(),
      yield: yieldStr.trim(),
      shelfLife: shelfLife.trim(),
      storage: storage.trim(),
      notes: notes.trim(),
    };
    if (editing) {
      updatePrep(editing.id, payload);
    } else {
      addPrep(payload);
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  };

  const fieldLabel = (label: string) => (
    <Text className="text-[13px] font-medium text-muted mt-4 mb-1.5">{label}</Text>
  );

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.foreground,
    },
  ];

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-1 pb-2">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <IconSymbol name="xmark" size={24} color={colors.muted} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">
            {editing ? t("hmform.title.edit") : t("hmform.title.new")}
          </Text>
          <Pressable onPress={handleSave} hitSlop={8} disabled={!canSave}>
            <Text
              style={{
                color: canSave ? colors.primary : colors.muted,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {t("hmform.save")}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {fieldLabel(t("hmform.name"))}
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder={lang === "en" ? "e.g. Ginger Syrup" : "如:姜糖浆 Ginger Syrup"}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

          {fieldLabel(t("hmform.nameAlt"))}
          <TextInput
            style={inputStyle}
            value={nameAlt}
            onChangeText={setNameAlt}
            placeholder={lang === "en" ? "e.g. 姜糖浆" : "如:Ginger Syrup"}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

          {fieldLabel(t("hmform.type"))}
          {PREP_SECTIONS.map((sec) => {
            const types = PREP_TYPES.filter((pt) => pt.section === sec.key);
            if (types.length === 0) return null;
            return (
              <View key={sec.key} style={{ marginBottom: 6 }}>
                <Text
                  className="text-xs text-muted mb-1.5"
                  style={{ lineHeight: 16 }}
                >
                  {lang === "en" ? sec.en : sec.zh}
                </Text>
                <View style={styles.chipWrap}>
                  {types.map((pt) => {
                    const active = type === pt.key;
                    return (
                      <Pressable
                        key={pt.key}
                        onPress={() => setType(pt.key)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? colors.primary : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: active ? "#FFFFFF" : colors.foreground },
                          ]}
                        >
                          {lang === "en" ? pt.en : pt.zh}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {fieldLabel(t("hmform.ingredients"))}
          <TextInput
            style={[...inputStyle, styles.multiline]}
            value={ingredientsText}
            onChangeText={setIngredientsText}
            placeholder={
              lang === "en"
                ? "One per line, e.g.\n100g fresh ginger juice\n150g white sugar"
                : "每行一条,如:\n100g 鲜姜汁\n150g 白砂糖"
            }
            placeholderTextColor={colors.muted}
            multiline
          />

          {fieldLabel(t("hmform.recipe"))}
          <TextInput
            style={[...inputStyle, styles.multiline]}
            value={recipe}
            onChangeText={setRecipe}
            placeholder={
              lang === "en"
                ? "Method steps…"
                : "做法步骤…"
            }
            placeholderTextColor={colors.muted}
            multiline
          />

          {fieldLabel(t("hmform.yield"))}
          <TextInput
            style={inputStyle}
            value={yieldStr}
            onChangeText={setYieldStr}
            placeholder={lang === "en" ? "e.g. ~300ml" : "如:约300ml"}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

          {fieldLabel(t("hmform.shelfLife"))}
          <TextInput
            style={inputStyle}
            value={shelfLife}
            onChangeText={setShelfLife}
            placeholder={lang === "en" ? "e.g. 2 weeks refrigerated" : "如:冷藏2周"}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

          {fieldLabel(t("hmform.storage"))}
          <TextInput
            style={inputStyle}
            value={storage}
            onChangeText={setStorage}
            placeholder={lang === "en" ? "e.g. Sealed bottle in fridge" : "如:密封冷藏"}
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

          {fieldLabel(t("hmform.notes"))}
          <TextInput
            style={[...inputStyle, styles.multiline, { minHeight: 60 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={lang === "en" ? "Usage notes, related cocktails…" : "用途、相关鸡尾酒…"}
            placeholderTextColor={colors.muted}
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
});
