import SwiftUI
import WatchKit

/// Fast logging from the phone's saved and recently used foods, in two steps:
/// pick a food, then pick how much. The phone remains responsible for the
/// authenticated write and its nutrition snapshot.
struct FoodQuickLogView: View {
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @EnvironmentObject private var store: CheckInStore
    @EnvironmentObject private var session: WatchSessionManager
    @State private var selectedMealTypeId = ""
    @State private var path: [FoodLogRoute] = []
    /// The food just logged, shown with a checkmark for a moment after the
    /// serving step closes.
    @State private var justAddedId: String?

    private var shortcuts: [WatchFoodShortcut] { store.context.foodShortcuts ?? [] }
    private var mealTypes: [WatchMealType] { store.context.mealTypes ?? [] }
    private var selectedMealName: String {
        mealTypes.first(where: { $0.id == selectedMealTypeId })?.name ?? WatchCopy.text("food.meal")
    }
    private var canAdd: Bool { store.canCaptureActions && !selectedMealTypeId.isEmpty }

    var body: some View {
        // Scoped to this page, like the Water page: a stack around the whole
        // TabView would make the serving step look like part of the deck.
        NavigationStack(path: $path) {
            list
                .navigationDestination(for: FoodLogRoute.self) { route in
                    switch route {
                    case let .servings(food):
                        FoodServingView(
                            food: food,
                            mealName: selectedMealName,
                            choices: store.servingChoices(for: food),
                            onLog: { log(food, $0) },
                            onCustom: { base in path.append(.custom(food, base)) }
                        )
                    case let .custom(food, base):
                        FoodCustomAmountView(
                            food: food,
                            base: base,
                            mealName: selectedMealName,
                            onLog: { log(food, $0) }
                        )
                    }
                }
        }
        .onAppear { setInitialMeal() }
        .onChange(of: store.context.defaultMealTypeId) { _, _ in setInitialMeal() }
        .onChange(of: store.context.mealTypes) { _, _ in setInitialMeal() }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(WatchCopy.text("food.add"))
                    .font(.system(.headline, design: .rounded))
                if mealTypes.isEmpty || shortcuts.isEmpty {
                    Text(WatchCopy.text("food.syncHint"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button(WatchCopy.text("food.retrySync")) { session.requestContext() }
                } else {
                    mealChips
                    foodSection(WatchCopy.text("food.favorites"), systemImage: "star.fill", group: "favorite")
                    foodSection(WatchCopy.text("food.recent"), systemImage: "clock", group: "recent")
                }
                pendingSection
            }
            .padding(.horizontal, 4)
            // Keeps the last row clear of the page dots.
            .padding(.bottom, 18)
        }
    }

