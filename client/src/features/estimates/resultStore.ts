import { create } from 'zustand';
import type { CalculateResponse } from '@/api/types';

interface ResultState {
  estimateId: string | null;
  projectId: string | null;
  result: CalculateResponse | null;
  confirmed: boolean;
  set: (p: { estimateId: string; projectId: string | null; result: CalculateResponse }) => void;
  markConfirmed: () => void;
  clear: () => void;
}

export const useResultStore = create<ResultState>((set) => ({
  estimateId: null, projectId: null, result: null, confirmed: false,
  set: ({ estimateId, projectId, result }) => set({ estimateId, projectId, result, confirmed: false }),
  markConfirmed: () => set({ confirmed: true }),
  clear: () => set({ estimateId: null, projectId: null, result: null, confirmed: false }),
}));
