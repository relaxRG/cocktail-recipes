import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { useBookStore } from "@/lib/books/store";
import { detectRecipesInText, RecipeCandidate } from "@/lib/import/detect";
import { ParsedRecipe } from "@/lib/recipes/parser";
import { genId } from "@/lib/recipes/types";
import { useRecipeStore } from "@/lib/recipes/store";
import { useHomemadeStore } from "@/lib/homemade/store";
import { classifyPrepGroup, guessPrepType } from "@/lib/homemade/types";
import { normalizeCodexFamilyDecl } from "@/lib/recipes/lineage";
import { trpc } from "@/lib/trpc";

interface ReadingBlock {
  id: string;
  type: "heading" | "paragraph";
  text: string;
  sectionTitle: string;
  isCandidate: boolean;
  candidateConfidence: number;
  selected: boolean;
  candidate?: RecipeCandidate;
}

interface ReviewItem {
  blockId: string;
  candidate: RecipeCandidate;
  checked: boolean;
  kind: "cocktail" | "prep";
  expanded: boolean;
  duplicate: boolean;
  translated?: ParsedRecipe;
  showTranslated: boolean;
}

function buildReadingBlocks(sections: { title: string; text: string }[]): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  for (const section of sections) {
    if (section.title && section.title.length < 80) {
      blocks.push({
        id: genId(),
        type: "heading",
        text: section.title,
        sectionTitle: section.title,
        isCandidate: false,
        candidateConfidence: 0,
        selected: false,
      });
    }
    const lines = section.text.split(/\n+/).filter((l) => l.trim().length > 0);
    let buf: string[] = [];
    const flush = () => {
      if (buf.length === 0) return;
      const text = buf.join("\n").trim();
      if (text.length > 0) {
        blocks.push({
          id: genId(),
          type: "paragraph",
          text,
          sectionTitle: section.title,
          isCandidate: false,
          candidateConfidence: 0,
          selected: false,
        });
      }
      buf = [];
    };
    for (const line of lines) {
      buf.push(line);
      if (buf.join("\n").length >= 280 || line.startsWith("##")) flush();
    }
    flush();
  }
  return blocks;
}

const isAscii = (s: string) => /^[\x00-\x7F]+$/.test(s);

type Phase = "reading" | "confirm" | "done";

