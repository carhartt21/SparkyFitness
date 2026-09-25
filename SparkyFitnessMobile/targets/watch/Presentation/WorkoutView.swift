import SwiftUI

/// The phone owns the active workout. A set tap enters the persisted Watch
/// outbox; queued and failed actions stay visibly distinct from confirmed ones.
struct WorkoutView: View {
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager

    private var workout: WatchWorkoutSnapshot? { store.context.workout }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Workout")
                    .font(.headline)

                if let workout {
                    Text(workout.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)

                    if let restEndsAt = workout.restEndsAt {
                        TimelineView(.periodic(from: .now, by: 1)) { timeline in
                            let remaining = max(0, Int(ceil(restEndsAt.timeIntervalSince(timeline.date))))
                            Text(remaining > 0 ? "Rest · \(remaining)s" : "Ready for next set")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                                .monospacedDigit()
                        }
                    }

                    ForEach(workout.exercises) { exercise in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(exercise.name)
                                .font(.caption)
                                .fontWeight(.semibold)
                                .lineLimit(2)

                            ForEach(exercise.sets) { set in
                                let pending = store.operation(for: set.key, sessionId: workout.sessionId)
                                let shownCompleted = pending?.state == .failed
                                    ? set.completed : (pending?.completed ?? set.completed)
                                Button {
                                    if let pending, pending.state == .failed {
                                        if let retry = store.retryFailedWorkoutOperation(pending.id) {
                                            session.sendWorkoutSetOperation(retry)
                                        }
                                    } else if pending == nil,
                                              let operation = store.captureWorkoutOperation(workout: workout, set: set) {
                                        session.sendWorkoutSetOperation(operation)
                                    }
                                } label: {
                                    HStack(spacing: 5) {
                                        Image(systemName: shownCompleted ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(shownCompleted ? Color.green : Color.secondary)
                                        Text("\(set.number)")
                                            .frame(width: 13, alignment: .leading)
                                        Text(setLabel(set))
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.7)
                                        Spacer(minLength: 0)
                                        if let pending {
                                            Image(systemName: pending.state == .failed ? "exclamationmark.circle" : "arrow.triangle.2.circlepath")
                                                .foregroundStyle(pending.state == .failed ? Color.red : Color.orange)
                                        }
                                    }
                                    .font(.system(size: 11))
                                    .foregroundStyle(set.id == workout.activeSetId ? Color.orange : Color.primary)
                                }
                                .buttonStyle(.plain)
                                .disabled(store.context.actionScope == nil ||
                                    (pending != nil && pending?.state != .failed))
                                .accessibilityElement(children: .combine)
                                .accessibilityLabel(accessibilityLabel(set, exercise: exercise, pending: pending))

                                if let pending, pending.state == .failed {
                                    HStack {
                                        Text("Not saved")
                                            .foregroundStyle(.red)
                                        Spacer()
                                        Button("Dismiss") {
                                            store.discardFailedWorkoutOperation(pending.id)
                                            session.retryPending()
                                        }
                                        .buttonStyle(.plain)
                                        .foregroundStyle(.orange)
                                        .accessibilityLabel("Dismiss failed set action")
                                    }
                                    .font(.system(size: 10))
                                }
                            }
                        }
                        .padding(7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 9))
                    }

                    Text("Set taps sync through your iPhone")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                } else {
                    Text("Start a workout on your iPhone to see it here.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 3)
        }
    }

    private func setLabel(_ set: WatchWorkoutSnapshot.Exercise.SetRow) -> String {
        let unit = store.context.effectiveWeightUnit
        let weight = set.weightKg.map { "\(String(format: "%.1f", unit.fromKg($0)))\(unit.suffix)" }
        let reps = set.reps.map { "\($0) reps" }
        let duration = set.durationSeconds.map { "\(Int($0))s" }
        let values = [weight, reps, duration].compactMap { $0 }.joined(separator: " × ")
        let kind: String
        switch set.type {
        case "warmup": kind = "Warm-up"
        case "dropset": kind = "Drop"
        case "failure": kind = "Failure"
        default: kind = ""
        }
        return [kind, values].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private func accessibilityLabel(
        _ set: WatchWorkoutSnapshot.Exercise.SetRow,
        exercise: WatchWorkoutSnapshot.Exercise,
        pending: WorkoutSetOperation?
    ) -> String {
        let state: String
        switch pending?.state {
        case .queued: state = "waiting for iPhone"
        case .saved: state = "saved, waiting for update"
        case .failed: state = "not saved, tap to retry"
        case nil: state = set.completed ? "completed" : "not completed"
        }
        return "\(exercise.name), set \(set.number), \(setLabel(set)), \(state)"
    }
}
