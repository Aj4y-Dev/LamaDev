import { useMutation, useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects.api';
import { queryClient } from '@/lib/queryClient';

export const projectKeys = { all: ['projects'] as const, one: (id: string) => ['project', id] as const };

export const useProjects = () => useQuery({ queryKey: projectKeys.all, queryFn: projectsApi.list });
export const useProject = (id: string | undefined | null) =>
  useQuery({ queryKey: projectKeys.one(id ?? ''), queryFn: () => projectsApi.get(id as string), enabled: !!id });
export const useCreateProject = () =>
  useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
