import { PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

type ThemedTextProps = PropsWithChildren<
  TextProps & {
    lightColor?: string;
    darkColor?: string;
    type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  }
>;

export function ThemedText({
  style,
  type = 'default',
  lightColor,
  darkColor,
  ...rest
}: ThemedTextProps) {
  const colorKey = type === 'link' ? 'tint' : 'text';
  const color = useThemeColor({ light: lightColor, dark: darkColor }, colorKey);

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 36,
  },
  defaultSemiBold: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
  },
});

