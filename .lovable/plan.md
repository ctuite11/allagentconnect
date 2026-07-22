## Problem

`src/pages/TeamProfile.tsx` imports and renders the marketing `Footer` component ("All Agent Connect / Platform / Legal" links visible in the screenshot). Sibling pages `OurAgents.tsx` and `AgentProfile.tsx` do not render a footer — they end at the page content. The Team Profile is inconsistent.

## Change

In `src/pages/TeamProfile.tsx`:

1. Remove the import `import Footer from "@/components/Footer";` (line 4).
2. Remove the `<Footer />` render (line 552).

No other changes. Layout, data, and routing untouched.
