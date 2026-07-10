import React, { useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
      <View className="px-5 pt-2 pb-3">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-3xl font-bold text-foreground">
              {zh ? "书库" : "Book Library"}
            </Text>
            <Text className="text-sm text-muted mt-1">
              {zh
                ? `${books.length} 本图书`
                : `${books.length} book${books.length !== 1 ? "s" : ""}`}
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
      ) : (
        <FlatList
          data={books}
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
                  index === books.length - 1 && {
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
              {index < books.length - 1 && (
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
    height: StyleSheet.hairlineWidth,
  },
  separatorLine: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 86,
  },
});
