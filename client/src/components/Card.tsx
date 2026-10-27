import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface Props extends ViewProps { onPress?: () => void; accent?: 'warning' | 'error' | null; accessibilityLabel?: string }

export function Card({ onPress, accent, style, children, accessibilityLabel, ...rest }: Props) {
  const s = [styles.card, accent === 'warning' && styles.warn, accent === 'error' && styles.err, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...s, pressed && { backgroundColor: colors.background }]}>
        {children}
      </Pressable>
    );
  }
  return <View {...rest} style={s}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.lg, gap: spacing.sm },
  warn: { borderColor: '#F59E0B', borderLeftWidth: 4 },
  err: { borderColor: colors.error, borderLeftWidth: 4 },
});
