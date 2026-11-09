import Foundation

/// A link into the app (`homelab://…`, unison-handoff.md section 4, item 1),
/// from an alert's button, a shortcut, or anywhere else. Anyone can send a
/// link, so **a link never changes anything by itself**: an action link opens
/// the app's page with the action waiting for one confirming tap, and only
/// on a device allowed changes. The lock still applies. Anything this
/// doesn't know, or can't read, opens Status.
///
///     homelab://status
///     homelab://app/<id>
///     homelab://app/<id>?do=restart|start|stop|logs
///     homelab://backups
///     homelab://finances
///     homelab://finances/<page>
///     homelab://tidy/inbox
enum DeepLink: Equatable, Sendable {
    case status
    case app(id: String, then: Then?)
    case backups
    case finances(page: FinancePage?)
    /// Tidy Up's Inbox lives on the computer; on the phone it opens Status
    /// until Tidy Up's questions come to the phone (item 9).
    case tidyInbox

    /// What an app link asks for once its page is open.
    enum Then: String, Sendable, CaseIterable {
        case restart, start, stop, logs

        /// The change it waits on a tap for; Logs is only a look.
        var change: AppAction? {
            switch self {
            case .restart: .restart
            case .start: .start
            case .stop: .stop
            case .logs: nil
            }
        }
    }

    /// Finances' own pages a link may open.
    enum FinancePage: String, Sendable, CaseIterable {
        case transactions, budgets, bills, accounts, investments, goals, recurring, spending, inbox, cashflow, review
    }

    static let scheme = "homelab"

    /// Reads a link. Unknown or malformed opens Status.
    static func parse(_ url: URL) -> DeepLink {
        guard url.scheme?.lowercased() == scheme,
              url.user == nil, url.password == nil, url.port == nil,
              let host = url.host?.lowercased()
        else { return .status }
        let parts = url.path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []

        switch (host, parts.count) {
        case ("status", 0):
            return .status
        case ("backups", 0):
            return .backups
        case ("finances", 0):
            return .finances(page: nil)
        case ("finances", 1):
            guard let page = FinancePage(rawValue: parts[0].lowercased()) else { return .finances(page: nil) }
            return .finances(page: page)
        case ("tidy", 1) where parts[0].lowercased() == "inbox":
            return .tidyInbox
        case ("app", 1):
            guard isAppID(parts[0]) else { return .status }
            let asked = query.filter { $0.name == "do" }
            // One `do`, that it knows, or none at all.
            guard asked.count <= 1 else { return .app(id: parts[0], then: nil) }
            let then = asked.first?.value.flatMap { Then(rawValue: $0.lowercased()) }
            return .app(id: parts[0], then: then)
        default:
            return .status
        }
    }

    /// An app's id as the catalog writes them: letters, digits, `.`, `_`
    /// and `-`, starting with a letter or digit, at most 64.
    static func isAppID(_ text: String) -> Bool {
        guard let first = text.unicodeScalars.first, text.unicodeScalars.count <= 64,
              CharacterSet.alphanumerics.contains(first), first.isASCII
        else { return false }
        return text.unicodeScalars.allSatisfy { $0.isASCII && (CharacterSet.alphanumerics.contains($0) || "._-".unicodeScalars.contains($0)) }
    }
}
