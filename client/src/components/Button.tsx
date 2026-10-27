import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, control, radii, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, compact }: Props) {
  const inactive = disabled || loading;
  const fg = variant === 'primary' || variant === 'destructive' ? colors.onPrimary : variant === 'ghost' ? colors.primary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: compact ? control.minTouch : control.height },
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === 'destructive' && { backgroundColor: pressed ? '#991B1B' : colors.error },
        variant === 'secondary' && { backgroundColor: pressed ? colors.border : colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
        variant === 'ghost' && { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
        inactive && { opacity: 0.5 },
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
        <AppText bold color={fg} style={styles.text}>{title}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.md, paddingHorizontal: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flexShrink: 1, textAlign: 'center' },
});
