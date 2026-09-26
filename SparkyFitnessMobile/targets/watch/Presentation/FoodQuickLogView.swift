import SwiftUI

/// Fast logging from the phone's saved and recently used foods. The phone
/// remains responsible for the authenticated write and its nutrition snapshot.
struct FoodQuickLogView: View {
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager
    @State private var selectedMealTypeId = ""

    private var shortcuts: [WatchFoodShortcut] { store.context.foodShortcuts ?? [] }
    private var mealTypes: [WatchMealType] { store.context.mealTypes ?? [] }
    private var selectedMealName: String {
        mealTypes.first(where: { $0.id == selectedMealTypeId })?.name ?? "Meal"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Add food").font(.headline)
                if mealTypes.isEmpty || shortcuts.isEmpty {
                    Text("Open X on Track on your phone to sync favorite and recent foods.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Retry sync") { session.requestContext() }
                } else {
                    Picker("Meal", selection: $selectedMealTypeId) {
                        ForEach(mealTypes) { meal in
                            Text(meal.name).tag(meal.id)
                        }
                    }
                    .labelsHidden()
                    .accessibilityLabel("Choose meal")

                    foodSection("Favorites", group: "favorite")
                    foodSection("Recently used", group: "recent")
                }

                let outstanding = store.pendingFoodActions.filter {
                    $0.scope == store.context.actionScope && $0.state != .saved
                }
                if !outstanding.isEmpty {
                    Text("Awaiting sync").font(.caption).foregroundStyle(.secondary)
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
            .padding(.horizontal, 4)
        }
        .onAppear { setInitialMeal() }
        .onChange(of: store.context.defaultMealTypeId) { _, _ in setInitialMeal() }
        .onChange(of: store.context.mealTypes) { _, _ in setInitialMeal() }
    }

    @ViewBuilder
    private func foodSection(_ title: String, group: String) -> some View {
        let foods = shortcuts.filter { $0.group == group }
        if !foods.isEmpty {
            Text(title).font(.caption).foregroundStyle(.secondary)
            ForEach(foods) { food in
                Button {
                    guard let action = store.captureFoodLog(food, mealTypeId: selectedMealTypeId) else { return }
                    session.sendFoodLog(action)
                } label: {
                    HStack(alignment: .top, spacing: 6) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(food.name).font(.caption).lineLimit(2)
                            Text("\(food.servingSize.formatted()) \(food.servingUnit) · \(Int(food.calories.rounded())) kcal")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 2)
                        Image(systemName: "plus.circle.fill")
                            .accessibilityHidden(true)
                    }
                }
                .buttonStyle(.bordered)
                .disabled(!store.canCaptureActions || selectedMealTypeId.isEmpty)
                .accessibilityLabel("Add \(food.name) to \(selectedMealName)")
            }
        }
    }

    private func setInitialMeal() {
        if !mealTypes.contains(where: { $0.id == selectedMealTypeId }) {
            selectedMealTypeId = store.context.defaultMealTypeId ?? mealTypes.first?.id ?? ""
        }
    }
}
