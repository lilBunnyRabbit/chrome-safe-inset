#!/usr/bin/env bun
import packageJson from "../package.json" with { type: "json" };
import { PORT, CHROME_BIN, USER_DATA_DIR, VERBOSE } from "./config";
import { connect, type CdpClient } from "./cdp";
import { dim, boldCyan } from "./style";

// --- Lifecycle ---

let chromeProc: ReturnType<typeof Bun.spawn> | null = null;
let cdpClient: CdpClient | null = null;
let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(dim("\nShutting down..."));

  if (cdpClient) {
    try {
      cdpClient.close();
    } catch {}
    cdpClient = null;
  }

  if (chromeProc) {
    chromeProc.kill();
    chromeProc = null;
  }

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// --- Stream logging (Chrome output, verbose only) ---

function pipeStream(stream: ReadableStream<Uint8Array>) {
  if (!VERBOSE) return;

  const decoder = new TextDecoder("utf-8", { stream: true });

  (async () => {
    for await (const chunk of stream) {
      for (const line of decoder.decode(chunk).split("\n")) {
        if (line.length > 0) {
          console.log(dim(`[chrome] ${line.trimEnd()}`));
        }
      }
    }
  })();
}

// --- Main ---

const title = ` chrome-safe-inset v${packageJson.version} `;
const cols = process.stdout.columns || 80;
const side = Math.max(0, Math.floor((cols - title.length) / 2));
const tildes = (n: number) => dim("~".repeat(n));
console.log(`${tildes(side)}${boldCyan(title)}${tildes(cols - side - title.length)}\n`);

chromeProc = Bun.spawn(
  [
    CHROME_BIN,
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
  { stdout: "pipe", stderr: "pipe" },
);

pipeStream(chromeProc.stdout);
pipeStream(chromeProc.stderr);

chromeProc.exited.then(() => shutdown());

cdpClient = await connect({ onShutdown: shutdown });
