import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { htmlToText } from "@/lib/import/extract";
import { ParsedRecipe } from "@/lib/recipes/parser";
import { genId } from "@/lib/recipes/types";
import { useRecipeStore } from "@/lib/recipes/store";
import { useHomemadeStore } from "@/lib/homemade/store";
import { classifyPrepGroup, guessPrepType } from "@/lib/homemade/types";
import { normalizeCodexFamilyDecl } from "@/lib/recipes/lineage";
import { trpc } from "@/lib/trpc";

/* ─── Reading CSS injected into HTML renderer ─────────────────────────────── */

const READER_CSS = `
  body { margin: 0; padding: 0; font-family: -apple-system, 'Georgia', serif; line-height: 1.75; }
  * { box-sizing: border-box; max-width: 100%; }
  img { display: block; max-width: 100%; height: auto; margin: 12px auto; border-radius: 8px; }
  h1, h2, h3, h4 { line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; }
  p { margin: 0 0 0.9em; }
  ul, ol { padding-left: 1.4em; margin: 0 0 0.9em; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  td, th { border: 1px solid #ddd; padding: 6px 10px; }
  a { color: inherit; text-decoration: none; }
  .recipe-highlight { background: rgba(255,149,0,0.12); border-left: 3px solid #FF9500; padding-left: 8px; border-radius: 4px; }
  .selected-highlight { background: rgba(0,122,255,0.12); border-left: 3px solid #007AFF; padding-left: 8px; border-radius: 4px; }
`;

/* ─── HTML chapter renderer (web-only) ────────────────────────────────────── */

function HtmlChapter({ html, css, fontSize }: { html: string; css: string; fontSize: number }) {
  if (Platform.OS !== "web") {
    // Native fallback: plain text
    const text = htmlToText(html);
    return (
      <Text style={{ fontSize, lineHeight: fontSize * 1.75, color: "#000" }}>
        {text}
      </Text>
    );
  }

  const fullHtml = `<style>${READER_CSS}\n${css}\nbody { font-size: ${fontSize}px; }</style>${html}`;
  return (
    <div
      style={{ fontSize, lineHeight: 1.75 }}
      // eslint-disable-next-line react-native/no-inline-styles
      dangerouslySetInnerHTML={{ __html: fullHtml }}
    />
  );
}

/* ─── Paragraph-range selection state ─────────────────────────────────────── */

