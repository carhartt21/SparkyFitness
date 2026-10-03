import WidgetKit
import SwiftUI

/// Mirrors the `EnergySnapshot` type `ComplicationPublisher` (targets/watch) encodes —
/// four fractions, each already clamped to 0...1 by the phone.
struct EnergyGoalSnapshot {
    let calorieGoalProgress: Double
    let proteinGoalProgress: Double
    let carbsGoalProgress: Double
    let fatGoalProgress: Double

    static let empty = EnergyGoalSnapshot(
        calorieGoalProgress: 0,
        proteinGoalProgress: 0,
        carbsGoalProgress: 0,
        fatGoalProgress: 0
    )
}

private struct EnergyGoalSnapshotPayload: ScopedDaySnapshot {
    let scope: String?
    let date: String?
    let calorieGoalProgress: Double?
    let proteinGoalProgress: Double?
    let carbsGoalProgress: Double?
    let fatGoalProgress: Double?
}

private func loadEnergyGoalSnapshot() -> EnergyGoalSnapshot {
    guard
        let payload = ComplicationSnapshotStore.load(
            EnergyGoalSnapshotPayload.self,
            key: "energyGoalSnapshot"
        )
    else { return .empty }
    return EnergyGoalSnapshot(
        calorieGoalProgress: payload.calorieGoalProgress ?? 0,
        proteinGoalProgress: payload.proteinGoalProgress ?? 0,
        carbsGoalProgress: payload.carbsGoalProgress ?? 0,
        fatGoalProgress: payload.fatGoalProgress ?? 0
    )
}

struct EnergyGoalEntry: TimelineEntry {
    let date: Date
    let snapshot: EnergyGoalSnapshot
}

struct EnergyGoalProvider: TimelineProvider {
    func placeholder(in context: Context) -> EnergyGoalEntry {
        EnergyGoalEntry(
            date: Date(),
            snapshot: EnergyGoalSnapshot(
                calorieGoalProgress: 0.6,
                proteinGoalProgress: 0.8,
                carbsGoalProgress: 0.5,
                fatGoalProgress: 0.3
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (EnergyGoalEntry) -> Void) {
        completion(EnergyGoalEntry(date: Date(), snapshot: loadEnergyGoalSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EnergyGoalEntry>) -> Void) {
        let now = Date()
        let entry = EnergyGoalEntry(date: now, snapshot: loadEnergyGoalSnapshot())
        // Same refresh cadence as the iOS calorie/macro widgets.
        let refreshAt = ComplicationSnapshotStore.nextRefresh(after: now)
        completion(Timeline(entries: [entry], policy: .after(refreshAt)))
    }
}

/// Mirror of `GoalPalette` in targets/watch — separate compiled targets can't
/// share a constant, so if one changes, change both.
private enum ComplicationPalette {
    // The phone's categorical nutrition tokens: neutral calories #B4C8D2,
    // fat #F5B647, carbs #B59CFF and protein #57B9F8. These identify nutrients,
    // not a good/bad progress rating. Keep the app GoalPalette in sync.
    static let calories = Color(red: 180.0 / 255, green: 200.0 / 255, blue: 210.0 / 255)
    static let fat = Color(red: 245.0 / 255, green: 182.0 / 255, blue: 71.0 / 255)
    static let carbs = Color(red: 181.0 / 255, green: 156.0 / 255, blue: 1)
    static let protein = Color(red: 87.0 / 255, green: 185.0 / 255, blue: 248.0 / 255)
}

/// Inner ring: a single full-circle progress trim for the calorie goal.
/// Reaching or passing the goal (progress == 1) draws a complete circle.
private struct CalorieRing: View {
    let progress: Double
    let size: CGFloat
    let strokeWidth: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.secondary.opacity(0.25), style: StrokeStyle(lineWidth: strokeWidth))
            Circle()
                .trim(from: 0, to: CGFloat(progress))
                .stroke(
                    ComplicationPalette.calories,
                    style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
        }
        // Half the stroke, because a stroke straddles its path — see the
        // matching note in MacroGoalRing. Applied here too even though this
        // ring sits well inside the container and was never clipped: once the
        // outer ring is inset inward, an un-inset inner ring would collide
        // with it.
        .padding(strokeWidth / 2)
        .frame(width: size, height: size)
    }
}

/// Outer ring: three FIXED equal thirds (120° each) — fat, carbs, protein, in
/// that clockwise order starting from 12 o'clock. Each third independently
/// fills 0...100% of its own goal within its own 120° allotment; this is
/// deliberately not proportional to the macros' relative gram/kcal amounts
/// (that's the different composition-ring concept the iOS macroWidget uses).
private struct MacroGoalRing: View {
    let snapshot: EnergyGoalSnapshot
    let size: CGFloat
    let strokeWidth: CGFloat

