#!/usr/bin/env bun
import CDP from 'chrome-remote-interface';
import packageJson from './package.json' with { type: 'json' };
import presets from './presets.json' with { type: 'json' };

const presetNames = Object.keys(presets);

console.log(`~~~ chrome-safe-inset v${packageJson.version} ~~~`);

const PORT = 9222;

const USER_DATA_DIR = Bun.argv[2] ? `${import.meta.dir}/.data-dirs/${Bun.argv[2]}` : `${import.meta.dir}/default`;  

const SCRIPT = `
if (!window.insetOverlay) {
  const overlay = document.createElement("div");
  overlay.id = "safe-area-inset-overlay";
  overlay.style = "position: absolute; top: 0; left: 0; bottom: 0; right: 0; pointer-events: none; border-style: solid; border-color: #ff00001a; border-width: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); z-index: 999999;";

  window.insetOverlay = overlay;

  window.showInsetOverlay = () => {
    if (window.insetOverlay.parentElement !== document.body) {
      document.body.appendChild(window.insetOverlay);
    }
  }

  window.hideInsetOverlay = () => {
    if (window.insetOverlay.parentElement === document.body) {
      document.body.removeChild(window.insetOverlay);
    }
  }

  window.showInsetOverlay();
}
`;

/**
 * Represents the safe area insets for overriding system UI regions.
 * 
 * See:
 * https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setSafeAreaInsetsOverride
 * https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#type-SafeAreaInsets 
 */
interface SafeAreaInsets {
  /** Overrides safe-area-inset-top. */
  top?: number;
  /** Overrides safe-area-max-inset-top (optional). */
  topMax?: number;
  /** Overrides safe-area-inset-bottom. */
  bottom?: number;
  /** Overrides safe-area-max-inset-bottom (optional). */
  bottomMax?: number;
  /** Overrides safe-area-inset-left. */
  left?: number;
  /** Overrides safe-area-max-inset-left (optional). */
  leftMax?: number;
  /** Overrides safe-area-inset-right. */
  right?: number;
  /** Overrides safe-area-max-inset-right (optional). */
  rightMax?: number;
}

const keys: (keyof SafeAreaInsets)[] = ['top', 'bottom', 'left', 'right', 'topMax', 'bottomMax', 'leftMax', 'rightMax'];

const startCdp = async () => {
  console.log("[cdp] Starting CDP");
  const { Emulation, Runtime } = await CDP({ port: PORT });
  console.log(`[cdp] CDP started on port ${PORT}`);

  console.log("[cdp] Enter safe area insets (e.g. 'top bottom left right topMax bottomMax leftMax rightMax', 'number' or '0' to disable):");
  for await (const line of console) {
    const trimmed = line.trim();

    if (trimmed === "presets") {
      console.log("[cdp] Available presets:", Object.keys(presets));
      continue;
    }

    let insets: SafeAreaInsets;

    if (presetNames.includes(trimmed)) {
      console.log("[cdp] Applying preset:", trimmed);
      const preset = presets[trimmed];
      insets = preset.insets;
    } else {
      const values = trimmed.split(/\s+/).map(v => Number.parseInt(v));
      if (values.length === 1) {
        const value = values[0];
  
        insets = isNaN(value) || !value ? {} : {
          top: value,
          bottom: value,
          left: value,
          right: value,
        }
      } else {
        insets = {};
        for (let i = 0; i < values.length; i++) {
          const key = keys[i];
          if (!key) {
            console.warn("[cdp] Ignoring extra value:", values[i]);
            continue;
          }
  
          insets[key] = isNaN(values[i]) || !values[i] ? 0 : values[i];
        }
      }
    }

    console.log("[cdp] Applying safe area insets:", insets);
    try {
      // @ts-expect-error - this is still experimental
      await Emulation.setSafeAreaInsetsOverride({
        insets,
      });
      console.log("[cdp] Safe area insets applied:", insets);

      await Runtime.evaluate({ expression: SCRIPT });
    } catch (error) {
      console.error("[cdp] Failed to apply safe area insets:", error, insets);
    }
  }
}

let cdpPromise: Promise<void> | null = null;

(async () => {
  const proc = Bun.spawn([
    "google-chrome", 
    `--remote-debugging-port=${PORT}`, 
    `--user-data-dir=${USER_DATA_DIR}`, 
    "--no-first-run", 
    "--no-default-browser-check"
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const decoder = new TextDecoder();

  const readStream = async (stream: ReadableStream<Uint8Array>, color: string) => {
    for await (const chunk of stream) {
      const lines = decoder.decode(chunk).split('\n');
      
      for (const line of lines) {
        console.log(`${color}[browser] ${line.trimEnd()}\x1b[0m`);
        
        // TODO: Is this string enough to guarantee that the DevTools is ready?
        if (!cdpPromise && line.includes("DevTools listening on ws://")) {
          cdpPromise = startCdp().catch(console.error);
        }
      }
    }
  };

  // Read from both streams concurrently
  await Promise.all([
    readStream(proc.stdout, "\x1b[33m"),
    readStream(proc.stderr, "\x1b[31m"),
  ]);
})();
