import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { estimatesApi } from "@/api/estimates.api";
import type { EstimateItem, RateOverride } from "@/api/types";
import { compressForUpload } from "@/lib/image";
import { useDraftStore } from "./draftStore";
import { useResultStore } from "./resultStore";

export type GenerateProgress = {
  step: "reading";
  current: number;
  total: number;
} | null;

/**
 * Step 1: read every photo that has not been read yet. A photo that cannot be read is NOT an error:
 * it just has no lines, and the person types them in on the next screen.
 */
export function useReadPhotos() {
  const [progress, setProgress] = useState<GenerateProgress>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const projectId = useDraftStore.getState().projectId;
      if (!projectId) throw new Error("No project");

      const pending = useDraftStore
        .getState()
        .entries.flatMap((entry) =>
          entry.photos
            .filter((p) => p.items === null)
            .map((photo) => ({ entry, photo })),
        );
      setProgress({
        step: "reading",
        current: 1,
        total: Math.max(pending.length, 1),
      });

      // One estimate for the whole job. It also exists when no photo can be read.
      let estimateId = useDraftStore.getState().estimateId;
      if (!estimateId) {
        estimateId = (await estimatesApi.create(projectId)).id;
        useDraftStore.getState().setEstimateId(estimateId);
      }

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
        form.append("estimateId", estimateId);
        abortRef.current = new AbortController();
        try {
          const res = await estimatesApi.extract(
            projectId,
            form,
            abortRef.current.signal,
          );
          useDraftStore
            .getState()
            .setPhotoItems(
              entry.key,
              photo.key,
              res.items,
              res.skippedLines ?? 0,
            );
        } catch (err) {
          if (err instanceof ApiError && err.code === "EXTRACTION_FAILED") {
            useDraftStore.getState().setPhotoItems(entry.key, photo.key, [], 0);
            continue;
          }
          throw err;
        }
      }
      return estimateId;
    },
    onSettled: () => setProgress(null),
  });

  return { ...mutation, progress, cancel: () => abortRef.current?.abort() };
}

/** Step 2: save the checked lines and calculate. */
export function useCalculate() {
  return useMutation({
    mutationFn: async () => {
      const { estimateId, projectId, entries, mode } = useDraftStore.getState();
      if (!estimateId) throw new Error("No estimate");

      const items: EstimateItem[] = entries.flatMap((e) =>
        e.photos.flatMap((p) =>
          (p.items ?? [])
            .filter((i) => (i.expr ?? "").trim() !== "")
            .map((i) => ({
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
      const result = await estimatesApi.calculate(estimateId, { mode, rates });
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
