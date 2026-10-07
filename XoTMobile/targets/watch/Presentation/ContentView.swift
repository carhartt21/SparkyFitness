import SwiftUI

/// Account sync gates new captures; weight entry is optional. Daily goals,
/// nutrition, water, food, workout, entry and trend are swipeable pages.
struct ContentView: View {
    /// Identifies a page; the cases are `.tag` values, nothing more.
    ///
    /// Swipe order is set by the order the views appear in the `TabView`
    /// below, NOT by the order of these cases — a `.page`-style TabView lays
    /// its children out in body order. Reordering this enum alone changes
    /// nothing on screen. Keep the tag identities stable when moving a page.
    private enum Page: Int { case progress, goals, workout, water, food, entry, trend }

    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager

    /// Watched so the app can notice a day has ended while it was away. The
    /// watch app commonly stays resident overnight, in which case nothing
    /// else would prompt it to re-check — `onAppear` doesn't fire again on a
    /// return to an app that never went away.
    @Environment(\.scenePhase) private var scenePhase

    /// Explicit navigation wins over the default daily-goals page.
    @State private var page: Page?

    var body: some View {
        Group {
            if store.needsFirstRunEntry && store.context.workout == nil && !store.canCaptureActions {
                VStack(spacing: 8) {
                    Text(WatchCopy.text("watch.syncPhone"))
                        .font(.caption)
                        .multilineTextAlignment(.center)
                    Button(WatchCopy.text("watch.retrySync")) { session.requestContext() }
                }
            } else {
                // Daily goals ▸ Nutrition ▸ Water ▸ Food ▸ Workout ▸ Entry ▸ Trend.
                TabView(selection: Binding(get: { page ?? initialPage }, set: { page = $0 })) {
                    DailyGoalsView()
                        .tag(Page.progress)

                    GoalSummaryView()
                        .tag(Page.goals)

                    WaterIntakeView()
                        .tag(Page.water)

                    FoodQuickLogView()
                        .tag(Page.food)

                    WorkoutView()
                        .tag(Page.workout)

                    CheckInEntryView { page = .trend }
                        .tag(Page.entry)

                    TrendView()
                        .tag(Page.trend)
                }
                .tabViewStyle(.page(indexDisplayMode: .automatic))
            }
        }
        .onAppear {
            store.pruneStaleDayData()
            // Cheap, local, and works with the phone out of range — unlike
            // `requestContext()` below, which needs it reachable right now.
            session.adoptReceivedContext()
            session.requestContext()
            session.retryPending()
            // Publish what the watch already knows before waiting on the
            // phone: `requestContext()` above only reaches a phone that's
            // reachable right now, and until it answers the complications
            // would otherwise have nothing to draw from — even though the
            // app's own pages are happily showing the persisted context.
            session.refreshComplications()
        }
        // The case `onAppear` misses: the app was never torn down, just put
        // away for the night, so the only signal that a new day started is
        // coming back to the foreground.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            store.pruneStaleDayData()
            // Cheap, local, and works with the phone out of range — unlike
            // `requestContext()` below, which needs it reachable right now.
            session.adoptReceivedContext()
            session.requestContext()
            session.refreshComplications()
        }
        .onOpenURL { url in
            guard let link = WatchDeepLink(url: url),
                  let requested = destination(for: link)
            else { return }
            // A complication opens its own destination without requiring weighing.
            page = requested
        }
    }

    /// Which page a complication tap lands on. Nil for a destination this build
    /// has no page for, so an early link does nothing instead of jumping
    /// somewhere wrong.
    private func destination(for link: WatchDeepLink) -> Page? {
        switch link {
        case .progress:
            return .progress
        case .goals:
            return .goals
        case .water:
            return .water
        }
    }

    /// An active workout should be reachable immediately, even when the Watch
    /// has not yet received its first weight check-in.
    private var initialPage: Page {
        if store.context.workout != nil { return .workout }
        return .progress
    }
}

/// One-time screen used when there is no seed value. From the second entry
/// onwards it is the Digital Crown forever.
struct FirstRunEntryView: View {
    /// Always kg, regardless of `unit` below — same contract as everywhere
    /// else that hands a weight to `CheckInStore`.
    let onSave: (Double, Double?) -> Void

    @EnvironmentObject private var store: CheckInStore
    @State private var weightText = ""
    @State private var bodyFatText = ""
    @State private var entryUnit: WeightUnit?

    /// Keep the unit printed beside a typed number fixed for this form.
    /// A later phone context must not reinterpret an unfinished value.
    private var unit: WeightUnit { entryUnit ?? store.context.effectiveWeightUnit }

    private var parsedWeightKg: Double? {
        guard let weight = parse(weightText) else { return nil }
        let weightKg = unit.toKg(weight)
        return CheckInInputBounds.weightKg.contains(weightKg) ? weightKg : nil
    }

    private var parsedBodyFat: Double? {
        guard let bodyFat = parse(bodyFatText) else { return nil }
        return CheckInInputBounds.bodyFatPercentage.contains(bodyFat) ? bodyFat : nil
    }

    private var bodyFatIsValid: Bool {
        bodyFatText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || parsedBodyFat != nil
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text(WatchCopy.text("watch.firstEntry"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(WatchCopy.text("watch.firstEntryHint"))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                TextField(WatchCopy.text("watch.weightUnit", unit.suffix), text: $weightText)
                TextField(WatchCopy.text("watch.bodyFatOptional"), text: $bodyFatText)

                if !weightText.isEmpty && parsedWeightKg == nil {
                    Text(WatchCopy.text("watch.invalidWeight"))
                        .font(.caption2)
                        .foregroundStyle(.orange)
                } else if !bodyFatIsValid {
                    Text(WatchCopy.text("watch.invalidFat"))
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }

                Button(WatchCopy.text("watch.save")) {
                    guard let weightKg = parsedWeightKg, bodyFatIsValid else { return }
                    onSave(weightKg, parsedBodyFat)
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(Neon.accentText)
                .disabled(parsedWeightKg == nil || !bodyFatIsValid || !store.canCaptureActions)
            }
            .padding(.horizontal, 4)
        }
        .onAppear {
            if entryUnit == nil { entryUnit = store.context.effectiveWeightUnit }
        }
    }

    private func parse(_ value: String) -> Double? {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard let parsed = Double(normalized), parsed.isFinite else { return nil }
        return parsed
    }
}
