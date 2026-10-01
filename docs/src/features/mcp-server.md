# AI Assistant & MCP Server

X on Track includes a powerful **Model Context Protocol (MCP)** server. This allows you to connect advanced AI assistants (like Claude Desktop, Cursor, or custom AI clients) directly to your personal health data securely.

When you enable the MCP Server, your AI assistant transforms into a **Personal Health Intelligence** layer that can read your health logs, track your progress, and provide hyper-personalized coaching based on your actual data.

---

## 🛠 Available Tools & Capabilities

The AI assistant can perform the following actions across different health domains. Tools that convert units use your **Unit Preferences**; read-only measurement reminder status returns weight in kg and custom values in their configured unit, explicitly named in the response.

### 🥗 Nutrition & Food

Track your diet, manage meals, and analyze your nutritional intake.

| Feature                | Tool Action                         | Example Prompt                                                                  |
| :--------------------- | :---------------------------------- | :------------------------------------------------------------------------------ |
| **Log Food**           | `log_food`                          | "I just had a 250g steak and a salad."                                          |
| **Quick Add**          | `log_external_food` / `create_food` | "Quick add my restaurant tasting menu, ~1200 kcal — don't save it to my foods." |
| **Meal Templates**     | `log_meal`                          | "Log my 'Standard Breakfast' for today."                                        |
| **Water Tracking**     | `log_water`                         | "I drank 500ml of water."                                                       |
| **Daily Diary**        | `list_diary`                        | "What have I eaten today?"                                                      |
| **Copy Entries**       | `copy_from_yesterday`               | "Copy my breakfast from yesterday to today."                                    |
| **Nutrition Analysis** | `get_nutritional_summary`           | "Give me a breakdown of my macros for the last 7 days."                         |

::: info
**Quick Add** mirrors the checkbox in the web and mobile food forms: the food is logged to your diary for that date but stays out of your food list, search, favorites, and recents. It applies to whichever path the assistant already uses — `log_external_food` for a match from a provider such as OpenFoodFacts or USDA, `create_food` for a custom or homemade food — so asking for Quick Add never costs you the verified provider nutrition. It applies only to foods being added for the first time: if the food is already in your food list, it stays there and the assistant tells you Quick Add was not applied, because hiding it would remove a food you already rely on. Ask for it explicitly ("quick add", "don't save this to my foods"); otherwise foods the assistant creates are saved to your list as usual.
:::

### 🏋️ Exercise & Fitness

Manage your workouts, track strength progress, and use presets.

| Feature               | Tool Action             | Example Prompt                                         |
| :-------------------- | :---------------------- | :----------------------------------------------------- |
| **Log Workout**       | `log_exercise`          | "Log 3 sets of Bench Press at 80kg for 10 reps."       |
| **Workout Presets**   | `log_workout_preset`    | "Start my 'Leg Day' workout."                          |
| **Exercise Details**  | `get_exercise_details`  | "How do I perform a Bulgarian Split Squat?"            |
| **Progress Tracking** | `get_exercise_progress` | "Show me my Bench Press progress over the last month." |
| **Search Library**    | `search_exercises`      | "Find some advanced chest exercises using dumbbells."  |

### 📈 Biometrics & Check-ins

Monitor your weight, sleep, mood, and daily habits.

| Feature            | Tool Action                   | Example Prompt                                  |
| :----------------- | :---------------------------- | :---------------------------------------------- |
| **Daily Wizard**   | `sparky_daily_checkin_wizard` | "I'm ready for my daily check-in."              |
| **Weight & Body**  | `log_biometrics`              | "My weight is 185 lbs today."                   |
| **Sleep & Mood**   | `log_sleep`, `log_mood`       | "I slept 7 hours and feel like an 8/10."        |
| **Fasting Status** | `get_fasting_status`          | "Am I still in my fasting window?"              |
| **Weight History** | `get_biometrics_history`      | "Show me my weight trend for the last 30 days." |
| **Custom Metrics** | `log_custom_metric`           | "My blood pressure was 120/80 today."           |

