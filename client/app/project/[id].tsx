import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useProject } from '@/features/projects/useProjects';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const q = useProject(id);
  return (
    <Screen
      title={q.data?.title ?? t('projects.title')}
      subtitle={q.data?.clientName ?? undefined}
      onBack={() => router.back()}
      footer={<Button icon="camera-outline" title={t('projects.newEstimate')} onPress={() => router.push({ pathname: '/estimate/[id]/capture', params: { id: 'new', projectId: id } })} />}
    >
      {q.isPending ? <LoadingState rows={2} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
        // The API contract has no "list estimates" endpoint yet, so no estimate list is invented here.
        <EmptyState icon="document-text-outline" title={t('projects.noEstimates')} body={t('projects.noEstimatesHint')} />}
    </Screen>
  );
}
