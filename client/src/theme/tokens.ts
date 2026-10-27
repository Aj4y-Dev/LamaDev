export const colors = {
  primary: '#1D4ED8',
  primaryPressed: '#1E40AF',
  primarySoft: '#DBEAFE',
  onPrimary: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#475569',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  success: '#166534',
  successSoft: '#DCFCE7',
  warning: '#92400E',
  warningSoft: '#FEF3C7',
  error: '#B91C1C',
  errorSoft: '#FEE2E2',
  skeleton: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.5)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radii = { sm: 8, md: 12, lg: 16 } as const;
export const control = { height: 54, minTouch: 48 } as const;

export const fontSize = { caption: 12, label: 14, body: 16, title: 20, heading: 24, total: 34 } as const;
export const lineHeight = { caption: 18, label: 20, body: 24, title: 28, heading: 32, total: 42 } as const;

export type Tone = 'success' | 'warning' | 'error' | 'info';
export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  error: { fg: colors.error, bg: colors.errorSoft },
  info: { fg: colors.primary, bg: colors.primarySoft },
};
