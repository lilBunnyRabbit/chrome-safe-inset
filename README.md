# chrome-safe-inset

Test CSS `safe-area-inset-*` properties in Chrome using the experimental CDP `setSafeAreaInsetsOverride` method.

There aren't really any other free tools that let you do this easily. Hopefully this gets built into DevTools soon, but for now this works.

## Installation

```sh
bun install
chmod +x src/index.ts
bun link
```

## Usage

```sh
chrome-safe-inset [profile-name] [--verbose] [--no-viewport]
```

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
| `CHROME_BIN` | Path to Chrome binary | `google-chrome` |
| `CDP_PORT` | Chrome DevTools Protocol port | `9222` |

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
