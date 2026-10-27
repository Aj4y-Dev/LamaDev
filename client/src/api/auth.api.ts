import { request } from './client';
import type { AuthResponse, User } from './types';

interface Credentials { email: string; password: string }
export const authApi = {
  register: (b: Credentials) => request<AuthResponse>('/auth/register', { method: 'POST', body: b, auth: false }),
  login: (b: Credentials) => request<AuthResponse>('/auth/login', { method: 'POST', body: b, auth: false }),
  me: () => request<User>('/users/me'),
};
