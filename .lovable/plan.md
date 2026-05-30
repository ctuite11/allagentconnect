Fix the add-contact save flow so duplicate emails stop showing a raw red database error.

Plan:
1. Update `src/pages/MyClients.tsx` in the add-contact branch only.
2. Normalize the submitted email with `trim().toLowerCase()` before saving.
3. Before insert, query `clients` for an existing contact owned by the current agent with that normalized email.
4. If one exists, show a friendly toast like: `A contact with this email already exists: Elaine Dolley.` and do not attempt the insert.
5. If none exists, insert the new contact as usual with both `agent_id` and `agent_user_id` set.
6. Keep the detailed fallback error logging for any non-duplicate database issue.

Verification:
- Re-submit the same duplicate email: friendly duplicate-contact message, no raw red database error.
- Submit a brand-new email: contact saves successfully.