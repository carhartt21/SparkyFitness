import SwiftUI

/// The phone owns the active workout. A set tap enters the persisted Watch
/// outbox; queued and failed actions stay visibly distinct from confirmed ones.
struct WorkoutView: View {
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager
    @EnvironmentObject private var healthRecorder: WorkoutHealthRecorder

    private var workout: WatchWorkoutSnapshot? { store.context.workout }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text(WatchCopy.text("workout.title"))
                    .font(.headline)

                if let workout {
                    Text(workout.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)

                    WorkoutHealthStatusView(workout: workout)

                    if let restEndsAt = workout.restEndsAt {
                        TimelineView(.periodic(from: .now, by: 1)) { timeline in
                            let remaining = max(0, Int(ceil(restEndsAt.timeIntervalSince(timeline.date))))
                            Text(remaining > 0 ? WatchCopy.text("workout.rest", remaining) : WatchCopy.text("workout.ready"))
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
                                        Text(WatchCopy.text("workout.notSaved"))
                                            .foregroundStyle(.red)
                                        Spacer()
                                        Button(WatchCopy.text("workout.dismiss")) {
                                            store.discardFailedWorkoutOperation(pending.id)
                                            session.retryPending()
                                        }
                                        .buttonStyle(.plain)
                                        .foregroundStyle(.orange)
                                        .accessibilityLabel(WatchCopy.text("workout.dismissSetAction"))
                                    }
                                    .font(.system(size: 10))
                                }
                            }
                        }
                        .padding(7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .neonSurface(Neon.accent, intensity: .edge, cornerRadius: 9)
                    }

                    Text(WatchCopy.text("workout.syncHint"))
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                } else {
                    if let record = healthRecorder.records.last(where: {
                        $0.scope == store.context.actionScope &&
                        Calendar.current.isDateInToday($0.finishedAt ?? .distantPast)
                    }) {
                        Text(record.phase == .saved ? WatchCopy.text("workout.health.saved") :
                             record.phase == .discarded ? WatchCopy.text("workout.health.discarded") :
                             record.phase == .failed ? WatchCopy.text("workout.health.failed") :
                             WatchCopy.text("workout.health.finishing"))
                            .font(.caption)
                        if let key = healthRecorder.messageKey {
                            Text(WatchCopy.text(key)).font(.caption2).foregroundStyle(.orange)
                        }
                    }
                    Text(WatchCopy.text("workout.empty"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 3)
        }
    }

    private func setLabel(_ set: WatchWorkoutSnapshot.Exercise.SetRow) -> String {
        let unit = store.context.effectiveWeightUnit
        let weight = set.weightKg.map { "\(String(format: "%.1f", locale: Locale.current, unit.fromKg($0)))\(unit.suffix)" }
        let reps = set.reps.map { WatchCopy.text("workout.reps", $0) }
        let duration = set.durationSeconds.map { "\(Int($0))s" }
        let values = [weight, reps, duration].compactMap { $0 }.joined(separator: " × ")
        let kind: String
        switch set.type {
        case "warmup": kind = WatchCopy.text("workout.warmup")
        case "dropset": kind = WatchCopy.text("workout.dropset")
        case "failure": kind = WatchCopy.text("workout.failure")
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
        case .queued: state = WatchCopy.text("workout.queuedState")
        case .saved: state = WatchCopy.text("workout.savedState")
        case .failed: state = WatchCopy.text("workout.failedState")
        case nil: state = set.completed ? WatchCopy.text("workout.completedState") : WatchCopy.text("workout.openState")
        }
        return WatchCopy.text("workout.setAccessibility", exercise.name, set.number, setLabel(set), state)
    }
}
