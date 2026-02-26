# chrome-safe-inset

Quick experiment to test CSS `safe-area-inset-*` properties in Chrome. Uses the experimental CDP `setSafeAreaInsetsOverride` method to override safe area insets on the fly.

There aren't really any other free tools that let you do this easily. Hopefully this gets built into DevTools soon, but for now this works.

## Usage

```sh
bun install
chmod +x index.ts
bun link chrome-safe-inset
chrome-safe-inset
```

Then enter values like `50` (applies to all sides) or `top bottom left right` (space-separated values). Enter `0` to disable.

## Visual Overlay

The tool automatically injects a visual overlay frame into each page to help you see where the safe area insets are applied. The overlay:

- Shows a low-opacity red border (`#ff00001a`) around the safe area boundaries
- Uses CSS `env()` functions to automatically reflect the current safe area inset values
- Is positioned absolutely and doesn't interfere with page interaction (`pointer-events: none`)
- Updates automatically when you change the inset values

You can toggle the overlay on/off using the browser console:
- `window.showInsetOverlay()` - Show the overlay
- `window.hideInsetOverlay()` - Hide the overlay

The overlay makes it easy to visualize how your content will be affected by safe area insets, especially useful for testing responsive designs and mobile layouts.
