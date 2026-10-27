import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ProjectCard } from '@/features/projects/ProjectCard';
import { useProjects } from '@/features/projects/useProjects';

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useProjects();
  return (
    <Screen title={t('projects.title')} footer={<Button icon="add" title={t('projects.new')} onPress={() => router.push('/project/new')} />}>
      {q.isPending ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
        q.data.length === 0 ? <EmptyState title={t('projects.empty')} body={t('projects.emptyHint')} actionLabel={t('projects.createFirst')} onAction={() => router.push('/project/new')} /> :
        q.data.map((p) => <ProjectCard key={p.id} project={p} onPress={() => router.push(`/project/${p.id}`)} />)}
    </Screen>
  );
}
