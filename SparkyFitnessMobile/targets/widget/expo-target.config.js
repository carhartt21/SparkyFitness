const {
  getIosAppGroup,
  isDevVariant,
  DEV_BUNDLE_IDENTIFIER,
  IOS_PROD_BUNDLE_IDENTIFIER,
} = require('../../app.identifiers.js');
const fs = require('fs');
const path = require('path');

const escapePlistString = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const syncInfoPlist = (appGroup) => {
  const plistPath = path.join(__dirname, 'Info.plist');
  const escapedAppGroup = escapePlistString(appGroup);
  fs.writeFileSync(
    plistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>APP_GROUP_IDENTIFIER</key>
    <string>${escapedAppGroup}</string>
    <key>CFBundleDisplayName</key>
    <string>X on Track Widgets</string>
    <key>NSExtension</key>
    <dict>
      <key>NSExtensionPointIdentifier</key>
      <string>com.apple.widgetkit-extension</string>
    </dict>
  </dict>
</plist>
`
  );
};

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const appGroup = getIosAppGroup();
  const isDev = isDevVariant();
  syncInfoPlist(appGroup);

  return {
    type: 'widget',
    name: 'CalorieTracker',
    displayName: 'X on Track Widgets',
    bundleIdentifier: isDev
      ? `${DEV_BUNDLE_IDENTIFIER}.widget`
      : `${IOS_PROD_BUNDLE_IDENTIFIER}.widget`,
    icon: '../../assets/icons/x-on-track-app-icon.png',
    entitlements: {
      'com.apple.security.application-groups': [appGroup],
    },
  };
};
