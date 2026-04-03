# Sitemap — Future Implementation

AAC does not currently have a dynamic sitemap. When needed, implement a server-side endpoint (e.g. Supabase Edge Function or Netlify Function) that generates `sitemap.xml` including:

## Pages to include
- `/` (homepage)
- `/register` (agent registration)
- `/agent/:aac_id` (public agent profiles — query `agent_profiles` for all agents)
- `/property/:id` (public property listings — query `listings` with status = active)
- `/privacy`, `/terms`, `/cookies`, `/fair-housing`, `/disclosures`, `/agent-network-rules`
- `/our-agents`, `/browse`

## Pages to exclude
- All `/agent-dashboard/*` routes
- All `/admin/*` routes
- `/auth`, `/password-reset`, `/pending-verification`
- All `/client/*` routes

## Implementation notes
- Use `lastmod` from `updated_at` columns where available
- Set `changefreq` to `daily` for listings, `weekly` for profiles, `monthly` for legal pages
- Add `<sitemap>` reference in `robots.txt`
- Consider splitting into multiple sitemaps if listings exceed 50k
