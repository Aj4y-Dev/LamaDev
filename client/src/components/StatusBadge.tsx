import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { radii, spacing, toneColors, type Tone } from '@/theme/tokens';

const ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle', warning: 'alert-circle', error: 'close-circle', info: 'information-circle',
};

export function StatusBadge({ text, tone }: { text: string; tone: Tone }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]} accessibilityRole="text">
      <Ionicons name={ICON[tone]} size={16} color={c.fg} />
      <AppText variant="caption" bold color={c.fg} style={{ flexShrink: 1 }}>{text}</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.sm },
});
