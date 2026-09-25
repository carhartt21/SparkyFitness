import WidgetKit
import SwiftUI

private struct RoutinePayload: Decodable {
    let version: Int
    let scope: String
    let total: Int
    let generatedAt: Double
}

private struct RoutineEntry: TimelineEntry {
    let date: Date
    let total: Int?
}

private func loadRoutinePayload() -> RoutinePayload? {
    guard let group = appGroupIdentifier(),
          let defaults = UserDefaults(suiteName: group),
          let scope = defaults.string(forKey: "routineWidgetScope"),
          let data = defaults.data(forKey: "routineWidgetSnapshot"),
          let payload = try? JSONDecoder().decode(RoutinePayload.self, from: data),
          payload.version == 1,
          !scope.isEmpty,
          payload.scope == scope,
          payload.total >= 0,
          payload.generatedAt <= Date().timeIntervalSince1970 + 60,
          Date().timeIntervalSince1970 - payload.generatedAt <= 24 * 3600
    else { return nil }
    return payload
}

private struct RoutineProvider: TimelineProvider {
    func placeholder(in context: Context) -> RoutineEntry {
        RoutineEntry(date: .now, total: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (RoutineEntry) -> Void) {
        completion(RoutineEntry(date: .now, total: loadRoutinePayload()?.total))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RoutineEntry>) -> Void) {
        let now = Date()
        let payload = loadRoutinePayload()
        let next = payload.map { Date(timeIntervalSince1970: $0.generatedAt + 24 * 3600) }
            ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: [RoutineEntry(date: now, total: payload?.total)],
            policy: .after(next)))
    }
}

private struct RoutineView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RoutineEntry

    private let routinesURL = URL(string: "sparkyfitnessmobile://routines")!

    private var summary: String {
        guard let total = entry.total else {
            return localizedWidgetString("widget.routine.unavailable")
        }
        if total == 0 {
            return localizedWidgetString("widget.routine.empty")
        }
        let countFormat = total == 1
            ? localizedWidgetString("widget.routine.one")
            : localizedWidgetString("widget.routine.count")
        return String(format: countFormat,
            locale: widgetLocale(), total)
    }

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Text(localizedWidgetString("widget.routine.open")).lineLimit(1)
            case .accessoryCircular:
                Image(systemName: "list.bullet")
                    .accessibilityLabel(localizedWidgetString("widget.routine.open"))
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Label(localizedWidgetString("widget.routine.name"),
                        systemImage: "list.bullet")
                    Text(localizedWidgetString("widget.routine.open"))
                        .font(.caption).lineLimit(1)
                }
            default:
                VStack(alignment: .leading, spacing: 8) {
                    Label(localizedWidgetString("widget.routine.name"),
                        systemImage: "list.bullet")
                        .font(.headline)
                    Text(summary).font(.subheadline).lineLimit(2)
                    Spacer(minLength: 0)
                    Text(localizedWidgetString("widget.routine.open"))
                        .font(.caption)
                }
                .padding()
            }
        }
        .widgetURL(routinesURL)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct routineWidget: Widget {
    let kind = "routineWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RoutineProvider()) { entry in
            RoutineView(entry: entry)
        }
        .configurationDisplayName("widget.routine.name")
        .description("widget.routine.description")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryInline,
            .accessoryCircular, .accessoryRectangular])
    }
}
