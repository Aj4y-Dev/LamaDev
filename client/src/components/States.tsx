import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Button } from './Button';
import { colors, radii, spacing } from '@/theme/tokens';
import { errorKey } from '@/lib/errors';

interface EmptyProps { icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; actionLabel?: string; onAction?: () => void }
export function EmptyState({ icon = 'folder-open-outline', title, body, actionLabel, onAction }: EmptyProps) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <AppText variant="title" bold style={styles.txt}>{title}</AppText>
      {body ? <AppText muted style={styles.txt}>{body}</AppText> : null}
      {actionLabel && onAction ? <View style={styles.action}><Button title={actionLabel} onPress={onAction} /></View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Ionicons name="warning-outline" size={44} color={colors.error} />
      <AppText bold style={styles.txt}>{t(errorKey(error))}</AppText>
      {onRetry ? <View style={styles.action}><Button title={t('common.retry')} variant="secondary" onPress={onRetry} /></View> : null}
    </View>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: spacing.md }} accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => <View key={i} style={styles.skeleton} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  txt: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
  skeleton: { height: 76, borderRadius: radii.md, backgroundColor: colors.skeleton },
});
