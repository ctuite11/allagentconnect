

## Put Company + AAC ID on Same Line, Keep Green Dot

**File:** `src/pages/AgentProfile.tsx`

### Current (lines 262-273)
```
Title · Company
● AAC-0004
```

### Target
```
Title
Company · ● AAC-0004
```

### Changes

**Lines 262-273** become:

```tsx
{agent.title && (
  <p className="text-base text-muted-foreground mt-1.5">
    {agent.title}
  </p>
)}

{(agent.company || agent.aac_id) && (
  <p className="flex items-center gap-1.5 text-sm text-muted-foreground/70 mt-1">
    {agent.company && <span>{agent.company}</span>}
    {agent.company && agent.aac_id && <span className="text-muted-foreground/30">·</span>}
    {agent.aac_id && (
      <>
        <span className="w-1 h-1 rounded-full bg-aacSuccess" />
        <span className="font-mono text-xs text-muted-foreground/50">{agent.aac_id}</span>
      </>
    )}
  </p>
)}
```

- Title on its own line
- Company and AAC ID merge into one line with `·` separator
- Green dot stays before the AAC ID
- No monogram, no compass icon

