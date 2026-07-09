import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollRestoration = () => {
  const location = useLocation();

  useEffect(() => {
    // Reset window scroll (public pages / footer layouts)
    window.scrollTo(0, 0);
    if (typeof document !== "undefined") {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      // AppShell scroll container: authenticated agent pages scroll inside
      // an inner overflow-y-auto div, not the window.
      document.querySelectorAll<HTMLElement>("[data-app-scroll-root]").forEach((el) => {
        el.scrollTop = 0;
      });
    }
  }, [location.pathname]);

  return null;
};

export default ScrollRestoration;
