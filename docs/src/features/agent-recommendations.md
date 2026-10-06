# Agent recommendations

Recommendations connect recorded wellness data to actions you can review in X on Track. An external agent reads the areas you select and returns proposals. Only you, signed in with your own app session, can activate a proposal. Family delegates and API/MCP credentials cannot approve one.

## Set up cloud reviews

The administrator enables `XOT_COACHING_ENABLED=true` after release checks. Open **Recommendations → Schedule & connections** on web, or **More → Recommendations** on phone. Recaps are the default view; phone Insights and web Reports also link here.

1. Enable periodic reviews. Select nutrition, activity, recovery, habits and/or measurements. Times use the account's IANA timezone from Settings.
2. Save the calendar review schedule: one daily cloud task at **08:00** by default. Daily reviews cover yesterday; Monday adds the previous Monday–Sunday, the first of the month adds the previous month, and January 1 adds the previous year. Each cadence can be disabled. Missed windows coalesce to the latest period for each cadence instead of replaying every missed day.
3. Optionally allow **supplement adherence** or **server notification history**. These need nutrition or habits respectively and also need matching permission on the connection. Medication records and dose changes are excluded. Notification delivery does not prove that you saw a reminder; phone-only local reminder history is unavailable.
4. In **Connect a cloud review**, copy the MCP address into ChatGPT and authorize reading and proposals. Refresh the authorized connection list, select the intended connection, and enable its bounded review access. Save selected data permissions before connecting; copying a task uses saved settings.
5. Copy the review prompt and test it in a normal ChatGPT conversation using this connection. Then create **one daily cloud task** at the saved time and timezone. The application does not create a ChatGPT schedule automatically. Task/plugin availability depends on your account/workspace; an authorized connection is not proof of an unattended working schedule. Test an actual unattended run and verify that its recap arrives here before relying on it. Update the ChatGPT task separately if its time changes.

ChatGPT cloud tasks can use eligible connected tools where supported; see [OpenAI's automation guide](https://learn.chatgpt.com/docs/automations). An unavailable task/connection stops the run without silently installing an API or Mac fallback. An optional, explicitly configured [Mac subscription runner](../developer/mcp/recommendations.md#mac-subscription-runner) remains supported separately.

For a new ChatGPT coaching connection, use **`https://<your-host>/mcp/coaching`**, copied from Recommendations. It requests **`mcp:read mcp:propose`** and the consent screen shows selectable review areas. A screen offering only read/write access belongs to the older `/mcp/chatgpt` connection; refreshing that connection does not add proposal permission. Existing bound coaching connections on the older address still work. A bound coaching connection exposes only the six coaching tools. Consent never permits the external reviewer to approve plan, goal or notification changes. Revoke the connection to stop its calls, and remove the external ChatGPT task separately.

## Read a recap or request a review

**Recaps** contains daily, weekly, monthly, yearly and manual reviews. A successful no-change review still publishes a recap. Open it to mark it read, inspect observations/limitations and optionally expand retained evidence. Delete removes only that recap, not diary records, accepted configurations or recommendations.

**Request review** queues work for the next cloud invocation; it does not trigger ChatGPT immediately. Copy the prompt into ChatGPT for an immediate manual run. One invocation drains at most five eligible periods sequentially.

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

Calendar protocol 2 uses the actual preceding daily/weekly/monthly/yearly period. Monthly and yearly evidence is aggregated on the server into bounded monthly rows, not an annual raw diary. Aggregated counts describe recorded entries and days, not adherence; unknown values stay unknown. Legacy protocol 1 keeps its original seven-day daily and 28-day weekly windows. Missed scheduled windows are coalesced to the latest eligible review. Pending and active topics are deduplicated. A failed or timed-out run publishes nothing.

Recaps and their cited evidence remain owner-only until explicitly deleted and survive snapshot, run and agent cleanup. Per-cadence completion survives recap deletion, so deleted reviews are not automatically repeated. Owner decisions and outcomes feed into the next review; a declined topic stays suppressed until explicitly reconsidered. Feedback arriving after a review starts is retained for the next run. Only a successful report advances the feedback cursor.

Raw frozen snapshots expire after seven days; run metadata and agent operation receipts after 90 days. Pending proposals expire after at most 14 days or their action window. Cited evidence, decisions and outcome history stay with the recommendation until you delete its inactive history. That deletion also removes retry receipts containing the recommendation or action. Accepted canonical configurations and diary logs remain managed in their normal application screens. Agent revocation blocks new calls immediately.

FDDB import sections are read-only in Diary/Dashboard and appear only on days with actual entries, including zero-calorie entries. They offer no add, edit, delete, copy, conversion or meal-status controls and are excluded from quick-add choices.
