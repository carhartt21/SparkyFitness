import Foundation
import Combine

/// The watch's own record of what was captured, plus whatever the phone has
/// relayed. Deliberately the source of truth: the wearer is standing on a scale
/// in a bathroom with the phone in another room, so "captured" and "delivered"
/// are different events and only the first is under our control.
@MainActor
final class CheckInStore: ObservableObject {
    static let shared = CheckInStore()

    /// Seed values + history relayed from the phone.
    @Published private(set) var context: WatchContext = .empty
    /// Captured but not yet confirmed written to the server, oldest first.
    @Published private(set) var pending: [CheckIn] = []
    /// The most recent capture, kept so the trend screen can show it and its
    /// state even after the ack arrives and it leaves `pending`.
    @Published private(set) var lastCaptured: CheckIn?
    @Published private(set) var lastCapturedState: SyncState = .saved
    /// Container taps sent to the phone but not yet reflected in a pushed
    /// total. Kept here rather than in the Water page so they outlive both the
    /// page and the app process — a tap made with the phone in another room
    /// can wait a long while for its confirmation, and until then this is the
    /// only record that it happened.
    @Published private(set) var pendingWaterTaps: [PendingWaterTap] = []
    /// Changes when the local day rolls over, forcing pages that compute
    /// day-filtered pending totals to redraw even without a phone snapshot.
    @Published private(set) var localDay: String = CheckInDate.today()
    @Published private(set) var pendingQuickWaterActions: [PendingQuickWaterAction] = []
    @Published private(set) var pendingFoodActions: [PendingFoodLogAction] = []
    @Published private(set) var pendingWorkoutOperations: [WorkoutSetOperation] = []

    private let defaults = UserDefaults.standard
    private let contextKey = "sparky.watch.context"
    private let pendingKey = "sparky.watch.pending"
    private let lastCapturedKey = "sparky.watch.lastCaptured"
    private let pendingWaterKey = "sparky.watch.pendingWaterTaps"
    private let pendingQuickWaterKey = "personalbest.watch.pendingQuickWaterActions"
    private let pendingFoodKey = "x-on-track.watch.pendingFoodActions"
    private let pendingWorkoutKey = "personalbest.watch.pendingWorkoutOperations"

    private init() {
        load()
    }

    /// Older phone contexts have no account marker. Never create a new action
    /// that the phone cannot safely attribute after reconnecting.
    var canCaptureActions: Bool { context.actionScope?.isEmpty == false }

    // MARK: - Seeding

    /// The value the Digital Crown starts on. Today's entry wins over history so
    /// re-logging is a correction of the right number, not a fresh guess.
    var seedWeightKg: Double? {
        if let pendingToday = retryable.last(where: { $0.entryDate == CheckInDate.today() }) {
            return pendingToday.weightKg
        }
        return context.todayWeightKg ?? context.lastWeightKg
    }

    var seedBodyFatPercentage: Double? {
        if let pendingToday = retryable.last(where: { $0.entryDate == CheckInDate.today() }),
           let fat = pendingToday.bodyFatPercentage {
            return fat
        }
        return context.todayBodyFatPercentage ?? context.lastBodyFatPercentage
    }

    /// True when today already has a value — the header then reads "replacing"
    /// so an overwrite is never silent.
    var isReplacingToday: Bool {
        if retryable.contains(where: { $0.entryDate == CheckInDate.today() }) { return true }
        return context.todayWeightKg != nil && context.today == CheckInDate.today()
    }

    /// The value the delta line compares against. Nil on first-ever use.
    var comparisonWeightKg: Double? { context.lastWeightKg }

    var needsFirstRunEntry: Bool { !context.hasSeed || context.isSeedStale }

    // MARK: - Capture

