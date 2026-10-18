import { Text, TextProps, TextStyle } from 'react-native';
import { colors, fontFamily, type as typeScale } from '../theme';

type Props = TextProps & {
  variant?: keyof typeof typeScale;
  color?: string;
  weight?: TextStyle['fontWeight'];
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

export function Txt({ variant = 'body', color = colors.text, weight, tabular, align, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        typeScale[variant],
        { color, fontFamily },
        weight ? { fontWeight: weight } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
