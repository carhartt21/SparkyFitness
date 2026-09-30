import ExpoModulesCore
import ActivityKit

public final class PresentationCapabilitiesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PresentationCapabilities")
    Function("liveActivityStatus") { () -> String in
      if #available(iOS 17.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled ? "enabled" : "disabled"
      }
      return "unsupported"
    }
  }
}
