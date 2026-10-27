import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { formatNumber, formatRs } from '@/lib/money';
import { colors, spacing } from '@/theme/tokens';
import type { ResultGroupData } from '@/api/types';

export function ResultGroup({ group }: { group: ResultGroupData }) {
  const { t, i18n } = useTranslation();
  const label = i18n.language === 'ne' && group.labelNe ? group.labelNe : group.label;
  return (
    <Card>
      <AppText variant="title" bold>{label}</AppText>
      <AppText muted>{formatRs(group.rate.value)} {t(`result.per.${group.rate.per}`)}</AppText>
      <View style={styles.list}>
        {group.items.map((i) => (
          <View key={i.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText>{i.label}</AppText>
              <AppText variant="caption" muted>{formatNumber(i.qty)} {i.unit}</AppText>
            </View>
            <AppText bold>{formatRs(i.amount)}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.sub}>
        <AppText muted>{t('result.subtotal')}</AppText>
        <AppText bold>{formatRs(group.subtotal)}</AppText>
      </View>
    </Card>
  );
}
const styles = StyleSheet.create({
  list: { gap: spacing.md, marginTop: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  sub: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
});
