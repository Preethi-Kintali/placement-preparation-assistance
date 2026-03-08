import { ColorValue } from 'react-native';

type Grad = readonly [ColorValue, ColorValue, ...ColorValue[]];

export const COLORS = {
    // Backgrounds
    bg: '#0f0f1a',
    bgCard: '#1a1a2e',
    bgCardAlt: '#16213e',
    bgInput: '#1e1e35',
    bgBorder: '#2a2a45',

    // Accent
    primary: '#6c63ff',
    primaryLight: '#8b85ff',
    secondary: '#00d4aa',
    secondaryLight: '#00f0c0',
    accent: '#ff6b6b',

    // Text
    text: '#f0f0ff',
    textMuted: '#a0a0c0',
    textDim: '#6060a0',

    // Status
    success: '#00d4aa',
    warning: '#ffa726',
    error: '#ff5252',
    locked: '#444466',

    // Gradients — typed as const tuples so LinearGradient accepts them
    gradPrimary: ['#6c63ff', '#9c5fff'] as Grad,
    gradSecondary: ['#00d4aa', '#0099ff'] as Grad,
    gradCard: ['#1a1a2e', '#16213e'] as Grad,
    gradDanger: ['#ff6b6b', '#ff3d3d'] as Grad,
};
