import { useMutation, useQuery } from '@tanstack/react-query';
import { ratesApi } from '@/api/rates.api';
import type { RateOverride } from '@/api/types';
import { queryClient } from '@/lib/queryClient';

export const rateKeys = { all: ['rates'] as const };
export const useRates = () => useQuery({ queryKey: rateKeys.all, queryFn: ratesApi.list });
export const useSaveRate = () =>
  useMutation({
    mutationFn: ({ categoryKey, rate }: { categoryKey: string; rate: RateOverride }) => ratesApi.save(categoryKey, rate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rateKeys.all }),
  });
