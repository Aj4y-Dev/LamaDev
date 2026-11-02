import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CalcMode, EstimateItem, RateType } from "@/api/types";
import type { PickedImage } from "@/lib/image";
import { workKey } from "@/lib/slug";

export interface DraftPhoto {
  key: string;
  uri: string;
  width: number;
  height: number;
  /** null until the photo has been read. [] means it was read but nothing could be found. */
  items: EstimateItem[] | null;
  /** Lines with digits on the photo that could not be read. The person has to add these by hand. */
  skipped: number;
}
export interface DraftEntry {
  key: string;
  workName: string;
  per: RateType;
  rate: string;
  photos: DraftPhoto[];
}

const newKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const toPhoto = (i: PickedImage): DraftPhoto => ({
  key: newKey(),
  uri: i.uri,
  width: i.width,
  height: i.height,
  items: null,
  skipped: 0,
});

interface DraftState {
  projectId: string | null;
  estimateId: string | null;
  mode: CalcMode;
  entries: DraftEntry[];
  begin: (projectId: string) => void;
  upsertEntry: (p: {
    workName: string;
    rate: string;
    per: RateType;
    images: PickedImage[];
  }) => void;
  updateEntry: (
    key: string,
    patch: { workName?: string; rate?: string; per?: RateType },
  ) => void;
  addPhotos: (entryKey: string, images: PickedImage[]) => void;
  removePhoto: (entryKey: string, photoKey: string) => void;
  removeEntry: (key: string) => void;
  setPhotoItems: (
    entryKey: string,
    photoKey: string,
    items: EstimateItem[],
    skipped?: number,
  ) => void;
  updateLine: (
    entryKey: string,
    photoKey: string,
    index: number,
    patch: Partial<EstimateItem>,
  ) => void;
  removeLine: (entryKey: string, photoKey: string, index: number) => void;
  addLine: (entryKey: string, photoKey: string) => void;
  setEstimateId: (id: string) => void;
  setMode: (m: CalcMode) => void;
  clear: () => void;
}

const empty = {
  projectId: null as string | null,
  estimateId: null as string | null,
  mode: "decimal" as CalcMode,
  entries: [] as DraftEntry[],
};

/** Applies a change to one photo of one work. */
function mapPhoto(
  entries: DraftEntry[],
  entryKey: string,
  photoKey: string,
  fn: (p: DraftPhoto) => DraftPhoto,
): DraftEntry[] {
  return entries.map((e) =>
    e.key === entryKey
      ? { ...e, photos: e.photos.map((p) => (p.key === photoKey ? fn(p) : p)) }
      : e,
  );
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      ...empty,
      begin: (projectId) => set({ ...empty, projectId }),
      upsertEntry: ({ workName, rate, per, images }) =>
        set((s) => {
          const key = workKey(workName);
          const photos = images.map(toPhoto);
          const idx = s.entries.findIndex((e) => e.key === key);
          if (idx === -1)
            return {
              entries: [
                ...s.entries,
                { key, workName: workName.trim(), per, rate, photos },
              ],
            };
          const entries = s.entries.slice();
          entries[idx] = {
            ...entries[idx],
            rate,
            per,
            photos: [...entries[idx].photos, ...photos],
          };
          return { entries };
        }),
      updateEntry: (key, patch) =>
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.key !== key) return e;
            const next: DraftEntry = {
              ...e,
              ...patch,
              workName:
                patch.workName !== undefined
                  ? patch.workName.trim()
                  : e.workName,
            };
            if (patch.workName !== undefined) {
              const candidate = workKey(next.workName);
              if (!s.entries.some((o) => o !== e && o.key === candidate))
                next.key = candidate;
            }
            return next;
          }),
        })),
      addPhotos: (entryKey, images) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.key === entryKey
              ? { ...e, photos: [...e.photos, ...images.map(toPhoto)] }
              : e,
          ),
        })),
      removePhoto: (entryKey, photoKey) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.key === entryKey
              ? { ...e, photos: e.photos.filter((p) => p.key !== photoKey) }
              : e,
          ),
        })),
      removeEntry: (key) =>
        set((s) => ({ entries: s.entries.filter((e) => e.key !== key) })),
      setPhotoItems: (entryKey, photoKey, items, skipped = 0) =>
        set((s) => ({
          entries: mapPhoto(s.entries, entryKey, photoKey, (p) => ({
            ...p,
            items,
            skipped,
          })),
        })),
      // A person changed a line: it is no longer "unsure", and the old written result no longer applies.
      updateLine: (entryKey, photoKey, index, patch) =>
        set((s) => ({
          entries: mapPhoto(s.entries, entryKey, photoKey, (p) => ({
            ...p,
            items: (p.items ?? []).map((it, i) =>
              i === index ? { ...it, ...patch } : it,
            ),
          })),
        })),
      removeLine: (entryKey, photoKey, index) =>
        set((s) => ({
          entries: mapPhoto(s.entries, entryKey, photoKey, (p) => ({
            ...p,
            items: (p.items ?? []).filter((_, i) => i !== index),
          })),
        })),
      addLine: (entryKey, photoKey) =>
        set((s) => ({
          entries: mapPhoto(s.entries, entryKey, photoKey, (p) => ({
            ...p,
            items: [
              ...(p.items ?? []),
              {
                categoryKey: entryKey,
                label: "",
                length: "",
                breadth: null,
                count: null,
                unit: "ft",
                expr: "",
              },
            ],
          })),
        })),
      setEstimateId: (estimateId) => set({ estimateId }),
      setMode: (mode) => set({ mode }),
      clear: () => set({ ...empty }),
    }),
    {
      name: "estimate-draft-v3",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