    /// Records a scoped check-in locally before WatchConnectivity delivery.
    /// A missing account marker leaves the form open for a later phone sync.
    func capture(weightKg: Double, bodyFatPercentage: Double?) -> CheckIn? {
        guard let scope = context.actionScope, !scope.isEmpty else { return nil }
        let checkIn = CheckIn(
            id: UUID().uuidString,
            entryDate: CheckInDate.today(),
            weightKg: weightKg,
            bodyFatPercentage: bodyFatPercentage,
            capturedAt: Date(),
            scope: scope
        )
        pending.append(checkIn)
        lastCaptured = checkIn
        lastCapturedState = .queued
        persist()
        return checkIn
    }

    func markState(_ state: SyncState, for checkIn: CheckIn) {
        if lastCaptured?.id == checkIn.id {
            lastCapturedState = state
        }
        if state == .saved {
            pending.removeAll { $0.id == checkIn.id }
        }
        persist()
    }

    // MARK: - Water

    /// The same captured id and day must reach the phone, including on retry
    /// after midnight. A fresh id or date would turn one tap into a new write.
    func recordWaterTap(volumeMl: Double, containerId: Int) -> PendingWaterTap? {
        guard let scope = context.actionScope, !scope.isEmpty else { return nil }
        let tap = PendingWaterTap(
            id: UUID().uuidString,
            volumeMl: volumeMl,
            containerId: containerId,
            createdAt: Date(),
            day: CheckInDate.today(),
            scope: scope,
            state: .queued
        )
        pendingWaterTaps.append(tap)
        persist()
        return tap
    }

    /// Moves one tap to `.saved` or `.failed` once the phone reports on it.
    /// Unknown ids are ignored — an ack for a tap this watch has already
    /// settled, or one from a previous install.
    func markWaterTap(_ clientId: String, _ state: SyncState) {
        guard let index = pendingWaterTaps.firstIndex(where: { $0.id == clientId }) else { return }
        // Application context is latest-value-only, but a previously cached
        // failure can still be replayed after an immediate success ack.
        // Never offer a retry once the phone confirmed the additive write.
        if pendingWaterTaps[index].state == .saved && state == .failed { return }
        guard pendingWaterTaps[index].state != state else { return }
        pendingWaterTaps[index].state = state
        persist()
    }

    /// Written to the server, but not yet reflected in a pushed total — so it
    /// belongs in the fill, alongside the confirmed amount.
    var savedWaterMl: Double {
        pendingWaterTaps.filter {
            $0.isToday && $0.state == .saved &&
                $0.scope == context.actionScope && $0.scope != nil
        }.reduce(0) { $0 + $1.volumeMl }
    }

    /// Still waiting on the phone. Drawn as the line above the fill rather than
    /// as fill, so the gap is what the wearer is waiting on.
    var queuedWaterMl: Double {
        pendingWaterTaps.filter {
            $0.isToday && $0.state == .queued &&
                $0.scope == context.actionScope && $0.scope != nil
        }.reduce(0) { $0 + $1.volumeMl }
    }

    /// What the Water page's status pill shows: the worst outstanding state,
    /// since a single failure is the thing worth surfacing.
    var waterSyncState: SyncState {
        if pendingWaterTaps.contains(where: { $0.state == .failed && $0.scope == context.actionScope && $0.scope != nil }) { return .failed }
        if pendingWaterTaps.contains(where: { $0.state == .queued && $0.scope == context.actionScope && $0.scope != nil }) { return .queued }
        return .saved
    }

    /// Taps to send again, oldest first.
    var retryableWaterTaps: [PendingWaterTap] {
        pendingWaterTaps.filter { $0.state == .failed && $0.scope == context.actionScope && $0.scope != nil }
    }

    /// Unacknowledged taps may have reached the phone before it relaunched.
    /// Re-sending their original IDs is safe with the server receipt.
    var queuedWaterTaps: [PendingWaterTap] {
        pendingWaterTaps.filter { $0.state == .queued && $0.scope == context.actionScope && $0.scope != nil }
    }

    /// New quick-water writes require a scope previously sent by the phone.
    func captureQuickWater() -> PendingQuickWaterAction? {
        guard let scope = context.actionScope, !scope.isEmpty else { return nil }
        let action = PendingQuickWaterAction(
            id: UUID().uuidString,
            entryDate: CheckInDate.today(),
            scope: scope,
            loggedAt: Date(),
            state: .queued
        )
        pendingQuickWaterActions.append(action)
        persist()
        return action
    }

