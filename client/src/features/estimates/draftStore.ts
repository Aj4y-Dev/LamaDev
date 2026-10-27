import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EstimateItem, RateOverride } from "@/api/types";
import { UNKNOWN_CATEGORY } from "@/lib/constants";

export interface DraftItem extends EstimateItem {
  key: string;
  photoKey: string | null;
}
export interface DraftPhoto {
  key: string;
  uri: string | null;
  categoryKey: string;
}

const newKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const blankItem = (
  photoKey: string | null,
  categoryKey: string = UNKNOWN_CATEGORY,
): DraftItem => ({
  key: newKey(),
  photoKey,
  categoryKey,
  label: "",
  length: "",
  breadth: "",
  count: null,
  unit: "ft",
});

interface DraftState {
  estimateId: string | null;
  projectId: string | null;
  photos: DraftPhoto[];
  items: DraftItem[];
  overrides: Record<string, RateOverride>;
  highlightKeys: string[];
  begin: (projectId: string) => void;
  addPhoto: (p: {
    estimateId: string | null;
    uri: string | null;
    categoryKey: string;
    items: EstimateItem[];
  }) => void;
  removePhoto: (photoKey: string) => void;
  addItem: (photoKey: string | null) => void;
  updateItem: (key: string, patch: Partial<EstimateItem>) => void;
  removeItem: (key: string) => void;
  setOverride: (categoryKey: string, o: RateOverride) => void;
  clearOverride: (categoryKey: string) => void;
  setHighlight: (keys: string[]) => void;
  clear: () => void;
}

const empty = {
  estimateId: null as string | null,
  projectId: null as string | null,
  photos: [] as DraftPhoto[],
  items: [] as DraftItem[],
  overrides: {} as Record<string, RateOverride>,
  highlightKeys: [] as string[],
};

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      ...empty,
      begin: (projectId) => set({ ...empty, projectId }),
      addPhoto: ({ estimateId, uri, categoryKey, items }) =>
        set((s) => {
          const photoKey = newKey();
          return {
            estimateId: estimateId ?? s.estimateId,
            photos: [...s.photos, { key: photoKey, uri, categoryKey }],
            items: [
              ...s.items,
              ...items.map((i) => ({
                ...i,
                categoryKey,
                photoKey,
                key: newKey(),
              })),
            ],
          };
        }),
      removePhoto: (photoKey) =>
        set((s) => ({
          photos: s.photos.filter((p) => p.key !== photoKey),
          items: s.items.filter((i) => i.photoKey !== photoKey),
        })),
      addItem: (photoKey) =>
        set((s) => {
          const photo = s.photos.find((p) => p.key === photoKey);
          return {
            items: [...s.items, blankItem(photoKey, photo?.categoryKey)],
          };
        }),
      updateItem: (key, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
        })),
      removeItem: (key) =>
        set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      setOverride: (k, o) =>
        set((s) => ({ overrides: { ...s.overrides, [k]: o } })),
      clearOverride: (k) =>
        set((s) => {
          const { [k]: _removed, ...rest } = s.overrides;
          return { overrides: rest };
        }),
      setHighlight: (highlightKeys) => set({ highlightKeys }),
      clear: () => set({ ...empty }),
    }),
    { name: "estimate-draft", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
