import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { useRecipeStore } from "@/lib/recipes/store";
import { CATEGORY_COLORS, TagKind } from "@/lib/recipes/types";

type SectionKey = "category" | TagKind;

const SECTION_KEYS: SectionKey[] = ["category", "spirit", "glass", "flavor"];
const SECTION_LABEL_KEY = {
  category: "tags.section.category",
  spirit: "tags.section.spirit",
  glass: "tags.section.glass",
  flavor: "tags.section.flavor",
} as const;

interface RowData {
  id: string;
  name: string;
  color: string;
  count: number;
}

/** 行高(含 mb-2.5 间距),用于拖拽位移换算 */
const ROW_HEIGHT = 61;

function DraggableRow({
  index,
  total,
  onMove,
  onDragStateChange,
  children,
}: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onDragStateChange: (dragging: boolean) => void;
  children: React.ReactNode;
}) {
  const translateY = useSharedValue(0);
  const active = useSharedValue(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      active.value = true;
      runOnJS(onDragStateChange)(true);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const delta = Math.round(e.translationY / ROW_HEIGHT);
      const to = Math.max(0, Math.min(total - 1, index + delta));
      translateY.value = 0;
      active.value = false;
      runOnJS(onDragStateChange)(false);
      if (to !== index) {
        runOnJS(onMove)(index, to);
      }
    })
    .onFinalize(() => {
      translateY.value = 0;
      active.value = false;
      runOnJS(onDragStateChange)(false);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: withTiming(active.value ? 1.03 : 1, { duration: 120 }) },
    ],
    zIndex: active.value ? 10 : 0,
    opacity: withTiming(active.value ? 0.92 : 1, { duration: 120 }),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const {
    categories,
    recipes,
    tags,
    addCategory,
    renameCategory,
    setCategoryColor,
    deleteCategory,
    reorderCategories,
    addTag,
    renameTag,
    setTagColor,
    deleteTag,
    reorderTags,
  } = useRecipeStore();

  const [section, setSection] = useState<SectionKey>("category");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const rows: RowData[] = useMemo(() => {
    if (section === "category") {
      return categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        count: recipes.filter((r) => r.categoryId === c.id).length,
      }));
    }
    return tags
      .filter((t) => t.kind === section)
      .map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        count:
          section === "spirit"
            ? recipes.filter((r) => r.baseSpirit === t.name).length
            : section === "glass"
              ? recipes.filter((r) => r.glass === t.name).length
              : recipes.filter((r) => r.flavors.includes(t.name)).length,
      }));
  }, [section, categories, tags, recipes]);

  const sectionLabel = t(SECTION_LABEL_KEY[section]);

  const applyOrder = useCallback(
    (orderedIds: string[]) => {
      if (section === "category") reorderCategories(orderedIds);
      else reorderTags(section, orderedIds);
    },
    [section, reorderCategories, reorderTags],
  );

  const moveRow = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= rows.length || fromIndex === toIndex) return;
      const ids = rows.map((r) => r.id);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      applyOrder(ids);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [rows, applyOrder],
  );

  const handleAdd = () => {
    const created =
      section === "category"
        ? addCategory(newName, newColor)
        : addTag(section, newName, newColor);
    if (created) {
      setNewName("");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const confirmDelete = (row: RowData) => {
    let message = t("tags.delete.confirm", { name: row.name });
    if (section === "category" && row.count > 0) {
      message =
        lang === "zh"
          ? `「${row.name}」下有 ${row.count} 份配方,删除后它们将变为未分类。`
          : `"${row.name}" has ${row.count} recipes. They will become uncategorized.`;
    } else if (section === "flavor" && row.count > 0) {
      message =
        lang === "zh"
          ? `「${row.name}」被 ${row.count} 份配方使用,删除后将从这些配方中移除。`
          : `"${row.name}" is used by ${row.count} recipes and will be removed from them.`;
    } else if ((section === "spirit" || section === "glass") && row.count > 0) {
      message =
        lang === "zh"
          ? `「${row.name}」被 ${row.count} 份配方使用,删除标签不会修改这些配方的文字记录。`
          : `"${row.name}" is used by ${row.count} recipes. Deleting the tag won't change their text.`;
    }
    const doDelete = () =>
      section === "category" ? deleteCategory(row.id) : deleteTag(row.id);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) doDelete();
      return;
    }
    Alert.alert(t("tags.delete.title", { s: sectionLabel }), message, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: doDelete },
    ]);
  };

  const commitEdit = () => {
    if (editingId && editingName.trim()) {
      if (section === "category") renameCategory(editingId, editingName);
      else renameTag(editingId, editingName);
    }
    setEditingId(null);
    setEditingName("");
  };

  const pickColor = (rowId: string, color: string) => {
    if (section === "category") setCategoryColor(rowId, color);
    else setTagColor(rowId, color);
    setColorPickerId(null);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <ScreenContainer>
      <View className="px-5 pt-2 pb-3">
        <Text className="text-3xl font-bold text-foreground">{t("tags.title")}</Text>
        <Text className="text-sm text-muted mt-1">
          {t("tags.subtitle")}
        </Text>
      </View>

      {/* Language setting */}
      <View className="px-5 pb-3">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3">
          <Text className="flex-1 text-base text-foreground">{t("common.language")}</Text>
          <View className="flex-row bg-background rounded-lg p-0.5" style={{ gap: 2 }}>
            {(["zh", "en"] as const).map((l) => (
              <Pressable
                key={l}
                onPress={() => setLang(l)}
                style={[
                  styles.langSeg,
                  lang === l && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.langSegText,
                    { color: lang === l ? "#FFFFFF" : colors.muted },
                  ]}
                >
                  {l === "zh" ? "中文" : "English"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Section switcher */}
      <View className="px-5 pb-3">
        <View className="flex-row bg-surface border border-border rounded-xl p-1">
          {SECTION_KEYS.map((key) => {
            const active = section === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setSection(key);
                  setEditingId(null);
                  setColorPickerId(null);
                }}
                style={[
                  styles.segment,
                  active && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? "#FFFFFF" : colors.muted },
                  ]}
                >
                  {t(SECTION_LABEL_KEY[key])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={draggingId === null}
      >
        {/* Add new */}
        <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
              placeholder={t("tags.new.placeholder", { s: sectionLabel })}
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={setNewName}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
              style={{ lineHeight: 20 }}
            />
            <Pressable
              onPress={handleAdd}
              disabled={!newName.trim()}
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: newName.trim() ? colors.primary : colors.border },
                pressed && newName.trim() && { transform: [{ scale: 0.95 }], opacity: 0.9 },
              ]}
            >
              <IconSymbol name="plus" size={22} color={newName.trim() ? "#FFFFFF" : colors.muted} />
            </Pressable>
          </View>
          <View className="flex-row mt-3" style={{ gap: 10 }}>
            {CATEGORY_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setNewColor(c)} hitSlop={4}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    newColor === c && { borderWidth: 2, borderColor: colors.foreground },
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {rows.length === 0 ? (
          <View className="items-center pt-12 px-8">
            <Text className="text-base text-muted text-center">
              {t("tags.empty", { s: sectionLabel })}
            </Text>
          </View>
        ) : (
          <View className="bg-surface rounded-xl overflow-hidden">
          {rows.map((item, index) => {
            const isEditing = editingId === item.id;
            const showPicker = colorPickerId === item.id;
            return (
              <DraggableRow
                key={item.id}
                index={index}
                total={rows.length}
                onMove={moveRow}
                onDragStateChange={(dragging) => setDraggingId(dragging ? item.id : null)}
              >
              <View
                className="bg-surface px-4 py-2.5"
                style={draggingId === item.id ? { backgroundColor: colors.primary + "14" } : undefined}
              >
                <View className="flex-row items-center">
                  <View style={{ marginRight: 10 }}>
                    <IconSymbol name="line.3.horizontal" size={18} color={colors.muted} />
                  </View>
                  <Pressable
                    onPress={() => setColorPickerId(showPicker ? null : item.id)}
                    hitSlop={6}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: item.color, marginRight: 12 },
                      ]}
                    />
                  </Pressable>
                  {isEditing ? (
                    <TextInput
                      className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-base text-foreground"
                      value={editingName}
                      onChangeText={setEditingName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={commitEdit}
                      onBlur={commitEdit}
                      style={{ lineHeight: 20 }}
                    />
                  ) : (
                    <View className="flex-1">
                      <Text className="text-base font-medium text-foreground">{item.name}</Text>
                      <Text className="text-xs text-muted mt-0.5">{t("tags.count", { n: item.count })}</Text>
                    </View>
                  )}
                  <View className="flex-row items-center" style={{ gap: 16, marginLeft: 8 }}>
                    {isEditing ? (
                      <Pressable onPress={commitEdit} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                        <IconSymbol name="checkmark" size={22} color={colors.primary} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setEditingId(item.id);
                          setEditingName(item.name);
                        }}
                        hitSlop={8}
                        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                      >
                        <IconSymbol name="pencil" size={20} color={colors.muted} />
                      </Pressable>
                    )}
                    <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                      <IconSymbol name="trash.fill" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
                {showPicker ? (
                  <View className="flex-row mt-3 pt-3 border-t border-border" style={{ gap: 10 }}>
                    {CATEGORY_COLORS.map((c) => (
                      <Pressable key={c} onPress={() => pickColor(item.id, c)} hitSlop={4}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: c },
                            item.color === c && { borderWidth: 2, borderColor: colors.foreground },
                          ]}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              {index < rows.length - 1 ? (
                <View
                  className="bg-border"
                  style={{ height: StyleSheet.hairlineWidth, marginLeft: 58 }}
                />
              ) : null}
              </DraggableRow>
            );
          })}
          </View>
        )}

        <Text className="text-xs text-muted mt-2 px-1" style={{ lineHeight: 18 }}>
          {t("tags.hint")}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  langSeg: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langSegText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
