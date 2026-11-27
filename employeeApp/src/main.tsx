import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted, so no visitor data goes to Google Fonts (GDPR).
import "@fontsource-variable/inter";
import "./styles/variables.css";
import "./styles/globals.css";
import App from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
