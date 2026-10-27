import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EstimateItem, RateOverride } from '@/api/types';
import { UNKNOWN_CATEGORY } from '@/lib/constants';

export interface DraftItem extends EstimateItem { key: string }

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const blankItem = (): DraftItem => ({
  key: newKey(), categoryKey: UNKNOWN_CATEGORY, label: '', length: '', breadth: '', count: null, unit: 'ft',
});

interface DraftState {
  estimateId: string | null;
  projectId: string | null;
  items: DraftItem[];
  overrides: Record<string, RateOverride>;
  highlightKeys: string[];
  start: (p: { estimateId: string | null; projectId: string; items: EstimateItem[] }) => void;
  setEstimateId: (id: string) => void;
  addItem: () => void;
  updateItem: (key: string, patch: Partial<EstimateItem>) => void;
  removeItem: (key: string) => void;
  setOverride: (categoryKey: string, o: RateOverride) => void;
  clearOverride: (categoryKey: string) => void;
  setHighlight: (keys: string[]) => void;
  clear: () => void;
}

const empty = { estimateId: null, projectId: null, items: [] as DraftItem[], overrides: {}, highlightKeys: [] as string[] };

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      ...empty,
      start: ({ estimateId, projectId, items }) =>
        set({ ...empty, estimateId, projectId, items: items.map((i) => ({ ...i, key: i.id ?? newKey() })) }),
      setEstimateId: (estimateId) => set({ estimateId }),
      addItem: () => set((s) => ({ items: [...s.items, blankItem()] })),
      updateItem: (key, patch) =>
        set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) })),
      removeItem: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      setOverride: (k, o) => set((s) => ({ overrides: { ...s.overrides, [k]: o } })),
      clearOverride: (k) =>
        set((s) => {
          const { [k]: _removed, ...rest } = s.overrides;
          return { overrides: rest };
        }),
      setHighlight: (highlightKeys) => set({ highlightKeys }),
      clear: () => set({ ...empty }),
    }),
    { name: 'estimate-draft', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
