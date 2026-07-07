import React, { useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useRecipeStore } from "@/lib/recipes/store";
import { CATEGORY_COLORS, Category } from "@/lib/recipes/types";

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { categories, recipes, addCategory, renameCategory, deleteCategory } = useRecipeStore();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const countFor = (id: string) => recipes.filter((r) => r.categoryId === id).length;

  const handleAdd = () => {
    const created = addCategory(newName, newColor);
    if (created) {
      setNewName("");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const confirmDelete = (cat: Category) => {
    const count = countFor(cat.id);
    const message =
      count > 0
        ? `「${cat.name}」下有 ${count} 份配方,删除后它们将变为未分类。`
        : `确定删除「${cat.name}」吗?`;
    const doDelete = () => deleteCategory(cat.id);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) doDelete();
      return;
    }
    Alert.alert("删除分类", message, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: doDelete },
    ]);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const commitEdit = () => {
    if (editingId && editingName.trim()) {
      renameCategory(editingId, editingName);
    }
    setEditingId(null);
    setEditingName("");
  };

  return (
    <ScreenContainer>
      <View className="px-5 pt-2 pb-3">
        <Text className="text-3xl font-bold text-foreground">分类</Text>
        <Text className="text-sm text-muted mt-1">管理你的配方分类</Text>
      </View>

      {/* Add new category */}
      <View className="px-5 pb-4">
        <View className="bg-surface border border-border rounded-2xl p-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-base text-foreground"
              placeholder="新分类名称"
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
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 + insets.bottom }}
        ListEmptyComponent={
          <View className="items-center pt-12 px-8">
            <Text className="text-base text-muted text-center">
              还没有分类,在上方创建一个吧
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const count = countFor(item.id);
          const isEditing = editingId === item.id;
          return (
            <View className="bg-surface border border-border rounded-2xl px-4 py-3 mb-2.5 flex-row items-center">
              <View style={[styles.colorDot, { backgroundColor: item.color, marginRight: 12 }]} />
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
                  <Text className="text-xs text-muted mt-0.5">{count} 份配方</Text>
                </View>
              )}
              <View className="flex-row items-center" style={{ gap: 16, marginLeft: 8 }}>
                {isEditing ? (
                  <Pressable onPress={commitEdit} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                    <IconSymbol name="checkmark" size={22} color={colors.primary} />
                  </Pressable>
                ) : (
                  <Pressable onPress={() => startEdit(item)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                    <IconSymbol name="pencil" size={20} color={colors.muted} />
                  </Pressable>
                )}
                <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <IconSymbol name="trash.fill" size={20} color={colors.error} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
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
});