export default function BookReaderScreen() {
  const colors = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  const insets = useSafeAreaInsets();
  const zh = lang === "zh";
  const { id } = useLocalSearchParams<{ id: string }>();

  const { books, updatePosition } = useBookStore();
  const book = books.find((b) => b.id === id);

  const { addRecipe, updateRecipe, recipes } = useRecipeStore();
  const { addPrep, preps, sections, types } = useHomemadeStore();

  const translateMutation = trpc.bookImport.translate.useMutation();
  const enrichRecipeMutation = trpc.lookup.enrichRecipe.useMutation();

  const [blocks, setBlocks] = useState<ReadingBlock[]>(() =>
    book ? buildReadingBlocks(book.sections) : [],
  );
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [scanRange, setScanRange] = useState<{ from: number; to: number } | null>(null);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [phase, setPhase] = useState<Phase>("reading");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [importResult, setImportResult] = useState<{ recipes: number; preps: number } | null>(null);
  const [reviewError, setReviewError] = useState("");

  const existingNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) {
      if (r.name) set.add(r.name.toLowerCase().trim());
      if (r.nameEn) set.add(r.nameEn.toLowerCase().trim());
    }
    for (const p of preps) {
      if (p.name) set.add(p.name.toLowerCase().trim());
    }
    return set;
  }, [recipes, preps]);

  const tap = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const candidateCount = blocks.filter((b) => b.isCandidate).length;
  const selectedCount = blocks.filter((b) => b.selected).length;

  const runLocalScan = useCallback(() => {
    setBlocks((prev) => {
      const next = [...prev];
      const sectionMap = new Map<string, { indices: number[]; text: string }>();
      for (let i = 0; i < next.length; i++) {
        const b = next[i];
        if (b.type === "heading") continue;
        const key = b.sectionTitle;
        if (!sectionMap.has(key)) sectionMap.set(key, { indices: [], text: "" });
        const s = sectionMap.get(key)!;
        s.indices.push(i);
        s.text += (s.text ? "\n\n" : "") + b.text;
      }
      for (const [title, { indices, text }] of sectionMap) {
        const candidates = detectRecipesInText(text, title);
        if (candidates.length === 0) continue;
        for (const cand of candidates) {
          const rawLower = cand.raw.toLowerCase();
          let bestIdx = -1, bestScore = 0;
          for (const i of indices) {
            const blockLower = next[i].text.toLowerCase();
            let overlap = 0;
            const words = rawLower.split(/\s+/).filter((w) => w.length > 3);
            for (const w of words) if (blockLower.includes(w)) overlap++;
            const score = words.length > 0 ? overlap / words.length : 0;
            if (score > bestScore) { bestScore = score; bestIdx = i; }
          }
          if (bestIdx >= 0 && bestScore > 0.25) {
            next[bestIdx] = { ...next[bestIdx], isCandidate: true, candidateConfidence: cand.confidence, candidate: cand };
          }
        }
      }
      return next;
    });
  }, []);

  const runAiScan = useCallback(async (range?: { from: number; to: number }) => {
    if (scanning) return;
    setScanning(true);
    const allParas = blocks.filter((b) => b.type === "paragraph");
    const effectiveRange = range ?? scanRange;
    let paras = allParas;
    if (effectiveRange) {
      const headings = blocks.filter((b) => b.type === "heading");
      const fromSection = headings[Math.max(0, effectiveRange.from - 1)]?.sectionTitle ?? "";
      const toSection = headings[Math.min(headings.length - 1, effectiveRange.to - 1)]?.sectionTitle ?? "";
      paras = allParas.filter((b) => b.sectionTitle >= fromSection && b.sectionTitle <= toSection);
      if (paras.length === 0) paras = allParas;
    }
    setScanProgress({ done: 0, total: paras.length });
    try {
      const chunkSize = 20;
      let done = 0;
      for (let i = 0; i < paras.length; i += chunkSize) {
        const chunk = paras.slice(i, i + chunkSize);
        const candidates = detectRecipesInText(chunk.map((b) => b.text).join("\n\n"), "");
        setBlocks((prev) => {
          const next = [...prev];
          for (const cand of candidates) {
            const rawWords = cand.raw.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
            for (const b of chunk) {
              const idx = next.findIndex((nb) => nb.id === b.id);
              if (idx < 0) continue;
              const blockLower = next[idx].text.toLowerCase();
              let overlap = 0;
              for (const w of rawWords) if (blockLower.includes(w)) overlap++;
              const score = rawWords.length > 0 ? overlap / rawWords.length : 0;
              if (score > 0.3 && (!next[idx].isCandidate || cand.confidence > next[idx].candidateConfidence)) {
                next[idx] = { ...next[idx], isCandidate: true, candidateConfidence: cand.confidence, candidate: cand };
              }
            }
          }
          return next;
        });
        done += chunk.length;
        setScanProgress({ done, total: paras.length });
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }, [scanning, blocks, scanRange]);

  const toggleBlock = useCallback((id: string) => {
    tap();
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, selected: !b.selected } : b)));
  }, []);

  const proceedToConfirm = useCallback(() => {
    tap();
    const selected = blocks.filter((b) => b.selected && b.type === "paragraph");
    if (selected.length === 0) return;
    const items: ReviewItem[] = selected.map((b) => {
      const cand: RecipeCandidate = b.candidate ?? (() => {
        const detected = detectRecipesInText(b.text, b.sectionTitle);
        return detected[0] ?? {
          id: genId(), kind: "cocktail" as const,
          name: b.text.split("\n")[0].slice(0, 48).trim(),
          parsed: { name: b.text.split("\n")[0].slice(0, 48).trim(), ingredients: [], steps: b.text, garnish: "", glass: "", method: "", source: "", variantOf: "", codexFamily: "", baseSpirit: "" },
          raw: b.text, sectionTitle: b.sectionTitle, confidence: 0.5,
        };
      })();
      const duplicate = !!cand.name && existingNames.has(cand.name.toLowerCase().trim());
      return { blockId: b.id, candidate: cand, checked: !duplicate && !!cand.name, kind: cand.kind, expanded: false, duplicate, showTranslated: false };
    });
    setReviewItems(items);
    setReviewError("");
    setImportResult(null);
    setPhase("confirm");
  }, [blocks, existingNames]);

  const updateItem = useCallback((blockId: string, patch: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev.map((r) => (r.blockId === blockId ? { ...r, ...patch } : r)));
  }, []);

  const checkedCount = reviewItems.filter((r) => r.checked).length;
  const translating = translateMutation.isPending;
  const anyTranslated = reviewItems.some((r) => r.translated);
  const untranslatedChecked = reviewItems.some((r) => r.checked && !r.translated);

  const doTranslate = useCallback(async () => {
    tap();
    setReviewError("");
    const untranslated = reviewItems.filter((r) => r.checked && !r.translated).slice(0, 60);
    if (untranslated.length === 0) {
      setReviewItems((prev) => {
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
          items: batch.map((r) => ({ id: r.candidate.id, name: r.candidate.parsed.name || r.candidate.name, ingredients: r.candidate.parsed.ingredients.map((ing) => ({ name: ing.name, amount: ing.amount })), steps: r.candidate.parsed.steps, garnish: r.candidate.parsed.garnish, glass: r.candidate.parsed.glass, method: r.candidate.parsed.method })),
        });
        setReviewItems((prev) => prev.map((r) => {
          const t = res.items.find((it) => it.id === r.candidate.id);
          if (!t) return r;
          const orig = r.candidate.parsed;
          const translated: ParsedRecipe = {
            ...orig, name: t.name || orig.name,
            ingredients: t.ingredients.length === orig.ingredients.length
              ? t.ingredients.map((ing, idx) => ({ id: orig.ingredients[idx].id, name: ing.name || orig.ingredients[idx].name, amount: ing.amount || orig.ingredients[idx].amount }))
              : t.ingredients.map((ing) => ({ id: genId(), ...ing })),
            steps: t.steps || orig.steps, garnish: t.garnish, glass: t.glass || orig.glass, method: t.method || orig.method,
          };
          return { ...r, translated, showTranslated: true };
        }));
      }
    } catch (e) {
      setReviewError((zh ? "翻译失败：" : "Translation failed: ") + (e instanceof Error ? e.message : String(e)));
    }
  }, [reviewItems, zh, translateMutation]);

  const doImport = useCallback(() => {
    tap();
    const selected = reviewItems.filter((r) => r.checked);
    if (selected.length === 0) return;
    const source = book?.title ?? "";
    let recipeCount = 0, prepCount = 0;
    for (const row of selected) {
      const orig = row.candidate.parsed;
      const p = row.showTranslated && row.translated ? row.translated : orig;
      const origName = orig.name || row.candidate.name;
      const name = p.name || origName || (zh ? "未命名配方" : "Untitled recipe");
      if (row.kind === "prep") {
        const prepType = guessPrepType(`${name} ${row.candidate.raw}`, types) ?? types[0]?.key ?? "syrup";
        const prepIngredients = p.ingredients.map((i) => (i.amount ? `${i.name} ${i.amount}` : i.name));
        addPrep({ name, nameAlt: name !== origName ? origName : "", type: prepType, abvGroup: classifyPrepGroup({ name, type: prepType, ingredients: prepIngredients, recipe: p.steps, sections, types }), ingredients: prepIngredients, recipe: p.steps, yield: "", shelfLife: "", storage: "", source, notes: "" });
        prepCount++;
      } else {
        const draft = { name, nameEn: isAscii(name) ? name : isAscii(origName) && origName ? origName : "", categoryId: null, baseSpirit: p.baseSpirit, glass: p.glass, method: p.method, strength: "medium" as const, variantOf: p.variantOf || "", codexFamily: normalizeCodexFamilyDecl(p.codexFamily || ""), flavors: [], source: p.source || source, story: "", flavorDesc: "", ingredients: p.ingredients, steps: p.steps, garnish: p.garnish, notes: "" };
        const newRecipe = addRecipe(draft);
        const ingNames = p.ingredients.map((i) => i.name).filter(Boolean);
        enrichRecipeMutation.mutate(
          { name: draft.name, nameEn: draft.nameEn || undefined, baseSpirit: draft.baseSpirit || undefined, ingredients: ingNames.length > 0 ? ingNames : undefined },
          { onSuccess: (result) => { if (result.flavors.length > 0) updateRecipe(newRecipe.id, { ...draft, flavors: result.flavors }); } },
        );
        recipeCount++;
      }
    }
    setImportResult({ recipes: recipeCount, preps: prepCount });
    setReviewItems([]);
    setPhase("done");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [reviewItems, book, zh, addRecipe, updateRecipe, addPrep, sections, types, enrichRecipeMutation]);

  if (!book) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.muted }}>{zh ? "书籍不存在" : "Book not found"}</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary }}>{zh ? "返回" : "Go back"}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingBottom: phase === "reading" ? 0 : 8 }]}>
        <Pressable
          onPress={() => {
            tap();
            if (phase === "confirm") { setPhase("reading"); return; }
            router.back();
          }}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name={phase === "confirm" ? "chevron.left" : "chevron.left"} size={20} color={colors.foreground} />
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
            {book.title || book.fileName}
          </Text>
          {phase === "reading" && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }} numberOfLines={1}>
              {scanning
                ? scanProgress ? `${zh ? "扫描中" : "Scanning"} ${scanProgress.done}/${scanProgress.total}…` : (zh ? "扫描中…" : "Scanning…")
                : candidateCount > 0
                  ? zh ? `${candidateCount} 处候选 · ${selectedCount} 已选` : `${candidateCount} candidates · ${selectedCount} selected`
                  : zh ? "点击段落选取配方" : "Tap paragraphs to select"}
            </Text>
          )}
        </View>

        {phase === "reading" && (
          <Pressable
            onPress={() => { tap(); setShowRangePicker(true); }}
            disabled={scanning}
            hitSlop={8}
            style={({ pressed }) => [styles.scanBtn, { backgroundColor: scanning ? colors.border : colors.primary + "18", borderColor: colors.primary + "44" }, pressed && { opacity: 0.7 }]}
          >
            {scanning ? <ActivityIndicator size="small" color={colors.primary} /> : <IconSymbol name="sparkles" size={14} color={colors.primary} />}
            <Text style={{ fontSize: 12, fontWeight: "600", color: scanning ? colors.muted : colors.primary }}>
              {zh ? "AI 扫描" : "AI Scan"}
            </Text>
            {scanRange && <Text style={{ fontSize: 10, color: colors.primary }}>{scanRange.from}-{scanRange.to}</Text>}
          </Pressable>
        )}
        {phase === "confirm" && (
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {zh ? `已选 ${checkedCount}` : `${checkedCount} selected`}
          </Text>
        )}
      </View>

      {/* Reading Phase */}
      {phase === "reading" && (
        <>
          {scanning && scanProgress && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              <View style={{ height: 2, backgroundColor: colors.border, borderRadius: 1, overflow: "hidden" }}>
                <View style={{ height: 2, backgroundColor: colors.primary, width: `${Math.round((scanProgress.done / Math.max(scanProgress.total, 1)) * 100)}%`, borderRadius: 1 }} />
              </View>
            </View>
          )}

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 120 + insets.bottom }}
            showsVerticalScrollIndicator
          >
            {blocks.map((block) => {
              if (block.type === "heading") {
                return (
                  <Text key={block.id} style={[styles.chapterHeading, { color: colors.foreground, borderBottomColor: colors.border }]}>
                    {block.text}
                  </Text>
                );
              }
              const isSelected = block.selected;
              const isHint = block.isCandidate && !isSelected;
              return (
                <Pressable
                  key={block.id}
                  onPress={() => toggleBlock(block.id)}
                  style={({ pressed }) => [{
                    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6,
                    backgroundColor: isSelected ? colors.primary + "18" : isHint ? "#FF950012" : "transparent",
                    borderColor: isSelected ? colors.primary + "55" : isHint ? "#FF950044" : "transparent",
                    borderWidth: isSelected || isHint ? 1 : 0,
                    opacity: pressed ? 0.75 : 1,
                  }]}
                >
                  {(isSelected || isHint) && (
                    <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
                      {isSelected && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: colors.primary }}>
                          <IconSymbol name="checkmark" size={9} color="#FFF" />
                          <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{zh ? "已选" : "Selected"}</Text>
                        </View>
                      )}
                      {isHint && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: "#FF9500" }}>
                          <IconSymbol name="sparkles" size={9} color="#FFF" />
                          <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "600" }}>
                            {block.candidateConfidence >= 0.7 ? (zh ? "高置信配方" : "Recipe") : block.candidateConfidence >= 0.5 ? (zh ? "疑似配方" : "Possible") : (zh ? "参考" : "Hint")}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <Text style={{ fontSize: 15, lineHeight: 24, color: isSelected ? colors.primary : colors.foreground, fontWeight: isSelected ? "500" : "400" }}>
                    {block.text}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            {candidateCount === 0 && !scanning && (
              <Pressable onPress={() => { tap(); runLocalScan(); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 }}>
                <IconSymbol name="magnifyingglass" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{zh ? "快速检测配方候选" : "Detect recipe candidates"}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={proceedToConfirm}
              disabled={selectedCount === 0}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: selectedCount === 0 ? colors.border : colors.primary, marginTop: 0, alignSelf: "stretch" }, pressed && selectedCount > 0 && { opacity: 0.85 }]}
            >
              <IconSymbol name="square.and.arrow.down.fill" size={17} color="#FFF" />
              <Text style={styles.primaryBtnText}>
                {selectedCount === 0 ? (zh ? "点击段落选取配方" : "Tap paragraphs to select") : zh ? `导入选中（${selectedCount}）` : `Import (${selectedCount})`}
              </Text>
            </Pressable>
            {candidateCount > 0 && selectedCount === 0 && (
              <Pressable onPress={() => { tap(); setBlocks((prev) => prev.map((b) => (b.isCandidate && b.candidateConfidence >= 0.5 ? { ...b, selected: true } : b))); }} style={{ alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: colors.primary, fontSize: 13 }}>{zh ? `选中全部 ${candidateCount} 个候选` : `Select all ${candidateCount} candidates`}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {/* Confirm Phase */}
      {phase === "confirm" && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 13, color: colors.muted }}>
              {zh ? `${reviewItems.length} 段内容，已选 ${checkedCount} 个` : `${reviewItems.length} items · ${checkedCount} selected`}
            </Text>
            {(untranslatedChecked || anyTranslated) && (
              <Pressable onPress={doTranslate} hitSlop={6} disabled={translating}>
                <Text style={{ color: translating ? colors.muted : colors.primary, fontSize: 14, fontWeight: "600" }}>
                  {translating ? (zh ? "翻译中…" : "Translating…") : untranslatedChecked ? (zh ? "AI 翻译" : "AI Translate") : (zh ? "切换原/译文" : "Toggle lang")}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={() => { tap(); setReviewItems((prev) => { const allChecked = prev.every((r) => r.checked); return prev.map((r) => ({ ...r, checked: !allChecked })); }); }} hitSlop={6}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                {reviewItems.every((r) => r.checked) ? (zh ? "全不选" : "None") : zh ? "全选" : "All"}
              </Text>
            </Pressable>
          </View>
          {!!reviewError && (
            <View style={{ marginHorizontal: 20, marginBottom: 8, borderRadius: 12, padding: 12, backgroundColor: "#FF3B3015" }}>
              <Text style={{ color: "#FF3B30", fontSize: 12, lineHeight: 17 }}>{reviewError}</Text>
            </View>
          )}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}>
            {reviewItems.map((row) => {
              const c = row.candidate;
              const p = row.showTranslated && row.translated ? row.translated : c.parsed;
              const displayName = p.name || c.name;
              return (
                <View key={row.blockId} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }, !row.checked && { opacity: 0.55 }]}>
                  <Pressable onPress={() => { tap(); updateItem(row.blockId, { checked: !row.checked }); }} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }, pressed && { opacity: 0.8 }]}>
                    <IconSymbol name={row.checked ? "checkmark.circle.fill" : "circle"} size={22} color={row.checked ? colors.primary : colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{displayName || (zh ? "（未识别到名称）" : "(unnamed)")}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                        {p.ingredients.length} {zh ? "种配料" : "ingredients"}{p.glass ? ` · ${p.glass}` : ""} · {Math.round(c.confidence * 100)}%
                      </Text>
                    </View>
                    {row.duplicate && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FF950022" }}>
                        <Text style={{ color: "#FF9500", fontSize: 11, fontWeight: "600" }}>{zh ? "已存在" : "Exists"}</Text>
                      </View>
                    )}
                  </Pressable>
                  <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
                    {(["cocktail", "prep"] as const).map((k) => {
                      const active = row.kind === k;
                      return (
                        <Pressable key={k} onPress={() => { tap(); updateItem(row.blockId, { kind: k }); }} style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 }, { backgroundColor: active ? colors.primary : "transparent", borderColor: active ? colors.primary : colors.border }]}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#FFF" : colors.muted }}>
                            {k === "cocktail" ? (zh ? "鸡尾酒" : "Cocktail") : (zh ? "自制" : "Prep")}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <View style={{ flex: 1 }} />
                    {row.translated && (
                      <Pressable onPress={() => { tap(); updateItem(row.blockId, { showTranslated: !row.showTranslated }); }} hitSlop={6} style={{ justifyContent: "center" }}>
                        <Text style={{ color: colors.primary, fontSize: 12 }}>{row.showTranslated ? (zh ? "原文" : "Original") : (zh ? "译文" : "Translated")}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => { tap(); updateItem(row.blockId, { expanded: !row.expanded }); }} hitSlop={6} style={{ justifyContent: "center" }}>
                      <Text style={{ color: colors.primary, fontSize: 12 }}>{row.expanded ? (zh ? "收起" : "Hide") : (zh ? "详情" : "Details")}</Text>
                    </Pressable>
                  </View>
                  {row.expanded && (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 12, marginBottom: 4 }}>{zh ? "配料" : "Ingredients"}</Text>
                      {p.ingredients.map((ing) => (
                        <Text key={ing.id} style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>· {ing.name}{ing.amount ? `  ${ing.amount}` : ""}</Text>
                      ))}
                      {!!p.steps && (
                        <>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 10, marginBottom: 4 }}>{zh ? "做法" : "Steps"}</Text>
                          <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{p.steps}</Text>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable onPress={doImport} disabled={checkedCount === 0} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: checkedCount === 0 ? colors.border : colors.primary, marginTop: 0, alignSelf: "stretch" }, pressed && { opacity: 0.85 }]}>
              <IconSymbol name="square.and.arrow.down.fill" size={18} color="#FFF" />
              <Text style={styles.primaryBtnText}>{zh ? `导入所选（${checkedCount}）` : `Import (${checkedCount})`}</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Done Phase */}
      {phase === "done" && importResult && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: "#34C759", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="checkmark" size={30} color="#FFF" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginTop: 16 }}>{zh ? "导入完成" : "Import complete"}</Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, textAlign: "center" }}>
            {zh ? `新增 ${importResult.recipes} 个配方、${importResult.preps} 个自制` : `${importResult.recipes} recipes and ${importResult.preps} preps added`}
          </Text>
          <View style={{ flexDirection: "row", marginTop: 24, gap: 12 }}>
            <Pressable onPress={() => { tap(); setPhase("reading"); setImportResult(null); }} style={({ pressed }) => [{ paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>{zh ? "继续阅读" : "Keep reading"}</Text>
            </Pressable>
            <Pressable onPress={() => { tap(); router.back(); }} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 0 }, pressed && { opacity: 0.85 }]}>
              <Text style={styles.primaryBtnText}>{zh ? "完成" : "Done"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Range Picker */}
      {showRangePicker && (
        <RangePickerOverlay
          colors={colors}
          zh={zh}
          chapterCount={blocks.filter((b) => b.type === "heading").length}
          scanRange={scanRange}
          onConfirm={(range) => {
            setScanRange(range);
            setShowRangePicker(false);
            void runAiScan(range ?? undefined);
          }}
          onClose={() => setShowRangePicker(false)}
        />
      )}
    </ScreenContainer>
  );
}

