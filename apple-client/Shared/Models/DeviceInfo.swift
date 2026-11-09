import Foundation

/// What a paired device learns about itself (`companion.Me`, from
/// `/api/me` and `/api/pair`).
struct DeviceInfo: Codable, Sendable, Equatable {
    let id: String
    let name: String
    /// It may start, stop, restart and back up apps. A device that paired
    /// over plain HTTP never may.
    let canChange: Bool
    /// "", "card", "view" or "edit".
    let finances: String?
    /// When it paired, and when the computer last heard from it. Read as
    /// Go writes times, whatever the decoder's date strategy; a bad or zero
    /// time is nil rather than a failed read.
    var paired: Date? = nil
    var lastSeen: Date? = nil
    /// It paired over plain HTTP, so the computer keeps it look-only for good.
    var unencrypted = false
    /// The household member whose phone it is (their username), nil for
    /// the owner's. A member's phone shows their own apps and their own
    /// Finances; nothing else of the homelab answers it.
    var person: String? = nil
    /// Their name, to show ("Sam's apps").
    var personName: String? = nil

    /// A household member's phone, not the owner's.
    var isMember: Bool { !(person ?? "").isEmpty }

    enum CodingKeys: String, CodingKey {
        case id, name, canChange, finances, person, personName
    }

    private enum MoreKeys: String, CodingKey { case paired, lastSeen, unencrypted }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        canChange = try c.decodeIfPresent(Bool.self, forKey: .canChange) ?? false
        finances = try c.decodeIfPresent(String.self, forKey: .finances)
        person = try c.decodeIfPresent(String.self, forKey: .person).flatMap { $0.isEmpty ? nil : $0 }
        personName = try c.decodeIfPresent(String.self, forKey: .personName).flatMap { $0.isEmpty ? nil : $0 }
        let more = try decoder.container(keyedBy: MoreKeys.self)
        paired = Self.time(more, .paired)
        lastSeen = Self.time(more, .lastSeen)
        unencrypted = (try? more.decodeIfPresent(Bool.self, forKey: .unencrypted)) ?? false
    }

    private static func time(_ c: KeyedDecodingContainer<MoreKeys>, _ key: MoreKeys) -> Date? {
        guard let text = (try? c.decodeIfPresent(String.self, forKey: key)) ?? nil,
              let date = GoTime.parse(text), date.timeIntervalSince1970 > 0
        else { return nil }
        return date
    }
}

/// `POST /api/pair` body. Go matches field names regardless of case.
struct PairRequest: Encodable, Sendable {
    let code: String
    let name: String
    /// A TV or wall screen: never allowed to make changes or see Finances.
    let kiosk: Bool
}

/// `POST /api/pair` answer.
struct PairResponse: Decodable, Sendable {
    let token: String
    let device: DeviceInfo
}
