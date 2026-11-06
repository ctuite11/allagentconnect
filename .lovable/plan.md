# Heycatch quick win: verified-agent count and photo grid in the hero (read-only findings)

Nothing was changed. Every query returned totals only. No names, emails, records or photos were read or shown.

## 1. Verified Massachusetts agent count
- Source: `agent_settings` (one row per agent). `agent_status = 'verified'`, `account_activated_at IS NOT NULL` (the agent finished setting up their account), `license_state = 'MA'`.
- **Result as of Nov 6, 2026: 318** verified, activated Massachusetts agents. All 318 are visible in the directory (`hide_from_directory` is false for each one).
- Context: there are 353 verified agents in total. 23 of the verified agents have no license state on file, so they are left out of the count.
- **Public display:** nothing public shows this number right now. The count was read with internal database access. Showing it on the website would need a new number-only lookup that anyone can call. That's a separate change and needs your approval.

## 2. Consent to show member photos publicly
- **No record of it.** No field stores consent to show a member's name or photo publicly. `hide_from_directory` only covers the members-only directory. It is not permission to appear in public marketing.
- The avatar grid idea is **not safely possible** without first collecting each member's consent. It also conflicts with the agent-only privacy rule.

## 3. Founder photo and LinkedIn
- **None is approved in the project.** The About page has no image and no LinkedIn link, and its structured data has no LinkedIn link. No founder photo file is stored in the project.
- To add them, you would need to provide an approved photo and the official LinkedIn URL.

## Possible next step (needs your approval)
Show a safe count only, such as "300+ verified Massachusetts agents," rounded down and with no photos. This would use a database lookup that returns just the number.
