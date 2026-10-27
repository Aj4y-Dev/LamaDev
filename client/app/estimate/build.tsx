import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/States";
import { ApiError } from "@/api/client";
import { EntryCard } from "@/features/estimates/EntryCard";
import { useDraftStore } from "@/features/estimates/draftStore";
import { useGenerate } from "@/features/estimates/useGenerate";
import { useNetwork } from "@/hooks/useNetwork";
import { colors, radii, spacing } from "@/theme/tokens";

export default function Build() {
  const { projectId, fresh } = useLocalSearchParams<{
    projectId?: string;
    fresh?: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const entries = useDraftStore((s) => s.entries);
  const generate = useGenerate();
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (fresh === "1" && projectId) useDraftStore.getState().begin(projectId);
  }, [fresh, projectId]);

  const requestBack = useCallback(() => {
    if (useDraftStore.getState().entries.length === 0) return false;
    setLeaving(true);
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        requestBack,
      );
      return () => sub.remove();
    }, [requestBack]),
  );

  const run = () =>
    generate.mutate(undefined, {
      onSuccess: () => router.replace("/estimate/result"),
    });
  const canGenerate =
    entries.length > 0 &&
    entries.every((e) => e.photos.length > 0) &&
    isOnline &&
    !generate.isPending;
  const cancelled =
    generate.error instanceof ApiError && generate.error.code === "CANCELLED";

  if (generate.isPending) {
    const p = generate.progress;
    const pct = !p
      ? 0
      : p.step === "calculating"
        ? 100
        : Math.round(((p.current - 1) / p.total) * 100);
    return (
      <Screen
        title={t("estimate.title")}
        scroll={false}
        footer={
          <Button
            variant="secondary"
            title={t("common.cancel")}
            onPress={generate.cancel}
          />
        }
      >
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="title" bold style={styles.center}>
            {p?.step === "reading"
              ? t("estimate.reading", { current: p.current, total: p.total })
              : t("estimate.calculating")}
          </AppText>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <AppText muted style={styles.center}>
            {t("estimate.keepOpen")}
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={t("estimate.title")}
      subtitle={t("estimate.subtitle")}
      onBack={() => {
        if (!requestBack()) router.back();
      }}
      footer={
        <>
          {!isOnline ? (
            <AppText variant="caption" muted>
              {t("common.offlineHint")}
            </AppText>
          ) : null}
          {entries.some((e) => e.photos.length === 0) ? (
            <AppText variant="caption" color={colors.error}>
              {t("estimate.needPhotos")}
            </AppText>
          ) : null}
          <Button
            icon="flash-outline"
            title={t("estimate.generate")}
            disabled={!canGenerate}
            onPress={run}
          />
        </>
      }
    >
      {generate.isError && !cancelled ? (
        <ErrorState error={generate.error} onRetry={run} />
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title={t("estimate.emptyTitle")}
          body={t("estimate.emptyBody")}
        />
      ) : (
        entries.map((e) => (
          <EntryCard
            key={e.key}
            entry={e}
            onPress={() =>
              router.push({
                pathname: "/estimate/add",
                params: { entry: e.key },
              })
            }
            onDelete={() => setDeleteKey(e.key)}
          />
        ))
      )}

      <Button
        variant="secondary"
        icon="add"
        title={t("estimate.addWork")}
        onPress={() => router.push("/estimate/add")}
      />

      <ConfirmDialog
        visible={deleteKey !== null}
        destructive
        title={t("estimate.removeTitle")}
        body={t("estimate.removeBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteKey(null)}
        onConfirm={() => {
          if (deleteKey) useDraftStore.getState().removeEntry(deleteKey);
          setDeleteKey(null);
        }}
      />

      <ConfirmDialog
        visible={leaving}
        destructive
        title={t("estimate.discardTitle")}
        body={t("estimate.discardBody")}
        confirmLabel={t("common.discard")}
        cancelLabel={t("common.keepEditing")}
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          useDraftStore.getState().clear();
          router.replace("/");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  center: { textAlign: "center" },
  track: {
    alignSelf: "stretch",
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: 8, backgroundColor: colors.primary },
});
