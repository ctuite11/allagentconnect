Add a small "Founding Partner" tagline under "All Agent Connect" inside the black header strip of the Founding Partner email template (`supabase/functions/send-bulk-email/index.ts`).

Styled like the "Massachusetts" line under the homepage logo (light weight, uppercase, wide letter-spacing, muted gray), but bumped slightly so it reads more clearly inside the email's dark strip.

## Change

At line 285 (header strip), after the "All Agent Connect" `<p>` and before the green divider, insert a second line:

```html
<p style="margin:6px 0 0;font-size:11px;font-weight:400;letter-spacing:0.22em;text-transform:uppercase;color:#cbd5e1;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founding Partner</p>
```

Spec vs the homepage "Massachusetts" line:
- Homepage: 11px, font-light, tracking 0.2em, `text-neutral-400` (#9ca3af)
- Email: 11px, weight 400, letter-spacing 0.22em, color `#cbd5e1` (slate-300) — a touch brighter for better contrast on the dark strip

Also nudge the green divider's top margin from `10px` to `12px` so it doesn't crowd the new line.

## Result

```
[monogram]
All Agent Connect
FOUNDING PARTNER
———  (green bar)
```

No other content, copy, or layout changes. Footer dark strip (line 314) stays as-is. Then redeploy `send-bulk-email`.