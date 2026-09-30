import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
type CapabilityModule = {
  liveActivityStatus: () => 'enabled' | 'disabled' | 'unsupported';
};
const native = requireOptionalNativeModule<CapabilityModule>(
  'PresentationCapabilities'
);
export function liveActivityStatus():
  'enabled' | 'disabled' | 'unsupported' | 'unknown' {
  if (Platform.OS !== 'ios') return 'unsupported';
  return native?.liveActivityStatus() ?? 'unknown';
}
