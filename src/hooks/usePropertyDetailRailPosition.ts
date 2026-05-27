import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const LG_MEDIA = "(min-width: 1024px)";
const RAIL_TOP_PX = 24;

/**
 * Desktop listing detail rail: CSS sticky fails when the rail column does not span
 * the full scroll height (e.g. hero-only flex) or when ancestors clip overflow.
 * Pin with `position: fixed` using the in-flow anchor rect instead.
 */
export function usePropertyDetailRailPosition(enabled: boolean) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!enabled) {
      setPanelStyle(undefined);
      return;
    }

    const layoutEl = layoutRef.current;
    const anchorEl = anchorRef.current;
    const panelEl = panelRef.current;
    if (!layoutEl || !anchorEl || !panelEl) return;

    const mq = window.matchMedia(LG_MEDIA);

    const update = () => {
      if (!mq.matches) {
        setPanelStyle(undefined);
        return;
      }

      const anchorRect = anchorEl.getBoundingClientRect();
      const layoutRect = layoutEl.getBoundingClientRect();
      const panelHeight = panelEl.offsetHeight;

      const pinnedTop = Math.max(RAIL_TOP_PX, anchorRect.top);
      const maxTop = layoutRect.bottom - panelHeight;
      const top = Math.min(pinnedTop, maxTop);

      setPanelStyle({
        position: "fixed",
        top,
        left: anchorRect.left,
        width: anchorRect.width,
        zIndex: 30,
      });
    };

    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(layoutEl);
    observer.observe(anchorEl);
    observer.observe(panelEl);

    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [enabled]);

  return { layoutRef, anchorRef, panelRef, panelStyle };
}
