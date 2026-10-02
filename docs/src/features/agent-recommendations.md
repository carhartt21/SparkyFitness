# Agent recommendations

Recommendations connect recorded wellness data to actions you can review in X on Track. An external agent reads the areas you select and returns proposals. Only you, signed in with your own app session, can activate a proposal. Family delegates and API/MCP credentials cannot approve one.

## Set up your account

The administrator enables `XOT_COACHING_ENABLED=true` on the server. Open **Recommendations → Schedule & connections** on the web, or **More → Recommendations** on mobile.

1. Enable periodic reviews and select nutrition, activity, recovery, habits and/or measurements.
2. Set the review times. Defaults are 08:00 and 20:00 daily, Sunday 09:00 weekly, and a 20:00 inbox digest. Times use the account's IANA timezone from Settings.
3. Add an agent connection and select its allowed areas. Create its proposal-only key; copy it once into the external runner's private configuration. Keys expire after 90 days; revoke or rotate them here. Never use a full-access API key for the scheduled runner.
4. Install and test the [Mac runner](../developer/mcp/recommendations.md#mac-subscription-runner). The Mac must be awake, online and signed in to Codex with its saved ChatGPT login.

OAuth clients request **`mcp:propose`** at `/mcp/chatgpt`. Consent creates an owner/client binding with selected areas. Existing `mcp:read` and `mcp:write` consents are separate: enabling proposal access does not grant direct diary writes. A compatible client must explicitly request the new scope; reconnecting an existing read-only connection does not upgrade it automatically.

## Review a recommendation

The inbox presents the full backlog in impact order, with area filters and pagination. Open a recommendation to inspect its benefit, rationale, confidence, data coverage and limitations. Expand the cited recorded evidence before making your decision.

Edit the action details, then choose **Changes to confirm**. The preview shows current and proposed effects. Accept activates those effects together in one transaction. A stale proposal, changed target, changed referenced food/exercise, or expired preview requires a fresh preview. Decline records your reason and suppresses the topic for 30 days; History lets you explicitly request reconsideration.

Supported actions are one-off tasks, measurable objectives, habit configuration, measurement reminders, notification settings, numerical targets, meal plans, workout plans and mobility routines/schedules. Scheduling and action windows are editable. No medication, dose, diagnosis or reproductive-health action is supported.

### Planned meals and workouts

New agent meal and workout plans use **prompt mode**. A planned meal appears in Diary/Dashboard without increasing intake. Choose **Record consumption**, check the portion and time, and explicitly confirm to create food entries. Logging retries return the existing receipt rather than creating a second meal. Existing plans that prefill the diary keep their previous behavior.

Meal quantities and schedule versions are retained. Nutrition is checked against the accessible food/recipe library when you confirm consumption; a schedule is not a frozen nutritional claim. Workout attendance requires an explicitly completed exercise set. A timer, a notification tap, a planned entry, or an agent report cannot establish consumption or exercise completion.

Forward revisions default to tomorrow in the reference agent instructions. Existing diary entries and historical versions are preserved; the preview discloses overlapping diary entries. Check overlapping plans before logging an item twice.

## Follow through

**Active** shows accepted commitments and recorded progress. One-off tasks have a **Mark task done** button. Objectives and adherence use server evidence; they cannot be completed by an agent or a generic button. Missing days, unknown nutrients and unsynced records remain unknown. Upper-bound nutrition targets require an explicitly complete diary day.

You can skip or stop tracking a commitment, optionally recording actual effort, feasibility and a reason. Stopping tracking closes coaching follow-up; manage an already accepted plan, habit or reminder in its normal application screen to disable that configuration. Pausing periodic reviews stops new runs while keeping accepted actions available.

Digests and due-task reminders use the existing optional notification system. They require an opted-in mobile device advertising Engagement v3, share quiet hours and the account daily cap, and never mark an action done. At most one digest is attempted per account/local day. A digest cannot be snoozed into an additional daily delivery.

## Data and retention

Daily reviews use seven calendar days plus today's unresolved work; weekly reviews use 28 days. Missed scheduled windows are coalesced to the latest eligible review. Pending and active topics are deduplicated. A failed or timed-out run publishes nothing.

Raw frozen snapshots expire after seven days; run metadata and agent operation receipts after 90 days. Pending proposals expire after at most 14 days or their action window. Cited evidence, decisions and outcome history stay with the recommendation until you delete its inactive history. That deletion also removes retry receipts containing the recommendation or action. Accepted canonical configurations and diary logs remain managed in their normal application screens. Agent revocation blocks new calls immediately.

FDDB import sections are read-only in Diary/Dashboard and appear only on days with actual entries, including zero-calorie entries. They offer no add, edit, delete, copy, conversion or meal-status controls and are excluded from quick-add choices.
