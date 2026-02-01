

## Seed/Reset Validation Sequence

### What I'll Do (Once Approved)

1. **Set the secret** - Configure `SEED_PROPOSAL_TEST_SECRET` via the secure prompt
2. **Deploy the edge function** - Redeploy `seed-proposal-test-data`
3. **Run seed action** - Call the endpoint and capture the JSON response
4. **Run reset action** - Clear the test data
5. **Verify feature flag** - Confirm `FEATURE_AGENT_PROPOSALS` remains `false`
6. **Rotate secret** - Generate a fresh secret value (won't share it)

### Expected Output
- Seed JSON showing `ok: true` with verification data
- Reset confirmation
- Feature flag verification
- "Secret rotated" confirmation

### Technical Note
The secret value shared in chat will be treated as single-use for this test, then immediately rotated.

