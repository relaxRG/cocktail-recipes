import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import {
  batchImagesForOcr,
  extractEpub,
  extractEpubImages,
  extractPdf,
  renderPdfPagesToImages,
  ExtractedBook,
} from "@/lib/import/extract";
import { detectRecipesInBook, RecipeCandidate } from "@/lib/import/detect";
import { ParsedRecipe } from "@/lib/recipes/parser";
import { genId } from "@/lib/recipes/types";
import { useRecipeStore } from "@/lib/recipes/store";
import { useHomemadeStore } from "@/lib/homemade/store";
import { classifyPrepGroup, guessPrepType } from "@/lib/homemade/types";
import { normalizeCodexFamilyDecl } from "@/lib/recipes/lineage";
import { trpc } from "@/lib/trpc";

type Phase = "idle" | "parsing" | "review" | "done";

interface CandidateRow {
  candidate: RecipeCandidate;
  checked: boolean;
  kind: "cocktail" | "prep";
  expanded: boolean;
  duplicate: boolean;
  translated?: ParsedRecipe;
  showTranslated: boolean;
}

interface PendingFile {
  buffer: ArrayBuffer;
  base64?: string;
  isPdf: boolean;
  name: string;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = chars.indexOf(clean[i]);
    const b = chars.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? chars.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? chars.indexOf(clean[i + 3]) : -1;
    bytes[p++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.buffer.slice(0, p);
}

/** Web 端把二进制转 base64(原生端读文件时已有 base64) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const isAscii = (s: string) => /^[\x00-\x7F]+$/.test(s);

/** 书籍导入:选择 EPUB/PDF → 提取文字(必要时 AI OCR)→ 识别配方 → 审核/翻译 → 入库 */
export default function BookImportScreen() {
  const colors = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";

  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [ocrOffer, setOcrOffer] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [imported, setImported] = useState<{ recipes: number; preps: number } | null>(null);
  const pendingRef = useRef<PendingFile | null>(null);

  const ocrMutation = trpc.bookImport.ocr.useMutation();
  const translateMutation = trpc.bookImport.translate.useMutation();

  const { addRecipe, recipes } = useRecipeStore();
  const { addPrep, preps, sections, types } = useHomemadeStore();

  const existingNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) {
      if (r.name) set.add(r.name.toLowerCase().trim());
      if (r.nameEn) set.add(r.nameEn.toLowerCase().trim());
    }
    for (const p of preps) {
      if (p.name) set.add(p.name.toLowerCase().trim());
      if (p.nameAlt) set.add(p.nameAlt.toLowerCase().trim());
    }
    return set;
  }, [recipes, preps]);

  const tap = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const showError = useCallback((msg: string) => {
    setError(msg);
    setPhase("idle");
  }, []);

  /** 候选 → 审核列表;为空返回 false */
  const finalize = useCallback(
    (candidates: RecipeCandidate[]): boolean => {
      if (candidates.length === 0) return false;
      candidates.sort((a, b) => b.confidence - a.confidence);
      setRows(
        candidates.map((c) => {
          const duplicate = !!c.name && existingNames.has(c.name.toLowerCase().trim());
          return {
            candidate: c,
            kind: c.kind,
            checked: !duplicate && c.confidence >= 0.5 && !!c.name,
            expanded: false,
            duplicate,
            showTranslated: false,
          };
        }),
      );
      setImported(null);
      setReviewError("");
      setPhase("review");
      return true;
    },
    [existingNames],
  );

  /** AI 智能识别:扫描版 PDF / 图片版 EPUB → LLM 视觉 OCR → 检测配方 */
  const runOcr = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    setError("");
    setOcrOffer(false);
    setPhase("parsing");
    try {
      const texts: string[] = [];
      const smallEnough = pending.buffer.byteLength <= 10 * 1024 * 1024;
      if (pending.isPdf && smallEnough) {
        setStatus(zh ? "AI 正在识别 PDF…" : "AI is reading the PDF…");
        const base64 =
          pending.base64 ?? (Platform.OS === "web" ? arrayBufferToBase64(pending.buffer) : "");
        if (!base64) throw new Error(zh ? "读取文件失败" : "Failed to read file");
        const res = await ocrMutation.mutateAsync({ pdfBase64: base64 });
        if (res.text) texts.push(res.text);
      } else if (pending.isPdf) {
        if (Platform.OS !== "web") {
          throw new Error(
            zh ? "PDF 超过 10MB,请在网页版使用或压缩后重试" : "PDF over 10MB — use the web app",
          );
        }
        setStatus(zh ? "正在渲染页面…" : "Rendering pages…");
        const images = await renderPdfPagesToImages(pending.buffer, {
          maxPages: 40,
          onProgress: (done, total) =>
            setStatus(zh ? `正在渲染页面… ${done}/${total}` : `Rendering pages… ${done}/${total}`),
        });
        const batches = batchImagesForOcr(images);
        for (let b = 0; b < batches.length; b++) {
          setStatus(
            zh
              ? `AI 识别中… 第 ${b + 1}/${batches.length} 批`
              : `AI OCR… batch ${b + 1}/${batches.length}`,
          );
          const res = await ocrMutation.mutateAsync({ images: batches[b] });
          if (res.text) texts.push(res.text);
        }
      } else {
        setStatus(zh ? "正在提取书页图片…" : "Extracting page images…");
        const images = await extractEpubImages(pending.buffer, 24);
        if (images.length === 0) {
          throw new Error(zh ? "书中没有可识别的书页图片" : "No recognizable page images found");
        }
        const batches = batchImagesForOcr(images);
        for (let b = 0; b < batches.length; b++) {
          setStatus(
            zh
              ? `AI 识别中… 第 ${b + 1}/${batches.length} 批`
              : `AI OCR… batch ${b + 1}/${batches.length}`,
          );
          const res = await ocrMutation.mutateAsync({ images: batches[b] });
          if (res.text) texts.push(res.text);
        }
      }
      const text = texts.join("\n\n").trim();
      if (!text) throw new Error(zh ? "AI 未能识别出文字" : "AI could not read any text");
      setBookTitle((t) => t || pending.name.replace(/\.(epub|pdf)$/i, ""));
      setStatus(zh ? "正在识别配方…" : "Detecting recipes…");
      if (!finalize(detectRecipesInBook([{ title: "", text }]))) {
        showError(
          zh
            ? "AI 已读取文字,但未识别到配方。可用「批量导入」粘贴具体段落。"
            : "AI read the text but found no recipes. Try Bulk Import with pasted text.",
        );
      }
    } catch (e) {
      showError(
        (zh ? "AI 识别失败:" : "AI OCR failed: ") + (e instanceof Error ? e.message : String(e)),
      );
    }
  }, [zh, ocrMutation, finalize, showError]);

  const pickFile = useCallback(async () => {
    tap();
    setError("");
    setOcrOffer(false);
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/epub+zip", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    const isEpub = /\.epub$/i.test(asset.name) || asset.mimeType === "application/epub+zip";
    const isPdf = /\.pdf$/i.test(asset.name) || asset.mimeType === "application/pdf";
    if (!isEpub && !isPdf) {
      showError(zh ? "仅支持 EPUB 或 PDF 文件" : "Only EPUB or PDF files are supported");
      return;
    }
    if (asset.size != null && asset.size > 30 * 1024 * 1024) {
      showError(zh ? "文件过大,请选择 30MB 以内的文件" : "File too large (max 30MB)");
      return;
    }

    setPhase("parsing");
    setStatus(zh ? "正在读取文件…" : "Reading file…");
    try {
      let buffer: ArrayBuffer;
      let base64: string | undefined;
      if (Platform.OS === "web") {
        const resp = await fetch(asset.uri);
        buffer = await resp.arrayBuffer();
      } else {
        const b64: string = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        base64 = b64;
        buffer = base64ToArrayBuffer(b64);
      }
      pendingRef.current = { buffer, base64, isPdf, name: asset.name };
      setBookTitle("");

      // 原生端没有 pdfjs,PDF 直接走 AI 识别
      if (isPdf && Platform.OS !== "web") {
        await runOcr();
        return;
      }

      setStatus(zh ? "正在提取文字…" : "Extracting text…");
      const book: ExtractedBook = isEpub ? await extractEpub(buffer) : await extractPdf(buffer);
      const title = book.title || asset.name.replace(/\.(epub|pdf)$/i, "");
      setBookTitle(title);

      setStatus(zh ? "正在识别配方…" : "Detecting recipes…");
      if (!finalize(detectRecipesInBook(book.sections))) {
        setOcrOffer(true);
        showError(
          zh
            ? "未在书中识别到配方。若是扫描版或图片书,可尝试 AI 智能识别。"
            : "No recipes detected. If this is a scanned/image book, try AI Smart OCR.",
        );
      }
    } catch (e) {
      setOcrOffer(true);
      showError(
        (zh ? "文字提取失败:" : "Text extraction failed: ") +
          (e instanceof Error ? e.message : String(e)) +
          (zh ? " — 可尝试 AI 智能识别。" : " — you can try AI Smart OCR."),
      );
    }
  }, [zh, finalize, runOcr, showError]);

  const checkedCount = rows.filter((r) => r.checked).length;

  const toggleAll = useCallback(() => {
    tap();
    setRows((prev) => {
      const allChecked = prev.every((r) => r.checked);
      return prev.map((r) => ({ ...r, checked: !allChecked }));
    });
  }, []);

  /** 翻译所选:未翻译的批量翻译成当前界面语言;全部已翻译时切换显示 */
  const doTranslate = useCallback(async () => {
    tap();
    setReviewError("");
    const untranslated = rows.filter((r) => r.checked && !r.translated).slice(0, 60);
    if (untranslated.length === 0) {
      setRows((prev) => {
        const anyOff = prev.some((r) => r.translated && !r.showTranslated);
        return prev.map((r) => (r.translated ? { ...r, showTranslated: anyOff } : r));
      });
      return;
    }
    try {
      for (let i = 0; i < untranslated.length; i += 15) {
        const batch = untranslated.slice(i, i + 15);
        const res = await translateMutation.mutateAsync({
          target: zh ? "zh" : "en",
          items: batch.map((r) => ({
            id: r.candidate.id,
            name: r.candidate.parsed.name || r.candidate.name,
            ingredients: r.candidate.parsed.ingredients.map((ing) => ({
              name: ing.name,
              amount: ing.amount,
            })),
            steps: r.candidate.parsed.steps,
            garnish: r.candidate.parsed.garnish,
            glass: r.candidate.parsed.glass,
            method: r.candidate.parsed.method,
          })),
        });
        setRows((prev) =>
          prev.map((r) => {
            const t = res.items.find((it) => it.id === r.candidate.id);
            if (!t) return r;
            const orig = r.candidate.parsed;
            const translated: ParsedRecipe = {
              ...orig,
              name: t.name || orig.name,
              ingredients:
                t.ingredients.length === orig.ingredients.length
                  ? t.ingredients.map((ing, idx) => ({
                      id: orig.ingredients[idx].id,
                      name: ing.name || orig.ingredients[idx].name,
                      amount: ing.amount || orig.ingredients[idx].amount,
                    }))
                  : t.ingredients.map((ing: { name: string; amount: string }) => ({ id: genId(), ...ing })),
              steps: t.steps || orig.steps,
              garnish: t.garnish,
              glass: t.glass || orig.glass,
              method: t.method || orig.method,
            };
            return { ...r, translated, showTranslated: true };
          }),
        );
      }
    } catch (e) {
      setReviewError(
        (zh ? "翻译失败:" : "Translation failed: ") +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }, [rows, zh, translateMutation]);

  const doImport = useCallback(() => {
    tap();
    const selected = rows.filter((r) => r.checked);
    if (selected.length === 0) return;
    const source = bookTitle;
    let recipeCount = 0;
    let prepCount = 0;
    for (const row of selected) {
      const orig = row.candidate.parsed;
      const p = row.showTranslated && row.translated ? row.translated : orig;
      const origName = orig.name || row.candidate.name;
      const name = p.name || origName || (zh ? "未命名配方" : "Untitled recipe");
      if (row.kind === "prep") {
        const prepText = `${name} ${row.candidate.raw}`;
        const prepType = guessPrepType(prepText, types) ?? types[0]?.key ?? "syrup";
        const prepIngredients = p.ingredients.map((i) =>
          i.amount ? `${i.name} ${i.amount}` : i.name,
        );
        addPrep({
          name,
          nameAlt: name !== origName ? origName : "",
          type: prepType,
          abvGroup: classifyPrepGroup({
            name,
            type: prepType,
            ingredients: prepIngredients,
            recipe: p.steps,
            sections,
            types,
          }),
          ingredients: prepIngredients,
          recipe: p.steps,
          yield: "",
          shelfLife: "",
          storage: "",
          source,
          notes: "",
        });
        prepCount++;
      } else {
        addRecipe({
          name,
          nameEn: isAscii(name) ? name : isAscii(origName) && origName ? origName : "",
          categoryId: null,
          baseSpirit: p.baseSpirit,
          glass: p.glass,
          method: p.method,
          strength: "medium",
          variantOf: p.variantOf || "",
          codexFamily: normalizeCodexFamilyDecl(p.codexFamily || ""),
          flavors: [],
          source: p.source || source,
          story: "",
          flavorDesc: "",
          ingredients: p.ingredients,
          steps: p.steps,
          garnish: p.garnish,
          notes: "",
        });
        recipeCount++;
      }
    }
    setImported({ recipes: recipeCount, preps: prepCount });
    setRows([]);
    setPhase("done");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [rows, bookTitle, zh, addRecipe, addPrep, sections, types]);

  const updateRow = useCallback((id: string, patch: Partial<CandidateRow>) => {
    setRows((prev) => prev.map((r) => (r.candidate.id === id ? { ...r, ...patch } : r)));
  }, []);

  const confirmLeaveReview = useCallback(() => {
    tap();
    const reset = () => {
      setRows([]);
      setPhase("idle");
    };
    if (phase !== "review" || rows.length === 0) {
      reset();
      return;
    }
    const msg = zh ? "放弃当前识别结果?" : "Discard detected results?";
    if (Platform.OS === "web") {
      if (window.confirm(msg)) reset();
    } else {
      Alert.alert(msg, "", [
        { text: zh ? "取消" : "Cancel", style: "cancel" },
        { text: zh ? "放弃" : "Discard", style: "destructive", onPress: reset },
      ]);
    }
  }, [phase, rows.length, zh]);

  const translating = translateMutation.isPending;
  const anyTranslated = rows.some((r) => r.translated);
  const untranslatedChecked = rows.some((r) => r.checked && !r.translated);

  return (
    <ScreenContainer>
      {/* 顶部栏 */}
      <View className="flex-row items-center px-4 pt-1 pb-3" style={{ gap: 8 }}>
        <Pressable
          onPress={() => {
            tap();
            router.back();
          }}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.primary} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">
            {zh ? "书籍导入" : "Book Import"}
          </Text>
          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
            {phase === "review" && bookTitle
              ? bookTitle
              : zh
                ? "从 EPUB / PDF 提取并识别配方"
                : "Extract & detect recipes from EPUB / PDF"}
          </Text>
        </View>
        {phase === "review" && (
          <Pressable onPress={confirmLeaveReview} hitSlop={8}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>{zh ? "重选" : "Restart"}</Text>
          </Pressable>
        )}
      </View>

      {phase === "idle" && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View className="bg-surface rounded-2xl border border-border p-5 items-center">
            <View style={[styles.bigIcon, { backgroundColor: "#FF9500" }]}>
              <IconSymbol name="book.fill" size={30} color="#FFFFFF" />
            </View>
            <Text className="text-lg font-bold text-foreground mt-4">
              {zh ? "导入配方书" : "Import a Recipe Book"}
            </Text>
            <Text className="text-sm text-muted text-center mt-2 leading-5">
              {zh
                ? "选择 EPUB 或 PDF 电子书,自动提取文字并识别其中的鸡尾酒配方、糖浆与自制配方,审核后一键入库。扫描版/图片书可用 AI 智能识别。"
                : "Pick an EPUB or PDF ebook. Cocktail recipes, syrups and house-made preps are detected automatically for review. Scanned/image books are handled by AI Smart OCR."}
            </Text>
            <Pressable
              onPress={pickFile}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}
            >
              <IconSymbol name="doc.badge.plus" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>
                {zh ? "选择 EPUB / PDF 文件" : "Choose EPUB / PDF"}
              </Text>
            </Pressable>
          </View>
          {!!error && (
            <View className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: "#FF3B3015" }}>
              <Text style={{ color: "#FF3B30", fontSize: 13, lineHeight: 18 }}>{error}</Text>
            </View>
          )}
          {ocrOffer && (
            <Pressable
              onPress={() => {
                tap();
                void runOcr();
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: "#FF9500", marginTop: 12 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <IconSymbol name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>
                {zh ? "AI 智能识别(扫描版 / 图片书)" : "AI Smart OCR (scanned / images)"}
              </Text>
            </Pressable>
          )}
          <View className="mt-4 rounded-xl px-4 py-3 bg-surface border border-border">
            <Text className="text-xs text-muted leading-5">
              {zh
                ? "提示:优先按文字排版规律识别(免费、秒级);无法提取文字时自动建议 AI 智能识别(扫描版 PDF 与图片版 EPUB 均支持)。识别结果可一键 AI 翻译成当前语言后再导入。"
                : "Note: layout-based detection runs first (instant). When text can't be extracted, AI Smart OCR handles scanned PDFs and image EPUBs. Detected recipes can be AI-translated before importing."}
            </Text>
          </View>
        </ScrollView>
      )}

      {phase === "parsing" && (
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-foreground mt-4">{status}</Text>
          <Text className="text-xs text-muted mt-2 text-center">
            {zh ? "大文件或 AI 识别可能需要一会,请稍候" : "Large files or AI OCR may take a while"}
          </Text>
        </View>
      )}

      {phase === "review" && (
        <>
          <View className="flex-row items-center px-5 pb-2" style={{ gap: 14 }}>
            <Text className="flex-1 text-sm text-muted">
              {zh
                ? `识别到 ${rows.length} 个候选,已选 ${checkedCount} 个`
                : `${rows.length} candidates found, ${checkedCount} selected`}
            </Text>
            {(untranslatedChecked || anyTranslated) && (
              <Pressable onPress={doTranslate} hitSlop={6} disabled={translating}>
                <Text
                  style={{
                    color: translating ? colors.muted : colors.primary,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {translating
                    ? zh
                      ? "翻译中…"
                      : "Translating…"
                    : untranslatedChecked
                      ? zh
                        ? "AI 翻译"
                        : "AI Translate"
                      : zh
                        ? "切换原/译文"
                        : "Toggle lang"}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={toggleAll} hitSlop={6}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                {rows.every((r) => r.checked) ? (zh ? "全不选" : "None") : zh ? "全选" : "All"}
              </Text>
            </Pressable>
          </View>
          {!!reviewError && (
            <View className="mx-5 mb-2 rounded-xl px-4 py-2" style={{ backgroundColor: "#FF3B3015" }}>
              <Text style={{ color: "#FF3B30", fontSize: 12, lineHeight: 17 }}>{reviewError}</Text>
            </View>
          )}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}>
            {rows.map((row) => {
              const c = row.candidate;
              const p = row.showTranslated && row.translated ? row.translated : c.parsed;
              const displayName = p.name || c.name;
              return (
                <View
                  key={c.id}
                  className="bg-surface rounded-2xl border border-border mb-3 overflow-hidden"
                  style={!row.checked ? { opacity: 0.55 } : undefined}
                >
                  <Pressable
                    onPress={() => {
                      tap();
                      updateRow(c.id, { checked: !row.checked });
                    }}
                    style={({ pressed }) => [styles.cardHead, pressed && { opacity: 0.8 }]}
                  >
                    <IconSymbol
                      name={row.checked ? "checkmark.circle.fill" : "circle"}
                      size={22}
                      color={row.checked ? colors.primary : colors.muted}
                    />
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                        {displayName || (zh ? "(未识别到名称)" : "(unnamed)")}
                      </Text>
                      <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                        {p.ingredients.length} {zh ? "种配料" : "ingredients"}
                        {p.glass ? ` · ${p.glass}` : ""}
                        {p.method ? ` · ${p.method}` : ""}
                        {" · "}
                        {Math.round(c.confidence * 100)}%
                      </Text>
                    </View>
                    {row.duplicate && (
                      <View style={[styles.badge, { backgroundColor: "#FF950022" }]}>
                        <Text style={{ color: "#FF9500", fontSize: 11, fontWeight: "600" }}>
                          {zh ? "已存在" : "Exists"}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {/* 类型切换 */}
                  <View className="flex-row px-4 pb-3" style={{ gap: 8 }}>
                    {(["cocktail", "prep"] as const).map((k) => {
                      const active = row.kind === k;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => {
                            tap();
                            updateRow(c.id, { kind: k });
                          }}
                          style={[
                            styles.kindChip,
                            {
                              backgroundColor: active ? colors.primary : "transparent",
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: active ? "#FFFFFF" : colors.muted,
                            }}
                          >
                            {k === "cocktail"
                              ? zh
                                ? "鸡尾酒配方"
                                : "Cocktail"
                              : zh
                                ? "自制(糖浆等)"
                                : "Prep (syrup etc.)"}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <View className="flex-1" />
                    {row.translated && (
                      <Pressable
                        onPress={() => {
                          tap();
                          updateRow(c.id, { showTranslated: !row.showTranslated });
                        }}
                        hitSlop={6}
                        style={{ justifyContent: "center" }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 12 }}>
                          {row.showTranslated ? (zh ? "原文" : "Original") : zh ? "译文" : "Translated"}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => {
                        tap();
                        updateRow(c.id, { expanded: !row.expanded });
                      }}
                      hitSlop={6}
                      style={{ justifyContent: "center" }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 12 }}>
                        {row.expanded ? (zh ? "收起" : "Hide") : zh ? "详情" : "Details"}
                      </Text>
                    </Pressable>
                  </View>

                  {row.expanded && (
                    <View
                      className="px-4 pb-4"
                      style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
                    >
                      <Text className="text-xs font-semibold text-muted mt-3 mb-1">
                        {zh ? "配料" : "Ingredients"}
                      </Text>
                      {p.ingredients.map((ing) => (
                        <Text key={ing.id} className="text-sm text-foreground leading-5">
                          · {ing.name}
                          {ing.amount ? `  ${ing.amount}` : ""}
                        </Text>
                      ))}
                      {!!p.steps && (
                        <>
                          <Text className="text-xs font-semibold text-muted mt-3 mb-1">
                            {zh ? "做法" : "Steps"}
                          </Text>
                          <Text className="text-sm text-foreground leading-5">{p.steps}</Text>
                        </>
                      )}
                      {!!p.garnish && (
                        <Text className="text-xs text-muted mt-2">
                          {zh ? "装饰:" : "Garnish: "}
                          {p.garnish}
                        </Text>
                      )}
                      {!!c.sectionTitle && (
                        <Text className="text-xs text-muted mt-2">
                          {zh ? "来自:" : "From: "}
                          {c.sectionTitle}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          {/* 底部导入按钮 */}
          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Pressable
              onPress={doImport}
              disabled={checkedCount === 0}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: checkedCount === 0 ? colors.border : colors.primary,
                  marginTop: 0,
                  alignSelf: "stretch",
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <IconSymbol name="square.and.arrow.down.fill" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>
                {zh ? `导入所选 (${checkedCount})` : `Import selected (${checkedCount})`}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {phase === "done" && imported && (
        <View className="flex-1 items-center justify-center px-8">
          <View style={[styles.bigIcon, { backgroundColor: "#34C759" }]}>
            <IconSymbol name="checkmark" size={30} color="#FFFFFF" />
          </View>
          <Text className="text-xl font-bold text-foreground mt-4">
            {zh ? "导入完成" : "Import complete"}
          </Text>
          <Text className="text-sm text-muted mt-2 text-center">
            {zh
              ? `新增 ${imported.recipes} 个配方、${imported.preps} 个自制`
              : `${imported.recipes} recipes and ${imported.preps} preps added`}
          </Text>
          <View className="flex-row mt-6" style={{ gap: 12 }}>
            <Pressable
              onPress={() => {
                tap();
                setPhase("idle");
                setImported(null);
              }}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>
                {zh ? "继续导入" : "Import more"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                tap();
                router.back();
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary, marginTop: 0 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryBtnText}>{zh ? "完成" : "Done"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bigIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 20,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
