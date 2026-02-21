

## Change Page Title to "Registered Buyers"

Update the `PageHeader` title in `src/pages/AdminConsumers.tsx` (line ~195):

```
- title="Consumers"
+ title="Registered Buyers"
```

Also update the subtitle to match:

```
- subtitle={`${totalCount} buyer-role users`}
+ subtitle={`${totalCount} registered buyers`}
```

One file, two string changes. No logic changes.

