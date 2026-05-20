#!/usr/bin/env bun
import net from "node:net";
import { existsSync } from "node:fs";
import packageJson from "../package.json" with { type: "json" };
import { PORT, CHROME_BIN, USER_DATA_DIR, VERBOSE } from "./config";
import { connect, type CdpClient } from "./cdp";
import { dim, red, boldCyan } from "./style";

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

// --- Port selection ---

/** Resolves true if `port` can be bound on the IPv4 loopback interface. */
function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Finds the first free port at or after `start`.
 *
 * A Chrome left running from a previous session keeps 127.0.0.1:PORT. Reusing
 * that port would make the freshly launched Chrome fall back to an IPv6 port,
 * and CDP commands could land on the stale browser instead — Chrome opens, but
 * nothing the tool sends has any visible effect.
 */
async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 100; port++) {
    if (await portIsFree(port)) return port;
  }
  throw new Error(`No free port available in range ${start}-${start + 99}`);
}

// --- Main ---

const title = ` chrome-safe-inset v${packageJson.version} `;
const cols = process.stdout.columns || 80;
const side = Math.max(0, Math.floor((cols - title.length) / 2));
const tildes = (n: number) => dim("~".repeat(n));
console.log(`${tildes(side)}${boldCyan(title)}${tildes(cols - side - title.length)}\n`);

// Fail early with a clear message if the configured Chrome binary is missing.
if ((CHROME_BIN.includes("/") || CHROME_BIN.includes("\\")) && !existsSync(CHROME_BIN)) {
  console.error(red(`Chrome not found at: ${CHROME_BIN}`));
  console.error(dim("Install Google Chrome, or set CHROME_BIN to its executable path."));
  process.exit(1);
}

const port = await findFreePort(PORT);
if (port !== PORT) {
  console.log(dim(`Port ${PORT} is in use — using port ${port} instead`));
}

chromeProc = Bun.spawn(
  [
    CHROME_BIN,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
  { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
);

pipeStream(chromeProc.stdout);
pipeStream(chromeProc.stderr);

chromeProc.exited.then(() => shutdown());

cdpClient = await connect(port, { onShutdown: shutdown });
