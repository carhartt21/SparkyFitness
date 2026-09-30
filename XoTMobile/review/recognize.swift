import Foundation
import Vision
import ImageIO

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-US", "de-DE"]
try VNImageRequestHandler(url: url).perform([request])
let result = (request.results ?? []).compactMap { observation -> [String: Any]? in
    guard let text = observation.topCandidates(1).first?.string else { return nil }
    return ["text": text, "x": observation.boundingBox.minX, "y": observation.boundingBox.minY,
            "width": observation.boundingBox.width, "height": observation.boundingBox.height]
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]))
