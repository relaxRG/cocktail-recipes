import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useBottleStore } from "@/lib/bottles/store";
import { useBottleTaxonomy } from "@/lib/bottles/taxonomy";
import { useHomemadeStore } from "@/lib/homemade/store";
import { useRecipeStore } from "@/lib/recipes/store";
import { genId } from "@/lib/recipes/types";

type ItemType = "bottle" | "prep" | "recipe";

interface ExtractedItem {
  type: ItemType;
  nameZh: string;
  nameEn: string;
  category: string;
  style: string;
  brand: string;
  origin: string;
  volume: string;
  abv: number;
  priceCny: number;
  prepIngredients: string[];
  prepRecipe: string;
  prepYield: string;
  shelfLife: string;
  storage: string;
  baseSpirit: string;
  glass: string;
  method: string;
  ingredients: { name: string; amount: string }[];
  steps: string;
  garnish: string;
  source: string;
  notes: string;
}

interface PreviewRow {
  key: string;
  item: ExtractedItem;
  checked: boolean;
}

const TYPE_LABEL: Record<ItemType, { zh: string; en: string }> = {
  bottle: { zh: "酒库", en: "Bottle" },
  prep: { zh: "自制", en: "Prep" },
  recipe: { zh: "配方", en: "Recipe" },
};
const TYPE_ORDER: ItemType[] = ["bottle", "prep", "recipe"];

