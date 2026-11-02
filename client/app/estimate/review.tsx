import { useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/States";
import type { EstimateItem } from "@/api/types";
import {
  useDraftStore,
  type DraftPhoto,
} from "@/features/estimates/draftStore";
import { useCalculate } from "@/features/estimates/useGenerate";
import { useNetwork } from "@/hooks/useNetwork";
import { toAsciiDigits } from "@/lib/digits";
import { errorKey } from "@/lib/errors";
import { formatRs } from "@/lib/money";
import { colors, control, radii, spacing } from "@/theme/tokens";

function LineRow({
  index,
  item,
  onChange,
  onDelete,
}: {
  index: number;
  item: EstimateItem;
  onChange: (patch: Partial<EstimateItem>) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const flagged = item.uncertain === true;
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={[styles.row, flagged && styles.rowFlag]}>
        <AppText muted style={styles.num}>
          {index + 1}
        </AppText>
        <TextInput
          style={styles.input}
          value={item.expr ?? ""}
          onChangeText={(v) =>
            onChange({
              expr: toAsciiDigits(v),
              uncertain: false,
              written: null,
            })
          }
          placeholder={t("review.placeholder")}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t("review.line", { n: index + 1 })}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.delete")}
          onPress={onDelete}
          hitSlop={8}
          style={styles.del}
        >
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </Pressable>
      </View>
      {flagged ? (
        <AppText variant="caption" color={colors.warning}>
          {t("review.unsure")}
        </AppText>
      ) : null}
      {item.written ? (
        <AppText variant="caption" muted>
          {t("review.written", { value: item.written })}
        </AppText>
      ) : null}
    </View>
  );
}

function PhotoBlock({
  entryKey,
  photo,
  index,
}: {
  entryKey: string;
  photo: DraftPhoto;
  index: number;
}) {
  const { t } = useTranslation();
  const [big, setBig] = useState(false);
  const items = photo.items ?? [];
  const actions = useDraftStore.getState();
  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("review.showPhoto")}
        onPress={() => setBig((b) => !b)}
        style={styles.photoHead}
      >
        <Image
          source={{ uri: photo.uri }}
          style={big ? styles.photoBig : styles.thumb}
          resizeMode={big ? "contain" : "cover"}
          accessibilityIgnoresInvertColors
        />
        {!big ? (
          <View style={{ flex: 1 }}>
            <AppText bold>{t("review.photo", { n: index + 1 })}</AppText>
            <AppText variant="label" muted>
              {t("review.tapToEnlarge")}
            </AppText>
          </View>
        ) : null}
      </Pressable>

      {photo.items === null ? (
        <AppText color={colors.warning}>{t("review.notRead")}</AppText>
      ) : null}
      {photo.items !== null && items.length === 0 ? (
        <AppText color={colors.warning}>{t("review.photoFailed")}</AppText>
      ) : null}
      {photo.skipped > 0 ? (
        <AppText color={colors.warning}>
          {t("review.skipped", { count: photo.skipped })}
        </AppText>
      ) : null}

      {items.map((item, i) => (
        <LineRow
          key={item.id ?? `${photo.key}-${i}`}
          index={i}
          item={item}
          onChange={(patch) =>
            actions.updateLine(entryKey, photo.key, i, patch)
          }
          onDelete={() => actions.removeLine(entryKey, photo.key, i)}
        />
      ))}
      <Button
        compact
        variant="ghost"
        icon="add"
        title={t("review.addLine")}
        onPress={() => actions.addLine(entryKey, photo.key)}
      />
    </View>
  );
}

export default function Review() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const entries = useDraftStore((s) => s.entries);
  const calc = useCalculate();

  const lineCount = entries.reduce(
    (n, e) =>
      n +
      e.photos.reduce(
        (m, p) =>
          m +
          (p.items ?? []).filter((i) => (i.expr ?? "").trim() !== "").length,
        0,
      ),
    0,
  );
  const canCalculate = lineCount > 0 && isOnline && !calc.isPending;
  const run = () =>
    calc.mutate(undefined, {
      onSuccess: () => router.replace("/estimate/result"),
    });

  return (
    <Screen
      title={t("review.title")}
      subtitle={t("review.subtitle")}
      onBack={() => router.back()}
      footer={
        <>
          {!isOnline ? (
            <AppText variant="caption" muted>
              {t("common.offlineHint")}
            </AppText>
          ) : null}
          {calc.isError ? (
            <AppText variant="caption" color={colors.error}>
              {t(errorKey(calc.error))}
            </AppText>
          ) : null}
          {lineCount === 0 ? (
            <AppText variant="caption" muted>
              {t("review.needLine")}
            </AppText>
          ) : null}
          <Button
            icon="calculator-outline"
            title={t("review.calculate")}
            loading={calc.isPending}
            disabled={!canCalculate}
            onPress={run}
          />
        </>
      }
    >
      <AppText muted>{t("review.help")}</AppText>

      {entries.length === 0 ? (
        <EmptyState icon="list-outline" title={t("review.empty")} />
      ) : null}

      {entries.map((entry) => (
        <Card key={entry.key}>
          <AppText variant="title" bold>
            {entry.workName}
          </AppText>
          <AppText muted>
            {formatRs(entry.rate)} {t(`result.per.${entry.per}`)}
          </AppText>
          <View style={{ gap: spacing.xl, marginTop: spacing.md }}>
            {entry.photos.map((photo, i) => (
              <PhotoBlock
                key={photo.key}
                entryKey={entry.key}
                photo={photo}
                index={i}
              />
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoHead: { gap: spacing.md },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  photoBig: {
    width: "100%",
    height: 360,
    borderRadius: radii.md,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
  },
  rowFlag: {
    borderColor: "#F59E0B",
    borderWidth: 2,
    backgroundColor: colors.warningSoft,
  },
  num: { width: 24 },
  input: {
    flex: 1,
    minHeight: control.height,
    fontSize: 18,
    color: colors.text,
    fontFamily: "Inter_400Regular",
  },
  del: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
});
