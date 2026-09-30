import WidgetKit
import SwiftUI

/// Today's Daily Progress as `ComplicationPublisher` (targets/watch) stores it:
/// the same completed/applicable task count the phone's dashboard X draws.
private struct ProgressXSnapshotPayload: ScopedDaySnapshot {
    let scope: String?
    let date: String?
    let completed: Int
    let applicable: Int
    /// 0...100; nil when no task applies today.
    let percent: Double?
}

/// What the complication shows. `notSynced` (nothing trustworthy for today)
/// and `noTasks` (synced, nothing applies) both draw a neutral X, but they
/// are different claims and read differently to VoiceOver and in text.
enum ProgressXState: Equatable {
    case notSynced
    case noTasks
    case progress(completed: Int, applicable: Int, percent: Double)

    /// The share of the X to light up, 0...100, or nil for a neutral X.
    var percent: Double? {
        if case let .progress(_, _, percent) = self { return percent }
        return nil
    }
}

private func loadProgressXState() -> ProgressXState {
    guard
        let payload = ComplicationSnapshotStore.load(
            ProgressXSnapshotPayload.self,
            key: "dailyProgressSnapshot"
        )
    else { return .notSynced }
    guard payload.applicable > 0 else { return .noTasks }
    let completed = min(max(payload.completed, 0), payload.applicable)
    let percent = payload.percent
        ?? Double(completed) / Double(payload.applicable) * 100
    return .progress(
        completed: completed,
        applicable: payload.applicable,
        percent: min(max(percent, 0), 100)
    )
}

struct ProgressXEntry: TimelineEntry {
    let date: Date
    let state: ProgressXState
}

struct ProgressXProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProgressXEntry {
        ProgressXEntry(date: Date(), state: .progress(completed: 3, applicable: 5, percent: 60))
    }

    func getSnapshot(in context: Context, completion: @escaping (ProgressXEntry) -> Void) {
        completion(ProgressXEntry(date: Date(), state: loadProgressXState()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProgressXEntry>) -> Void) {
        let now = Date()
        let entry = ProgressXEntry(date: now, state: loadProgressXState())
        completion(
            Timeline(
                entries: [entry],
                policy: .after(ComplicationSnapshotStore.nextRefresh(after: now))
            )
        )
    }
}

// MARK: - Drawing

extension Path {
    /// Parses the absolute M/L/C/Z subset of SVG path data the brand geometry
    /// uses (see shared/src/brand/progressionX.geometry.json).
    init(svgPathData data: String) {
        self.init()
        var tokens: [String] = []
        var number = ""
        func flush() {
            if !number.isEmpty { tokens.append(number); number = "" }
        }
        for character in data {
            if character.isLetter {
                flush()
                tokens.append(String(character))
            } else if character == "-" {
                flush()
                number = "-"
            } else if character.isNumber || character == "." {
                number.append(character)
            } else {
                flush()
            }
        }
        flush()

        var index = 0
        func next() -> CGFloat {
            defer { index += 1 }
            return index < tokens.count ? CGFloat(Double(tokens[index]) ?? 0) : 0
        }
        while index < tokens.count {
            let command = tokens[index]
            index += 1
            switch command {
            case "M":
                move(to: CGPoint(x: next(), y: next()))
            case "L":
                addLine(to: CGPoint(x: next(), y: next()))
            case "C":
                let control1 = CGPoint(x: next(), y: next())
                let control2 = CGPoint(x: next(), y: next())
                addCurve(to: CGPoint(x: next(), y: next()), control1: control1, control2: control2)
            case "Z":
                closeSubpath()
            default:
                continue
            }
        }
    }
}

