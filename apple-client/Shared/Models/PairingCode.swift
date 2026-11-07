import Foundation

/// A pairing code as the computer shows it (`homelab phone pair`): 8
/// characters from an alphabet with no look-alikes (no 0/O, 1/I/L). It
/// works once, for 10 minutes.
///
/// It's a secret until it's used, so it prints as `<redacted>`.
struct PairingCode: Sendable, Equatable {
    static let length = 8
    /// Matches `codeAlphabet` in internal/companion/devices.go.
    static let alphabet: Set<Character> = Set("ABCDEFGHJKMNPQRSTUVWXYZ23456789")

    /// The code in the form the server expects: upper case, no separators.
    let value: String

    /// Takes what a person typed or pasted, with spaces, dashes or lower
    /// case. Returns nil unless that leaves exactly `length` valid characters.
    init?(_ raw: String) {
        let cleaned = Self.sanitize(raw)
        guard cleaned.count == Self.length else { return nil }
        value = cleaned
    }

    /// Keeps only characters a code can contain, upper-cased, and at most
    /// `length` of them. Used as the text field's input filter.
    static func sanitize(_ raw: String) -> String {
        String(raw.uppercased().filter { alphabet.contains($0) }.prefix(length))
    }
}

extension PairingCode: CustomStringConvertible, CustomDebugStringConvertible, CustomReflectable {
    var description: String { "<redacted>" }
    var debugDescription: String { "PairingCode(<redacted>)" }
    var customMirror: Mirror { Mirror(self, children: []) }
}
