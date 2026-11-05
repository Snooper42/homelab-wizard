import Foundation

/// The companion server's address (`homelab serve`, port 8099).
///
/// It is always https. The companion makes any device that pairs over plain
/// HTTP look-only for good, because its token would cross the home Wi-Fi in
/// readable form. This client won't send a token like that at all. Use the
/// Tailscale link (`https://<machine>.<tailnet>.ts.net:8099`) or the
/// homelab domain (`https://homelab.<domain>`).
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
                "That isn't an address. It looks like https://your-mac.tailnet.ts.net:8099."
            case .insecureScheme:
                "Only https addresses work: the Tailscale link or your homelab domain. Over plain http, your device token would cross the Wi-Fi in readable form."
            case .hasCredentials:
                "Leave the user name and password out of the address."
            case .missingHost:
                "The address needs a host name."
            }
        }
    }

    /// Reads what a person typed or pasted. That can be a bare host, a URL,
    /// or the pairing link the computer shows
    /// (`https://host:8099/#pair=CODE`). For a pairing link, the code comes
    /// back too.
    static func parse(_ raw: String) throws -> (endpoint: ServerEndpoint, code: PairingCode?) {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw ValidationError.empty }
        if !text.contains("://") {
            text = "https://" + text
        }
        guard let parts = URLComponents(string: text) else { throw ValidationError.notAURL }
        guard parts.scheme?.lowercased() == "https" else { throw ValidationError.insecureScheme }
        guard parts.user == nil, parts.password == nil else { throw ValidationError.hasCredentials }
        guard let host = parts.host?.lowercased(), !host.isEmpty else { throw ValidationError.missingHost }

        var code: PairingCode?
        if let fragment = parts.fragment, fragment.hasPrefix("pair=") {
            code = PairingCode(String(fragment.dropFirst("pair=".count)))
        }

        var clean = URLComponents()
        clean.scheme = "https"
        clean.host = host
        clean.port = parts.port
        guard let url = clean.url else { throw ValidationError.notAURL }
        return (ServerEndpoint(baseURL: url), code)
    }

    /// The URL for an absolute API path such as `/api/me`, on this server only.
    func url(path: String) -> URL {
        var parts = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        parts.path = path
        return parts.url!
    }

    /// Whether `url` has this server's scheme, host and port. Requests and
    /// responses are checked against this, so a token never goes to another
    /// origin.
    func owns(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme?.lowercased() == "https"
            && url.host?.lowercased() == baseURL.host?.lowercased()
            && (url.port ?? 443) == (baseURL.port ?? 443)
    }

    /// The host and port as the screens show them.
    var displayName: String {
        let host = baseURL.host ?? baseURL.absoluteString
        if let port = baseURL.port { return "\(host):\(port)" }
        return host
    }
}
