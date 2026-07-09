import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { SmartImportBar } from "@/components/smart-import-bar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { BottleDraft, useBottleStore } from "@/lib/bottles/store";
import { useBottleTaxonomy } from "@/lib/bottles/taxonomy";
import { trpc } from "@/lib/trpc";
import type { EnrichedProduct } from "@/server/routers";

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
  const { categories: taxCategories, categoryLabel, stylesOf } = useBottleTaxonomy();
  const editing = getBottle(id);

  const [nameZh, setNameZh] = useState(editing?.nameZh ?? prefillNameAlt ?? "");
  const [nameEn, setNameEn] = useState(editing?.nameEn ?? prefillName ?? "");
  const [category, setCategory] = useState(
    editing?.category ??
      (categoryParam && taxCategories.some((c) => c.zh === categoryParam)
        ? categoryParam
        : taxCategories[0]?.zh ?? "金酒"),
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
  const [flavorTags, setFlavorTags] = useState<string[]>(editing?.flavorTags ?? []);
  const [story, setStory] = useState(editing?.story ?? "");
  const [styleDesc, setStyleDesc] = useState(editing?.styleDesc ?? "");

  // ── 联网识别补全 ──────────────────────────────────────────────────────────
  const enrichMutation = trpc.lookup.enrich.useMutation();
  const enrichBottleMutation = trpc.lookup.enrichBottle.useMutation();
  const [lookupBusy, setLookupBusy] = useState<"text" | "photo" | "flavor" | null>(null);
  const [lookupStatus, setLookupStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [pendingFlavor, setPendingFlavor] = useState<{
    flavorTags: string[];
    story: string;
    styleDesc: string;
    confidence: "high" | "medium" | "low";
  } | null>(null);

  const applyEnriched = useCallback(
    (item: EnrichedProduct) => {
      if (!nameZh.trim() && item.nameZh) setNameZh(item.nameZh);
      if (!nameEn.trim() && item.nameEn) setNameEn(item.nameEn);
      if (item.category && taxCategories.some((c) => c.zh === item.category))
        setCategory(item.category);
      if (!style.trim() && item.style) setStyle(item.style);
      if (!brand.trim() && item.brand) setBrand(item.brand);
      if (!origin.trim() && item.origin) setOrigin(item.origin);
      if (!volume.trim() && item.volume) setVolume(item.volume);
      if (!(parseFloat(abv) > 0) && item.abv > 0) setAbv(String(item.abv));
      if (!(parseFloat(price) > 0) && item.priceCny > 0) setPrice(String(item.priceCny));
      if (!notes.trim() && item.notes) setNotes(item.notes);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLookupStatus({ kind: "ok", msg: t("lookup.filled") });
    },
    [nameZh, nameEn, style, brand, origin, volume, abv, price, notes, taxCategories, t],
  );

  const handleLookup = useCallback(async () => {
    const query = [nameZh.trim(), nameEn.trim(), brand.trim()].filter(Boolean).join(" ");
    if (!query) {
      setLookupStatus({ kind: "err", msg: t("lookup.needName") });
      return;
    }
    setLookupStatus(null);
    setLookupBusy("text");
    try {
      const res = await enrichMutation.mutateAsync({ names: [query] });
      const item = res.items.find((i) => i.found);
      if (!item) {
        setLookupStatus({ kind: "err", msg: t("lookup.notFound") });
        return;
      }
      applyEnriched(item);
    } catch {
      setLookupStatus({ kind: "err", msg: t("smartImport.fail.msg") });
    } finally {
      setLookupBusy(null);
    }
  }, [nameZh, nameEn, brand, enrichMutation, applyEnriched, t]);

  const handleLookupPhoto = useCallback(async () => {
    setLookupStatus(null);
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        setLookupStatus({ kind: "err", msg: t("smartImport.fail.msg") });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]?.base64) return;
      setLookupBusy("photo");
      const asset = result.assets[0];
      const res = await enrichMutation.mutateAsync({
        names: [nameZh.trim(), nameEn.trim()].filter(Boolean),
        imageBase64: asset.base64!,
        imageMime: asset.mimeType ?? "image/jpeg",
      });
      const item = res.items.find((i) => i.found);
      if (!item) {
        setLookupStatus({ kind: "err", msg: t("lookup.notFound") });
        return;
      }
      applyEnriched(item);
    } catch {
      setLookupStatus({ kind: "err", msg: t("smartImport.fail.msg") });
    } finally {
      setLookupBusy(null);
    }
  }, [nameZh, nameEn, enrichMutation, applyEnriched, t]);

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
      flavorTags,
      story: story.trim(),
      styleDesc: styleDesc.trim(),
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
          {/* 智能批量导入(新建时显示) */}
          {!editing && (
            <SmartImportBar
              targetType="bottle"
              onExtracted={(item) => {
                if (item.nameZh) setNameZh(item.nameZh);
                if (item.nameEn) setNameEn(item.nameEn);
                if (item.category) setCategory(item.category);
                if (item.style) setStyle(item.style);
                if (item.brand) setBrand(item.brand);
                if (item.origin) setOrigin(item.origin);
                if (item.volume) setVolume(item.volume);
                if (item.abv) setAbv(String(item.abv));
                if (item.priceCny) setPrice(String(item.priceCny));
                if (item.notes || item.source) {
                  setNotes([item.notes, item.source].filter(Boolean).join(" · "));
                }
              }}
            />
          )}

          {/* 联网识别补全工具栏(新建 & 编辑均可用) */}
          <View style={styles.lookupRow}>
            <TouchableOpacity
              onPress={handleLookup}
              disabled={!!lookupBusy}
              style={[
                styles.lookupBtn,
                { backgroundColor: colors.primary + "14", borderColor: colors.primary + "30" },
                !!lookupBusy && { opacity: 0.5 },
              ]}
            >
              {lookupBusy === "text" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol name="globe" size={14} color={colors.primary} />
              )}
              <Text style={[styles.lookupBtnText, { color: colors.primary }]}>
                {t("lookup.btn")}
              </Text>
            </TouchableOpacity>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                onPress={handleLookupPhoto}
                disabled={!!lookupBusy}
                style={[
                  styles.lookupBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  !!lookupBusy && { opacity: 0.5 },
                ]}
              >
                {lookupBusy === "photo" ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : (
                  <IconSymbol name="camera.fill" size={14} color={colors.muted} />
                )}
                <Text style={[styles.lookupBtnText, { color: colors.muted }]}>
                  {t("lookup.photo")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {lookupStatus && (
            <Text
              style={[
                styles.lookupStatus,
                { color: lookupStatus.kind === "ok" ? colors.success : colors.error },
              ]}
            >
              {lookupStatus.msg}
            </Text>
          )}

          {field(t("bform.nameZh"), nameZh, setNameZh, lang === "en" ? "e.g. 君度橙酒" : "例如:君度橙酒")}
          {field(t("bform.nameEn"), nameEn, setNameEn, "e.g. Cointreau")}

          <Text className="text-sm font-medium text-foreground mb-1.5">{t("bform.category")}</Text>
          <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
            {taxCategories.map((c) => c.zh).map((cat) => {
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
                    style={[styles.chipText, { color: active ? "#FFFFFF" : colors.foreground }]}
                  >
                    {categoryLabel(cat, lang)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {stylesOf(category).length > 0 && (
            <>
              <Text className="text-sm font-medium text-foreground mb-1.5">
                {t("bform.style")}
              </Text>
              <View className="flex-row flex-wrap mb-2" style={{ gap: 8 }}>
                {stylesOf(category).map((d) => {
                  const s = d.name;
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
                        style={[styles.chipText, { color: active ? "#FFFFFF" : colors.foreground }]}
                      >
                        {lang === "zh" && d.zh ? d.zh : s}
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
          {/* Flavor & Story enrichment */}
          <View className="flex-row items-center justify-between mb-1.5" style={{ marginTop: 4 }}>
            <Text className="text-sm font-medium text-foreground">
              {lang === "zh" ? "风味 / 故事" : "Flavor / Story"}
            </Text>
            <Pressable
              onPress={async () => {
                const n = nameEn.trim() || nameZh.trim();
                if (!n || lookupBusy) return;
                setLookupBusy("flavor");
                setPendingFlavor(null);
                try {
                  const result = await enrichBottleMutation.mutateAsync({
                    nameZh: nameZh.trim() || undefined,
                    nameEn: nameEn.trim() || undefined,
                    category: category || undefined,
                    style: style.trim() || undefined,
                    brand: brand.trim() || undefined,
                    origin: origin.trim() || undefined,
                  });
                  setPendingFlavor(result);
                } catch {
                  // silent fail
                } finally {
                  setLookupBusy(null);
                }
              }}
              disabled={lookupBusy !== null || (!nameEn.trim() && !nameZh.trim())}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <View className="flex-row items-center" style={{ gap: 4 }}>
                {lookupBusy === "flavor" ? (
                  <Text className="text-xs" style={{ color: colors.primary }}>
                    {lang === "zh" ? "AI 补全中…" : "AI filling…"}
                  </Text>
                ) : (
                  <>
                    <IconSymbol name="sparkles" size={13} color={colors.primary} />
                    <Text className="text-xs" style={{ color: colors.primary }}>
                      {lang === "zh" ? "AI 补全" : "AI Fill"}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
          {pendingFlavor && (
            <View
              className="rounded-xl border px-3 py-3 mb-3"
              style={{ borderColor: colors.primary + "44", backgroundColor: colors.primary + "0A", gap: 6 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <IconSymbol name="sparkles" size={13} color={colors.primary} />
                  <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                    {lang === "zh" ? "AI 建议" : "AI Suggestion"}
                  </Text>
                  <View
                    className="px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        pendingFlavor.confidence === "high"
                          ? colors.success + "22"
                          : pendingFlavor.confidence === "medium"
                            ? "#FF950022"
                            : colors.border,
                    }}
                  >
                    <Text
                      className="text-[10px] font-medium"
                      style={{
                        color:
                          pendingFlavor.confidence === "high"
                            ? colors.success
                            : pendingFlavor.confidence === "medium"
                              ? "#FF9500"
                              : colors.muted,
                      }}
                    >
                      {pendingFlavor.confidence === "high"
                        ? (lang === "zh" ? "高可信" : "High")
                        : pendingFlavor.confidence === "medium"
                          ? (lang === "zh" ? "中可信" : "Medium")
                          : (lang === "zh" ? "低可信" : "Low")}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setPendingFlavor(null)} hitSlop={8}>
                  <IconSymbol name="xmark" size={14} color={colors.muted} />
                </Pressable>
              </View>
              {pendingFlavor.flavorTags.length > 0 && (
                <Text className="text-xs text-muted" style={{ lineHeight: 16 }}>
                  {lang === "zh" ? "风味标签: " : "Flavors: "}{pendingFlavor.flavorTags.join(" · ")}
                </Text>
              )}
              {pendingFlavor.story ? (
                <Text className="text-xs text-muted" style={{ lineHeight: 16 }}>
                  {lang === "zh" ? "故事: " : "Story: "}{pendingFlavor.story}
                </Text>
              ) : null}
              {pendingFlavor.styleDesc ? (
                <Text className="text-xs text-muted" style={{ lineHeight: 16 }}>
                  {lang === "zh" ? "风格: " : "Style: "}{pendingFlavor.styleDesc}
                </Text>
              ) : null}
              <View className="flex-row mt-2" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => {
                    if (pendingFlavor.flavorTags.length > 0 && flavorTags.length === 0) {
                      setFlavorTags(pendingFlavor.flavorTags);
                    }
                    if (pendingFlavor.story && !story.trim()) setStory(pendingFlavor.story);
                    if (pendingFlavor.styleDesc && !styleDesc.trim()) setStyleDesc(pendingFlavor.styleDesc);
                    setPendingFlavor(null);
                  }}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 8,
                      alignItems: "center" as const,
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text className="text-xs font-semibold" style={{ color: "#FFFFFF" }}>
                    {lang === "zh" ? "应用到空白字段" : "Apply to empty fields"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPendingFlavor(null)}
                  style={({ pressed }) => [
                    {
                      paddingVertical: 7,
                      paddingHorizontal: 14,
                      borderRadius: 8,
                      alignItems: "center" as const,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text className="text-xs" style={{ color: colors.muted }}>
                    {lang === "zh" ? "忽略" : "Dismiss"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          {flavorTags.length > 0 && (
            <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
              {flavorTags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => setFlavorTags((prev) => prev.filter((t) => t !== tag))}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.primary }]}>{tag}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {field(
            lang === "zh" ? "故事/介绍" : "Story",
            story,
            setStory,
            lang === "en" ? "Brief product story or description…" : "产品故事或简介…",
            { multiline: true },
          )}
          {field(
            lang === "zh" ? "风格描述" : "Style Description",
            styleDesc,
            setStyleDesc,
            lang === "en" ? "Style characteristics…" : "风格特点描述…",
          )}
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
  lookupRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  lookupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  lookupBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  lookupStatus: {
    fontSize: 12,
    marginBottom: 10,
    marginTop: -4,
  },
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
