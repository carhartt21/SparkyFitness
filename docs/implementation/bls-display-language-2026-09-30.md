# BLS display language — 30 September 2026

## Verified cause

The importer stores `name_de` and `name_en`. BLS retrieval searches both
languages, but the response mapper selects a name using the requested language.
Provider search and details previously used only the server account preference
(`language`, default English). Mobile and web already included the UI locale in
some search cache keys but did not send it to the server. A German interface
could therefore receive English BLS names, even under a German cache key.

The live account preference was not inspected; this is a verified code path,
not a claim about a particular production account or catalogue record.

## Correction

- Mobile sends the effective i18next language in both provider search hooks and
  detail hydration. Web sends it for single-provider and combined search, and
  details; a language change restarts the selected-provider search.
- The optional `language` query parameter takes precedence over the account
  preference for this request only. The server validates a bounded language tag
  and converts regional tags such as `de-DE` / `de-AT` to `de`. Malformed values
  return HTTP 400 before provider requests. Missing language retains the account
  preference fallback; absent/invalid stored preferences fall back to English.
- Query keys capture the same language as their requests. A cache version bump
  prevents reuse of pre-fix English payloads under German keys. Web detail caches
  are now language scoped as well.
- No catalogue, account preference, saved food name, diary snapshot, serving,
  nutrient, authentication, credential scope or barcode contract is rewritten.
  Historical English names remain as saved.

## Verification

- Synthetic bilingual BLS fixture through real HTTP routes, search service and
  catalogue mapper: German app / English account, English app / German account,
  regional locales, omitted language, invalid parameters and safe fallback.
- Mobile request serialization, detail hydration and mounted hooks switching
  from English to German; web request/query-key parity and combined-search
  language changes. Serving size and nutrient preservation are asserted.
- Targeted tests: server 57, mobile 163, web 6 passed.
- Full suites: mobile **507 suites / 7,397 tests**; web **162 suites / 1,427 tests**;
  server **435 files / 5,197 tests** passed. Server skipped 9 files / 316 tests,
  including unavailable integration checks.
- Mobile, web and server validation wrappers passed (typecheck, lint, formatting,
  and the packages' configured localization/Knip checks). `git diff --check` passed.
- The initial server suite exposed an incorrect Swagger mount prefix in the new
  documentation; it was corrected. An unrelated API-key test failed once, then
  passed in isolation and on the full rerun without changing its code.

No live catalogue/account query, signed build, physical-device check, merge or
deployment was performed. The server and client changes must be released together
to enable the fix; an older server ignores the optional parameter.

After release, search BLS for `hafer`, `tomate roh` and `reis gekocht` with German
selected, open a result and confirm its name remains German. Switch to English
and back without restarting, and confirm the displayed language follows the app.
