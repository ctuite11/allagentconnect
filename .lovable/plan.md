## Diagnosis

The reordered Email Alert Settings (Geographic → Property Type → Price Range) and the simplified Communications notifications On/Off switch are already live on `/communications`. The remaining place still using the old wording is the **Channels** section at the top of the page — each channel card (Buyer Needs, Sales Intel, Renter Needs, General Discussions) already uses a single Switch, but its status pill still reads **Active / Muted** instead of **On / Off**. That's the "on/off toggle" you're not seeing.

## Change

File: `src/components/NotificationPreferenceCards.tsx`

- In the status pill next to each channel Switch, replace the `Active` / `Muted` label with `On` / `Off`.
- No functional change: the same `Switch` writes the same booleans (`buyer_need`, `sales_intel`, `renter_need`, `general_discussion`) via the same upsert. Matching logic, defaults, and the `preferences_set` flag are untouched.
- Leave the "Mute all" bulk action text as-is unless you want it renamed too (see question below).

Everything else on the Preferences page stays exactly as it is now.

## Question before building

Rename the bulk action **"Mute all"** to **"Turn all off"** for consistency with On/Off? If unsure, I'll leave it as "Mute all".
