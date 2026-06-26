import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyFaviconForHost } from "./lib/favicon";

// Apply the correct brand favicon (AAC vs DCMLS) before React renders.
applyFaviconForHost();

// ─────────────────────────────────────────────────────────────────────────────
// Global recovery/setup-link rescue.
// If a Supabase recovery link redirects the user to ANY route on this domain
// other than /auth/callback (typically because the redirect_to URL was not on
// the project's allow-list and Supabase fell back to the Site URL), the
// app-level AuthCallback never runs and the user lands on a stale "Welcome
// Back" screen instead of the Set-Password page. Catch that here, set the
// setup marker, and force the browser onto /auth/callback with the hash
// tokens intact so the existing flow takes over.
// ─────────────────────────────────────────────────────────────────────────────
try {
  const { pathname, search, hash } = window.location;
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(search);

  // STRICT trigger: only rescue when Supabase actually appended recovery
  // tokens to the URL hash. We require BOTH access_token + refresh_token
  // AND a recovery type marker. setup=1 / type=recovery alone are NOT
  // sufficient — those can appear on normal navigation and must not be
  // allowed to hijack routing.
  const hasRecoveryTokens =
    !!hashParams.get("access_token") &&
    !!hashParams.get("refresh_token") &&
    hashParams.get("type") === "recovery";

  if (hasRecoveryTokens && pathname !== "/auth/callback") {
    const isSetup =
      hashParams.get("setup") === "1" || queryParams.get("setup") === "1";
    sessionStorage.setItem("aac_recovery_flow", "1");
    if (isSetup) sessionStorage.setItem("aac_password_setup_flow", "1");
    // Preserve query (so setup=1 survives) and hash (recovery tokens) so
    // AuthCallback can consume them.
    const nextSearch = search && search.length > 0 ? search : isSetup ? "?setup=1" : "";
    window.location.replace(`/auth/callback${nextSearch}${hash}`);
  }
} catch {
  // Best-effort; never block app boot.
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
