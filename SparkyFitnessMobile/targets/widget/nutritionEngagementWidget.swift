import WidgetKit
import SwiftUI

private struct NutritionEngagementPayload: Decodable {
    let version: Int
    let serverConfigId: String
    let userId: String
    let day: String
    let capturedCount: Int
    let incompleteCount: Int
    let pendingSyncCount: Int
    let remoteKnown: Int
    let knownCalories: Double?
    let generatedAt: Double
}

private struct NutritionEngagementEntry: TimelineEntry {
    let date: Date
    let payload: NutritionEngagementPayload?
}

private func loadNutritionEngagementPayload() -> NutritionEngagementPayload? {
    guard let group = appGroupIdentifier(),
          let defaults = UserDefaults(suiteName: group),
          let data = defaults.data(forKey: "nutritionEngagementSnapshot"),
          let payload = try? JSONDecoder().decode(NutritionEngagementPayload.self, from: data),
          payload.version == 1,
          !payload.serverConfigId.isEmpty,
          !payload.userId.isEmpty,
          isToday(payload.day),
          payload.capturedCount >= 0,
          payload.incompleteCount >= 0,
          payload.incompleteCount <= payload.capturedCount,
          payload.pendingSyncCount >= 0,
          payload.generatedAt <= Date().timeIntervalSince1970 + 60,
          Date().timeIntervalSince1970 - payload.generatedAt <= 6 * 3600
    else { return nil }
    return payload
}

private struct NutritionEngagementProvider: TimelineProvider {
    func placeholder(in context: Context) -> NutritionEngagementEntry {
        NutritionEngagementEntry(date: .now, payload: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (NutritionEngagementEntry) -> Void) {
        completion(NutritionEngagementEntry(date: .now, payload: loadNutritionEngagementPayload()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NutritionEngagementEntry>) -> Void) {
        let now = Date()
        let nextMidnight = Calendar.current.nextDate(after: now,
            matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime)
            ?? now.addingTimeInterval(3600)
        let payload = loadNutritionEngagementPayload()
        let staleAt = payload.map { Date(timeIntervalSince1970: $0.generatedAt + 6 * 3600) }
            ?? nextMidnight
        let refreshAt = min(nextMidnight, staleAt)
        completion(Timeline(entries: [NutritionEngagementEntry(date: now,
            payload: payload)], policy: .after(refreshAt)))
    }
}

private struct NutritionEngagementView: View {
    @Environment(\.widgetFamily) private var family
    let entry: NutritionEngagementEntry

    private let photoURL = URL(string: "sparkyfitnessmobile://meal-photo")!
    private let searchURL = URL(string: "sparkyfitnessmobile://search")!

    private var status: String {
        guard let payload = entry.payload else {
            return localizedWidgetString("widget.nutrition.unavailable")
        }
        if payload.incompleteCount > 0 {
            return String(format: localizedWidgetString("widget.nutrition.review"),
                locale: widgetLocale(), payload.incompleteCount)
        }
        if payload.pendingSyncCount > 0 {
            return localizedWidgetString("widget.nutrition.savedLocally")
        }
        if payload.remoteKnown != 1 {
            return localizedWidgetString("widget.nutrition.unavailable")
        }
        return String(format: localizedWidgetString("widget.nutrition.captured"),
            locale: widgetLocale(), payload.capturedCount)
    }

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Text(localizedWidgetString("widget.nutrition.photo")).lineLimit(1)
            case .accessoryCircular:
                Link(destination: photoURL) {
                    VStack(spacing: 1) {
                        Image(systemName: "camera.fill")
                    }
                }.accessibilityLabel(localizedWidgetString("widget.meal_photo"))
            case .accessoryRectangular:
                Link(destination: photoURL) {
                    VStack(alignment: .leading, spacing: 2) {
                        Label(localizedWidgetString("widget.nutrition.name"), systemImage: "camera.fill")
                        Text(localizedWidgetString("widget.nutrition.photo"))
                            .font(.caption).lineLimit(1)
                    }
                }.accessibilityLabel(localizedWidgetString("widget.meal_photo"))
            default:
                VStack(alignment: .leading, spacing: 8) {
                    Text(localizedWidgetString("widget.nutrition.name"))
                        .font(.headline)
                    Text(status).font(.subheadline).lineLimit(2)
                    Spacer(minLength: 0)
                    if family == .systemMedium {
                        HStack(spacing: 12) {
                            Link(destination: photoURL) {
                                Label(localizedWidgetString("widget.nutrition.photo"), systemImage: "camera.fill")
                            }
                            Link(destination: searchURL) {
                                Label(localizedWidgetString("widget.nutrition.search"), systemImage: "magnifyingglass")
                            }
                        }.font(.caption).labelStyle(.titleAndIcon)
                    } else {
                        Link(destination: photoURL) {
                            Label(localizedWidgetString("widget.nutrition.photo"), systemImage: "camera.fill")
                        }.font(.caption)
                    }
                }
                .padding()
                .widgetURL(photoURL)
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct nutritionEngagementWidget: Widget {
    let kind = "nutritionEngagement"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NutritionEngagementProvider()) { entry in
            NutritionEngagementView(entry: entry)
        }
        .configurationDisplayName("widget.nutrition.name")
        .description("widget.nutrition.description")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryInline,
            .accessoryCircular, .accessoryRectangular])
    }
}
