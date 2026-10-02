import WidgetKit
import SwiftUI

struct CalorieSnapshot {
    let food: Double
    let burned: Double
    let goal: Double
    let remaining: Double
    let progress: Double
    let lastUpdated: Date?

    static let empty = CalorieSnapshot(food: 0, burned: 0, goal: 0, remaining: 0, progress: 0, lastUpdated: nil)

    var hasData: Bool { goal > 0 || food > 0 || burned > 0 }
}

private struct CalorieSnapshotPayload: Decodable {
    let date: String?
    let food: Double?
    let burned: Double?
    let goal: Double?
    let remaining: Double?
    let progress: Double?
    let lastUpdated: Double?
}

private func loadCalorieSnapshot() -> CalorieSnapshot {
    guard
        let appGroup = appGroupIdentifier(),
        !appGroup.isEmpty,
        let defaults = UserDefaults(suiteName: appGroup),
        let data = defaults.data(forKey: "calorieSnapshot"),
        let payload = try? JSONDecoder().decode(CalorieSnapshotPayload.self, from: data),
        isToday(payload.date)
    else {
        return .empty
    }
    return snapshot(from: payload)
}

private func fallbackProgress(goal: Double, remaining: Double) -> Double {
    guard goal > 0 else { return 0 }
    return min(1, max(0, (goal - remaining) / goal))
}

private func snapshot(from payload: CalorieSnapshotPayload) -> CalorieSnapshot {
    let goal = payload.goal ?? 0
    let remaining = payload.remaining ?? 0
    return CalorieSnapshot(
        food: payload.food ?? 0,
        burned: payload.burned ?? 0,
        goal: goal,
        remaining: remaining,
        progress: payload.progress ?? fallbackProgress(goal: goal, remaining: remaining),
        lastUpdated: payload.lastUpdated.map { Date(timeIntervalSince1970: $0) }
    )
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let snapshot: CalorieSnapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(SimpleEntry(date: Date(), snapshot: loadCalorieSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let now = Date()
        let entry = SimpleEntry(date: now, snapshot: loadCalorieSnapshot())
        let in15Minutes = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now
        let nextMidnight = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? in15Minutes
        let refreshAt = min(in15Minutes, nextMidnight)
        completion(Timeline(entries: [entry], policy: .after(refreshAt)))
    }
}

private struct CalorieRing: View {
    @Environment(\.widgetRenderingMode) private var mode
    let progress: Double
    let size: CGFloat
    let strokeWidth: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    widgetColor(WidgetPalette.track, mode: mode).opacity(mode == .fullColor ? 1 : 0.15),
                    style: StrokeStyle(lineWidth: strokeWidth)
                )
            Circle()
                .trim(from: 0, to: CGFloat(progress))
                .stroke(
                    widgetColor(WidgetPalette.energy, mode: mode),
                    style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .modifier(WidgetNeonStroke(color: WidgetPalette.energy))
                .widgetAccentable()
        }
        .frame(width: size, height: size)
    }
}

private struct RingWithLabel: View {
    let snapshot: CalorieSnapshot
    let ringSize: CGFloat
    let strokeWidth: CGFloat
    let numberFontSize: CGFloat

    private var remainingText: String {
        guard snapshot.hasData else { return "-" }
        return localizedNumberString(snapshot.remaining)
    }

    var body: some View {
        CalorieRing(progress: snapshot.progress, size: ringSize, strokeWidth: strokeWidth)
            .overlay(
                VStack(spacing: 0) {
                    Text(remainingText)
                        .font(.system(size: numberFontSize, weight: .bold, design: .rounded))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text(localizedWidgetString("widget.kcal_left"))
                        .font(.caption2)
                        .modifier(WidgetTextStyle(secondary: true))
                }
                .padding(.horizontal, strokeWidth)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(
                    String(
                        format: localizedWidgetString("widget.a11y.kcal_left"),
                        remainingText
                    )
                )
            )
    }
}

