import SwiftUI

/// A current-day breakdown, never a simulated score or automatic workout record.
struct DailyGoalsView: View {
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager
    @State private var selected: WatchProgressItem?

    private var snapshot: DailyProgressSnapshot? {
        guard let value = store.context.dailyProgress, value.isToday else { return nil }
        return value
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    if let snapshot {
                        ProgressXDrawing(percent: snapshot.percent)
                            .frame(width: 94, height: 94)
                            .accessibilityHidden(true)
                        Text(snapshot.applicable > 0
                            ? WatchCopy.text("progress.count", snapshot.completed, snapshot.applicable)
                            : WatchCopy.text(snapshot.items?.isEmpty == false ? "progress.noCountedTasks" : "progress.noTasks"))
                            .font(.headline).monospacedDigit()
                        if let items = snapshot.items {
                            if items.isEmpty && snapshot.completed == snapshot.applicable {
                                Text(WatchCopy.text("progress.resolved")).font(.caption).foregroundStyle(.secondary)
                            }
                            ForEach(items) { item in
                                Button { selected = item } label: {
                                    HStack(spacing: 8) {
                                        Image(systemName: item.icon).frame(width: 20)
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(item.label).font(.caption).multilineTextAlignment(.leading)
                                            if let action = store.progressAction(for: item.id) {
                                                Text(WatchCopy.text(action.state == .queued ? "progress.pending" : action.state == .saved ? "progress.confirmed" : "progress.failed"))
                                                    .font(.caption2).foregroundStyle(.secondary)
                                            }
                                        }.frame(maxWidth: .infinity, alignment: .leading)
                                        Image(systemName: item.canComplete ? "checkmark.circle" : "iphone").font(.caption)
                                    }.frame(minHeight: 44)
                                }.buttonStyle(.plain)
                                Divider()
                            }
                            if items.count == 64 {
                                Text(WatchCopy.text("progress.moreOnPhone")).font(.caption2)
                            }
                        } else {
                            Text(WatchCopy.text("progress.syncHint")).font(.caption)
                        }
                    } else {
                        Text(WatchCopy.text("progress.syncHint")).font(.caption)
                    }
                    Button(WatchCopy.text("watch.retrySync")) { session.requestContext() }
                        .frame(minHeight: 44)
                }.padding(.horizontal, 4)
            }
            .navigationTitle(WatchCopy.text("progress.title"))
            .sheet(item: $selected) { item in
                ScrollView {
                    VStack(spacing: 12) {
                        Text(item.label).font(.headline)
                        if item.canComplete && store.progressAction(for: item.id) == nil {
                            Text(WatchCopy.text(item.domain == "meal" ? "progress.mealConfirmHint" : "progress.habitConfirmHint"))
                                .font(.caption)
                            Button(WatchCopy.text("progress.confirm")) {
                                if let action = store.captureProgress(item) {
                                    session.sendProgress(action)
                                    selected = nil
                                } else { session.requestContext() }
                            }.frame(minHeight: 44)
                        } else {
                            Text(WatchCopy.text(store.progressAction(for: item.id) == nil ? "progress.phoneRequired" : "progress.pendingHint"))
                                .font(.caption)
                        }
                        Button(WatchCopy.text("progress.close")) { selected = nil }.frame(minHeight: 44)
                    }.padding()
                }
            }
        }
    }
}
