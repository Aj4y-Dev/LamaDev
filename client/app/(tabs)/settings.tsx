import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { setLanguage, type Language } from '@/i18n';
import { logoutAll } from '@/features/auth/useAuth';
import { colors, control, spacing } from '@/theme/tokens';

const LANGS: { code: Language; label: string }[] = [{ code: 'en', label: 'English' }, { code: 'ne', label: 'नेपाली' }];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  return (
    <Screen title={t('settings.title')}>
      <Card>
        <AppText variant="label" bold>{t('settings.language')}</AppText>
        {LANGS.map((l) => {
          const on = i18n.language === l.code;
          return (
            <Pressable key={l.code} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => void setLanguage(l.code)} style={styles.opt}>
              <AppText bold={on}>{l.label}</AppText>
              {on ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Card>
      <Button variant="destructive" icon="log-out-outline" title={t('settings.logout')} onPress={() => setConfirm(true)} />
      <ConfirmDialog visible={confirm} destructive title={t('settings.logout')} body={t('settings.logoutConfirm')} confirmLabel={t('settings.logout')} cancelLabel={t('common.cancel')} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void logoutAll(); }} />
    </Screen>
  );
}
const styles = StyleSheet.create({ opt: { minHeight: control.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs } });
