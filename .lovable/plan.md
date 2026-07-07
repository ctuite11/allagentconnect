## Fix: Agent Network pagination starts at bottom

**Cause:** Previous/Next in `src/pages/AgentSearch.tsx` only changes local `page` state — no route change, so `ScrollRestoration` doesn't fire. The grid re-renders in place while the viewport stays scrolled near the pagination controls.

**Change:** In `AgentSearch.tsx`, scroll to top whenever `page` changes (via a `useEffect` on `page`, using `window.scrollTo({ top: 0, behavior: "smooth" })`).

Scope: `src/pages/AgentSearch.tsx` only. No other logic touched.