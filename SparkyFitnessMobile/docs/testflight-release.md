# TestFlight release runbook

Run these commands on a Mac with Xcode, CocoaPods, Fastlane, pnpm, and EAS CLI installed. Sign in with `eas login` first. The production EAS profile builds the App Store app and all four extension/watch targets. App Store Connect API keys upload the resulting IPA; they do not sign it.

## Normal cloud build

From `SparkyFitnessMobile/` on a committed revision:

```bash
eas build --platform ios --profile production --auto-submit
```

EAS uses its stored signing and submission credentials. If the account has no cloud build capacity, use the local procedure below. Each EAS build attempt can advance the remote iOS build number even when the build fails; check it with `eas build:version:get --platform ios --profile production`.

## Local build and API-key upload

Use a clean committed checkout. If the main checkout has unfinished changes, create a detached worktree at the commit to release. Start at the repository root:

```bash
release_dir="$(mktemp -d /tmp/sparky-testflight.XXXXXX)"
git worktree add --detach "$release_dir/repo" HEAD
cd "$release_dir/repo"
pnpm install --frozen-lockfile
cd SparkyFitnessMobile
```

Keep the working directory at `SparkyFitnessMobile/` for the remaining commands. If the current checkout is already clean, set `release_dir` as above and run from its mobile package without creating a second worktree.

1. Download production iOS credentials with `eas credentials -p ios`: select **production**, decline Apple login if EAS already has the profiles, then choose **credentials.json → Download credentials from EAS**. EAS writes `credentials.json` and `credentials/ios/` under the mobile package. They are gitignored but contain private signing material. Restrict access:

   ```bash
   chmod 600 credentials.json credentials/ios/*
   chmod 700 credentials credentials/ios
   ```

2. Prepare the certificate selection for Xcode. This command reads the downloaded certificate, finds its SHA-1 identity, writes an `.xcconfig`, and removes its temporary keychain:

   ```bash
   pnpm run testflight:export -- prepare \
     --credentials credentials.json \
     --xcconfig "$release_dir/signing.xcconfig"
   ```

3. Build locally with EAS. The team ID comes from `eas.json` (`submit.production.ios.appleTeamId`). Capture the build log; the Xcode archive is stored under `~/Library/Developer/Xcode/Archives/` even if EAS later fails during export:

   ```bash
   EXPO_PROD_APPLE_TEAM_ID=4V6HSJQ4JP \
   XCODE_XCCONFIG_FILE="$release_dir/signing.xcconfig" \
   eas build --local --platform ios --profile production \
     --output "$release_dir/XonTrack.ipa" --non-interactive \
     > "$release_dir/build.log" 2>&1
   ```

   If this succeeds, use `$release_dir/XonTrack.ipa` in step 5. On a Mac with a second Apple Distribution certificate, Xcode may archive successfully but choose that other certificate during IPA export. The log then shows `Archive Succeeded`, followed by `EXPORT FAILED` and a provisioning profile certificate mismatch. Continue with step 4 in that case. If archiving itself fails, fix that build error first.

4. Export the successful `.xcarchive` using the exact certificate and provisioning profiles from EAS. Find the archive path in `build.log` or in Xcode's Archives directory and confirm it belongs to this build. The helper derives each target's bundle ID and team from its signed profile, explicitly selects the matching certificate for export, and restores the user's keychain search list afterward:

   ```bash
   pnpm run testflight:export -- export \
     --credentials credentials.json \
     --archive "/path/to/XonTrack YYYY-MM-DD HH.MM.SS.xcarchive" \
     --output-dir "$release_dir/exported"
   ```

   Use the IPA path printed by the helper. Export diagnostics are in `$release_dir/exported/export.log`. The helper refuses to overwrite an existing IPA in the output directory.

5. Upload with the intended App Store Connect API key. Get its key ID from the `AuthKey_<KEY_ID>.p8` filename and its issuer ID from App Store Connect. The key file stays outside the repository:

   ```bash
   xcrun altool --upload-app -f "/path/to/XonTrack.ipa" \
     --api-key KEY_ID --api-issuer ISSUER_UUID \
     --p8-file-path "/private/path/AuthKey_KEY_ID.p8"
   ```

   Record Apple's delivery UUID. An `UPLOAD SUCCEEDED` response means Apple accepted the transfer; check the build under [App Store Connect → TestFlight](https://appstoreconnect.apple.com/apps/6803564460/testflight/ios) until processing is **Valid** before assigning testers.

6. Remove the downloaded credentials after export. Keep the IPA and logs in `release_dir` as needed. EAS may also leave temporary `.p12` files under `$TMPDIR` after a failed local build; remove only the files from this run. Do not commit or attach `credentials.json`, `.p12`, `.mobileprovision`, or `.p8` files:

   ```bash
   rm -f credentials.json credentials/ios/*.p12 credentials/ios/*.mobileprovision
   rmdir credentials/ios credentials
   ```

The helper only exports an existing archive. It does not increment the build number, modify EAS credentials, or upload the IPA.
