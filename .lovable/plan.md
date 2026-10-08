# "Save to contacts? → No": read-only check of the email-subscriber model

Read-only. No code, data, emails, or sends. Option A is **not** approved and won't be built.

## Answers

| Question | Finding |
|---|---|
| When does a subscriber start getting emails? | As soon as they're saved, with no confirmation step. The next new listing that matches the Hot Sheet sends them a "New matches in [Hot Sheet]" email (`send-new-match-notification`). |
| Does creating the Hot Sheet send anything? | No. Saving a subscriber triggers no welcome email. |
| Only future matches? | Yes. It's one email per new matching listing, with a preview link and an unsubscribe link. Nothing else. |
| Do they get the initial selected batch? | No. The first-batch send (`process-hot-sheet`) never looks at subscribers. |
| Invitation or dashboard access? | Neither. They get only a token-based public preview page. |
| Shown in Hot Sheet Review or Edit? | **No.** A subscribers panel exists (`HotSheetSubscribersSection`), but no screen shows it. After creation, the person would effectively disappear from the UI. |
| Can the agent remove or manage them? | Not today, since that panel isn't shown anywhere. The subscriber can only unsubscribe through the email link. |
| Does notification frequency control their emails? | Partly. Only Hot Sheets set to "immediately" (and active) send to subscribers. Daily and weekly sheets send them nothing, because no Hot Sheet digest job exists. The buyer "email client" toggle doesn't apply to them. |
| Consent or confirmation today? | None for agent-added subscribers. Self-signup from the preview page is also immediate. |
| Live usage | Zero subscriber rows exist in the database today. |

## What the original copy implies

- Dialog: "Save to contacts? This person will be on the hot sheet. Also save them to your CRM contacts?"
- Toast after **No**: "Contact added to this hot sheet (not saved to your contacts list)."

So the agent is told the person **is on this Hot Sheet**, just not in their contacts list. It doesn't say they'll get automatic emails, and it doesn't say they won't. Since Nov 2025 the database has never been able to store a person on a Hot Sheet without a contact record, so that promise has never actually been kept.

## Conclusion

The subscriber model doesn't fit **No** as the copy describes it:
- the person vanishes from Review and Edit;
- the agent can't remove them;
- they get automatic emails with no confirmation;
- they don't get the first batch or the invite the buyer flow expects.

## Decision for you (nothing will be built until you choose)

1. **Define No as "contact that stays off your contacts list."** Save a real contact record so the person can be attached, invited, and shown in Review and Edit, but mark it hidden from My Clients and the contacts list. This keeps the copy's promise. It needs a small database addition (a hidden flag) and a filter on the contacts list.
2. **Redefine the dialog.** For example, explain that a Hot Sheet contact must be saved, and take **No** back to the form instead of failing at Create. This changes what the choice means.
3. **Subscriber model (Option A),** only if you also want the subscribers panel shown in Edit and accept automatic emails with no first batch or invite.

Until you decide, the bug stays as is. Choosing **No** still makes Create fail, with no data written beyond a possible empty Hot Sheet.
