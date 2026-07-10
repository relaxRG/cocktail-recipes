import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { useCardTagSettings, DEFAULT_CARD_TAG_SETTINGS, CardTagSettings } from "@/lib/settings/card-tags";

export default function CardTagSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const [settings, setSettings] = useCardTagSettings();

  const tap = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggle = (key: keyof CardTagSettings) => {
    tap();
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setMax = (n: number) => {
    tap();
    setSettings((prev) => ({ ...prev, maxTagsPerCard: n }));
  };

  const reset = () => {
    tap();
    setSettings(DEFAULT_CARD_TAG_SETTINGS);
  };

  const ROW_H = 50;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );

  const ToggleRow = ({
    label,
    sub,
    value,
    onToggle,
    last,
  }: {
    label: string;
    sub?: string;
    value: boolean;
    onToggle: () => void;
    last?: boolean;
  }) => (
    <>
      <View style={[styles.row, { height: sub ? 56 : ROW_H }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
          {sub ? <Text style={[styles.rowSub, { color: colors.muted }]}>{sub}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>
      {!last && <View style={[styles.divider, { backgroundColor: colors.border, marginLeft: 16 }]} />}
    </>
  );

  const MAX_OPTIONS = [1, 2, 3, 4, 5, 0];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {zh ? "卡片标签显示" : "Card Tag Display"}
        </Text>
        <Pressable onPress={reset} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "500" }}>
            {zh ? "重置" : "Reset"}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Bottle card fields */}
        <Section title={zh ? "酒款卡片信息" : "Bottle Card Fields"}>
          <ToggleRow label={zh ? "风味标签" : "Flavor Tags"} sub={zh ? "AI 识别或手动添加的风味词" : "AI-detected or manual flavor tags"} value={settings.showBottleFlavorTags} onToggle={() => toggle("showBottleFlavorTags")} />
          <ToggleRow label={zh ? "风格子分类" : "Style"} value={settings.showBottleStyle} onToggle={() => toggle("showBottleStyle")} />
          <ToggleRow label={zh ? "度数 ABV" : "ABV"} value={settings.showBottleAbv} onToggle={() => toggle("showBottleAbv")} />
          <ToggleRow label={zh ? "容量规格" : "Volume"} value={settings.showBottleVolume} onToggle={() => toggle("showBottleVolume")} />
          <ToggleRow label={zh ? "产地" : "Origin"} value={settings.showBottleOrigin} onToggle={() => toggle("showBottleOrigin")} />
          <ToggleRow label={zh ? "评分" : "Rating"} value={settings.showBottleRating} onToggle={() => toggle("showBottleRating")} last />
        </Section>

        {/* Homemade card */}
        <Section title={zh ? "自制卡片信息" : "Homemade Card Fields"}>
          <ToggleRow label={zh ? "风味标签" : "Flavor Tags"} value={settings.showHomemadeTags} onToggle={() => toggle("showHomemadeTags")} last />
        </Section>

        {/* Max tags per card */}
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>
            {zh ? "每张卡片最多显示几个标签" : "Max tags per card"}
          </Text>
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 }]}>
            {MAX_OPTIONS.map((n) => {
              const active = settings.maxTagsPerCard === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setMax(n)}
                  style={[
                    styles.maxChip,
                    { backgroundColor: active ? colors.primary : "transparent", borderColor: active ? colors.primary : colors.border },
                  ]}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#FFF" : colors.foreground }}>
                    {n === 0 ? (zh ? "全部" : "All") : n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {zh ? '设为"全部"则显示所有风味标签，不受数量限制' : 'Set to "All" to show all flavor tags with no limit'}
          </Text>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
    marginLeft: 4,
  },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "400",
  },
  rowSub: {
    fontSize: 12,
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  maxChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 48,
    alignItems: "center",
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    lineHeight: 17,
  },
});
