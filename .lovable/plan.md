# heycatch.ai Site Audit for All Agent Connect: full extracted results (read-only)

Source: public audit page, opened on Nov 6, 2026. All five dimension panels opened in a headless browser and their full text was captured. Text below is quoted from the source. Nothing was invented, edited, deployed or published. No member data was accessed.

## What could and could not be extracted
- All 5 dimensions expanded. Codes, scores, statuses and insights captured in full.
- The action plan has 13 items in two groups: 8 Quick wins and 5 Do this quarter. They appear here in source order.
- Codes the source does not show: D3.4 is missing from Trust (its numbered items jump from D3.3 to D3.5). Dimension 4 is missing entirely. The page says "Pricing & Paywall and Transactional trust are excluded from scoring" (pre-launch, denominator 85). The source gives no further detail on either.
- Brief fit has no D-codes. The source shows it as "What matches the brief" and "Gaps vs the brief".
- Overall total: not shown on the page. The five scores add up to 50.5/85. That sum is my arithmetic, not the source's number.

## Header (source)
- Audience scope: US with an explicit Massachusetts regional signal.
- Gut reaction: polished homepage with one clear Request-access CTA, but "the trust layer is empty". It cites no named person, no testimonial, no third-party signal, placeholder stock portraits and eight dead footer links.
- Spotlight competitors: Off-Market.io (closest ICP match, from $99/mo) and Insightful Agent ("1.5M+ Verified Agents", $29/mo, $1 trial).

## Dimension scores
| Dimension | Score | Status |
|---|---|---|
| Positioning | 17/25 | Partial |
| Conversion clarity | 17/25 | Partial |
| Trust signals and social proofs | 1/20 | Fail |
| SEO basics | 8.5/15 | Partial |
| Brief fit | 7/10 | Partial |

## 1. Positioning: 17/25, Partial
Key finding: the copy speaks the audience's vocabulary but never says where the network operates or shows the network from the inside.
- **D1.1 Hook (4/6, Partial):** the headline and subhead name the buyer and the offer. Geography is missing from the hero; only a small "Massachusetts" label appears in the header. The bigger-goal line is generic.
- **D1.2 Pain match (4/5, Partial):** quiet marketing, early access and "No Days On Market" hit the main pain. Discretion appears only as a floating chip.
- **D1.3 JTBD coverage (3/4, Partial):** three workflow cards cover the functional job. The emotional job (discretion, peer trust) is never developed.
- **D1.4 Objection handling (1/3, Fail):** verification is addressed (Agent Network Rules). NAR Clear Cooperation and pricing are not. "Thousands of agents" is unverifiable.
- **D1.5 Desired-result visualization (2/3, Partial):** the dashboard screenshot, listing cards and workflow simulation are shown. No directory, message thread or demand feed is shown.
- **D1.6 Audience language (3/4, Partial):** strong industry vocabulary. Filler phrases flagged: "Deliberately designed for scale and persistence", "Specialization over generalization."
- Competitors: both state the outcome in the first line. AAC states affiliation first. AAC's narrower agent-only hook is defensible but needs geography and a concrete after-state.

## 2. Conversion clarity: 17/25, Partial
Key finding: one clear, repeated Request-access CTA, held back by eight dead footer links and untested mobile rendering.
- **D2.1 5-second comprehension (5/7, Partial):** the above-fold area works. The headline alone is affiliation-only, and the hero photo has empty alt text.
- **D2.2 CTA hierarchy (4/5, Partial):** Request access appears three times and Login is secondary. The footer's "Request Demo" links to "#".
- **D2.3 Visual hierarchy and scroll flow (3/5, Partial):** consistent rhythm. The marquee repeats six slogans four times, and some animated elements sit at opacity 0 in the page code.
- **D2.4 Friction and navigation (2/4, Fail):** eight "#" links (Request Demo, For Agents, For Sellers, For Buyers, Careers, Contact Us, Data Usage & Security, Accessibility Statement). The homepage has no path to the agent rules or the verification explanation.
- **D2.5 Mobile experience (2/4, Partial, capped):** good markup signals, but real devices were not tested, so the score is capped.
- **D2.B Scope honesty bonus (+1/2):** "Built for licensed professionals, not public lead routing" earns +1. There is no explicit "not for X" line.
- Competitors: a free posting tier (Off-Market.io) and a $1 trial (Insightful Agent) back their CTAs with a low-cost first step.

