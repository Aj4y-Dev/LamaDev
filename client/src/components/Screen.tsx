import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { OfflineBanner } from './OfflineBanner';
import { colors, control, spacing } from '@/theme/tokens';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  headerRight?: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

export function Screen({ title, subtitle, onBack, headerRight, scroll = true, footer, children }: Props) {
  const { t } = useTranslation();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <OfflineBanner />
      {title ? (
        <View style={styles.header}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} style={styles.back} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <AppText variant="heading" bold accessibilityRole="header">{title}</AppText>
            {subtitle ? <AppText muted>{subtitle}</AppText> : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  back: { width: control.minTouch, height: control.minTouch, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  footer: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
