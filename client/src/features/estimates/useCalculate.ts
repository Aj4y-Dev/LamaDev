import { useMutation } from "@tanstack/react-query";
import { estimatesApi } from "@/api/estimates.api";
import type { EstimateItem } from "@/api/types";
import { useDraftStore } from "./draftStore";
import { useResultStore } from "./resultStore";

export function useCalculate() {
  return useMutation({
    mutationFn: async () => {
      const { estimateId, projectId, items, overrides } =
        useDraftStore.getState();
      if (!estimateId) throw new Error("No estimate");
      const payload: EstimateItem[] = items.map(
        ({ key: _key, photoKey: _photoKey, ...rest }) => ({
          ...rest,
          breadth: rest.breadth ? rest.breadth : null,
        }),
      );
      await estimatesApi.putItems(estimateId, payload);
      const result = await estimatesApi.calculate(estimateId, {
        rates: overrides,
      });
      useResultStore.getState().set({ estimateId, projectId, result });
      return result;
    },
  });
}

export function useConfirmEstimate() {
  return useMutation({
    mutationFn: (id: string) => estimatesApi.confirm(id),
    onSuccess: () => {
      useResultStore.getState().markConfirmed();
      useDraftStore.getState().clear();
    },
  });
}
