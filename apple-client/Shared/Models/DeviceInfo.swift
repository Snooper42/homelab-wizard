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

    enum CodingKeys: String, CodingKey {
        case id, name, canChange, finances
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        canChange = try c.decodeIfPresent(Bool.self, forKey: .canChange) ?? false
        finances = try c.decodeIfPresent(String.self, forKey: .finances)
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
