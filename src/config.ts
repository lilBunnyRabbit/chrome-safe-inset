export const PORT = Number(process.env.CDP_PORT) || 9222;
export const CHROME_BIN = process.env.CHROME_BIN || "google-chrome";
export const USER_DATA_DIR = `${import.meta.dir}/../.data-dirs/${Bun.argv[2] || "default"}`;
export const VERBOSE = Bun.argv.includes("--verbose");
export const NO_VIEWPORT = Bun.argv.includes("--no-viewport");
import overlayScript from "./overlay.js" with { type: "text" };
export const OVERLAY_SCRIPT = overlayScript;
