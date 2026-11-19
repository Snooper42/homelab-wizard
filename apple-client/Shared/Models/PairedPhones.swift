import Foundation

/// A paired phone or iPad as Settings › Phones lists it (the computer's
/// `Phones`, the owner's yes, Nov 19): who it is and what it may do today.
/// Never a token: the computer doesn't send one.
struct PairedPhone: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    /// It may make changes today.
    let canChange: Bool
    /// "", "card", "view" or "edit", today.
    let finances: String
    /// A wall screen: it only looks, for good.
    let kiosk: Bool
    /// The household member whose phone it is; nil for the owner's.
    let personName: String?
    var paired: Date?
    var lastSeen: Date?
    /// When its changes and Finances end; nil: until they're changed.
    var until: Date?
    /// The phone asking: its own This Device changes it.
    let isThis: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, canChange, finances, kiosk, personName, paired, lastSeen, until
        case isThis = "this"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        canChange = try c.decodeIfPresent(Bool.self, forKey: .canChange) ?? false
        finances = try c.decodeIfPresent(String.self, forKey: .finances) ?? ""
        kiosk = try c.decodeIfPresent(Bool.self, forKey: .kiosk) ?? false
        personName = try c.decodeIfPresent(String.self, forKey: .personName).flatMap { $0.isEmpty ? nil : $0 }
        isThis = try c.decodeIfPresent(Bool.self, forKey: .isThis) ?? false
        func time(_ key: CodingKeys) -> Date? {
            guard let text = (try? c.decodeIfPresent(String.self, forKey: key)) ?? nil,
                  let date = GoTime.parse(text), date.timeIntervalSince1970 > 0
            else { return nil }
            return date
        }
        paired = time(.paired)
        lastSeen = time(.lastSeen)
        until = time(.until)
    }

    /// Whose it is: "Jordan's", "A wall screen", or "Yours".
    var whose: String {
        if kiosk { return "A wall screen" }
        if let personName { return "\(personName)'s" }
        return "Yours"
    }

    /// Its line in the list, without when it was last seen: "Jordan's ·
    /// looks only · no Finances".
    var summary: String {
        var parts: [String] = []
        if kiosk { parts.append("Wall screen") } else if let personName { parts.append("\(personName)'s") }
        parts.append(canChange ? "can make changes" : "looks only")
        parts.append(finances.isEmpty ? "no Finances" : PhoneLowering.financesWords(finances).lowercased())
        let line = parts.joined(separator: " · ")
        return line.prefix(1).uppercased() + line.dropFirst()
    }
}

/// What Settings › Phones may take from a phone: only less, never more (a
/// phone can't give itself more; pairing one, or giving one more, stays on
/// the computer). Each is the computer's `LowerPhone` argument.
enum PhoneLowering: Hashable, Sendable, Identifiable {
    /// No changes from now (its For a day ends now too).
    case looksOnly
    /// A lower Finances level; "" hides them.
    case finances(String)
    case remove

    var id: String { argument }

    /// As `LowerPhone` reads it.
    var argument: String {
        switch self {
        case .looksOnly: "looksOnly"
        case .finances(let level): "finances:\(level)"
        case .remove: "remove"
        }
    }

    var title: String {
        switch self {
        case .looksOnly: "Looks Only from Now"
        case .finances(""): "Hide Finances"
        case .finances("card"): "Only the Money Card"
        case .finances: "Finances to Look At Only"
        case .remove: "Remove This Phone"
        }
    }

    /// The Finances levels, nothing first.
    static func rank(_ level: String) -> Int {
        ["", "card", "view", "edit"].firstIndex(of: level) ?? 0
    }

    /// What a Finances level lets a phone do, in words.
    static func financesWords(_ level: String) -> String {
        switch level {
        case "card": "The money card only"
        case "view": "Finances to look at"
        case "edit": "Finances to change"
        default: "No Finances"
        }
    }

    /// What can be taken from `phone`: nothing from the phone asking.
    static func offered(for phone: PairedPhone) -> [PhoneLowering] {
        guard !phone.isThis else { return [] }
        var out: [PhoneLowering] = []
        if phone.canChange { out.append(.looksOnly) }
        let have = rank(phone.finances)
        for level in ["view", "card", ""] where rank(level) < have {
            // A wall screen's money card is all it ever shows: only hiding it is less.
            if phone.kiosk, level != "" { continue }
            out.append(.finances(level))
        }
        out.append(.remove)
        return out
    }
}
