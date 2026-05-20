# chrome-safe-inset

Test CSS `safe-area-inset-*` properties in Chrome using the experimental CDP `setSafeAreaInsetsOverride` method.

There aren't really any other free tools that let you do this easily. Hopefully this gets built into DevTools soon, but for now this works.

## Requirements

| Software | Notes |
| --- | --- |
| [Bun](https://bun.sh) | `1.0+` — the runtime this tool is written for. Replaces Node.js. |
| [Google Chrome](https://www.google.com/chrome/) | A recent version. The tool drives Chrome through the DevTools Protocol; the `setSafeAreaInsetsOverride` method is experimental and only exists in newer builds. Chromium also works (set `CHROME_BIN`). |

Optional, for `screenshot copy` on **Linux only**: `xclip` (X11) or `wl-clipboard` (Wayland). macOS and Windows copy to the clipboard with built-in tools.

## Setup

### 1. Install Bun

**macOS / Linux:**

```sh
curl -fsSL https://bun.sh/install | bash
```

(macOS users with Homebrew can instead run `brew install oven-sh/bun/bun`.)

**Windows** (PowerShell):

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Restart your terminal, then confirm it works:

```sh
bun --version
```

### 2. Install Google Chrome

The tool launches Chrome from a known path per platform. If your Chrome is somewhere else, point `CHROME_BIN` at it (see [Environment variables](#environment-variables)).

| Platform | Install | Default path the tool looks for |
| --- | --- | --- |
| **macOS** | Download from [google.com/chrome](https://www.google.com/chrome/) and drag to `Applications`. | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| **Linux** | Debian/Ubuntu: `sudo apt install ./google-chrome-stable_current_amd64.deb`. Fedora: install the `.rpm`. Arch: `google-chrome` (AUR). | `google-chrome` (resolved on your `PATH`) |
| **Windows** | Run the installer from [google.com/chrome](https://www.google.com/chrome/). | `C:\Program Files\Google\Chrome\Application\chrome.exe` |

### 3. Install the tool

```sh
git clone https://github.com/lilBunnyRabbit/chrome-safe-inset.git
cd chrome-safe-inset
bun install
```

You can now run it directly:

```sh
bun run src/index.ts
```

**Optional — global `chrome-safe-inset` command.** To run it from anywhere:

```sh
# macOS / Linux
chmod +x src/index.ts
bun link

# Windows
bun link
```

`bun link` adds the command to Bun's global bin directory (`~/.bun/bin`, or `%USERPROFILE%\.bun\bin` on Windows), which the Bun installer puts on your `PATH`.

## Usage

Run with the global command (if you ran `bun link`):

```sh
chrome-safe-inset [profile-name] [--verbose] [--no-viewport]
```

…or directly, without linking:

```sh
bun run src/index.ts [profile-name] [--verbose] [--no-viewport]
```

This launches a dedicated Chrome window and gives you an interactive `inset >` prompt. Each profile name gets its own isolated Chrome data directory under `.data-dirs/`, so you can keep separate logins and state.

### Commands

| Command | Description |
| --- | --- |
| `<number>` | Apply uniform inset to all sides (`0` to disable) |
| `<t> <b> <l> <r> [...]` | Apply individual insets |
| `presets` | List available device presets |
| `<preset-name>` | Apply a device preset (insets + viewport) |
| `screenshot [name]` | Save a screenshot as PNG |
| `screenshot copy` | Copy screenshot to clipboard |
| `help` | Show usage information |
| `quit` / `exit` | Close Chrome and exit |

### Flags

| Flag | Description |
| --- | --- |
| `--verbose` | Show Chrome browser output |
| `--no-viewport` | Don't override viewport when applying presets |

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `CHROME_BIN` | Path to the Chrome executable | macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` · Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe` · Linux: `google-chrome` |
| `CDP_PORT` | Preferred Chrome DevTools Protocol port. If it's already in use, the tool automatically picks the next free port. | `9222` |

Example:

```sh
CHROME_BIN="/path/to/chrome" CDP_PORT=9333 bun run src/index.ts
```

### Device Presets

When a preset is applied, both the safe area insets and viewport dimensions are set to match the device. Use `--no-viewport` to only apply insets without changing the viewport.

## Visual Overlay

The tool automatically injects a visual overlay into each page to show where the safe area insets are applied. The overlay:

- Shows a low-opacity red border (`#ff00001a`) around the safe area boundaries
- Uses CSS `env()` functions to automatically reflect the current safe area inset values
- Doesn't interfere with page interaction (`pointer-events: none`)
- Persists across page navigations

Toggle the overlay via the browser console:

- `window.showInsetOverlay()` — Show the overlay
- `window.hideInsetOverlay()` — Hide the overlay

## Troubleshooting

**`Chrome not found at: ...`** — Chrome isn't installed at the expected path. Install it (see [step 2](#2-install-google-chrome)) or set `CHROME_BIN` to your Chrome/Chromium executable.

**Chrome opens but commands have no visible effect** — This usually means another Chrome (often one left running from a previous session) is holding the DevTools port, so commands get sent to the wrong browser. The tool now detects this and prints `Port 9222 is in use — using port 9223 instead`, launching its own Chrome on a free port. If you still see issues, close stray Chrome windows started by this tool, or run with `--verbose` to inspect the browser output.

**`Failed to connect after N attempts`** — Chrome launched but never exposed its debugging port. Run with `--verbose` to see why. Most often the Chrome build is too old to support the experimental `setSafeAreaInsetsOverride` method — update Chrome.

**`screenshot copy` fails on Linux** — Install a clipboard helper: `sudo apt install xclip` (X11) or `sudo apt install wl-clipboard` (Wayland).
