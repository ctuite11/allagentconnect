<instructions>
This file powers chat suggestion chips. Keep it focused and actionable.

# Be proactive
- Suggest ideas and things the user might want to add *soon*. 
- Important things the user might be overlooking (SEO, more features, bug fixes). 
- Look specifically for bugs and edge cases the user might be missing (e.g., what if no user has logged in).

# Rules
- Each task must be wrapped in a "<todo id="todo-id">" and "</todo>" tag pair.
- Inside each <todo> block:
  - First line: title (required)
  - Second line: description (optional)
- The id must be a short stable identifier for the task and must not change when you rewrite the title or description.
- Only maintain this file when there is meaningful unfinished work left after the current response.
- Add tasks only when there are concrete, project-specific next steps from current progress.
- Do NOT add filler tasks. Skip adding if no meaningful next step exists.
- Keep this list high-signal and concise, usually 1-3 strong tasks.
- If there are already 3 strong open tasks, usually do not add more.
- Remove or rewrite stale tasks when they are completed, obsolete, duplicated, or clearly lower-priority than current work.
- Preserve existing todo ids whenever you edit or reorder tasks.
- If the user dismisses or rejects a task, do not recreate it unless they ask for it again or it becomes truly blocking.
- Re-rank remaining tasks by current impact and urgency.
- Prefer specific wording tied to real project scope/files; avoid vague goals.
</instructions>

<todo id="hero-premium">
Upgrade hero section for premium feel
Add subtle motion, stronger typographic hierarchy, and an animated gradient or noise texture to the hero above the ecosystem — the designer offered a direction for this.
</todo>

<todo id="aac-monogram-asset">
Swap AACMonogram SVG paths for final brand asset
`src/components/ui/AACMonogram.tsx` is the integration point — replace the SVG internals when the designer delivers the final vector.
</todo>
