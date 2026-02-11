

# Wire Existing Address Autocomplete into Add Listing Page

## Clarification

The `AddressAutocomplete` component and `normalizeGooglePlace` utility already exist and work on three other pages (Agent Match, Profile Editor, Manage Team). The Add Listing page has never had this wired up — so this is connecting existing, proven components to the listing form, not building anything new.

## What Will Change

**Single file: `src/pages/AddListing.tsx`**

1. **Add two imports** at the top of the file:
   - `AddressAutocomplete` from `@/components/AddressAutocomplete`
   - `normalizeGooglePlace` from `@/lib/google-address`

2. **Add a handler function** (`handleAddressPlaceSelect`) that:
   - Takes the Google place result
   - Runs it through `normalizeGooglePlace()` (same pattern used in AgentMatch.tsx)
   - Auto-fills `address`, `city`, `state`, and `zip_code` in the form state

3. **Replace the plain text input** for Street Address with the `AddressAutocomplete` component, keeping manual typing as a fallback (identical to how it works on other pages)

## Expected Behavior After Fix

1. User types in the Street Address field
2. Google autocomplete suggestions appear
3. User selects an address
4. City, State, Zip auto-populate
5. Existing ATTOM auto-fetch triggers to verify the property
6. If no suggestion is selected, user can still type manually

## No New Files or Components

Everything needed already exists. This is purely a wiring change in one file.

