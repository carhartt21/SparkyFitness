import SwiftUI
import WatchKit

/// Fast logging from the phone's saved and recently used foods. The phone
/// remains responsible for the authenticated write and its nutrition snapshot.
struct FoodQuickLogView: View {
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager
    @State private var selectedMealTypeId = ""
    /// The row just tapped, shown with a checkmark for a moment so the
    /// wearer can see which food went in without reading the queue below.
    @State private var justAddedId: String?

    private var shortcuts: [WatchFoodShortcut] { store.context.foodShortcuts ?? [] }
    private var mealTypes: [WatchMealType] { store.context.mealTypes ?? [] }
    private var selectedMealName: String {
        mealTypes.first(where: { $0.id == selectedMealTypeId })?.name ?? "Meal"
    }
    private var canAdd: Bool { store.canCaptureActions && !selectedMealTypeId.isEmpty }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Add food")
                    .font(.system(.headline, design: .rounded))
                if mealTypes.isEmpty || shortcuts.isEmpty {
                    Text("Open X on Track on your phone to sync favorite and recent foods.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Retry sync") { session.requestContext() }
                } else {
                    mealChips
                    foodSection("Favorites", systemImage: "star.fill", group: "favorite")
                    foodSection("Recently used", systemImage: "clock", group: "recent")
                }
                pendingSection
            }
            .padding(.horizontal, 4)
            // Keeps the last row clear of the page dots.
            .padding(.bottom, 18)
        }
        .onAppear { setInitialMeal() }
        .onChange(of: store.context.defaultMealTypeId) { _, _ in setInitialMeal() }
        .onChange(of: store.context.mealTypes) { _, _ in setInitialMeal() }
    }

    // MARK: - Meal

    /// One tap per meal instead of a wheel picker, which a scrolling page
    /// squeezes to a single clipped row.
    private var mealChips: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(mealTypes) { meal in
                        let selected = meal.id == selectedMealTypeId
                        Button {
                            guard !selected else { return }
                            WKInterfaceDevice.current().play(.click)
                            selectedMealTypeId = meal.id
                            withAnimation { proxy.scrollTo(meal.id, anchor: .center) }
                        } label: {
                            Text(meal.name)
                                .font(.system(size: 13, weight: selected ? .semibold : .regular))
                                .lineLimit(1)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .foregroundStyle(selected ? Color.black : Color.primary)
                                .background(
                                    Capsule().fill(
                                        selected ? GoalPalette.calories : Color.white.opacity(0.14)
                                    )
                                )
                        }
                        .buttonStyle(.plain)
                        .id(meal.id)
                        .accessibilityLabel(meal.name)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
            }
            .onAppear { proxy.scrollTo(selectedMealTypeId, anchor: .center) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Meal")
    }

    // MARK: - Foods

    @ViewBuilder
    private func foodSection(_ title: String, systemImage: String, group: String) -> some View {
        let foods = shortcuts.filter { $0.group == group }
        if !foods.isEmpty {
            Label(title, systemImage: systemImage)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .padding(.top, 4)
            ForEach(foods) { food in
                foodRow(food, rowId: "\(group):\(food.id)")
            }
        }
    }

    private func foodRow(_ food: WatchFoodShortcut, rowId: String) -> some View {
        let added = justAddedId == rowId
        return Button {
            guard let action = store.captureFoodLog(food, mealTypeId: selectedMealTypeId) else { return }
            WKInterfaceDevice.current().play(.success)
            session.sendFoodLog(action)
            showAdded(rowId)
        } label: {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(food.name)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text("\(food.servingSize.formatted()) \(food.servingUnit) · \(Int(food.calories.rounded())) kcal")
                        .font(.system(size: 12))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: added ? "checkmark.circle.fill" : "plus.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(added ? Color.green : GoalPalette.calories)
                    .contentTransition(.symbolEffect(.replace))
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                GoalPalette.calories.opacity(0.18),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!canAdd)
        .opacity(canAdd ? 1 : 0.5)
        .accessibilityLabel("Add \(food.name) to \(selectedMealName)")
        .accessibilityValue(
            "\(food.servingSize.formatted()) \(food.servingUnit), \(Int(food.calories.rounded())) kilocalories"
        )
    }

    private func showAdded(_ rowId: String) {
        withAnimation { justAddedId = rowId }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.5))
            if justAddedId == rowId { withAnimation { justAddedId = nil } }
        }
    }

    // MARK: - Pending

    @ViewBuilder
    private var pendingSection: some View {
        let outstanding = store.pendingFoodActions.filter {
            $0.scope == store.context.actionScope && $0.state != .saved
        }
        if !outstanding.isEmpty {
            Text("Awaiting sync")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .padding(.top, 4)
            ForEach(outstanding.suffix(3)) { action in
                HStack {
                    Text(action.name).lineLimit(1)
                    Spacer()
                    Text(action.state == .failed ? "Failed" : "Queued")
                        .foregroundStyle(action.state == .failed ? Color.orange : Color.secondary)
                }
                .font(.caption2)
            }
            if !store.failedFoodActions.isEmpty {
                Button("Retry failed") { session.retryFailedFoodActions() }
            }
        }
    }

    private func setInitialMeal() {
        if !mealTypes.contains(where: { $0.id == selectedMealTypeId }) {
            selectedMealTypeId = store.context.defaultMealTypeId ?? mealTypes.first?.id ?? ""
        }
    }
}
