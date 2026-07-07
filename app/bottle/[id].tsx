import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useBottleStore } from "@/lib/bottles/store";

export default function BottleDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBottle, deleteBottle } = useBottleStore();
  const bottle = getBottle(id);

  if (!bottle) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <Text className="text-base text-muted">酒款不存在或已被删除</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>返回</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const handleDelete = () => {
    const doDelete = () => {
      deleteBottle(bottle.id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    };
    if (Platform.OS === "web") {
      if (window.confirm(`确定删除「${bottle.nameZh}」吗?`)) doDelete();
    } else {
      Alert.alert("删除酒款", `确定删除「${bottle.nameZh}」吗?`, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: "英文名", value: bottle.nameEn || "—" },
    { label: "分类", value: bottle.category },
    { label: "品牌", value: bottle.brand || "—" },
    { label: "产地", value: bottle.origin || "—" },
    { label: "规格", value: bottle.volume || "—" },
    { label: "酒精度", value: `${bottle.abv}% vol` },
    {
      label: "中国参考价",
      value: bottle.priceCny > 0 ? `¥${bottle.priceCny}` : "未知",
    },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-1 pb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="chevron.left" size={26} color={colors.foreground} />
        </Pressable>
        <View className="flex-1" />
        <Pressable
          onPress={() =>
            router.push({ pathname: "/bottle-form", params: { id: bottle.id } })
          }
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }, { marginRight: 18 }]}
        >
          <IconSymbol name="pencil" size={22} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="trash.fill" size={22} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text className="text-3xl font-bold text-foreground" style={{ lineHeight: 40 }}>
          {bottle.nameZh}
        </Text>
        {bottle.nameEn ? (
          <Text className="text-base text-muted mt-1">{bottle.nameEn}</Text>
        ) : null}

        <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={{ letterSpacing: 0.4, lineHeight: 18 }}>
          基本信息
        </Text>
        <View className="bg-surface rounded-xl px-4">
          {rows.map((row, idx) => (
            <View
              key={row.label}
              className="flex-row items-center justify-between py-2.5"
              style={
                idx < rows.length - 1
                  ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
                  : undefined
              }
            >
              <Text className="text-[15px] text-foreground">{row.label}</Text>
              <Text className="text-[15px] text-muted" style={{ maxWidth: "65%" }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {bottle.notes ? (
          <>
            <Text className="text-[13px] text-muted uppercase mt-6 mb-2 px-4" style={{ letterSpacing: 0.4, lineHeight: 18 }}>
              备注
            </Text>
            <View className="bg-surface rounded-xl px-4 py-3">
              <Text className="text-[15px] text-foreground" style={{ lineHeight: 22 }}>
                {bottle.notes}
              </Text>
            </View>
          </>
        ) : null}

        <Text className="text-xs text-muted mt-4 px-1" style={{ lineHeight: 18 }}>
          价格为中国市场常见参考价,会随渠道与时间波动。
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
