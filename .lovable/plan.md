Change the default filter for the Admin Approvals page from **Pending** to **All**.

**Change**
- `src/pages/AdminApprovals.tsx` line 224: `useState<string>("pending")` → `useState<string>("all")`.

That's it — the "All" pill, dropdown, and filter logic already exist and handle this value; only the initial state changes.