    /// Visual gap between the three sections, as a fraction of a full turn.
    /// Has to clear the `.round` line caps before any daylight actually shows:
    /// each cap extends about strokeWidth/2 along the arc — roughly 0.0175 of
    /// the circumference at this ring's proportions — so the two caps facing
    /// each other across a gap swallow ~0.035 of it between them. The original
    /// 0.01 was entirely inside that, which is why the sections read as one
    /// continuous ring.
    private static let sectionGap: Double = 0.055
    private static let third: Double = 1.0 / 3.0

    var body: some View {
        ZStack {
            trackSection(start: 0)
            trackSection(start: Self.third)
            trackSection(start: 2 * Self.third)

            section(start: 0, filled: snapshot.fatGoalProgress, color: ComplicationPalette.fat)
            section(start: Self.third, filled: snapshot.carbsGoalProgress, color: ComplicationPalette.carbs)
            section(start: 2 * Self.third, filled: snapshot.proteinGoalProgress, color: ComplicationPalette.protein)
        }
        // Inset by half the stroke, because a stroke straddles the path it's
        // drawn on. This ring's frame is the full complication width, so
        // without the inset its outer half fell outside the frame and
        // accessoryCircular — which clips to a circle — cut it away: the ring
        // was rendering at half its intended thickness with the round caps
        // sliced lengthwise. The gap to the inner ring is unchanged, since
        // CalorieRing is inset by the same amount.
        .padding(strokeWidth / 2)
        .frame(width: size, height: size)
    }

    /// The dim full-width background for one 120° section, so an unfilled
    /// section still reads as "a section", not empty space.
    @ViewBuilder
    private func trackSection(start: Double) -> some View {
        let gap = Self.sectionGap
        Circle()
            .trim(from: CGFloat(start + gap / 2), to: CGFloat(start + Self.third - gap / 2))
            .stroke(
                Color.secondary.opacity(0.25),
                style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round)
            )
            .rotationEffect(.degrees(-90))
    }

    /// The filled progress within one 120° section, scaled by that macro's
    /// own goal progress — a full section means 100% of that macro's goal.
    @ViewBuilder
    private func section(start: Double, filled: Double, color: Color) -> some View {
        let gap = Self.sectionGap
        let usable = Self.third - gap
        let length = usable * max(0, min(1, filled))
        let from = start + gap / 2
        let to = from + length
        if length > 0 {
            Circle()
                .trim(from: CGFloat(from), to: CGFloat(to))
                .stroke(color, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

private struct EnergyGoalRings: View {
    let snapshot: EnergyGoalSnapshot

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            let outerStroke = side * 0.11
            let innerStroke = side * 0.11
            let outerSize = side
            let innerSize = side - outerStroke * 2 - side * 0.06

            ZStack {
                MacroGoalRing(snapshot: snapshot, size: outerSize, strokeWidth: outerStroke)
                CalorieRing(progress: snapshot.calorieGoalProgress, size: innerSize, strokeWidth: innerStroke)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }
}

private func percentText(_ fraction: Double) -> String {
    "\(Int((max(0, min(1, fraction)) * 100).rounded()))%"
}

struct EnergyGoalComplicationEntryView: View {
    var entry: EnergyGoalProvider.Entry

    var body: some View {
        // Bare ring, no visible text — Adam's choice, to keep the watch face
        // uncluttered. Everything still reaches VoiceOver/Assistive Access
        // through the accessibility label below.
        EnergyGoalRings(snapshot: entry.snapshot)
            // Tapping the complication opens the watch app on its Goals page
            // rather than wherever the app was last left.
            .widgetURL(ComplicationLink.goals.url)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(
                ProgressCopy.text("energy.accessibility",
                    percentText(entry.snapshot.calorieGoalProgress),
                    percentText(entry.snapshot.fatGoalProgress),
                    percentText(entry.snapshot.carbsGoalProgress),
                    percentText(entry.snapshot.proteinGoalProgress))
            )
    }
}

struct EnergyGoalComplication: Widget {
    // Must match ComplicationPublisher's Energy.kind (targets/watch).
    let kind: String = "energyGoalComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: EnergyGoalProvider()) { entry in
            EnergyGoalComplicationEntryView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName(ProgressCopy.text("energy.configuration"))
        .description(ProgressCopy.text("energy.description"))
        .supportedFamilies([.accessoryCircular])
    }
}

#if DEBUG
    #Preview(as: .accessoryCircular) {
        EnergyGoalComplication()
    } timeline: {
        EnergyGoalEntry(
            date: .now,
            snapshot: EnergyGoalSnapshot(
                calorieGoalProgress: 0.65,
                proteinGoalProgress: 1,
                carbsGoalProgress: 0.4,
                fatGoalProgress: 0.7
            )
        )
        EnergyGoalEntry(date: .now, snapshot: .empty)
    }
#endif
