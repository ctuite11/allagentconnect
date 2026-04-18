import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyFaviconForHost } from "./lib/favicon";

// Apply the correct brand favicon (AAC vs DCMLS) before React renders.
applyFaviconForHost();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
