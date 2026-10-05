# v44 release evidence

Source: `ab1d1434a442d457e2498dbcae63abe4c6852f72`.

- `validation.json`: package/build checks and hashes of the private validation logs. Phone and focused server tests ran on the identical feature source before the conflict-free merge; only release documentation differs.
- `ipa-verification.json`: distribution signatures, version/build, preserved app groups and native German resources across all five targets.
- `ipa-assets-verification.json`: canonical artwork/sounds and absence of review fixtures from the shipped bundle.
- `public-entry-assets-verification.json` and `public-artwork-verification.json`: public assets match the deployed image/source.
- `database-post-release.json`: aggregate schema/catalogue checks; no personal health data.
- `release-results.json`: production deployment passed. EAS build 44 finished, with automatic submission **queued** at the recorded timestamp. Apple processing/internal availability and physical-device checks were not verified.

Private logs, IPA, protected configuration and encrypted backup remain outside git. Later documentation-only commits do not change the released source.