### 📋 Goals, Habits & Reports

Set targets and get consolidated performance reviews.

- **Habit Tracking** (`sparky_manage_habits`): "Did I take my vitamins today?"
- **Goal Management** (`sparky_manage_goals`): "Set a new weight goal of 175 lbs by July."
- **Weekly Reports** (`sparky_get_report`): "Give me a weekly performance summary."
- **Profile Settings** (`sparky_manage_profile`): "Change my energy unit to kJ."

### 📅 Daily tracking (read-only)

These tools only read. Logging habits, completing check-ins, changing health context, recording measurements or supplement intake, and marking meals are done in the apps.

- **Daily check-in** (`sparky_get_daily_checkin`, `sparky_list_daily_checkins`): answers with their versioned meanings; a missing day is not recorded, never low.
- **Health context** (`sparky_list_health_context_periods`): user-declared injury, illness and vacation periods. They are declarations, not diagnoses.
- **Habits** (`sparky_list_habits`, `sparky_get_habit_history`): an explicit 0 is a record; days without a record are omitted.
- **Measurement reminders** (`sparky_get_measurement_reminder_status`): due state plus `measurement_recorded`, the actual saved `value`, `unit`, `measurement_id`, `recorded_at` and `source` for the requested day. Weight is a number in kg; custom values retain their stored text and configured unit. Missing readings return `false` and null value fields; an older reading is never substituted. Zero is a recorded value. Weight source is null because the measurement table does not retain provider provenance. Only configured reminders are included; this is not a full measurement history endpoint.
- **Meal status** (`sparky_get_meal_tracking_status`).
- **Daily Progress** (`sparky_get_daily_progress`, `sparky_get_daily_status_context`): completed and applicable explicit tasks with each item's reason and a version. It is not a health score.
- **Supplements** (`sparky_list_supplements`, `sparky_get_supplement`, `sparky_list_supplement_entries`): only items marked as supplements; medications are never returned.

Ranges are limited to 92 days, or 31 days for a read-only MCP key.

---

## 🕵️ AI Personalization (The "Health Detective")

Because the AI has access to all these tools, it can do things a standard app cannot:

- **Correlation Detection**: "I noticed your sleep quality is 20% better on days you finish your last meal before 7 PM."
- **Smart Planning**: "Based on your current weight trend and yesterday's activity, I recommend increasing your protein by 20g today."
- **Inventory Logic**: "You've logged Greek Yogurt 5 times this week. Should I add it to your high-protein shopping list?"

---

## 🔐 Security & Privacy

1.  **User Isolation (RLS)**: Normal MCP tools are restricted by PostgreSQL **Row Level Security**, scoped to the user authenticated by the API key. The AI can _only_ see data belonging to that user.
2.  **Admin-Only Dev Tools**: A small set of optional developer/debugging tools is **off by default**. They require an admin API key, plus either the **Admin > System Settings** toggle or the `DEV_TOOLS_ENABLED=true` environment variable, which forces them on regardless of the stored setting. These tools intentionally run with elevated database access (the owner pool, bypassing Row Level Security), so leave them disabled unless you are actively debugging.
3.  **MCP read-only keys**: A key created with **MCP read-only** access works only at `/mcp`. It cannot create a normal API session or authenticate to protected REST routes. The MCP server publishes only reviewed query tools for this key; write-capable and admin tools are unavailable. Use **Full API access** only when an integration needs to change data.
4.  **Local First**: If you run X on Track locally, your data never leaves your infrastructure until you send it to your chosen AI provider (e.g., Anthropic or OpenAI).

## 🚀 Getting Started

The MCP server is served **in-process** by the main X on Track server. The existing API-key endpoint is `POST /mcp`. When the administrator enables OAuth, `POST /mcp/chatgpt` offers a separate, account-authorized connection for ChatGPT and other compatible MCP clients. It exposes reviewed read tools and selected food, exercise, water, and notification write tools only when the account grants `mcp:write`. Direct writes requested through those tools do not require a second in-app confirmation. Connected assistants can be reviewed and disconnected in web Settings; disconnection blocks the signed token immediately.

