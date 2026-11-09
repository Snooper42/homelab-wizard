import Foundation
import Network

/// The companion server's address (`homelab serve`, port 8099).
///
/// It is https only. The companion makes any device that pairs over plain
/// HTTP look-only for good, because its token would cross the home Wi-Fi in
/// readable form. This client won't send a token like that at all. Use the
/// Tailscale link (`https://<machine>.<tailnet>.ts.net:8099`) or the homelab
/// domain (`https://homelab.<domain>`). (The Mac app's one exception, plain
/// http to the companion on the same Mac, went with the Mac app.)
struct ServerEndpoint: Codable, Sendable, Hashable {
    /// The scheme, host and port only, with no path, query, fragment or user info.
    let baseURL: URL

    enum ValidationError: LocalizedError, Equatable {
        case empty
        case notAURL
        case insecureScheme
        case hasCredentials
        case missingHost

        var errorDescription: String? {
            switch self {
            case .empty:
                "Enter the computer's address."
            case .notAURL:
                "That isn't an address. It looks like https://homelab.your-domain.com."
            case .insecureScheme:
                ServerEndpoint.insecureMessage
            case .hasCredentials:
                "Leave the user name and password out of the address."
            case .missingHost:
                "The address needs a host name."
            }
        }
    }

    /// An http link would carry the token across the Wi-Fi readable.
    private static let insecureMessage =
        "Only https addresses work: your homelab domain, or the Tailscale link if you use it. Over plain http, your device token would cross the Wi-Fi in readable form."

    /// Reads what a person typed or pasted. That can be a bare host, a URL,
    /// or the pairing link the computer shows
    /// (`https://host:8099/#pair=CODE`). For a pairing link, the code comes
    /// back too.
    static func parse(_ raw: String) throws -> (endpoint: ServerEndpoint, code: PairingCode?) {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw ValidationError.empty }
        let typedScheme = text.contains("://")
        if !typedScheme {
            text = "https://" + text
        }
        guard let parts = URLComponents(string: text) else { throw ValidationError.notAURL }
        guard parts.user == nil, parts.password == nil else { throw ValidationError.hasCredentials }
        // An IPv6 host (Tailscale's fd7a:…) may come with or without its brackets.
        guard var host = parts.host?.lowercased(), !host.isEmpty else { throw ValidationError.missingHost }
        if host.hasPrefix("["), host.hasSuffix("]") { host = String(host.dropFirst().dropLast()) }
        guard !host.isEmpty else { throw ValidationError.missingHost }

        // https only, whatever the host.
        guard parts.scheme?.lowercased() == "https" else { throw ValidationError.insecureScheme }
        let scheme = "https"

        var code: PairingCode?
        if let fragment = parts.fragment, fragment.hasPrefix("pair=") {
            code = PairingCode(String(fragment.dropFirst("pair=".count)))
        }

        var clean = URLComponents()
        clean.scheme = scheme
        if host.contains(":") {
            // IPv6: the brackets must be in the URL, or the port can't be told
            // apart. Only a real IPv6 address gets here, since an invalid
            // percent-encoded host would raise.
            guard IPv6Address(host) != nil else { throw ValidationError.notAURL }
            clean.percentEncodedHost = "[\(host)]"
        } else {
            clean.host = host
        }
        clean.port = parts.port
        guard let url = clean.url else { throw ValidationError.notAURL }
        return (ServerEndpoint(baseURL: url), code)
    }

    /// The URL for an API path such as `/api/me`, on this server only. Nil
    /// for anything outside `/api/`, or when the stored base URL can't take a
    /// path (a damaged Keychain item), so a bad value fails closed instead of
    /// crashing.
    func url(path: String) -> URL? {
        guard path.hasPrefix("/api/"), !path.contains(".."), !path.contains("?"), !path.contains("#"),
              var parts = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        else { return nil }
        parts.path = path
        parts.query = nil
        parts.fragment = nil
        return parts.url
    }

    /// Whether `url` has this server's scheme, host and port. Requests and
    /// responses are checked against this, so a token never goes to another
    /// origin, nor from https down to http.
    func owns(_ url: URL?) -> Bool {
        guard let url, url.scheme?.lowercased() == "https", baseURL.scheme?.lowercased() == "https" else { return false }
        return Self.bare(url.host) == Self.bare(baseURL.host)
            && (url.port ?? 443) == (baseURL.port ?? 443)
    }

    /// A host lower-cased, without IPv6 brackets, so both spellings compare equal.
    private static func bare(_ host: String?) -> String? {
        guard var h = host?.lowercased() else { return nil }
        if h.hasPrefix("["), h.hasSuffix("]") { h = String(h.dropFirst().dropLast()) }
        return h
    }

    /// The host and port as the screens show them.
    var displayName: String {
        let host = baseURL.host ?? baseURL.absoluteString
        if let port = baseURL.port { return "\(host):\(port)" }
        return host
    }
}

// A stored endpoint is checked again when it's read back, through the same
// rules as a typed address. A Keychain item with an http, user-info or
// path-carrying URL then reads as corrupt and is deleted, never used. The
// init is in an extension so the memberwise init stays.
extension ServerEndpoint {
    enum CodingKeys: String, CodingKey { case baseURL }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let stored = try c.decode(URL.self, forKey: .baseURL)
        guard let parsed = try? Self.parse(stored.absoluteString),
              parsed.code == nil,
              parsed.endpoint.baseURL == stored
        else {
            throw DecodingError.dataCorruptedError(forKey: .baseURL, in: c, debugDescription: "Not a clean https origin")
        }
        self.init(baseURL: parsed.endpoint.baseURL)
    }
}
