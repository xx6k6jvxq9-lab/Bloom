# App Shell Stability Roadmap

## Purpose

This document records the loading, startup, and runtime stability strategy we settled on for the Bloom app shell.

It is written to answer four practical questions:

1. What was wrong with the previous app shell?
2. What has already been changed in code?
3. What still remains to be done or kept as a long-term rule?
4. How do we manually verify that the app still feels smooth and that old data remains safe?

## Core Principles

- Home should boot first and stay alive.
- Chat should feel immediate.
- Heavy modules should not ride along with the home screen by default.
- Global loading tricks must not silently overwrite old persisted data.
- New web-style features such as food delivery, reading, mall, news, and events should not be merged into the home startup path.
- Generic skeleton screens are not part of the final direction. Scene pages should eventually use their own visual transitions or dedicated entry motion.

## What The Problem Was

The original app shell had four overlapping issues:

- The home screen carried too many non-home features in the startup path.
- Startup hydration restored too many modules before the user even needed them.
- Background preload was too broad and too early.
- The runtime behaved more like one growing monolith than a "phone shell plus apps".

The visible symptoms were:

- Android Chrome could show a black screen or a long blank period during startup.
- Entering common pages could feel uneven because startup and preload pressure were fighting each other.
- Adding more features would keep increasing the chance of home regressions.

## Completed Batches

### Batch 1: Shrink The Home Startup Bundle

Goal:

- Remove low-frequency heavy pages from the initial home path.

Main changes:

- Moved several heavy screens behind page-level lazy loading.
- Kept the main chat shell immediate so "tap chat and see it now" still holds.

Main files:

- `src/features/app-shell/AppScreenContent.tsx`
- `src/features/app-shell/lazyApps.ts`
- `src/features/app-shell/AppShellPrimitives.tsx`

Result:

- Home no longer drags chat sessions, dream, settings, and worldbook directly into the first path.
- The modern entry bundle was reduced substantially compared with the earlier baseline.

Notes:

- Generic fallback skeletons were later removed again for all pages because they looked bad and did not fit the desired product feel.

### Batch 2: Split Hydration Into Core And Deferred Phases

Goal:

- Let home restore only what it needs first.
- Delay clearly non-home data until after boot.

Main changes:

- `bootstrapLocalAppState` now returns core app data first.
- Deferred module hydration was introduced for non-home data.
- Full app snapshot persistence is paused until deferred hydration finishes, so temporary defaults cannot overwrite real stored data.

Main files:

- `src/features/persistence/bootstrapLocalAppState.ts`
- `src/features/persistence/useAppPersistence.ts`

Deferred modules in the current implementation:

- `friendRequests`
- `callHistory`
- `savedDates`
- `collectedDates`
- `walletData`
- `forumData`

Result:

- Home can boot before all non-home modules finish restoring.
- Old local data stays protected because delayed modules are not written back as empty placeholders.

### Batch 3: Keep Chat Hot

Goal:

- Make chat feel closer to a phone app instead of a page that reopens from scratch every time.

Main changes:

- The main chat screen remains mounted after first activation.
- A small set of chat-adjacent screens remains mounted once opened:
  - `character-profile`
  - `character-moments`
  - `add-character`
- Recent session retention was added:
  - last 2 direct chat sessions
  - last 1 group chat session

Main files:

- `src/features/app-shell/AppScreenContent.tsx`
- `src/features/chat-session/ChatSessionMount.tsx`

Result:

- Returning to chat is faster.
- Switching between a small number of recent sessions feels much closer to a real phone app.

### Batch 4: Replace Broad Preload With Contextual Preload

Goal:

- Stop preloading a broad fixed list at startup.
- Preload based on where the user is and where they are likely to go next.

Main changes:

- Removed the broad startup preload logic from `useAppEnvironment`.
- Added a lightweight session-scoped transition predictor.
- Recorded app-to-app navigation transitions.
- Used current app context plus recent transition history to preload only the most likely next targets.
- Expanded "preload before navigation" so it also covers page-level chunks such as:
  - `dream`
  - `settings`
  - `worldbook`
  - `chat-session`

Main files:

- `src/features/app-shell/useAppEnvironment.ts`
- `src/features/app-shell/appPreloadPredictor.ts`
- `src/App.tsx`
- `src/features/app-shell/AppScreenContent.tsx`
- `src/features/app-shell/lazyApps.ts`
- `src/features/app-shell/appShellHandlers.ts`

