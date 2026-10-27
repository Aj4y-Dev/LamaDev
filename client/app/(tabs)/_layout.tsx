import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, control } from "@/theme/tokens";
import type { ColorValue } from "react-native";

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          minHeight: control.height + 8,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.projects"),
          tabBarIcon: icon("folder-outline"),
        }}
      />
      <Tabs.Screen
        name="rates"
        options={{
          title: t("tabs.rates"),
          tabBarIcon: icon("pricetags-outline"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: icon("settings-outline"),
        }}
      />
    </Tabs>
  );
}
