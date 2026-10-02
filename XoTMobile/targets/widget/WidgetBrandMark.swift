// Generated from shared/src/brand/progressionX.geometry.json. Do not edit.
// Static identity artwork, never a completion or intake indicator.
import SwiftUI
import WidgetKit

struct WidgetBrandMark: View {
    @Environment(\.widgetRenderingMode) private var mode
    var body: some View {
        Canvas { context, size in
            context.scaleBy(x: size.width / 320, y: size.height / 320)
            let shade0: GraphicsContext.Shading = mode == .fullColor
                ? .linearGradient(Gradient(colors: [Color(red: 1, green: 0.0706, blue: 0.2353), Color(red: 1, green: 0.6078, blue: 0.1725)]), startPoint: CGPoint(x: 120, y: 235), endPoint: CGPoint(x: 159, y: 113)) : .color(.primary)
            context.stroke(Path { p in p.move(to: CGPoint(x: 159, y: 113)); p.addLine(to: CGPoint(x: 68, y: 218)); p.addCurve(to: CGPoint(x: 82, y: 254), control1: CGPoint(x: 55, y: 233), control2: CGPoint(x: 61, y: 253)); p.addLine(to: CGPoint(x: 98, y: 254)); p.addCurve(to: CGPoint(x: 117, y: 245), control1: CGPoint(x: 106, y: 254), control2: CGPoint(x: 111, y: 252)); p.addLine(to: CGPoint(x: 151, y: 204)) }, with: shade0, style: StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
            let shade1: GraphicsContext.Shading = mode == .fullColor
                ? .linearGradient(Gradient(colors: [Color(red: 1, green: 0.6078, blue: 0.1725), Color(red: 0.9686, green: 0.9333, blue: 0.2118)]), startPoint: CGPoint(x: 165, y: 95), endPoint: CGPoint(x: 100, y: 150)) : .color(.primary)
            context.stroke(Path { p in p.move(to: CGPoint(x: 119, y: 155)); p.addLine(to: CGPoint(x: 68, y: 96)); p.addCurve(to: CGPoint(x: 84, y: 60), control1: CGPoint(x: 54, y: 80), control2: CGPoint(x: 64, y: 60)); p.addLine(to: CGPoint(x: 98, y: 60)); p.addCurve(to: CGPoint(x: 118, y: 70), control1: CGPoint(x: 106, y: 60), control2: CGPoint(x: 112, y: 63)); p.addLine(to: CGPoint(x: 159, y: 113)) }, with: shade1, style: StrokeStyle(lineWidth: 7, lineCap: .butt, lineJoin: .round))
            let shade2: GraphicsContext.Shading = mode == .fullColor
                ? .linearGradient(Gradient(colors: [Color(red: 0.9686, green: 0.9333, blue: 0.2118), Color(red: 0.698, green: 0.9608, blue: 0.2706)]), startPoint: CGPoint(x: 159, y: 90), endPoint: CGPoint(x: 235, y: 150)) : .color(.primary)
            context.stroke(Path { p in p.move(to: CGPoint(x: 159, y: 113)); p.addLine(to: CGPoint(x: 202, y: 70)); p.addCurve(to: CGPoint(x: 222, y: 60), control1: CGPoint(x: 208, y: 63), control2: CGPoint(x: 214, y: 60)); p.addLine(to: CGPoint(x: 235, y: 60)); p.addCurve(to: CGPoint(x: 250, y: 97), control1: CGPoint(x: 255, y: 60), control2: CGPoint(x: 264, y: 80)); p.addLine(to: CGPoint(x: 191, y: 157)) }, with: shade2, style: StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
            context.fill(Path { p in p.move(to: CGPoint(x: 188.5, y: 154.5)); p.addLine(to: CGPoint(x: 193.5, y: 159.5)); p.addLine(to: CGPoint(x: 174, y: 178)); p.closeSubpath() }, with: shade2)
            let shade3: GraphicsContext.Shading = mode == .fullColor
                ? .linearGradient(Gradient(colors: [Color(red: 0.698, green: 0.9608, blue: 0.2706), Color(red: 0.4941, green: 0.9608, blue: 0.3608)]), startPoint: CGPoint(x: 190, y: 150), endPoint: CGPoint(x: 240, y: 250)) : .color(.primary)
            context.stroke(Path { p in p.move(to: CGPoint(x: 190.5, y: 156.5)); p.addLine(to: CGPoint(x: 250, y: 223)); p.addCurve(to: CGPoint(x: 235, y: 254), control1: CGPoint(x: 264, y: 240), control2: CGPoint(x: 254, y: 254)); p.addLine(to: CGPoint(x: 220, y: 254)) }, with: shade3, style: StrokeStyle(lineWidth: 7, lineCap: .butt, lineJoin: .round))
            let shade4: GraphicsContext.Shading = mode == .fullColor
                ? .linearGradient(Gradient(colors: [Color(red: 0.4941, green: 0.9608, blue: 0.3608), Color(red: 0.1333, green: 0.9765, blue: 0.4706)]), startPoint: CGPoint(x: 220, y: 254), endPoint: CGPoint(x: 214, y: 103)) : .color(.primary)
            context.fill(Path { p in p.move(to: CGPoint(x: 214, y: 103)); p.addCurve(to: CGPoint(x: 132, y: 158), control1: CGPoint(x: 180, y: 121), control2: CGPoint(x: 145, y: 144)); p.addCurve(to: CGPoint(x: 135, y: 193), control1: CGPoint(x: 122, y: 169), control2: CGPoint(x: 123, y: 181)); p.addLine(to: CGPoint(x: 199, y: 249)); p.addCurve(to: CGPoint(x: 220, y: 257.5), control1: CGPoint(x: 205, y: 254), control2: CGPoint(x: 212, y: 257.5)); p.addLine(to: CGPoint(x: 220, y: 250.5)); p.addCurve(to: CGPoint(x: 203, y: 242), control1: CGPoint(x: 214, y: 250.5), control2: CGPoint(x: 208, y: 247)); p.addLine(to: CGPoint(x: 148, y: 183)); p.addCurve(to: CGPoint(x: 146, y: 161), control1: CGPoint(x: 140, y: 175), control2: CGPoint(x: 139, y: 170)); p.addCurve(to: CGPoint(x: 214, y: 103), control1: CGPoint(x: 159, y: 146), control2: CGPoint(x: 190, y: 120)); p.closeSubpath() }, with: shade4)

        }
        .aspectRatio(1, contentMode: .fit)
        .widgetAccentable()
        .accessibilityHidden(true)
    }
}