    func markQuickWater(_ clientId: String, _ state: SyncState) {
        guard let index = pendingQuickWaterActions.firstIndex(where: { $0.id == clientId }) else {
            return
        }
        if state == .saved {
            pendingQuickWaterActions.remove(at: index)
        } else {
            pendingQuickWaterActions[index].state = state
        }
        persist()
    }

    var queuedQuickWaterActions: [PendingQuickWaterAction] {
        pendingQuickWaterActions.filter {
            $0.state == .queued && $0.scope == context.actionScope
        }
    }

    var failedQuickWaterActions: [PendingQuickWaterAction] {
        pendingQuickWaterActions.filter {
            $0.state == .failed && $0.scope == context.actionScope
        }
    }

    // MARK: - Food shortcuts

    func captureFoodLog(_ food: WatchFoodShortcut, mealTypeId: String) -> PendingFoodLogAction? {
        guard let scope = context.actionScope, !scope.isEmpty,
              context.foodShortcuts?.contains(where: { $0.id == food.id }) == true,
              context.mealTypes?.contains(where: { $0.id == mealTypeId }) == true else { return nil }
        let action = PendingFoodLogAction(
            id: UUID().uuidString, scope: scope, entryDate: CheckInDate.today(),
            loggedAt: Date(), foodId: food.foodId, variantId: food.variantId,
            mealTypeId: mealTypeId, quantity: food.servingSize,
            unit: food.servingUnit, name: food.name, state: .queued
        )
        pendingFoodActions.append(action)
        // Keep bounded local history while retaining every unresolved write.
        let saved = pendingFoodActions.filter { $0.state == .saved }.suffix(20)
        pendingFoodActions = pendingFoodActions.filter { $0.state != .saved } + saved
        persist()
        return action
    }

    func markFoodLog(_ clientId: String, _ state: SyncState) {
        guard let index = pendingFoodActions.firstIndex(where: { $0.id == clientId }) else { return }
        if pendingFoodActions[index].state == .saved && state == .failed { return }
        pendingFoodActions[index].state = state
        persist()
    }

    var queuedFoodActions: [PendingFoodLogAction] {
        pendingFoodActions.filter { $0.state == .queued && $0.scope == context.actionScope }
    }

    var failedFoodActions: [PendingFoodLogAction] {
        pendingFoodActions.filter { $0.state == .failed && $0.scope == context.actionScope }
    }

    // MARK: - Workout set actions

    func operation(for setKey: String, sessionId: String) -> WorkoutSetOperation? {
        pendingWorkoutOperations.last {
            $0.setKey == setKey && $0.sessionId == sessionId &&
                $0.scope == context.actionScope && $0.scope != nil
        }
    }

    func captureWorkoutOperation(
        workout: WatchWorkoutSnapshot,
        set: WatchWorkoutSnapshot.Exercise.SetRow
    ) -> WorkoutSetOperation? {
        guard let scope = context.actionScope, !scope.isEmpty else { return nil }
        guard operation(for: set.key, sessionId: workout.sessionId) == nil else { return nil }
        let operation = WorkoutSetOperation(
            id: UUID().uuidString,
            sessionId: workout.sessionId,
            setKey: set.key,
            setSignature: set.signature,
            expectedCompleted: set.completed,
            completed: !set.completed,
            createdAt: Date(),
            scope: scope,
            state: .queued
        )
        pendingWorkoutOperations.append(operation)
        persist()
        return operation
    }

    func markWorkoutOperation(_ clientId: String, _ state: SyncState) {
        guard let index = pendingWorkoutOperations.firstIndex(where: { $0.id == clientId }) else {
            return
        }
        // The phone only acknowledges success after its server save. An older
        // cached failure context may arrive later, but must not undo that ack.
        if pendingWorkoutOperations[index].state == .saved && state == .failed {
            return
        }
        pendingWorkoutOperations[index].state = state
        persist()
    }

