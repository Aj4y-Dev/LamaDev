import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { formatRs } from "@/lib/money";
import { colors, control, radii, spacing } from "@/theme/tokens";
import type { DraftEntry } from "./draftStore";

const MAX_THUMBS = 3;

export function EntryCard({
  entry,
  onPress,
  onDelete,
}: {
  entry: DraftEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const shown = entry.photos.slice(0, MAX_THUMBS);
  const extra = entry.photos.length - shown.length;
  return (
    <Card onPress={onPress} accessibilityLabel={entry.workName}>
      <View style={styles.row}>
        <View style={styles.thumbs}>
          {shown.map((p) => (
            <Image
              key={p.key}
              source={{ uri: p.uri }}
              style={styles.thumb}
              accessibilityIgnoresInvertColors
            />
          ))}
          {extra > 0 ? (
            <View style={[styles.thumb, styles.more]}>
              <AppText variant="label" bold>
                +{extra}
              </AppText>
            </View>
          ) : null}
          {shown.length === 0 ? (
            <View style={[styles.thumb, styles.more]}>
              <Ionicons
                name="image-outline"
                size={22}
                color={colors.textMuted}
              />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <AppText bold>{entry.workName}</AppText>
          <AppText variant="label" muted>
            {entry.photos.length > 0
              ? t("estimate.photoCount", { count: entry.photos.length })
              : t("estimate.noPhotos")}
          </AppText>
          <AppText variant="label" muted>
            {formatRs(entry.rate)} {t(`result.per.${entry.per}`)}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.delete")}
          onPress={onDelete}
          hitSlop={8}
          style={styles.del}
        >
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumbs: {
    flexDirection: "row",
    gap: spacing.xs,
    maxWidth: 140,
    flexWrap: "wrap",
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  more: { alignItems: "center", justifyContent: "center" },
  del: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -spacing.sm,
  },
});
