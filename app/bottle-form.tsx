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
import { BottleDraft, useBottleStore } from "@/lib/bottles/store";
import { BOTTLE_CATEGORIES } from "@/lib/bottles/types";

export default function BottleFormScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getBottle, addBottle, updateBottle } = useBottleStore();
  const editing = getBottle(id);

  const [nameZh, setNameZh] = useState(editing?.nameZh ?? "");
  const [nameEn, setNameEn] = useState(editing?.nameEn ?? "");
  const [category, setCategory] = useState(editing?.category ?? "金酒");
  const [brand, setBrand] = useState(editing?.brand ?? "");
  const [origin, setOrigin] = useState(editing?.origin ?? "");
  const [volume, setVolume] = useState(editing?.volume ?? "");
  const [abv, setAbv] = useState(editing ? String(editing.abv) : "");
  const [price, setPrice] = useState(
    editing && editing.priceCny > 0 ? String(editing.priceCny) : "",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const canSave = nameZh.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const draft: BottleDraft = {
      nameZh: nameZh.trim(),
      nameEn: nameEn.trim(),
      category,
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
            {editing ? "编辑酒款" : "添加酒款"}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {field("中文名 *", nameZh, setNameZh, "例如:君度橙酒")}
          {field("英文名", nameEn, setNameEn, "例如:Cointreau")}

          <Text className="text-sm font-medium text-foreground mb-1.5">分类</Text>
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
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {field("品牌", brand, setBrand, "例如:Cointreau")}
          {field("产地", origin, setOrigin, "例如:法国")}
          {field("规格", volume, setVolume, "例如:700ml")}
          {field("酒精度数(% vol)", abv, setAbv, "例如:40", { keyboardType: "numeric" })}
          {field("中国参考价(¥)", price, setPrice, "例如:170", { keyboardType: "numeric" })}
          {field("备注", notes, setNotes, "口感、用途、购买渠道等", { multiline: true })}
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
            <Text style={styles.saveBtnText}>{editing ? "保存修改" : "保存酒款"}</Text>
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

