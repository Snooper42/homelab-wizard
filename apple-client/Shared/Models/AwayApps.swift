import Foundation

/// Away mode (docs/Decisions.md, ADR-0023): when neither home nor the
/// tunnel answers (Cloudflare down, say), the phone still lists the apps
/// that are on the internet through the tunnel, as last read, each with
/// Open and whether its own address answers. They're kept in the Keychain
/// beside the pairing (`CredentialStore.saveAwayApps`), so they're read
/// only on this phone, unlocked, behind the app's Face ID.
struct AwayApp: Codable, Equatable, Sendable, Identifiable {
    let id: String
    let name: String
    /// Its address on the homelab domain, through the tunnel.
    let address: URL

    /// The apps on the internet through the tunnel: the catalog's `public`
    /// ones with an https address on the homelab domain, by name.
    static func list(from status: HomelabStatus, catalog: AppCatalog) -> [AwayApp] {
        status.apps.compactMap { app in
            guard catalog.entry(app.id)?.isPublic == true,
                  let address = app.address.flatMap(httpsURL)
            else { return nil }
            return AwayApp(id: app.id, name: app.name, address: address)
        }
        .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    /// An address as an https URL, as an app's page opens it; nothing else
    /// (no plain http, and no name or password in it).
    static func httpsURL(_ address: String) -> URL? {
        let text = address.contains("://") ? address : "https://" + address
        guard let url = URL(string: text), url.scheme?.lowercased() == "https",
              let host = url.host, !host.isEmpty, url.user == nil, url.password == nil
        else { return nil }
        return url
    }

    /// Whether an app answered: any answer but a server error, which is what
    /// Cloudflare gives when the computer behind it doesn't (502, 521, 530…).
    static func answers(status: Int) -> Bool { (200..<500).contains(status) }

    /// Asks the app's own address whether it answers. Nothing of the
    /// homelab's goes with it: no token, no cookie.
    static func answers(_ address: URL, session: URLSession) async -> Bool {
        var request = URLRequest(url: address, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 6)
        request.httpMethod = "HEAD"
        request.httpShouldHandleCookies = false
        guard let reply = try? await session.data(for: request),
              let http = reply.1 as? HTTPURLResponse
        else { return false }
        return answers(status: http.statusCode)
    }

    /// The session for asking: its own, ephemeral, so it shares nothing
    /// with the companion's.
    static func askingSession(protocolClasses: [AnyClass]? = nil) -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 6
        config.timeoutIntervalForResource = 10
        config.httpCookieStorage = nil
        config.urlCache = nil
        if let protocolClasses { config.protocolClasses = protocolClasses }
        return URLSession(configuration: config)
    }
}
