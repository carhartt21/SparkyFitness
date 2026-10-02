import SwiftUI

/// Isolated synthetic executable, never part of the shipped app target.
@main struct WatchGoalsReviewApp: App {
    @StateObject private var store = CheckInStore.shared
    @StateObject private var session = WatchSessionManager.shared
    init() {
        precondition(Bundle.main.bundleIdentifier == "com.cg.phi.watchkitapp.review")
        let day = CheckInDate.today()
        let scope = "[\"synthetic-server\",\"synthetic-user\"]"
        let habit = WatchProgressItem(id: "habit:synthetic", label: "Lesen", domain: "habit", state: "pending", canComplete: true, recordedAt: nil, icon: "book")
        let meal = WatchProgressItem(id: "meal:synthetic", label: "Mittagessen", domain: "meal", state: "started", canComplete: true, recordedAt: nil, icon: "fork.knife")
        let activity = WatchProgressItem(id: "activity:synthetic", label: "Laufen", domain: "activity", state: "pending", canComplete: false, recordedAt: nil, icon: "figure.run")
        var context = WatchContext.empty
        context.actionScope = scope
        context.today = day
        context.generatedAt = Date()
        context.dailyProgress = DailyProgressSnapshot(day: day, completed: 5, applicable: 14, percent: 5.0 / 14 * 100, items: [habit, meal, activity])
        let store = CheckInStore.shared
        store.apply(context: context)
        precondition(store.captureProgress(activity) == nil)
        let action = store.captureProgress(habit)!
        precondition(store.captureProgress(habit) == nil)
        let payload = OutboundPayloads.progressAction(action)
        precondition(payload["clientId"] as? String == action.id)
        precondition(payload["entryDate"] as? String == day)
        precondition(payload["scope"] as? String == scope)
        precondition(store.queuedProgressActions.count == 1)
        context.actionScope = "[\"other-server\",\"other-user\"]"
        store.apply(context: context)
        precondition(store.queuedProgressActions.isEmpty)
        context.actionScope = scope
        store.apply(context: context)
        precondition(store.queuedProgressActions.first?.id == action.id)
        context.ackedClientIds = [action.id]
        store.apply(context: context)
        context.ackedClientIds = []
        context.failedClientIds = [action.id]
        store.apply(context: context)
        precondition(store.pendingProgressActions.first?.state == .saved)
        context.generatedAt = Date()
        store.apply(context: context)
        precondition(store.progressAction(for: habit.id) == nil)
        precondition(progressXRevealFractions(percent: nil).allSatisfy { $0 == 0 })
        precondition(progressXRevealFractions(percent: 0).allSatisfy { $0 == 0 })
        precondition(progressXRevealFractions(percent: 100).allSatisfy { $0 == 1 })
        precondition(zip(progressXRevealFractions(percent: 43), progressXRevealFractions(percent: 57)).allSatisfy { $0 <= $1 })
        precondition(zip(progressXRevealFractions(percent: 57), progressXRevealFractions(percent: 34)).allSatisfy { $0 >= $1 })
        let parsed = ContextPayloadMapper.dailyProgress(from: ["today": day, "dailyProgressCompleted": 0, "dailyProgressApplicable": 0])!
        precondition(parsed.items == nil && parsed.percent == nil)
        let data = try! JSONSerialization.data(withJSONObject: ["nativeAssertionsPassed": 16, "synthetic": true])
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try! data.write(to: directory.appendingPathComponent("assertions.json"), options: .atomic)
    }
    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(store).environmentObject(session)
                .environmentObject(WorkoutHealthRecorder.shared).tint(Neon.accent)
        }
    }
}
