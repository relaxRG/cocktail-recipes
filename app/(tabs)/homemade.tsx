import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { filterPreps, useHomemadeStore } from "@/lib/homemade/store";
import { HomemadePrep, PREP_TYPES, prepTypeLabel } from "@/lib/homemade/types";

export default function HomemadeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { ready, preps, importSamples } = useHomemadeStore();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("");

  const filtered = useMemo(
    () => filterPreps(preps, query, type || undefined),
    [preps, query, type],
  );

  const usedTypes = useMemo(() => {
    const present = new Set(preps.map((p) => p.type));
    return PREP_TYPES.filter((pt) => present.has(pt.key));
  }, [preps]);

  const handleAdd = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/homemade-form");
  };

  const handleImport = () => {
    const n = importSamples();
    if (Platform.OS !== "web" && n > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const chipStyle = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? colors.primary : colors.surface,
      borderColor: active ? colors.primary : colors.border,
    },
  ];
  const chipTextStyle = (active: boolean) => [
    styles.chipText,
    { color: active ? "#FFFFFF" : colors.foreground },
  ];

  return (
    <ScreenContainer>
      <View className="px-5 pt-2 pb-1">
        <Text className="text-3xl font-bold text-foreground">{t("hm.title")}</Text>
        <Text className="text-sm text-muted mt-1">{t("hm.subtitle", { n: preps.length })}</Text>
      </View>

      {/* Search */}
      <View className="px-5 mt-2">
        <View
          className="flex-row items-center bg-surface border border-border rounded-xl px-3"
          style={{ height: 44 }}
        >
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            className="flex-1 ml-2 text-base text-foreground"
            placeholder={t("hm.search.placeholder")}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            style={{ lineHeight: 20 }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Type filter */}
      {usedTypes.length > 0 ? (
        <View style={styles.chipRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable style={chipStyle(type === "")} onPress={() => setType("")}>
              <Text style={chipTextStyle(type === "")}>{t("home.filter.all")}</Text>
            </Pressable>
            {usedTypes.map((pt) => {
              const active = type === pt.key;
              return (
                <Pressable
                  key={pt.key}
                  style={chipStyle(active)}
                  onPress={() => setType(active ? "" : pt.key)}
                >
                  <Text style={chipTextStyle(active)}>{lang === "en" ? pt.en : pt.zh}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {ready && filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ marginTop: -40 }}>
          <Text style={{ fontSize: 48, lineHeight: 64 }}>🧪</Text>
          <Text className="text-xl font-semibold text-foreground mt-3">
            {preps.length === 0 ? t("hm.empty.title") : t("hm.noMatch")}
          </Text>
          {preps.length === 0 ? (
            <>
              <Text className="text-sm text-muted text-center mt-2 leading-relaxed">
                {t("hm.empty.desc")}
              </Text>
              <Pressable
                onPress={handleImport}
                style={({ pressed }) => [
                  styles.importBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <IconSymbol name="sparkles" size={16} color="#FFFFFF" />
                <Text style={styles.importBtnText}>{t("hm.empty.import")}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 90 + insets.bottom,
          }}
          renderItem={({ item, index }) => (
            <PrepRow
              prep={item}
              isFirst={index === 0}
              isLast={index === filtered.length - 1}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, bottom: 20 },
          pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
        ]}
      >
        <IconSymbol name="plus" size={26} color="#FFFFFF" />
      </Pressable>
    </ScreenContainer>
  );
}

function PrepRow({
  prep,
  isFirst,
  isLast,
}: {
  prep: HomemadePrep;
  isFirst: boolean;
  isLast: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/homemade/[id]", params: { id: prep.id } })}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <View
        className="bg-surface px-4 py-3"
        style={[
          isFirst && { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
          isLast && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
        ]}
      >
        <View className="flex-row items-center">
          <View className="flex-1 pr-2">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {prep.name}
            </Text>
            {prep.nameAlt ? (
              <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                {prep.nameAlt}
              </Text>
            ) : null}
            <View className="flex-row items-center mt-1.5" style={{ gap: 6, flexWrap: "wrap" }}>
              <View style={[styles.badge, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {prepTypeLabel(prep.type, lang)}
                </Text>
              </View>
              {prep.shelfLife ? (
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {prep.shelfLife}
                </Text>
              ) : null}
            </View>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.border} />
        </View>
      </View>
      {!isLast ? (
        <View className="bg-surface" style={{ height: StyleSheet.hairlineWidth }}>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.border,
              marginLeft: 16,
            }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipRowWrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 21,
    marginTop: 16,
  },
  importBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
