import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AppText } from "@/components/AppText";
import { colors, control, radii, spacing } from "@/theme/tokens";

interface Props {
  index: number;
  uri: string | null;
  categoryText: string;
  rateText: string;
  onRemove: () => void;
}

export function PhotoHeader({
  index,
  uri,
  categoryText,
  rateText,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, styles.noThumb]}>
          <Ionicons name="create-outline" size={22} color={colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <AppText bold>
          {t("confirm.photo", { n: index + 1 })} · {categoryText}
        </AppText>
        {rateText ? (
          <AppText variant="label" muted>
            {rateText}
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.delete")}
        onPress={onRemove}
        hitSlop={8}
        style={styles.del}
      >
        <Ionicons name="trash-outline" size={22} color={colors.error} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  noThumb: { alignItems: "center", justifyContent: "center" },
  del: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
});