/// How much of each segment's guide is lit for `percent`: one scalar runs
/// through the segments in order, like `getProgressionXReveal` in shared.
func progressXRevealFractions(percent: Double?) -> [Double] {
    let segments = ProgressXGeometry.segments
    guard let percent else { return segments.map { _ in 0 } }
    let total = segments.reduce(0) { $0 + $1.length }
    var remaining = min(max(percent, 0), 100) / 100 * total
    return segments.map { segment in
        let visible = min(segment.length, max(0, remaining))
        remaining -= visible
        return segment.length > 0 ? visible / segment.length : 0
    }
}

/// One layer of the X: either the dim outline everything sits on, or the
/// lit part. Kept as two views so the lit layer alone can be marked
/// accentable when the face tints complications.
private struct ProgressXLayer: View {
    enum Kind { case baseline, lit }

    let kind: Kind
    let percent: Double?
    /// Multiplies the brand stroke width. Complications are drawn much
    /// smaller than the phone card, where a 7-unit stroke would vanish.
    let lineScale: CGFloat
    let fullColor: Bool

    var body: some View {
        Canvas { context, size in
            let side = min(size.width, size.height)
            let scale = side / ProgressXGeometry.size.width
            context.translateBy(
                x: (size.width - side) / 2,
                y: (size.height - side) / 2
            )
            context.scaleBy(x: scale, y: scale)

            let fractions = progressXRevealFractions(percent: percent)
            for (index, segment) in ProgressXGeometry.segments.enumerated() {
                let shading: GraphicsContext.Shading
                if kind == .baseline {
                    shading = .color(
                        fullColor ? ProgressXGeometry.baselineDark : Color.white.opacity(0.35)
                    )
                } else {
                    let fraction = fractions[index]
                    guard fraction > 0 else { continue }
                    shading = fullColor
                        ? .linearGradient(
                            Gradient(colors: [segment.from, segment.to]),
                            startPoint: segment.gradientStart,
                            endPoint: segment.gradientEnd
                        )
                        : .color(.white)
                    if fraction < 1 {
                        let reveal = Path(svgPathData: segment.guide)
                            .trimmedPath(from: 0, to: CGFloat(fraction))
                            .strokedPath(
                                StrokeStyle(
                                    lineWidth: segment.revealWidth * lineScale,
                                    lineCap: .round,
                                    lineJoin: .round
                                )
                            )
                        var clipped = context
                        clipped.clip(to: reveal)
                        draw(segment, in: clipped, with: shading)
                        continue
                    }
                }
                draw(segment, in: context, with: shading)
            }
        }
    }

    private func draw(
        _ segment: ProgressXSegment,
        in context: GraphicsContext,
        with shading: GraphicsContext.Shading
    ) {
        let path = Path(svgPathData: segment.path)
        if segment.isStroke {
            context.stroke(
                path,
                with: shading,
                style: StrokeStyle(
                    lineWidth: segment.strokeWidth * lineScale,
                    lineCap: segment.roundCap ? .round : .butt,
                    lineJoin: .round
                )
            )
            if let taper = segment.taperPath {
                context.fill(Path(svgPathData: taper), with: shading)
            }
        } else {
            // The sweep is a filled outline; a matching stroke thickens it
            // by the same amount the stroked segments grew.
            context.fill(path, with: shading)
            if lineScale > 1 {
                context.stroke(
                    path,
                    with: shading,
                    style: StrokeStyle(
                        lineWidth: 7 * (lineScale - 1),
                        lineJoin: .round
                    )
                )
            }
        }
    }
}

/// The Progress X from the phone's dashboard, lit in proportion to today's
/// completed tasks.
struct ProgressXMark: View {
    let state: ProgressXState
    var lineScale: CGFloat = 1.6

    @Environment(\.widgetRenderingMode) private var renderingMode

    var body: some View {
        let fullColor = renderingMode == .fullColor
        ZStack {
            ProgressXLayer(kind: .baseline, percent: nil, lineScale: lineScale, fullColor: fullColor)
            if let percent = state.percent, percent > 0 {
                ProgressXLayer(kind: .lit, percent: percent, lineScale: lineScale, fullColor: fullColor)
                    .widgetAccentable()
            }
        }
        // Same dimming the phone uses for a neutral X.
        .opacity(state.percent == nil ? 0.62 : 1)
    }
}

