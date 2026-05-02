# Forum Implementation Roadmap v2

## Goal

Reorder forum work into a product-first sequence:

1. make the forum feel alive
2. make it fun
3. add the new-world spectator mode
4. complete identity rules
5. only then wire forum memory write-back

This checklist replaces the old “foundation first, memory soon after” ordering.

---

## Phase 1: Forum Must First Feel Real

### Goal

Make the current forum page feel like a real, inhabited forum before expanding system depth.

### Required Deliverables

- [x] Seed-based opening flow stays static on first entry
- [x] World-channel structure exists
- [x] Thread generation uses forum-specific prompt builders
- [x] Reply generation uses forum-specific prompt builders
- [x] Dynamic forum users persist across refresh / reload
- [x] Dynamic avatars move toward a unified anime-like style
- [x] Dynamic handle display avoids raw system ids
- [x] User posting is supported
- [x] User post now triggers initial AI audience replies
- [x] User comment triggers follow-up AI replies
- [x] Comment view is flattened instead of infinitely nested narrow threads
- [ ] AI replies should more reliably respond to the user’s actual latest comment
- [ ] Dynamic nicknames and `@ID` should become more consistently human and less template-like
- [ ] Dynamic bios should feel more like user-written signatures across batches

### Experience Rules That Must Not Regress

- [x] First-entry feed should still come from static seed selection
- [x] Dynamic generated users must not expose machine-like ids
- [x] Comment cards should stay full width
- [x] User post should not feel unanswered
- [x] Buttons should avoid “all black admin panel” styling

---

## Phase 2: Forum Must Become Fun

### Goal

Move from “a working feed” to “a place where things are happening”.

### Planned Deliverables

- [ ] Add stable post types: rant / confession / help / gossip / update / poll
- [ ] Add hot-thread continuation logic
- [ ] Add faction feeling in replies: defend / mock / watch / suspect / ship
- [ ] Add recognizable repeat forum personalities
- [ ] Add stronger downstream consequences when the user says something memorable in-thread

### Fun Test

- [ ] A user should want to keep watching a thread after reading the first few replies
- [ ] A user comment should sometimes change the tone or direction of the thread
- [ ] The forum should feel like it grows stories, not just isolated posts

---

## Phase 3: New-World Spectator Mode

### Goal

Add a second forum mode where forum users actively discuss the user and characters from an outside perspective.

### Planned Deliverables

- [ ] Add a separate entry for `新世界` / spectator mode
- [ ] Add world-shell selection
- [ ] Split spectator targeting into `user slot` + `character slots` instead of one mixed `subject` field
- [ ] Support multi-character spectator targeting with role weights: primary / secondary / equal
- [ ] Allow spectator user slot to bind a specific user mask so spectator generation can read different user identities
- [ ] Launch v1 with 3 world shells
  - [ ] campus forum
  - [ ] workplace board
  - [ ] cultivation sect forum
- [ ] Generate spectator-style threads about character aura, favoritism, romance speculation, danger, chemistry
- [ ] Allow the user to reply inside these spectator threads
- [ ] Let forum users continue reacting around the user + character relationship

### Mode Rules

- [ ] Public forum remains public-world discussion
- [ ] Spectator mode becomes “people discussing the user and characters”
- [ ] These two modes should not collapse into one undifferentiated feed
- [ ] In spectator settings, `thread type` controls structure, `angles / clues` control content, and `user + characters` control who the crowd is discussing
- [ ] A spectator target should be able to mean `user x role A x role B`, not only `user x single role`
- [ ] User masks stay user-side identity filters; they affect how the crowd reads the user, but do not overwrite character identity

---

## Phase 4: Identity System Completion

### Goal

Turn current identity handling into a full forum identity system.

### Current State

- [x] self posting
- [x] anonymous posting
- [ ] anonymous commenting
- [ ] channel masks
- [ ] persistent hidden real identity mapping
- [ ] reveal-ready anonymous history

### Required Deliverables

- [ ] Posting supports self / anonymous
- [ ] Commenting supports self / anonymous
- [ ] Character-driven posting remains system-driven instead of user-switchable
- [ ] Frontstage identity and backstage real identity are separated
- [ ] Anonymous interactions are still attributable in-system

---

## Phase 5: Forum Relationship Memory Write-Back

### Goal

Only after the above phases are stable, connect forum events to relationship / memory systems.

### Planned Deliverables

- [ ] Define forum event evidence schema
- [ ] Track meaningful public interactions
- [ ] Preserve hidden identity attribution for anonymous events
- [ ] Allow later chat references to forum events
- [ ] Let forum interactions contribute to relationship context

### Important Note

- [ ] Do not prioritize this phase before spectator mode + identity completion
- [ ] No memory write-back should ship on top of unstable interaction primitives

---

## Summary

The correct order is:

1. alive forum
2. fun forum
3. spectator mode
4. identity completion
5. memory write-back

This is now the authoritative forum implementation order.
