import { useCallback, useState } from "react";
import { BackHandler, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/TextField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/States";
import { ItemCard, categoryLabel } from "@/features/estimates/ItemCard";
import { PhotoHeader } from "@/features/estimates/PhotoHeader";
import { useDraftStore, type DraftItem } from "@/features/estimates/draftStore";
import { useCalculate } from "@/features/estimates/useCalculate";
import { useRates, useSaveRate } from "@/features/rates/useRates";
import { useNetwork } from "@/hooks/useNetwork";
import { sanitizeDecimal } from "@/lib/digits";
import { errorKey } from "@/lib/errors";
import { formatRs } from "@/lib/money";
import { UNKNOWN_CATEGORY } from "@/lib/constants";
import type { RateType } from "@/api/types";
import { colors, spacing } from "@/theme/tokens";

export default function Confirm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const draft = useDraftStore();
  const rates = useRates(draft.projectId);
  const saveRate = useSaveRate(draft.projectId);
  const calc = useCalculate();
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [removePhotoKey, setRemovePhotoKey] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        setLeaving(true);
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const rateList = rates.data ?? [];
  const presentKeys = Array.from(
    new Set(draft.items.map((i) => i.categoryKey)),
  ).filter((k) => k !== UNKNOWN_CATEGORY);
  const canCalculate = draft.items.length > 0 && isOnline && !calc.isPending;

  const rateFor = (key: string): { value: string; per: RateType } => {
    const saved = rateList.find((r) => r.categoryKey === key);
    const o = draft.overrides[key];
    return {
      value: o?.value ?? saved?.value ?? "",
      per: o?.per ?? saved?.per ?? "area",
    };
  };

  const photoKeys = new Set(draft.photos.map((p) => p.key));
  const orphanItems = draft.items.filter(
    (i) => !i.photoKey || !photoKeys.has(i.photoKey),
  );

  const renderItems = (items: DraftItem[]) =>
    items.map((item, idx) => (
      <ItemCard
        key={item.key}
        index={idx}
        item={item}
        rates={rateList}
        highlighted={draft.highlightKeys.includes(item.key)}
        onChange={(patch) => draft.updateItem(item.key, patch)}
        onDelete={() => setDeleteKey(item.key)}
      />
    ));

  const addPhoto = () =>
    router.push({
      pathname: "/estimate/[id]/capture",
      params: {
        id: draft.estimateId ?? "add",
        projectId: draft.projectId ?? "",
      },
    });

  const calculate = () =>
    calc.mutate(undefined, {
      onSuccess: () => router.replace(`/estimate/${draft.estimateId}/result`),
    });

  return (
    <Screen
      title={t("confirm.title")}
      subtitle={t("confirm.subtitle")}
      onBack={() => setLeaving(true)}
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
          <Button
            title={t("confirm.calculate")}
            icon="calculator-outline"
            loading={calc.isPending}
            disabled={!canCalculate}
            onPress={calculate}
          />
        </>
      }
    >
      {rates.isError ? (
        <ErrorState error={rates.error} onRetry={() => rates.refetch()} />
      ) : null}

      {draft.photos.length === 0 && draft.items.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={t("confirm.emptyTitle")}
          body={t("confirm.emptyBody")}
        />
      ) : null}

      {draft.photos.map((photo, pIdx) => {
        const rate = rateFor(photo.categoryKey);
        return (
          <View key={photo.key} style={{ gap: spacing.md }}>
            <PhotoHeader
              index={pIdx}
              uri={photo.uri}
              categoryText={categoryLabel(
                photo.categoryKey,
                rateList,
                i18n.language,
              )}
              rateText={
                rate.value
                  ? `${formatRs(rate.value)} ${t(`result.per.${rate.per}`)}`
                  : ""
              }
              onRemove={() => setRemovePhotoKey(photo.key)}
            />
            {renderItems(draft.items.filter((i) => i.photoKey === photo.key))}
            <Button
              compact
              variant="ghost"
              icon="add"
              title={t("confirm.addRow")}
              onPress={() => draft.addItem(photo.key)}
            />
          </View>
        );
      })}

      {orphanItems.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="title" bold>
            {t("confirm.otherItems")}
          </AppText>
          {renderItems(orphanItems)}
          <Button
            compact
            variant="ghost"
            icon="add"
            title={t("confirm.addRow")}
            onPress={() => draft.addItem(null)}
          />
        </View>
      ) : null}

      <Button
        variant="secondary"
        icon="camera-outline"
        title={t("confirm.addPhoto")}
        onPress={addPhoto}
      />

      {presentKeys.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="title" bold>
            {t("confirm.rates")}
          </AppText>
          <AppText muted>{t("confirm.ratesHint")}</AppText>
          {presentKeys.map((key) => {
            const saved = rateList.find((r) => r.categoryKey === key);
            const override = draft.overrides[key];
            const rate = rateFor(key);
            return (
              <Card key={key}>
                <TextField
                  label={categoryLabel(key, rateList, i18n.language)}
                  keyboardType="decimal-pad"
                  suffix={`Rs ${t(`result.per.${rate.per}`)}`}
                  value={rate.value}
                  onChangeText={(v) =>
                    draft.setOverride(key, {
                      value: sanitizeDecimal(v),
                      per: rate.per,
                    })
                  }
                />
                {override && override.value !== saved?.value ? (
                  <Button
                    compact
                    variant="ghost"
                    title={t("confirm.saveDefault")}
                    loading={saveRate.isPending}
                    onPress={() =>
                      saveRate.mutate(
                        { categoryKey: key, rate: override },
                        { onSuccess: () => draft.clearOverride(key) },
                      )
                    }
                  />
                ) : null}
                {saveRate.isSuccess && !override ? (
                  <StatusBadge
                    tone="success"
                    text={t("confirm.savedDefault")}
                  />
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : null}

      <ConfirmDialog
        visible={deleteKey !== null}
        destructive
        title={t("confirm.deleteTitle")}
        body={t("confirm.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleteKey(null)}
        onConfirm={() => {
          if (deleteKey) draft.removeItem(deleteKey);
          setDeleteKey(null);
        }}
      />

      <ConfirmDialog
        visible={removePhotoKey !== null}
        destructive
        title={t("confirm.removePhotoTitle")}
        body={t("confirm.removePhotoBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setRemovePhotoKey(null)}
        onConfirm={() => {
          if (removePhotoKey) draft.removePhoto(removePhotoKey);
          setRemovePhotoKey(null);
        }}
      />

      <ConfirmDialog
        visible={leaving}
        destructive
        title={t("confirm.discardTitle")}
        body={t("confirm.discardBody")}
        confirmLabel={t("common.discard")}
        cancelLabel={t("common.keepEditing")}
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          draft.clear();
          router.replace("/");
        }}
      />
    </Screen>
  );
}
