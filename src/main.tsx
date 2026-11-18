import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { isDesktopApp } from "./lib/desktop";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The app is fully client-side, so a cached shell is enough to keep the journal
// and kitchen mode working offline. Register only for production builds; the
// dev server's HMR modules should never be served from a service worker.
if (!isDesktopApp() && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is optional */
    });
  });
}
