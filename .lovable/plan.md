## Remove "Requested" column from Admin Approvals table

Since every agent comes through Request Access (unless admin-created), the column is noise.

### Changes to `src/pages/AdminApprovals.tsx`

1. **Remove `"requested_access"`** from the `SortField` union.
2. **Remove the `case "requested_access":`** block from the sort comparator.
3. **Remove the `<th>` header** for "Requested" in the table.
4. **Remove the `<YesNoCell yes={requested} ... />`** row cell.
5. **Remove the now-unused `requested` local variable** in the row render.
6. Keep the "Request Access" pill next to the agent name in the Agent column (still useful to flag pending_verification-source rows at a glance).

### Not changed
- No backend, no data model, no drawer changes.
- All other columns, sorting, filters, bulk actions, and handlers remain identical.

### Verification
- Table renders with columns: Agent · Verified · Activated · Profile · Online · Last Login · ⋯
- Sorting still works on all remaining columns.
- No TypeScript errors from the removed sort field.