### 1. Generate an API Key

Go to **Settings → Developer & Integrations → API Key Management** in the web UI and generate an **MCP read-only** key. You'll pass it as a **Bearer Token** in the `Authorization` header. Existing full-access keys continue to expose the full MCP tool set.

### 2. Find Your MCP Endpoint

- **Production**: `https://<your-host>/mcp` (the production nginx config proxies `/mcp` to the server).
- **Local dev**: `http://localhost:8080/mcp` — the frontend Vite dev proxy forwards `/mcp` to the server. Hitting the server port directly at `http://localhost:3010/mcp` also works.
- **OAuth assistant connection, when enabled**: `https://<your-host>/mcp/chatgpt`. Connect from an OAuth-capable MCP client and approve the requested read/write scopes on the web login page. No API key needs to be pasted into the client.

### 3. Configure Your Client

**ChatGPT desktop custom MCP connection**

1. Open **Plugins → MCPs → Add** and choose **Streamable HTTP**.
2. Name the server `x-on-track` and enter `https://<your-host>/mcp/chatgpt`.
3. Leave **Bearer token env var** and **Headers** empty for OAuth. Save and restart the connection, then select **Authenticate/Authorize** in the server list. OAuth does not require an authentication dropdown in the add-server form.
4. Sign in to your X on Track account and review the permissions. An existing browser session can skip the sign-in prompt.
5. Start a new conversation and check `/mcp` for the connected server. The connection and credentials are shared with Codex clients using the same local host configuration. If needed, `codex mcp login x-on-track` starts the sign-in flow from the CLI.

The server must have OAuth enabled and its discovery/authentication routes must be reachable through the public ingress. Browser login continuation and consent return a Better Auth JSON redirect (`url`), which the app follows to the next signed authorization page or the registered client callback. If an earlier attempt expired, begin a new authorization from the client instead of reusing the old browser URL. See the [official desktop MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=app).

For an API-key connection in the same desktop form, use `https://<your-host>/mcp` and an `Authorization` header with `Bearer <MCP_READ_ONLY_KEY>`. The **Bearer token env var** field is a variable name whose value is read from the client environment; it is not a field for pasting the token. Account OAuth tokens and application API keys use separate endpoints.

**HTTP / remote-capable clients** (Cursor and other clients that support streamable HTTP) point directly at `/mcp` with an `Authorization: Bearer <API_KEY>` header:

```json
{
  "mcpServers": {
    "x-on-track": {
      "url": "https://<your-host>/mcp",
      "headers": {
        "Authorization": "Bearer <API_KEY>"
      }
    }
  }
}
```

**stdio-only clients** (such as the classic Claude Desktop config) can't talk HTTP directly. Use the off-the-shelf [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge. The key goes in an `env` block, and the header uses the no-space `Authorization:${AUTH_HEADER}` form — `mcp-remote`'s documented workaround for clients that mangle spaces in header arguments (e.g. Claude Desktop on Windows, Cursor):

```json
{
  "mcpServers": {
    "x-on-track": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<your-host>/mcp",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": { "AUTH_HEADER": "Bearer <API_KEY>" }
    }
  }
}
```

_Note: for a local-dev server over plain HTTP, add `--allow-http` to the args and use `http://localhost:8080/mcp` (or `http://localhost:3010/mcp` to hit the server directly) — `mcp-remote` refuses non-HTTPS URLs otherwise._

**Open WebUI client** (e.g. for locally hosted Ollama, Llama.cpp, etc.)

1.  In Open WebUI, click your name in the bottom left and open the **Admin Panel → Settings**.
2.  Scroll down to the Tools section and select **Integrations**.
3.  Add a new connection:
    - Type: MCP Streamable HTTP (click 'OpenAPI' to change the option)
    - URL: The MCP url from above
    - Auth: Bearer
    - API Key: The API key from above
4.  Save the options and refresh the web page. You can enable it on new chats through the Integration option.