    func retryFailedWorkoutOperation(_ clientId: String) -> WorkoutSetOperation? {
        guard let index = pendingWorkoutOperations.firstIndex(where: {
            $0.id == clientId && $0.state == .failed &&
                $0.scope == context.actionScope && $0.scope != nil
        }) else { return nil }
        pendingWorkoutOperations[index].state = .queued
        persist()
        return pendingWorkoutOperations[index]
    }

    func discardFailedWorkoutOperation(_ clientId: String) {
        guard let index = pendingWorkoutOperations.firstIndex(where: {
            $0.id == clientId && $0.state == .failed &&
                $0.scope == context.actionScope && $0.scope != nil
        }) else { return }
        pendingWorkoutOperations.remove(at: index)
        persist()
    }

    /// Only one unacknowledged action may be in transit. A confirmed action
    /// no longer blocks the next one, but a failed action waits for retry or
    /// explicit dismissal so later taps cannot overtake it after reconnect.
    var nextQueuedWorkoutOperation: WorkoutSetOperation? {
        guard let firstUnresolved = pendingWorkoutOperations.first(where: {
            $0.state != .saved && $0.scope == context.actionScope && $0.scope != nil
        }) else { return nil }
        return firstUnresolved.state == .queued ? firstUnresolved : nil
    }

    // MARK: - Phone updates

    func apply(context incoming: WatchContext) {
        context = incoming
        // Applied here rather than only from the callers' own prune calls,
        // because an inbound context is not always a fresh one: an
        // `adoptReceivedContext()` replay hands back whatever the phone last
        // set, which on the first launch of a morning is still yesterday's.
        // With the prune outside, `ContentView.onAppear` cleared the stale day
        // and the replay two lines later put it straight back.
        //
        // Every inbound path now goes through one rule, and the store cannot
        // hold a day that has ended regardless of who applied it.
        clearStaleDayData()

        // Acks first: the phone naming a tap is more specific than any
        // inference from the total, and a tap moved to `.saved` here is what
        // fills the bottle up to the line the queued state drew.
        for clientId in incoming.ackedClientIds { markWaterTap(clientId, .saved) }
        for clientId in incoming.failedClientIds { markWaterTap(clientId, .failed) }
        for clientId in incoming.ackedClientIds { markQuickWater(clientId, .saved) }
        for clientId in incoming.failedClientIds { markQuickWater(clientId, .failed) }
        for clientId in incoming.ackedClientIds { markFoodLog(clientId, .saved) }
        for clientId in incoming.failedClientIds { markFoodLog(clientId, .failed) }
        for clientId in incoming.ackedClientIds { markWorkoutOperation(clientId, .saved) }
        for clientId in incoming.failedClientIds { markWorkoutOperation(clientId, .failed) }

        // A saved action remains visible until the mirrored workout actually
        // reflects it. In particular, a cached context with no workout must
        // not clear a newly acknowledged action before the phone's next push.
        pendingWorkoutOperations.removeAll { operation in
            guard operation.state == .saved,
                  operation.scope == context.actionScope else { return false }
            guard let workout = incoming.workout,
                  workout.sessionId == operation.sessionId else { return false }
            let row = workout.exercises.flatMap(\.sets).first { $0.key == operation.setKey }
            return row?.completed == operation.completed
        }

        // Then settle saved taps. A total the phone built after a successful
        // tap has had its chance to include it, so keeping our own copy would
        // double-count. Failed taps remain available for an explicit retry.
        //
        // Not simply "a today-snapshot arrived, drop everything": an inbound
        // context is not always a fresh one. `adoptReceivedContext()` replays
        // whatever the phone last set, so re-opening the app minutes after a
        // tap re-applied this morning's cached total and wiped a tap that was
        // still sitting in the outbox, un-written. The bump vanished from the
        // bottle while the tap was very much still pending.
        //
        // Not "the total changed" either: two taps of the same container
        // between pushes leave the total looking untouched by that test, and
        // the taps would sit in the bottle forever.
        //
        // Both clocks are involved, so a phone/watch skew can clear a tap a
        // moment early or late. Bounded and self-correcting — the next push
        // settles the bottle on the server's number either way — where the
        // previous rule lost the tap outright.
        // Deliberately does NOT settle `.queued` taps. An unacknowledged tap
        // has no evidence behind it either way. It remains a delivery record
        // across midnight, though only taps from today affect today's bottle.
        if context.water?.isToday == true, !pendingWaterTaps.isEmpty {
            if let generatedAt = context.generatedAt {
                pendingWaterTaps.removeAll {
                    $0.scope == context.actionScope && $0.scope != nil &&
                        $0.state == .saved && $0.createdAt <= generatedAt
                }
            } else {
                // A phone build from before `pushedAt` existed: no timestamp to
                // reason with, so settle only saved taps.
                pendingWaterTaps.removeAll {
                    $0.scope == context.actionScope && $0.scope != nil && $0.state == .saved
                }
            }
        }

        // Acks ride along in the context so they still arrive if the watch app
        // was asleep when the server write completed.
        let acked = Set(incoming.ackedClientIds)
        if !acked.isEmpty {
            if let last = lastCaptured, acked.contains(last.id) {
                lastCapturedState = .saved
            }
            pending.removeAll { acked.contains($0.id) }
        }
        persist()
    }

