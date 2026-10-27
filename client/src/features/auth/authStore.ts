import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

interface AuthState {
  token: string | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
  clearToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  ready: false,
  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      set({ token, ready: true });
    } catch {
      set({ token: null, ready: true });
    }
  },
  setToken: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token });
  },
  clearToken: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null });
  },
}));
