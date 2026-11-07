import Foundation
import Network

/// The companion server's address (`homelab serve`, port 8099).
///
/// It is https, with one exception. The companion makes any device that
/// pairs over plain HTTP look-only for good, because its token would cross
/// the home Wi-Fi in readable form. This client won't send a token like that
/// at all. Use the Tailscale link (`https://<machine>.<tailnet>.ts.net:8099`)
/// or the homelab domain (`https://homelab.<domain>`).
///
/// The exception is the Mac app talking to the companion on the same Mac
/// (`localhost:8099`). Loopback traffic never leaves the computer, and the
/// companion counts it as encrypted too (`Encrypted` in
/// internal/companion/server.go). It is spelled `127.0.0.1`, never the name
/// `localhost`, so the hosts file can't send it elsewhere, and it is only
/// taken on macOS, where the companion can run.
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

    /// The http link from another device would carry the token across the
    /// Wi-Fi readable; on the Mac that runs the companion, localhost works.
    private static var insecureMessage: String {
        #if os(macOS)
        "Only https addresses work (your homelab domain, or the Tailscale link if you use it), or localhost:8099 when the homelab runs on this Mac. Over plain http, your device token would cross the Wi-Fi in readable form."
        #else
        "Only https addresses work: your homelab domain, or the Tailscale link if you use it. Over plain http, your device token would cross the Wi-Fi in readable form."
        #endif
    }

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

        // The companion on this Mac: plain http, which never leaves the
        // computer. A bare "localhost" means it too, since the companion
        // itself serves no https.
        let loopback = Self.loopbackHosts.contains(host) && Self.allowsLoopback
        let wanted = parts.scheme?.lowercased()
        let scheme: String
        if loopback, wanted == "http" || !typedScheme {
            scheme = "http"
        } else if wanted == "https" {
            scheme = "https"
        } else {
            throw ValidationError.insecureScheme
        }
        if loopback, host == "localhost" { host = "127.0.0.1" }

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
        // Plain http on this Mac is always the companion's port unless one is given.
        clean.port = parts.port ?? (scheme == "http" ? 8099 : nil)
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
        guard let url, let scheme = url.scheme?.lowercased(),
              scheme == baseURL.scheme?.lowercased(),
              scheme == "https" || (scheme == "http" && isThisMac)
        else { return false }
        let fallback = scheme == "https" ? 443 : 80
        return Self.bare(url.host) == Self.bare(baseURL.host)
            && (url.port ?? fallback) == (baseURL.port ?? fallback)
    }

    /// Whether this is the companion on this Mac, reached over plain http.
    var isThisMac: Bool {
        baseURL.scheme?.lowercased() == "http"
            && Self.allowsLoopback
            && Self.loopbackHosts.contains(Self.bare(baseURL.host) ?? "")
    }

    /// The loopback names taken for plain http. `localhost` is rewritten to
    /// 127.0.0.1 when parsed, so a stored endpoint never holds the name.
    private static let loopbackHosts: Set<String> = ["localhost", "127.0.0.1", "::1"]

    /// Only the Mac runs the companion, so only the Mac app may reach it on loopback.
    private static var allowsLoopback: Bool {
        #if os(macOS)
        true
        #else
        false
        #endif
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
