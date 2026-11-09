# Homepage hero — headline and description text only

## Before approving: this goes live as soon as it's saved
Every saved change goes live on allagentconnect.com automatically, so I can't hold this back until you've reviewed it. The safe order is:
1. I prepare and check the change in a private test copy, with screenshots at desktop and mobile sizes.
2. I show you the screenshots.
3. I save it only after you reply "make it live".

## 1. Headline
- **Desktop (wide screens):** two lines. "ONE NETWORK. ALL BROKERAGES." in white on one line, then "ALL AGENTS." in the existing AAC green.
- **Mobile and narrower tablets:** three lines, "ONE NETWORK." / "ALL BROKERAGES." / "ALL AGENTS.", with only the last line green.
- Same font, weight, shadow and colors as now. The font won't be shrunk heavily to force one line. Where the long line doesn't fit at close to today's size, the headline switches to the three-line version.
- To fit the two-line version on desktop, the headline alone may run wider than the description column. It never runs off the screen.
- The description, badge and button keep their current width and position.

## 2. Description
Replaced with: "Connecting verified agents across **all brokerages** to share properties agents are preparing to list, properties sellers choose to market privately, buyer demand, and market intelligence — giving their clients a competitive edge."

"all brokerages" stays bold, as it is today.

## Unchanged
The "Verified Agent Network" badge, the green "Request access" button, the top Request Access / Login buttons, the background photo, the colors, every other homepage section, and all listing statuses and features.

## Checks before going live
- Screenshots at desktop (1440 and 1280 wide), tablet (768) and mobile (390 and 360).
- At every size: the headline breaks into lines as specified, and nothing makes the page scroll sideways.

## Technical details
Only `src/components/home-v2/HeroSection.tsx` changes:
- Split the h1 into spans: "ONE NETWORK." and "ALL BROKERAGES." sit on one line from the `md` size up and stack on smaller screens. "ALL AGENTS." stays green.
- The h1 can be wider than the 580px column (`w-max max-w-[calc(100vw-…)]`), and its size uses a `clamp()` range.
- The `<p>` text gets the new copy.