function RangePickerOverlay({
  colors,
  zh,
  chapterCount,
  scanRange,
  onConfirm,
  onClose,
}: {
  colors: ReturnType<typeof useColors>;
  zh: boolean;
  chapterCount: number;
  scanRange: { from: number; to: number } | null;
  onConfirm: (range: { from: number; to: number } | null) => void;
  onClose: () => void;
}) {
  const maxChapters = Math.max(chapterCount, 1);
  const [from, setFrom] = useState(scanRange?.from ?? 1);
  const [to, setTo] = useState(scanRange?.to ?? maxChapters);
  const [mode, setMode] = useState<"all" | "range">(scanRange ? "range" : "all");

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)" }]} onPress={onClose} />
      <View style={[styles.rangeSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>
          {zh ? "AI 扫描范围" : "AI Scan Range"}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {(["all", "range"] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable key={m} onPress={() => setMode(m)} style={[{ flex: 1, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" }, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#FFF" : colors.muted }}>
                  {m === "all" ? (zh ? "全部章节" : "All sections") : (zh ? "指定范围" : "Custom range")}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {mode === "range" && (
          <View style={{ gap: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>{zh ? `共 ${maxChapters} 个章节` : `${maxChapters} sections total`}</Text>
            {([["from", from, setFrom] as const, ["to", to, setTo] as const]).map(([label, val, setter]) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 14, width: 50 }}>{label === "from" ? (zh ? "从第" : "From") : (zh ? "到第" : "To")}</Text>
                <Pressable onPress={() => setter(label === "from" ? Math.max(1, val - 1) : Math.max(from, val - 1))} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 18, color: colors.primary }}>−</Text>
                </Pressable>
                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, minWidth: 32, textAlign: "center" }}>{val}</Text>
                <Pressable onPress={() => setter(label === "from" ? Math.min(to, val + 1) : Math.min(maxChapters, val + 1))} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 18, color: colors.primary }}>+</Text>
                </Pressable>
                <Text style={{ color: colors.muted, fontSize: 14 }}>{zh ? "章" : ""}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={onClose} style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>{zh ? "取消" : "Cancel"}</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm(mode === "range" ? { from, to } : null)} style={{ flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 48, borderRadius: 14, backgroundColor: colors.primary }}>
            <IconSymbol name="sparkles" size={15} color="#FFF" />
            <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}>{zh ? "开始扫描" : "Scan"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  chapterHeading: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 28,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  rangeSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
});
