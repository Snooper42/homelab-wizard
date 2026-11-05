import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Receipts as the computer keeps them (internal/finance/receipts.go): a
/// JPEG, PNG or WebP picture, or a PDF, at most 2 MB, sent as a data URL
/// whose type must match the bytes.
enum ReceiptCodec {
    /// `finance.MaxReceipt`.
    static let maxBytes = 2 << 20
    /// The longest side a photo is sent at: enough to read a receipt.
    static let uploadPixels = 2000
    /// The longest side a receipt is shown at here.
    static let displayPixels = 2400
    /// Larger than this by its header, an image isn't decoded at all.
    static let maxSourcePixels = 12_000

    enum Content: Sendable {
        case image(DecodedIcon)
        case pdf(Data)
    }

    /// A name as the computer gives one: its content's hash and kind.
    static func isValidName(_ name: String) -> Bool {
        let parts = name.split(separator: ".")
        guard parts.count == 2, ["jpg", "png", "webp", "pdf"].contains(String(parts[1])) else { return false }
        let hash = parts[0]
        return hash.count == 32 && hash.allSatisfy { $0.isHexDigit && ($0.isNumber || $0.isLowercase) }
    }

    /// The type from the first bytes, for the kinds a receipt may be.
    static func sniff(_ data: Data) -> String? {
        if data.starts(with: Array("%PDF-".utf8)) { return "application/pdf" }
        switch IconDecoder.sniff(data) {
        case "image/png": return "image/png"
        case "image/jpeg": return "image/jpeg"
        case "image/webp": return "image/webp"
        default: return nil
        }
    }

    /// The receipt from the `FinancesReceipt` call's data URL, ready to show.
    static func content(fromDataURL url: String) -> Content? {
        guard url.hasPrefix("data:"), let comma = url.firstIndex(of: ","),
              url.utf8.count <= maxBytes * 4 / 3 + 64
        else { return nil }
        let header = url[url.index(url.startIndex, offsetBy: 5)..<comma]
        guard header.hasSuffix(";base64"),
              let data = Data(base64Encoded: String(url[url.index(after: comma)...])),
              data.count <= maxBytes,
              let kind = sniff(data),
              header.dropLast(";base64".count).lowercased() == kind
        else { return nil }
        if kind == "application/pdf" { return .pdf(data) }
        guard let image = thumbnail(from: data, maxPixels: displayPixels) else { return nil }
        return .image(DecodedIcon(image: image))
    }

    /// A photo prepared for sending: shrunk to `uploadPixels`, turned the
    /// right way up, and re-encoded as JPEG with **no metadata**, so no
    /// location, camera or time travels with it. Quality steps down until
    /// it fits in 2 MB.
    static func preparePhoto(_ data: Data) -> String? {
        guard data.count <= 64 << 20, let image = thumbnail(from: data, maxPixels: uploadPixels) else { return nil }
        for quality in [0.8, 0.65, 0.5, 0.35] {
            let out = NSMutableData()
            guard let destination = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
            // Only the pixels are added; no properties dictionary from the source.
            CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
            guard CGImageDestinationFinalize(destination) else { return nil }
            if out.length <= maxBytes {
                return "data:image/jpeg;base64," + (out as Data).base64EncodedString()
            }
        }
        return nil
    }

    private static func thumbnail(from data: Data, maxPixels: Int) -> CGImage? {
        let options = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, options),
              CGImageSourceGetCount(source) > 0,
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, options) as? [CFString: Any],
              let width = props[kCGImagePropertyPixelWidth] as? Int,
              let height = props[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0, width <= maxSourcePixels, height <= maxSourcePixels
        else { return nil }
        let thumb = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ] as CFDictionary
        return CGImageSourceCreateThumbnailAtIndex(source, 0, thumb)
    }
}