interface TextBlock {
  id: string;
  text: string;
  isCandidate: boolean;
  confidence: number;
  candidate?: RecipeCandidate;
  selected: boolean;
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

const isAscii = (s: string) => /^[\x00-\x7F]+$/.test(s);

type Phase = "reading" | "select" | "confirm" | "done";

/* ─── Main screen ──────────────────────────────────────────────────────────── */

export default function BookReaderScreen() {
  const colors = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  const insets = useSafeAreaInsets();
  const zh = lang === "zh";
  const { id } = useLocalSearchParams<{ id: string }>();

  const { books, loadChapter, updatePosition } = useBookStore();
  const book = books.find((b) => b.id === id);

  const { addRecipe, updateRecipe, recipes } = useRecipeStore();
  const { addPrep, preps, sections, types } = useHomemadeStore();
  const translateMutation = trpc.bookImport.translate.useMutation();
  const enrichRecipeMutation = trpc.lookup.enrichRecipe.useMutation();

  /* Chapter navigation */
  const [chapterIdx, setChapterIdx] = useState(book?.lastChapter ?? 0);
  const [chapterHtml, setChapterHtml] = useState<string | null>(null);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  /* Font size */
  const [fontSize, setFontSize] = useState(16);

  /* Chrome visibility (tap to hide/show) */
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Selection mode */
  const [phase, setPhase] = useState<Phase>("reading");
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [scanning, setScanning] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [importResult, setImportResult] = useState<{ recipes: number; preps: number } | null>(null);
  const [reviewError, setReviewError] = useState("");

  const tap = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  /* Load chapter HTML */
  useEffect(() => {
    if (!book) return;
    setLoadingChapter(true);
    setChapterHtml(null);

    if (book.hasHtml) {
      loadChapter(book.id, chapterIdx).then((html) => {
        setChapterHtml(html ?? "<p>(空章节)</p>");
        setLoadingChapter(false);
      });
    } else {
      // Legacy plain-text book: render as paragraphs
      const section = book.sections[chapterIdx];
      setChapterHtml(null);
      setLoadingChapter(false);
      if (section) {
        // Build minimal HTML from plain text
        const html = section.text
          .split(/\n+/)
          .filter((l) => l.trim())
          .map((l) => `<p>${l.trim()}</p>`)
          .join("\n");
        setChapterHtml(html);
      }
    }
  }, [book, chapterIdx, loadChapter]);

  /* Persist position when chapter changes */
  useEffect(() => {
    if (book) updatePosition(book.id, 0, chapterIdx);
  }, [chapterIdx]);

  /* Auto-hide chrome after 4s */
  const showChrome = useCallback(() => {
    setChromeVisible(true);
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeVisible(false), 4000);
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== "reading") return;
    showChrome();
  }, [phase, showChrome]);

  useEffect(() => {
    showChrome();
    return () => { if (chromeTimer.current) clearTimeout(chromeTimer.current); };
  }, []);

  const totalChapters = book?.sections.length ?? 0;
  const progress = totalChapters > 0 ? (chapterIdx + 1) / totalChapters : 0;

  /* ── Selection mode: build text blocks from current chapter ── */
  const enterSelectMode = useCallback(() => {
    tap();
    const html = chapterHtml ?? "";
    const text = htmlToText(html);
    const paras = text.split(/\n+/).filter((l) => l.trim().length > 10);
    const newBlocks: TextBlock[] = paras.map((p) => ({
      id: genId(),
      text: p.trim(),
      isCandidate: false,
      confidence: 0,
      selected: false,
    }));
    // Quick local scan
    const fullText = paras.join("\n\n");
    const candidates = detectRecipesInText(fullText, book?.sections[chapterIdx]?.title ?? "");
    for (const cand of candidates) {
      const rawLower = cand.raw.toLowerCase();
      let bestIdx = -1, bestScore = 0;
      for (let i = 0; i < newBlocks.length; i++) {
        const words = rawLower.split(/\s+/).filter((w) => w.length > 3);
        let overlap = 0;
        for (const w of words) if (newBlocks[i].text.toLowerCase().includes(w)) overlap++;
        const score = words.length > 0 ? overlap / words.length : 0;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      if (bestIdx >= 0 && bestScore > 0.25) {
        newBlocks[bestIdx] = { ...newBlocks[bestIdx], isCandidate: true, confidence: cand.confidence, candidate: cand };
      }
    }
    setBlocks(newBlocks);
    setPhase("select");
  }, [chapterHtml, book, chapterIdx]);

  const toggleBlock = useCallback((blockId: string) => {
    tap();
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, selected: !b.selected } : b));
  }, []);

  const selectedCount = blocks.filter((b) => b.selected).length;
  const candidateCount = blocks.filter((b) => b.isCandidate).length;

  /* ── Confirm phase ── */
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

  const proceedToConfirm = useCallback(() => {
    tap();
    const selected = blocks.filter((b) => b.selected);
    if (selected.length === 0) return;
    const items: ReviewItem[] = selected.map((b) => {
      const cand: RecipeCandidate = b.candidate ?? (() => {
        const detected = detectRecipesInText(b.text, "");
        return detected[0] ?? {
          id: genId(), kind: "cocktail" as const,
          name: b.text.split("\n")[0].slice(0, 48).trim(),
          parsed: { name: b.text.split("\n")[0].slice(0, 48).trim(), ingredients: [], steps: b.text, garnish: "", glass: "", method: "", source: "", variantOf: "", codexFamily: "", baseSpirit: "" },
          raw: b.text, sectionTitle: "", confidence: 0.5,
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
  const untranslatedChecked = reviewItems.some((r) => r.checked && !r.translated);
  const anyTranslated = reviewItems.some((r) => r.translated);

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
          const translated: ParsedRecipe = { ...orig, name: t.name || orig.name, ingredients: t.ingredients.length === orig.ingredients.length ? t.ingredients.map((ing, idx) => ({ id: orig.ingredients[idx].id, name: ing.name || orig.ingredients[idx].name, amount: ing.amount || orig.ingredients[idx].amount })) : t.ingredients.map((ing) => ({ id: genId(), ...ing })), steps: t.steps || orig.steps, garnish: t.garnish, glass: t.glass || orig.glass, method: t.method || orig.method };
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

  /* ── Not found ── */
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

  /* ─── Render ─────────────────────────────────────────────────────────────── */

  const chapterTitles = book.sections.map((s) => s.title);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>

      {/* ── Top chrome (auto-hide) ── */}
      {chromeVisible && phase === "reading" && (
        <View style={[styles.topBar, { backgroundColor: colors.background + "F0", borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>
            {book.title || book.fileName}
          </Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {/* Font size controls */}
            <Pressable onPress={() => { tap(); setFontSize((f) => Math.max(12, f - 1)); }} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>A−</Text>
            </Pressable>
            <Pressable onPress={() => { tap(); setFontSize((f) => Math.min(24, f + 1)); }} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
              <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }}>A+</Text>
            </Pressable>
            {/* TOC */}
            <Pressable onPress={() => { tap(); setTocOpen(true); }} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
              <IconSymbol name="list.bullet" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Select mode header ── */}
      {phase === "select" && (
        <View style={[styles.topBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => { tap(); setPhase("reading"); setBlocks([]); }} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>
            {zh ? "选取配方段落" : "Select recipe paragraphs"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {zh ? `已选 ${selectedCount}` : `${selectedCount} selected`}
          </Text>
        </View>
      )}

      {/* ── Confirm phase header ── */}
      {phase === "confirm" && (
        <View style={[styles.topBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => { tap(); setPhase("select"); }} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: colors.foreground }]}>
            {zh ? "确认导入" : "Review Import"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {zh ? `已选 ${checkedCount}` : `${checkedCount} selected`}
          </Text>
        </View>
      )}

      {/* ── Reading phase ── */}
      {phase === "reading" && (
        <Pressable style={{ flex: 1 }} onPress={handleTap} accessible={false}>
          {loadingChapter ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: chromeVisible ? 8 : 16,
                paddingBottom: 100 + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
            >
              {chapterHtml ? (
                <HtmlChapter
                  html={chapterHtml}
                  css={book.css ?? ""}
                  fontSize={fontSize}
                />
              ) : (
                <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
                  {zh ? "章节为空" : "Empty chapter"}
                </Text>
              )}
            </ScrollView>
          )}
        </Pressable>
      )}

      {/* ── Select phase: paragraph list ── */}
      {phase === "select" && (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 + insets.bottom }}>
            {blocks.map((block) => {
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
                            {block.confidence >= 0.7 ? (zh ? "高置信配方" : "Recipe") : block.confidence >= 0.5 ? (zh ? "疑似配方" : "Possible") : (zh ? "参考" : "Hint")}
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
            {candidateCount > 0 && selectedCount === 0 && (
              <Pressable onPress={() => { tap(); setBlocks((prev) => prev.map((b) => b.isCandidate && b.confidence >= 0.5 ? { ...b, selected: true } : b)); }} style={{ alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: colors.primary, fontSize: 13 }}>{zh ? `选中全部 ${candidateCount} 个候选` : `Select all ${candidateCount} candidates`}</Text>
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
          </View>
        </>
      )}

      {/* ── Confirm phase ── */}
      {phase === "confirm" && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 13, color: colors.muted }}>
              {zh ? `${reviewItems.length} 段 · ${checkedCount} 已选` : `${reviewItems.length} items · ${checkedCount} selected`}
            </Text>
            {(untranslatedChecked || anyTranslated) && (
              <Pressable onPress={doTranslate} hitSlop={6} disabled={translating}>
                <Text style={{ color: translating ? colors.muted : colors.primary, fontSize: 14, fontWeight: "600" }}>
                  {translating ? (zh ? "翻译中…" : "Translating…") : untranslatedChecked ? (zh ? "AI 翻译" : "AI Translate") : (zh ? "切换原/译文" : "Toggle")}
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
              <Text style={{ color: "#FF3B30", fontSize: 12 }}>{reviewError}</Text>
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

      {/* ── Done phase ── */}
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
            <Pressable onPress={() => { tap(); setPhase("reading"); setImportResult(null); showChrome(); }} style={({ pressed }) => [{ paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>{zh ? "继续阅读" : "Keep reading"}</Text>
            </Pressable>
            <Pressable onPress={() => { tap(); router.back(); }} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 0 }, pressed && { opacity: 0.85 }]}>
              <Text style={styles.primaryBtnText}>{zh ? "完成" : "Done"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Bottom chrome (auto-hide): chapter nav + extract button ── */}
      {chromeVisible && phase === "reading" && (
        <View style={[styles.bottomBar, { backgroundColor: colors.background + "F0", borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Progress bar */}
          <View style={{ height: 2, backgroundColor: colors.border, borderRadius: 1, marginBottom: 10, overflow: "hidden" }}>
            <View style={{ height: 2, backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%`, borderRadius: 1 }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => { tap(); setChapterIdx((i) => Math.max(0, i - 1)); }}
              disabled={chapterIdx === 0}
              style={[styles.navBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: chapterIdx === 0 ? 0.35 : 1 }]}
            >
              <IconSymbol name="chevron.left" size={16} color={colors.foreground} />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 12, color: colors.muted, textAlign: "center" }} numberOfLines={1}>
              {book.sections[chapterIdx]?.title || `${zh ? "第" : "Ch."} ${chapterIdx + 1}`}
              {" "}({chapterIdx + 1}/{totalChapters})
            </Text>
            <Pressable
              onPress={() => { tap(); setChapterIdx((i) => Math.min(totalChapters - 1, i + 1)); }}
              disabled={chapterIdx >= totalChapters - 1}
              style={[styles.navBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: chapterIdx >= totalChapters - 1 ? 0.35 : 1 }]}
            >
              <IconSymbol name="chevron.right" size={16} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={enterSelectMode}
              style={({ pressed }) => [styles.extractBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }, pressed && { opacity: 0.7 }]}
            >
              <IconSymbol name="sparkles" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                {zh ? "提取配方" : "Extract"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── TOC drawer ── */}
      {tocOpen && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)" }]} onPress={() => setTocOpen(false)} />
          <View style={[styles.tocSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.tocTitle, { color: colors.foreground }]}>{zh ? "目录" : "Table of Contents"}</Text>
            <ScrollView style={{ flex: 1 }}>
              {chapterTitles.map((title, i) => (
                <Pressable
                  key={i}
                  onPress={() => { tap(); setChapterIdx(i); setTocOpen(false); showChrome(); }}
                  style={({ pressed }) => [styles.tocRow, { borderBottomColor: colors.border }, pressed && { opacity: 0.6 }]}
                >
                  <Text style={{ fontSize: 14, color: i === chapterIdx ? colors.primary : colors.foreground, fontWeight: i === chapterIdx ? "600" : "400" }} numberOfLines={2}>
                    {title || `${zh ? "第" : "Chapter"} ${i + 1}`}
                  </Text>
                  {i === chapterIdx && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  extractBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
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
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  tocSheet: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "72%",
    maxWidth: 320,
    borderLeftWidth: 1,
    paddingTop: 16,
  },
  tocTitle: {
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  tocRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
