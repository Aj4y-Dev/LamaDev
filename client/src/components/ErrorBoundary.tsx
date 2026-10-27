import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import i18n from '@/i18n';
import { AppText } from './AppText';
import { colors, spacing } from '@/theme/tokens';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.background }}>
        <AppText variant="title" bold style={{ textAlign: 'center' }}>{i18n.t('errors.boundary')}</AppText>
      </View>
    );
  }
}
