# Guided mobility implementation progress

This records the phone-side Stage 4 implementation against the [six-stage plan](https://app.notion.com/p/3e55fb777c5d811eb71ce24de890c803). Physical-device checks are tracked separately in [physical-device-tests.md](./physical-device-tests.md).

## Implemented

- Saved, user-authored sequences with named timed or repetition steps, optional instructions, side, and transition duration. Each routine chooses off, haptic, sound, or both for an end-of-timer cue.
- The phone runner can pause, resume, repeat a step, confirm completion, skip, continue after a transition, or end a session. It presents the next step and keeps the current step legible.
- Routines, active sessions, and recent results use account- and server-scoped local persistence. A session contains a snapshot of its routine so edits to the saved definition do not alter a session in progress. The active phase and elapsed time survive app relaunch.
- Countdown expiry does **not** record movement. Only an explicit “I did this step” tap records completion; skips are recorded separately. Confirmed outcomes are kept if the session is ended.
- Deleting a routine and ending a session require confirmation. Local storage validates records before writing and refuses duplicated step identities.
- The routines screen now reviews older sessions, revealing recorded completed and skipped steps on demand. Unrecorded steps remain clearly separate, and a saved session can be deleted without affecting the active session or another account.
- Each routine can opt into a daily local reminder time. The app-scope engagement coordinator arbitrates it with meal, movement-break, medication, and hydration notifications under the existing daily cap and collision spacing. A tap verifies the current account and routine, then opens the routine list without starting or recording movement.

The entry point is the Guided mobility routines action on Movement Break. The domain code is `SparkyFitnessMobile/src/services/mobilityRoutineStore.ts`; the phone UI is `SparkyFitnessMobile/src/screens/GuidedMobilityScreen.tsx`.

## Remaining Stage 4 work

- Add richer recurrence controls if the owner needs certain weekdays or a time window. The current routine schedule is an optional daily clock time; only one movement-domain prompt per day is accepted by the shared policy.
- Validate sound, haptics, foreground/background timing, relaunch recovery, and keyboard behavior on a physical iPhone. No physical evidence is claimed here.
- Decide whether a Watch companion runner is part of Stage 4; the six-stage plan currently specifies guided routines without an explicit Watch acceptance gate.

The store and reminder tests cover timer expiry without implicit completion, pause/resume, transitions, explicit outcomes, account isolation, edits/deletes during a session, duplicate-ID rejection, scheduling policy, and notification response validation. They do not substitute for the separate physical-device checks.
