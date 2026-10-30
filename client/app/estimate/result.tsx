import { useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/States";
import { useResultStore } from "@/features/estimates/resultStore";
import { useDraftStore } from "@/features/estimates/draftStore";
import { useConfirmEstimate } from "@/features/estimates/useGenerate";
import { useProject } from "@/features/projects/useProjects";
import { ReportView } from "@/features/report/ReportView";
import { buildReportHtml } from "@/features/report/buildReportHtml";
import { exportPdf } from "@/features/report/exportPdf";
import { exportJpg } from "@/features/report/exportJpg";
import { useNetwork } from "@/hooks/useNetwork";
import { errorKey } from "@/lib/errors";
import { colors, spacing } from "@/theme/tokens";

export default function Result() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const { estimateId, projectId, result, confirmed } = useResultStore();
  const entries = useDraftStore((s) => s.entries);
  const project = useProject(projectId);
  const confirm = useConfirmEstimate();
  const reportRef = useRef<ComponentRef<typeof View>>(null);
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);
  const [exportError, setExportError] = useState(false);

  if (!result || !estimateId) {
    return (
      <Screen title={t("result.title")} onBack={() => router.replace("/")}>
        <EmptyState title={t("result.none")} body={t("result.noneHint")} />
      </Screen>
    );
  }

  const title = project.data?.title ?? t("common.appName");
  const labelFor = (id: string) =>
    entries
      .flatMap((e) => e.photos.flatMap((p) => p.items ?? []))
      .find((i) => i.id === id)?.label ?? id;

  const run = async (kind: "pdf" | "image") => {
    setBusy(kind);
    setExportError(false);
    try {
      if (kind === "pdf") {
        await exportPdf(
          buildReportHtml(result, {
            language: i18n.language === "ne" ? "ne" : "en",
            projectTitle: title,
            clientName: project.data?.clientName,
            date,
          }),
        );
      } else {
        await exportJpg(reportRef);
      }
    } catch {
      setExportError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title={t("result.title")}
      onBack={() => router.replace(confirmed ? "/" : "/estimate/build")}
      footer={
        <>
          {exportError ? (
            <AppText variant="caption" color={colors.error}>
              {t("result.exportFailed")}
            </AppText>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                icon="document-text-outline"
                title={t("result.downloadPdf")}
                loading={busy === "pdf"}
                disabled={busy !== null}
                onPress={() => run("pdf")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                icon="image-outline"
                variant="secondary"
                title={t("result.saveImage")}
                loading={busy === "image"}
                disabled={busy !== null}
                onPress={() => run("image")}
              />
            </View>
          </View>
          {confirmed ? (
            <>
              <StatusBadge tone="success" text={t("result.saved")} />
              <Button
                variant="ghost"
                title={t("result.done")}
                onPress={() => router.replace("/")}
              />
            </>
          ) : (
            <>
              {confirm.isError ? (
                <AppText variant="caption" color={colors.error}>
                  {t(errorKey(confirm.error))}
                </AppText>
              ) : null}
              <Button
                variant="secondary"
                title={t("result.save")}
                loading={confirm.isPending}
                disabled={!isOnline}
                onPress={() => confirm.mutate(estimateId)}
              />
            </>
          )}
        </>
      }
    >
      {result.invalid.length > 0 ? (
        <Card accent="error">
          <AppText bold>{t("result.notCounted")}</AppText>
          {result.invalid.map((i) => (
            <AppText key={i.id} muted>
              {labelFor(i.id)}: {i.reason}
            </AppText>
          ))}
          <AppText variant="label" muted>
            {t("result.notCountedHint")}
          </AppText>
          {!confirmed ? (
            <Button
              compact
              variant="secondary"
              title={t("result.editWork")}
              onPress={() => router.replace("/estimate/build")}
            />
          ) : null}
        </Card>
      ) : null}

      {(result.warnings?.length ?? 0) > 0 ? (
        <Card accent="warning">
          <AppText bold>{t("result.checkTitle")}</AppText>
          <AppText variant="label" muted>
            {t("result.checkHint")}
          </AppText>
          {result.groups
            .flatMap((g) => g.items)
            .filter((l) => l.check)
            .map((l) => (
              <AppText key={l.id}>
                {l.label || l.id}: {l.size}
              </AppText>
            ))}
        </Card>
      ) : null}

      <ReportView
        viewRef={reportRef}
        result={result}
        projectTitle={title}
        clientName={project.data?.clientName}
        date={date}
      />

      {!confirmed ? (
        <Button
          variant="ghost"
          icon="create-outline"
          title={t("result.editWork")}
          onPress={() => router.replace("/estimate/build")}
        />
      ) : null}
    </Screen>
  );
}
