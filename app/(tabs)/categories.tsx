import React, { useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useRecipeStore } from "@/lib/recipes/store";
import { CATEGORY_COLORS, TagKind } from "@/lib/recipes/types";

type SectionKey = "category" | TagKind;

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: "category", label: "分类", hint: "配方所属的自定义分类" },
  { key: "spirit", label: "基酒", hint: "表单中可选的基酒标签" },
  { key: "glass", label: "杯型", hint: "表单中可选的杯型标签" },
  { key: "flavor", label: "风味", hint: "表单中可多选的风味标签" },
];

interface RowData {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    categories,
    recipes,
    tags,
    addCategory,
    renameCategory,
    setCategoryColor,
    deleteCategory,
    addTag,
    renameTag,
    setTagColor,
    deleteTag,
  } = useRecipeStore();

  const [section, setSection] = useState<SectionKey>("category");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

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

  const sectionLabel = SECTIONS.find((s) => s.key === section)!.label;

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
    let message = `确定删除「${row.name}」吗?`;
    if (section === "category" && row.count > 0) {
      message = `「${row.name}」下有 ${row.count} 份配方,删除后它们将变为未分类。`;
    } else if (section === "flavor" && row.count > 0) {
      message = `「${row.name}」被 ${row.count} 份配方使用,删除后将从这些配方中移除。`;
    } else if ((section === "spirit" || section === "glass") && row.count > 0) {
      message = `「${row.name}」被 ${row.count} 份配方使用,删除标签不会修改这些配方的文字记录。`;
    }
    const doDelete = () =>
      section === "category" ? deleteCategory(row.id) : deleteTag(row.id);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) doDelete();
      return;
    }
    Alert.alert(`删除${sectionLabel}`, message, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: doDelete },
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
        <Text className="text-3xl font-bold text-foreground">标签管理</Text>
        <Text className="text-sm text-muted mt-1">
          自定义分类、基酒、杯型与风味标签
        </Text>
      </View>

      {/* Section switcher */}
      <View className="px-5 pb-3">
        <View className="flex-row bg-surface border border-border rounded-xl p-1">
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => {
                  setSection(s.key);
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
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add new */}
        <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
              placeholder={`新${sectionLabel}名称`}
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
              还没有{sectionLabel}标签,在上方创建一个吧
            </Text>
          </View>
        ) : (
          rows.map((item) => {
            const isEditing = editingId === item.id;
            const showPicker = colorPickerId === item.id;
            return (
              <View
                key={item.id}
                className="bg-surface border border-border rounded-2xl px-4 py-3 mb-2.5"
              >
                <View className="flex-row items-center">
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
                      <Text className="text-xs text-muted mt-0.5">{item.count} 份配方</Text>
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
            );
          })
        )}

        <Text className="text-xs text-muted mt-2 px-1" style={{ lineHeight: 18 }}>
          点击色点可为标签更换颜色;新增的标签会出现在配方表单与首页筛选中。
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
});
