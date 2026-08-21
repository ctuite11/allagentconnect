# Redo the All Agent Connect lockup images (correct artwork)

The lockups I delivered used the wrong treatment (blue/green wordmark on white). The correct lockup, matching the screenshot and the live site, is: green command-square monogram above a white "All Agent Connect" wordmark on a near-black background, with a short green rule underneath.

## Source of truth

- Monogram: the in-app `AACMonogram` vector (34x34 command-square, five rounded nodes) — the same mark used in the site header, loaders and emails. No regenerated or AI-drawn artwork.
- Wordmark: Manrope Semibold, tight tracking (-0.4px), pure white — same as the site header.
- Colors: monogram green `#50C878`, background `#0A0A0A`, accent rule green `#22C55E`.

## Deliverables (written to the generated-files area)

1. `aac-lockup-dark-square-1024x1024.jpg` — monogram centered above wordmark plus green rule, dark background. For profile photos.
2. `aac-lockup-dark-wide-1600x400.jpg` — same lockup, horizontal framing for email signatures and banners.
3. `aac-lockup-light-square-1024x1024.jpg` — identical layout on solid white with a near-black wordmark, for light-background use.

Previously delivered wrong lockups stay in place unless you want them removed; say the word and I'll delete them.

## Technical notes

- Render via a headless-browser HTML page that inlines the exact `AACMonogram` SVG paths and loads Manrope from Google Fonts, then screenshot at 2x and downscale for crisp edges.
- No project source files change; this is asset generation only.
- Each output is inspected as an image before delivery (correct mark, no clipping, correct colors).

## Open question

If the screenshot came from a specific surface (splash screen, email header) rather than the site header, tell me which one and I'll match that surface exactly.
