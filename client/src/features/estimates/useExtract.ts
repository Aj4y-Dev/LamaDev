import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { estimatesApi } from "@/api/estimates.api";
import { compressForUpload, type PickedImage } from "@/lib/image";
import { useDraftStore } from "./draftStore";

interface ExtractInput {
  image: PickedImage;
  categoryKey: string;
}

export function useExtract(projectId: string) {
  const abortRef = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationFn: async ({ image, categoryKey }: ExtractInput) => {
      const uri = await compressForUpload(image);
      const form = new FormData();
      // React Native's FormData accepts a { uri, name, type } descriptor instead of a Blob.
      form.append("image", {
        uri,
        name: "photo.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
      form.append("categoryKey", categoryKey);
      const existing = useDraftStore.getState().estimateId;
      if (existing) form.append("estimateId", existing);
      abortRef.current = new AbortController();
      return estimatesApi.extract(projectId, form, abortRef.current.signal);
    },
    onSuccess: (res, { image, categoryKey }) =>
      useDraftStore.getState().addPhoto({
        estimateId: res.id,
        uri: image.uri,
        categoryKey,
        items: res.items,
      }),
  });
  return { ...mutation, cancel: () => abortRef.current?.abort() };
}
