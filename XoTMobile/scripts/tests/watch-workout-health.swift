import Foundation

@main
struct WorkoutHealthProtocolTests {
    static func main() throws {
        var assertions = 0
        func check(_ condition: @autoclosure () -> Bool, _ label: String) {
            precondition(condition(), label); assertions += 1
        }
        let scope = "[\"server-1\",\"user-1\"]"
        func command(_ action: String, _ additions: [String: Any] = [:]) -> WorkoutHealthCommand {
            var raw: [String: Any] = ["type": "workoutHealthCommand", "action": action,
                "scope": scope, "sessionId": "s1", "syncId": "canonical-s1"]
            raw.merge(additions) { _, new in new }
            return WorkoutHealthCommand(raw)!
        }
        let requested = WorkoutHealthRecording(sessionId: "s1", scope: scope, syncId: "", phase: .requested)
        var record = requested
        check(record.apply(command("start")) == .start, "one start grant")
        check(record.syncId == "canonical-s1", "phone's identity")
        check(record.apply(command("start")) == .ignore, "duplicate start never builds again")
        check(!record.matches(command("finish", ["scope": "other", "finishedAt": 1000])), "account scope fixed")
        record.phase = .recording
        check(record.apply(command("finish", ["finishedAt": 2000, "save": true])) == .finish, "offline finish")
        check(record.finishedAt == Date(timeIntervalSince1970: 2), "original finish retained")
        _ = record.apply(command("finish", ["finishedAt": 9999, "save": false]))
        check(record.finishedAt == Date(timeIntervalSince1970: 2) && record.save == true, "retry cannot alter finish")
        record.phase = .saved
        check(record.apply(command("start")) == .ignore, "saved session cannot restart")
        _ = record.apply(command("ack", ["ackPhase": "recording"]))
        check(record.acknowledgedPhase == nil, "stale ack cannot hide save receipt")
        _ = record.apply(command("ack", ["ackPhase": "saved"]))
        check(record.acknowledgedPhase == .saved, "matching ack settles receipt")
        let restored = try JSONDecoder().decode(WorkoutHealthRecording.self, from: JSONEncoder().encode(record))
        check(restored == record && restored.terminal, "restart keeps terminal ownership")
        for phase in [WorkoutHealthRecording.Phase.failed, .discarded] {
            var terminal = record; terminal.phase = phase
            check(terminal.apply(command("start")) == .ignore, "failed/discarded cannot restart")
        }
        var reordered = requested
        check(reordered.apply(command("finish", ["finishedAt": 2000, "save": true])) == .finish, "finish can precede grant")
        reordered.phase = .failed // No builder exists; recorder conservatively fails.
        check(reordered.apply(command("start")) == .ignore, "late start after finish cannot collect another workout")
        var discarded = requested
        _ = discarded.apply(command("discard"), now: Date(timeIntervalSince1970: 2))
        check(discarded.save == false && discarded.finishedAt != nil, "cancel never authorizes save")
        check(WorkoutHealthCommand(["type": "workoutHealthCommand", "action": "finish", "scope": scope,
            "sessionId": "s1", "syncId": "canonical-s1", "finishedAt": Double.nan]) == nil, "invalid time rejected")
        check(WorkoutHealthCommand(["type": "workoutHealthCommand", "action": "other"]) == nil, "unknown commands rejected")
        // A native failure releases A while its addMetadata/endCollection task
        // is suspended. B starts before A's catch/defer/success is delivered.
        var runtime = WorkoutHealthRecordingRuntime()
        let first = runtime.acquire("first", starting: true)!
        check(runtime.starting, "first startup holds lease")
        check(runtime.acquire("overlap", starting: true) == nil, "no overlapping startup grant")
        check(runtime.release(first), "failure releases first")
        let second = runtime.acquire("second", starting: true)!
        check(!runtime.owns(first) && runtime.owns(second), "late first continuation no longer owns recorder")
        check(!runtime.release(first), "late first cleanup cannot release second")
        runtime.didStart(first)
        check(runtime.starting, "late first defer cannot end second startup")
        runtime.didStart(second)
        check(!runtime.starting && runtime.owns(second), "second completes its own startup")
        check(runtime.release(second), "second finishes normally")
        let recovered = runtime.acquire("second", starting: false)!
        check(recovered != second, "recovery uses a new generation even for same sync id")
        check(!runtime.release(second) && runtime.owns(recovered), "stale recovery query cannot release new generation")
        check(runtime.release(recovered), "recovered owner cleans up")
        print("Watch Health protocol: \(assertions) assertions passed")
    }
}
