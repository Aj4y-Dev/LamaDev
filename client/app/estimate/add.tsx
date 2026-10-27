import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import {
  pickFromCamera,
  pickManyFromGallery,
  type PickedImage,
} from "@/lib/image";
import { sanitizeDecimal } from "@/lib/digits";
import { isValidRate } from "@/lib/rate";
import { workKey } from "@/lib/slug";
import { useDraftStore } from "@/features/estimates/draftStore";
import type { RateType } from "@/api/types";
import { colors, control, radii, spacing } from "@/theme/tokens";

const PER_OPTIONS: RateType[] = ["area", "length", "count"];

export default function AddWork() {
  const { entry: entryKey } = useLocalSearchParams<{ entry?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const entries = useDraftStore((s) => s.entries);
  const editing = entryKey
    ? entries.find((e) => e.key === entryKey)
    : undefined;

  const [name, setName] = useState(editing?.workName ?? "");
  const [rate, setRate] = useState(editing?.rate ?? "");
  const [per, setPer] = useState<RateType>(editing?.per ?? "area");
  const [picked, setPicked] = useState<PickedImage[]>([]);
  const [denied, setDenied] = useState(false);
  const [errors, setErrors] = useState({
    name: false,
    rate: false,
    photo: false,
  });

  // Typing a name that is already in the estimate adds the photos to that work.
  const matching =
    !editing && name.trim()
      ? entries.find((e) => e.key === workKey(name))
      : undefined;
  const matchKey = matching?.key;
  useEffect(() => {
    if (matching) {
      setRate(matching.rate);
      setPer(matching.per);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  const takePhoto = async () => {
    const r = await pickFromCamera();
    if (r.status === "denied") setDenied(true);
    if (r.status === "ok") {
      setDenied(false);
      setPicked((p) => [...p, r.image]);
    }
  };
  const choosePhotos = async () => {
    const r = await pickManyFromGallery();
    if (r.status === "denied") setDenied(true);
    if (r.status === "ok") {
      setDenied(false);
      setPicked((p) => [...p, ...r.images]);
    }
  };

  const save = () => {
    const nameOk = name.trim().length > 0;
    const rateOk = isValidRate(rate);
    const photoOk = (editing?.photos.length ?? 0) + picked.length > 0;
    setErrors({ name: !nameOk, rate: !rateOk, photo: !photoOk });
    if (!nameOk || !rateOk || !photoOk) return;
    const store = useDraftStore.getState();
    if (editing) {
      if (picked.length > 0) store.addPhotos(editing.key, picked); // before updateEntry, which can change the key
      store.updateEntry(editing.key, { workName: name, rate, per });
    } else {
      store.upsertEntry({ workName: name, rate, per, images: picked });
    }
    router.back();
  };

  return (
    <Screen
      title={t(editing ? "add.editTitle" : "add.title")}
      onBack={() => router.back()}
      footer={
        <Button
          title={t(editing ? "add.saveChanges" : "add.save")}
          onPress={save}
        />
      }
    >
      <View style={{ gap: spacing.md }}>
        <AppText variant="title" bold>
          {t("add.photos")}
        </AppText>
        <View style={styles.grid}>
          {editing?.photos.map((p) => (
            <View key={p.key}>
              <Image
                source={{ uri: p.uri }}
                style={styles.thumb}
                accessibilityIgnoresInvertColors
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("add.removePhoto")}
                style={styles.x}
                onPress={() =>
                  useDraftStore.getState().removePhoto(editing.key, p.key)
                }
              >
                <Ionicons name="close-circle" size={26} color={colors.error} />
              </Pressable>
            </View>
          ))}
          {picked.map((p, i) => (
            <View key={`${p.uri}-${i}`}>
              <Image
                source={{ uri: p.uri }}
                style={styles.thumb}
                accessibilityIgnoresInvertColors
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("add.removePhoto")}
                style={styles.x}
                onPress={() =>
                  setPicked((all) => all.filter((_, idx) => idx !== i))
                }
              >
                <Ionicons name="close-circle" size={26} color={colors.error} />
              </Pressable>
            </View>
          ))}
        </View>
        <Button
          icon="camera-outline"
          variant="secondary"
          title={t("capture.takePhoto")}
          onPress={takePhoto}
        />
        <Button
          icon="images-outline"
          variant="secondary"
          title={t("capture.gallery")}
          onPress={choosePhotos}
        />
        {denied ? (
          <View style={{ gap: spacing.sm }}>
            <AppText color={colors.error}>{t("capture.denied")}</AppText>
            <Button
              variant="ghost"
              title={t("capture.openSettings")}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : null}
        {errors.photo ? (
          <AppText color={colors.error}>{t("add.photoRequired")}</AppText>
        ) : null}
      </View>

      <TextField
        label={t("add.workName")}
        placeholder={t("add.workNamePlaceholder")}
        autoCapitalize="words"
        value={name}
        onChangeText={setName}
        helper={
          matching ? t("add.sameWork", { name: matching.workName }) : undefined
        }
        error={errors.name ? t("add.nameRequired") : undefined}
      />

      {!editing && entries.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" muted>
            {t("add.alreadyAdded")}
          </AppText>
          <View style={styles.chips}>
            {entries.map((e) => (
              <Pressable
                key={e.key}
                accessibilityRole="button"
                onPress={() => setName(e.workName)}
                style={styles.chip}
              >
                <AppText variant="label">{e.workName}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label" bold>
          {t("add.per")}
        </AppText>
        <View style={styles.chips}>
          {PER_OPTIONS.map((p) => {
            const on = p === per;
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setPer(p)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <AppText
                  variant="label"
                  bold={on}
                  color={on ? colors.onPrimary : colors.text}
                >
                  {t(`result.per.${p}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField
        label={t("add.rate")}
        suffix={`Rs ${t(`result.per.${per}`)}`}
        keyboardType="decimal-pad"
        value={rate}
        onChangeText={(v) => setRate(sanitizeDecimal(v))}
        helper={t("add.rateHint")}
        error={errors.rate ? t("add.rateInvalid") : undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radii.md,
    backgroundColor: colors.border,
  },
  x: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: colors.surface,
    borderRadius: 13,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: control.minTouch,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
