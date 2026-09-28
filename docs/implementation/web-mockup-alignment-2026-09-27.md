# Web mockup alignment — implementation batch

Status: web UI review build deployed to the private production site on 2026-09-27; authenticated visual acceptance pending.

## Target and product constraints

The primary visual references are `web/06-dashboard.png` and `web/07-nutrition-reports.png` in the owner-supplied `x-on-track-ui-assets-2026-09-25.zip`. The screenshots are 1586 × 992 pixels. The [interface redesign audit](x-on-track-ui-redesign-audit.md) records their provenance and the first source review. The approved X on Track logo and **Keep getting better.** identity in `PRODUCT.md` supersede the mockups' alternate tagline.

Match the navigation, hierarchy, spacing, card grouping, chart emphasis, and dark color direction. Keep the light theme, responsive web layout, existing routes, accessibility, and user-controlled widget layouts. The mockups' sample profile, foods, activity, dates, energy arithmetic, premium card, and health claims are illustrations, not application data or copy.

## Current gaps

| Surface               | Current implementation                                                                                                                                           | Target direction                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop shell         | Brand/actions and a horizontal navigation strip span the content width in `MainLayout.tsx`.                                                                      | A persistent left navigation rail anchors both web screens; page actions remain in the content header. Mobile keeps its existing bottom navigation.                                              |
| Dashboard first view  | `Diary.tsx` renders a user-customizable grid with energy, nutrition, water, wearable, meal, exercise, and caffeine widgets.                                      | The default desktop layout leads with energy, macronutrients, hydration, and activity. Meals and quick logging follow as one clear second row; secondary widgets stay available.                 |
| Dashboard information | `DailyProgress`, `NutritionSummaryCard`, `WaterIntake`, `ExerciseCard`, and `MealCard` each own their data and actions.                                          | Recompose these existing sources; do not introduce parallel calculations or display a zero as a confirmed missing log.                                                                           |
| Reports header        | `ReportsControls.tsx` puts report tabs and the date range in one wrapping row; the page has no dedicated heading.                                                | Put the report title and date control first, with a distinct category row underneath. Keep every current report tab.                                                                             |
| Reports charts        | `NutritionPeriodSummary.tsx` combines two key figures, a leading chart, and a cumulative chart; `NutritionChartsGrid.tsx` supplies the secondary nutrient chart. | Give the key figures and leading trend a stronger first scan, followed by the cumulative view and compact secondary charts. Retain chart selection, zoom, table access, and logged-data caveats. |

## Ordered work

1. **Desktop shell.** Add a semantic, keyboard-accessible desktop rail to `MainLayout.tsx`; retain permission-filtered destinations, profile switching, notifications, sign-out, and the tablet/mobile navigation. Use existing web tokens and approved logo assets. Check all routes for content width and overflow.
2. **Dashboard default composition.** Update the default layout in `dashboardLayout.ts` and the Diary widget presentation so the four overview domains appear first at desktop widths. Preserve saved personal layouts and meal-type reconciliation. Keep current logging routes and real date context. Add one prominent path for adding food, exercise, and water without duplicating actions in every card.
3. **Reports hierarchy.** Rework `ReportsControls`, `NutritionPeriodSummary`, and `NutritionChartsGrid` around the title/date, category tabs, key figures, leading trend, cumulative logged variance, and secondary nutrient inspection. Do not relabel logged variance as a confirmed deficit. Preserve unit conversion, target overlays, custom nutrients, and table export.
4. **Shared finish.** Align card radius, interior spacing, heading sizes, chart grid/axis contrast, icon scale, focus states, and hover states with the existing theme tokens. Use English locale entries for new copy and verify German fallback or translation coverage. Avoid decorative sample data and unsupported artwork.
5. **Visual acceptance.** Capture authenticated synthetic-data screenshots beside both reference PNGs at 1586 × 992, a narrower desktop width, and a 390-pixel mobile viewport, in light and dark themes. Inspect long labels, empty/error states, keyboard traversal, and 200% zoom. Follow with the owner's real-account review of the web build.

## Acceptance criteria

