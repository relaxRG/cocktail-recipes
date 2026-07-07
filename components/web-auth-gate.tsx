import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useSync } from "@/lib/sync/provider";
import { useI18n } from "@/lib/i18n";

/**
 * 网页端访问门(私人应用):
 * - web 未登录 → 全屏 Apple 风登录页
 * - 已登录但非 owner → 拒绝页
 * - 原生 App 不拦截(本地可用,登录后同步)
 */
export function WebAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authLoading, accessAllowed, login, logout, user } = useSync();
  const { t } = useI18n();

  if (Platform.OS !== "web") return <>{children}</>;

  if (authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <View className="w-full max-w-md items-center">
          <Text className="text-6xl mb-6">🍸</Text>
          <Text className="text-4xl font-bold text-foreground text-center tracking-tight">
            {t("gate.title")}
          </Text>
          <Text className="text-base text-muted text-center mt-3 leading-relaxed">
            {t("gate.subtitle")}
          </Text>
          <Pressable
            onPress={login}
            style={({ pressed }) => ({
              marginTop: 32,
              paddingHorizontal: 40,
              paddingVertical: 14,
              borderRadius: 980,
              backgroundColor: "#0071e3",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text className="text-white text-base font-semibold">{t("gate.login")}</Text>
          </Pressable>
          <Text className="text-xs text-muted mt-6">{t("gate.private")}</Text>
        </View>
      </View>
    );
  }

  if (accessAllowed === false) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <View className="w-full max-w-md items-center">
          <Text className="text-5xl mb-6">🔒</Text>
          <Text className="text-3xl font-bold text-foreground text-center">
            {t("gate.denied.title")}
          </Text>
          <Text className="text-base text-muted text-center mt-3 leading-relaxed">
            {t("gate.denied.subtitle")}
            {user?.email ? ` (${user.email})` : ""}
          </Text>
          <Pressable
            onPress={() => void logout()}
            style={({ pressed }) => ({
              marginTop: 24,
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: 980,
              borderWidth: 1,
              borderColor: "#0071e3",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: "#0071e3", fontSize: 15, fontWeight: "600" }}>
              {t("gate.switchAccount")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}
