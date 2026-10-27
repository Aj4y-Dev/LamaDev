import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/TextField";
import { sanitizeDecimal } from "@/lib/digits";
import { spacing } from "@/theme/tokens";
import type { Rate } from "@/api/types";
import { useSaveRate } from "./useRates";

export function RateEditor({
  rate,
  projectId,
}: {
  rate: Rate;
  projectId: string;
}) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rate.value);
  const [invalid, setInvalid] = useState(false);
  const save = useSaveRate(projectId);
  const label =
    i18n.language === "ne" && rate.labelNe ? rate.labelNe : rate.label;

  const submit = () => {
    if (!/^\d+(\.\d+)?$/.test(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate(
      { categoryKey: rate.categoryKey, rate: { value, per: rate.per } },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText bold>{label}</AppText>
          <AppText muted>
            Rs {rate.value} {t(`result.per.${rate.per}`)}
          </AppText>
        </View>
        {!editing ? (
          <Button
            compact
            variant="secondary"
            title={t("rates.edit")}
            onPress={() => setEditing(true)}
          />
        ) : null}
      </View>
      {editing ? (
        <View style={{ gap: spacing.md }}>
          <TextField
            label={label}
            keyboardType="decimal-pad"
            value={value}
            onChangeText={(v) => setValue(sanitizeDecimal(v))}
            error={invalid ? t("rates.invalid") : undefined}
          />
          <Button
            title={t("common.save")}
            onPress={submit}
            loading={save.isPending}
          />
          <Button
            variant="ghost"
            title={t("common.cancel")}
            onPress={() => {
              setEditing(false);
              setValue(rate.value);
            }}
          />
        </View>
      ) : null}
      {save.isSuccess && !editing ? (
        <StatusBadge tone="success" text={t("rates.saved")} />
      ) : null}
    </Card>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
