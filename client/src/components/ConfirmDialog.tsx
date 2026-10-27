import { Modal, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { colors, radii, spacing } from '@/theme/tokens';

interface Props {
  visible: boolean; title: string; body?: string;
  confirmLabel: string; cancelLabel: string;
  destructive?: boolean; onConfirm: () => void; onCancel: () => void;
}
export function ConfirmDialog({ visible, title, body, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <AppText variant="title" bold>{title}</AppText>
          {body ? <AppText muted>{body}</AppText> : null}
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title={confirmLabel} variant={destructive ? 'destructive' : 'primary'} onPress={onConfirm} />
            <Button title={cancelLabel} variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.md },
});
