// The first non-flag argument selects the Chrome profile (and its data dir).
const profile = Bun.argv.slice(2).find((arg) => !arg.startsWith("-")) || "default";

export const PORT = Number(process.env.CDP_PORT) || 9222;

// Default Chrome location per platform; override with the CHROME_BIN env var.
export const CHROME_BIN =
  process.env.CHROME_BIN ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "google-chrome");

export const USER_DATA_DIR = `${import.meta.dir}/../.data-dirs/${profile}`;
export const VERBOSE = Bun.argv.includes("--verbose");
export const NO_VIEWPORT = Bun.argv.includes("--no-viewport");

import overlayScript from "./overlay.js" with { type: "text" };
export const OVERLAY_SCRIPT = overlayScript;
