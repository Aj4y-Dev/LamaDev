import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useProject } from "@/features/projects/useProjects";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const project = useProject(id);

  return (
    <Screen
      title={project.data?.title ?? t("projects.title")}
      subtitle={project.data?.clientName ?? undefined}
      onBack={() => router.back()}
      footer={
        <Button
          icon="camera-outline"
          title={t("projects.newEstimate")}
          onPress={() =>
            router.push({
              pathname: "/estimate/build",
              params: { projectId: id, fresh: "1" },
            })
          }
        />
      }
    >
      {project.isPending ? (
        <LoadingState rows={2} />
      ) : project.isError ? (
        <ErrorState error={project.error} onRetry={() => project.refetch()} />
      ) : (
        // The API contract has no "list estimates" endpoint yet, so none is shown.
        <EmptyState
          icon="document-text-outline"
          title={t("projects.noEstimates")}
          body={t("projects.noEstimatesHint")}
        />
      )}
    </Screen>
  );
}
