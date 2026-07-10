import React, { useState, useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { useBookStore, StoredBook } from "@/lib/books/store";

export default function BooksScreen() {
  const colors = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { books, ready, deleteBook } = useBookStore();

  const [sortBy, setSortBy] = useState<"importedAt" | "title" | "progress">("importedAt");
  const [filterStatus, setFilterStatus] = useState<"all" | "unread" | "reading" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const filteredAndSorted = useMemo(() => {
    let result = [...books];

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) =>
        (b.title || b.fileName).toLowerCase().includes(q) ||
        (b.author || "").toLowerCase().includes(q)
      );
    }

    // 状态过滤
    if (filterStatus !== "all") {
      result = result.filter((b) => (b.readingStatus || "unread") === filterStatus);
    }

    // 排序
    result.sort((a, b) => {
      if (sortBy === "title") {
        return (a.title || a.fileName).localeCompare(b.title || b.fileName);
      } else if (sortBy === "progress") {
        return (b.lastPosition || 0) - (a.lastPosition || 0);
      } else {
        return (b.importedAt || 0) - (a.importedAt || 0);
      }
    });

    return result;
  }, [books, sortBy, filterStatus, searchQuery]);

  const tap = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = useCallback(
    (book: StoredBook) => {
      tap();
      const title = book.title || book.fileName;
      const doDelete = () => deleteBook(book.id);
      if (Platform.OS === "web") {
        if (window.confirm(zh ? `删除《${title}》?` : `Delete "${title}"?`)) doDelete();
        return;
      }
      Alert.alert(
        zh ? "删除图书" : "Delete Book",
        zh ? `确定删除《${title}》?` : `Delete "${title}"?`,
        [
          { text: zh ? "取消" : "Cancel", style: "cancel" },
          { text: zh ? "删除" : "Delete", style: "destructive", onPress: doDelete },
        ],
      );
    },
    [deleteBook, zh],
  );

  const handleOpen = (book: StoredBook) => {
    tap();
    router.push({ pathname: "/book-reader", params: { id: book.id } });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    if (lang === "zh") {
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatFormat = (fmt: string) => {
    const map: Record<string, string> = {
      epub: "EPUB",
      pdf: "PDF",
      "scanned-epub": zh ? "图片版 EPUB" : "Image EPUB",
      "scanned-pdf": zh ? "扫描版 PDF" : "Scanned PDF",
    };
    return map[fmt] ?? fmt.toUpperCase();
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-3xl font-bold text-foreground">
              {zh ? "书库" : "Book Library"}
            </Text>
            <Text className="text-sm text-muted mt-1">
              {zh
                ? `${filteredAndSorted.length} / ${books.length} 本图书`
                : `${filteredAndSorted.length} / ${books.length} book${books.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              tap();
              router.push("/book-import");
            }}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <IconSymbol name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>{zh ? "导入图书" : "Import"}</Text>
          </Pressable>
        </View>
      </View>

      {/* 搜索栏 */}
      {books.length > 0 && (
        <View className="px-5 pb-3">
          <View
            className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2"
            style={{ gap: 8 }}
          >
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              placeholder={zh ? "搜索书名、作者..." : "Search title, author..."}
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {/* 排序和筛选按钮 */}
      {books.length > 0 && (
        <View className="px-5 pb-3 flex-row gap-2">
          <Pressable
            onPress={() => setShowSortMenu(!showSortMenu)}
            style={({ pressed }) => [
              styles.filterBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="arrow.up.arrow.down" size={14} color={colors.foreground} />
            <Text style={[styles.filterBtnText, { color: colors.foreground }]}>
              {zh ? "排序" : "Sort"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowFilterMenu(!showFilterMenu)}
            style={({ pressed }) => [
              styles.filterBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="line.3.horizontal.decrease" size={14} color={colors.foreground} />
            <Text style={[styles.filterBtnText, { color: colors.foreground }]}>
              {zh ? "筛选" : "Filter"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* 排序菜单 */}
      {showSortMenu && (
        <View className="px-5 pb-3 bg-surface rounded-lg mx-5 border border-border overflow-hidden">
          {[
            { key: "importedAt" as const, label: zh ? "导入时间" : "Import Date" },
            { key: "title" as const, label: zh ? "书名" : "Title" },
            { key: "progress" as const, label: zh ? "阅读进度" : "Progress" },
          ].map((opt, idx) => (
            <Pressable
              key={opt.key}
              onPress={() => {
                setSortBy(opt.key);
                setShowSortMenu(false);
              }}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { opacity: 0.7 },
                sortBy === opt.key && { backgroundColor: colors.primary + "18" },
                idx < 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.menuItemText, { color: sortBy === opt.key ? colors.primary : colors.foreground }]}>
                {opt.label}
              </Text>
              {sortBy === opt.key && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* 筛选菜单 */}
      {showFilterMenu && (
        <View className="px-5 pb-3 bg-surface rounded-lg mx-5 border border-border overflow-hidden">
          {[
            { key: "all" as const, label: zh ? "全部" : "All" },
            { key: "unread" as const, label: zh ? "未读" : "Unread" },
            { key: "reading" as const, label: zh ? "阅读中" : "Reading" },
            { key: "completed" as const, label: zh ? "已读" : "Completed" },
          ].map((opt, idx) => (
            <Pressable
              key={opt.key}
              onPress={() => {
                setFilterStatus(opt.key);
                setShowFilterMenu(false);
              }}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { opacity: 0.7 },
                filterStatus === opt.key && { backgroundColor: colors.primary + "18" },
                idx < 3 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.menuItemText, { color: filterStatus === opt.key ? colors.primary : colors.foreground }]}>
                {opt.label}
              </Text>
              {filterStatus === opt.key && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      {ready && books.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ marginTop: -60 }}>
          <View
            style={[styles.emptyIcon, { backgroundColor: colors.primary + "18" }]}
          >
            <IconSymbol name="book.fill" size={40} color={colors.primary} />
          </View>
          <Text className="text-xl font-semibold text-foreground mt-5">
            {zh ? "书库是空的" : "No books yet"}
          </Text>
          <Text className="text-sm text-muted text-center mt-2 leading-relaxed">
            {zh
              ? "导入 EPUB 或 PDF 格式的酒吧专业书籍,在阅读中提取配方"
              : "Import EPUB or PDF bar books to read and extract recipes"}
          </Text>
          <Pressable
            onPress={() => {
              tap();
              router.push("/book-import");
            }}
            style={({ pressed }) => [
              styles.emptyBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
          >
            <IconSymbol name="square.and.arrow.down.fill" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>{zh ? "导入第一本书" : "Import a Book"}</Text>
          </Pressable>
        </View>
      ) : filteredAndSorted.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ marginTop: -60 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted + "12" }]}>
            <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
          </View>
          <Text className="text-lg font-semibold text-foreground mt-5">
            {zh ? "没有找到" : "No Results"}
          </Text>
          <Text className="text-sm text-muted text-center mt-2">
            {zh ? "尝试调整搜索或筛选条件" : "Try adjusting your search or filter"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAndSorted}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 100,
          }}
          renderItem={({ item: book, index }) => (
            <Pressable
              onPress={() => handleOpen(book)}
              onLongPress={() => handleDelete(book)}
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <View
                style={[
                  styles.bookCard,
                  { backgroundColor: colors.surface },
                  index === 0 && { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
                  index === filteredAndSorted.length - 1 && {
                    borderBottomLeftRadius: 14,
                    borderBottomRightRadius: 14,
                  },
                ]}
              >
                {/* Cover icon */}
                <View
                  style={[
                    styles.coverIcon,
                    { backgroundColor: bookColor(book.id) + "28" },
                  ]}
                >
                  <IconSymbol name="book.fill" size={28} color={bookColor(book.id)} />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text
                    style={[styles.bookTitle, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {book.title || book.fileName}
                  </Text>
                  {book.author && (
                    <Text style={[styles.bookAuthor, { color: colors.muted }]} numberOfLines={1}>
                      {book.author}
                    </Text>
                  )}
                  <Text style={[styles.bookMeta, { color: colors.muted }]} numberOfLines={1}>
                    {formatFormat(book.format)} · {zh ? `${book.sectionCount} 章节` : `${book.sectionCount} sections`}
                  </Text>
                  <Text style={[styles.bookDate, { color: colors.muted }]}>
                    {zh ? `导入于 ${formatDate(book.importedAt)}` : `Imported ${formatDate(book.importedAt)}`}
                  </Text>

                  {/* Reading progress */}
                  {book.lastPosition > 0 ? (
                    <View style={styles.progressRow}>
                      <View
                        style={[styles.progressTrack, { backgroundColor: colors.border }]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: colors.primary,
                              width: `${Math.min(100, Math.round((book.lastPosition / Math.max(1, book.sectionCount * 4)) * 100))}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressLabel, { color: colors.muted }]}>
                        {zh ? "继续阅读" : "Continue"}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ justifyContent: "center", paddingLeft: 8 }}>
                  <IconSymbol name="chevron.right" size={16} color={colors.border} />
                </View>
              </View>
              {index < filteredAndSorted.length - 1 && (
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <View
                    style={[
                      styles.separatorLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

/** Deterministic color per book id */
function bookColor(id: string): string {
  const palette = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 24,
  },
  emptyBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },
  bookCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  coverIcon: {
    width: 56,
    height: 72,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  bookAuthor: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  bookMeta: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  bookDate: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  separator: {
    height: 1,
  },
  separatorLine: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 86,
  },
});