    private func log(_ food: WatchFoodShortcut, _ serving: WatchFoodServing) {
        guard let action = store.captureFoodLog(
            food, serving: serving, mealTypeId: selectedMealTypeId
        ) else {
            WKInterfaceDevice.current().play(.failure)
            return
        }
        WKInterfaceDevice.current().play(.success)
        session.sendFoodLog(action)
        path.removeAll()
        withAnimation(reducedMotion ? nil : .default) { justAddedId = food.id }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.8))
            if justAddedId == food.id { withAnimation(reducedMotion ? nil : .default) { justAddedId = nil } }
        }
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
                            withAnimation(reducedMotion ? nil : .default) { proxy.scrollTo(meal.id, anchor: .center) }
                        } label: {
                            Text(meal.name)
                                .font(.caption.weight(selected ? .semibold : .regular))
                                .lineLimit(1)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .frame(minHeight: 44)
                                .foregroundStyle(selected ? Neon.accentText : Color.primary)
                                .background(
                                    Capsule().fill(selected ? Neon.accent : Color.white.opacity(0.12))
                                )
                                .shadow(color: Neon.accent.opacity(selected ? 0.45 : 0), radius: 5)
                        }
                        .buttonStyle(.plain)
                        .id(meal.id)
                        .accessibilityLabel(meal.name)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
                .padding(.vertical, 4)
            }
            .onAppear { proxy.scrollTo(selectedMealTypeId, anchor: .center) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(WatchCopy.text("food.meal"))
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
                foodRow(food)
            }
        }
    }

    private func foodRow(_ food: WatchFoodShortcut) -> some View {
        let added = justAddedId == food.id
        let top = store.servingChoices(for: food).first
        return Button {
            path.append(.servings(food))
        } label: {
            HStack(spacing: 8) {
                FoodThumbnailView(food: food, size: 38)
                    .overlay(alignment: .bottomTrailing) {
                        if added {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(Neon.accentText, Neon.accent)
                                .offset(x: 4, y: 4)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(food.name)
                        .font(.headline)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if let top {
                        Text("\(top.title) · \(Int(top.calories.rounded())) kcal")
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .neonSurface(Neon.food, intensity: added ? .strong : .edge, cornerRadius: 14)
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!canAdd)
        .opacity(canAdd ? 1 : 0.5)
        .accessibilityLabel(food.name)
        .accessibilityHint(WatchCopy.text("food.chooseHint", selectedMealName))
    }

    // MARK: - Pending

    @ViewBuilder
    private var pendingSection: some View {
        let outstanding = store.pendingFoodActions.filter {
            $0.scope == store.context.actionScope && $0.state != .saved
        }
        if !outstanding.isEmpty {
            Text(WatchCopy.text("food.pending"))
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .padding(.top, 4)
            ForEach(outstanding.suffix(3)) { action in
                HStack {
                    Text(action.name).lineLimit(1)
                    Spacer()
                    Text(action.state == .failed ? WatchCopy.text("food.failed") : WatchCopy.text("food.queued"))
                        .foregroundStyle(action.state == .failed ? Color.orange : Color.secondary)
                }
                .font(.caption2)
            }
            if !store.failedFoodActions.isEmpty {
                Button(WatchCopy.text("food.retryFailed")) { session.retryFailedFoodActions() }
            }
        }
    }

    private func setInitialMeal() {
        if !mealTypes.contains(where: { $0.id == selectedMealTypeId }) {
            selectedMealTypeId = store.context.defaultMealTypeId ?? mealTypes.first?.id ?? ""
        }
    }
}

enum FoodLogRoute: Hashable {
    case servings(WatchFoodShortcut)
    /// A custom amount in grams or millilitres, on the unit of `base`.
    case custom(WatchFoodShortcut, WatchFoodServing)
}

/// The food's picture from the phone, or its initial on the food colour when
/// it has none (or the file has not arrived yet).
struct FoodThumbnailView: View {
    let food: WatchFoodShortcut
    let size: CGFloat
    @ObservedObject private var thumbnails = FoodThumbnailStore.shared

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
        Group {
            if let image = thumbnails.image(for: food.thumbnailKey) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Text(food.name.prefix(1).uppercased())
                    .font(.system(size: size * 0.45, weight: .bold, design: .rounded))
                    .foregroundStyle(Neon.food)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Neon.food.opacity(0.16))
            }
        }
        .frame(width: size, height: size)
        .clipShape(shape)
        .overlay(shape.strokeBorder(Neon.food.opacity(0.35), lineWidth: 0.75))
        .accessibilityHidden(true)
    }
}

/// Step two: how much. The amount last logged comes first, then 100 g (or
/// ml) where the food can be weighed, then its saved portions.
struct FoodServingView: View {
    let food: WatchFoodShortcut
    let mealName: String
    let choices: [WatchFoodServing]
    let onLog: (WatchFoodServing) -> Void
    let onCustom: (WatchFoodServing) -> Void

