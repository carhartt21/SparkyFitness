import Foundation
import HealthKit
import Combine
import WatchKit

/// The Watch is the sole HealthKit writer once the phone durably grants it.
/// No phone fallback after a timeout; receipts and end commands survive offline
/// use. Set operations remain in CheckInStore's existing exactly-once outbox.
@MainActor
final class WorkoutHealthRecorder: NSObject, ObservableObject {
    static let shared = WorkoutHealthRecorder()
    @Published private(set) var activeEnergyKcal: Double?
    @Published private(set) var heartRate: Double?
    @Published private(set) var isPreparing = false
    @Published private(set) var messageKey: String?
    @Published private(set) var records: [WorkoutHealthRecording] = []
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var runtime = WorkoutHealthRecordingRuntime()
    private var currentSyncId: String? { runtime.current?.syncId }
    private var starting: Bool { runtime.starting }
    private var recovering = false
    private let storageKey = "xot.workoutHealth.recordings.v1"
    private let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
    private let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate)!

    private override init() {
        super.init()
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let restored = try? JSONDecoder().decode([WorkoutHealthRecording].self, from: data) {
            records = restored
        }
    }

    func record(for workout: WatchWorkoutSnapshot, scope: String?) -> WorkoutHealthRecording? {
        records.last { $0.sessionId == workout.sessionId && $0.scope == scope }
    }

    func requestRecording(workout: WatchWorkoutSnapshot, scope: String?) {
        guard !isPreparing, let scope, !scope.isEmpty,
              workout.healthRecordingEnabled == true else { return }
        if let previous = record(for: workout, scope: scope) {
            messageKey = previous.terminal ? "workout.healthUnavailable" : nil
            retryPending(); return
        }
        guard runtime.current == nil else { messageKey = "workout.healthBusy"; return }
        isPreparing = true
        messageKey = nil
        Task {
            defer { isPreparing = false }
            do {
                guard HKHealthStore.isHealthDataAvailable() else { throw RecordingError.unavailable }
                try await healthStore.requestAuthorization(toShare: [HKObjectType.workoutType(), energyType, heartRateType],
                    read: [HKObjectType.workoutType(), energyType, heartRateType])
                guard healthStore.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized,
                      healthStore.authorizationStatus(for: energyType) == .sharingAuthorized else {
                    throw RecordingError.permission
                }
                // The permissions sheet may have outlived this account/workout.
                guard CheckInStore.shared.context.actionScope == scope,
                      CheckInStore.shared.context.workout?.sessionId == workout.sessionId else { return }
                records.append(.init(sessionId: workout.sessionId, scope: scope, syncId: "", phase: .requested))
                persist()
                retryPending()
            } catch { messageKey = "workout.healthPermission" }
        }
    }

    func retryPending() {
        let scope = CheckInStore.shared.context.actionScope
        for record in records where record.scope == scope && record.acknowledgedPhase != record.phase {
            WatchSessionManager.shared.sendWorkoutHealth(record.event)
        }
    }

    func receive(_ payload: [String: Any]) {
        guard let command = WorkoutHealthCommand(payload),
              let index = records.firstIndex(where: { $0.matches(command) }) else { return }
        let directive = records[index].apply(command)
        persist()
        switch directive {
        case .ignore: retryPending(); return
        case .acknowledge: return
        case .reject: messageKey = "workout.healthRejected"; return
        case .finish:
            if !starting { finish(syncId: command.syncId) }
            return
        case .start: break
        }
        guard CheckInStore.shared.context.actionScope == command.scope,
              CheckInStore.shared.context.workout?.sessionId == command.sessionId,
              CheckInStore.shared.context.workout?.healthRecordingEnabled == true,
              runtime.current == nil else {
            fail(command.syncId, message: "workout.healthRejected"); return
        }
        guard let lease = runtime.acquire(command.syncId, starting: true) else { return }
        Task {
            defer { runtime.didStart(lease) }
            var ownedSession: HKWorkoutSession?
            var ownedBuilder: HKLiveWorkoutBuilder?
            do {
                let configuration = HKWorkoutConfiguration()
                configuration.activityType = .traditionalStrengthTraining
                configuration.locationType = .indoor
                let workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
                let liveBuilder = workoutSession.associatedWorkoutBuilder()
                ownedSession = workoutSession; ownedBuilder = liveBuilder
                session = workoutSession; builder = liveBuilder
                workoutSession.delegate = self; liveBuilder.delegate = self
                liveBuilder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
                let start = Date() // Never backdate sensor measurements to the phone start.
                update(command.syncId) { $0.startedAt = start }
                try await liveBuilder.addMetadata([
                    HKMetadataKeySyncIdentifier: command.syncId, HKMetadataKeySyncVersion: 1,
                    HKMetadataKeyExternalUUID: command.syncId, HKMetadataKeyWorkoutBrandName: "X on Track",
                    "XOnTrackWritebackVersion": 1,
                ])
                guard runtime.owns(lease) else { return }
                workoutSession.startActivity(with: start)
                try await liveBuilder.beginCollection(at: start)
                guard runtime.owns(lease) else { return }
                runtime.didStart(lease)
                update(command.syncId) { $0.phase = .recording }
                retryPending()
                if records.first(where: { $0.syncId == command.syncId })?.finishedAt != nil {
                    finish(syncId: command.syncId)
                }
            } catch {
                ownedBuilder?.discardWorkout(); ownedSession?.end()
                guard release(lease) else { return }
                fail(command.syncId, message: "workout.healthBusy")
            }
        }
    }

    /// A scope switch revokes recording; a missing workout alone is not proof
    /// of finish. Only the durable phone finish command authorizes a Health save.
    func reconcileScope(_ scope: String?) {
        guard let syncId = currentSyncId,
              let record = records.first(where: { $0.syncId == syncId }),
              record.scope != scope, record.phase != .saving else { return }
        update(syncId) { $0.finishedAt = Date(); $0.save = false }
        if !starting { finish(syncId: syncId) }
    }

    private func finish(syncId: String) {
        guard let record = records.first(where: { $0.syncId == syncId }),
              !record.terminal, record.phase != .ending, record.phase != .saving else { return }
        guard let lease = runtime.current, lease.syncId == syncId, let builder, let session else {
            fail(syncId, message: "workout.healthUnavailable"); return
        }
        guard record.save == true, let start = record.startedAt, let end = record.finishedAt,
              end > start, end <= Date().addingTimeInterval(60) else {
            builder.discardWorkout(); session.end(); release(lease)
            update(syncId) { $0.phase = .discarded }; retryPending(); return
        }
        update(syncId) { $0.phase = .ending }
        Task {
            do {
                session.stopActivity(with: end)
                try await builder.endCollection(at: end)
                guard runtime.owns(lease) else { return }
                guard let kcal = builder.statistics(for: energyType)?.sumQuantity()?.doubleValue(for: .kilocalorie()),
                      kcal.isFinite, kcal > 0 else {
                    builder.discardWorkout(); session.end(); release(lease)
                    fail(syncId, message: "workout.healthNoEnergy"); return
                }
                // Persist BEFORE the non-repeatable write. A crash in this
                // window must query/recover, never construct another workout.
                guard CheckInStore.shared.context.actionScope == record.scope,
                      records.first(where: { $0.syncId == syncId })?.save == true else {
                    builder.discardWorkout(); session.end(); release(lease)
                    update(syncId) { $0.phase = .discarded }; retryPending(); return
                }
                update(syncId) { $0.phase = .saving; $0.saveAttempted = true }
                let workout = try await builder.finishWorkout()
                // The save itself is authoritative even if a failure callback
                // released this lease while awaiting HealthKit. Update only its
                // durable receipt; scoped cleanup cannot release a successor.
                update(syncId) { $0.phase = .saved; $0.workoutUuid = workout?.uuid.uuidString }
                // nil + no error is a successful save on a locked device.
                session.end(); release(lease); retryPending()
            } catch {
                session.end()
                guard release(lease) else { return }
                fail(syncId, message: "workout.healthUnavailable")
            }
        }
    }

    /// watchOS launches this recovery path after an interrupted active session.
    /// Existing samples are reused. No fabricated interval or new builder.
    func recover() {
        guard runtime.current == nil, !recovering else { return }
        recovering = true
        let interrupted = records.filter { !$0.terminal && $0.phase != .requested || $0.phase == .failed && $0.saveAttempted == true }
        healthStore.recoverActiveWorkoutSession { recovered, _ in
            Task { @MainActor in
                defer { self.recovering = false }
                // A newly granted workout can start while recovery is in flight.
                guard self.runtime.current == nil else { return }
                if let recovered {
                    let recoveredBuilder = recovered.associatedWorkoutBuilder()
                    guard let syncId = recoveredBuilder.metadata[HKMetadataKeySyncIdentifier] as? String,
                          let record = self.records.first(where: { $0.syncId == syncId && !$0.terminal }) else {
                        recoveredBuilder.discardWorkout(); recovered.end(); return
                    }
                    guard self.runtime.acquire(syncId, starting: false) != nil else { return }
                    self.session = recovered; self.builder = recoveredBuilder
                    recovered.delegate = self; recoveredBuilder.delegate = self
                    if record.phase == .saving {
                        // Do not repeat an ambiguous save, even without read permission.
                        self.resolveInterruptedSave(record)
                    } else {
                        self.update(syncId) { $0.phase = .recording }
                        if record.finishedAt != nil { self.finish(syncId: syncId) }
                    }
                } else {
                    for record in interrupted {
                        self.resolveInterruptedSave(record)
                    }
                }
            }
        }
    }

    private func resolveInterruptedSave(_ record: WorkoutHealthRecording) {
        let lease = runtime.current.flatMap { $0.syncId == record.syncId ? $0 : nil }
        let ownedSession = lease == nil ? nil : session
        let predicate = HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeySyncIdentifier,
                                                   allowedValues: [record.syncId])
        let query = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: 1, sortDescriptors: nil) {
            _, samples, _ in
            Task { @MainActor in
                if let workout = samples?.first as? HKWorkout {
                    self.update(record.syncId) { $0.phase = .saved; $0.workoutUuid = workout.uuid.uuidString }
                } else { self.fail(record.syncId, message: "workout.healthUnavailable") }
                if let lease, self.release(lease) { ownedSession?.end() }
                self.retryPending()
            }
        }
        healthStore.execute(query)
    }

    private func update(_ syncId: String, _ change: (inout WorkoutHealthRecording) -> Void) {
        guard let index = records.firstIndex(where: { $0.syncId == syncId }) else { return }
        change(&records[index]); persist()
    }
    private func fail(_ syncId: String, message: String) {
        guard let record = records.first(where: { $0.syncId == syncId }),
              record.phase != .saved, record.phase != .discarded else { return }
        if currentSyncId == nil || currentSyncId == syncId { messageKey = message }
        update(syncId) { $0.phase = .failed }; retryPending()
    }
    @discardableResult
    private func release(_ lease: WorkoutHealthRecordingRuntime.Lease) -> Bool {
        guard runtime.release(lease) else { return false }
        session = nil; builder = nil
        activeEnergyKcal = nil; heartRate = nil
        return true
    }
    private func persist() {
        if let data = try? JSONEncoder().encode(records) { UserDefaults.standard.set(data, forKey: storageKey) }
    }
    private enum RecordingError: Error { case unavailable, permission }
}

extension WorkoutHealthRecorder: HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState, date: Date) {}
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in
            // A late callback from an ended session must not stop its successor.
            guard self.session === workoutSession, let lease = self.runtime.current else { return }
            self.builder?.discardWorkout(); workoutSession.end(); self.release(lease)
            self.fail(lease.syncId, message: "workout.healthUnavailable")
        }
    }
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        Task { @MainActor in
            guard self.builder === workoutBuilder else { return }
            self.activeEnergyKcal = workoutBuilder.statistics(for: self.energyType)?.sumQuantity()?.doubleValue(for: .kilocalorie())
            self.heartRate = workoutBuilder.statistics(for: self.heartRateType)?.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
        }
    }
}

final class WorkoutRecoveryDelegate: NSObject, WKApplicationDelegate {
    func handleActiveWorkoutRecovery() {
        Task { @MainActor in WorkoutHealthRecorder.shared.recover() }
    }
}
