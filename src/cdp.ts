import { createInterface } from "readline";
import CDP from "chrome-remote-interface";
import { PORT, OVERLAY_SCRIPT, NO_VIEWPORT } from "./config";
import { presetMap, presetNames, printPresets, parseInsets } from "./presets";
import { dim, bold, cyan, green, red } from "./style";
import type { Preset, SafeAreaInsets } from "./types";

export type CdpClient = Awaited<ReturnType<typeof CDP>>;

function showHelp() {
  // Pad visible text then apply color, so ANSI codes don't break alignment
  const cmd = (name: string, desc: string) => `  ${cyan(name.padEnd(20))} ${desc}`;
  const env = (name: string, desc: string, def: string) => `  ${cyan(name.padEnd(16))} ${desc} ${dim(`(default: ${def})`)}`;
  const flag = (name: string, desc: string) => `  ${cyan(name.padEnd(16))} ${desc}`;

  console.log(`
${bold("Usage:")} chrome-safe-inset [profile-name] [--verbose]

${bold("Commands:")}
${cmd("<number>", `Apply uniform inset to all sides (${cyan("0")} to disable)`)}
${cmd("<t b l r> [...]", "Apply individual insets")}
${cmd("presets", "List available device presets")}
${cmd("<preset-name>", "Apply a device preset (insets + viewport)")}
${cmd("screenshot [name]", "Save a screenshot as PNG")}
${cmd("screenshot copy", "Copy screenshot to clipboard")}
${cmd("help", "Show this help message")}
${cmd("quit / exit", "Close Chrome and exit")}

${bold("Environment variables:")}
${env("CHROME_BIN", "Path to Chrome binary", "google-chrome")}
${env("CDP_PORT", "DevTools Protocol port", "9222")}

${bold("Flags:")}
${flag("--verbose", "Show Chrome browser output")}
${flag("--no-viewport", "Don't override viewport when applying presets")}
`);
}

interface CdpSessionOptions {
  onShutdown: () => void;
}

/**
 * Connects to Chrome via CDP and runs the interactive input loop.
 * Returns the CDP client for external cleanup.
 */
async function startSession({ onShutdown }: CdpSessionOptions) {
  console.log(dim("Connecting to Chrome..."));

  const client = await CDP({ port: PORT });
  const { Emulation, Runtime, Page } = client;
  console.log(dim(`Connected on port ${PORT}`));

  // Register overlay so it persists across navigations
  await Page.enable();
  await Page.addScriptToEvaluateOnNewDocument({ source: OVERLAY_SCRIPT });

  const promptStr = dim("inset") + cyan(" > ");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: promptStr,
    tabSize: 4,
  });

  showHelp();
  rl.prompt();

  return new Promise<typeof client>((resolve) => {
    rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      // --- Commands ---

      if (input === "help") {
        showHelp();
        rl.prompt();
        return;
      }

      if (input === "quit" || input === "exit") {
        rl.close();
        onShutdown();
        resolve(client);
        return;
      }

      if (input === "presets") {
        printPresets();
        rl.prompt();
        return;
      }

      if (input === "screenshot" || input.startsWith("screenshot ")) {
        const arg = input.split(/\s+/)[1];
        try {
          const { data } = await Page.captureScreenshot({ format: "png" });
          const buffer = Buffer.from(data, "base64");

          if (arg === "copy") {
            const proc = Bun.spawn(["xclip", "-selection", "clipboard", "-t", "image/png"], {
              stdin: new Blob([buffer]),
            });
            await proc.exited;
            if (proc.exitCode === 0) {
              console.log(green("Copied to clipboard"));
            } else {
              console.error(red("Failed to copy — is xclip installed?"));
            }
          } else {
            const name = arg || `screenshot-${Date.now()}`;
            const filename = name.endsWith(".png") ? name : `${name}.png`;
            await Bun.write(filename, buffer);
            console.log(`${green("Saved:")} ${filename}`);
          }
        } catch (error) {
          console.error(red("Screenshot failed:"), error);
        }
        rl.prompt();
        return;
      }

      // --- Resolve insets (and optional viewport) ---

      let insets: SafeAreaInsets;
      let viewport: Preset["viewport"] | null = null;

      if (presetNames.includes(input)) {
        const preset = presetMap[input];
        insets = preset.insets;
        viewport = NO_VIEWPORT ? null : preset.viewport;
        console.log(`${cyan("Preset:")} ${preset.name}`);
      } else {
        insets = parseInsets(input);
      }

      // --- Apply ---

      try {
        // @ts-expect-error — experimental CDP method
        await Emulation.setSafeAreaInsetsOverride({ insets });

        const { top = 0, bottom = 0, left = 0, right = 0 } = insets;
        console.log(
          `${green("Insets:")} top=${green(String(top))} bottom=${green(String(bottom))} left=${green(String(left))} right=${green(String(right))}`,
        );

        if (viewport) {
          await Emulation.setDeviceMetricsOverride({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 0,
            mobile: true,
          });
          console.log(`${green("Viewport:")} ${green(`${viewport.width}x${viewport.height}`)}`);
        }

        // Inject overlay into current page immediately
        await Runtime.evaluate({ expression: OVERLAY_SCRIPT });
      } catch (error) {
        console.error(red("Failed to apply:"), error);
      }

      rl.prompt();
    });

    rl.on("close", () => {
      resolve(client);
    });
  });
}

/**
 * Attempts to connect to CDP with exponential backoff.
 */
export async function connect(options: CdpSessionOptions, maxRetries = 10, initialDelay = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await startSession(options);
    } catch {
      if (attempt === maxRetries) {
        console.error(red(`Failed to connect after ${maxRetries} attempts.`));
        options.onShutdown();
        return null;
      }

      const delay = Math.round(initialDelay * 1.5 ** (attempt - 1));
      console.log(dim(`Connection attempt ${attempt} failed, retrying in ${delay}ms...`));
      await Bun.sleep(delay);
    }
  }

  return null;
}