## 3. Trust signals and social proofs: 1/20, Fail
Key finding: no named person, testimonial, customer or third-party signal. The only member portraits are placeholder photos.
- **D3.1 Quantity proof (1/4, Fail):** "Thousands of agents…" and "More than 50 companies joined the hands" are text only. The second is broken English. "Proven Since 2016" is undated.
- **D3.2 Story proof (0/7, Fail):** zero testimonials. The "Collaborate with trusted agents" card uses randomuser.me placeholder portraits (alt "Agent").
- **D3.3 Founder-led trust (0/6, Fail):** no founder name, photo or profile link on the homepage. /about is in the sitemap but not linked from the homepage.
- **D3.5 Third-party and recency signals (0/3, Fail):** no badges, reviews or press, and no dated content beyond the legal pages.
- (D3.4: not shown in the source.)
- Competitors rely on big numbers. AAC's unbacked "Thousands" loses on size and specificity.

## 4. SEO basics: 8.5/15, Partial
Key finding: solid foundations, but the Cloudflare robots file blocks major AI assistant crawlers and there is no comparison or category content.
- **D5.1 Title and meta description (2/3, Partial):** the title is good (52 chars). /request-access serves the homepage's og:title and og:url. The homepage description is about 165 chars, over the roughly 155-char display limit.
- **D5.2 Heading structure (2/2, Pass).**
- **D5.3 Indexable content, /vs pages, internal linking (1.5/4, Partial):** the sitemap has 9 URLs, a plain-text fallback exists, and Googlebot/Bingbot are allowed. There are no /vs or category pages. Internal linking is weak: "#" footer links and an unlinked /about.
- **D5.4 Page speed (2/3, Partial):** 578–590 ms response time. Total page weight was not confirmed, so the score is capped.
- **D5.5 AI discovery and structured data (1/3, Fail):** OG/Twitter metadata and Organization JSON-LD are present. Product/Service schema, FAQ schema and llms.txt are missing (/llms.txt returns the app shell). GPTBot, ClaudeBot, Google-Extended, anthropic-ai, Perplexity-class and others are disallowed. Alt text is thin.
- Competitors: Insightful Agent ranks with FAQ and pricing pages. Off-Market.io runs a marketplace SEO funnel.

## 5. Brief fit: 7/10, Partial
Key finding: the site sells the described private verified network, but the scale claims are unbacked and the directory is not shown on the homepage.
- What matches: the hero description; the gated, verified-only model; license verification in the Agent Network Rules; the buyer-demand workspace line.
- Gaps:
  - Scale claims have no evidence behind them.
  - The agent directory is not shown or linked from the homepage. /our-agents and /browse appear only in inner-page footers, and the brief reports /our-agents failed to load.
  - "Proven Since 2016" is unsubstantiated.
  - Market intelligence is never illustrated.
  - No participating brokerage is named.

## Action plan, in source order

### Quick wins
1. **Build a member wall of real, named agents on the homepage.**
   - Where: Homepage, new testimonial section.
   - Why (D3.2): no social proof.
   - What: 3–5 quotes, each with name, brokerage, city and outcome. Heading: "Agents already working the network."
   - Metric: homepage → access-request conversion over 4 weeks.
   - Effort: Medium.
2. **Replace placeholder portraits with real member imagery.**
   - Where: "Collaborate with trusted agents" card.
   - Why (D3.2, D3.1): placeholder faces undermine every other claim.
   - What: real photos with permission, or a non-figurative network graphic.
   - Metric: scroll-through past the workflow section, or a trust score from user testing.
   - Effort: Low.
