# Meals & Meal Categories

This section provides an overview of meal-related features in X on Track.

---

## Mobile diary groups

Foods in the same meal category appear together in the day timeline. Groups
start collapsed, with time, known calories and the configured meal-state control
visible in the header. Tap the header to expand the foods and their actual entry
times. Tap the state icon to cycle states; hold it to choose a state from the menu.
State controls are available when meal tracking is enabled.

Today and future days include configured meals and actual scheduled tasks.
Default meal times determine their chronology, consistently with meal reminders.
Planned supplement intake or workouts remain planned until explicitly recorded.
Past days contain recorded entries, without filling the day with current plans.
Recorded activity, water, intake and sleep details can also expand. Food selection,
swipe actions, photos and serving adjustments remain available inside groups.

## Daily Meals on the phone

Tap the Home calorie gauge to open **Meals** for the selected day. The compact
summary shows known nutrition and the day's exercise-adjusted allowance using
the same policy as Home. A missing goal does not create an allowance. Pending
meal photos remain captured, rather than becoming completed zero-calorie meals.

Meal groups start collapsed. Expand one to inspect its foods and recorded times;
the separate state icon cycles states on tap and opens explicit choices on hold.
Daily Progress meal links open this same screen with the selected meal expanded.
Use **Add food** or the camera action for existing search and photo flows.

Use **Edit** to select foods, then move or copy them to another meal/day, or delete
the selected entries. Edit mode also permits dragging foods between meals. Tap a
portion to use the existing serving adjustment sheet. These actions update actual
entries and the affected daily summaries; changing a meal state does not change
its food quantities.

**Save as template** opens the existing meal editor with the recorded ingredient
quantities, units and nutrient snapshots. It does not save automatically or copy
entry dates, times or photographs. Ingredients without confirmed nutrition or a
reusable library food need review. Resolve them first or explicitly continue with
the resolved ingredients; missing nutrition is never invented.

## Suggested Meal Category Times

X on Track dynamically suggests the appropriate meal category (e.g., Breakfast, Lunch, Dinner, Snacks, or custom categories) when you log food based on your current time of day.

### How Suggested Times Work

Each meal category can have a **Default Time** assigned to it:

- When you log food, the app finds the meal category whose `default_time` is the **latest time that is less than or equal to your current time** ($\le \text{now}$).
- Each meal category's default time defines the start of its window until the next scheduled meal.
- For example, if **Snacks** is set to `17:00` and **Dinner** is set to `19:00`:
  - Logging food between `17:00` and `18:59` will automatically suggest **Snacks**.
  - Logging food at or after `19:00` will automatically suggest **Dinner**.

### Customizing Default Times

You can customize the target start time for any meal category on both Web and Mobile:

- **Web**: Go to **Settings → Meal Categories** and edit the **Default Time** (`HH:MM`) for any category.
- **Mobile**: Go to **Settings → Food Settings → Suggested Meal Times** and adjust the target times (`HH:MM`).

### Deleting a Custom Meal Category

Custom meal categories can be deleted from **Settings → Meal Categories** on Web. System defaults (Breakfast, Lunch, Dinner, Snacks) cannot be deleted, only hidden.

If the category has never been used, it is removed immediately. If anything still references it, a dialog shows exactly what is affected — diary entries, logged meals, planned items, and meal plan template items — and offers two choices:

- **Move items and delete** — everything is reassigned to another meal category you pick. Nutrition values, dates, and times are preserved; only the category label changes, so daily totals stay the same. This is the recommended option.
- **Delete everything** — permanently removes those records along with their logged nutrition. This cannot be undone.

If someone you share your diary with has entries in that category, the delete is refused until those are cleared, since they are not yours to remove.

::: info
Prefer hiding a category (the eye icon) if you only want it out of your diary. Hiding keeps all history intact.
:::
---

## Custom Meals

Custom meals can be created and consist of previously added foods. That way, you can group foods together and don't have to add them one by one. An example of how this might look like is provided below:

Meal Management:
![image](https://github.com/user-attachments/assets/4d7cb5e2-d188-4915-b8d5-0f17bf1dad88)

Adding a meal:
![image](https://github.com/user-attachments/assets/827cc881-5472-461f-94e4-3f86023b58c1)
