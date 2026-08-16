/**
 * Scroll helpers for development mini-site hash sections.
 * AppShell uses an internal scroll root, so we rely on scrollIntoView (works for nested scrollers).
 */

export function parseDevelopmentHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  const trimmed = id.trim();
  return trimmed || null;
}

export function scrollDevelopmentSectionIntoView(sectionId: string): boolean {
  const el = document.getElementById(sectionId);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/** Retry briefly so SPA route transitions can mount the overview sections first. */
export function scheduleDevelopmentSectionScroll(
  sectionId: string,
  opts?: { attempts?: number; intervalMs?: number },
): () => void {
  const attempts = opts?.attempts ?? 12;
  const intervalMs = opts?.intervalMs ?? 50;
  let cancelled = false;
  let n = 0;

  const tick = () => {
    if (cancelled) return;
    if (scrollDevelopmentSectionIntoView(sectionId) || n >= attempts) return;
    n += 1;
    window.setTimeout(tick, intervalMs);
  };

  requestAnimationFrame(() => {
    window.setTimeout(tick, 0);
  });

  return () => {
    cancelled = true;
  };
}
