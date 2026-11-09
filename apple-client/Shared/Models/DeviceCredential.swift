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
    /// Away from home through the tunnel (ADR-0023), when the computer gave
    /// it at pairing; nil for a phone paired before, or where the computer
    /// doesn't go out. Kept with the token, in the Keychain, this device only.
    var away: AwayCredential? = nil

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

/// How a phone reaches the computer away from home: the key both sides
/// derived at pairing, the tunnel's address, and the household's service
/// token that Cloudflare Access asks for.
struct AwayCredential: Codable, Sendable, Equatable {
    let key: Data
    let url: URL
    let clientID: String
    let clientSecret: String

    /// Only an https address on the tunnel's one path, with no user, query
    /// or fragment, and a 32-byte key.
    static func make(key: Data, url: String, clientID: String, clientSecret: String) -> AwayCredential? {
        guard key.count == 32, let u = URL(string: url), u.scheme == "https", let host = u.host, !host.isEmpty,
              u.path == "/api/tunnel", u.user == nil, u.password == nil, u.query == nil, u.fragment == nil,
              (1...256).contains(clientID.utf8.count), (1...512).contains(clientSecret.utf8.count)
        else { return nil }
        return AwayCredential(key: key, url: u, clientID: clientID, clientSecret: clientSecret)
    }
}

extension AwayCredential: CustomStringConvertible, CustomDebugStringConvertible, CustomReflectable {
    var description: String { "<redacted>" }
    var debugDescription: String { "AwayCredential(<redacted>)" }
    var customMirror: Mirror { Mirror(self, children: []) }
}

extension DeviceCredential: CustomStringConvertible, CustomDebugStringConvertible, CustomReflectable {
    var description: String { "<redacted>" }
    var debugDescription: String { "DeviceCredential(<redacted>)" }
    var customMirror: Mirror { Mirror(self, children: []) }
}
