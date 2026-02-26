// Injected script that creates a visual overlay showing safe area inset boundaries.
//
// The overlay is a border using CSS `env(safe-area-inset-*)` values, so it
// automatically reflects the current inset override. It can be toggled via
// `window.showInsetOverlay()` / `window.hideInsetOverlay()` in the console.

if (!window.insetOverlay) {
  const overlay = document.createElement("div");
  overlay.id = "safe-area-inset-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    bottom: "0",
    right: "0",
    pointerEvents: "none",
    borderStyle: "solid",
    borderColor: "#ff00001a",
    borderWidth:
      "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
    zIndex: "999999",
  });

  window.insetOverlay = overlay;

  window.showInsetOverlay = () => {
    if (document.body && !window.insetOverlay.parentElement) {
      document.body.appendChild(window.insetOverlay);
    }
  };

  window.hideInsetOverlay = () => {
    window.insetOverlay.remove();
  };

  // Defer if body isn't ready yet (e.g. addScriptToEvaluateOnNewDocument)
  if (document.body) {
    window.showInsetOverlay();
  } else {
    document.addEventListener("DOMContentLoaded", () => window.showInsetOverlay());
  }
}
