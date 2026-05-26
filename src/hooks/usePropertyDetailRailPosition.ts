import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const LG_MEDIA = "(min-width: 1024px)";
const RAIL_WIDTH_PX = 360;
/** Matches Tailwind `top-24` (6rem) for offset below page chrome */
const RAIL_TOP_PX = 96;

/**
 * Desktop property detail rail: `position: sticky` is unreliable when flex/grid
 * ancestors clip or the rail column does not span the full scroll height.
 * Pin the rail with `position: fixed` relative to the layout container instead.
 */
export function usePropertyDetailRailPosition() {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [railStyle, setRailStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    const layoutEl = layoutRef.current;
    if (!layoutEl) return;

    const mq = window.matchMedia(LG_MEDIA);

    const update = () => {
      if (!mq.matches) {
        setRailStyle(undefined);
        return;
      }
      const rect = layoutEl.getBoundingClientRect();
      setRailStyle({
        position: "fixed",
        top: RAIL_TOP_PX,
        left: rect.left + rect.width - RAIL_WIDTH_PX,
        width: RAIL_WIDTH_PX,
        zIndex: 30,
      });
    };

    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(layoutEl);

    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return { layoutRef, railStyle };
}