- The desktop Dashboard and Nutrition Reports each have the reference's rail and primary visual hierarchy at the reference size, while mobile and narrow widths remain usable without horizontal scrolling.
- The Dashboard's first row visibly prioritizes energy, macros, hydration, and activity; meals and direct logging are easy to find; saved widget layouts still load and save.
- Reports retain all category tabs, nutrient choices, chart zoom, date navigation, and exports. Labels distinguish logged intake from complete-day conclusions.
- Every displayed value comes from the existing query/data contract. Missing goals or unavailable data produce an explicit state rather than mock values.
- Frontend `validate` and CI tests pass, and the two reference-size screenshot comparisons have no unresolved high-priority layout, contrast, focus, or clipping defects.

## Progress in this batch

- Added the desktop navigation rail while preserving the tablet navigation, mobile navigation, permission filtering, account controls, and existing routes.
- Moved the default Dashboard layout toward the reference: energy, nutrition, hydration, and activity lead at desktop widths; the existing meal and secondary widgets follow. Existing saved layouts keep their positions.
- Kept water logging, exercise entry details, and the full configured nutrient list available through expandable cards so the overview row can stay compact.
- Gave Reports a title and date row above its category navigation; retained the existing logged-data KPI, trend, cumulative variance, nutrient selection, and export controls.
- Added a layout test for the new default widget order.

The Dashboard meal area, quick logging actions, and Reports chart composition still need a visual pass against the reference. Authenticated screenshot comparison has not yet been performed, so this batch does not claim final visual fidelity. Record before/after captures and intentional differences here when that comparison is available.

## Production review deployment

The web assets were built from the production source revision `13d8803cf837b0088923dca7941e85322851a2f4` plus the nine-file UI patch in this batch. The patch and built assets are archived under `/opt/sparkyfitness/releases/web-ui-20260927/`. The production frontend image is `x-on-track-frontend:13d8803cf-ui-20260927`; the server and PostgreSQL images were unchanged. The prior Compose file and release lock are saved on the server with `.pre-web-ui-20260927` suffixes, and the prior frontend image remains available for rollback.

After the frontend switch, the container was healthy, HTTPS `/` and `/api/health` returned 200, and the served `index.html` SHA-256 matched the locally validated build (`20cdd7bf398534a2dc6aabe950bddd492f767c27edb4a40425731c58e9724600`). The production-based worktree passed frontend typecheck, lint, formatting, Knip, the Vite build, and 1,383 tests. These checks confirm delivery and basic operation; the owner's authenticated visual review remains outstanding.

## Local visual sample

The repository's existing demo seeder can supply real authenticated Diary and Reports pages with representative data. From the repository root, run:

```bash
./scripts/visual-sample.sh serve
```

The script requires the workspace dependencies plus local PostgreSQL command-line tools (`initdb`, `pg_ctl`, `psql`, `createdb`). It starts an isolated PostgreSQL cluster on port 55432, the server on port 3010, and Vite on port 8080. It creates fresh secrets and keeps all database files, logs, and generated credentials under the ignored `.visual-sample/` directory. It does not read or change the normal application database. Leave this terminal open, then open `http://localhost:8080/login`, choose **Explore Live Demo**, and confirm the demo disclaimer. The sample data is reseeded by the server's demo mode and resets daily at 00:00 UTC.

If the sample runs on a remote machine, forward the frontend port from your own computer with `ssh -L 8080:127.0.0.1:8080 user@remote-host`, then open `http://localhost:8080/login` locally. The Vite proxy carries API requests over the same connection; the database and server ports stay bound to the remote machine's loopback interface.

For comparison, capture the signed-in Diary (`/`) and Reports (`/reports?tab=charts`) at **1586 × 992** in dark mode, then compare them with `web/06-dashboard.png` and `web/07-nutrition-reports.png` from the supplied asset archive. Repeat at a narrower desktop width and a 390-pixel mobile width in both themes. Check card widths and height, text clipping, chart labels, overflow, keyboard focus, and the saved-layout controls. The reference values and foods are illustrative; compare structure and visual hierarchy rather than their exact numbers.

Use `./scripts/visual-sample.sh status` from another terminal to inspect the processes; press Ctrl+C in the serving terminal or run `./scripts/visual-sample.sh stop` when finished. Browser automation was denied access to the local URL in this session, so the screenshots and visual acceptance check remain pending.
