import Foundation

/// One row of an app's Sign-in details (`SignInDetails`, lane 5's 1c; the
/// owner's yes, Nov 20, on the canvas's *Idea: Sign-in details*): a password
/// or key the computer's ⚙ offers to copy into the password manager, by its
/// label and whether it's ticked Saved. Never its value: that comes one at a
/// time from `CopySignIn`, straight onto the clipboard.
struct SignInDetail: Decodable, Sendable, Equatable, Identifiable {
    enum Section: String, Sendable, CaseIterable {
        case signIn = "sign-in", paste, keepSafe = "keep-safe"

        var title: String {
            switch self {
            case .signIn: "Sign In"
            case .paste: "Paste Into Another App"
            case .keepSafe: "Keep Safe"
            }
        }
    }

    let app: String
    let key: String
    /// "Duplicati: password", "Sonarr: its API key".
    let label: String
    let section: Section
    var saved: Bool
    var id: String { app + "/" + key }

    enum CodingKeys: String, CodingKey { case app, key, label, section, saved }

    init(app: String, key: String, label: String, section: Section, saved: Bool) {
        self.app = app
        self.key = key
        self.label = label
        self.section = section
        self.saved = saved
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        app = try c.decode(String.self, forKey: .app)
        key = try c.decode(String.self, forKey: .key)
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? key
        section = Section(rawValue: try c.decodeIfPresent(String.self, forKey: .section) ?? "") ?? .paste
        saved = try c.decodeIfPresent(Bool.self, forKey: .saved) ?? false
    }

    /// What it is, under the app's own name: "Password", "API key".
    var what: String {
        var w = label
        if let colon = w.range(of: ": ") { w = String(w[colon.upperBound...]) }
        if w.hasPrefix("its ") { w = String(w.dropFirst(4)) }
        return w.prefix(1).uppercased() + w.dropFirst()
    }

    /// A section of the sheet with its rows.
    struct Part: Sendable, Equatable, Identifiable {
        let section: Section
        let rows: [SignInDetail]
        var id: String { section.rawValue }
    }

    /// The sheet's sections, in the computer's order, each with its rows.
    static func sections(_ rows: [SignInDetail]) -> [Part] {
        Section.allCases.compactMap { s in
            let these = rows.filter { $0.section == s }
            return these.isEmpty ? nil : Part(section: s, rows: these)
        }
    }
}
