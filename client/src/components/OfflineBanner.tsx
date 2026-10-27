import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { useNetwork } from '@/hooks/useNetwork';
import { colors, spacing } from '@/theme/tokens';

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const { t } = useTranslation();
  if (isOnline) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <AppText variant="label" bold color={colors.warning}>{t('common.offline')}</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningSoft, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
});
