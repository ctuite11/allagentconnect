# Apology Email — Hot Sheet Incident (234 Friend Street)

## Recipients

The 4 agents who received Hot Sheet emails containing the fake/incidental listing **234 Friend Street** on Oct 9 (4 new-match emails at 1:00 PM ET + 4 status-change emails at 1:01 PM ET). Deduplicated by email address — each agent receives exactly one apology, regardless of how many emails they got.

## Draft email (for your review — nothing sends until you approve)

**Subject:** Apology: a test listing was emailed to you in error

**Body:**

> Hi [First name],
>
> Earlier today you received one or two Hot Sheet emails from All Agent Connect that included a listing for 234 Friend Street. That listing was a test record that was published by mistake, and it should never have been sent to you.
>
> The listing is not real, and no action is needed on your part — please disregard those emails.
>
> We've fixed the underlying issue so this can't happen again, and we're sorry for the clutter in your inbox.
>
> Thank you for being part of All Agent Connect.
>
> — Chris Tuite, All Agent Connect

## Sending method

- One-off send through the existing email queue (`email_jobs`) using the existing **admin-adhoc** template, from `hello@mail.allagentconnect.com` — the same compliant pipeline as all other AAC email (no new template, no template changes).
- Personalized first name per recipient.
- Idempotency key per recipient so no duplicates can be created.

## Verification after send

- Confirm exactly 4 email jobs created (one per unique agent email), all delivered.
- Confirm no other queue rows, Hot Sheet batches, or listing data changed.

## Explicitly out of scope

- No changes to Hot Sheet matching, notifications, templates, or the email system.
- No other emails sent. No listing or contact data modified.
