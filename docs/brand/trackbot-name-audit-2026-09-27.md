# Trackbot name audit — 27 September 2026

The product name is **X on Track** and the in-app AI companion is **Trackbot**. This audit searched mobile, web, server, native targets, translated catalogs, and documentation for `sparky` case-insensitively. It separates visible identity from identifiers whose spelling is part of an existing contract.

| Surface | Resolution |
| --- | --- |
| Mobile chat title, dashboard launcher, add sheet, settings, typing state, onboarding, and locale values | Display Trackbot. Translation keys such as `askSparky` remain stable so existing settings and Weblate keys resolve. |
| Web chat panel, AI setup and data-management copy, sample CSV, and translated values | Display Trackbot for the companion and X on Track for product calculations and provider behavior. Internal web chat component and hook files now use Trackbot names. |
| Server chat prompts, food-options prompt, and chat-history API descriptions | Identify the assistant as Trackbot. The live chat-history route is unchanged. |
| Help and integration examples | Use Trackbot or X on Track where the text refers to this product. Upstream SparkyFitness documentation and links retain their attribution. |

The following names **remain intentionally unchanged** because changing them in place would break existing installs, sessions, backups, or clients:

- `sparky_*` chat/MCP tool identifiers, `/api/chat/sparky-chat-history`, `sparky_chat_history`, and the `sparky` source value stored with assistant-created diary entries.
- `SPARKY_FITNESS_*` environment variables, the `sparky` auth-cookie prefix, backup filename patterns, native package identifiers, `sparkyfitnessmobile://` and `sparkyfitness-watch://` schemes, widget resource identifiers, and `@SparkyFitness/*` local-storage keys.
- The Expo project slug, upstream repository/package paths, historical migrations, source-attribution text, and links to the upstream SparkyFitness project.

The historical `user_preferences.system_prompt` database default contains the old persona in the initial migration, but that column is not read by the current chat service. The active persona comes from `chatbot-core.md` or `chatbot-full.md`; per-service custom prompts remain user data and are not rewritten. Any future use of that old column should migrate its default and review existing values first.

The non-English catalogs are synchronized through Weblate. This one-time brand substitution updates their checked-in display values while preserving their keys. Translation maintainers should mirror the proper-name change upstream; the mobile and web i18next post-processors are a fallback for old strings reintroduced by a later catalog sync. Automated catalog tests reject legacy brand text in translation values.
