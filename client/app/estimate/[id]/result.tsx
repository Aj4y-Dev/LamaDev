import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/States';
import { ResultGroup } from '@/features/estimates/ResultGroup';
import { useResultStore } from '@/features/estimates/resultStore';
import { useDraftStore } from '@/features/estimates/draftStore';
import { useConfirmEstimate } from '@/features/estimates/useCalculate';
import { useProject } from '@/features/projects/useProjects';
import { buildReportHtml } from '@/features/report/buildReportHtml';
import { exportPdf } from '@/features/report/exportPdf';
import { useNetwork } from '@/hooks/useNetwork';
import { errorKey } from '@/lib/errors';
import { formatRs } from '@/lib/money';
import { colors, spacing } from '@/theme/tokens';

export default function Result() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const { estimateId, projectId, result, confirmed } = useResultStore();
  const project = useProject(projectId);
  const confirm = useConfirmEstimate();
  const [exportError, setExportError] = useState(false);

  if (!result || !estimateId) {
    return <Screen title={t('result.title')} onBack={() => router.replace('/')}><EmptyState title={t('result.none')} body={t('result.noneHint')} /></Screen>;
  }

  const fix = () => {
    const { items, setHighlight } = useDraftStore.getState();
    const bad = new Set(result.invalid.map((i) => i.id));
    setHighlight(items.filter((i) => i.id && bad.has(i.id)).map((i) => i.key));
    router.replace(`/estimate/${estimateId}/confirm`);
  };

  const share = async () => {
    setExportError(false);
    try {
      const html = buildReportHtml(result, {
        language: i18n.language === 'ne' ? 'ne' : 'en',
        projectTitle: project.data?.title ?? t('common.appName'),
        clientName: project.data?.clientName,
        date: new Date().toISOString().slice(0, 10),
      });
      await exportPdf(html);
    } catch { setExportError(true); }
  };

  return (
    <Screen
      title={t('result.title')}
      onBack={() => router.replace(`/estimate/${estimateId}/confirm`)}
      footer={
        confirmed ? (
          <>
            <StatusBadge tone="success" text={t('result.saved')} />
            <Button icon="share-outline" title={t('result.sharePdf')} onPress={share} />
            <Button variant="ghost" title={t('tabs.projects')} onPress={() => router.replace('/')} />
          </>
        ) : (
          <>
            {confirm.isError ? <AppText variant="caption" color={colors.error}>{t(errorKey(confirm.error))}</AppText> : null}
            <Button title={t('result.save')} loading={confirm.isPending} disabled={!isOnline} onPress={() => confirm.mutate(estimateId)} />
          </>
        )
      }
    >
      <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
        <AppText color="#DBEAFE" bold>{t('result.grandTotal')}</AppText>
        <AppText variant="total" bold color={colors.onPrimary} accessibilityRole="summary">{formatRs(result.grandTotal)}</AppText>
      </Card>

      {result.invalid.length > 0 ? (
        <Card accent="error">
          <AppText bold>{t('result.invalid')}</AppText>
          {result.invalid.map((i) => <AppText key={i.id} muted>{i.reason}</AppText>)}
          <Button compact variant="secondary" title={t('result.fix')} onPress={fix} />
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        {result.groups.map((g) => <ResultGroup key={g.categoryKey} group={g} />)}
      </View>
      {exportError ? <AppText color={colors.error}>{t('result.exportFailed')}</AppText> : null}
    </Screen>
  );
}
