import SwiftUI
import WidgetKit

/// OS-tinted and Lock Screen widgets keep opaque, semantic foregrounds.
struct WidgetSurface: View {
    @Environment(\.widgetRenderingMode) private var mode
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        if mode == .fullColor {
            ZStack(alignment: .topLeading) {
                WidgetPalette.surface
                if scheme == .dark && !reduceTransparency {
                    RadialGradient(colors: [WidgetPalette.accent.opacity(0.16), .clear],
                        center: .topLeading, startRadius: 0, endRadius: 180)
                }
            }
        } else {
            Color.clear
        }
    }
}

struct WidgetTitle: View {
    let title: String
    var markSize: CGFloat = 20
    var body: some View {
        HStack(spacing: 5) {
            WidgetBrandMark().frame(width: markSize, height: markSize)
                .modifier(WidgetNeonStroke(color: WidgetPalette.accent))
            Text(title).font(.caption.weight(.semibold)).lineLimit(2).minimumScaleFactor(0.85)
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}

struct WidgetNeonStroke: ViewModifier {
    let color: Color
    @Environment(\.widgetRenderingMode) private var mode
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    func body(content: Content) -> some View {
        content.shadow(color: mode == .fullColor && scheme == .dark && !reduceTransparency
            ? color.opacity(0.35) : .clear, radius: 4)
    }
}

struct WidgetActionStyle: ViewModifier {
    @Environment(\.widgetRenderingMode) private var mode
    func body(content: Content) -> some View {
        content
            .font(.caption.weight(.semibold))
            .lineLimit(1).minimumScaleFactor(0.7)
            .foregroundStyle(mode == .fullColor ? WidgetPalette.accent : .primary)
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background {
                if mode == .fullColor {
                    RoundedRectangle(cornerRadius: 12).fill(WidgetPalette.raised)
                        .overlay(RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(WidgetPalette.accent.opacity(0.22), lineWidth: 1))
                }
            }
            .widgetAccentable()
    }
}

/// Keep the localized unit outside the visualization, where it can wrap.
struct WidgetMetric: View {
    let value: String
    let label: String
    let accessibilityText: String
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(compact ? .title3.bold() : .title2.bold())
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption2)
                .modifier(WidgetTextStyle(secondary: true))
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }
}

struct WidgetTextStyle: ViewModifier {
    var secondary = false
    @Environment(\.widgetRenderingMode) private var mode
    func body(content: Content) -> some View {
        content.foregroundStyle(mode == .fullColor
            ? (secondary ? WidgetPalette.secondary : WidgetPalette.foreground)
            : (secondary ? Color.secondary : Color.primary))
    }
}

struct WidgetShortcuts: View {
    var body: some View {
        HStack(spacing: 8) {
            ActionButton(icon: "camera", destination: URL(string: "sparkyfitnessmobile://meal-photo")!,
                accessibilityLabel: localizedWidgetString("widget.meal_photo"))
            ActionButton(icon: "magnifyingglass", destination: URL(string: "sparkyfitnessmobile://search")!,
                accessibilityLabel: localizedWidgetString("widget.search_food"))
            ActionButton(icon: "star", destination: URL(string: "sparkyfitnessmobile://search?initialBrowseTab=favorites")!,
                accessibilityLabel: localizedWidgetString("widget.quick_add"))
            ActionButton(icon: "barcode.viewfinder", destination: URL(string: "sparkyfitnessmobile://scan")!,
                accessibilityLabel: localizedWidgetString("widget.scan_barcode"))
        }
    }
}

struct WidgetAccessorySymbol: View {
    let icon: String
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Image(systemName: icon).font(.title3).frame(width: 36, height: 36)
            WidgetBrandMark().frame(width: 14, height: 14)
        }
        .foregroundStyle(.primary)
        .accessibilityElement(children: .ignore)
    }
}

func widgetColor(_ color: Color, mode: WidgetRenderingMode) -> Color {
    mode == .fullColor ? color : .primary
}
