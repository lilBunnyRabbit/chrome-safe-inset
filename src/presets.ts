import data from "./presets.json" with { type: "json" };
import { bold, cyan, dim, yellow } from "./style";
import type { Preset, SafeAreaInsets } from "./types";
import { INSET_KEYS } from "./types";

export const presetMap = data as Record<string, Preset>;
export const presetNames = Object.keys(presetMap);

export function printPresets() {
  const maxKey = Math.max(...presetNames.map((k) => k.length));
  const maxName = Math.max(...presetNames.map((k) => presetMap[k].name.length));

  console.log(`\n${bold("Available presets:")}\n`);
  for (const key of presetNames) {
    const p = presetMap[key];
    console.log(`  ${cyan(key.padEnd(maxKey))}  ${p.name.padEnd(maxName)}  ${dim(p.description)}`);
  }
  console.log();
}

export function parseInsets(input: string): SafeAreaInsets {
  const values = input.split(/\s+/).map((v) => Number.parseInt(v));

  if (values.length === 1) {
    const value = values[0];
    if (isNaN(value) || !value) return {};
    return { top: value, bottom: value, left: value, right: value };
  }

  const insets: SafeAreaInsets = {};
  for (let i = 0; i < values.length; i++) {
    const key = INSET_KEYS[i];
    if (!key) {
      console.warn(yellow("Ignoring extra value:"), values[i]);
      continue;
    }
    insets[key] = isNaN(values[i]) || !values[i] ? 0 : values[i];
  }
  return insets;
}
