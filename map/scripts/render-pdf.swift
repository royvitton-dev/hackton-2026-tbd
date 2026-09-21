import Foundation
import PDFKit
import AppKit

// Local PDF-to-raster preprocessing for the portable JavaScript analyzer.
// Usage: swift -module-cache-path /tmp/atlas-swift-cache scripts/render-pdf.swift input.pdf 16 output.png
let args = CommandLine.arguments
guard args.count == 4, let number = Int(args[2]), number > 0,
      let document = PDFDocument(url: URL(fileURLWithPath: args[1])),
      let page = document.page(at: number - 1) else {
    fputs("Usage: render-pdf.swift input.pdf page-number output.png\n", stderr)
    exit(1)
}
let bounds = page.bounds(for: .mediaBox)
let size = NSSize(width: 1800, height: 1800 * bounds.height / bounds.width)
let image = page.thumbnail(of: size, for: .mediaBox)
guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:]) else { exit(2) }
try png.write(to: URL(fileURLWithPath: args[3]), options: .atomic)
print("Rendered page \(number)/\(document.pageCount), \(png.count) bytes → \(args[3])")
