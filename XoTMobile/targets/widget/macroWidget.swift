import WidgetKit
import SwiftUI

struct MacroSnapshot {
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let caloriesConsumed: Double
    let lastUpdated: Date?

    var proteinKcal: Double { proteinGrams * 4 }
    var carbsKcal:   Double { carbsGrams   * 4 }
    var fatKcal:     Double { fatGrams     * 9 }
    var macroKcalTotal: Double { proteinKcal + carbsKcal + fatKcal }
    var hasData: Bool { macroKcalTotal > 0 || caloriesConsumed > 0 }

    static let empty = MacroSnapshot(
        proteinGrams: 0, carbsGrams: 0, fatGrams: 0,
        caloriesConsumed: 0, lastUpdated: nil
    )
}

private struct MacroSnapshotPayload: Decodable {
    let date: String?
    let protein: Double?
    let carbs: Double?
    let fat: Double?
    let calories: Double?
    let lastUpdated: Double?
}

private func loadMacroSnapshot() -> MacroSnapshot {
    guard
        let appGroup = appGroupIdentifier(),
        !appGroup.isEmpty,
        let defaults = UserDefaults(suiteName: appGroup),
        let data = defaults.data(forKey: "macroSnapshot"),
        let payload = try? JSONDecoder().decode(MacroSnapshotPayload.self, from: data),
        isToday(payload.date)
    else {
        return .empty
    }
    return MacroSnapshot(
        proteinGrams: payload.protein ?? 0,
        carbsGrams: payload.carbs ?? 0,
        fatGrams: payload.fat ?? 0,
        caloriesConsumed: payload.calories ?? 0,
        lastUpdated: payload.lastUpdated.map { Date(timeIntervalSince1970: $0) }
    )
}

struct MacroEntry: TimelineEntry {
    let date: Date
    let snapshot: MacroSnapshot
}

struct MacroProvider: TimelineProvider {
    func placeholder(in context: Context) -> MacroEntry {
        MacroEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (MacroEntry) -> Void) {
        completion(MacroEntry(date: Date(), snapshot: loadMacroSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MacroEntry>) -> Void) {
        let now = Date()
        let entry = MacroEntry(date: now, snapshot: loadMacroSnapshot())
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

private struct MacroRing: View {
    @Environment(\.widgetRenderingMode) private var mode
    let snapshot: MacroSnapshot
    let size: CGFloat
    let strokeWidth: CGFloat

    private static let segmentGap: Double = 0.006

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    widgetColor(WidgetPalette.track, mode: mode).opacity(mode == .fullColor ? 1 : 0.15),
                    style: StrokeStyle(lineWidth: strokeWidth)
                )

            if snapshot.hasData && snapshot.macroKcalTotal > 0 {
                let total = snapshot.macroKcalTotal
                let proteinFrac = snapshot.proteinKcal / total
                let carbsFrac = snapshot.carbsKcal / total
                let fatFrac = snapshot.fatKcal / total

                segment(
                    start: 0,
                    length: proteinFrac,
                    color: WidgetPalette.protein
                )
                segment(
                    start: proteinFrac,
                    length: carbsFrac,
                    color: WidgetPalette.carbs
                )
                segment(
                    start: proteinFrac + carbsFrac,
                    length: fatFrac,
                    color: WidgetPalette.fat
                )
            }
        }
        .frame(width: size, height: size)
    }

    @ViewBuilder
    private func segment(start: Double, length: Double, color: Color) -> some View {
        let gap = Self.segmentGap
        let from = CGFloat(start + gap / 2)
        let to = CGFloat(start + max(0, length - gap / 2))
        if to > from {
            Circle()
                .trim(from: from, to: to)
                .stroke(
                    widgetColor(color, mode: mode),
                    style: StrokeStyle(lineWidth: strokeWidth, lineCap: .butt)
                )
                .rotationEffect(.degrees(-90))
                .modifier(WidgetNeonStroke(color: color))
                .widgetAccentable()
        }
    }
}

private struct MacroRingWithLabel: View {
    let snapshot: MacroSnapshot
    let ringSize: CGFloat
    let strokeWidth: CGFloat
    let numberFontSize: CGFloat

    private var centerText: String {
        guard snapshot.hasData else { return "-" }
        return localizedNumberString(snapshot.caloriesConsumed)
    }

    var body: some View {
        MacroRing(snapshot: snapshot, size: ringSize, strokeWidth: strokeWidth)
            .overlay(
                VStack(spacing: 0) {
                    Text(centerText)
                        .font(.system(size: numberFontSize, weight: .bold, design: .rounded))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text(localizedWidgetString("widget.kcal"))
                        .font(.caption2)
                        .modifier(WidgetTextStyle(secondary: true))
                }
                .padding(.horizontal, strokeWidth)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(
                    String(
                        format: localizedWidgetString("widget.a11y.kcal"),
                        centerText
                    )
                )
            )
    }
}

private struct MacroRow: View {
    @Environment(\.widgetRenderingMode) private var mode
    let label: String
    let grams: Double
    let color: Color

    private var valueText: String {
        String(
            format: localizedWidgetString("widget.grams"),
            localizedNumberString(grams)
        )
    }

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(widgetColor(color, mode: mode))
                .frame(width: 8, height: 8)
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

struct macroWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.dynamicTypeSize) private var typeSize
    var entry: MacroProvider.Entry

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
            WidgetTitle(title: localizedWidgetString("widget.macro.name"))
            if !typeSize.isAccessibilitySize {
                MacroRingWithLabel(snapshot: entry.snapshot, ringSize: 52, strokeWidth: 6, numberFontSize: 17)
            } else {
                Text(entry.snapshot.hasData ? localizedNumberString(entry.snapshot.caloriesConsumed) : "-")
                    .font(.title3.bold()).monospacedDigit()
                Text(localizedWidgetString("widget.kcal")).font(.caption2)
            }
            VStack(spacing: 2) {
                MacroRow(label: localizedWidgetString("widget.protein"), grams: entry.snapshot.proteinGrams, color: WidgetPalette.protein)
                MacroRow(label: localizedWidgetString("widget.carbs"), grams: entry.snapshot.carbsGrams, color: WidgetPalette.carbs)
                MacroRow(label: localizedWidgetString("widget.fat"), grams: entry.snapshot.fatGrams, color: WidgetPalette.fat)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var mediumBody: some View {
        VStack(spacing: 6) {
            HStack(spacing: 14) {
                if !typeSize.isAccessibilitySize {
                    MacroRingWithLabel(snapshot: entry.snapshot, ringSize: 70, strokeWidth: 6, numberFontSize: 19)
                }
                VStack(alignment: .leading, spacing: 3) {
                    WidgetTitle(title: localizedWidgetString("widget.macro.name"))
                    if typeSize.isAccessibilitySize {
                        Text((entry.snapshot.hasData ? localizedNumberString(entry.snapshot.caloriesConsumed) : "-") + " " + localizedWidgetString("widget.kcal"))
                            .font(.caption.weight(.semibold)).monospacedDigit()
                    }
                    MacroRow(label: localizedWidgetString("widget.protein"), grams: entry.snapshot.proteinGrams, color: WidgetPalette.protein)
                MacroRow(label: localizedWidgetString("widget.carbs"), grams: entry.snapshot.carbsGrams, color: WidgetPalette.carbs)
                MacroRow(label: localizedWidgetString("widget.fat"), grams: entry.snapshot.fatGrams, color: WidgetPalette.fat)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: .infinity)
            WidgetShortcuts()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct macroWidget: Widget {
    let kind: String = "macroWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MacroProvider()) { entry in
            macroWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { WidgetSurface() }
        }
        .configurationDisplayName("widget.macro.name")
        .description("widget.macro.description")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#if DEBUG
    #Preview(as: .systemSmall) {
        macroWidget()
    } timeline: {
        MacroEntry(
            date: .now,
            snapshot: MacroSnapshot(proteinGrams: 92, carbsGrams: 180, fatGrams: 55, caloriesConsumed: 1540, lastUpdated: .now)
        )
        MacroEntry(date: .now, snapshot: .empty)
    }

    #Preview(as: .systemMedium) {
        macroWidget()
    } timeline: {
        MacroEntry(
            date: .now,
            snapshot: MacroSnapshot(proteinGrams: 92, carbsGrams: 180, fatGrams: 55, caloriesConsumed: 1540, lastUpdated: .now)
        )
        MacroEntry(date: .now, snapshot: .empty)
    }
#endif
