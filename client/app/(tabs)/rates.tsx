import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { RateEditor } from '@/features/rates/RateEditor';
import { useRates } from '@/features/rates/useRates';

export default function RatesScreen() {
  const { t } = useTranslation();
  const q = useRates();
  return (
    <Screen title={t('rates.title')}>
      {q.isPending ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
        q.data.length === 0 ? <EmptyState icon="pricetags-outline" title={t('rates.empty')} /> :
        q.data.map((r) => <RateEditor key={r.categoryKey} rate={r} />)}
    </Screen>
  );
}
