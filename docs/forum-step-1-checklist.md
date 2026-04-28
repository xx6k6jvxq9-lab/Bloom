# Forum Step 1 Checklist

## Goal

Build the forum foundation for "界隙" without breaking the current forum page.

## Scope

- Create a dedicated forum domain area instead of continuing to grow everything inside the old page component.
- Define the v2 forum data model for worlds, thread lifecycle, NPC identity, and user masks.
- Add prompt builders for forum thread generation and forum reply generation.
- Keep the current runnable forum UI intact for now.

## Deliverables

### 1. Domain Structure

- [x] Create `src/features/forum-domain/`
- [x] Define forum channels, thread types, lifecycle stages, NPC tiers, and relationship stages
- [x] Add reusable labels and theme presets for each world

### 2. Data Model

- [x] Create `ForumThreadV2`
- [x] Create `ForumCommentV2`
- [x] Create `ForumNpcProfile`
- [x] Create `ForumUserIdentity`
- [x] Keep these types isolated from current `src/types.ts` for now

### 3. Prompt Base

- [x] Add forum scenario prompt
- [x] Add thread-generation prompt builder
- [x] Add reply-generation prompt builder
- [x] Make prompt builders aware of world tone and forum interaction style

### 4. Next Step Entry

- [ ] Migrate current forum mock data into the new v2 shape
- [ ] Replace old `category: "全部"` with real world channels
- [ ] Upgrade comment view from generic nested replies to floor-based presentation
- [ ] Add first batch of world-specific seed threads
- [ ] Wire `forumCall` to actual generation entry points

## Notes

- Yes, forum generation should have its own prompt layer.
- It should not reuse chat prompts directly, because the output target is different:
  - forum thread = public post
  - forum reply = short, public, in-character floor reply
  - same-topic rewrite = cross-world reformulation
- The current step only builds the foundation so we can wire generation cleanly in the next step.
