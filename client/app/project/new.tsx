import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { AppText } from '@/components/AppText';
import { useCreateProject } from '@/features/projects/useProjects';
import { errorKey } from '@/lib/errors';
import { useNetwork } from '@/hooks/useNetwork';
import { colors } from '@/theme/tokens';

const schema = z.object({ title: z.string().trim().min(1, 'projects.required'), clientName: z.string().trim().optional() });
type Values = z.infer<typeof schema>;

export default function NewProject() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const create = useCreateProject();
  const { control, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', clientName: '' } });
  const submit = handleSubmit((v) => create.mutate({ title: v.title, clientName: v.clientName || undefined }, { onSuccess: (p) => router.replace(`/project/${p.id}`) }));
  return (
    <Screen title={t('projects.new')} onBack={() => router.back()} footer={<Button title={t('projects.create')} loading={create.isPending} disabled={!isOnline} onPress={submit} />}>
      <Controller control={control} name="title" render={({ field }) => <TextField label={t('projects.titleLabel')} value={field.value} onChangeText={field.onChange} error={errors.title?.message ? t(errors.title.message) : undefined} />} />
      <Controller control={control} name="clientName" render={({ field }) => <TextField label={t('projects.clientLabel')} value={field.value ?? ''} onChangeText={field.onChange} />} />
      {create.isError ? <AppText color={colors.error}>{t(errorKey(create.error))}</AppText> : null}
    </Screen>
  );
}
