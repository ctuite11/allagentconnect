## Mark 4 agents as Active

All four already have `profiles` and `agent_settings` rows (so they have auth accounts). They just need to be flipped from `pending` → verified + activated.

### Targets
| Name | Email |
|---|---|
| Betsy McCombs | betsy.mccombs@compass.com |
| Charles Joseph | charles.joseph@compass.com |
| Maria del Carmen Vera-Diaz | carmen.veradiaz@compass.com |
| Kiernan Middleman | kmiddleman@warrenre.com |

### Data changes (insert-tool, no schema change, no emails sent)

1. `agent_settings` for those four user_ids:
   - `agent_status = 'verified'`
   - `verified_at = now()` (only if currently null)
   - `account_activated_at = now()` (only if currently null)
   - `approval_email_sent = true` (suppress any future auto-send)

2. `agent_early_access` rows for those four emails:
   - `status = 'verified'`
   - `converted_at = now()` (only if currently null)

No edge function calls. No License Verified email. No password reset. They already have auth accounts; if they ever need to log in they can use Forgot Password.

### Result in Admin
All four will move from the Pending tab to the **Active** tab (emerald "Active · just now").