Result:

- Android browser tabs are treated more conservatively on home.
- Chat and high-probability next hops are still warmed in a focused way.
- Dream, settings, and worldbook can now preload before the transition rather than only after the page switch.

### Follow-Up Rule Change: Character Voice Must Be Opt-In

Goal:

- Global voice capability should not make every character appear voice-enabled by default.

Main changes:

- Character voice is now off by default unless explicitly enabled in chat settings.
- Uploading a sample or cloning a voice no longer silently turns the character voice switch on.

Main file:

- `src/components/chat/ChatSettingsPanel.tsx`

Result:

- Character voice now behaves like a per-character opt-in setting, which matches the intended product logic.

## Current Runtime Direction

The app shell now follows this model:

- Home boots first.
- Chat stays hot.
- Recent sessions stay warm.
- Heavy modules restore later.
- Preload is contextual, not global.
- Generic skeletons are avoided.

This is the correct long-term direction for a "phone shell plus many apps" architecture.

## Manual Validation Checklist

Use a browser profile that already contains real local data.

### Home Startup

- Hard refresh once.
- Open home.
- Confirm home appears without a long black period.
- Confirm the desktop is visible before low-frequency modules are fully restored.

### Chat

- Enter chat from home.
- Confirm the main chat list feels immediate.
- Open one direct chat, go back, then reopen it.
- Open a second direct chat and switch between the two.
- Open one group chat, go back, then reopen it.
- Confirm recent sessions feel retained rather than fully cold-opened.

### Page Entry

- Enter `dream`, `settings`, and `worldbook` directly from home.
- Confirm they feel closer to immediate transition than before.
- Confirm there is no generic gray skeleton overlay.

### Deferred Data Safety

- Use a browser profile with existing forum, wallet, call history, and dating data.
- Hard refresh.
- Wait a few seconds.
- Open:
  - forum
  - wallet
  - call history related surfaces
  - dating record related surfaces
- Confirm data is still there after reload.
- Reload again and confirm data remains intact.

### Character Voice

- Open a character with no explicit voice setting.
- Confirm "character voice" is off by default.
- Turn it on manually for one character only.
- Confirm that character can use voice while others still remain text-only by default.

## Compatibility Rules

These rules must remain true while continuing the roadmap:

- Do not rename existing storage keys casually.
- Do not remove old compatibility reads before multiple stable releases.
- Do not write temporary empty deferred values back into persistence before the deferred phase finishes.
- Do not reintroduce generic startup-wide preload.
- Do not let new features join the home startup path by default.

## What Still Remains

### Batch 5: Future Feature Entry Rules

This is now more of a governance rule than an urgent code batch.

Future web-style features such as:

- food delivery
- reading
- mall
- news
- event pages

should follow these rules:

- default to their own chunk boundary
- default to their own persistence namespace
- do not enter the home bundle by default
- do not join startup hydration by default
- do not join the "always retained" set by default
- only get preload if there is a clear path-based reason

This keeps the app shell from regressing into a monolith.

## Suggested Future Classification

For future work, treat features in three levels:

### Core Hot Paths

- home
- chat
- direct chat session
- group chat session

These should feel immediate and can justify retention.

### Scene Apps

- dream
- couple-space
- perception
- monitor

These can use dedicated entry motion later, but should still remain outside the home startup path.

### Web-Style Expansion Apps

- food delivery
- reading
- mall
- similar future content-heavy pages

These should behave like separate apps hanging off the phone shell.

## Files Touched So Far

- `src/App.tsx`
- `src/features/app-shell/AppScreenContent.tsx`
- `src/features/app-shell/AppShellPrimitives.tsx`
- `src/features/app-shell/appPreloadPredictor.ts`
- `src/features/app-shell/appShellHandlers.ts`
- `src/features/app-shell/lazyApps.ts`
- `src/features/app-shell/useAppEnvironment.ts`
- `src/features/chat-session/ChatSessionMount.tsx`
- `src/features/persistence/bootstrapLocalAppState.ts`
- `src/features/persistence/useAppPersistence.ts`
- `src/components/chat/ChatSettingsPanel.tsx`

## Final Summary

The shell is now moving from:

- one heavy startup path

to:

- a light shell
- hot chat
- deferred non-home data
- contextual preload
- future feature isolation

That is the correct long-term foundation for adding more functionality without bringing back home black-screen regressions.
