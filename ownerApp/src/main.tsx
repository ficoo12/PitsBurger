import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted, so no visitor data goes to Google Fonts (GDPR).
import "@fontsource-variable/inter";
import "./styles/variables.css";
import "./styles/globals.css";
import App from "./app/App";
import { reloadOnce } from "./lib/staleChunk";

// Vite's event for a page chunk that couldn't be loaded, e.g. one an older
// deploy had. Reloading gets the new version; if that already happened, the
// route's error screen shows instead.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnce()) event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
