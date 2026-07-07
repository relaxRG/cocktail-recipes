import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.recipes"),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="wineglass.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bottles"
        options={{
          title: t("tab.bottles"),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="books.vertical.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="homemade"
        options={{
          title: t("tab.homemade"),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="flask.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t("tab.me"),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
