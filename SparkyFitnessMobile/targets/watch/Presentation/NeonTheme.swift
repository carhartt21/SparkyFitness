import SwiftUI

/// The phone app's dark neon theme, trimmed to what the Watch uses.
///
/// Values mirror the dark tokens in SparkyFitnessMobile/global.css (`--color-brand-secondary`,
/// `--color-action-food`, `--color-neon-*`, `--color-surface-*`) — a separate
/// compiled target can't read them, so if one changes there, change it here.
/// Applied sparingly: the Watch keeps its true-black background, and only
/// accents, card edges and a soft glow carry the theme.
enum Neon {
    /// Brand mint, the app's accent (`--color-brand-secondary`).
    static let accent = Color(hex: 0x14E89A)
    /// Text on an accent fill (`--color-accent-text`).
    static let accentText = Color(hex: 0x02140C)
    /// Food actions (`--color-action-food`).
    static let food = Color(hex: 0xFF5A3C)
    static let green = Color(hex: 0x3FF276)
    static let yellow = Color(hex: 0xFCD533)
    static let cyan = Color(hex: 0x22B8F5)
    /// Card fill (`--color-surface-primary`), raised a touch for the Watch's black.
    static let surface = Color(hex: 0x0B1D23)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// How strongly a surface glows, as in the app's `GlowIntensity`.
enum NeonIntensity {
    /// Tinted edge and wash, no outer glow — for dense lists.
    case edge
    case soft
    case strong
}

private struct NeonSurface: ViewModifier {
    let color: Color
    let intensity: NeonIntensity
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .background {
                shape
                    .fill(Neon.surface)
                    .overlay(
                        // The app's 160° wash: the colour fades out by 60%.
                        shape.fill(
                            LinearGradient(
                                colors: [
                                    color.opacity(intensity == .strong ? 0.22 : 0.14),
                                    color.opacity(0),
                                ],
                                startPoint: .topLeading,
                                endPoint: UnitPoint(x: 0.75, y: 0.9)
                            )
                        )
                    )
                    .shadow(
                        color: color.opacity(
                            intensity == .edge ? 0 : intensity == .strong ? 0.45 : 0.28
                        ),
                        radius: intensity == .strong ? 7 : 5
                    )
            }
            .overlay(
                shape.strokeBorder(
                    color.opacity(intensity == .strong ? 0.85 : intensity == .soft ? 0.45 : 0.3),
                    lineWidth: 1
                )
            )
    }
}

extension View {
    /// A card with the app's neon treatment: tinted edge, wash and glow.
    func neonSurface(
        _ color: Color,
        intensity: NeonIntensity = .soft,
        cornerRadius: CGFloat = 16
    ) -> some View {
        modifier(NeonSurface(color: color, intensity: intensity, cornerRadius: cornerRadius))
    }
}
