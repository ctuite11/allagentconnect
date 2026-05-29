Update the Founding Partner email in `supabase/functions/send-bulk-email/index.ts` → `buildFoundingPartnerBody()`.

### 1. Replace subtitle under H1 (~line 288) with a quote block

```html
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td style="border-left:3px solid #22C55E;padding:4px 0 4px 14px;">
      <p style="margin:0 0 10px;font-size:16px;line-height:1.55;color:#0f172a;font-style:italic;font-family:Georgia,'Times New Roman',serif;">
        &ldquo;I built AAC to become something special, and I hope you&rsquo;ll join me as a Founding Partner.&rdquo;
      </p>
      <p style="margin:0;font-size:13px;color:#0f172a;font-weight:600;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Chris Tuite</p>
      <p style="margin:0;font-size:12px;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Founder, All Agent Connect</p>
    </td>
  </tr>
</table>
```

### 2. Replace the closing roundtable paragraph (~line 298)

New copy:
> Founding Partners will be invited to a private roundtable discussion where I'll walk through what we've built with All Agent Connect, preview the upcoming launch of Direct Connect MLS and Stealth Seller, and share where I believe the industry is headed. Most importantly, I'd like your candid feedback—what works, what doesn't, and what you'd like to see next.

(Smart quotes/em-dash HTML-escaped.)

### 3. Redeploy
Redeploy `send-bulk-email` after the edits.
