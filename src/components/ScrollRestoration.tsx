import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const STORAGE_PREFIX = "aac-scroll:";

function scrollRoots(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll<HTMLElement>("[data-app-scroll-root]"));
}

function readScroll(): number {
  const root = scrollRoots()[0];
  return root ? root.scrollTop : window.scrollY;
}

function applyScroll(y: number) {
  const roots = scrollRoots();
  if (roots.length) roots.forEach((el) => (el.scrollTop = y));
  else window.scrollTo(0, y);
}

/**
 * Forward navigation (link/sidebar click) starts at the top.
 * Back/Forward (POP) restores the position the user left, once content has rendered.
 */
const ScrollRestoration = () => {
  const location = useLocation();
  const navType = useNavigationType();
  const keyRef = useRef(location.key);

  // Continuously remember the current entry's scroll position.
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(STORAGE_PREFIX + keyRef.current, String(readScroll()));
      } catch {
        /* storage unavailable */
      }
    };
    const onScroll = () => save();
    window.addEventListener("scroll", onScroll, { passive: true });
    const roots = scrollRoots();
    roots.forEach((el) => el.addEventListener("scroll", onScroll, { passive: true }));
    return () => {
      save();
      window.removeEventListener("scroll", onScroll);
      roots.forEach((el) => el.removeEventListener("scroll", onScroll));
    };
  }, [location.key]);

  useLayoutEffect(() => {
    keyRef.current = location.key;
    if (navType !== "POP") {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      applyScroll(0);
      return;
    }
    let target = 0;
    try {
      target = Number(sessionStorage.getItem(STORAGE_PREFIX + location.key) ?? 0) || 0;
    } catch {
      target = 0;
    }
    if (target <= 0) {
      applyScroll(0);
      return;
    }
    // Retry briefly while content (cached or loading) grows tall enough.
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      applyScroll(target);
      const reached = Math.abs(readScroll() - target) < 2;
      if (!reached && tries++ < 60) raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [location.key, navType]);

  return null;
};

export default ScrollRestoration;
