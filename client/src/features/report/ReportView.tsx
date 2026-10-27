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

/** The estimate sheet. This exact view is what "Save as image" captures. */
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
        return (
          <View key={g.categoryKey} style={styles.group}>
            <AppText bold>{label}</AppText>
            <AppText variant="label" muted>
              {formatRs(g.rate.value)} {t(`result.per.${g.rate.per}`)}
            </AppText>
            {g.items.map((i) => (
              <View key={i.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <AppText>{i.label}</AppText>
                  <AppText variant="caption" muted>
                    {formatNumber(i.qty)} {i.unit}
                  </AppText>
                </View>
                <AppText>{formatRs(i.amount)}</AppText>
              </View>
            ))}
            <View style={[styles.line, styles.sub]}>
              <AppText variant="label" muted>
                {t("result.subtotal")}
              </AppText>
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
  sub: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
