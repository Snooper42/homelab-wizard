import CoreGraphics
import Foundation
import ImageIO

/// Turns the `AppIcon` call's `data:` URL into a small image.
///
/// The bytes came from each app's own web page (the computer kept what the
/// app served), so they're treated as untrusted:
/// - Only raster types are taken: png, jpeg, gif, webp, ico. The media
///   type must match the file's own magic bytes. SVG is refused, because
///   it's a document, not an image, and there's no system decoder for it.
/// - At most 1 MB encoded, and at most 4096 × 4096 pixels by the file's own
///   header, checked before any pixels are decoded.
/// - Decoding goes through ImageIO's thumbnail path, capped at 128 pixels,
///   so a "decompression bomb" is never fully expanded in memory.
enum IconDecoder {
    static let maxEncodedBytes = 1 << 20
    static let maxSourcePixels = 4096
    static let thumbnailPixels = 128

    /// The image bytes and their type, or nil when the URL isn't an
    /// acceptable icon.
    static func payload(fromDataURL url: String) -> (type: String, data: Data)? {
        guard url.utf8.count <= maxEncodedBytes * 4 / 3 + 64,
              url.hasPrefix("data:"),
              let comma = url.firstIndex(of: ",")
        else { return nil }
        let header = url[url.index(url.startIndex, offsetBy: 5)..<comma]
        let parts = header.split(separator: ";")
        guard parts.count == 2, parts[1] == "base64" else { return nil }
        let type = String(parts[0]).lowercased()
        guard let data = Data(base64Encoded: String(url[url.index(after: comma)...])),
              data.count <= maxEncodedBytes,
              sniff(data) == type
        else { return nil }
        return (type, data)
    }

    /// The media type from the first bytes, for the types taken here only.
    static func sniff(_ data: Data) -> String? {
        let b = [UInt8](data.prefix(12))
        func starts(_ magic: [UInt8]) -> Bool { b.starts(with: magic) }
        if starts([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) { return "image/png" }
        if starts([0xFF, 0xD8, 0xFF]) { return "image/jpeg" }
        if starts(Array("GIF87a".utf8)) || starts(Array("GIF89a".utf8)) { return "image/gif" }
        if b.count >= 12, starts(Array("RIFF".utf8)), Array(b[8..<12]) == Array("WEBP".utf8) { return "image/webp" }
        if starts([0x00, 0x00, 0x01, 0x00]) { return "image/x-icon" }
        return nil
    }

    /// Decodes a small thumbnail, or nil when the image is too large or broken.
    static func thumbnail(from data: Data) -> CGImage? {
        let options = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, options),
              CGImageSourceGetCount(source) > 0
        else { return nil }

        // Read the size from the header first; refuse huge images undecoded.
        guard let props = CGImageSourceCopyPropertiesAtIndex(source, 0, options) as? [CFString: Any],
              let width = props[kCGImagePropertyPixelWidth] as? Int,
              let height = props[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0, width <= maxSourcePixels, height <= maxSourcePixels
        else { return nil }

        let thumb = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: thumbnailPixels,
        ] as CFDictionary
        return CGImageSourceCreateThumbnailAtIndex(source, 0, thumb)
    }
}

/// A decoded icon. CGImage is immutable once made, so handing one across
/// threads is safe. That's why this wrapper is unchecked Sendable.
struct DecodedIcon: @unchecked Sendable {
    let image: CGImage
}