    /// The grams (or ml) serving an WatchCopy.text("food.otherAmount") is typed against.
    private var metricBase: WatchFoodServing? {
        choices.first { $0.kind == "default" && ($0.unit == "g" || $0.unit == "ml") }
            ?? choices.first { $0.unit == "g" || $0.unit == "ml" }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    FoodThumbnailView(food: food, size: 32)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(food.name)
                            .font(.headline)
                            .lineLimit(2)
                        Text(WatchCopy.text("food.toMeal", mealName))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(.bottom, 2)

                ForEach(choices) { serving in
                    Button { onLog(serving) } label: {
                        servingRow(serving)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(
                        WatchCopy.text(serving.kind == "last" ? "food.lastServingAccessibility" : "food.servingAccessibility", serving.title, Int(serving.calories.rounded()))
                    )
                    .accessibilityHint(WatchCopy.text("food.addHint", mealName))
                }

                if let base = metricBase {
                    Button { onCustom(base) } label: {
                        HStack {
                            Image(systemName: "dial.low")
                                .foregroundStyle(Neon.accent)
                            Text(WatchCopy.text("food.otherAmount"))
                                .font(.system(size: 14, weight: .medium))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 9)
        .frame(minHeight: 44)
                        .background(
                            Color.white.opacity(0.08),
                            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
        .navigationTitle(WatchCopy.text("food.amount"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func servingRow(_ serving: WatchFoodServing) -> some View {
        let isLast = serving.kind == "last"
        return HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                if isLast {
                    Label(WatchCopy.text("food.lastUsed"), systemImage: "clock.arrow.circlepath")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Neon.accent)
                        .textCase(.uppercase)
                }
                Text(serving.title)
                    .font(.headline)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("\(Int(serving.calories.rounded())) kcal")
                .font(.system(size: 12, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(Neon.accentText, Neon.accent)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .frame(minHeight: 44)
        .neonSurface(isLast ? Neon.accent : Neon.food, intensity: isLast ? .soft : .edge, cornerRadius: 14)
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// An amount in grams or millilitres, set with the Digital Crown.
struct FoodCustomAmountView: View {
    let food: WatchFoodShortcut
    let base: WatchFoodServing
    let mealName: String
    let onLog: (WatchFoodServing) -> Void

    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @State private var amount: Double

    init(
        food: WatchFoodShortcut,
        base: WatchFoodServing,
        mealName: String,
        onLog: @escaping (WatchFoodServing) -> Void
    ) {
        self.food = food
        self.base = base
        self.mealName = mealName
        self.onLog = onLog
        _amount = State(initialValue: max(5, (base.quantity / 5).rounded() * 5))
    }

    private var calories: Double {
        base.quantity > 0 ? base.calories / base.quantity * amount : 0
    }

    var body: some View {
        VStack(spacing: 6) {
            Text(food.name)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(amount.formatted())
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(reducedMotion ? .identity : .numericText())
                Text(base.unit)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            }
            .shadow(color: Neon.accent.opacity(0.35), radius: 6)
            .focusable()
            .digitalCrownRotation(
                $amount, from: 5, through: 2000, by: 5,
                sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true
            )
            .accessibilityLabel(WatchCopy.text("food.amount"))
            .accessibilityValue("\(amount.formatted()) \(base.unit)")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: amount = min(2000, amount + 5)
                case .decrement: amount = max(5, amount - 5)
                @unknown default: break
                }
            }
            Text("\(Int(calories.rounded())) kcal")
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            Button {
                onLog(
                    WatchFoodServing(
                        key: "custom", kind: "custom",
                        title: "\(amount.formatted()) \(base.unit)",
                        quantity: amount, unit: base.unit, variantId: base.variantId,
                        calories: calories.rounded(),
                        servingSize: base.servingSize, servingUnit: base.servingUnit
                    )
                )
            } label: {
                Label(WatchCopy.text("food.addToMeal", mealName), systemImage: "plus")
                    .font(.headline)
                    .foregroundStyle(Neon.accentText)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Neon.accent)
        }
        .padding(.horizontal, 4)
        .navigationTitle(WatchCopy.text("food.amount"))
        .navigationBarTitleDisplayMode(.inline)
    }
}
