

# Fix Agent Profile Hero: Left-Aligned Photo with Buttons Below + Cleanup

## What changes

### Hero section restructure (`src/pages/AgentProfile.tsx`, lines 226-306)

Change the layout from "photo left, details right" to a stacked structure matching the reference screenshot:

```text
[Photo (w-36 h-36 rounded-full, with online presence dot)]
[Email {FirstName}] [Message {FirstName}]    ← buttons sit directly below photo
[Name — text-4xl, last name in primary]      ← to the right of photo+buttons column
[Title · Company]
[AAC ID]
[phone · email · website — single horizontal line]
```

Actually, looking at the reference more carefully: the photo is on the left with buttons stacked below it, and the name/details are to the right. So the layout is:

```text
LEFT COLUMN              RIGHT COLUMN
┌──────────────┐         Name (large)
│   Headshot   │         Title · Company
│  (circular)  │         AAC ID
│   ● online   │         
└──────────────┘         phone | email | website
[Email Sarah]            (all one horizontal line)
[Message Sarah]
```

### Specific changes:

1. **Photo column**: Wrap headshot + two buttons in a `flex-col items-center` container. Add online presence dot using `useAgentLastSeen(agent.id)`.

2. **Two buttons below photo**:
   - "Email {FirstName}" — opens `ContactAgentProfileDialog` (email flow, already exists)
   - "Message {FirstName}" — uses `findOrCreateConversation` to open/create a messaging thread and navigate to `/messages/{conversationId}`

3. **Contact info**: Merge all contact items (office phone, cell phone, email, website) into a single horizontal line separated by subtle dividers, no border-t above.

4. **Remove**: DirectConnect and Verified badges (per user request).

5. **Online dot**: Import `useAgentLastSeen` and render an emerald dot on the headshot circle, consistent with `AgentAvatar` pattern.

### Files modified
- `src/pages/AgentProfile.tsx` — hero section layout, add messaging import + handler, add presence hook

