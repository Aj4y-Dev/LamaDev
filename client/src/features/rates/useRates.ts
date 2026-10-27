import { useMutation, useQuery } from "@tanstack/react-query";
import { ratesApi } from "@/api/rates.api";
import type { RateOverride } from "@/api/types";
import { queryClient } from "@/lib/queryClient";

export const rateKeys = { project: (id: string) => ["rates", id] as const };

export const useRates = (projectId: string | null | undefined) =>
  useQuery({
    queryKey: rateKeys.project(projectId ?? ""),
    queryFn: () => ratesApi.list(projectId as string),
    enabled: !!projectId,
  });

export const useSaveRate = (projectId: string | null | undefined) =>
  useMutation({
    mutationFn: ({
      categoryKey,
      rate,
    }: {
      categoryKey: string;
      rate: RateOverride;
    }) => ratesApi.save(projectId as string, categoryKey, rate),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: rateKeys.project(projectId ?? ""),
      }),
  });
