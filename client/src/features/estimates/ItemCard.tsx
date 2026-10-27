import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import type { Rate, Unit } from '@/api/types';
import { colors, control, radii, spacing } from '@/theme/tokens';
import { sanitizeDecimal } from '@/lib/digits';
import { CATEGORY_FALLBACK, UNKNOWN_CATEGORY } from '@/lib/constants';
import type { DraftItem } from './draftStore';

interface Props {
  index: number;
  item: DraftItem;
  rates: Rate[];
  highlighted: boolean;
  onChange: (patch: Partial<DraftItem>) => void;
  onDelete: () => void;
}

export function categoryLabel(key: string, rates: Rate[], lang: string): string {
  const r = rates.find((x) => x.categoryKey === key);
  if (r) return lang === 'ne' && r.labelNe ? r.labelNe : r.label;
  const f = CATEGORY_FALLBACK[key];
  return f ? (lang === 'ne' ? f.ne : f.en) : key;
}

export function ItemCard({ index, item, rates, highlighted, onChange, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const unknown = item.categoryKey === UNKNOWN_CATEGORY;
  const missingLength = item.length.trim() === '';
  const per = rates.find((r) => r.categoryKey === item.categoryKey)?.per;
  const options = rates.map((r) => r.categoryKey);
  const unitSuffix = item.unit;

  return (
    <Card accent={unknown || missingLength ? 'warning' : highlighted ? 'error' : null} style={highlighted ? styles.hl : undefined}>
      <View style={styles.head}>
        <AppText bold>{t('confirm.item', { n: index + 1 })}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} onPress={onDelete} hitSlop={8} style={styles.del}>
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </Pressable>
      </View>

      <AppText variant="label" bold>{t('confirm.category')}</AppText>
      <View style={styles.chips}>
        {options.map((key) => {
          const on = key === item.categoryKey;
          return (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange({ categoryKey: key })} style={[styles.chip, on && styles.chipOn]}>
              <AppText variant="label" bold={on} color={on ? colors.onPrimary : colors.text}>{categoryLabel(key, rates, i18n.language)}</AppText>
            </Pressable>
          );
        })}
      </View>
      {unknown ? <StatusBadge tone="warning" text={t('confirm.unknown')} /> : null}

      <TextField label={t('confirm.label')} value={item.label} onChangeText={(v) => onChange({ label: v })} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField label={t('confirm.length')} suffix={unitSuffix} keyboardType="decimal-pad" value={item.length} onChangeText={(v) => onChange({ length: sanitizeDecimal(v) })} error={missingLength ? t('confirm.missing') : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('confirm.breadth')} suffix={unitSuffix} keyboardType="decimal-pad" value={item.breadth ?? ''} onChangeText={(v) => onChange({ breadth: sanitizeDecimal(v) })} />
        </View>
      </View>

      {per === 'count' ? (
        <TextField label={t('confirm.count')} keyboardType="number-pad" value={item.count != null ? String(item.count) : ''} onChangeText={(v) => { const d = sanitizeDecimal(v).replace('.', ''); onChange({ count: d === '' ? null : parseInt(d, 10) }); }} />
      ) : null}

      <AppText variant="label" bold>{t('confirm.unit')}</AppText>
      <View style={styles.chips}>
        {(['ft', 'm'] as Unit[]).map((u) => {
          const on = u === item.unit;
          return (
            <Pressable key={u} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange({ unit: u })} style={[styles.chip, styles.unit, on && styles.chipOn]}>
              <AppText variant="label" bold color={on ? colors.onPrimary : colors.text}>{u}</AppText>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  del: { width: control.minTouch, height: control.minTouch, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: control.minTouch, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unit: { minWidth: 64, alignItems: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
  hl: { backgroundColor: colors.errorSoft },
});
