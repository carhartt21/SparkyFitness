// Synthetic native layout fixture, concatenated after the production Swift sources.
// Does not host WidgetKit or exercise timeline and deep-link behavior.
private struct PreviewWidgetFamilyKey: EnvironmentKey { static let defaultValue: WidgetFamily = .systemMedium }
extension EnvironmentValues { var previewWidgetFamily: WidgetFamily { get { self[PreviewWidgetFamilyKey.self] } set { self[PreviewWidgetFamilyKey.self] = newValue } } }
private struct PreviewReduceTransparencyKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues { var previewReduceTransparency: Bool { get { self[PreviewReduceTransparencyKey.self] } set { self[PreviewReduceTransparencyKey.self] = newValue } } }

@main struct WidgetPreviewApp: App {
    var body: some Scene { WindowGroup { Gallery() } }
}
private struct Gallery: View {
    let args = ProcessInfo.processInfo.arguments
    var empty: Bool { args.contains("empty") }
    var mode: WidgetRenderingMode { args.contains("tinted") ? .accented : .fullColor }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("X on Track · Native widget design review").font(.title2.bold())
            Text("Synthetic data · SwiftUI content preview · not hosted by WidgetKit").font(.caption)
            HStack(spacing: 24) { Text("Small · 158 × 158").frame(width:158); Text("Medium · 338 × 158").frame(width:338) }
            HStack(spacing: 24) { tile(.systemSmall, 158) { calories }; tile(.systemMedium, 338) { calories } }
            HStack(spacing: 24) { tile(.systemSmall, 158) { macros }; tile(.systemMedium, 338) { macros } }
            HStack(spacing: 24) { tile(.systemSmall, 158) { capture }; tile(.systemMedium, 338) { capture } }
            HStack(spacing: 24) { tile(.systemSmall, 158) { routines }; tile(.systemMedium, 338) { routines } }
            Text("Lock Screen content · circular / rectangular / inline").font(.caption)
            HStack(spacing: 16) {
                capture.environment(\.previewWidgetFamily,.accessoryCircular).frame(width:60,height:60)
                capture.environment(\.previewWidgetFamily,.accessoryRectangular).frame(width:160,height:60)
                routines.environment(\.previewWidgetFamily,.accessoryRectangular).frame(width:170,height:60)
                routines.environment(\.previewWidgetFamily,.accessoryInline).frame(width:100,height:60)
            }.environment(\.widgetRenderingMode,.vibrant)
        }
        .padding(32)
        .environment(\.widgetRenderingMode, mode)
        .environment(\.dynamicTypeSize, args.contains("large") ? .accessibility1 : .large)
        .environment(\.previewReduceTransparency, args.contains("opaque"))
        .preferredColorScheme(args.contains("light") ? .light : .dark)
        .frame(maxWidth:.infinity,maxHeight:.infinity)
        .background(args.contains("light") ? Color(red:0.965,green:0.941,blue:0.89) : Color(red:0.008,green:0.047,blue:0.063))
    }
    func tile<V:View>(_ family: WidgetFamily, _ width:CGFloat, @ViewBuilder content:()->V) -> some View {
        content().padding(16).frame(width:width,height:158)
            .background { mode == .fullColor ? AnyView(WidgetSurface()) : AnyView(Color.gray.opacity(0.18)) }
            .clipShape(RoundedRectangle(cornerRadius:24))
            .environment(\.previewWidgetFamily,family)
    }
    var calories: some View {
        widgetEntryView(entry:SimpleEntry(date:.now,snapshot:empty ? .empty : CalorieSnapshot(food:1540,burned:255,goal:3055,remaining:1515,progress:0.5,lastUpdated:.now)))
    }
    var macros: some View {
        macroWidgetEntryView(entry:MacroEntry(date:.now,snapshot:empty ? .empty : MacroSnapshot(proteinGrams:92,carbsGrams:180,fatGrams:55,caloriesConsumed:1540,lastUpdated:.now)))
    }
    var capture: some View {
        NutritionEngagementView(entry:NutritionEngagementEntry(date:.now,payload:empty ? nil : NutritionEngagementPayload(version:1,scope:"preview",serverConfigId:"synthetic",userId:"synthetic",day:todayDateString(),capturedCount:4,incompleteCount:1,pendingSyncCount:0,remoteKnown:1,generatedAt:Date().timeIntervalSince1970)))
    }
    var routines: some View { RoutineView(entry:RoutineEntry(date:.now,total:empty ? nil : 3)) }
}
