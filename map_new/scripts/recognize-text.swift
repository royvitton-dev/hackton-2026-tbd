import Foundation
import Vision
let args = CommandLine.arguments
guard args.count == 3 else { fatalError("usage: recognize-text manifest.json output-directory") }
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[1]))) as! [[String: String]]
for item in manifest {
    let target = URL(fileURLWithPath: args[2]).appendingPathComponent(item["id"]! + ".json")
    if FileManager.default.fileExists(atPath: target.path) { continue }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.006
    try VNImageRequestHandler(url: URL(fileURLWithPath: item["file"]!), options: [:]).perform([request])
    let labels: [[String: Any]] = (request.results ?? []).compactMap { observation in
        guard let text = observation.topCandidates(1).first else { return nil }
        let b = observation.boundingBox
        return ["text": text.string, "confidence": text.confidence, "x": b.midX, "z": 1 - b.midY, "width": b.width, "depth": b.height]
    }
    let data: [String: Any] = ["method": "Apple Vision accurate OCR", "languages": request.recognitionLanguages, "sourceSha256": item["sha256"]!, "labels": labels, "status": "machine-extracted-review-required"]
    try JSONSerialization.data(withJSONObject: data, options: [.prettyPrinted, .sortedKeys]).write(to: target)
    print(item["id"]!, labels.count, "text regions")
}
