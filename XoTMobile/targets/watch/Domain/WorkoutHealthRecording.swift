import Foundation

/// Async work keeps its lease across awaits. A failed session's delayed cleanup
/// must not release its successor or mark that successor's startup complete.
struct WorkoutHealthRecordingRuntime {
    struct Lease: Equatable {
        let syncId: String
        fileprivate let generation = UUID()
    }
    private(set) var current: Lease?
    private(set) var starting = false

    mutating func acquire(_ syncId: String, starting: Bool) -> Lease? {
        guard current == nil else { return nil }
        let lease = Lease(syncId: syncId)
        current = lease; self.starting = starting
        return lease
    }
    func owns(_ lease: Lease) -> Bool { current == lease }
    mutating func didStart(_ lease: Lease) {
        guard owns(lease) else { return }
        starting = false
    }
    @discardableResult
    mutating func release(_ lease: Lease) -> Bool {
        guard owns(lease) else { return false }
        current = nil; starting = false
        return true
    }
}

/// Durable writer reservation and receipt. A terminal record never starts a
/// second HealthKit builder, including reordered/duplicated WC deliveries.
struct WorkoutHealthRecording: Codable, Equatable {
    enum Phase: String, Codable { case requested, reserved, recording, ending, saving, saved, failed, discarded }
    let sessionId: String
    let scope: String
    var syncId: String
    var phase: Phase
    var startedAt: Date?
    var finishedAt: Date?
    var save: Bool?
    var saveAttempted: Bool?
    var workoutUuid: String?
    var acknowledgedPhase: Phase?

    var terminal: Bool { [.saved, .failed, .discarded].contains(phase) }
    var eventPhase: String {
        switch phase {
        case .requested: return "request"
        case .reserved, .recording, .ending, .saving: return "recording"
        default: return phase.rawValue
        }
    }
    var event: [String: Any] {
        var payload: [String: Any] = ["type": "workoutHealth", "sessionId": sessionId,
            "scope": scope, "syncId": syncId, "phase": eventPhase]
        if let workoutUuid { payload["workoutUuid"] = workoutUuid }
        return payload
    }
    func matches(_ command: WorkoutHealthCommand) -> Bool {
        command.scope == scope && command.sessionId == sessionId &&
            (syncId.isEmpty || command.syncId == syncId)
    }
    enum Directive { case ignore, acknowledge, reject, start, finish }

    /// Pure protocol transition, also tested on macOS without a paired Watch.
    mutating func apply(_ command: WorkoutHealthCommand, now: Date = Date()) -> Directive {
        guard matches(command) else { return .ignore }
        if command.action == "ack" { acknowledge(command.ackPhase); return .acknowledge }
        guard !terminal else { return .ignore }
        syncId = command.syncId
        if command.action == "reject" { phase = .failed; return .reject }
        if command.action == "finish" || command.action == "discard" {
            if finishedAt == nil {
                finishedAt = command.finishedAt ?? now
                save = command.action == "finish" && command.save
            }
            return .finish
        }
        guard command.action == "start", phase == .requested else { return .ignore }
        phase = .reserved
        return .start
    }

    mutating func acknowledge(_ eventPhase: String?) {
        // An old recording ack must not acknowledge a later save receipt.
        if eventPhase == self.eventPhase { acknowledgedPhase = phase }
    }
}

struct WorkoutHealthCommand {
    let action: String
    let sessionId: String
    let scope: String
    let syncId: String
    let finishedAt: Date?
    let save: Bool
    let ackPhase: String?

    init?(_ payload: [String: Any]) {
        guard payload["type"] as? String == "workoutHealthCommand",
              let action = payload["action"] as? String,
              ["start", "finish", "discard", "ack", "reject"].contains(action),
              let sessionId = payload["sessionId"] as? String, !sessionId.isEmpty,
              let scope = payload["scope"] as? String, !scope.isEmpty,
              let syncId = payload["syncId"] as? String, !syncId.isEmpty else { return nil }
        let milliseconds = (payload["finishedAt"] as? NSNumber)?.doubleValue
        if action == "finish", milliseconds == nil || milliseconds?.isFinite != true { return nil }
        self.action = action; self.sessionId = sessionId; self.scope = scope; self.syncId = syncId
        finishedAt = milliseconds.flatMap { $0.isFinite ? Date(timeIntervalSince1970: $0 / 1000) : nil }
        save = payload["save"] as? Bool == true
        ackPhase = payload["ackPhase"] as? String
    }
}
