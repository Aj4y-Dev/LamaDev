import { useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/States';
import { ApiError } from '@/api/client';
import { ImageTooLargeError, pickFromCamera, pickFromGallery, type PickedImage, type PickResult } from '@/lib/image';
import { useExtract } from '@/features/estimates/useExtract';
import { useDraftStore } from '@/features/estimates/draftStore';
import { useNetwork } from '@/hooks/useNetwork';
import { colors, radii, spacing } from '@/theme/tokens';

export default function Capture() {
  const { projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOnline } = useNetwork();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [denied, setDenied] = useState(false);
  const extract = useExtract(projectId);

  const pick = async (fn: () => Promise<PickResult>) => {
    const r = await fn();
    if (r.status === 'denied') setDenied(true);
    if (r.status === 'ok') { setDenied(false); setImage(r.image); extract.reset(); }
  };

  const upload = () => {
    if (!image || extract.isPending) return;
    extract.mutate(image, { onSuccess: (res) => router.replace(`/estimate/${res.id}/confirm`) });
  };

  const manualEntry = () => {
    useDraftStore.getState().start({ estimateId: null, projectId, items: [] });
    router.replace('/estimate/new/confirm');
  };

  const failedExtraction = extract.error instanceof ApiError && extract.error.code === 'EXTRACTION_FAILED';
  const tooLarge = extract.error instanceof ImageTooLargeError;

  if (extract.isPending) {
    return (
      <Screen title={t('capture.title')} footer={<Button variant="secondary" title={t('common.cancel')} onPress={extract.cancel} />}>
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <AppText variant="title" bold>{t('capture.uploading')}</AppText>
          <AppText muted>{t('capture.uploadingHint')}</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('capture.title')}
      onBack={() => router.back()}
      footer={image ? <Button title={t('capture.use')} disabled={!isOnline} onPress={upload} /> : undefined}
    >
      <AppText muted>{t('capture.hint')}</AppText>
      {image ? <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
      <View style={{ gap: spacing.md }}>
        <Button icon="camera-outline" variant={image ? 'secondary' : 'primary'} title={image ? t('capture.retake') : t('capture.takePhoto')} onPress={() => pick(pickFromCamera)} />
        <Button icon="images-outline" variant="secondary" title={t('capture.gallery')} onPress={() => pick(pickFromGallery)} />
      </View>
      {denied ? (
        <View style={{ gap: spacing.sm }}>
          <AppText color={colors.error}>{t('capture.denied')}</AppText>
          <Button variant="ghost" title={t('capture.openSettings')} onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      {tooLarge ? <AppText color={colors.error}>{t('capture.tooLarge')}</AppText> : null}
      {extract.isError && !tooLarge ? (
        <>
          <ErrorState error={extract.error} onRetry={failedExtraction ? undefined : upload} />
          {failedExtraction ? <Button title={t('errors.enterManually')} onPress={manualEntry} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  preview: { width: '100%', height: 320, borderRadius: radii.md, backgroundColor: colors.border },
  progress: { gap: spacing.sm, paddingVertical: spacing.xxxl },
});
