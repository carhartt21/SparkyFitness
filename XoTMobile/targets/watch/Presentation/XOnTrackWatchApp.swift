import SwiftUI

@main
struct XOnTrackWatchApp: App {
    @WKApplicationDelegateAdaptor(WorkoutRecoveryDelegate.self) private var recoveryDelegate
    // Both are @MainActor singletons: the session must be activated as early as
    // possible so queued check-ins from a previous launch start delivering
    // before the wearer taps anything.
    @StateObject private var session = WatchSessionManager.shared
    @StateObject private var store = CheckInStore.shared
    @StateObject private var healthRecorder = WorkoutHealthRecorder.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
                .environmentObject(store)
                .environmentObject(healthRecorder)
                // The app's brand mint for controls, as on the phone.
                .tint(Neon.accent)
                .task { healthRecorder.recover() }
        }
    }
}
