import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from './authStore';
import { useDraftStore } from '@/features/estimates/draftStore';
import { useResultStore } from '@/features/estimates/resultStore';
import { queryClient } from '@/lib/queryClient';

export async function logoutAll(): Promise<void> {
  await useAuthStore.getState().clearToken();
  queryClient.clear();
  useDraftStore.getState().clear();
  useResultStore.getState().clear();
}

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (r) => useAuthStore.getState().setToken(r.token),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (r) => useAuthStore.getState().setToken(r.token),
  });
}
