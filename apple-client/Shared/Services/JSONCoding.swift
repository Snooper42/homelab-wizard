import Foundation

/// Times as Go's encoding/json writes them: RFC 3339 with up to 9
/// fractional digits.
enum GoTime {
    static func parse(_ text: String) -> Date? {
        let normalized = trimFraction(text)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: normalized) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: normalized)
    }

    /// Cuts fractional seconds down to milliseconds. Go writes nanoseconds,
    /// and ISO8601DateFormatter reliably reads only three digits.
    static func trimFraction(_ text: String) -> String {
        guard let dot = text.firstIndex(of: ".") else { return text }
        let afterDot = text.index(after: dot)
        guard let zone = text[afterDot...].firstIndex(where: { $0 == "Z" || $0 == "z" || $0 == "+" || $0 == "-" }) else {
            return text
        }
        let digits = text[afterDot..<zone]
        guard digits.count > 3 else { return text }
        return String(text[..<afterDot]) + digits.prefix(3) + text[zone...]
    }
}

/// A calendar day as the computer writes it (YYYY-MM-DD, in its own time
/// zone), as noon on that day here, so a time zone can't move it.
enum LocalDay {
    static func parse(_ text: String?) -> Date? {
        guard let text else { return nil }
        let fields = text.split(separator: "-")
        guard fields.count == 3,
              let year = Int(fields[0]), let month = Int(fields[1]), let day = Int(fields[2]),
              (1...12).contains(month), (1...31).contains(day)
        else { return nil }
        var parts = DateComponents()
        parts.year = year
        parts.month = month
        parts.day = day
        parts.hour = 12
        return Calendar(identifier: .gregorian).date(from: parts)
    }
}

extension JSONDecoder {
    /// A decoder for the companion's JSON.
    static func homelab() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let text = try container.decode(String.self)
            guard let date = GoTime.parse(text) else {
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "not an RFC 3339 time")
            }
            return date
        }
        return decoder
    }
}
