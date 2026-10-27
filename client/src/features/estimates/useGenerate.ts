import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { estimatesApi } from "@/api/estimates.api";
import type { EstimateItem, RateOverride } from "@/api/types";
import { compressForUpload } from "@/lib/image";
import { useDraftStore } from "./draftStore";
import { useResultStore } from "./resultStore";

export type GenerateProgress =
  | { step: "reading"; current: number; total: number }
  | { step: "calculating" }
  | null;

export function useGenerate() {
  const [progress, setProgress] = useState<GenerateProgress>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const draft = useDraftStore.getState();
      const projectId = draft.projectId;
      if (!projectId) throw new Error("No project");

      // Only photos that have not been read yet are uploaded, so retrying never re-uploads finished ones.
      const pending = draft.entries.flatMap((entry) =>
        entry.photos
          .filter((p) => p.items === null)
          .map((photo) => ({ entry, photo })),
      );

      let n = 0;
      for (const { entry, photo } of pending) {
        n += 1;
        setProgress({ step: "reading", current: n, total: pending.length });
        const uri = await compressForUpload({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
        });
        const form = new FormData();
        // React Native's FormData accepts a { uri, name, type } descriptor instead of a Blob.
        form.append("image", {
          uri,
          name: "photo.jpg",
          type: "image/jpeg",
        } as unknown as Blob);
        form.append("categoryKey", entry.key);
        const existing = useDraftStore.getState().estimateId;
        if (existing) form.append("estimateId", existing);
        abortRef.current = new AbortController();
        const res = await estimatesApi.extract(
          projectId,
          form,
          abortRef.current.signal,
        );
        useDraftStore.getState().setEstimateId(res.id);
        useDraftStore.getState().setPhotoItems(entry.key, photo.key, res.items);
      }

      setProgress({ step: "calculating" });
      const { estimateId, entries } = useDraftStore.getState();
      if (!estimateId) throw new Error("No estimate");

      const items: EstimateItem[] = entries.flatMap((e) =>
        e.photos.flatMap((p) =>
          (p.items ?? []).map((i) => ({
            ...i,
            categoryKey: e.key,
            breadth: i.breadth ? i.breadth : null,
          })),
        ),
      );
      const rates: Record<string, RateOverride> = {};
      for (const e of entries)
        rates[e.key] = { value: e.rate, per: e.per, label: e.workName };

      await estimatesApi.putItems(estimateId, items);
      const result = await estimatesApi.calculate(estimateId, { rates });
      useResultStore.getState().set({ estimateId, projectId, result });
      return result;
    },
    onSettled: () => setProgress(null),
  });

  return { ...mutation, progress, cancel: () => abortRef.current?.abort() };
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
