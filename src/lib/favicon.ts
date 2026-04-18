/**
 * Host-based favicon switcher.
 *
 * AAC and DCMLS share one deployment. To prevent one brand from inheriting
 * the other's favicon, we strip any existing icon links at runtime and
 * inject the correct set based on the active hostname.
 *
 * Call once from `src/main.tsx` before React renders.
 */
import { isDcmlsHost } from "./host";

const ICON_REL_VALUES = new Set([
  "icon",
  "shortcut icon",
  "apple-touch-icon",
  "apple-touch-icon-precomposed",
  "mask-icon",
]);

function removeExistingIconLinks() {
  const links = document.head.querySelectorAll<HTMLLinkElement>("link[rel]");
  links.forEach((link) => {
    const rel = (link.getAttribute("rel") || "").toLowerCase();
    if (ICON_REL_VALUES.has(rel)) {
      link.parentElement?.removeChild(link);
    }
  });
}

function addLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  const link = document.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("href", href);
  for (const [k, v] of Object.entries(attrs)) {
    link.setAttribute(k, v);
  }
  document.head.appendChild(link);
}

export function applyFaviconForHost(): void {
  if (typeof document === "undefined") return;

  const base = isDcmlsHost() ? "/favicons/dcmls" : "/favicons/aac";

  removeExistingIconLinks();

  addLink("icon", `${base}/favicon.ico`, { sizes: "any" });
  addLink("icon", `${base}/favicon-32x32.png`, { type: "image/png", sizes: "32x32" });
  addLink("icon", `${base}/favicon-16x16.png`, { type: "image/png", sizes: "16x16" });
  addLink("apple-touch-icon", `${base}/apple-touch-icon.png`, { sizes: "180x180" });
}