    /// Check-ins still awaiting delivery, for the retry path.
    var retryable: [CheckIn] {
        pending.filter { $0.scope == context.actionScope && $0.scope != nil }
    }

    var visibleLastCaptured: CheckIn? {
        guard lastCaptured?.scope == context.actionScope,
              lastCaptured?.scope != nil else { return nil }
        return lastCaptured
    }

    // MARK: - Trend data

    /// History from the server, overlaid with anything captured locally that the
    /// server hasn't confirmed yet — so today's point appears immediately.
    func trendPoints(limit: Int = 14) -> [HistoryPoint] {
        var byDay: [String: HistoryPoint] = [:]
        for point in context.history {
            byDay[point.day] = point
        }
        for checkIn in retryable {
            byDay[checkIn.entryDate] = HistoryPoint(
                day: checkIn.entryDate,
                weightKg: checkIn.weightKg,
                bodyFatPercentage: checkIn.bodyFatPercentage
                    ?? byDay[checkIn.entryDate]?.bodyFatPercentage
            )
        }
        if let last = visibleLastCaptured, lastCapturedState == .saved {
            byDay[last.entryDate] = HistoryPoint(
                day: last.entryDate,
                weightKg: last.weightKg,
                bodyFatPercentage: last.bodyFatPercentage
                    ?? byDay[last.entryDate]?.bodyFatPercentage
            )
        }
        return byDay.values
            .sorted { $0.day < $1.day }
            .suffix(limit)
    }

    /// True when today's point should be drawn hollow — captured here but not
    /// yet acknowledged by the phone.
    func isDayUnconfirmed(_ day: String) -> Bool {
        retryable.contains { $0.entryDate == day }
    }

    /// Centred 7-day rolling mean. The wearer verifies the *shape* of the
    /// corridor rather than re-reading the digits, which works on a
    /// barely-awake brain.
    func rollingMean(points: [HistoryPoint], window: Int = 7) -> [HistoryPoint] {
        guard points.count >= 2 else { return [] }
        let half = window / 2
        return points.indices.map { index in
            let lower = max(0, index - half)
            let upper = min(points.count - 1, index + half)
            let slice = points[lower...upper]
            let mean = slice.reduce(0.0) { $0 + $1.weightKg } / Double(slice.count)
            return HistoryPoint(day: points[index].day, weightKg: mean, bodyFatPercentage: nil)
        }
    }

    // MARK: - Day rollover

