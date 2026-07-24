## Plan

1. **Make pagination scroll immediate and mobile-safe**
   - Replace the current passive `useEffect` scroll reset with a dedicated pagination handler that scrolls before/while the page state changes, so mobile browsers do not preserve the bottom button position after the grid re-renders.

2. **Scroll every real page container**
   - Reset `window`, `document.documentElement`, and `document.body`.
   - Reset the authenticated shell container: `[data-app-scroll-root]`.
   - Also reset the nearest internal overflow containers if present, since mobile authenticated pages can scroll inside the app shell instead of the window.

3. **Anchor to the Agent Network header as a fallback**
   - Add a stable top anchor at the Agent Network header/grid area.
   - After changing pages, call `scrollIntoView({ block: "start" })` on that anchor if normal scroll reset does not take effect.

4. **Keep scope limited**
   - Only update `src/pages/OurAgents.tsx`.
   - Do not change pagination logic, filters, layout, sorting, or data loading.

5. **Verify**
   - Check the mobile behavior on `/our-agents`/Agent Network: scroll to pager, tap Next/Prev, confirm the next page starts at the top instead of staying near the bottom.