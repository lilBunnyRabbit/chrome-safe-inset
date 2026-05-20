import { createInterface } from "readline";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import CDP from "chrome-remote-interface";
import { OVERLAY_SCRIPT, NO_VIEWPORT } from "./config";
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
${env("CHROME_BIN", "Path to Chrome binary", "auto-detected")}
${env("CDP_PORT", "DevTools Protocol port", "9222")}

${bold("Flags:")}
${flag("--verbose", "Show Chrome browser output")}
${flag("--no-viewport", "Don't override viewport when applying presets")}
`);
}

/**
 * Copies a PNG buffer to the OS clipboard.
 * Returns an error message on failure, or null on success.
 */
async function copyImageToClipboard(buffer: Buffer): Promise<string | null> {
  const run = async (cmd: string[], stdin?: Blob) => {
    try {
      const proc = Bun.spawn(cmd, stdin ? { stdin } : undefined);
      await proc.exited;
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  };

  if (process.platform === "darwin") {
    const tmp = join(tmpdir(), `chrome-safe-inset-${Date.now()}.png`);
    await Bun.write(tmp, buffer);
    const script = `set the clipboard to (read (POSIX file ${JSON.stringify(tmp)}) as «class PNGf»)`;
    const ok = await run(["osascript", "-e", script]);
    await unlink(tmp).catch(() => {});
    return ok ? null : "Failed to copy to clipboard via osascript";
  }

  if (process.platform === "win32") {
    const tmp = join(tmpdir(), `chrome-safe-inset-${Date.now()}.png`);
    await Bun.write(tmp, buffer);
    const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${tmp}'))`;
    const ok = await run(["powershell", "-NoProfile", "-Command", ps]);
    await unlink(tmp).catch(() => {});
    return ok ? null : "Failed to copy to clipboard via PowerShell";
  }

  // Linux: X11 (xclip) or Wayland (wl-copy)
  const blob = new Blob([buffer]);
  if (await run(["xclip", "-selection", "clipboard", "-t", "image/png"], blob)) return null;
  if (await run(["wl-copy", "--type", "image/png"], blob)) return null;
  return "Failed to copy — install xclip (X11) or wl-clipboard (Wayland)";
}

interface CdpSessionOptions {
  onShutdown: () => void;
}

/**
 * Connects to Chrome via CDP and runs the interactive input loop.
 * Returns the CDP client for external cleanup.
 */
async function startSession(port: number, { onShutdown }: CdpSessionOptions) {
  console.log(dim("Connecting to Chrome..."));

  // Pin to IPv4: Chrome's debugging server listens on 127.0.0.1, but "localhost"
  // can resolve to ::1 first (common on macOS), connecting us to nothing — or to
  // a different Chrome that grabbed the IPv6 port.
  const client = await CDP({ host: "127.0.0.1", port });
  const { Emulation, Runtime, Page } = client;
  console.log(dim(`Connected on port ${port}`));

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
            const error = await copyImageToClipboard(buffer);
            if (error) {
              console.error(red(error));
            } else {
              console.log(green("Copied to clipboard"));
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
export async function connect(port: number, options: CdpSessionOptions, maxRetries = 10, initialDelay = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await startSession(port, options);
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
