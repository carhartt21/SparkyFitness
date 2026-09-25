import SwiftUI

/// Router for the watch app. First run is a one-time gate; after that, Goals,
/// Workout, Water, Entry and Trend are pages the wearer swipes between — swiping is
/// the only way to move between them, there is no button.
struct ContentView: View {
    /// Identifies a page; the cases are `.tag` values, nothing more.
    ///
    /// Swipe order is set by the order the views appear in the `TabView`
    /// below, NOT by the order of these cases — a `.page`-style TabView lays
    /// its children out in body order. Reordering this enum alone changes
    /// nothing on screen, so change both together or neither.
    private enum Page: Int { case goals, workout, water, entry, trend }

    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager

    /// Watched so the app can notice a day has ended while it was away. The
    /// watch app commonly stays resident overnight, in which case nothing
    /// else would prompt it to re-check — `onAppear` doesn't fire again on a
    /// return to an app that never went away.
    @Environment(\.scenePhase) private var scenePhase

    /// Latches true the moment first-run completes this session, so a
    /// mid-session context update from the phone can't flicker the gate back
    /// on. `page` follows the same "nil until something explicit happens"
    /// pattern so a fresh launch still lands on the right page.
    @State private var didFirstRun = false
    @State private var page: Page?

    var body: some View {
        Group {
            if !didFirstRun && store.needsFirstRunEntry && store.context.workout == nil && !store.canCaptureActions {
                VStack(spacing: 8) {
                    Text("Open X on Track on your phone to sync this Watch")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                    Button("Retry sync") { session.requestContext() }
                }
            } else if !didFirstRun && store.needsFirstRunEntry && store.context.workout == nil {
                FirstRunEntryView { weight, bodyFat in
                    guard let checkIn = store.capture(weightKg: weight, bodyFatPercentage: bodyFat) else { return }
                    store.markState(session.send(checkIn), for: checkIn)
                    didFirstRun = true
                    page = .trend
                }
            } else {
                // This order is the swipe order: Goals ▸ Workout ▸ Water ▸ Entry ▸ Trend.
                TabView(selection: Binding(get: { page ?? initialPage }, set: { page = $0 })) {
                    GoalSummaryView()
                        .tag(Page.goals)

                    WorkoutView()
                        .tag(Page.workout)

                    WaterIntakeView()
                        .tag(Page.water)

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
            // Deliberately does not touch `didFirstRun`: if there is no seed
            // weight yet, that one-time entry is still owed after the active
            // workout ends.
            page = requested
        }
    }

    /// Which page a complication tap lands on. Nil for a destination this build
    /// has no page for, so an early link does nothing instead of jumping
    /// somewhere wrong.
    private func destination(for link: WatchDeepLink) -> Page? {
        switch link {
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
        return store.isReplacingToday ? .goals : .entry
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
                Text("First check-in")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Type today's numbers once — after this the Digital Crown starts from your last value.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                TextField("Weight \(unit.suffix)", text: $weightText)
                TextField("Body fat % (optional)", text: $bodyFatText)

                if !weightText.isEmpty && parsedWeightKg == nil {
                    Text("Enter a valid weight")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                } else if !bodyFatIsValid {
                    Text("Body fat must be 0–100%")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }

                Button("Save") {
                    guard let weightKg = parsedWeightKg, bodyFatIsValid else { return }
                    onSave(weightKg, parsedBodyFat)
                }
                .buttonStyle(.borderedProminent)
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
