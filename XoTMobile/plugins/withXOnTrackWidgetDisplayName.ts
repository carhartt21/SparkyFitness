import { ConfigPlugin, withXcodeProject } from 'expo/config-plugins';

/** Keep expo-widgets' stable target name while branding its visible extension name. */
const withXOnTrackWidgetDisplayName: ConfigPlugin = (config) =>
  withXcodeProject(config, (innerConfig) => {
    const project = innerConfig.modResults;
    const target = project.pbxTargetByName('ExpoWidgetsTarget');
    if (!target) {
      throw new Error('expo-widgets target is missing');
    }

    const configurationList =
      project.pbxXCConfigurationList()[target.buildConfigurationList];
    if (!configurationList) {
      throw new Error('expo-widgets build configurations are missing');
    }

    const configurations = project.pbxXCBuildConfigurationSection();
    for (const configuration of configurationList.buildConfigurations) {
      const buildConfiguration = configurations[configuration.value];
      if (!buildConfiguration) {
        throw new Error('expo-widgets build configuration is missing');
      }
      buildConfiguration.buildSettings.INFOPLIST_KEY_CFBundleDisplayName =
        '"X on Track Widgets"';
    }
    return innerConfig;
  });

export default withXOnTrackWidgetDisplayName;
