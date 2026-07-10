/**
 * 酒库 + 自制一体化标签页
 * 顶部分段控制器切换 酒库 / 自制 两个子视图。
 * 两个子视图始终挂载(保留筛选/滚动状态),用 display:none 切换可见性。
 */
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets, SafeAreaInsetsContext } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { usePersistedState } from "@/hooks/use-persisted-state";
import BottlesScreen from "./bottles";
import HomemadeScreen from "./homemade";

type LibTab = "bottles" | "homemade";

export default function LibraryScreen() {
  const colors = useColors();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = usePersistedState<LibTab>("library.tab.v1", "bottles");

  const TABS: { key: LibTab; zh: string; en: string }[] = [
    { key: "bottles", zh: "酒库", en: "Bar" },
    { key: "homemade", zh: "自制库", en: "Homemade" },
  ];

  const handleSwitch = (key: LibTab) => {
    if (key === tab) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab(key);
  };

  // Override top inset to 0 for child screens — this screen manages the safe-area top itself
  const childInsets = { ...insets, top: 0 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 顶部安全区 + Segment */}
      <View
        style={[
          styles.segWrap,
          { paddingTop: insets.top + 8, backgroundColor: colors.background },
        ]}
      >
        <View
          style={[styles.segRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => handleSwitch(item.key)}
                style={[styles.seg, active && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.segText, { color: active ? "#FFFFFF" : colors.muted }]}>
                  {lang === "en" ? item.en : item.zh}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 子屏:用 SafeAreaInsetsContext.Provider 覆盖 top=0,避免双重 safe-area */}
      <SafeAreaInsetsContext.Provider value={childInsets}>
        <View style={[{ flex: 1 }, tab !== "bottles" && styles.hidden]}>
          <BottlesScreen />
        </View>
        <View style={[{ flex: 1 }, tab !== "homemade" && styles.hidden]}>
          <HomemadeScreen />
        </View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  segWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  segRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  hidden: {
    display: "none",
  },
});
