import { Text, type TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, lineHeight } from '@/theme/tokens';

type Variant = keyof typeof fontSize;
interface Props extends TextProps {
  variant?: Variant;
  bold?: boolean;
  muted?: boolean;
  color?: string;
}

const FAMILY = {
  en: { regular: 'Inter_400Regular', bold: 'Inter_600SemiBold' },
  ne: { regular: 'NotoSansDevanagari_400Regular', bold: 'NotoSansDevanagari_600SemiBold' },
};

export function AppText({ variant = 'body', bold, muted, color, style, ...rest }: Props) {
  const { i18n } = useTranslation();
  const fam = FAMILY[i18n.language === 'ne' ? 'ne' : 'en'];
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: bold ? fam.bold : fam.regular, fontSize: fontSize[variant], lineHeight: lineHeight[variant], color: color ?? (muted ? colors.textMuted : colors.text) },
        style,
      ]}
    />
  );
}
