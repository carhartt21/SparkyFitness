import SwiftUI

struct WorkoutHealthStatusView: View {
    let workout: WatchWorkoutSnapshot
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var recorder: WorkoutHealthRecorder

    private var record: WorkoutHealthRecording? { recorder.record(for: workout, scope: store.context.actionScope) }

    private func phaseText(_ record: WorkoutHealthRecording) -> String {
        switch record.phase {
        case .ending, .saving: return WatchCopy.text("workout.health.finishing")
        case .requested: return WatchCopy.text("workout.health.request")
        case .saved: return WatchCopy.text("workout.health.saved")
        case .failed: return WatchCopy.text("workout.health.failed")
        case .discarded: return WatchCopy.text("workout.health.discarded")
        default: return WatchCopy.text("workout.health.recording")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let record {
                Text(phaseText(record))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if record.phase == .requested {
                    Text(WatchCopy.text("workout.healthRequestHint")).font(.caption2).foregroundStyle(.secondary)
                }
                if record.phase == .recording {
                    HStack {
                        Label(recorder.activeEnergyKcal.map { "\(Int($0.rounded())) kcal" } ?? "— kcal", systemImage: "flame")
                        Spacer(minLength: 2)
                        Label(recorder.heartRate.map { "\(Int($0.rounded())) bpm" } ?? "— bpm", systemImage: "heart")
                    }
                    .font(.caption2)
                    .monospacedDigit()
                    .accessibilityElement(children: .combine)
                }
            } else if workout.healthRecordingEnabled == true {
                Button {
                    recorder.requestRecording(workout: workout, scope: store.context.actionScope)
                } label: {
                    Text(WatchCopy.text("workout.healthStart"))
                        .font(.caption)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Neon.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(Neon.accent.opacity(0.5), lineWidth: 1))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(recorder.isPreparing || store.context.actionScope == nil)
                Text(WatchCopy.text("workout.healthStartHint"))
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            } else {
                Text(WatchCopy.text("workout.healthEnableHint"))
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
            if let messageKey = recorder.messageKey {
                Text(WatchCopy.text(messageKey))
                    .font(.caption2)
                    .foregroundStyle(.orange)
            }
        }
        .padding(7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .neonSurface(Neon.accent, intensity: .edge, cornerRadius: 9)
    }
}