export default function BulkImportScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const extractMutation = trpc.bulkImport.extract.useMutation();

  const { addBottle } = useBottleStore();
  const { categories: bottleCategories } = useBottleTaxonomy();
  const { addPrep, sections, types } = useHomemadeStore();
  const { addRecipe, categories: recipeCategories } = useRecipeStore();

  const busy = extractMutation.isPending;

  const pickFile = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/csv",
        "text/plain",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (asset.size != null && asset.size > 10 * 1024 * 1024) {
      const msg = lang === "zh" ? "文件过大,请选择 10MB 以内的文件" : "File too large (max 10MB)";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
      return;
    }
    let base64: string;
    if (Platform.OS === "web") {
      // web 端 asset.uri 为 blob/data URI
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const s = String(reader.result ?? "");
          resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    setFileName(asset.name);
    setFileBase64(base64);
    setImportedCount(null);
  }, [lang]);

  const runExtract = useCallback(async () => {
    setImportedCount(null);
    try {
      const result = await extractMutation.mutateAsync(
        fileBase64 && fileName
          ? { fileBase64, fileName }
          : { text: text.trim() },
      );
      const next: PreviewRow[] = (result.items as ExtractedItem[]).map((item, i) => ({
        key: `${Date.now()}-${i}`,
        item,
        checked: true,
      }));
      setRows(next);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          next.length
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
    } catch {
      const msg = lang === "zh" ? "识别失败,请稍后重试" : "Extraction failed, please retry";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    }
  }, [extractMutation, fileBase64, fileName, text, lang]);

  const toggleRow = (key: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, checked: !r.checked } : r)));

  const cycleType = (key: string) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const idx = TYPE_ORDER.indexOf(r.item.type);
        const nextType = TYPE_ORDER[(idx + 1) % TYPE_ORDER.length];
        return { ...r, item: { ...r.item, type: nextType } };
      }),
    );

  /** 将提取的 bottle 分类名匹配到现有酒库分类(名称模糊匹配,否则归"其他");返回存储值(中文名) */
  const matchBottleCategory = useCallback(
    (name: string): string => {
      const n = name.trim().toLowerCase();
      const fallback =
        bottleCategories.find((c) => c.zh.includes("其他"))?.zh ?? bottleCategories[0]?.zh ?? "";
      if (!n) return fallback;
      const hit = bottleCategories.find(
        (c) =>
          c.zh.toLowerCase() === n ||
          c.en.toLowerCase() === n ||
          c.zh.toLowerCase().includes(n) ||
          n.includes(c.zh.toLowerCase()) ||
          c.en.toLowerCase().includes(n),
      );
      return hit?.zh ?? fallback;
    },
    [bottleCategories],
  );

  const matchPrepType = useCallback(
    (item: ExtractedItem): string => {
      const hint = `${item.category} ${item.notes} ${item.nameZh}`.toLowerCase();
      const hit = types.find((tp) => hint.includes(tp.zh.toLowerCase()) || hint.includes(tp.en.toLowerCase()));
      if (hit) return hit.key;
      if (hint.includes("糖浆") || hint.includes("syrup"))
        return types.find((tp) => tp.en.toLowerCase().includes("syrup"))?.key ?? types[0]?.key ?? "";
      return types[types.length - 1]?.key ?? "";
    },
    [types],
  );

  const matchRecipeCategory = useCallback(
    (item: ExtractedItem): string | null => {
      const n = item.category.trim().toLowerCase();
      if (!n) return null;
      return (
        recipeCategories.find(
          (c) => c.name.toLowerCase() === n || (c.nameEn ?? "").toLowerCase() === n,
        )?.id ?? null
      );
    },
    [recipeCategories],
  );

  const doImport = useCallback(() => {
    const selected = rows.filter((r) => r.checked);
    let count = 0;
    for (const { item } of selected) {
      if (item.type === "bottle") {
        addBottle({
          nameZh: item.nameZh || item.nameEn,
          nameEn: item.nameEn || item.nameZh,
          category: matchBottleCategory(item.category),
          style: item.style,
          brand: item.brand,
          origin: item.origin,
          volume: item.volume,
          abv: item.abv,
          priceCny: item.priceCny,
          notes: item.notes,
        });
        count++;
      } else if (item.type === "prep") {
        addPrep({
          name: item.nameEn || item.nameZh,
          nameAlt: item.nameZh,
          type: matchPrepType(item),
          ingredients: item.prepIngredients,
          recipe: item.prepRecipe || item.steps,
          yield: item.prepYield,
          shelfLife: item.shelfLife,
          storage: item.storage,
          notes: item.notes,
        });
        count++;
      } else {
        addRecipe({
          name: item.nameZh || item.nameEn,
          nameEn: item.nameEn,
          categoryId: matchRecipeCategory(item),
          baseSpirit: item.baseSpirit,
          glass: item.glass,
          method: item.method,
          strength: "medium",
          variantOf: "",
          codexFamily: "",
          flavors: [],
          source: item.source,
          story: "",
          flavorDesc: "",
          ingredients: item.ingredients.map((ing) => ({
            id: genId(),
            name: ing.name,
            amount: ing.amount,
          })),
          steps: item.steps,
          garnish: item.garnish,
          notes: item.notes,
        });
        count++;
      }
    }
    setImportedCount(count);
    setRows([]);
    setText("");
    setFileName(null);
    setFileBase64(null);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [rows, addBottle, addPrep, addRecipe, matchBottleCategory, matchPrepType, matchRecipeCategory]);

  const selectedCount = useMemo(() => rows.filter((r) => r.checked).length, [rows]);
  const canExtract = !busy && (Boolean(text.trim()) || Boolean(fileBase64));

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* 头部 */}
        <View className="px-5 pt-2 pb-3 flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ padding: 4, marginLeft: -8 }, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="chevron.left" size={26} color={colors.primary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-3xl font-bold text-foreground">{t("bulk.title")}</Text>
            <Text className="text-sm text-muted mt-1">{t("bulk.subtitle")}</Text>
          </View>
        </View>

        {/* 输入区 */}
        <View className="px-5">
          <View className="bg-surface border border-border rounded-2xl p-4">
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                setImportedCount(null);
              }}
              multiline
              placeholder={t("bulk.paste.placeholder")}
              placeholderTextColor={colors.muted}
              style={[styles.textArea, { color: colors.foreground }]}
            />
            <View className="flex-row items-center mt-3" style={{ gap: 10 }}>
              <Pressable
                onPress={pickFile}
                disabled={busy}
                style={({ pressed }) => [
                  styles.fileBtn,
                  { borderColor: colors.border, backgroundColor: colors.background },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="doc.fill" size={16} color={colors.primary} />
                <Text style={[styles.fileBtnText, { color: colors.primary }]} numberOfLines={1}>
                  {fileName ?? (lang === "zh" ? "选择文件(PDF/Excel/Word)" : "Pick file (PDF/Excel/Word)")}
                </Text>
              </Pressable>
              {fileName ? (
                <Pressable
                  onPress={() => {
                    setFileName(null);
                    setFileBase64(null);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <Text className="text-xs text-muted mt-2" style={{ lineHeight: 16 }}>
              {lang === "zh"
                ? "支持 PDF、Excel(xlsx/csv)、Word(docx)、纯文本,最大 10MB"
                : "Supports PDF, Excel (xlsx/csv), Word (docx) and plain text, up to 10MB"}
            </Text>
          </View>

          {/* 识别按钮 */}
          <Pressable
            onPress={runExtract}
            disabled={!canExtract}
            style={({ pressed }) => [
              styles.extractBtn,
              { backgroundColor: canExtract ? colors.primary : colors.border },
              pressed && canExtract && { transform: [{ scale: 0.98 }], opacity: 0.9 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <IconSymbol name="sparkles" size={18} color={canExtract ? "#FFFFFF" : colors.muted} />
            )}
            <Text style={[styles.extractBtnText, { color: canExtract ? "#FFFFFF" : colors.muted }]}>
              {busy ? t("bulk.analyzing") : t("bulk.analyze")}
            </Text>
          </Pressable>

          {importedCount != null ? (
            <View
              className="rounded-xl px-4 py-3 mt-4 flex-row items-center"
              style={{ backgroundColor: colors.success + "1A", gap: 8 }}
            >
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
              <Text style={{ color: colors.success, fontSize: 14, lineHeight: 18 }}>
                {t("bulk.import.done", { n: String(importedCount) })}
              </Text>
            </View>
          ) : null}

          {/* 预览列表 */}
          {rows.length ? (
            <View className="mt-5">
              <View className="flex-row items-center mb-2">
                <Text className="flex-1 text-base font-semibold text-foreground">
                  {t("bulk.preview.title")} · {rows.length}
                </Text>
                <Text className="text-xs text-muted">{t("bulk.preview.hint")}</Text>
              </View>
              {rows.map((r) => {
                const label = TYPE_LABEL[r.item.type][lang === "zh" ? "zh" : "en"];
                const title =
                  lang === "zh"
                    ? r.item.nameZh || r.item.nameEn
                    : r.item.nameEn || r.item.nameZh;
                const sub = [
                  r.item.type === "bottle"
                    ? [r.item.category, r.item.brand, r.item.abv ? `${r.item.abv}%` : ""]
                        .filter(Boolean)
                        .join(" · ")
                    : r.item.type === "prep"
                      ? [r.item.prepYield, r.item.shelfLife].filter(Boolean).join(" · ")
                      : [r.item.baseSpirit, r.item.method, `${r.item.ingredients.length} ${lang === "zh" ? "种配料" : "ingredients"}`]
                          .filter(Boolean)
                          .join(" · "),
                ].join("");
                return (
                  <View
                    key={r.key}
                    className="bg-surface border border-border rounded-xl px-3.5 py-3 mb-2 flex-row items-center"
                    style={{ gap: 10, opacity: r.checked ? 1 : 0.45 }}
                  >
                    <Pressable onPress={() => toggleRow(r.key)} hitSlop={6}>
                      <IconSymbol
                        name={r.checked ? "checkmark.circle.fill" : "circle"}
                        size={22}
                        color={r.checked ? colors.primary : colors.muted}
                      />
                    </Pressable>
                    <View className="flex-1">
                      <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
                        {title}
                      </Text>
                      {sub ? (
                        <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                          {sub}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => cycleType(r.key)}
                      style={({ pressed }) => [
                        styles.typeBadge,
                        { backgroundColor: colors.primary + "14", borderColor: colors.primary + "33" },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600", lineHeight: 15 }}>
                        {label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}

              {/* 导入按钮 */}
              <Pressable
                onPress={doImport}
                disabled={!selectedCount}
                style={({ pressed }) => [
                  styles.extractBtn,
                  { backgroundColor: selectedCount ? colors.success : colors.border },
                  pressed && selectedCount > 0 && { transform: [{ scale: 0.98 }], opacity: 0.9 },
                ]}
              >
                <IconSymbol
                  name="square.and.arrow.down.fill"
                  size={18}
                  color={selectedCount ? "#FFFFFF" : colors.muted}
                />
                <Text style={[styles.extractBtnText, { color: selectedCount ? "#FFFFFF" : colors.muted }]}>
                  {t("bulk.import.confirm", { n: String(selectedCount) })}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  textArea: {
    minHeight: 120,
    maxHeight: 240,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
    padding: 0,
  },
  fileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 260,
  },
  fileBtnText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
    flexShrink: 1,
  },
  extractBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  extractBtnText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
