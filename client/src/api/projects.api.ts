import { request } from './client';
import type { CreateProjectInput, Project } from './types';

export const projectsApi = {
  list: () => request<Project[]>('/projects'),
  get: (id: string) => request<Project>(`/projects/${id}`),
  create: (b: CreateProjectInput) => request<Project>('/projects', { method: 'POST', body: b }),
};
