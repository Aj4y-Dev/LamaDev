import type { ComponentRef, RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppText } from "@/components/AppText";
import { formatNumber, formatRs } from "@/lib/money";
import { colors, radii, spacing } from "@/theme/tokens";
import type { CalculateResponse } from "@/api/types";

interface Props {
  viewRef: RefObject<ComponentRef<typeof View> | null>;
  result: CalculateResponse;
  projectTitle: string;
  clientName?: string | null;
  date: string;
}

/** The estimate sheet, laid out like the notebook answer: each line with its result, then the total area, the rate and the amount. */
export function ReportView({
  viewRef,
  result,
  projectTitle,
  clientName,
  date,
}: Props) {
  const { t, i18n } = useTranslation();
  return (
    <View ref={viewRef} collapsable={false} style={styles.sheet}>
      <AppText variant="title" bold>
        {projectTitle}
      </AppText>
      <AppText variant="label" muted>
        {clientName ? `${t("report.client")}: ${clientName} · ` : ""}
        {date}
      </AppText>

      {result.groups.map((g) => {
        const label = i18n.language === "ne" && g.labelNe ? g.labelNe : g.label;
        const unit = t(`result.unit.${g.unit ?? "sqft"}`, {
          defaultValue: g.unit ?? "",
        });
        return (
          <View key={g.categoryKey} style={styles.group}>
            <AppText variant="title" bold>
              {label}
            </AppText>

            {g.items.map((i, n) => (
              <View key={i.id} style={styles.line}>
                <AppText style={{ flex: 1 }}>
                  {i.size || i.label || t("result.line", { n: n + 1 })}
                  {i.check ? " *" : ""}
                </AppText>
                <AppText>= {formatNumber(i.qty)}</AppText>
              </View>
            ))}

            <View style={[styles.line, styles.sum]}>
              <AppText bold>{t("result.totalArea")}</AppText>
              <AppText bold>
                {g.totalQty ? formatNumber(g.totalQty) : ""} {unit}
              </AppText>
            </View>
            <View style={styles.line}>
              <AppText muted>{t("result.rate")}</AppText>
              <AppText>
                {formatRs(g.rate.value)} {t(`result.per.${g.rate.per}`)}
              </AppText>
            </View>
            <View style={styles.line}>
              <AppText bold>{t("result.amount")}</AppText>
              <AppText bold>{formatRs(g.subtotal)}</AppText>
            </View>
          </View>
        );
      })}

      <View style={styles.total}>
        <AppText bold muted>
          {t("result.grandTotal")}
        </AppText>
        <AppText variant="total" bold color={colors.primary}>
          {formatRs(result.grandTotal)}
        </AppText>
      </View>
      {result.groups.some((g) => g.items.some((i) => i.check)) ? (
        <AppText variant="caption" muted>
          {t("result.checkNote")}
        </AppText>
      ) : null}
      <AppText variant="caption" muted>
        {t("report.footer")}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  group: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  sum: {
    borderTopWidth: 2,
    borderTopColor: colors.text,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  total: {
    alignItems: "flex-end",
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.text,
  },
});