private struct StatBlock: View {
    let label: String
    let value: Double

    private var valueText: String {
        localizedNumberString(value)
    }

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.caption2)
                .modifier(WidgetTextStyle(secondary: true))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Spacer(minLength: 0)
            Text(valueText)
                .font(.caption.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

struct ActionButton: View {
    let icon: String
    let destination: URL
    let accessibilityLabel: String

    var body: some View {
        Link(destination: destination) {
            Image(systemName: icon)
                .font(.body.weight(.semibold))
                .modifier(WidgetActionStyle())
                .contentShape(Rectangle())
        }
        .accessibilityLabel(accessibilityLabel)
    }
}

struct widgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.dynamicTypeSize) private var typeSize
    var entry: Provider.Entry

    var body: some View {
        Group {
            if family == .systemSmall { smallBody } else { mediumBody }
        }
        .modifier(WidgetTextStyle())
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .widgetURL(URL(string: "sparkyfitnessmobile://"))
    }

    private var smallBody: some View {
        VStack(spacing: 3) {
            WidgetTitle(title: localizedWidgetString("widget.calorie.name"))
            if !typeSize.isAccessibilitySize {
                RingWithLabel(snapshot: entry.snapshot, ringSize: 62, strokeWidth: 6, numberFontSize: 17)
            } else {
                Text(entry.snapshot.hasData ? localizedNumberString(entry.snapshot.remaining) : "-")
                    .font(.title3.bold()).monospacedDigit()
                Text(localizedWidgetString("widget.kcal_left")).font(.caption2)
            }
            VStack(spacing: 2) {
                StatBlock(label: localizedWidgetString("widget.food"), value: entry.snapshot.food)
                StatBlock(label: localizedWidgetString("widget.burned"), value: entry.snapshot.burned)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var mediumBody: some View {
        VStack(spacing: 6) {
            HStack(spacing: 14) {
                if !typeSize.isAccessibilitySize {
                    RingWithLabel(snapshot: entry.snapshot, ringSize: 70, strokeWidth: 6, numberFontSize: 19)
                }
                VStack(alignment: .leading, spacing: 3) {
                    WidgetTitle(title: localizedWidgetString("widget.calorie.name"))
                    if typeSize.isAccessibilitySize {
                        Text((entry.snapshot.hasData ? localizedNumberString(entry.snapshot.remaining) : "-") + " " + localizedWidgetString("widget.kcal_left"))
                            .font(.caption.weight(.semibold)).monospacedDigit()
                    }
                    StatBlock(label: localizedWidgetString("widget.goal"), value: entry.snapshot.goal)
                    StatBlock(label: localizedWidgetString("widget.food"), value: entry.snapshot.food)
                StatBlock(label: localizedWidgetString("widget.burned"), value: entry.snapshot.burned)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: .infinity)
            WidgetShortcuts()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct widget: Widget {
    let kind: String = "widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            widgetEntryView(entry: entry)
                .containerBackground(for: .widget) { WidgetSurface() }
        }
        .configurationDisplayName("widget.calorie.name")
        .description("widget.calorie.description")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#if DEBUG
    #Preview(as: .systemSmall) {
        widget()
    } timeline: {
        SimpleEntry(
            date: .now,
            snapshot: CalorieSnapshot(food: 1540, burned: 255, goal: 3055, remaining: 1515, progress: 0.5, lastUpdated: .now)
        )
        SimpleEntry(date: .now, snapshot: .empty)
    }

    #Preview(as: .systemMedium) {
        widget()
    } timeline: {
        SimpleEntry(
            date: .now,
            snapshot: CalorieSnapshot(food: 1540, burned: 255, goal: 3055, remaining: 1515, progress: 0.5, lastUpdated: .now)
        )
        SimpleEntry(date: .now, snapshot: .empty)
    }
#endif
