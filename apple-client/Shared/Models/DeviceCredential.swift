import Foundation

/// What pairing leaves on this device. It's stored in the Keychain as one
/// item, so the token is always bound to the origin that issued it.
/// `APIClient` sends the token to `endpoint` and nowhere else.
///
/// The token is 32 random bytes, base64url-encoded. The computer keeps only
/// its SHA-256 hash (internal/companion/devices.go). That's why the
/// Keychain copy can't be rebuilt, and why losing it means pairing again.
struct DeviceCredential: Codable, Sendable {
    let endpoint: ServerEndpoint
    let token: String
    let deviceID: String
    let deviceName: String
    let pairedAt: Date

    /// Whether a token has the expected shape. The client rejects anything
    /// else instead of storing or sending it.
    static func isWellFormed(token: String) -> Bool {
        guard (16...512).contains(token.utf8.count) else { return false }
        return token.utf8.allSatisfy { byte in
            switch byte {
            case UInt8(ascii: "A")...UInt8(ascii: "Z"),
                 UInt8(ascii: "a")...UInt8(ascii: "z"),
                 UInt8(ascii: "0")...UInt8(ascii: "9"),
                 UInt8(ascii: "-"), UInt8(ascii: "_"):
                true
            default:
                false
            }
        }
    }
}

extension DeviceCredential: CustomStringConvertible, CustomDebugStringConvertible, CustomReflectable {
    var description: String { "<redacted>" }
    var debugDescription: String { "DeviceCredential(<redacted>)" }
    var customMirror: Mirror { Mirror(self, children: []) }
}
