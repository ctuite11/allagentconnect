# Fix required-field error hidden behind sticky Add Listing buttons

## What changes
When Publish validation fails, the page scrolls so the whole red "Please complete the following required fields" box sits just below the sticky Save Draft / Preview / Publish bar, with every missing-field line visible. This applies to both publish paths: existing Draft/Edit and brand-new listing. It works on desktop and mobile, including when the buttons wrap onto two lines.

## How
- Add a ref to the sticky action bar.
- Add one small scroll helper. On the next frame (after the red box has rendered), it measures the bar's current height and scrolls the page's actual scroll area to the red box's position minus that height plus a small gap. It scrolls smoothly.
- Use that helper in both validation-failure spots, replacing the current `window.scrollTo({ top: 0 })` + `scrollIntoView()` pair.
- Measuring the height live makes wrapped (taller) button bars work automatically. A fixed `scroll-margin-top` can't adapt to that, and the page scrolls inside a workspace pane, not the window.

## Not changing
Validation rules, button design and layout, the sticky bar itself, and the Publish / review flow.

## QA
On a Draft with several required fields missing, at desktop (1280px) and mobile (390px) widths:
1. Scroll partway down.
2. Click Publish.
3. Confirm the page scrolls up and the full red box, including every missing-field line, is visible below the sticky controls, with nothing covered.
QA only clicks Publish to trigger the validation failure. It never confirms a publish.
