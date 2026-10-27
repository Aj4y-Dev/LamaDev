import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ErrorState, LoadingState } from "@/components/States";
import { ApiError } from "@/api/client";
import {
  ImageTooLargeError,
  pickFromCamera,
  pickFromGallery,
  type PickedImage,
  type PickResult,
} from "@/lib/image";
import { sanitizeDecimal } from "@/lib/digits";
import { categoryLabel } from "@/features/estimates/ItemCard";
import { useExtract } from "@/features/estimates/useExtract";
import { useDraftStore } from "@/features/estimates/draftStore";
import { useRates } from "@/features/rates/useRates";
import { useNetwork } from "@/hooks/useNetwork";
import { colors, control, radii, spacing } from "@/theme/tokens";

// Text check only: a positive number. No money arithmetic on the client.
const validRate = (v: string) => /^\d+(\.\d+)?$/.test(v) && /[1-9]/.test(v);

export default function Capture() {
  const { id, projectId } = useLocalSearchParams<{
    id: string;
    projectId: string;
  }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const draft = useDraftStore();
  const rates = useRates(projectId);
  const extract = useExtract(projectId);

  const [image, setImage] = useState<PickedImage | null>(null);
  const [denied, setDenied] = useState(false);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [rateText, setRateText] = useState<string | null>(null);
  const [rateInvalid, setRateInvalid] = useState(false);

  // id === 'new' starts a fresh estimate. Any other id means "add another photo".
  const addingMore = id !== "new";
  useEffect(() => {
    if (id === "new") useDraftStore.getState().begin(projectId);
  }, [id, projectId]);

  const list = rates.data ?? [];
  const selected = categoryKey ?? list[0]?.categoryKey ?? null;
  const saved = list.find((r) => r.categoryKey === selected);
  const per = saved?.per ?? "area";
  const defaultRate = selected
    ? (draft.overrides[selected]?.value ?? saved?.value ?? "")
    : "";
  const rateValue = rateText ?? defaultRate;

  const pick = async (fn: () => Promise<PickResult>) => {
    const r = await fn();
    if (r.status === "denied") setDenied(true);
    if (r.status === "ok") {
      setDenied(false);
      setImage(r.image);
      extract.reset();
    }
  };

  const finish = (estimateId: string | null) => {
    if (selected) draft.setOverride(selected, { value: rateValue, per });
    if (addingMore) router.back();
    else router.replace(`/estimate/${estimateId ?? "new"}/confirm`);
  };

  const upload = () => {
    if (!image || !selected || extract.isPending) return;
    if (!validRate(rateValue)) {
      setRateInvalid(true);
      return;
    }
    setRateInvalid(false);
    extract.mutate(
      { image, categoryKey: selected },
      { onSuccess: (res) => finish(res.id) },
    );
  };

  const manualEntry = () => {
    if (!selected) return;
    if (!validRate(rateValue)) {
      setRateInvalid(true);
      return;
    }
    draft.addPhoto({
      estimateId: null,
      uri: image?.uri ?? null,
      categoryKey: selected,
      items: [],
    });
    finish(null);
  };

  const failedExtraction =
    extract.error instanceof ApiError &&
    extract.error.code === "EXTRACTION_FAILED";
  const tooLarge = extract.error instanceof ImageTooLargeError;

  if (extract.isPending) {
    return (
      <Screen
        title={t("capture.title")}
        footer={
          <Button
            variant="secondary"
            title={t("common.cancel")}
            onPress={extract.cancel}
          />
        }
      >
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <AppText variant="title" bold>
            {t("capture.uploading")}
          </AppText>
          <AppText muted>{t("capture.uploadingHint")}</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={t("capture.title")}
      onBack={() => router.back()}
      footer={
        image && selected ? (
          <Button
            title={t("capture.use")}
            disabled={!isOnline || rates.isPending}
            onPress={upload}
          />
        ) : undefined
      }
    >
      <AppText muted>{t("capture.hint")}</AppText>
      {image ? (
        <Image
          source={{ uri: image.uri }}
          style={styles.preview}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Button
          icon="camera-outline"
          variant={image ? "secondary" : "primary"}
          title={image ? t("capture.retake") : t("capture.takePhoto")}
          onPress={() => pick(pickFromCamera)}
        />
        <Button
          icon="images-outline"
          variant="secondary"
          title={t("capture.gallery")}
          onPress={() => pick(pickFromGallery)}
        />
      </View>

      {denied ? (
        <View style={{ gap: spacing.sm }}>
          <AppText color={colors.error}>{t("capture.denied")}</AppText>
          <Button
            variant="ghost"
            title={t("capture.openSettings")}
            onPress={() => void Linking.openSettings()}
          />
        </View>
      ) : null}

      {image ? (
        rates.isPending ? (
          <LoadingState rows={1} />
        ) : rates.isError ? (
          <ErrorState error={rates.error} onRetry={() => rates.refetch()} />
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="title" bold>
              {t("capture.workType")}
            </AppText>
            <View style={styles.chips}>
              {list.map((r) => {
                const on = r.categoryKey === selected;
                return (
                  <Pressable
                    key={r.categoryKey}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setCategoryKey(r.categoryKey);
                      setRateText(null);
                      setRateInvalid(false);
                    }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <AppText
                      variant="label"
                      bold={on}
                      color={on ? colors.onPrimary : colors.text}
                    >
                      {categoryLabel(r.categoryKey, list, i18n.language)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <TextField
              label={t("capture.rate")}
              suffix={`Rs ${t(`result.per.${per}`)}`}
              keyboardType="decimal-pad"
              value={rateValue}
              onChangeText={(v) => setRateText(sanitizeDecimal(v))}
              helper={t("capture.rateHint")}
              error={rateInvalid ? t("rates.invalid") : undefined}
            />
          </View>
        )
      ) : null}

      {tooLarge ? (
        <AppText color={colors.error}>{t("capture.tooLarge")}</AppText>
      ) : null}
      {extract.isError && !tooLarge ? (
        <>
          <ErrorState
            error={extract.error}
            onRetry={failedExtraction ? undefined : upload}
          />
          {failedExtraction ? (
            <Button title={t("errors.enterManually")} onPress={manualEntry} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: "100%",
    height: 280,
    borderRadius: radii.md,
    backgroundColor: colors.border,
  },
  progress: { gap: spacing.sm, paddingVertical: spacing.xxxl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: control.minTouch,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
