import "@/i18n";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_600SemiBold,
} from "@expo-google-fonts/noto-sans-devanagari";
import { queryClient } from "@/lib/queryClient";
import { loadSavedLanguage } from "@/i18n";
import { registerUnauthorizedHandler } from "@/api/client";
import { useAuthStore } from "@/features/auth/authStore";
import { logoutAll } from "@/features/auth/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { colors } from "@/theme/tokens";

registerUnauthorizedHandler(() => {
  void logoutAll();
});

function useAuthGate() {
  const token = useAuthStore((s) => s.token);
  const ready = useAuthStore((s) => s.ready);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_SKIP_AUTH === "true") {
      if (ready && segments[0] === "(auth)") router.replace("/");
      return;
    }
    if (!ready) return;
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) router.replace("/login");
    else if (token && inAuth) router.replace("/");
  }, [token, ready, segments, router]);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_600SemiBold,
  });
  const ready = useAuthStore((s) => s.ready);
  useEffect(() => {
    void useAuthStore.getState().hydrate();
    void loadSavedLanguage();
  }, []);
  useAuthGate();
  if (!fontsLoaded || !ready)
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
