import SwiftUI
import WatchKit

/// The phone owns the active workout. A set tap enters the persisted Watch
/// outbox; queued and failed actions stay visibly distinct from confirmed ones.
///
/// Each set row has two targets: the circle confirms the set as it stands,
/// and the row opens an editor where weight and reps are set with the
/// Digital Crown before confirming.
struct WorkoutView: View {
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager
    @EnvironmentObject private var healthRecorder: WorkoutHealthRecorder
    @State private var path: [WorkoutSetRoute] = []

    private var workout: WatchWorkoutSnapshot? { store.context.workout }

    var body: some View {
        // Scoped to this page, like Water and Food: a stack around the whole
        // TabView would make the editor look like part of the deck.
        NavigationStack(path: $path) {
            content
                .navigationDestination(for: WorkoutSetRoute.self) { route in
                    WorkoutSetEditorView(route: route) { path.removeAll() }
                }
        }
        // A workout that ends on the phone closes any open editor.
        .onChange(of: workout?.sessionId) { _, _ in path.removeAll() }
    }

    private var content: some View {
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
                        VStack(alignment: .leading, spacing: 4) {
                            Text(exercise.name)
                                .font(.caption)
                                .fontWeight(.semibold)
                                .lineLimit(2)

                            ForEach(exercise.sets) { set in
                                setRow(set, exercise: exercise, workout: workout)
                            }
                        }
                        .padding(7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .neonSurface(Neon.accent, intensity: .edge, cornerRadius: 9)
                    }

                    Text(WatchCopy.text("workout.editSyncHint"))
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
            .padding(.bottom, 12)
        }
    }

    @ViewBuilder
    private func setRow(
        _ set: WatchWorkoutSnapshot.Exercise.SetRow,
        exercise: WatchWorkoutSnapshot.Exercise,
        workout: WatchWorkoutSnapshot
    ) -> some View {
        let pending = store.operation(for: set.key, sessionId: workout.sessionId)
        let shownCompleted = pending?.state == .failed
            ? set.completed : (pending?.completed ?? set.completed)
        let locked = store.context.actionScope == nil || (pending != nil && pending?.state != .failed)
        let isActive = set.id == workout.activeSetId

        HStack(spacing: 6) {
            // Confirm as shown, or retry a failed action.
            Button {
                if let pending, pending.state == .failed {
                    if let retry = store.retryFailedWorkoutOperation(pending.id) {
                        session.sendWorkoutSetOperation(retry)
                    }
                } else if pending == nil,
                          let operation = store.captureWorkoutOperation(workout: workout, set: set) {
                    WKInterfaceDevice.current().play(.click)
                    session.sendWorkoutSetOperation(operation)
                }
            } label: {
                Image(systemName: shownCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundStyle(shownCompleted ? Neon.accent : Color.secondary)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(locked)
            .accessibilityLabel(
                pending?.state == .failed
                    ? WatchCopy.text("workout.retrySet", set.number)
                    : shownCompleted ? WatchCopy.text("workout.undoSet", set.number) : WatchCopy.text("workout.confirmSet", set.number)
            )

            // Open the editor; duration sets have nothing to edit here.
            Button {
                path.append(WorkoutSetRoute(sessionId: workout.sessionId, setKey: set.key))
            } label: {
                HStack(spacing: 5) {
                    Text("\(set.number)")
                        .foregroundStyle(.secondary)
                        .frame(width: 13, alignment: .leading)
                    Text(setLabel(set, pending: pending))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Spacer(minLength: 0)
                    if let pending {
                        Image(systemName: pending.state == .failed ? "exclamationmark.circle" : "arrow.triangle.2.circlepath")
                            .foregroundStyle(pending.state == .failed ? Color.red : Color.orange)
                    } else if set.isEditable {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
                .font(.system(size: 12, weight: isActive ? .semibold : .regular))
                .foregroundStyle(isActive ? Color.orange : Color.primary)
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(locked || !set.isEditable)
            .accessibilityLabel(accessibilityLabel(set, exercise: exercise, pending: pending))
            .accessibilityHint(set.isEditable ? WatchCopy.text("workout.editHint") : "")
        }
        .frame(minHeight: 44)

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

    /// The set's values, showing an edit still on its way to the phone.
    private func setLabel(
        _ set: WatchWorkoutSnapshot.Exercise.SetRow,
        pending: WorkoutSetOperation?
    ) -> String {
        let unit = store.context.effectiveWeightUnit
        let edit = pending?.state == .failed ? nil : pending
        let weightKg = edit?.weightKg ?? set.weightKg
        let reps = edit?.reps ?? set.reps
        let weight = weightKg.map { formatWeight(unit.fromKg($0), unit: unit) }
        let repsText = reps.map { WatchCopy.text("workout.reps", $0) }
        let duration = set.durationSeconds.map { "\(Int($0))s" }
        let values = [weight, repsText, duration].compactMap { $0 }.joined(separator: " × ")
        let kind: String
        switch set.type {
        case "warmup": kind = WatchCopy.text("workout.warmup")
        case "dropset": kind = WatchCopy.text("workout.dropset")
        case "failure": kind = WatchCopy.text("workout.failure")
        default: kind = ""
        }
        let label = [kind, values].filter { !$0.isEmpty }.joined(separator: " · ")
        return label.isEmpty ? WatchCopy.text("workout.addValues") : label
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
        return WatchCopy.text("workout.setAccessibility", exercise.name, set.number, setLabel(set, pending: pending), state)
    }
}

/// "72.5kg": at most one decimal, none when whole.
func formatWeight(_ value: Double, unit: WeightUnit) -> String {
    let rounded = (value * 10).rounded() / 10
    let text = rounded == rounded.rounded()
        ? String(Int(rounded)) : String(format: "%.1f", locale: Locale.current, rounded)
    return "\(text)\(unit.suffix)"
}

extension WatchWorkoutSnapshot.Exercise.SetRow {
    /// Strength sets carry weight and/or reps; a set measured only by time
    /// has nothing the editor could change.
    var isEditable: Bool {
        weightKg != nil || reps != nil || durationSeconds == nil
    }
}

struct WorkoutSetRoute: Hashable {
    let sessionId: String
    let setKey: String
}

/// Weight and reps for one set, each set with the Digital Crown. Tap a value
/// to choose which one the crown turns. Confirming sends both the values and
/// the completion in one action; a completed set can be corrected without
/// un-completing it.
struct WorkoutSetEditorView: View {
    let route: WorkoutSetRoute
    let onDone: () -> Void

    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager

    private enum Field { case weight, reps }
    @FocusState private var focus: Field?
    @State private var weight: Double = 0
    @State private var reps: Double = 0
    @State private var loaded = false
    @State private var originalSet: WatchWorkoutSnapshot.Exercise.SetRow?
    @State private var originalScope: String?
    @State private var changedOnPhone = false

    private var unit: WeightUnit { store.context.effectiveWeightUnit }
    /// Plate increments: 1.25 kg or 2.5 lb per crown step.
    private var weightStep: Double { unit == .kg ? 1.25 : 2.5 }
    private var weightMax: Double { unit == .kg ? 500 : 1100 }

    private var located: (WatchWorkoutSnapshot, WatchWorkoutSnapshot.Exercise, WatchWorkoutSnapshot.Exercise.SetRow)? {
        guard let workout = store.context.workout, workout.sessionId == route.sessionId else { return nil }
        for exercise in workout.exercises {
            if let set = exercise.sets.first(where: { $0.key == route.setKey }) {
                return (workout, exercise, set)
            }
        }
        return nil
    }

    var body: some View {
        Group {
            if let (workout, exercise, set) = located {
                editor(workout: workout, exercise: exercise, set: set)
            } else {
                Text(WatchCopy.text("workout.setRemoved"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle(WatchCopy.text("workout.setTitle"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func editor(
        workout: WatchWorkoutSnapshot,
        exercise: WatchWorkoutSnapshot.Exercise,
        set: WatchWorkoutSnapshot.Exercise.SetRow
    ) -> some View {
        VStack(spacing: 6) {
            Text(WatchCopy.text("workout.editTitle", exercise.name, set.number))
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            HStack(spacing: 6) {
                valueTile(
                    title: unit.suffix,
                    text: formatWeight(weight, unit: unit).replacingOccurrences(of: unit.suffix, with: ""),
                    field: .weight
                )
                .digitalCrownRotation(
                    $weight, from: 0, through: weightMax, by: weightStep,
                    sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true
                )
                .accessibilityLabel(WatchCopy.text("workout.weight"))
                .accessibilityValue(formatWeight(weight, unit: unit))
                .accessibilityAdjustableAction { direction in
                    adjust(&weight, by: direction == .increment ? weightStep : -weightStep, max: weightMax)
                }

                valueTile(title: WatchCopy.text("workout.repsShort"), text: String(Int(reps)), field: .reps)
                    .digitalCrownRotation(
                        $reps, from: 0, through: 100, by: 1,
                        sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true
                    )
                    .accessibilityLabel(WatchCopy.text("workout.repetitions"))
                    .accessibilityValue("\(Int(reps))")
                    .accessibilityAdjustableAction { direction in
                        adjust(&reps, by: direction == .increment ? 1 : -1, max: 100)
                    }
            }

            Button {
                save(workout: workout, set: set, complete: true)
            } label: {
                Label(WatchCopy.text(set.completed ? "workout.saveEdit" : "workout.completeSet"), systemImage: "checkmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Neon.accentText)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Neon.accent)
            .disabled(store.context.actionScope == nil || store.operation(for: set.key, sessionId: workout.sessionId) != nil)
            if changedOnPhone {
                Text(WatchCopy.text("workout.editChanged")).font(.caption2).foregroundStyle(.orange)
            }
        }
        .padding(.horizontal, 2)
        .onAppear { load(set: set, exercise: exercise) }
    }

    private func valueTile(title: String, text: String, field: Field) -> some View {
        let focused = focus == field
        return VStack(spacing: 0) {
            Text(text)
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 64)
        .neonSurface(Neon.accent, intensity: focused ? .strong : .edge, cornerRadius: 12)
        .focusable()
        .focused($focus, equals: field)
        .onTapGesture { focus = field }
    }

    private func adjust(_ value: inout Double, by delta: Double, max: Double) {
        value = Swift.min(max, Swift.max(0, value + delta))
    }

    /// Starts from the set's own values, else the previous set's, so a new
    /// set begins where the last one ended.
    private func load(
        set: WatchWorkoutSnapshot.Exercise.SetRow,
        exercise: WatchWorkoutSnapshot.Exercise
    ) {
        guard !loaded else { return }
        loaded = true
        originalSet = set
        originalScope = store.context.actionScope
        let previous = exercise.sets.last { $0.number < set.number && ($0.weightKg != nil || $0.reps != nil) }
        weight = unit.fromKg(set.weightKg ?? previous?.weightKg ?? 0)
        reps = Double(set.reps ?? previous?.reps ?? 0)
        focus = set.weightKg == nil && set.reps != nil ? .reps : .weight
    }

    private func save(
        workout: WatchWorkoutSnapshot,
        set: WatchWorkoutSnapshot.Exercise.SetRow,
        complete: Bool
    ) {
        guard let originalSet, originalScope == store.context.actionScope,
              originalSet.signature == set.signature, originalSet.completed == set.completed else {
            changedOnPhone = true
            return
        }
        // Keep an untouched value exact: the crown works in display units,
        // and converting an unchanged lb value back could shift the kg.
        let shownWeight = unit.fromKg(set.weightKg ?? 0)
        let weightKg = set.weightKg != nil && abs(shownWeight - weight) < 0.05
            ? set.weightKg : unit.toKg(weight)
        let operation = store.captureWorkoutEdit(
            workout: workout,
            set: set,
            weightKg: set.weightKg == nil && weight == 0 ? nil : weightKg,
            reps: set.reps == nil && reps == 0 ? nil : Int(reps),
            complete: complete
        )
        if let operation {
            WKInterfaceDevice.current().play(.success)
            session.sendWorkoutSetOperation(operation)
        }
        onDone()
    }
}