// MARK: - Text

private func progressXSummary(_ state: ProgressXState) -> String {
    switch state {
    case .notSynced:
        return ProgressCopy.text("progress.notSynced")
    case .noTasks:
        return ProgressCopy.text("progress.noTasks")
    case let .progress(completed, applicable, _):
        return ProgressCopy.text("progress.tasks", completed, applicable)
    }
}

private func progressXPercentText(_ state: ProgressXState) -> String? {
    state.percent.map { "\(Int($0.rounded()))%" }
}

private func progressXAccessibilityLabel(_ state: ProgressXState) -> String {
    switch state {
    case .notSynced:
        return ProgressCopy.text("progress.accessibilityNotSynced")
    case .noTasks:
        return ProgressCopy.text("progress.accessibilityNoTasks")
    case let .progress(completed, applicable, _):
        return ProgressCopy.text("progress.accessibilityTasks", completed, applicable)
    }
}

// MARK: - Families

struct ProgressXComplicationEntryView: View {
    var entry: ProgressXProvider.Entry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            // Opens the watch app on its Goals page, like the energy rings.
            .widgetURL(ComplicationLink.goals.url)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(progressXAccessibilityLabel(entry.state))
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryRectangular:
            HStack(spacing: 8) {
                ProgressXMark(state: entry.state, lineScale: 1.4)
                    .aspectRatio(1, contentMode: .fit)
                VStack(alignment: .leading, spacing: 1) {
                    Text(ProgressCopy.text("progress.title"))
                        .font(.headline)
                        .widgetAccentable()
                    Text(progressXSummary(entry.state))
                        .font(.body)
                    if let percent = progressXPercentText(entry.state) {
                        Text(percent)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
        case .accessoryCorner:
            ProgressXMark(state: entry.state, lineScale: 2)
                .padding(2)
                .widgetLabel {
                    if let percent = entry.state.percent {
                        Gauge(value: percent, in: 0...100) {
                            Text(ProgressCopy.text("progress.title"))
                        } currentValueLabel: {
                            Text(progressXPercentText(entry.state) ?? "")
                        }
                    } else {
                        Text(progressXSummary(entry.state))
                    }
                }
        case .accessoryInline:
            Text(
                progressXPercentText(entry.state).map { ProgressCopy.text("progress.inline", $0) }
                    ?? progressXSummary(entry.state)
            )
        default:
            // accessoryCircular: the bare X, like the dashboard card. Enlarged
            // into the brand art's own padding, but not so far that the
            // circle clips the X's rounded ends.
            ProgressXMark(state: entry.state)
                .scaleEffect(1.15)
        }
    }
}

struct ProgressXComplication: Widget {
    // Must match ComplicationPublisher's Progress.kind (targets/watch).
    let kind: String = "progressXComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProgressXProvider()) { entry in
            ProgressXComplicationEntryView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName(ProgressCopy.text("progress.configuration"))
        .description(ProgressCopy.text("progress.description"))
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryCorner,
            .accessoryInline,
        ])
    }
}

#if DEBUG
    #Preview(as: .accessoryCircular) {
        ProgressXComplication()
    } timeline: {
        ProgressXEntry(date: .now, state: .progress(completed: 3, applicable: 5, percent: 60))
        ProgressXEntry(date: .now, state: .progress(completed: 5, applicable: 5, percent: 100))
        ProgressXEntry(date: .now, state: .noTasks)
        ProgressXEntry(date: .now, state: .notSynced)
    }

    #Preview(as: .accessoryRectangular) {
        ProgressXComplication()
    } timeline: {
        ProgressXEntry(date: .now, state: .progress(completed: 2, applicable: 6, percent: 33))
        ProgressXEntry(date: .now, state: .noTasks)
    }
#endif
