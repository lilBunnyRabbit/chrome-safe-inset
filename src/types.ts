/**
 * Safe area insets for the CDP `Emulation.setSafeAreaInsetsOverride` method.
 *
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setSafeAreaInsetsOverride
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#type-SafeAreaInsets
 */
export interface SafeAreaInsets {
  top?: number;
  topMax?: number;
  bottom?: number;
  bottomMax?: number;
  left?: number;
  leftMax?: number;
  right?: number;
  rightMax?: number;
}

export interface Preset {
  name: string;
  description: string;
  viewport: { width: number; height: number };
  insets: SafeAreaInsets;
}

export const INSET_KEYS: (keyof SafeAreaInsets)[] = [
  "top",
  "bottom",
  "left",
  "right",
  "topMax",
  "bottomMax",
  "leftMax",
  "rightMax",
];
