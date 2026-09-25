# External Providers

X on Track supports integration with external health and fitness data providers to automatically sync your activity and measurements.

---

## Supported Providers

X on Track supports integration with the following health and fitness data providers:

- Apple Health (iOS)
- Google Health Connect (Android)
- Fitbit
- Garmin Connect
- Oura Ring
- Withings
- Polar Flow (partially tested)
- Hevy (not tested)
- [Liftosaur](/features/settings/liftosaur)
- OpenFoodFacts
- USDA
- Fatsecret
- Nutritionix
- Mealie
- Tandoor
- Strava (partially tested)

### Hevy workout history and routines

A Hevy sync treats completed workouts as diary history and saved routines as reusable workout presets. A completed workout's title does not by itself create a saved routine. Repeating a sync preserves existing imported sessions and locally edited routine presets. Warm-up, working, and drop-set rows remain separate; exercises with the same Hevy superset ID stay grouped.

Hevy's workout-history CSV contains completed sets but does not identify which routines are currently saved. In **Settings → Data Import → Hevy Workout History (CSV)**, choose the export and the IANA timezone in which its local workout times were recorded. Preview the sessions before importing. Re-importing the same export skips already imported sessions and reports imported, skipped, and failed counts; it does not overwrite local edits. Ambiguous daylight-saving times require correction before import. Parser tests cover representative rows and mixed line endings from an authorized completed-workout sample. A read-only preview of the full supplied export parsed 3,965 set rows into 268 completed workouts with no warnings; conversion under an assumed `Europe/Berlin` timezone succeeded. This does not confirm the export's actual timezone or a live diary import.

To import saved routines, connect a Hevy API key so X on Track can read Hevy's separate [routines endpoint](https://api.hevyapp.com/docs/). A workout title in the CSV is not proof of a saved routine. Live Hevy API acceptance remains untested and the routine checks use synthetic fixtures.

API sync responses list imported, skipped, and failed workouts and saved routines separately. If a fetch or import fails, or if Hevy returns a malformed workout or routine page or incomplete pagination, the sync returns a partial result (HTTP 207), shows an issue count in Settings, and leaves the provider's last successful sync time unchanged. A diagnostic raw-response replay is also partial when either page family is missing, malformed, or has a gap in its numbered pages. Retry after resolving the issue; use a full sync for older workout history. Existing imports are matched by their Hevy source IDs and preserved.

After a complete live sync or authorized raw-response replay, X on Track updates the last-sync time only for the selected Hevy connection belonging to the current user. Other Hevy connections keep their own sync history.

## Open Food Facts Accounts and Contributions

Open Food Facts searches work without an account. Adding both an Open Food Facts username and password lets X on Track publish an individual product only after you review its exact preview and confirm the data and photo rights. This first release supports manual contributions, one product at a time.

You can configure credentials in either place:

- **Personal:** Go to **Settings → Food & Exercise Data Providers** and add or edit an active Open Food Facts provider. The contribution card lets you save the two-letter language of your product packaging. A personal account takes priority over a global account.
- **Server-wide:** An administrator can open **Administration → Global Data Providers** and enable **Allow Open Food Facts contributions on this server**. An active global Open Food Facts account is an optional fallback for users without a personal account. The server gate is disabled by default. Enabling it or saving credentials does not publish any products or provide consent for users.

Credentials are encrypted at rest. Both username and password are required for contributions, and credentialed contribution endpoints must use HTTPS. Self-hosted HTTP instances remain available for unauthenticated searches.

For sandbox testing, set the provider URL to `https://world.openfoodfacts.net`. X on Track automatically supplies the staging server's documented `off:off` HTTP Basic gate. Open Food Facts production and staging accounts are separate, so the provider must use an account registered on the selected environment.

To contribute a product:

1. Create or edit your own custom food and choose **Save and preview contribution**, or open the saved food's menu and select **Contribute to Open Food Facts**. The food is saved locally before the contribution dialog opens.
2. Select a fresh photo you took of the product's front, nutrition label or packaging. Choose what the photo shows and check the two-letter product language. JPEG, PNG and WebP photos are converted to JPEG and image metadata is removed. The photo must be clear enough to read; tiny images are rejected.
3. Choose **Preview contribution**. Review the destination product link, whether the product already exists, which account will publish, the sanitized photo and every outgoing field. Open the existing public product to compare its current information.
4. Separately confirm that you entered and verified the packaging data and that you took and own the photo. Then choose **Publish this contribution**. Both confirmations start unchecked for every new preview.

X on Track sends the product name, brand, barcode, serving information and eligible nutrition from the default variant. Only custom products entered locally from physical packaging are eligible. Imported data, including products downloaded from Open Food Facts or proprietary third-party databases, is excluded. A non-internal, checksum-valid barcode, product name and metric-convertible default serving are required. Unknown nutrients are not turned into zeroes. The server rechecks ownership and eligibility before publication; family delegates cannot contribute someone else's food.

The preview is valid for ten minutes. Changing the photo, photo type or language clears the preview and its confirmations. If the food, publishing account or public product changes, request and review a fresh preview. Preparing or cancelling a preview does not change Open Food Facts, and ordinary food saves, setting changes, diary entries and deletions never publish or queue contributions. There is no bulk contribution action or automatic retry in this release.

The photo is published first. If it succeeds but the structured data result cannot be confirmed, the result explicitly reports **Photo published; product data unconfirmed** with a link to inspect the public product. The data may already have been saved, for example when the response times out. The local food remains saved. Inspect the destination before starting a new contribution; an uncertain result is never retried automatically.

Submitted data is covered by the Open Food Facts Open Database License (ODbL) and Database Contents License; photos are published under CC BY-SA. Review the [Open Food Facts Contributor Terms](https://world.openfoodfacts.org/terms-of-use) before confirming a contribution. Existing food images and arbitrary image URLs are never reused automatically.

---

## Contributing Mock Data

We are constantly working to improve these integrations. If you notice data missing or incorrect, you can help by capturing what the provider actually returned and sharing it.

### Capturing a sync

This is off by default and is admin-only.

1. As an admin, go to **Admin → Global Provider Settings** and turn on **Allow Local Provider Response Capture**.
2. Open **Settings → Integrations**, press **Sync** on the provider, and pick your date range as usual.
3. Two extra checkboxes appear in that dialog. Tick **Save this sync's raw responses to a file on the server** and run the sync.
4. The capture is written to `mock_data/<provider>_raw.json` inside the server container or install directory.
5. Turn the admin setting back off when you are done.

To replay a saved capture instead of calling the provider — useful for reproducing a bug without hitting the live API — tick **Sync from the previously saved file** instead.

::: warning
The capture is stored per provider, not per user, and contains raw health data: sleep, heart rate, GPS activity and nutrition. That is why it is admin-only and off by default. Review the file before sharing it, and turn the setting off once you have what you need.
:::

Join the **CodeWithCJ** community on [Discord](https://discord.gg/vcnMT5cPEA) and reach out if you'd like to share a capture to help us improve the sync logic!