3. **Put a named founder face and story on /about and link it from the homepage.**
   - Why (D3.3, D2.4): no founder is named anywhere.
   - What: photo, name, story, LinkedIn/X link; point the footer About link at /about.
   - Metric: access-request form completion rate.
   - Effort: Low.
4. **Wire up or remove the eight dead footer links.**
   - Why (D2.4): eight dead ends.
   - What: Contact Us opens a mailto to hello@; Request Demo is removed or goes to the access form.
   - Metric: footer click-through.
   - Effort: Low.
5. **Add Product and FAQ structured data.**
   - Why (D5.5): nothing tells search engines or AI assistants what the product is.
   - What: Service/Product JSON-LD (area served: Massachusetts) and FAQPage schema.
   - Metric: AI-answer impressions over 60 days.
   - Effort: Low.
6. **Write per-page titles and descriptions.**
   - Why (D5.1): /request-access shows the homepage's preview; the homepage description is too long.
   - What: distinct metadata per page; homepage description under 155 chars.
   - Metric: inner-page organic click-through.
   - Effort: Low.
7. **Fix alt text on the hero and key product images.**
   - Why (D5.5): empty or generic alt text.
   - What: descriptive alt text for the hero and the dashboard.
   - Metric: image-search impressions.
   - Effort: Low.
8. **Say where the network operates in the hero itself.**
   - Why (D1.1, D2.B, FIT): geography appears only as a small header label.
   - What: badge reads "Verified Agent Network · Massachusetts"; the subhead adds "for licensed agents across Greater Boston."
   - Metric: request rate from Massachusetts traffic.
   - Effort: Low.

### Do this quarter
9. **Make the agent-count claim countable or cut it.**
   - Why (D3.1, FIT): unbacked slogans with broken English.
   - What: a dated member counter or verified badges, or an honest line such as "Verified agents across Greater Boston. Growing weekly."
   - Metric: below-fold CTA click-through.
   - Effort: Medium.
10. **Answer the compliance and verification questions on an FAQ page.**
    - Why (D1.4, D5.5): Clear Cooperation, pricing and verification questions go unanswered.
    - What: a /faq page with 5–8 questions and FAQ schema.
    - Metric: conversion among visitors who view the FAQ.
    - Effort: Medium.
11. **Let AI assistants read the site and add an llms.txt.**
    - Why (D3.5, D5.3, D5.5): AI crawlers are blocked and no dated content exists.
    - What: allow retrieval crawlers (training restrictions optional), publish /llms.txt, start a /changelog, add all three to the sitemap.
    - Metric: AI referral visits over 60 days.
    - Effort: Medium.
12. **Ship one category page for off-market listing network searches.**
    - Why (D5.3, D1.4): no category content exists.
    - What: a page such as /off-market-listing-network.
    - Metric: organic clicks on category keywords.
    - Effort: Medium.
13. **Show what approved members get before the gate.**
    - Why (D1.5, D1.4, D2.1): the member experience is asserted, never shown.
    - What: three labeled or anonymized captures (search, a buyer-need card, an agent profile) plus an onboarding timeline.
    - Metric: access-request submission rate.
    - Effort: Medium.

## Points to review before acting (my notes, not from the audit)
- **Items 1, 2, 9 and 13** would show real agents, profiles or buyer needs publicly. That conflicts with AAC's agent-only privacy rule. They would need explicit consent or fully fake or anonymized mock-ups.
- **Item 11** reverses your earlier choice to keep AI-training crawlers blocked and to skip llms.txt. The audit says your Cloudflare settings block AI assistant crawlers too, but my earlier check found search-answer crawlers allowed. Both need re-checking before deciding.
- **Item 3** may be partly out of date: the founder About page was approved and added to the sitemap. I haven't confirmed whether the live footer links to it.
- **Item 8 and the D1.1 finding** cover hero wording, which you recently finalized. Any change needs your approval.
- **Unverified audit claims:** "Proven Since 2016", the randomuser.me portraits, the eight "#" links, and the "/our-agents failed to load" report all come from the audit. I have not checked them against the site.

No changes are proposed in this document. Approving it only records these findings. Any fix needs separate instruction.
