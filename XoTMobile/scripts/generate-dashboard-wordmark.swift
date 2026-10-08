import CoreText
import CryptoKit
import Foundation

// macOS-only asset authoring. The phone renders the resulting vector, not a font.
// Usage: swift scripts/generate-dashboard-wordmark.swift <SpaceGrotesk[wght].ttf> <output.json>
guard CommandLine.arguments.count == 3 else {
    fatalError("Supply the upstream Space Grotesk font and output JSON paths")
}
let fontURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let fontData = try Data(contentsOf: fontURL)
let descriptors = CTFontManagerCreateFontDescriptorsFromURL(fontURL as CFURL)! as! [CTFontDescriptor]
let descriptor = CTFontDescriptorCreateCopyWithAttributes(descriptors[0], [
    kCTFontVariationAttribute: [NSNumber(value: 0x77676874): NSNumber(value: 700)],
] as CFDictionary)
let size: CGFloat = 28
let baseline: CGFloat = 28
let font = CTFontCreateWithFontDescriptor(descriptor, size, nil)
let text = NSAttributedString(string: "X ON TRACK", attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTKernAttributeName as String): 0.05,
])
let line = CTLineCreateWithAttributedString(text)
let outline = CGMutablePath()
for run in CTLineGetGlyphRuns(line) as! [CTRun] {
    let count = CTRunGetGlyphCount(run)
    var glyphs = [CGGlyph](repeating: 0, count: count)
    var positions = [CGPoint](repeating: .zero, count: count)
    CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
    CTRunGetPositions(run, CFRange(location: 0, length: 0), &positions)
    for (glyph, position) in zip(glyphs, positions) {
        if let path = CTFontCreatePathForGlyph(font, glyph, nil) {
            let transform = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: position.x, ty: baseline - position.y)
            outline.addPath(path, transform: transform)
        }
    }
}
func point(_ p: CGPoint) -> String {
    String(format: "%.4f %.4f", locale: Locale(identifier: "en_US_POSIX"), p.x, p.y)
}
var commands: [String] = []
outline.applyWithBlock { pointer in
    let element = pointer.pointee
    switch element.type {
    case .moveToPoint: commands.append("M" + point(element.points[0]))
    case .addLineToPoint: commands.append("L" + point(element.points[0]))
    case .addQuadCurveToPoint: commands.append("Q" + point(element.points[0]) + " " + point(element.points[1]))
    case .addCurveToPoint: commands.append("C" + point(element.points[0]) + " " + point(element.points[1]) + " " + point(element.points[2]))
    case .closeSubpath: commands.append("Z")
    @unknown default: fatalError("Unsupported glyph path element")
    }
}
let result: [String: Any] = [
    "text": text.string,
    "fontFamily": "Space Grotesk",
    "fontWeight": 700,
    "fontSize": size,
    "tracking": 0.05,
    "height": 36,
    "width": CTLineGetTypographicBounds(line, nil, nil, nil),
    "path": commands.joined(separator: " "),
    "source": "https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf",
    "sourceSha256": SHA256.hash(data: fontData).map { String(format: "%02x", $0) }.joined(),
    "license": "SIL Open Font License 1.1; space-grotesk-OFL.txt",
]
let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
try data.write(to: outputURL)
print("Wrote \(outputURL.lastPathComponent) using Space Grotesk 700")