    /// Drops nutrition and water snapshots that describe a day now past.
    ///
    /// Both are already guarded where they're displayed (`isToday`), but that
    /// guard is time-dependent while SwiftUI only re-evaluates a view when
    /// observed state changes — and midnight changes nothing observable. With
    /// the phone out of range no context arrives either, so a watch left
    /// running overnight kept rendering yesterday's totals: the guard was
    /// simply never asked again. The complication has no such problem, being
    /// a separate process WidgetKit re-renders on its own timeline, which is
    /// why it read zero while the page still showed yesterday.
    ///
    /// Clearing the data rather than merely forcing a redraw is deliberate:
    /// it publishes a real change, so every dependent view recomputes, and it
    /// stops the persisted context carrying numbers that are no longer true
    /// into the next launch.
    ///
    /// Weight and body-fat history is deliberately left alone — unlike
    /// today's totals, it doesn't expire at midnight.
    func pruneStaleDayData() {
        guard clearStaleDayData() else { return }
        persist()
    }

    /// Drops the stale snapshots and reports whether anything went, leaving
    /// persistence to the caller — `apply(context:)` writes once at the end
    /// either way, and a second write there would be pure waste.
    @discardableResult
    private func clearStaleDayData() -> Bool {
        var changed = false

        let today = CheckInDate.today()
        if localDay != today {
            localDay = today
            changed = true
        }

        if let nutrition = context.nutrition, !nutrition.isToday {
            context.nutrition = nil
            changed = true
        }
        if let water = context.water, !water.isToday {
            context.water = nil
            changed = true
        }
        // Pending taps are delivery records, not just today's presentation.
        // Keep older ones until acknowledged or explicitly resolved; the
        // bottle sums above filter by tap day so yesterday cannot prefill it.

        return changed
    }

    // MARK: - Persistence

    private func persist() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(context) { defaults.set(data, forKey: contextKey) }
        if let data = try? encoder.encode(pending) { defaults.set(data, forKey: pendingKey) }
        if let last = lastCaptured, let data = try? encoder.encode(last) {
            defaults.set(data, forKey: lastCapturedKey)
        }
        if let data = try? encoder.encode(pendingWaterTaps) {
            defaults.set(data, forKey: pendingWaterKey)
        }
        if let data = try? encoder.encode(pendingQuickWaterActions) {
            defaults.set(data, forKey: pendingQuickWaterKey)
        }
        if let data = try? encoder.encode(pendingFoodActions) {
            defaults.set(data, forKey: pendingFoodKey)
        }
        if let data = try? encoder.encode(pendingWorkoutOperations) {
            defaults.set(data, forKey: pendingWorkoutKey)
        }
    }

    private func load() {
        let decoder = JSONDecoder()
        if let data = defaults.data(forKey: contextKey),
           let decoded = try? decoder.decode(WatchContext.self, from: data) {
            context = decoded
        }
        if let data = defaults.data(forKey: pendingKey),
           let decoded = try? decoder.decode([CheckIn].self, from: data) {
            pending = decoded
        }
        if let data = defaults.data(forKey: lastCapturedKey),
           let decoded = try? decoder.decode(CheckIn.self, from: data) {
            lastCaptured = decoded
            lastCapturedState = pending.contains(where: { $0.id == decoded.id }) ? .queued : .saved
        }

        if let data = defaults.data(forKey: pendingWaterKey),
           let decoded = try? decoder.decode([PendingWaterTap].self, from: data) {
            pendingWaterTaps = decoded
        }
        if let data = defaults.data(forKey: pendingQuickWaterKey),
           let decoded = try? decoder.decode([PendingQuickWaterAction].self, from: data) {
            pendingQuickWaterActions = decoded
        }
        if let data = defaults.data(forKey: pendingFoodKey),
           let decoded = try? decoder.decode([PendingFoodLogAction].self, from: data) {
            pendingFoodActions = decoded
        }
        if let data = defaults.data(forKey: pendingWorkoutKey),
           let decoded = try? decoder.decode([WorkoutSetOperation].self, from: data) {
            pendingWorkoutOperations = decoded
        }

        // What was just restored may describe a day that has since ended —
        // the app can be relaunched any number of days after it last ran.
        pruneStaleDayData()
    }
}
