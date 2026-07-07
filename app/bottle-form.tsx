import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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
import { BottleDraft, useBottleStore } from "@/lib/bottles/store";
import { BOTTLE_CATEGORIES, BOTTLE_CATEGORY_EN, BOTTLE_STYLES } from "@/lib/bottles/types";

export default function BottleFormScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { id, category: categoryParam, prefillName, prefillNameAlt, prefillStyle } =
    useLocalSearchParams<{
      id?: string;
      category?: string;
      prefillName?: string;
      prefillNameAlt?: string;
      prefillStyle?: string;
    }>();
  const { getBottle, addBottle, updateBottle } = useBottleStore();
  const editing = getBottle(id);

  const [nameZh, setNameZh] = useState(editing?.nameZh ?? prefillNameAlt ?? "");
  const [nameEn, setNameEn] = useState(editing?.nameEn ?? prefillName ?? "");
  const [category, setCategory] = useState(
    editing?.category ??
      (categoryParam && (BOTTLE_CATEGORIES as readonly string[]).includes(categoryParam)
        ? categoryParam
        : "金酒"),
  );
  const [style, setStyle] = useState(editing?.style ?? prefillStyle ?? "");
  const [brand, setBrand] = useState(editing?.brand ?? "");
  const [origin, setOrigin] = useState(editing?.origin ?? "");
  const [volume, setVolume] = useState(editing?.volume ?? "");
  const [abv, setAbv] = useState(editing ? String(editing.abv) : "");
  const [price, setPrice] = useState(
    editing && editing.priceCny > 0 ? String(editing.priceCny) : "",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const canSave = nameZh.trim().length > 0 || nameEn.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const draft: BottleDraft = {
      nameZh: nameZh.trim() || nameEn.trim(),
      nameEn: nameEn.trim(),
      category,
      style: style.trim(),
      brand: brand.trim(),
      origin: origin.trim(),
      volume: volume.trim(),
      abv: Math.max(0, Math.min(100, parseFloat(abv) || 0)),
      priceCny: Math.max(0, parseFloat(price) || 0),
      notes: notes.trim(),
    };
    if (editing) {
      updateBottle(editing.id, draft);
    } else {
      addBottle(draft);
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  };

  const field = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    placeholder: string,
    options?: { keyboardType?: "numeric" | "default"; multiline?: boolean },
  ) => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-foreground mb-1.5">{label}</Text>
      <TextInput
        className="bg-surface border border-border rounded-xl px-3 text-base text-foreground"
        style={{
          height: options?.multiline ? 88 : 44,
          lineHeight: 20,
          paddingTop: options?.multiline ? 10 : 0,
          textAlignVertical: options?.multiline ? "top" : "center",
        }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={options?.keyboardType ?? "default"}
        multiline={options?.multiline}
        returnKeyType={options?.multiline ? "default" : "done"}
      />
    </View>
  );

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 pt-1 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="xmark" size={22} color={colors.foreground} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-semibold text-foreground">
            {editing ? t("bform.title.edit") : t("bform.title.new")}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {field(t("bform.nameZh"), nameZh, setNameZh, lang === "en" ? "e.g. 君度橙酒" : "例如:君度橙酒")}
          {field(t("bform.nameEn"), nameEn, setNameEn, "e.g. Cointreau")}

          <Text className="text-sm font-medium text-foreground mb-1.5">{t("bform.category")}</Text>
          <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
            {BOTTLE_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
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
                    {lang === "en" ? BOTTLE_CATEGORY_EN[cat] ?? cat : cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {(BOTTLE_STYLES[category]?.length ?? 0) > 0 && (
            <>
              <Text className="text-sm font-medium text-foreground mb-1.5">
                {t("bform.style")}
              </Text>
              <View className="flex-row flex-wrap mb-2" style={{ gap: 8 }}>
                {(BOTTLE_STYLES[category] ?? []).map((s) => {
                  const active = style === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStyle(active ? "" : s)}
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
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {field("", style, setStyle, lang === "en" ? "Or type a custom style…" : "或自行填写风格…")}
            </>
          )}

          {field(t("bform.brand"), brand, setBrand, "e.g. Cointreau")}
          {field(t("bform.origin"), origin, setOrigin, lang === "en" ? "e.g. France" : "例如:法国")}
          {field(t("bform.volume"), volume, setVolume, lang === "en" ? "e.g. 700ml" : "例如:700ml")}
          {field(t("bform.abv"), abv, setAbv, lang === "en" ? "e.g. 40" : "例如:40", { keyboardType: "numeric" })}
          {field(t("bform.price"), price, setPrice, lang === "en" ? "e.g. 170" : "例如:170", { keyboardType: "numeric" })}
          {field(t("bform.notes"), notes, setNotes, lang === "en" ? "Taste, usage, where to buy…" : "口感、用途、购买渠道等", { multiline: true })}
        </ScrollView>

        <View className="px-5 pb-2 pt-2">
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: canSave ? colors.primary : colors.border },
              pressed && canSave && { transform: [{ scale: 0.98 }], opacity: 0.9 },
            ]}
          >
            <Text style={styles.saveBtnText}>{editing ? t("form.save.edit") : t("bform.save")}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
});
