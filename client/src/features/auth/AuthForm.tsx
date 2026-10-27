import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { useLogin, useRegister } from './useAuth';
import { errorKey } from '@/lib/errors';
import { useNetwork } from '@/hooks/useNetwork';
import { colors, spacing } from '@/theme/tokens';

const schema = z.object({ email: z.string().trim().email('auth.invalidEmail'), password: z.string().min(8, 'auth.passwordMin') });
type Values = z.infer<typeof schema>;

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const login = useLogin();
  const register = useRegister();
  const m = mode === 'login' ? login : register;
  const { control, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  return (
    <Screen
      footer={
        <>
          <Button title={t(`auth.${mode}`)} loading={m.isPending} disabled={!isOnline} onPress={handleSubmit((v) => m.mutate(v))} />
          <Button variant="ghost" title={t(mode === 'login' ? 'auth.toRegister' : 'auth.toLogin')} onPress={() => router.replace(mode === 'login' ? '/register' : '/login')} />
        </>
      }
    >
      <View style={{ gap: spacing.xs, marginTop: spacing.xxl }}>
        <AppText variant="caption" bold color={colors.primary}>{t('common.appName')}</AppText>
        <AppText variant="heading" bold accessibilityRole="header">{t(mode === 'login' ? 'auth.loginTitle' : 'auth.registerTitle')}</AppText>
      </View>
      <Controller control={control} name="email" render={({ field }) => (
        <TextField label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message ? t(errors.email.message) : undefined} />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <TextField label={t('auth.password')} secureToggle autoCapitalize="none" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message ? t(errors.password.message) : undefined} />
      )} />
      {m.isError ? <AppText color={colors.error} accessibilityLiveRegion="polite">{t(errorKey(m.error))}</AppText> : null}
      {!isOnline ? <AppText muted>{t('common.offlineHint')}</AppText> : null}
    </Screen>
  );
}
