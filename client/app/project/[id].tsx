import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { RateEditor } from "@/features/rates/RateEditor";
import { useRates } from "@/features/rates/useRates";
import { useProject } from "@/features/projects/useProjects";
import { spacing } from "@/theme/tokens";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const project = useProject(id);
  const rates = useRates(id);

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
              pathname: "/estimate/[id]/capture",
              params: { id: "new", projectId: id },
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
        <>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title" bold>
              {t("projects.ratesTitle")}
            </AppText>
            <AppText muted>{t("projects.ratesHint")}</AppText>
          </View>
          {rates.isPending ? (
            <LoadingState rows={3} />
          ) : rates.isError ? (
            <ErrorState error={rates.error} onRetry={() => rates.refetch()} />
          ) : rates.data.length === 0 ? (
            <EmptyState icon="pricetags-outline" title={t("rates.empty")} />
          ) : (
            rates.data.map((r) => (
              <RateEditor key={r.categoryKey} rate={r} projectId={id} />
            ))
          )}
          {/* The API contract has no "list estimates" endpoint yet, so none is shown. */}
          <EmptyState
            icon="document-text-outline"
            title={t("projects.noEstimates")}
            body={t("projects.noEstimatesHint")}
          />
        </>
      )}
    </Screen>
  );
}
