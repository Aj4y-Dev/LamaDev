import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AppText } from "./AppText";
import { colors, control, fontSize, radii, spacing } from "@/theme/tokens";

interface Props extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  secureToggle?: boolean;
  suffix?: string;
}

export function TextField({
  label,
  error,
  helper,
  secureToggle,
  suffix,
  style,
  ...rest
}: Props) {
  const { t, i18n } = useTranslation();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="label" bold>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          focused && styles.focused,
          !!error && styles.errorBox,
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          {...rest}
          secureTextEntry={secureToggle ? hidden : rest.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              fontFamily:
                i18n.language === "ne"
                  ? "NotoSansDevanagari_400Regular"
                  : "Inter_400Regular",
            },
            style,
          ]}
        />
        {suffix ? (
          <AppText muted variant="label">
            {suffix}
          </AppText>
        ) : null}
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("common.show") : t("common.hide")}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText
          variant="caption"
          color={colors.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" muted>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  box: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: control.height,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  focused: { borderColor: colors.primary, borderWidth: 2 },
  errorBox: { borderColor: colors.error },
  input: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  eye: {
    minWidth: 32,
    minHeight: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
});
