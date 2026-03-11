

## Update HomepageV2 to match the screenshot exactly

The current build uses placeholders and generic compositions where the screenshot shows real images and specific layouts. Here's what needs to change across each component.

### 1. HeroV2.tsx — Use `hero-editorial.png` as the agent portrait

The screenshot shows a large agent headshot photo filling the right side of the hero, not the globe image. The hero also has a full-bleed dark background with the photo extending edge-to-edge on the right.

- Replace `/brand/aac-globe.png` with the `hero-editorial.png` asset
- Make the image larger and more prominent to match the screenshot's edge-to-edge composition
- Keep the updated headline ("See the market before it hits the MLS.")

### 2. NetworkIntelSection.tsx — Use property photos for agent tiles

The screenshot shows 4 photo tiles at the bottom with actual headshot/property images, not just colored initials.

- Use `property-1.jpg`, `property-2.jpg`, `property-3.jpg`, and `hero-editorial.png` as the agent card images
- Make the dashboard mockup more detailed to match the screenshot (it shows sidebar nav, more UI chrome)

### 3. AgentUseCasesSection.tsx — Add real images to use-case cards

The screenshot shows 3 cards each with a large photo at the top (lifestyle/property photos), not just initials in colored boxes.

- Add `property-1.jpg`, `property-2.jpg`, `property-3.jpg` as card header images
- Cards should have photo on top, then title, description, and stat below

### 4. ScaleSection.tsx — Use the actual globe/earth image

The screenshot shows a real photo of the earth from space (the `aac-globe.png` or similar), not a CSS-drawn wireframe globe. It also shows overlaid card callouts on top of the globe image.

- Replace the SVG wireframe globe with the `/brand/aac-globe.png` image
- Add overlaid card/badge elements matching the screenshot's composition (cards with green accents floating over the globe)

### 5. GCISection.tsx — Match the screenshot's left-aligned layout

The screenshot shows headline + subtext + CTA on the left, with a 2x3 icon grid on the right. Currently it's all centered.

- Change to a 2-column grid layout: left text block, right 2x3 value props grid
- Add the dark background pattern matching the screenshot

### 6. FooterV2.tsx — Match the screenshot's 5-column layout

The screenshot shows more columns and a different structure than the current 4-column footer.

- Add additional columns to match (AAC, Core, Listings, Agents, Contact)
- Add the green "Get Access" button in the footer matching the screenshot

### Files to modify (all within `src/components/home-v2/` only)

| File | Change |
|------|--------|
| `HeroV2.tsx` | Swap globe for `hero-editorial.png`, larger right-side image |
| `NetworkIntelSection.tsx` | Add property photos to agent tiles, richer dashboard |
| `AgentUseCasesSection.tsx` | Add property photos as card headers |
| `ScaleSection.tsx` | Replace SVG globe with actual `aac-globe.png` image, add overlay cards |
| `GCISection.tsx` | Switch to 2-column layout (left text, right grid) |
| `FooterV2.tsx` | Expand to match screenshot's column structure |

No changes to existing homepage, shared components, routes, or authenticated flows.

